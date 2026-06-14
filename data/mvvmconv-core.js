/* ============ MVVM CONVERTER · core (pure logic) ============
   Two transforms for the UI exam problems (Problem 2 / Problem 3):

     toMvvm(axaml, codeBehind)  -> { view, viewModel, notes, todos }
     toCodeBehind(axaml, viewModel) -> { view, codeBehind, notes, todos }

   The forward direction (CodeBehind -> MVVM) is the one the exam asks for and
   is the well-tested path: it reads the named controls in the .axaml, finds the
   event handlers and field setups in the .axaml.cs, and rewrites them as
   [ObservableProperty] / [RelayCommand] members bound from the view. Anything it
   does not recognise is preserved as a clearly-marked // TODO instead of being
   silently dropped, so the student sees exactly what is left to wire by hand.

   No DOM, no Avalonia — plain string work, Node-loadable for the test suite.
   UMD: window.MVVMCONV_CORE in the browser, module.exports under Node.
*/
(function (global) {
"use strict";

var NS = "ExamApp";   // matches the rest of the app's submission tooling

/* ---------------- small helpers ---------------- */
function pascal(s) {
  s = String(s || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
/* a clean property name from a control name: strip the UI-role suffix.
   SizeSlider -> Size, ColorSelector -> Color, ResetButton -> Reset, Output -> Output.
   For list-like controls (ComboBox/ListBox) also strip a trailing List/View so a
   ListBox named RecipeList yields Recipe (-> SelectedRecipe), not SelectedRecipeList. */
function propName(controlName, isList) {
  var n = String(controlName || "").replace(
    /(Slider|Selector|ComboBox|Combo|ListBox|CheckBox|Button|Btn|TextBlock|TextBox|Block|Label|Field|Picker|Toggle|Control)$/,
    "");
  if (isList) n = n.replace(/(List|View)$/, "");
  if (!n) n = controlName;
  return pascal(n);
}
function camelField(prop) { return "_" + prop.charAt(0).toLowerCase() + prop.slice(1); }
function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

/* ---------------- AXAML parsing ---------------- */
/* find every opening / self-closing tag (not </close>), with its attributes.
   Returns [{ tag, attrs:[{key,value}], start, end, selfClose, raw }]. */
function scanTags(axaml) {
  var out = [];
  var re = /<([A-Za-z][\w.]*)\b([^>]*?)(\/?)>/g;
  var m;
  while ((m = re.exec(axaml))) {
    out.push({
      tag: m[1],
      attrs: parseAttrs(m[2]),
      selfClose: m[3] === "/",
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
    });
  }
  return out;
}
function parseAttrs(s) {
  var out = [];
  var re = /([\w:.]+)\s*=\s*"([^"]*)"/g;
  var m;
  while ((m = re.exec(s || ""))) out.push({ key: m[1], value: m[2] });
  return out;
}
function attrVal(attrs, key) {
  for (var i = 0; i < attrs.length; i++) if (attrs[i].key === key) return attrs[i].value;
  return null;
}
function controlsByName(tags) {
  var map = {};
  tags.forEach(function (t) {
    var nm = attrVal(t.attrs, "x:Name") || attrVal(t.attrs, "Name");
    if (nm) map[nm] = t;
  });
  return map;
}

/* rebuild a tag's opening text from a tag object + a modification spec:
   mods = { remove:[keys], set:{key:value}, append:[{key,value}] } */
function buildOpenTag(t, mods) {
  mods = mods || {};
  var remove = mods.remove || [];
  var set = mods.set || {};
  var attrs = [];
  t.attrs.forEach(function (a) {
    if (remove.indexOf(a.key) !== -1) return;
    if (Object.prototype.hasOwnProperty.call(set, a.key)) {
      attrs.push({ key: a.key, value: set[a.key] });
      delete set[a.key];
    } else attrs.push({ key: a.key, value: a.value });
  });
  Object.keys(set).forEach(function (k) { attrs.push({ key: k, value: set[k] }); });
  (mods.append || []).forEach(function (a) { attrs.push(a); });
  var inner = attrs.map(function (a) { return a.key + '="' + a.value + '"'; }).join(" ");
  return "<" + t.tag + (inner ? " " + inner : "") + (t.selfClose ? " />" : ">");
}

/* splice replacements (each {start,end,text}) back into the source, last-first */
function spliceAll(src, repls) {
  repls.sort(function (a, b) { return b.start - a.start; });
  repls.forEach(function (r) { src = src.slice(0, r.start) + r.text + src.slice(r.end); });
  return src;
}

/* ---------------- code-behind parsing ---------------- */
/* list fields: public List<string> colors = new(){ "a", "b" }; — capture the
   generic element type (List<Recipe> stays Recipe, not silently forced to string). */
function parseListFields(cb) {
  var out = {};
  var re = /(?:public|private|protected|internal|static|readonly|\s)*List<(\w+)>\s+(\w+)\s*=\s*new[^{;]*\{([^}]*)\}/g;
  var m;
  while ((m = re.exec(cb))) {
    var items = [];
    var ire = /"([^"]*)"/g, im;
    while ((im = ire.exec(m[3]))) items.push(im[1]);
    out[m[2]] = { elem: m[1], items: items };
  }
  return out;
}
/* event handlers: Control.Event += (args) => { body }  OR  => expr; */
function parseHandlers(cb) {
  var out = [];
  var reBlock = /(\w+)\.(Click|ValueChanged|SelectionChanged|Checked|Unchecked|TextChanged|Tapped|IsCheckedChanged|PointerPressed)\s*\+=\s*(?:\([^)]*\)|\w+)\s*=>\s*\{([\s\S]*?)\};/g;
  var m;
  var consumed = [];
  while ((m = reBlock.exec(cb))) {
    out.push({ control: m[1], event: m[2], body: m[3] });
    consumed.push([m.index, m.index + m[0].length]);
  }
  // single-expression handlers (only those not already inside a captured block)
  var reExpr = /(\w+)\.(Click|ValueChanged|SelectionChanged|Checked|Unchecked|TextChanged|Tapped|IsCheckedChanged)\s*\+=\s*(?:\([^)]*\)|\w+)\s*=>\s*([^;{][^;]*);/g;
  while ((m = reExpr.exec(cb))) {
    var inside = consumed.some(function (c) { return m.index >= c[0] && m.index < c[1]; });
    if (!inside) out.push({ control: m[1], event: m[2], body: m[3] });
  }
  return out;
}
/* ItemsSource = field assignments: ColorSelector.ItemsSource = colors; */
function parseItemsSources(cb) {
  var out = {};
  var re = /(\w+)\.ItemsSource\s*=\s*(\w+)\s*;/g;
  var m;
  while ((m = re.exec(cb))) out[m[1]] = m[2];
  return out;
}
/* statements `target.Prop = expr` inside a handler body */
function parseAssignments(body) {
  var out = [];
  var re = /(\w+)\.(\w+)\s*=\s*([^;]+);/g;
  var m;
  while ((m = re.exec(body))) out.push({ target: m[1], prop: m[2], expr: m[3].trim() });
  return out;
}

