/* ============================================================
   TEST LAB CORE · pure C# -> xUnit test proposer
   UMD module: attaches window.TESTLAB_CORE in the browser and
   module.exports under Node. NO DOM access anywhere in this file.
   Parses pasted C# (services + CommunityToolkit ViewModels) and
   PROPOSES ready-to-paste xUnit test files: plain unit tests,
   ViewModel command tests, headless Avalonia scaffolds, async
   timing tests, plus the exact-version csproj and an offline runbook.
   csproj versions below are verified against the local Starter Kit:
     C:\Users\Max\Desktop\AOP Exam Starter Kit\ExamApp.Tests\ExamApp.Tests.csproj
   ============================================================ */

(function (global) {
  "use strict";

  /* ===================== verified package versions ===================== */
  /* Read directly from the Starter Kit csproj (do not change without
     re-reading the real file; the NuGet cache offline must match). */
  var PKG = {
    targetFramework: "net9.0",
    "coverlet.collector": "6.0.4",
    "Microsoft.NET.Test.Sdk": "17.14.1",
    "xunit": "2.9.3",
    "xunit.runner.visualstudio": "3.1.4",
    "Avalonia.Headless.XUnit": "11.2.1",
  };

  /* ===================== text preparation ===================== */

  /* Replace string/char literals and comments with same-length spaces so
     the parser never trips on braces/keywords inside literals. Line
     structure (offsets, line numbers) is preserved 1:1, mirroring the
     analyzer's stripForScan so regexes can be written against clean text. */
  function stripForScan(text) {
    var src = String(text == null ? "" : text);
    var out = src.split("");
    var n = src.length;
    function blank(idx) {
      var c = out[idx];
      if (c !== "\n" && c !== "\r") out[idx] = " ";
    }
    var i = 0;
    while (i < n) {
      var c = src[i], d = src[i + 1];
      if (c === "/" && d === "/") {
        while (i < n && src[i] !== "\n") { blank(i); i++; }
        continue;
      }
      if (c === "/" && d === "*") {
        blank(i); blank(i + 1); i += 2;
        while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { blank(i); i++; }
        if (i < n) { blank(i); blank(i + 1); i += 2; }
        continue;
      }
      if (c === '"' || ((c === "@" || c === "$") && (d === '"' || ((d === "@" || d === "$") && src[i + 2] === '"')))) {
        var j = i;
        var verbatim = false;
        while (src[j] === "@" || src[j] === "$") { if (src[j] === "@") verbatim = true; blank(j); j++; }
        blank(j); j++; /* opening quote */
        while (j < n) {
          if (verbatim) {
            if (src[j] === '"' && src[j + 1] === '"') { blank(j); blank(j + 1); j += 2; continue; }
            if (src[j] === '"') { blank(j); j++; break; }
          } else {
            if (src[j] === "\\") { blank(j); if (j + 1 < n) blank(j + 1); j += 2; continue; }
            if (src[j] === '"') { blank(j); j++; break; }
            if (src[j] === "\n") break;
          }
          blank(j); j++;
        }
        i = j;
        continue;
      }
      if (c === "'") {
        var j2 = i;
        blank(j2); j2++;
        var steps = 0;
        while (j2 < n && src[j2] !== "'" && src[j2] !== "\n" && steps < 12) {
          if (src[j2] === "\\") { blank(j2); j2++; steps++; }
          if (j2 < n) { blank(j2); j2++; steps++; }
        }
        if (j2 < n && src[j2] === "'") { blank(j2); j2++; }
        i = j2;
        continue;
      }
      i++;
    }
    return out.join("");
  }

  /* Find the brace span of the next { ... } after fromIdx. Returns null if
     a ';' arrives first (bodyless decl) or there is no brace. Clamps on
     unbalanced input instead of throwing. */
  function findSpan(stripped, fromIdx) {
    var n = stripped.length;
    var i = fromIdx;
    while (i < n && stripped[i] !== "{" && stripped[i] !== ";") i++;
    if (i >= n || stripped[i] === ";") return null;
    var d = 0;
    for (var j = i; j < n; j++) {
      if (stripped[j] === "{") d++;
      else if (stripped[j] === "}") { d--; if (d === 0) return { open: i, close: j }; }
    }
    return { open: i, close: n - 1 };
  }

  /* ===================== small helpers ===================== */

  function pascal(name) {
    var s = String(name || "").replace(/^[_@]+/, "");
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function camel(name) {
    var s = String(name || "").replace(/^[_@]+/, "");
    if (!s) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  /* RelayCommand member name per CommunityToolkit rules:
     method `Foo`  -> `FooCommand`
     method `FooAsync` -> `FooCommand` (Async suffix stripped) */
  function commandName(methodName) {
    var n = String(methodName || "");
    n = n.replace(/Async$/, "");
    return pascal(n) + "Command";
  }

  /* split a parameter list "int a, IFoo b, string s = \"x\"" into
     [{type:"int", name:"a", isInterface:false}, ...]  */
  function parseParams(raw) {
    var s = String(raw || "").trim();
    if (!s) return [];
    var parts = [];
    var depth = 0, cur = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === "<" || ch === "(" || ch === "[") depth++;
      else if (ch === ">" || ch === ")" || ch === "]") depth--;
      if (ch === "," && depth === 0) { parts.push(cur); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    return parts.map(function (p) {
      var seg = p.trim();
      if (!seg) return null;
      seg = seg.replace(/=.*$/, "").trim();             /* drop default value */
      seg = seg.replace(/^\s*(this|params|ref|out|in)\s+/, "");
      var toks = seg.split(/\s+/);
      if (toks.length < 2) return null;
      var name = toks[toks.length - 1].replace(/^@/, "");
      var type = toks.slice(0, toks.length - 1).join(" ").trim();
      return { type: type, name: name, isInterface: isInterfaceType(type) };
    }).filter(Boolean);
  }

  function isInterfaceType(type) {
    var t = String(type || "").replace(/[?\s]/g, "").replace(/<.*$/, "");
    /* I + UpperCase + lower-ish, the standard C# interface naming convention */
    return /^I[A-Z][A-Za-z0-9]/.test(t);
  }

  var PRIMITIVE = {
    "int": "0", "long": "0L", "short": "0", "byte": "0", "uint": "0u",
    "double": "0.0", "float": "0f", "decimal": "0m",
    "bool": "false", "char": "'a'", "string": '"x"', "object": "new object()",
    "int?": "0", "double?": "0.0", "bool?": "false",
  };

  function isPrimitive(type) {
    var t = String(type || "").trim();
    return Object.prototype.hasOwnProperty.call(PRIMITIVE, t);
  }

  function dummyArg(type) {
    var t = String(type || "").trim();
    if (Object.prototype.hasOwnProperty.call(PRIMITIVE, t)) return PRIMITIVE[t];
    if (/\?$/.test(t)) return "null";
    if (isInterfaceType(t)) return "new Fake" + t.replace(/^I/, "").replace(/[?<>,\s].*$/, "") + "()";
    if (/^(List|IList|IEnumerable|ICollection|IReadOnlyList)\s*</.test(t)) {
      var inner = (t.match(/<\s*([^>]*)>/) || [])[1] || "object";
      return "new List<" + inner.trim() + ">()";
    }
    /* unknown reference type: best effort default */
    return "default!";
  }

  /* category of a return type, for assert heuristics */
  function returnCategory(type) {
    var t = String(type || "").replace(/\s/g, "");
    if (!t || t === "void") return "void";
    if (t === "Task" || t === "ValueTask") return "void";          /* async no-result */
    var taskMatch = t.match(/^(Task|ValueTask)<(.+)>$/);
    if (taskMatch) t = taskMatch[2];
    if (t === "bool" || t === "bool?") return "bool";
    if (/^(int|long|short|byte|uint|double|float|decimal|int\?|double\?|long\?)$/.test(t)) return "numeric";
    if (t === "string" || t === "string?") return "string";
    if (/^(List|IList|IEnumerable|ICollection|IReadOnlyList|ObservableCollection|Array|.*\[\])/.test(t) ||
        /^I?Enumerable</.test(t) || /\[\]$/.test(t)) return "collection";
    return "object";
  }

  /* ===================== parser ===================== */

  /* Parse one class body (stripped + original). Extracts toolkit markers,
     ctor params, public methods, public properties, [ObservableProperty]
     fields -> generated property names, [RelayCommand] -> command members. */
  function parseClassBody(origBody, strippedBody, header) {
    var cls = {
      name: header.name,
      baseType: header.baseType,
      interfaces: header.interfaces,
      isPartial: header.isPartial,
      isObservableObject: false,
      usesObservableProperty: false,
      usesRelayCommand: false,
      isToolkitViewModel: false,
      ctorParams: [],
      methods: [],
      properties: [],
      observableProps: [],   /* {field, property, type} */
      commands: [],          /* {method, command, isAsync, canExecute, params} */
    };

    /* toolkit base/interface detection */
    var allBaseNames = [];
    if (header.baseType) allBaseNames.push(header.baseType);
    allBaseNames = allBaseNames.concat(header.interfaces || []);
    allBaseNames.forEach(function (b) {
      if (/ObservableObject|ObservableRecipient|ViewModelBase|ObservableValidator/.test(b)) cls.isObservableObject = true;
    });

    /* attribute detection across the whole body */
    if (/\[\s*ObservableProperty\b/.test(strippedBody)) cls.usesObservableProperty = true;
    if (/\[\s*RelayCommand\b/.test(strippedBody)) cls.usesRelayCommand = true;

    /* ---- [ObservableProperty] fields -> generated PascalCase property ---- */
    var opRe = /\[\s*ObservableProperty\b[^\]]*\]([\s\S]*?);/g;
    var m;
    while ((m = opRe.exec(strippedBody))) {
      var chunk = m[1];
      /* chunk may carry other attributes then `private Type name` */
      var fieldRe = /(?:\[[^\]]*\]\s*)*(?:private|protected|internal|public)?\s*(?:readonly\s+)?([\w<>,\.\?\[\]]+)\s+([A-Za-z_]\w*)\s*$/;
      var fm = fieldRe.exec(chunk.replace(/=.*$/, "").trim());
      if (!fm) {
        /* fall back: last two identifiers in the chunk */
        var toks = chunk.replace(/=.*$/, "").trim().split(/\s+/);
        if (toks.length >= 2) fm = [null, toks[toks.length - 2], toks[toks.length - 1]];
        else continue;
      }
      var ftype = fm[1];
      var fname = fm[2].replace(/^[_@]/, "");
      var prop = pascal(fname);
      cls.observableProps.push({ field: fm[2], property: prop, type: ftype });
    }

    /* ---- [RelayCommand] methods -> generated command members ---- */
    var rcRe = /\[\s*RelayCommand\b([^\]]*)\]/g;
    while ((m = rcRe.exec(strippedBody))) {
      var attrArgs = m[1] || "";
      var afterIdx = m.index + m[0].length;
      /* find the method signature following the attribute (skip extra attrs) */
      var rest = strippedBody.slice(afterIdx);
      var sigRe = /(?:\[[^\]]*\]\s*)*(?:public|private|protected|internal|async|static|\s)*?([\w<>,\.\?\[\]]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/;
      var sm = sigRe.exec(rest);
      if (!sm) continue;
      var isAsync = /\basync\b/.test(rest.slice(0, sm.index + sm[0].length)) ||
        /Task/.test(sm[1]);
      var mname = sm[2];
      var canExec = null;
      var ceMatch = attrArgs.match(/CanExecute\s*=\s*nameof\s*\(\s*([A-Za-z_]\w*)\s*\)/);
      if (ceMatch) canExec = ceMatch[1];
      cls.commands.push({
        method: mname,
        command: commandName(mname),
        isAsync: isAsync,
        canExecute: canExec,
        params: parseParams(sm[3]),
      });
    }

    /* ---- ctor params (first ctor matching the class name) ---- */
    var ctorRe = new RegExp("(?:public|internal|protected)\\s+" + escapeRe(cls.name) + "\\s*\\(([^)]*)\\)");
    var cm = ctorRe.exec(strippedBody);
    if (cm) cls.ctorParams = parseParams(cm[1]);

    /* ---- public methods (exclude ctor, commands already captured) ---- */
    var commandMethodNames = {};
    cls.commands.forEach(function (c) { commandMethodNames[c.method] = true; });
    var methRe = /\bpublic\s+(?:virtual\s+|override\s+|sealed\s+|new\s+)?(?:async\s+)?([\w<>,\.\?\[\]]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:where\b[^{;]*)?(\{|=>|;)/g;
    while ((m = methRe.exec(strippedBody))) {
      var rtype = m[1];
      var name = m[2];
      if (name === cls.name) continue;                 /* ctor */
      if (rtype === "class" || rtype === "void" && name === cls.name) continue;
      if (/^(get|set|init|add|remove|if|for|foreach|while|switch|return|using|lock)$/.test(name)) continue;
      var isAsyncM = /\basync\b/.test(strippedBody.slice(Math.max(0, m.index), m.index + m[0].length)) ||
        /^(Task|ValueTask)\b/.test(rtype);
      cls.methods.push({
        name: name,
        returnType: rtype,
        params: parseParams(m[3]),
        isAsync: isAsyncM,
        isCommandBacking: !!commandMethodNames[name],
      });
    }

    /* ---- public properties (auto-properties with get/set or get-only) ---- */
    var propRe = /\bpublic\s+(?:virtual\s+|override\s+|new\s+)?([\w<>,\.\?\[\]]+)\s+([A-Za-z_]\w*)\s*\{\s*get\b[^}]*\}/g;
    while ((m = propRe.exec(strippedBody))) {
      var ptype = m[1];
      var pname = m[2];
      if (ptype === "class") continue;
      var seg = m[0];
      var hasSet = /\bset\b/.test(seg) || /\binit\b/.test(seg);
      cls.properties.push({ name: pname, type: ptype, hasSet: hasSet });
    }

    /* generated observable props are also public properties for assert purposes */
    cls.observableProps.forEach(function (op) {
      if (!cls.properties.some(function (p) { return p.name === op.property; })) {
        cls.properties.push({ name: op.property, type: op.type, hasSet: true, generated: true });
      }
    });

    cls.isToolkitViewModel = cls.isObservableObject || cls.usesObservableProperty || cls.usesRelayCommand;
    return cls;
  }

  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  /* class/interface header parse from a declaration line */
  var TYPE_DECL_RE = /\b(?:public\s+|internal\s+|abstract\s+|sealed\s+|static\s+|partial\s+)*\b(class|interface|record)\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*(?::\s*([^\{]+))?/g;

  function parse(files) {
    var model = { classes: [], interfaces: [], usesToolkit: false };
    var list = Array.isArray(files) ? files : [];
    list.forEach(function (f) {
      if (!f || typeof f.text !== "string") return;
      var text = f.text;
      var stripped = stripForScan(text);
      var re = new RegExp(TYPE_DECL_RE.source, "g");
      var m;
      while ((m = re.exec(stripped))) {
        var kind = m[1];
        var name = m[2];
        var inherit = (m[3] || "").trim();
        var bases = inherit ? inherit.split(",").map(function (s) { return s.trim().replace(/<.*$/, ""); }).filter(Boolean) : [];
        var baseType = null, interfaces = [];
        bases.forEach(function (b) {
          if (isInterfaceType(b)) interfaces.push(b);
          else if (!baseType) baseType = b;
          else interfaces.push(b);
        });
        var lineStart = stripped.lastIndexOf("\n", m.index) + 1;
        var isPartial = /\bpartial\b/.test(stripped.slice(lineStart, m.index + m[0].length));
        var span = findSpan(stripped, re.lastIndex);

        if (kind === "interface") {
          var membersText = span ? stripped.slice(span.open + 1, span.close) : "";
          model.interfaces.push({
            name: name,
            file: f.name,
            members: parseInterfaceMembers(membersText),
          });
        } else {
          var origBody = span ? text.slice(span.open, span.close + 1) : "";
          var strippedBody = span ? stripped.slice(span.open, span.close + 1) : "";
          var cls = parseClassBody(origBody, strippedBody, {
            name: name, baseType: baseType, interfaces: interfaces, isPartial: isPartial,
          });
          cls.file = f.name;
          cls.kind = kind;
          model.classes.push(cls);
        }
      }
    });

    /* resolve: does any class use the toolkit? */
    model.usesToolkit = model.classes.some(function (c) { return c.isToolkitViewModel; });

    /* attach resolved interface member info to ctor params where the
       interface source was also pasted (drives real fakes vs TODO fakes) */
    var ifaceByName = {};
    model.interfaces.forEach(function (i) { ifaceByName[i.name] = i; });
    model.classes.forEach(function (c) {
      c.ctorParams.forEach(function (p) {
        if (p.isInterface) {
          var key = p.type.replace(/[?\s]/g, "").replace(/<.*$/, "");
          p.knownInterface = ifaceByName[key] || null;
        }
      });
    });
    model.interfacesByName = ifaceByName;
    return model;
  }

  /* shallow interface member parse: methods (name, return, params) and
     properties (name, type, get/set). Depth-0 ';' ends a method member;
     a depth-0 { ... } block belongs to a property. */
  function parseInterfaceMembers(body) {
    var members = [];
    var depth = 0, cur = "";
    for (var i = 0; i < body.length; i++) {
      var ch = body[i];
      if (ch === "{") {
        depth++;
        if (depth === 1) {
          /* property accessor block: capture and treat preceding text as a property */
          var rest = body.slice(i);
          var close = matchBrace(rest);
          var block = rest.slice(0, close + 1);
          var decl = cur.trim();
          var pm = /([\w<>,\.\?\[\]]+)\s+([A-Za-z_]\w*)\s*$/.exec(decl);
          if (pm) {
            members.push({
              kind: "property", type: pm[1], name: pm[2],
              hasGet: /\bget\b/.test(block), hasSet: /\bset\b/.test(block) || /\binit\b/.test(block),
            });
          }
          cur = "";
          i += close;
          depth = 0;
          continue;
        }
        continue;
      }
      if (ch === "}") { depth--; continue; }
      if (depth === 0) {
        if (ch === ";") {
          var d2 = cur.trim();
          if (d2) {
            var mm = /([\w<>,\.\?\[\]]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/.exec(d2);
            if (mm) {
              members.push({ kind: "method", returnType: mm[1], name: mm[2], params: parseParams(mm[3]) });
            } else {
              /* property with =>... or no accessor block; best effort */
              var pm2 = /([\w<>,\.\?\[\]]+)\s+([A-Za-z_]\w*)\s*$/.exec(d2.replace(/=>.*$/, "").trim());
              if (pm2) members.push({ kind: "property", type: pm2[1], name: pm2[2], hasGet: true, hasSet: false });
            }
          }
          cur = "";
        } else cur += ch;
      }
    }
    return members;
  }

  function matchBrace(s) {
    var d = 0;
    for (var i = 0; i < s.length; i++) {
      if (s[i] === "{") d++;
      else if (s[i] === "}") { d--; if (d === 0) return i; }
    }
    return s.length - 1;
  }

  /* ===================== fake interface emission ===================== */

  /* Build the inline fake class source for an interface ctor param.
     If the interface members are known (source pasted), implement them for
     real with simple recording/returns; otherwise emit a single TODO. */
  function fakeClassFor(param, indent) {
    indent = indent || "";
    var ifaceType = param.type.replace(/[?\s]/g, "").replace(/<.*$/, "");
    var fakeName = "Fake" + ifaceType.replace(/^I/, "");
    var lines = [];
    lines.push(indent + "private sealed class " + fakeName + " : " + ifaceType);
    lines.push(indent + "{");
    var known = param.knownInterface;
    if (known && known.members && known.members.length) {
      known.members.forEach(function (mem) {
        if (mem.kind === "method") {
          var ps = (mem.params || []).map(function (p) { return p.type + " " + p.name; }).join(", ");
          var cat = returnCategory(mem.returnType);
          var rt = String(mem.returnType).replace(/\s/g, "");
          /* record the call; return a benign default */
          lines.push(indent + "    public int " + mem.name + "Calls { get; private set; }");
          var body;
          if (rt === "void") {
            body = mem.name + "Calls++;";
            lines.push(indent + "    public " + mem.returnType + " " + mem.name + "(" + ps + ") => " + body);
          } else if (rt === "Task") {
            body = mem.name + "Calls++; return Task.CompletedTask;";
            lines.push(indent + "    public " + mem.returnType + " " + mem.name + "(" + ps + ") { " + body + " }");
          } else {
            var ret = defaultReturn(cat, mem.returnType);
            lines.push(indent + "    public " + mem.returnType + " " + mem.name + "(" + ps + ") { " + mem.name + "Calls++; return " + ret + "; }");
          }
        } else if (mem.kind === "property") {
          var acc = (mem.hasSet ? "{ get; set; }" : "{ get; } = " + defaultReturn(returnCategory(mem.type), mem.type) + ";");
          lines.push(indent + "    public " + mem.type + " " + mem.name + " " + acc);
        }
      });
    } else {
      lines.push(indent + "    // TODO: implement members of " + ifaceType + " (interface source not pasted)");
    }
    lines.push(indent + "}");
    return { name: fakeName, code: lines.join("\n") };
  }

  function defaultReturn(cat, type) {
    switch (cat) {
      case "bool": return "true";
      case "numeric": return "0";
      case "string": return '""';
      case "collection": {
        var inner = ((String(type).match(/<\s*([^>]*)>/) || [])[1] || "object").trim();
        return "new List<" + inner + ">()";
      }
      default: return "default!";
    }
  }

  /* ===================== generators ===================== */

  var NS = "ExamApp.Tests";

  function fileHeader(usings) {
    var lines = usings.slice();
    lines.push("");
    lines.push("namespace " + NS + ";");
    lines.push("");
    return lines.join("\n");
  }

  /* sut construction lines + the set of fake classes needed */
  function buildSut(cls) {
    var fakes = [];
    var args = cls.ctorParams.map(function (p) {
      if (p.isInterface) {
        var fk = fakeClassFor(p, "");
        if (!fakes.some(function (x) { return x.name === fk.name; })) fakes.push(fk);
        return "new " + fk.name + "()";
      }
      return dummyArg(p.type);
    });
    var ctorCall = "new " + cls.name + "(" + args.join(", ") + ")";
    return { ctorCall: ctorCall, fakes: fakes };
  }

  /* ---- Generator 1: plain xUnit per class ---- */
  function genPlain(cls) {
    var sut = buildSut(cls);
    var L = [];
    var pubMethods = cls.methods.filter(function (mt) { return !mt.isCommandBacking; });

    L.push("public class " + cls.name + "Tests");
    L.push("{");

    if (!pubMethods.length) {
      L.push("    [Fact]");
      L.push("    public void Construction_WithValidArguments_Succeeds()");
      L.push("    {");
      L.push("        // Arrange & Act");
      L.push("        var sut = " + sut.ctorCall + ";");
      L.push("");
      L.push("        // Assert");
      L.push("        Assert.NotNull(sut);");
      L.push("    }");
    }

    pubMethods.forEach(function (mt, mi) {
      emitMethodFact(L, cls, mt, sut);
      /* [Theory] for 1-2 primitive params */
      var prims = mt.params.filter(function (p) { return isPrimitive(p.type); });
      if (prims.length >= 1 && prims.length <= 2 && mt.params.length === prims.length && !mt.isAsync) {
        emitMethodTheory(L, cls, mt, sut);
      }
    });

    L.push("");
    /* emit fakes inside the test class */
    sut.fakes.forEach(function (fk) {
      L.push(indentBlock(fk.code, ""));
      L.push("");
    });
    /* drop trailing blank before closing brace */
    while (L.length && L[L.length - 1] === "") L.pop();
    L.push("}");

    var usings = ["using ExamApp;", "using Xunit;"];
    if (sut.fakes.length || cls.methods.some(function (m) { return returnCategory(m.returnType) === "collection"; }) ||
        cls.ctorParams.some(function (p) { return /List|IEnumerable|ICollection/.test(p.type); })) {
      usings.unshift("using System.Collections.Generic;");
    }
    if (cls.methods.some(function (m) { return m.isAsync; })) usings.unshift("using System.Threading.Tasks;");
    usings.unshift("using System;");
    usings = dedup(usings);

    return { fileName: cls.name + "Tests.cs", code: fileHeader(usings) + L.join("\n") + "\n" };
  }

  function emitMethodFact(L, cls, mt, sut) {
    var cat = returnCategory(mt.returnType);
    if (L[L.length - 1] !== "{") L.push("");
    if (cat === "bool") {
      /* True/False pair of [Fact]s: one for each expected outcome.
         Inputs that force each branch need the author's judgement -> TODO. */
      L.push("    [Fact]");
      L.push("    public void " + mt.name + "_WhenConditionHolds_ReturnsTrue()");
      L.push("    {");
      L.push("        // Arrange");
      L.push("        var sut = " + sut.ctorCall + ";");
      L.push("        // TODO: choose arguments / state for which " + mt.name + " should be true");
      L.push("");
      L.push("        // Act");
      L.push("        var result = sut." + callExpr(mt) + ";");
      L.push("");
      L.push("        // Assert");
      L.push("        Assert.True(result);");
      L.push("    }");
      L.push("");
      L.push("    [Fact]");
      L.push("    public void " + mt.name + "_WhenConditionFails_ReturnsFalse()");
      L.push("    {");
      L.push("        // Arrange");
      L.push("        var sut = " + sut.ctorCall + ";");
      L.push("        // TODO: choose arguments / state for which " + mt.name + " should be false");
      L.push("");
      L.push("        // Act");
      L.push("        var result = sut." + callExpr(mt) + ";");
      L.push("");
      L.push("        // Assert");
      L.push("        Assert.False(result);");
      L.push("    }");
      return;
    }
    L.push("    [Fact]");
    L.push("    public void " + mt.name + "_" + scenarioName(mt) + "_" + expectedName(cat) + "()");
    L.push("    {");
    L.push("        // Arrange");
    L.push("        var sut = " + sut.ctorCall + ";");
    L.push("");
    if (cat === "void") {
      L.push("        // Act");
      L.push("        " + (mt.isAsync ? "// await " : "") + "sut." + callExpr(mt) + ";");
      L.push("");
      L.push("        // Assert");
      var affected = cls.properties.filter(function (p) { return p.name !== mt.name; })[0];
      if (affected) {
        L.push("        // TODO: assert the state " + mt.name + " is expected to change");
        L.push("        Assert.NotNull(sut." + affected.name + ");");
      } else {
        L.push("        // TODO: assert on the observable effect of " + mt.name + " (no public property detected)");
      }
    } else {
      L.push("        // Act");
      L.push("        var result = sut." + callExpr(mt) + ";");
      L.push("");
      L.push("        // Assert");
      if (cat === "numeric") {
        L.push("        Assert.Equal(0 /* TODO: expected */, result);");
      } else if (cat === "string") {
        L.push('        Assert.Equal("" /* TODO: expected */, result);');
      } else if (cat === "collection") {
        L.push("        Assert.NotNull(result);");
        L.push("        Assert.NotEmpty(result); // TODO: adjust if an empty result is valid");
      } else {
        L.push("        Assert.NotNull(result); // TODO: assert the meaningful property of result");
      }
    }
    L.push("    }");
  }

  function emitMethodTheory(L, cls, mt, sut) {
    var cat = returnCategory(mt.returnType);
    L.push("");
    /* build 2-3 inline rows with edge values per param */
    var rows = inlineRows(mt.params);
    rows.forEach(function (r) { L.push("    [InlineData(" + r + ")]"); });
    var sig = mt.params.map(function (p) { return paramCsType(p.type) + " " + p.name; }).join(", ");
    L.push("    [Theory]");
    /* xUnit wants [Theory] above [InlineData]; reorder by re-emitting */
    L.splice(L.length - 1 - rows.length, rows.length + 1); /* remove what we just pushed */
    L.push("    [Theory]");
    rows.forEach(function (r) { L.push("    [InlineData(" + r + ")]"); });
    L.push("    public void " + mt.name + "_VariousInputs_BehavesConsistently(" + sig + ")");
    L.push("    {");
    L.push("        // Arrange");
    L.push("        var sut = " + sut.ctorCall + ";");
    L.push("");
    L.push("        // Act");
    var callArgs = mt.params.map(function (p) { return p.name; }).join(", ");
    if (cat === "void") {
      L.push("        " + (mt.isAsync ? "// await " : "") + "sut." + mt.name + "(" + callArgs + ");");
      L.push("");
      L.push("        // Assert");
      L.push("        // TODO: assert the effect for each row");
    } else {
      L.push("        var result = sut." + mt.name + "(" + callArgs + ");");
      L.push("");
      L.push("        // Assert");
      if (cat === "bool") L.push("        // TODO: assert the expected boolean per row");
      else if (cat === "numeric") L.push("        // TODO: assert the expected number per row\n        _ = result;");
      else if (cat === "string") L.push("        // TODO: assert the expected string per row\n        _ = result;");
      else { L.push("        Assert.NotNull(result);"); }
    }
    L.push("    }");
  }

  function paramCsType(type) {
    var t = String(type).trim();
    /* InlineData parameter declared types: nullable string stays string */
    return t;
  }

  function inlineRows(params) {
    /* produce 2-3 rows; first row uses edge values, others typical */
    function edge(type) {
      var t = String(type).replace(/\s/g, "");
      if (/^(int|long|short|byte|uint)\??$/.test(t)) return ["0", "-1", "5"];
      if (/^(double|float|decimal)\??$/.test(t)) return ["0.0", "-1.0", "2.5"];
      if (t === "bool" || t === "bool?") return ["true", "false", "true"];
      if (t === "string" || t === "string?") return ['""', "null", '"abc"'];
      if (t === "char") return ["'a'", "'z'", "' '"];
      return ["default", "default", "default"];
    }
    var perParam = params.map(function (p) { return edge(p.type); });
    var rows = [];
    for (var r = 0; r < 3; r++) {
      rows.push(perParam.map(function (vals) { return vals[r]; }).join(", "));
    }
    return rows;
  }

  function callExpr(mt) {
    var args = mt.params.map(function (p) { return dummyArg(p.type); }).join(", ");
    return mt.name + "(" + args + ")";
  }

  function scenarioName(mt) {
    if (!mt.params.length) return "WhenCalled";
    return "WithGivenInput";
  }

  function expectedName(cat) {
    switch (cat) {
      case "numeric": return "ReturnsExpectedNumber";
      case "string": return "ReturnsExpectedString";
      case "collection": return "ReturnsNonEmptyResult";
      case "void": return "UpdatesState";
      default: return "ReturnsExpected";
    }
  }

  /* ---- Generator 2: ViewModel mode ---- */
  function genViewModel(cls) {
    var sut = buildSut(cls);
    var L = [];
    L.push("public class " + cls.name + "Tests");
    L.push("{");

    /* a command-driven test per command */
    cls.commands.forEach(function (cmd, ci) {
      if (ci > 0) L.push("");
      /* A looping start (Start/Resume/Run/Begin async + unbounded loop) must be
         fired WITHOUT awaiting — awaiting the loop would block until Stop and hang
         the test host — then stopped so the orphaned loop cannot leak past the test
         (emitLoopFireAndStop). When no stop-style command exists we do not fire it
         at all (a guarded comment is emitted instead). Firing-then-stopping awaits,
         so the method is `async Task` whenever a breaker exists; a non-looping async
         command awaits and is `async Task` too. */
      var looping = isLoopingStart(cmd, cls.commands);
      var breaker = looping ? loopBreaker(cmd, cls.commands) : null;
      var isAsyncMethod = (cmd.isAsync && !looping) || (looping && !!breaker);
      var exec = cmd.isAsync
        ? "await vm." + cmd.command + ".ExecuteAsync(null);"
        : "vm." + cmd.command + ".Execute(null);";
      L.push("    [Fact]");
      var rtName = cls.observableProps.length ? "UpdatesState" : "Executes";
      L.push("    public " + (isAsyncMethod ? "async Task " : "void ") + cmd.method + "Command_WhenExecuted_" + rtName + "()");
      L.push("    {");
      L.push("        // Arrange");
      L.push("        var vm = " + sut.ctorCall + ";");
      /* if a CanExecute guard exists, set up state so it can run */
      if (cmd.canExecute) {
        L.push("        // TODO: set state so " + cmd.canExecute + "() returns true before executing");
      }
      L.push("");
      L.push("        // Act");
      if (looping) {
        emitLoopFireAndStop(L, cmd, breaker, "        ");
      } else {
        L.push("        " + exec);
      }
      L.push("");
      L.push("        // Assert");
      var coll = cls.properties.filter(function (p) { return /ObservableCollection|List/.test(p.type); })[0];
      if (coll) {
        L.push("        Assert.NotNull(vm." + coll.name + ");");
        L.push("        // TODO: assert the expected count after " + cmd.method + ", e.g.:");
        L.push("        // Assert.Single(vm." + coll.name + ");");
      } else if (cls.observableProps.length) {
        var op = cls.observableProps[0];
        L.push("        // TODO: assert the expected value of vm." + op.property + " after " + cmd.method);
        L.push("        _ = vm." + op.property + ";");
      } else {
        L.push("        // TODO: assert the observable effect of executing " + cmd.command);
      }
      L.push("    }");
    });

    /* CanExecute test where a guard is declared */
    var guarded = cls.commands.filter(function (c) { return c.canExecute; });
    guarded.forEach(function (cmd) {
      L.push("");
      L.push("    [Fact]");
      L.push("    public void " + cmd.method + "Command_CanExecute_ReflectsGuardState()");
      L.push("    {");
      L.push("        // Arrange");
      L.push("        var vm = " + sut.ctorCall + ";");
      L.push("");
      L.push("        // Assert: guard blocks execution in the initial state");
      L.push("        Assert.False(vm." + cmd.command + ".CanExecute(null));");
      L.push("");
      L.push("        // TODO: set the state that satisfies " + cmd.canExecute + "(), then:");
      L.push("        // Assert.True(vm." + cmd.command + ".CanExecute(null));");
      L.push("    }");
    });

    /* PropertyChanged capture helper test */
    if (cls.observableProps.length) {
      var prop = cls.observableProps[0];
      var assign = sampleAssignment(prop);
      L.push("");
      L.push("    [Fact]");
      L.push("    public void Setting" + prop.property + "_RaisesPropertyChanged()");
      L.push("    {");
      L.push("        // Arrange");
      L.push("        var vm = " + sut.ctorCall + ";");
      L.push("        var changed = new List<string>();");
      L.push("        vm.PropertyChanged += (_, e) => changed.Add(e.PropertyName!);");
      L.push("");
      L.push("        // Act");
      L.push("        vm." + prop.property + " = " + assign + ";");
      L.push("");
      L.push("        // Assert");
      L.push('        Assert.Contains("' + prop.property + '", changed);');
      L.push("    }");
    }

    L.push("");
    sut.fakes.forEach(function (fk) {
      L.push(indentBlock(fk.code, ""));
      L.push("");
    });
    while (L.length && L[L.length - 1] === "") L.pop();
    L.push("}");

    var usings = ["using System;", "using System.Collections.Generic;"];
    if (cls.commands.some(function (c) { return c.isAsync; })) usings.push("using System.Threading.Tasks;");
    usings.push("using ExamApp.ViewModels;");
    usings.push("using Xunit;");
    usings = dedup(usings);

    return { fileName: cls.name + "Tests.cs", code: fileHeader(usings) + L.join("\n") + "\n" };
  }

  function sampleAssignment(prop) {
    var cat = returnCategory(prop.type);
    switch (cat) {
      case "bool": return "true";
      case "numeric": return "1";
      case "string": return '"changed"';
      default: return "default!";
    }
  }

  /* ---- Generator 3: headless scaffold (TestAppBuilder + HeadlessUiTests) ----
     G1: the rubric rewards FINDING and CLICKING the real control, so the test
     must FindControl<Button>(name) + FindControl<TextBlock>(name), assert both
     are non-null, drive the button through its bound Command (a click, never an
     awaited VM command — awaiting could block a looping command and hang the
     headless host), then assert the bound TextBlock text.
     G9: the target namespace and the view-class name are options. The view
     class defaults to MainWindow and is NEVER derived by stripping "ViewModel"
     off the VM name; the namespace defaults to ExamApp. Control names come from
     the parsed view when the caller passes them, else a clearly-marked
     placeholder constant the student edits to match the view's Name="...". */
  function genHeadless(opts) {
    opts = opts || {};
    var vm = opts.viewModel || "MainWindowViewModel";
    /* G9: view class defaults to MainWindow, not <VM stripped of "ViewModel"> */
    var win = opts.viewClass || opts.window || "MainWindow";
    var cmd = opts.command || null;       /* a RelayCommand member, for the comment only */
    /* G9: target namespace (the app project's root namespace). The test
       namespace tracks it (<app>.Tests) unless given explicitly, so a custom
       app namespace produces matching test/using namespaces. With no options
       both default to ExamApp / ExamApp.Tests, byte-for-byte as before. */
    var appNs = opts.targetNamespace || opts.namespace || "ExamApp";
    var testNs = opts.testNamespace ||
      (opts.targetNamespace || opts.namespace ? appNs + ".Tests" : NS);
    /* G1: real control names. Pulled from the parsed view when the caller has
       them; otherwise a clearly-marked placeholder the student renames. */
    var hasButtonName = !!opts.buttonName;
    var hasTextName = !!opts.textName;
    var buttonName = opts.buttonName || "ClickButton";
    var textName = opts.textName || "ResultText";

    /* TestAppBuilder.cs — verbatim structure from the Starter Kit */
    var builder = [
      "using Avalonia;",
      "using Avalonia.Headless;",
      "using " + appNs + ";",
      "",
      "[assembly: AvaloniaTestApplication(typeof(TestAppBuilder))]",
      "",
      "public class TestAppBuilder",
      "{",
      "    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<App>()",
      "        .UseHeadless(new AvaloniaHeadlessPlatformOptions());",
      "}",
      "",
    ].join("\n");

    /* HeadlessUiTests.cs — find the real Button + TextBlock, click, assert text */
    var nameNote = (hasButtonName && hasTextName)
      ? "        // Control names taken from the parsed view's Name=\"...\" attributes."
      : "        // TODO: rename \"" + buttonName + "\" / \"" + textName + "\" to the Name=\"...\" your AXAML gives the\n" +
        "        // button and the result TextBlock (FindControl returns null otherwise).";
    var ui = [
      "using Avalonia.Controls;",
      "using Avalonia.Headless;",
      "using Avalonia.Headless.XUnit;",
      "using " + appNs + ".ViewModels;",
      "using " + appNs + ".Views;",
      "using Xunit;",
      "",
      "namespace " + testNs + ";",
      "",
      "// Headless Avalonia UI test: a real Window + a real Button click, no rendering.",
      "// The rubric rewards locating and clicking the control, not calling the VM",
      "// command directly, so this finds the Button and the bound TextBlock by name.",
      "public class HeadlessUiTests",
      "{",
      "    [AvaloniaFact]",
      "    public void ClickingButton_UpdatesBoundText()",
      "    {",
      "        // Arrange: build the VM and show the window (Show() is required, even headless)",
      "        var vm = new " + vm + "();",
      "        var window = new " + win + " { DataContext = vm };",
      "        window.Show();",
      "",
      "        // Locate the real controls by Name (these become null if the names don't match)",
      nameNote,
      "        var button = window.FindControl<Button>(\"" + buttonName + "\");",
      "        var text = window.FindControl<TextBlock>(\"" + textName + "\");",
      "        Assert.NotNull(button);",
      "        Assert.NotNull(text);",
      "",
      "        // Act: click the real button N times via its bound Command (a click, not an",
      "        // awaited VM call — awaiting a looping command would block the headless host).",
      "        for (var i = 0; i < 100; i++)",
      "        {",
      "            button!.Command?.Execute(button.CommandParameter);",
      "        }",
      "",
      "        // Assert: the bound TextBlock reflects the new state.",
      (cmd
        ? "        // (the button is bound to " + cmd + " in the AXAML)"
        : "        // (bind the button's Command to the relevant RelayCommand in the AXAML)"),
      "        // TODO: assert the expected text, e.g. Assert.Equal(\"100\", text!.Text);",
      "        Assert.NotNull(text!.Text);",
      "    }",
      "}",
      "",
    ].join("\n");

    return [
      { fileName: "TestAppBuilder.cs", code: builder },
      { fileName: "HeadlessUiTests.cs", code: ui },
    ];
  }

  /* ---- Generator 4: async tests ---- */
  function genAsync(cls) {
    var sut = buildSut(cls);
    var L = [];
    var counterProp = (cls.observableProps[0] && cls.observableProps[0].property) ||
      (cls.properties.filter(function (p) { return returnCategory(p.type) === "numeric"; })[0] || {}).name ||
      "Count";

    var startCmd = findCmd(cls, /^start/i);
    var stopCmd = findCmd(cls, /^stop/i);
    var resetCmd = findCmd(cls, /^reset/i);
    var resumeCmd = findCmd(cls, /^resume/i);

    L.push("public class " + cls.name + "AsyncTests");
    L.push("{");

    /* timing-tolerant increment test */
    L.push("    [Fact]");
    L.push("    public async Task " + (startCmd ? startCmd.method : "Start") + "_IncrementsOverTime()");
    L.push("    {");
    L.push("        // Arrange");
    L.push("        var vm = " + sut.ctorCall + ";");
    L.push("");
    L.push("        // Act: let it run for a few ticks (counter advances ~+1 / 100ms)");
    L.push("        // Start runs a loop, so fire it WITHOUT awaiting (awaiting would block until Stop).");
    L.push("        " + startLine(startCmd));
    L.push("        await Task.Delay(350);");
    L.push("        " + execLine(stopCmd, "Stop"));
    L.push("");
    L.push("        // Assert: never assert exact equality on timing — use a tolerant range.");
    L.push("        Assert.InRange(vm." + counterProp + ", 2, 4);");
    L.push("    }");

    /* stop-resume-reset sequence */
    L.push("");
    L.push("    [Fact]");
    L.push("    public async Task StopResumeReset_BehavesAsExpected()");
    L.push("    {");
    L.push("        // Arrange");
    L.push("        var vm = " + sut.ctorCall + ";");
    L.push("");
    L.push("        // Act + Assert: run, stop, confirm it holds, resume, then reset");
    L.push("        " + startLine(startCmd));
    L.push("        await Task.Delay(250);");
    L.push("        " + execLine(stopCmd, "Stop"));
    L.push("        var afterStop = vm." + counterProp + ";");
    L.push("        await Task.Delay(150);");
    L.push("        Assert.Equal(afterStop, vm." + counterProp + "); // stopped => no further change");
    L.push("");
    if (resumeCmd) {
      L.push("        " + startLine(resumeCmd));
      L.push("        await Task.Delay(250);");
      L.push("        Assert.True(vm." + counterProp + " > afterStop); // resumed => advances again");
      L.push("");
    }
    L.push("        " + execLine(resetCmd, "Reset"));
    L.push("        Assert.Equal(0, vm." + counterProp + "); // reset => back to zero");
    L.push("    }");

    L.push("}");
    L.push("");
    L.push("/*");
    L.push(" * Why these asserts are timing-tolerant:");
    L.push(" * The counter advances on a timer (roughly +1 per 100ms), so the exact");
    L.push(" * value when the test observes it depends on scheduler jitter and the");
    L.push(" * machine load. Asserting Assert.Equal(3, ...) would be flaky. Assert.InRange");
    L.push(" * (or a >/>= comparison) tolerates a tick of slack while still proving the");
    L.push(" * behaviour. Keep delays comfortably larger than one tick to avoid races.");
    L.push(" */");

    var usings = dedup([
      "using System.Threading.Tasks;",
      "using ExamApp.ViewModels;",
      "using Xunit;",
    ]);

    return { fileName: cls.name + "AsyncTests.cs", code: fileHeader(usings) + L.join("\n") + "\n" };
  }

  function findCmd(cls, re) {
    return cls.commands.filter(function (c) { return re.test(c.method); })[0] || null;
  }
  /* fire a loop-style command without awaiting (awaiting an infinite
     loop would deadlock the test); discard the returned Task with `_ =`. */
  function startLine(cmd) {
    if (!cmd) return "// vm.StartCommand.Execute(null); // TODO: no Start command detected";
    if (cmd.isAsync) return "_ = vm." + cmd.command + ".ExecuteAsync(null); // fire-and-forget";
    return "vm." + cmd.command + ".Execute(null);";
  }
  function execLine(cmd, fallback) {
    if (cmd) {
      return cmd.isAsync
        ? "await vm." + cmd.command + ".ExecuteAsync(null);"
        : "vm." + cmd.command + ".Execute(null);";
    }
    return "// vm." + fallback + "Command.Execute(null); // TODO: no " + fallback + " command detected";
  }

  /* ===================== function listing (picker) ===================== */

  /* A "function" the picker can target: every public method that is not a
     command backing field, plus every [RelayCommand] command. The stable
     key is `ClassName.MethodName` (the C# method name, not the generated
     Command member) so a saved selection survives re-parsing. */
  function functionKey(className, methodName) {
    return String(className) + "." + String(methodName);
  }

  /* Return [{ key, className, name, signature, kind, isCommand, isAsync,
     method, command }] for one class. `kind` is "command" | "method". */
  function listFunctions(cls) {
    var out = [];
    (cls.commands || []).forEach(function (cmd) {
      out.push({
        key: functionKey(cls.name, cmd.method),
        className: cls.name,
        name: cmd.method,
        kind: "command",
        isCommand: true,
        isAsync: cmd.isAsync,
        signature: (cmd.isAsync ? "async " : "") + cmd.method + "(" +
          (cmd.params || []).map(function (p) { return p.type + " " + p.name; }).join(", ") + ")  ⟶ " + cmd.command,
        method: cmd,
        command: cmd.command,
      });
    });
    (cls.methods || []).forEach(function (mt) {
      if (mt.isCommandBacking) return;   /* already represented as a command */
      out.push({
        key: functionKey(cls.name, mt.name),
        className: cls.name,
        name: mt.name,
        kind: "method",
        isCommand: false,
        isAsync: mt.isAsync,
        signature: (mt.isAsync ? "async " : "") + mt.returnType + " " + mt.name + "(" +
          (mt.params || []).map(function (p) { return p.type + " " + p.name; }).join(", ") + ")",
        method: mt,
        command: null,
      });
    });
    return out;
  }

  /* Flat list across the whole model (used by the UI picker). */
  function listAllFunctions(model) {
    var out = [];
    ((model && model.classes) || []).forEach(function (cls) {
      if (cls.kind === "interface") return;
      listFunctions(cls).forEach(function (fn) { out.push(fn); });
    });
    return out;
  }

  /* Is `key` selected? `selection` is a map key -> bool. Absent key = selected
     (all-on by default), so an empty/undefined selection means "everything". */
  function isSelected(selection, key) {
    if (!selection || typeof selection !== "object") return true;
    if (!Object.prototype.hasOwnProperty.call(selection, key)) return true;
    return selection[key] !== false;
  }

  /* ===================== Generator: Per-function P/N/E trio ===================== */

  /* Emit the Positive / Negative / Edge trio for one plain (non-command)
     method into L. Region comments label each part. */
  function emitPlainTrio(L, cls, fn, sut) {
    var mt = fn.method;
    var cat = returnCategory(mt.returnType);
    /* null-testable reference params: non-nullable strings, interfaces,
       collections and other reference types. Value-type primitives and any
       explicitly-nullable param (`T?`) are excluded — passing null there is
       either a compile error or a legal value, not a contract violation. */
    var refParams = mt.params.filter(function (p) { return isNullTestable(p.type); });
    var numParams = mt.params.filter(function (p) {
      return /^(int|long|short|byte|uint|double|float|decimal)\??$/.test(String(p.type).replace(/\s/g, ""));
    });

    /* ---- Positive ---- */
    L.push("    // --- Positive --- happy path: valid, representative arguments");
    L.push("    [Fact]");
    L.push("    public " + (mt.isAsync ? "async Task " : "void ") + mt.name + "_WithValidInput_" + expectedName(cat) + "()");
    L.push("    {");
    L.push("        // Arrange");
    L.push("        var sut = " + sut.ctorCall + ";");
    L.push("");
    L.push("        // Act");
    var posCall = mt.name + "(" + mt.params.map(function (p) { return validArg(p.type); }).join(", ") + ")";
    if (cat === "void") {
      L.push("        " + (mt.isAsync ? "await " : "") + "sut." + posCall + ";");
      L.push("");
      L.push("        // Assert");
      var aff = cls.properties.filter(function (p) { return p.name !== mt.name; })[0];
      if (aff) {
        L.push("        Assert.NotNull(sut." + aff.name + "); // TODO: assert the state " + mt.name + " changes");
      } else {
        L.push("        // TODO: assert the observable effect of " + mt.name + " (no public property detected)");
      }
    } else {
      L.push("        var result = " + (mt.isAsync ? "await " : "") + "sut." + posCall + ";");
      L.push("");
      L.push("        // Assert");
      positiveAssert(L, cat);
    }
    L.push("    }");

    /* ---- Negative ---- */
    L.push("");
    L.push("    // --- Negative --- invalid input: nulls / out-of-range / wrong values");
    if (refParams.length) {
      var rp = refParams[0];
      L.push("    [Fact]");
      L.push("    public " + (mt.isAsync ? "async Task " : "void ") + mt.name + "_WithNull" + pascal(rp.name) + "_Throws()");
      L.push("    {");
      L.push("        // Arrange");
      L.push("        var sut = " + sut.ctorCall + ";");
      L.push("");
      L.push("        // Act + Assert: null is invalid for the reference parameter '" + rp.name + "'.");
      L.push("        // if " + mt.name + " tolerates null, assert the fallback instead of the throw.");
      var nullArgs = mt.params.map(function (p) { return p === rp ? "null!" : validArg(p.type); }).join(", ");
      if (mt.isAsync) {
        L.push("        await Assert.ThrowsAsync<ArgumentNullException>(async () => await sut." + mt.name + "(" + nullArgs + "));");
      } else {
        L.push("        Assert.Throws<ArgumentNullException>(() => sut." + mt.name + "(" + nullArgs + "));");
      }
      L.push("    }");
    } else if (numParams.length) {
      var np = numParams[0];
      L.push("    [Fact]");
      L.push("    public " + (mt.isAsync ? "async Task " : "void ") + mt.name + "_WithNegative" + pascal(np.name) + "_HandledOrThrows()");
      L.push("    {");
      L.push("        // Arrange");
      L.push("        var sut = " + sut.ctorCall + ";");
      L.push("");
      L.push("        // Act + Assert: -1 is out of the plausible valid range for '" + np.name + "'.");
      L.push("        // if " + mt.name + " guards the range, assert Throws; if it clamps, assert the clamped result.");
      var negArgs = mt.params.map(function (p) { return p === np ? "-1" : validArg(p.type); }).join(", ");
      if (cat === "void") {
        L.push("        // " + (mt.isAsync ? "await " : "") + "Assert.Throws<ArgumentOutOfRangeException>(() => sut." + mt.name + "(" + negArgs + "));");
        L.push("        " + (mt.isAsync ? "await " : "") + "sut." + mt.name + "(" + negArgs + "); // TODO: replace with the guarded behaviour");
      } else {
        L.push("        var result = " + (mt.isAsync ? "await " : "") + "sut." + mt.name + "(" + negArgs + ");");
        L.push("        // TODO: assert the expected handling of a negative '" + np.name + "'");
        L.push("        _ = result;");
      }
      L.push("    }");
    } else {
      L.push("    [Fact]");
      L.push("    public " + (mt.isAsync ? "async Task " : "void ") + mt.name + "_WithInvalidState_BehavesDefensively()");
      L.push("    {");
      L.push("        // Arrange");
      L.push("        var sut = " + sut.ctorCall + ";");
      L.push("");
      L.push("        // Act + Assert");
      L.push("        // TODO: " + mt.name + " takes no reference/numeric parameters to invalidate.");
      L.push("        // Drive it from an invalid object state (e.g. call it before a required setup step)");
      L.push("        // and assert the defensive behaviour (throw, no-op, or a sentinel result).");
      if (cat === "void") {
        L.push("        " + (mt.isAsync ? "await " : "") + "sut." + mt.name + "(" + mt.params.map(function (p) { return validArg(p.type); }).join(", ") + ");");
      } else {
        L.push("        var result = " + (mt.isAsync ? "await " : "") + "sut." + mt.name + "(" + mt.params.map(function (p) { return validArg(p.type); }).join(", ") + ");");
        L.push("        _ = result;");
      }
      L.push("    }");
    }

    /* ---- Edge ---- */
    L.push("");
    L.push("    // --- Edge --- boundary values: 0, 1, -1, empty / whitespace, single-element");
    var theoryParams = mt.params.filter(function (p) { return edgeRows(p.type) !== null; });
    if (theoryParams.length && theoryParams.length === mt.params.length && !mt.isAsync && mt.params.length <= 2) {
      emitEdgeTheory(L, cls, mt, sut, cat);
    } else if (isComparisonName(mt.name) && cat !== "void") {
      /* equality boundary fact for Min/Max/Average/Between-style names */
      L.push("    [Fact]");
      L.push("    public void " + mt.name + "_AtEqualityBoundary_IsHandled()");
      L.push("    {");
      L.push("        // Arrange");
      L.push("        var sut = " + sut.ctorCall + ";");
      L.push("");
      L.push("        // Act + Assert: '" + mt.name + "' implies a comparison — test the equal/boundary case.");
      L.push("        var result = sut." + mt.name + "(" + mt.params.map(function (p) { return validArg(p.type); }).join(", ") + ");");
      L.push("        // TODO: assert the documented behaviour when the compared values are equal");
      L.push("        _ = result;");
      L.push("    }");
    } else {
      L.push("    [Fact]");
      L.push("    public " + (mt.isAsync ? "async Task " : "void ") + mt.name + "_AtBoundary_IsHandled()");
      L.push("    {");
      L.push("        // Arrange");
      L.push("        var sut = " + sut.ctorCall + ";");
      L.push("");
      L.push("        // Act + Assert");
      L.push("        // TODO: exercise the boundary relevant to " + mt.name + " (empty collection,");
      L.push("        // single element, first/last index) and assert the edge behaviour.");
      if (cat === "void") {
        L.push("        " + (mt.isAsync ? "await " : "") + "sut." + mt.name + "(" + mt.params.map(function (p) { return validArg(p.type); }).join(", ") + ");");
      } else {
        L.push("        var result = " + (mt.isAsync ? "await " : "") + "sut." + mt.name + "(" + mt.params.map(function (p) { return validArg(p.type); }).join(", ") + ");");
        L.push("        _ = result;");
      }
      L.push("    }");
    }
  }

  /* positive-path assert lines for a non-void category */
  function positiveAssert(L, cat) {
    if (cat === "bool") {
      L.push("        // TODO: with valid input the result is expected to be true (adjust if the");
      L.push("        // representative case should be false).");
      L.push("        Assert.True(result);");
    } else if (cat === "numeric") {
      L.push("        Assert.Equal(0 /* TODO: expected */, result);");
    } else if (cat === "string") {
      L.push('        Assert.Equal("" /* TODO: expected */, result);');
    } else if (cat === "collection") {
      L.push("        Assert.NotNull(result);");
      L.push("        Assert.NotEmpty(result); // TODO: adjust if an empty result is valid");
    } else {
      L.push("        Assert.NotNull(result); // TODO: assert the meaningful property of result");
    }
  }

  /* edge [Theory] for a plain method (type-aware rows only) */
  function emitEdgeTheory(L, cls, mt, sut, cat) {
    var rows = edgeInlineRows(mt.params);
    var sig = mt.params.map(function (p) { return p.type + " " + p.name; }).join(", ");
    L.push("    [Theory]");
    rows.forEach(function (r) { L.push("    [InlineData(" + r + ")]"); });
    L.push("    public void " + mt.name + "_BoundaryValues_AreHandled(" + sig + ")");
    L.push("    {");
    L.push("        // Arrange");
    L.push("        var sut = " + sut.ctorCall + ";");
    L.push("");
    L.push("        // Act");
    var callArgs = mt.params.map(function (p) { return p.name; }).join(", ");
    if (cat === "void") {
      L.push("        sut." + mt.name + "(" + callArgs + ");");
      L.push("");
      L.push("        // Assert");
      L.push("        // TODO: assert the boundary effect for each row");
    } else {
      L.push("        var result = sut." + mt.name + "(" + callArgs + ");");
      L.push("");
      L.push("        // Assert");
      if (cat === "bool") L.push("        // TODO: assert the expected boolean at each boundary\n        _ = result;");
      else if (cat === "numeric") L.push("        // TODO: assert the expected number at each boundary\n        _ = result;");
      else if (cat === "string") L.push("        // TODO: assert the expected string at each boundary\n        _ = result;");
      else L.push("        Assert.NotNull(result);");
    }
    L.push("    }");
  }

  /* Per-param edge value rows for a [Theory]. Returns the 1-D edge list for a
     type, or null when the type can't be expressed as InlineData (collections,
     interfaces, unknown reference types). Type-aware: no string rows for ints. */
  function edgeRows(type) {
    var t = String(type).replace(/\s/g, "");
    if (/^(int|long|short|byte|uint)\??$/.test(t)) return ["0", "1", "-1"];
    if (/^(double|float|decimal)\??$/.test(t)) return ["0.0", "1.0", "-1.0"];
    if (t === "bool" || t === "bool?") return ["true", "false"];
    if (t === "string" || t === "string?") return ['""', '" "', '"a"'];
    if (t === "char") return ["' '", "'a'", "'z'"];
    return null;
  }

  /* Build 1 row per edge index, drawing each param's value from edgeRows.
     Rows are padded to the longest param so every column type-checks. */
  function edgeInlineRows(params) {
    var perParam = params.map(function (p) { return edgeRows(p.type) || ["default"]; });
    var maxLen = perParam.reduce(function (a, v) { return Math.max(a, v.length); }, 0);
    var rows = [];
    for (var r = 0; r < maxLen; r++) {
      rows.push(perParam.map(function (vals) { return vals[Math.min(r, vals.length - 1)]; }).join(", "));
    }
    return rows;
  }

  /* a valid, representative argument for the positive path */
  function validArg(type) {
    var t = String(type || "").trim();
    var bare = t.replace(/\s/g, "");
    if (/^(int|long|short|byte|uint)\??$/.test(bare)) return "1";
    if (/^(double|float|decimal)\??$/.test(bare)) return bare.indexOf("decimal") === 0 ? "1m" : (bare.indexOf("float") === 0 ? "1f" : "1.0");
    if (bare === "bool" || bare === "bool?") return "true";
    if (bare === "char") return "'a'";
    if (bare === "string" || bare === "string?") return '"valid"';
    if (bare === "object") return "new object()";
    if (/^(List|IList|IEnumerable|ICollection|IReadOnlyList)</.test(bare)) {
      var inner = (t.match(/<\s*([^>]*)>/) || [])[1] || "object";
      return "new List<" + inner.trim() + "> { " + sampleElement(inner.trim()) + " }";
    }
    if (isInterfaceType(t)) return "new Fake" + bare.replace(/^I/, "").replace(/[?<>,].*$/, "") + "()";
    return "default!";
  }

  function sampleElement(inner) {
    var c = returnCategory(inner);
    switch (c) {
      case "numeric": return "1";
      case "bool": return "true";
      case "string": return '"item"';
      default: return "default!";
    }
  }

  function isComparisonName(name) {
    return /(?:^|[A-Z])(Min|Max|Average|Avg|Between|Compare|GreaterThan|LessThan|Equals?)\b/.test(String(name)) ||
      /^(Min|Max|Average|Avg|Between|Compare)/.test(String(name));
  }

  /* A param worth a null-input negative test: a non-nullable reference type.
     Value-type primitives (int, bool, ...) cannot be null; an explicitly
     nullable param (`T?`) treats null as a valid value, not a violation. */
  function isNullTestable(type) {
    var t = String(type || "").trim();
    var bare = t.replace(/\s/g, "");
    if (/\?$/.test(bare)) return false;                 /* nullable: null is allowed */
    if (bare === "string") return true;                 /* non-nullable string is a ref type */
    if (isInterfaceType(t)) return true;
    if (/^(List|IList|IEnumerable|ICollection|IReadOnlyList|ObservableCollection)</.test(bare)) return true;
    if (/^(int|long|short|byte|uint|double|float|decimal|bool|char|object)$/.test(bare)) return bare === "object";
    /* unknown bare type that is not a known value type: treat as a reference type */
    return /^[A-Za-z_]/.test(bare) && !PRIMITIVE.hasOwnProperty(bare);
  }

  /* Emit the trio for a [RelayCommand] command into L. */
  function emitCommandTrio(L, cls, fn, sut, allCommands) {
    var cmd = fn.method;
    var exec = cmd.isAsync
      ? "await vm." + cmd.command + ".ExecuteAsync(null);"
      : "vm." + cmd.command + ".Execute(null);";
    var coll = cls.properties.filter(function (p) { return /ObservableCollection|List/.test(p.type); })[0];
    var op = cls.observableProps[0];

    /* ---- Positive ---- */
    /* A looping start is fired-and-forgotten (never awaited); it must then be
       stopped before the test returns (emitLoopFireAndStop) so its infinite loop
       cannot leak and hang the test host. Firing-then-stopping needs an await, so
       the method becomes `async Task` whenever a stop-style command exists. A
       non-looping async command awaits and is `async Task` too. */
    var posLooping = isLoopingStart(cmd, allCommands);
    var posBreaker = posLooping ? loopBreaker(cmd, allCommands) : null;
    var posAsync = (cmd.isAsync && !posLooping) || (posLooping && !!posBreaker);
    L.push("    // --- Positive --- happy path: execute the command from a valid state");
    L.push("    [Fact]");
    L.push("    public " + (posAsync ? "async Task " : "void ") + cmd.method + "Command_WhenExecuted_UpdatesState()");
    L.push("    {");
    L.push("        // Arrange");
    L.push("        var vm = " + sut.ctorCall + ";");
    if (cmd.canExecute) {
      L.push("        // TODO: set state so " + cmd.canExecute + "() returns true before executing");
    }
    L.push("");
    L.push("        // Act");
    /* a looping start-style command must not be awaited, but it must be stopped */
    if (posLooping) {
      emitLoopFireAndStop(L, cmd, posBreaker, "        ");
    } else {
      L.push("        " + exec);
    }
    L.push("");
    L.push("        // Assert");
    if (coll) {
      L.push("        Assert.NotNull(vm." + coll.name + ");");
      L.push("        // TODO: assert the expected count after " + cmd.method + ", e.g. Assert.Single(vm." + coll.name + ");");
    } else if (op) {
      L.push("        // TODO: assert the expected value of vm." + op.property + " after " + cmd.method);
      L.push("        _ = vm." + op.property + ";");
    } else {
      L.push("        // TODO: assert the observable effect of executing " + cmd.command);
    }
    L.push("    }");

    /* ---- Negative ---- wrong-state / guarded ---- */
    L.push("");
    L.push("    // --- Negative --- wrong-state call: the command run out of its valid order");
    var pair = wrongStatePair(cmd, allCommands);
    if (pair) {
      /* e.g. Stop before Start, Reset before Start, Resume before Start: run the
         command-under-test ('cmd') without ever calling its prerequisite ('pair').
         A looping start-style command (e.g. an async Resume) is fired-and-forgotten,
         never awaited — awaiting its unbounded loop would deadlock the test — and
         must then be stopped so its loop cannot leak past the test (emitLoopFireAndStop). */
      var pairLooping = isLoopingStart(cmd, allCommands);
      var pairBreaker = pairLooping ? loopBreaker(cmd, allCommands) : null;
      var cmdExec = pairLooping ? null
        : (cmd.isAsync
          ? "await vm." + cmd.command + ".ExecuteAsync(null);"
          : "vm." + cmd.command + ".Execute(null);");
      var pairAsync = (cmd.isAsync && !pairLooping) || (pairLooping && !!pairBreaker);
      var counterProp = (op && op.property) ||
        (cls.properties.filter(function (p) { return returnCategory(p.type) === "numeric"; })[0] || {}).name || "Count";
      L.push("    [Fact]");
      L.push("    public " + (pairAsync ? "async Task " : "void ") + cmd.method + "Command_Before" + pascal(pair.method) + "_IsNoOp()");
      L.push("    {");
      L.push("        // Arrange: brand-new VM — " + pair.method + " has never run");
      L.push("        var vm = " + sut.ctorCall + ";");
      L.push("");
      L.push("        // Act: calling " + cmd.method + " before " + pair.method + " is a wrong-state call");
      if (pairLooping) {
        emitLoopFireAndStop(L, cmd, pairBreaker, "        ");
      } else {
        L.push("        " + cmdExec);
      }
      L.push("");
      L.push("        // Assert: it must not throw and must leave state unchanged");
      L.push("        Assert.Equal(0, vm." + counterProp + "); // " + cmd.method + " before " + pair.method + " => still at the initial value");
      L.push("    }");
    } else if (cmd.canExecute) {
      L.push("    [Fact]");
      L.push("    public void " + cmd.method + "Command_WhenGuardFails_CannotExecute()");
      L.push("    {");
      L.push("        // Arrange: initial state where " + cmd.canExecute + "() is false");
      L.push("        var vm = " + sut.ctorCall + ";");
      L.push("");
      L.push("        // Assert: the guard blocks execution");
      L.push("        Assert.False(vm." + cmd.command + ".CanExecute(null));");
      L.push("        // TODO: satisfy " + cmd.canExecute + "() then assert Assert.True(vm." + cmd.command + ".CanExecute(null));");
      L.push("    }");
    } else {
      /* A looping start is fired-and-forgotten (never awaited); each fire must be
         stopped afterwards (emitLoopFireAndStop) so neither orphaned loop leaks
         past the test. Firing-then-stopping awaits, so the method becomes
         `async Task` when a stop-style command exists; a non-looping async
         command awaits and is `async Task` too. */
      var looping = isLoopingStart(cmd, allCommands);
      var twiceBreaker = looping ? loopBreaker(cmd, allCommands) : null;
      var twiceAsync = (cmd.isAsync && !looping) || (looping && !!twiceBreaker);
      L.push("    [Fact]");
      L.push("    public " + (twiceAsync ? "async Task " : "void ") + cmd.method + "Command_CalledTwice_RemainsConsistent()");
      L.push("    {");
      L.push("        // Arrange");
      L.push("        var vm = " + sut.ctorCall + ";");
      L.push("");
      L.push("        // Act: a repeated / redundant invocation is the wrong-state case here");
      if (looping) {
        emitLoopFireAndStop(L, cmd, twiceBreaker, "        ");
        if (twiceBreaker) {
          L.push("        // second invocation while/after the first ran, again stopped so it cannot leak:");
          emitLoopFireAndStop(L, cmd, twiceBreaker, "        ");
        }
      } else {
        L.push("        " + exec);
        L.push("        " + exec);
      }
      L.push("");
      L.push("        // Assert");
      L.push("        // TODO: assert the command is idempotent / does not double-apply its effect");
      L.push("    }");
    }

    /* ---- Edge ---- */
    L.push("");
    L.push("    // --- Edge --- boundary: first execution / repeated to a limit / reset boundary");
    /* This boundary check is purely synchronous (only CanExecute), so it is
       always a void [Fact] — never async — even for async commands. */
    L.push("    [Fact]");
    L.push("    public void " + cmd.method + "Command_CanExecuteAtConstruction_IsKnown()");
    L.push("    {");
    L.push("        // Arrange: freshly constructed VM is the boundary state");
    L.push("        var vm = " + sut.ctorCall + ";");
    L.push("");
    L.push("        // Assert: the command's availability at the construction boundary is well-defined");
    if (cmd.canExecute) {
      L.push("        Assert.False(vm." + cmd.command + ".CanExecute(null)); // guarded => unavailable at construction");
    } else {
      L.push("        Assert.True(vm." + cmd.command + ".CanExecute(null)); // unguarded => available at construction");
    }
    L.push("    }");
  }

  /* a Start/Resume-style command whose body runs an unbounded loop */
  function isLoopingStart(cmd, all) {
    return /^(start|resume|run|begin)/i.test(cmd.method) && cmd.isAsync;
  }

  /* The command that breaks a looping start's loop (Stop/Pause/Cancel/Reset).
     Returns the first matching command from `all`, or null. A looping start that
     is fired-and-forgotten MUST be stopped before the test method returns,
     otherwise the orphaned infinite loop keeps the test host alive forever (the
     run never completes — especially under the single-threaded Avalonia headless
     dispatcher that owns the whole test assembly). */
  function loopBreaker(cmd, all) {
    return (all || []).filter(function (c) {
      return c !== cmd && /^(stop|pause|cancel|reset)/i.test(c.method);
    })[0] || null;
  }

  /* Emit the lines that fire a looping start command, let it tick once, then
     stop it so no infinite loop leaks past the test. The enclosing method must
     be `async Task` (loopStopNeedsAsync() reports that). When no stop-style
     command exists we cannot safely fire the loop, so we emit a guarded comment
     instead of leaking it. */
  function emitLoopFireAndStop(L, cmd, breaker, indent) {
    indent = indent || "        ";
    if (!breaker) {
      L.push(indent + "// NOTE: " + cmd.method + " runs an unbounded loop and the VM exposes no");
      L.push(indent + "// stop-style command to end it, so it is not fired here (an orphaned");
      L.push(indent + "// loop would hang the test host). Drive it via a headless test instead.");
      return;
    }
    L.push(indent + startLine(cmd));
    L.push(indent + "await Task.Delay(150); // let the loop tick at least once");
    L.push(indent + (breaker.isAsync
      ? "await vm." + breaker.command + ".ExecuteAsync(null); // stop the loop so it cannot leak"
      : "vm." + breaker.command + ".Execute(null); // stop the loop so it cannot leak"));
  }

  /* For a Stop/Reset/Resume command find the matching Start; for a Start there
     is no "before" pairing (you cannot wrong-state the first action). Returns
     the command that must logically precede `cmd`, or null. */
  function wrongStatePair(cmd, all) {
    var m = String(cmd.method);
    if (/^(stop|reset|resume|pause|cancel)/i.test(m)) {
      return (all || []).filter(function (c) { return /^start/i.test(c.method); })[0] || null;
    }
    return null;
  }

  /* Build the per-class per-function test file with labeled P/N/E trios.
     `selection` filters which functions are emitted (see isSelected). */
  function genPerFunctionClass(cls, selection) {
    var sut = buildSut(cls);
    var fns = listFunctions(cls).filter(function (fn) { return isSelected(selection, fn.key); });
    var L = [];
    L.push("public class " + cls.name + "Tests");
    L.push("{");

    if (!fns.length) {
      L.push("    [Fact]");
      L.push("    public void Construction_WithValidArguments_Succeeds()");
      L.push("    {");
      L.push("        // (no functions selected — testing construction only)");
      L.push("        var sut = " + sut.ctorCall + ";");
      L.push("        Assert.NotNull(sut);");
      L.push("    }");
    }

    var anyAsync = false;
    fns.forEach(function (fn, fi) {
      if (fi > 0) L.push("");
      L.push("    // ===================== " + fn.name + " =====================");
      if (fn.isAsync) anyAsync = true;
      if (fn.isCommand) emitCommandTrio(L, cls, fn, sut, cls.commands);
      else emitPlainTrio(L, cls, fn, sut);
    });

    /* fakes for interface ctor params */
    if (sut.fakes.length) {
      L.push("");
      sut.fakes.forEach(function (fk) {
        L.push(indentBlock(fk.code, ""));
        L.push("");
      });
    }
    while (L.length && L[L.length - 1] === "") L.pop();
    L.push("}");

    var usings = ["using System;", "using System.Collections.Generic;"];
    if (anyAsync || cls.commands.some(function (c) { return c.isAsync; })) usings.push("using System.Threading.Tasks;");
    if (cls.isToolkitViewModel) usings.push("using ExamApp.ViewModels;");
    else usings.push("using ExamApp;");
    usings.push("using Xunit;");
    usings = dedup(usings);

    return {
      fileName: cls.name + "Tests.cs",
      code: fileHeader(usings) + L.join("\n") + "\n",
      perFunction: true,
      className: cls.name,
    };
  }

  /* Build the per-function trio output for the whole model. Returns one file
     per source class that has at least one selected function (or no functions
     at all, in which case a construction-only file is emitted). */
  function genPerFunction(model, selection) {
    var out = [];
    ((model && model.classes) || []).forEach(function (cls) {
      if (cls.kind === "interface") return;
      var fns = listFunctions(cls);
      var anySelected = !fns.length || fns.some(function (fn) { return isSelected(selection, fn.key); });
      if (!anySelected) return;
      out.push(genPerFunctionClass(cls, selection));
    });
    return out;
  }

  /* Extract just one function's trio as a standalone snippet (for the
     per-function copy button). Returns "" when the function isn't found. */
  function genFunctionTrio(model, className, methodName) {
    var cls = ((model && model.classes) || []).filter(function (c) { return c.name === className; })[0];
    if (!cls) return "";
    var fn = listFunctions(cls).filter(function (f) { return f.name === methodName; })[0];
    if (!fn) return "";
    var sut = buildSut(cls);
    var L = [];
    L.push("// ===================== " + fn.name + " (in " + cls.name + ") =====================");
    if (fn.isCommand) emitCommandTrio(L, cls, fn, sut, cls.commands);
    else emitPlainTrio(L, cls, fn, sut);
    return L.join("\n") + "\n";
  }

  /* ---- Generator 5: csproj ----
     G9: the ProjectReference path is an option so the generated test project
     can reference the REAL project under test instead of the hardcoded Starter
     Kit path. Default stays ..\ExamApp\ExamApp.csproj (byte-for-byte unchanged
     when no option is passed). */
  function genCsproj(opts) {
    opts = opts || {};
    var projRef = opts.projectReference || "..\\ExamApp\\ExamApp.csproj";
    var lines = [
      '<Project Sdk="Microsoft.NET.Sdk">',
      "  <PropertyGroup>",
      "    <TargetFramework>" + PKG.targetFramework + "</TargetFramework>",
      "    <Nullable>enable</Nullable>",
      "    <ImplicitUsings>enable</ImplicitUsings>",
      "    <IsPackable>false</IsPackable>",
      "  </PropertyGroup>",
      "",
      "  <ItemGroup>",
      '    <PackageReference Include="coverlet.collector" Version="' + PKG["coverlet.collector"] + '" />',
      '    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="' + PKG["Microsoft.NET.Test.Sdk"] + '" />',
      '    <PackageReference Include="xunit" Version="' + PKG["xunit"] + '" />',
      '    <PackageReference Include="xunit.runner.visualstudio" Version="' + PKG["xunit.runner.visualstudio"] + '" />',
      '    <PackageReference Include="Avalonia.Headless.XUnit" Version="' + PKG["Avalonia.Headless.XUnit"] + '" />',
      "  </ItemGroup>",
      "",
      "  <ItemGroup>",
      '    <ProjectReference Include="' + projRef + '" />',
      "  </ItemGroup>",
      "",
      "  <ItemGroup>",
      '    <Using Include="Xunit" />',
      "  </ItemGroup>",
      "</Project>",
      "",
    ];
    return { fileName: "ExamApp.Tests.csproj", code: lines.join("\n") };
  }

  /* ---- Generator 6: runbook ---- */
  function runbook() {
    return [
      "OFFLINE TEST-PROJECT RUNBOOK (exam day, no internet)",
      "",
      "1. From the solution folder, create the test project next to ExamApp:",
      "     dotnet new xunit -o ExamApp.Tests",
      "",
      "2. Add a reference from the test project to the app under test:",
      "     dotnet add ExamApp.Tests reference ExamApp",
      "",
      "3. Open ExamApp.Tests/ExamApp.Tests.csproj and replace its contents with",
      "   the generated csproj above (it pins the EXACT versions in the local",
      "   NuGet cache and adds the Avalonia.Headless.XUnit package + the",
      "   ProjectReference). Versions must match what is already restored,",
      "   otherwise an offline restore will fail.",
      "",
      "4. Delete the placeholder UnitTest1.cs that 'dotnet new xunit' created,",
      "   then paste the generated test files (and TestAppBuilder.cs +",
      "   HeadlessUiTests.cs if you use the headless scaffold).",
      "",
      "5. Build and run the tests:",
      "     dotnet test",
      "",
      "TROUBLESHOOTING",
      "  - 'Unable to load the service index' / restore tries to reach nuget.org:",
      "      you are online-restoring by mistake. Use the offline feed from the",
      "      exam-day kit: see README-EXAM-DAY.md (scripts/offline-feed) and run",
      "      restore with --source pointed at the local feed, e.g.",
      "        dotnet restore --source <local-feed-path>",
      "  - 'package X version Y not found': the version pin does not match the",
      "      NuGet cache. Open the generated csproj and confirm every Version=",
      "      matches a folder under your global packages / offline feed.",
      "  - Avalonia headless test hangs or NRE on Show(): make sure",
      "      [assembly: AvaloniaTestApplication(typeof(TestAppBuilder))] is present",
      "      (TestAppBuilder.cs) and the test method uses [AvaloniaFact], not [Fact].",
      "  - Async/counter test is flaky: never Assert.Equal an exact tick count;",
      "      use Assert.InRange or a >/>= comparison with a comfortable delay.",
    ];
  }

  /* ===================== block indentation helper ===================== */
  function indentBlock(block, prefix) {
    return block.split("\n").map(function (ln) {
      return ln.length ? "    " + prefix + ln : ln;
    }).join("\n");
  }

  function dedup(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  /* ===================== project export (spec 13) ===================== */

  /* The headless scaffold HeadlessUiTests.cs that genHeadless() emits drives a
     real Window from the full app (ExamApp.Views.MainWindow, the App class). A
     standalone test project exported by PROJZIP.xunitProject has NO app project
     to reference, so that file would not compile there. We therefore filter the
     app-coupled scaffold files out of the export and let PROJZIP supply its own
     standalone TestAppBuilder.cs (which configures the base Avalonia Application,
     not the app's App). The pure C# test files (per-function / plain / VM /
     async) only depend on the pasted source, which IS copied into Source/, so
     they compile standalone. */
  var APP_COUPLED_EXPORT_FILES = { "HeadlessUiTests.cs": true, "TestAppBuilder.cs": true };

  /* True when a class can be constructed with `new Name()` in a headless smoke
     test: a toolkit ViewModel (or any class) with no constructor parameters. */
  function hasParameterlessCtor(cls) {
    return !!cls && (!cls.ctorParams || cls.ctorParams.length === 0);
  }

  /* Pick the ViewModel a standalone headless smoke test can safely new up:
     the first toolkit VM with a parameterless ctor. Returns null if none. */
  function headlessSmokeTarget(model) {
    var classes = (model && model.classes) || [];
    return classes.filter(function (c) {
      return c.kind !== "interface" && c.isToolkitViewModel && hasParameterlessCtor(c);
    })[0] || null;
  }

  /* A standalone-safe headless test: it constructs the VM (which lives in
     Source/, same assembly) under the Avalonia headless platform via
     [AvaloniaFact]. No Window/View types are referenced, so it compiles and
     runs green in the exported standalone test project. */
  function genHeadlessSmoke(cls) {
    var ns = cls.isToolkitViewModel ? "ExamApp.ViewModels" : null;
    var L = [];
    L.push("using Avalonia.Headless.XUnit;");
    if (ns) L.push("using " + ns + ";");
    L.push("using Xunit;");
    L.push("");
    L.push("namespace " + NS + ";");
    L.push("");
    L.push("// Headless smoke test: proves the ViewModel constructs and runs under the");
    L.push("// Avalonia headless platform (the [AvaloniaFact] runs on the UI thread).");
    L.push("// It references no Window/View, so it compiles in this standalone project.");
    L.push("public class HeadlessSmokeTests");
    L.push("{");
    L.push("    [AvaloniaFact]");
    L.push("    public void " + cls.name + "_ConstructsUnderHeadlessPlatform()");
    L.push("    {");
    L.push("        var vm = new " + cls.name + "();");
    L.push("        Assert.NotNull(vm);");
    L.push("        // TODO: drive a command and assert the resulting state, e.g.:");
    L.push("        // vm.SomeCommand.Execute(null);");
    L.push("    }");
    L.push("}");
    L.push("");
    return { fileName: "HeadlessSmokeTests.cs", code: L.join("\n") };
  }

  /* Build the arguments object for PROJZIP.xunitProject(name, args) from the
     current model + pasted sources + generated files + options.

     - sources: the raw pasted [{name,text}] files (the code under test). Empty
       files are dropped. They are copied into Source/ verbatim.
     - generatedFiles: the array generate() returned. We keep the compilable
       .cs test files, drop the app-coupled headless scaffold and the csproj /
       runbook (PROJZIP writes its own csproj). When headless is requested and
       a parameterless-ctor VM exists, a standalone headless smoke test is added.

     Returns { ok, args, reason }:
       ok    — true when there is at least one source class to test
       args  — { sourceFiles:[{name,text}], testFiles:[{name,text}], headless }
       reason— short explanation when ok is false (for a graceful UI message). */
  function buildExport(model, generatedFiles, options, sources) {
    options = options || {};
    /* Pass each source with `path` (basename kept verbatim) so PROJZIP does not
       append a second ".cs" — passing it as `name` would yield Foo.cs.cs. A name
       without an extension gets ".cs" added so the file is a valid C# unit. */
    var srcList = (sources || []).filter(function (f) {
      return f && typeof f.text === "string" && f.text.trim();
    }).map(function (f) {
      var nm = String(f.name || "Source.cs");
      if (!/\.[A-Za-z0-9]+$/.test(nm)) nm += ".cs";
      return { path: nm, text: f.text };
    });

    var classes = ((model && model.classes) || []).filter(function (c) { return c.kind !== "interface"; });
    if (!srcList.length || !classes.length) {
      return { ok: false, args: null, reason: "paste a C# class or ViewModel first — there is nothing to put under test" };
    }

    var headless = !!options.headless;
    var gen = generatedFiles || [];
    var testFiles = [];
    gen.forEach(function (f) {
      if (!f || !/\.cs$/.test(f.fileName)) return;        /* drop csproj + runbook */
      if (APP_COUPLED_EXPORT_FILES[f.fileName]) return;    /* drop app-coupled scaffold */
      testFiles.push({ name: f.fileName.replace(/\.cs$/, ""), text: f.code });
    });

    /* when headless is on, add a standalone-safe headless smoke test so the
       Avalonia.Headless.XUnit packages PROJZIP pulls in are actually exercised */
    if (headless) {
      var smokeCls = headlessSmokeTarget(model);
      if (smokeCls) testFiles.push({
        name: "HeadlessSmokeTests",
        text: genHeadlessSmoke(smokeCls).code,
      });
    }

    /* a degenerate paste could leave us with sources but zero test files (e.g.
       every mode toggled off): still emit a construction smoke test so the
       project is non-empty and green. */
    if (!testFiles.length) {
      var c0 = classes[0];
      if (hasParameterlessCtor(c0) || c0.ctorParams.every(function (p) { return !p.isInterface; })) {
        var sut = buildSut(c0);
        var L = [];
        L.push("using Xunit;");
        L.push("");
        L.push("namespace " + NS + ";");
        L.push("");
        L.push("public class ConstructionSmokeTests");
        L.push("{");
        L.push("    [Fact]");
        L.push("    public void " + c0.name + "_Constructs()");
        L.push("    {");
        L.push("        var sut = " + sut.ctorCall + ";");
        L.push("        Assert.NotNull(sut);");
        L.push("    }");
        L.push("}");
        L.push("");
        testFiles.push({ name: "ConstructionSmokeTests", text: L.join("\n") });
      }
    }

    return {
      ok: true,
      args: { sourceFiles: srcList, testFiles: testFiles, headless: headless },
      reason: "",
    };
  }

  /* ===================== top-level generate ===================== */

  /* options: { perFunction, plain, viewModel, headless, async, csproj } booleans,
     plus an optional `selection` map (class.method -> bool) that the function
     picker fills in. Returns an array of {fileName, code} files. */
  function generate(model, options) {
    options = options || { perFunction: true, plain: true, viewModel: true, headless: true, async: true, csproj: true };
    var out = [];
    var classes = (model && model.classes) || [];
    var testable = classes.filter(function (c) { return c.kind !== "interface"; });
    var selection = options.selection || null;

    /* Per-function P/N/E trios: the default mode. One Tests.cs per source
       class containing a labeled Positive/Negative/Edge trio per selected
       function. */
    if (options.perFunction) {
      genPerFunction(model, selection).forEach(function (f) { out.push(f); });
    }

    testable.forEach(function (cls) {
      var isVm = cls.isToolkitViewModel;
      var hasAsync = cls.commands.some(function (c) { return c.isAsync; }) ||
        cls.methods.some(function (m) { return m.isAsync; });
      var counterLike = cls.commands.some(function (c) { return /^(start|stop|reset|resume)/i.test(c.method); });

      if (isVm) {
        if (options.viewModel) {
          var vm = genViewModel(cls);
          /* when perFunction is also on, genPerFunction already emits a
             <Class>Tests.cs with a public class <Class>Tests; rename this VM
             file + class to a distinct suffix so the zip builds (avoids CS0101). */
          if (options.perFunction) {
            vm.fileName = cls.name + "VmTests.cs";
            vm.code = vm.code.replace("public class " + cls.name + "Tests",
              "public class " + cls.name + "VmTests");
          }
          out.push(vm);
        }
        if (options.plain && cls.methods.filter(function (m) { return !m.isCommandBacking; }).length) {
          /* still offer plain tests for non-command public methods on the VM */
          var plain = genPlain(cls);
          plain.fileName = cls.name + "PlainTests.cs";
          plain.code = plain.code.replace("public class " + cls.name + "Tests",
            "public class " + cls.name + "PlainTests");
          out.push(plain);
        }
      } else {
        if (options.plain) out.push(genPlain(cls));
      }

      if (options.async && (hasAsync || counterLike)) out.push(genAsync(cls));
    });

    if (options.headless) {
      /* derive the VM name from the model; the VIEW class does NOT come from
         stripping "ViewModel" (G9) — that produced types like `Counter` that
         don't exist. It defaults to MainWindow, overridable via options. */
      var vmCls = testable.filter(function (c) { return c.isToolkitViewModel; })[0];
      var vmName = vmCls ? vmCls.name : "MainWindowViewModel";
      var winName = options.viewClass || "MainWindow";
      var driveCmd = vmCls && vmCls.commands[0] ? vmCls.commands[0].command : null;
      genHeadless({
        viewModel: vmName,
        viewClass: winName,
        command: driveCmd,
        targetNamespace: options.targetNamespace,
        buttonName: options.buttonName,
        textName: options.textName,
      }).forEach(function (f) { out.push(f); });
    }

    if (options.csproj) {
      out.push(genCsproj({ projectReference: options.projectReference }));
      out.push({ fileName: "RUNBOOK.txt", code: runbook().join("\n") + "\n" });
    }

    return out;
  }

  /* ===================== export ===================== */

  var CORE = {
    PKG: PKG,
    parse: parse,
    generate: generate,
    genPlain: genPlain,
    genViewModel: genViewModel,
    genHeadless: genHeadless,
    genAsync: genAsync,
    genCsproj: genCsproj,
    runbook: runbook,
    stripForScan: stripForScan,
    /* function picker + per-function P/N/E trios */
    functionKey: functionKey,
    listFunctions: listFunctions,
    listAllFunctions: listAllFunctions,
    isSelected: isSelected,
    genPerFunction: genPerFunction,
    genPerFunctionClass: genPerFunctionClass,
    genFunctionTrio: genFunctionTrio,
    /* project export (spec 13) */
    buildExport: buildExport,
    genHeadlessSmoke: genHeadlessSmoke,
    headlessSmokeTarget: headlessSmokeTarget,
    /* exposed for tests */
    commandName: commandName,
    parseParams: parseParams,
    returnCategory: returnCategory,
  };

  global.TESTLAB_CORE = CORE;
  if (typeof module !== "undefined" && module.exports) module.exports = CORE;
})(typeof window !== "undefined" ? window : globalThis);