/* ================= CodeBehind -> MVVM ================= */
function toMvvm(axaml, codeBehind, opts) {
  opts = opts || {};
  var ns = opts.namespace || NS;
  axaml = String(axaml || "");
  codeBehind = String(codeBehind || "");
  var notes = [], todos = [];

  var tags = scanTags(axaml);
  var byName = controlsByName(tags);
  var listFields = parseListFields(codeBehind);
  var handlers = parseHandlers(codeBehind);
  var itemsSources = parseItemsSources(codeBehind);

  // accumulators
  var props = [];          // {field, type, init}  -> [ObservableProperty]
  var lists = [];          // {name, type, items}  -> get-only collection
  var bridges = [];        // {selProp, brushProp} -> OnSelectedXChanged
  var commands = [];       // {name, lines:[]}
  var bind = {};           // controlName -> { prop: bindingExpr }  (view rewrites)
  var removeOnControl = {};// controlName -> [attr keys to drop]
  var addedProps = {};     // field name -> true (dedupe)
  var selInitial = {};     // selProp -> initial value literal (from the real SelectedIndex)

  function ensureProp(field, type, init) {
    if (addedProps[field]) return;
    addedProps[field] = true;
    props.push({ field: field, type: type, init: init });
  }
  function setBind(control, prop, expr) {
    if (!bind[control]) bind[control] = {};
    bind[control][prop] = expr;
  }
  function dropAttr(control, key) {
    if (!removeOnControl[control]) removeOnControl[control] = [];
    removeOnControl[control].push(key);
  }

  // 1) sliders: any <Slider> control, or any control whose .Value is referenced
  var sliderProp = {};   // controlName -> property name (e.g. SizeSlider -> Size)
  Object.keys(byName).forEach(function (nm) {
    var t = byName[nm];
    var valueUsed = new RegExp("\\b" + nm + "\\.Value\\b").test(codeBehind);
    if (t.tag === "Slider" || valueUsed) {
      var p = propName(nm);
      var init = attrVal(t.attrs, "Value");
      // no explicit Value: a Slider clamps up to its Minimum, so default the
      // property to Minimum (not 0) — otherwise the VM and the control disagree
      // on the starting value. Read it from the axaml; never guess.
      if (init == null || init === "") init = attrVal(t.attrs, "Minimum") || "0";
      ensureProp(camelField(p), "double", init);
      sliderProp[nm] = p;
      setBind(nm, "Value", "{Binding " + p + "}");
      notes.push("Slider " + nm + " -> bound to double property " + p + ".");
    }
  });

  // 2) combo boxes: ItemsSource assignment and/or SelectedItem usage
  var comboSel = {};   // controlName -> selected property (SelectedColor)
  Object.keys(byName).forEach(function (nm) {
    var t = byName[nm];
    var isList = t.tag === "ComboBox" || t.tag === "ListBox";
    var hasItems = Object.prototype.hasOwnProperty.call(itemsSources, nm);
    // SelectedItem is only "used" if the code reads it, a SelectionChanged handler
    // exists, or the axaml already binds/sets a SelectedItem on this control.
    var selUsed = new RegExp("\\b" + nm + "\\.SelectedItem\\b").test(codeBehind) ||
      handlers.some(function (h) { return h.control === nm && h.event === "SelectionChanged"; }) ||
      attrVal(t.attrs, "SelectedItem") != null;
    if (!isList && !hasItems && !selUsed) return;

    var base = propName(nm, isList);
    // the control's initial selection, read straight from the axaml (default 0).
    // We use it so the converted view starts on EXACTLY the same item — never the
    // first item unless the control actually started there.
    var selIdxRaw = attrVal(t.attrs, "SelectedIndex");
    var selIdx = parseInt(selIdxRaw, 10);
    if (isNaN(selIdx) || selIdx < 0) selIdx = 0;
    var first = "";
    var listName;
    var elemType = "string";
    if (hasItems) {
      var field = itemsSources[nm];
      listName = pascal(field);
      var lf = listFields[field] || { elem: "string", items: [] };
      var items = lf.items;
      elemType = lf.elem || "string";
      first = items[selIdx] != null ? items[selIdx] : (items[0] || "");
      lists.push({ name: listName, type: "List<" + elemType + ">", items: items });
      setBind(nm, "ItemsSource", "{Binding " + listName + "}");
    }
    // only auto-add a SelectedItem property + binding when it is actually used
    if (selUsed) {
      var selProp = "Selected" + base;
      if (elemType === "string") {
        ensureProp(camelField(selProp), "string", JSON.stringify(first));
        selInitial[selProp] = first;
      } else {
        // unknown element type: don't silently emit a wrong type — flag it.
        ensureProp(camelField(selProp), elemType + "?", "null");
        todos.push("SelectedItem on " + nm + " is a " + elemType +
                   " (not a string) — confirm the " + selProp + " property type and default.");
      }
      comboSel[nm] = selProp;
      setBind(nm, "SelectedItem", "{Binding " + selProp + "}");
      // SelectedItem now drives the selection, so a literal SelectedIndex would
      // fight the binding — drop it (its value is baked into the property default).
      dropAttr(nm, "SelectedIndex");
    }
    notes.push((t.tag || "ComboBox") + " " + nm + " -> ItemsSource " + (listName || "(list)") +
               (selUsed ? " + SelectedItem Selected" + base
                        : (selIdxRaw != null ? " (initial SelectedIndex kept)" : "")) + ".");
  });

  // 3) walk handlers
  handlers.forEach(function (h) {
    var ctrl = byName[h.control];
    var assigns = parseAssignments(h.body);

    if (h.event === "ValueChanged") {
      var sp = sliderProp[h.control];
      assigns.forEach(function (a) {
        var refsSlider = sp && new RegExp("\\b" + h.control + "\\.Value\\b").test(a.expr);
        if (refsSlider) {
          // Circle.Height = SizeSlider.Value  ->  bind Height to Size
          setBind(a.target, a.prop, "{Binding " + sp + "}");
          notes.push(a.target + "." + a.prop + " follows the slider -> bound to " + sp + ".");
        }
      });
    } else if (h.event === "SelectionChanged") {
      var selP = comboSel[h.control];
      assigns.forEach(function (a) {
        var brush = /Brush\.Parse\s*\(/.test(a.expr) &&
                    new RegExp("\\b" + h.control + "\\.SelectedItem\\b").test(a.expr);
        if (brush && selP) {
          var brushProp = propName(a.target) + (/Fill|Background|Brush|Color/.test(a.prop) ? a.prop : "Brush");
          ensureProp(camelField(brushProp), "IBrush",
            "Brush.Parse(" + JSON.stringify(comboFirst(selP)) + ")");
          bridges.push({ selProp: selP, brushProp: brushProp });
          setBind(a.target, a.prop, "{Binding " + brushProp + "}");
          notes.push(a.target + "." + a.prop + " from a color string -> derived IBrush " +
                     brushProp + " (updated in On" + selP + "Changed).");
        } else if (selP && new RegExp("\\b" + h.control + "\\.SelectedItem\\b").test(a.expr)) {
          setBind(a.target, a.prop, "{Binding " + selP + "}");
        }
      });
    } else if (h.event === "Click") {
      var cmdName = propName(h.control);
      var lines = [];
      assigns.forEach(function (a) {
        var sp2 = sliderProp[a.target];
        if (sp2 && a.prop === "Value") lines.push(sp2 + " = " + a.expr + ";");
        else if (byName[a.target] && comboSel[a.target] && a.prop === "SelectedItem")
          lines.push(comboSel[a.target] + " = " + a.expr + ";");
        else {
          lines.push("// TODO: port this line — " + a.target + "." + a.prop + " = " + a.expr + ";");
          todos.push("Click handler on " + h.control + ": could not auto-map `" +
                     a.target + "." + a.prop + " = " + a.expr + ";`");
        }
      });
      if (!lines.length && h.body.trim()) {
        lines.push("// TODO: port this logic —");
        h.body.trim().split("\n").forEach(function (l) { if (l.trim()) lines.push("// " + l.trim()); });
        todos.push("Click handler on " + h.control + ": body not auto-translated.");
      }
      commands.push({ name: cmdName, lines: lines });
      setBind(h.control, "Command", "{Binding " + cmdName + "Command}");
      notes.push("Button " + h.control + " -> [RelayCommand] " + cmdName + "().");
    } else {
      todos.push("Event " + h.control + "." + h.event + " has no automatic MVVM mapping yet — wire it as a command or a property reaction by hand.");
    }
  });

  // helper used above: initial value for a brush bridge = first option of its combo
  function comboFirst(selProp) {
    // prefer the exact initial selection we already resolved from SelectedIndex,
    // so the derived brush starts on the same colour the control starts on.
    if (selInitial[selProp] != null && selInitial[selProp] !== "") return selInitial[selProp];
    // selProp is "Selected<Base>"; fall back to the matching combo's first item
    for (var nm in comboSel) {
      if (comboSel[nm] === selProp) {
        var field = itemsSources[nm];
        var lf = field ? listFields[field] : null;
        var items = lf ? lf.items : [];
        return items[0] || "Black";
      }
    }
    return "Black";
  }

  var view = buildView(axaml, tags, byName, bind, removeOnControl, commands, ns);
  var viewModel = buildViewModel(props, lists, bridges, commands, ns);

  notes.push("DataContext: the View declares x:DataType + a Design.DataContext for the previewer, but the RUNTIME DataContext is set by the PROVIDED project (App.axaml.cs, or the exam's MainWindow.axaml.cs) — NOT by these two submitted files. Do not set DataContext in the submitted axaml.");

  if (!handlers.length && !Object.keys(itemsSources).length) {
    notes.push("No event handlers or ItemsSource setups were found in the code-behind — the ViewModel is a skeleton; fill in the behaviour from the original logic.");
  }
  return { view: view, viewModel: viewModel, notes: uniq(notes), todos: uniq(todos) };
}

/* rewrite the .axaml: bindings in, x:Name + literals out, vm namespace on root */
function buildView(axaml, tags, byName, bind, removeOnControl, commands, ns) {
  var repls = [];
  tags.forEach(function (t) {
    var nm = attrVal(t.attrs, "x:Name") || attrVal(t.attrs, "Name");
    var isRoot = /^(Window|UserControl)$/.test(t.tag) && t.start === firstTagStart(tags);
    if (isRoot) {
      var set = {};
      var cls = attrVal(t.attrs, "x:Class");
      if (cls) set["x:Class"] = ns + ".Views." + (cls.split(".").pop() || "MainWindow");
      var mods = {
        set: set,
        append: [
          { key: "xmlns:vm", value: "using:" + ns + ".ViewModels" },
          { key: "x:DataType", value: "vm:MainWindowViewModel" },
          { key: "xmlns:d", value: "http://schemas.microsoft.com/expression/blend/2008" },
        ],
      };
      // avoid duplicate xmlns:vm / x:DataType / xmlns:d if already present
      mods.append = mods.append.filter(function (a) { return attrVal(t.attrs, a.key) == null; });
      var rootText = buildOpenTag(t, mods);
      // Design.DataContext: previewer-only, like the designer/asynclab outputs. The
      // RUNTIME DataContext is set by the provided project (App.axaml.cs or the
      // MainWindow.axaml.cs the exam gives you), NOT by these two submitted files.
      if (!t.selfClose) {
        rootText += "\n    <Design.DataContext>" +
          "\n        <!-- previewer only; the real DataContext is set by the provided project (App.axaml.cs), not these two files -->" +
          "\n        <vm:MainWindowViewModel />" +
          "\n    </Design.DataContext>";
      }
      repls.push({ start: t.start, end: t.end, text: rootText });
      return;
    }
    if (!nm) return;
    var b = bind[nm];
    var drop = (removeOnControl[nm] || []).slice();
    if (!b && !drop.length) {
      // still strip x:Name on a plain control we touched? only if it was bound
      return;
    }
    var set2 = {};
    var append = [];
    if (b) {
      Object.keys(b).forEach(function (prop) {
        if (attrVal(t.attrs, prop) != null) set2[prop] = b[prop];
        else append.push({ key: prop, value: b[prop] });
      });
    }
    drop.push("x:Name"); drop.push("Name");
    repls.push({
      start: t.start, end: t.end,
      text: buildOpenTag(t, { remove: drop, set: set2, append: append }),
    });
  });
  return spliceAll(axaml, repls);
}
function firstTagStart(tags) { return tags.length ? tags[0].start : -1; }

/* assemble the ViewModel.cs text */
function buildViewModel(props, lists, bridges, commands, ns) {
  var usings = ["using CommunityToolkit.Mvvm.ComponentModel;"];
  if (commands.length) usings.push("using CommunityToolkit.Mvvm.Input;");
  if (lists.length) usings.push("using System.Collections.Generic;");
  var usesBrush = props.some(function (p) { return p.type === "IBrush"; });
  if (usesBrush) usings.unshift("using Avalonia.Media;");
  usings = uniq(usings).sort();

  var L = [];
  usings.forEach(function (u) { L.push(u); });
  L.push("");
  L.push("namespace " + ns + ".ViewModels;");
  L.push("");
  L.push("public partial class MainWindowViewModel : ObservableObject");
  L.push("{");

  props.forEach(function (p) {
    var init = p.init != null && p.init !== "" ? " = " + p.init + ";" : ";";
    L.push("    [ObservableProperty] private " + p.type + " " + p.field + init);
  });
  if (props.length && (lists.length || bridges.length || commands.length)) L.push("");

  lists.forEach(function (l) {
    var items = l.items.map(function (x) { return JSON.stringify(x); }).join(", ");
    L.push("    public " + l.type + " " + l.name + " { get; } = new() { " + items + " };");
  });
  if (lists.length && (bridges.length || commands.length)) L.push("");

  bridges.forEach(function (b) {
    var pp = pascal(b.selProp.replace(/^_/, ""));
    L.push("    partial void On" + pp + "Changed(string value) => " +
           pascal(b.brushProp.replace(/^_/, "")) + " = Brush.Parse(value);");
  });
  if (bridges.length && commands.length) L.push("");

  commands.forEach(function (c, i) {
    L.push("    [RelayCommand]");
    if (c.lines.length === 1 && c.lines[0].indexOf("//") !== 0) {
      L.push("    private void " + c.name + "() => " + c.lines[0]);
    } else {
      L.push("    private void " + c.name + "()");
      L.push("    {");
      c.lines.forEach(function (ln) { L.push("        " + ln); });
      L.push("    }");
    }
    if (i < commands.length - 1) L.push("");
  });

  L.push("}");
  return L.join("\n") + "\n";
}

/* ================= MVVM -> CodeBehind (study aid) ================= */
/* Reverse is approximate by nature: the exam wants MVVM, so this exists to help
   you SEE the equivalence, not to hand in. It strips bindings back to x:Name and
   scaffolds a code-behind from the ViewModel's members, leaving TODOs where the
   original intent can't be recovered from declarations alone. */
function toCodeBehind(axaml, viewModel, opts) {
  opts = opts || {};
  var ns = opts.namespace || "CircleCodeBehind";
  axaml = String(axaml || "");
  viewModel = String(viewModel || "");
  var notes = [], todos = [];

  // parse VM members
  var obs = [];   // {prop, type, init}
  var reObs = /\[ObservableProperty\][^\n]*\bprivate\s+([\w<>?]+)\s+_(\w+)\s*(?:=\s*([^;]+))?;/g;
  var m;
  while ((m = reObs.exec(viewModel))) obs.push({ prop: pascal(m[2]), type: m[1], init: (m[3] || "").trim() });
  var cmds = [];
  var reCmd = /\[RelayCommand[^\]]*\]\s*[\s\S]*?\bvoid\s+(\w+)\s*\(/g;
  while ((m = reCmd.exec(viewModel))) cmds.push(m[1]);

  // strip bindings in the view, give each touched control a UNIQUE x:Name,
  // and clean the MVVM-only bits off the root so the result is valid code-behind XAML
  var tags = scanTags(axaml);
  var repls = [];
  var usedNames = {};
  var rootStart = firstTagStart(tags);
  tags.forEach(function (t) {
    if (/^(Window|UserControl)$/.test(t.tag) && t.start === rootStart) {
      var rset = {};
      var cls = attrVal(t.attrs, "x:Class");
      if (cls) rset["x:Class"] = ns + "." + (cls.split(".").pop() || "MainWindow");
      repls.push({ start: t.start, end: t.end,
        text: buildOpenTag(t, { remove: ["xmlns:vm", "x:DataType", "x:CompileBindings"], set: rset }) });
      return;
    }
    var changed = false, drop = [];
    var nameGuess = null;
    t.attrs.forEach(function (a) {
      var mb = /^\{Binding\s+(\w+)/.exec(a.value);
      if (mb) {
        changed = true;
        nameGuess = nameGuess || mb[1];
        drop.push(a.key);   // remove the bound attribute; code-behind sets it
      }
    });
    if (changed) {
      var base = (nameGuess || t.tag) + "Control";
      var nm = base, k = 2;
      while (usedNames[nm]) { nm = base + k; k++; }
      usedNames[nm] = true;
      repls.push({ start: t.start, end: t.end,
        text: buildOpenTag(t, { remove: drop, append: [{ key: "x:Name", value: nm }] }) });
    }
  });
  var view = spliceAll(axaml, repls);

  // scaffold the code-behind
  var L = [];
  L.push("using Avalonia.Controls;");
  L.push("using Avalonia.Media;");
  L.push("");
  L.push("namespace " + ns + ";");
  L.push("");
  L.push("public partial class MainWindow : Window");
  L.push("{");
  L.push("    public MainWindow()");
  L.push("    {");
  L.push("        InitializeComponent();");
  if (obs.length || cmds.length) L.push("");
  obs.forEach(function (o) {
    L.push("        // TODO: initialise / react to " + o.prop +
           (o.init ? " (was " + o.init + ")" : "") + " on the relevant control by x:Name");
  });
  cmds.forEach(function (c) {
    L.push("        // TODO: wire a control event to the old " + c + "() logic, e.g.:");
    L.push("        //   SomeButton.Click += (_, _) => { /* " + c + " body */ };");
  });
  L.push("    }");
  L.push("}");
  notes.push("Reverse conversion is a scaffold: bindings were stripped to x:Name and the ViewModel members became TODO hooks. Fill in the event wiring from the original commands.");
  todos.push("MVVM -> CodeBehind is approximate; verify every control name and port each command body into an event handler.");
  return { view: view, codeBehind: L.join("\n") + "\n", notes: notes, todos: todos };
}

/* ---------------- bundled example: the CircleCodeBehind exam project ---------------- */
function example() {
  return {
    axaml:
'<Window xmlns="https://github.com/avaloniaui"\n' +
'        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n' +
'        x:Class="CircleCodeBehind.MainWindow"\n' +
'        Title="CircleCodeBehind">\n' +
'        <StackPanel Margin="50">\n' +
'            <Ellipse x:Name="Circle" Fill="green" Height="50" Width="50"></Ellipse>\n' +
'            <ComboBox SelectedIndex="0" x:Name="ColorSelector"></ComboBox>\n' +
'            <Slider x:Name="SizeSlider" Minimum="50" Maximum="500" Value="50"></Slider>\n' +
'            <Button x:Name="ResetButton">Reset</Button>\n' +
'            <TextBlock x:Name="Output"></TextBlock>\n' +
'        </StackPanel>\n' +
'</Window>\n',
    codeBehind:
'using Avalonia.Controls;\n' +
'using Avalonia.Media;\n' +
'using System.Collections.Generic;\n\n' +
'namespace CircleCodeBehind;\n\n' +
'public partial class MainWindow : Window\n' +
'{\n' +
'    public List<string> colors = new(){"Green", "Red", "Blue", "Purple", "Black"};\n\n' +
'    public MainWindow()\n' +
'    {\n' +
'        InitializeComponent();\n\n' +
'        SizeSlider.ValueChanged += (e, v) =>\n' +
'        {\n' +
'            Circle.Height = SizeSlider.Value;\n' +
'            Circle.Width = SizeSlider.Value;\n' +
'            Output.Text = SizeSlider.Value.ToString();\n' +
'        };\n\n' +
'        ResetButton.Click += (_, _) =>\n' +
'        {\n' +
'            SizeSlider.Value = 100;\n' +
'        };\n\n' +
'        ColorSelector.ItemsSource = colors;\n' +
'        ColorSelector.SelectionChanged += (_, _) =>\n' +
'        {\n' +
'            Circle.Fill = Brush.Parse(ColorSelector.SelectedItem.ToString());\n' +
'        };\n' +
'    }\n' +
'}\n',
  };
}

var API = { toMvvm: toMvvm, toCodeBehind: toCodeBehind, example: example,
            propName: propName };
global.MVVMCONV_CORE = API;
if (typeof module !== "undefined" && module.exports) module.exports = API;

})(typeof window !== "undefined" ? window : globalThis);
