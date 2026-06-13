/* ============ ADAPT LAB · core (pure logic) ============
   Closes the "adaptation gap": the solver tools (Visual Designer, Async
   Composer, Test Lab, Query Lab, MVVM Converter) generate code under the
   GENERIC namespace "ExamApp" (ExamApp / ExamApp.ViewModels / ExamApp.Views /
   ExamApp.Models). The exam hands you a STARTER PROJECT with its own name
   (CircleCodeBehind, RectangleUI, FamilyMealPlannerUI...). A non-coder who
   pastes generic code into the specific project gets a wall of red errors and
   cannot read them. This tool rewrites the generated code so its namespaces
   and class names match the real project, with zero hand-editing.

     readProject(text)        -> { rootNs, vmNs, viewNs, modelNs, className,
                                    controls:[], instances:[{type,name}], ... }
     deriveTarget(name)       -> { rootNs, vmNs, viewNs, modelNs }
     detectSourceNs(text)     -> best-guess source root namespace (e.g. "ExamApp")
     adapt(text, lang, target, opts) -> { text, notes, todos, fromNs }

   No DOM, plain string work, Node-loadable for the test suite.
   UMD: window.ADAPT_CORE in the browser, module.exports under Node.
*/
(function (global) {
"use strict";

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

/* primitives / framework types we never treat as a "provided instance" */
var NOT_INSTANCE = /^(string|int|long|short|byte|double|float|decimal|bool|char|object|var|void|dynamic|String|Int32|Int64|Double|Single|Boolean|Char|Object|Decimal|List|IList|IEnumerable|ICollection|Dictionary|HashSet|Queue|Stack|ObservableCollection|IBrush|SolidColorBrush|Color|Task|Thread|Random|DateTime|TimeSpan|Guid|StringBuilder|CancellationToken|CancellationTokenSource|DispatcherTimer|ICommand|IRelayCommand|EventHandler|Action|Func|Nullable)$/;

/* ---------------- derive a target from just a project name ---------------- */
function deriveTarget(name) {
  name = String(name == null ? "" : name).trim().replace(/[^\w.]/g, "");
  if (!name) return null;
  // if they typed a sub-namespace, strip it back to the root
  var root = name.replace(/\.(ViewModels|Views|Models)$/, "");
  return {
    rootNs: root,
    vmNs: root + ".ViewModels",
    viewNs: root + ".Views",
    modelNs: root + ".Models",
    className: null,
    source: "name",
  };
}

/* ---------------- read identity out of one pasted starter file ---------------- */
function readProject(text) {
  text = String(text == null ? "" : text);
  var info = {
    rootNs: null, vmNs: null, viewNs: null, modelNs: null,
    className: null, controls: [], instances: [], dataType: null, kind: null,
  };
  if (!text.trim()) return info;

  var m, re;

  // --- AXAML markers ---
  m = /x:Class\s*=\s*"([\w.]+)"/.exec(text);
  if (m) {
    info.kind = "axaml";
    var full = m[1];
    info.className = full.split(".").pop();
    var nsOfClass = full.slice(0, Math.max(0, full.length - info.className.length - 1));
    if (nsOfClass) {
      info.viewNs = nsOfClass;
      info.rootNs = nsOfClass.replace(/\.Views$/, "");
    }
  }
  m = /xmlns:vm\s*=\s*"(?:using|clr-namespace):([\w.]+)/.exec(text);
  if (m) { info.vmNs = m[1]; info.rootNs = info.rootNs || m[1].replace(/\.ViewModels$/, ""); }
  m = /x:DataType\s*=\s*"(?:vm:)?([\w.]+)"/.exec(text);
  if (m) info.dataType = m[1];
  re = /x:Name\s*=\s*"([^"]+)"/g;
  while ((m = re.exec(text))) info.controls.push(m[1]);

  // --- C# markers ---
  m = /namespace\s+([\w.]+)\s*[;{]/.exec(text);
  if (m) {
    info.kind = info.kind || "cs";
    var ns = m[1];
    if (/\.ViewModels$/.test(ns)) { info.vmNs = info.vmNs || ns; info.rootNs = info.rootNs || ns.replace(/\.ViewModels$/, ""); }
    else if (/\.Views$/.test(ns)) { info.viewNs = info.viewNs || ns; info.rootNs = info.rootNs || ns.replace(/\.Views$/, ""); }
    else if (/\.Models$/.test(ns)) { info.modelNs = info.modelNs || ns; info.rootNs = info.rootNs || ns.replace(/\.Models$/, ""); }
    else { info.rootNs = info.rootNs || ns; }
  }
  if (!info.className) {
    m = /\b(?:partial\s+)?class\s+(\w+)/.exec(text);
    if (m) info.className = m[1];
  }

  // provided instances: fields / properties whose type is a domain type
  // e.g. `private readonly MealPlanner _planner;`  `public WeekDayItem SelectedRecipe;`
  re = /(?:private|public|protected|internal)\s+(?:readonly\s+|static\s+)*([A-Z]\w+)(?:<[^>]+>)?\s+(\w+)\s*(?:[;={]|=>)/g;
  while ((m = re.exec(text))) {
    if (NOT_INSTANCE.test(m[1])) continue;
    info.instances.push({ type: m[1], name: m[2] });
  }
  info.instances = info.instances.filter(function (it, i, a) {
    return a.findIndex(function (x) { return x.name === it.name; }) === i;
  });
  info.controls = uniq(info.controls);

  // fill the sub-namespaces from the root if we only learned the root
  if (info.rootNs) {
    info.vmNs = info.vmNs || (info.rootNs + ".ViewModels");
    info.viewNs = info.viewNs || (info.rootNs + ".Views");
    info.modelNs = info.modelNs || (info.rootNs + ".Models");
  }
  return info;
}

/* ---------------- guess the namespace the generated code currently uses ----------------
   so the student does not even need to know it is "ExamApp". */
function detectSourceNs(text) {
  text = String(text == null ? "" : text);
  var m = /namespace\s+([\w.]+?)(?:\.(?:ViewModels|Views|Models))?\s*[;{]/.exec(text);
  if (m) return m[1];
  m = /xmlns:vm\s*=\s*"(?:using|clr-namespace):([\w.]+?)(?:\.ViewModels|\.Views)?"/.exec(text);
  if (m) return m[1];
  m = /x:Class\s*=\s*"([\w.]+?)(?:\.Views)?\.\w+"/.exec(text);
  if (m) return m[1];
  return null;
}

function guessLang(text) {
  text = String(text == null ? "" : text);
  var t = text.trim();
  if (/^<|<Window\b|<UserControl\b|x:Class=|xmlns=/.test(t)) return "xml";
  return "csharp";
}

/* ---------------- the rewrite ---------------- */
function adapt(text, lang, target, opts) {
  opts = opts || {};
  text = String(text == null ? "" : text);
  target = target || {};
  lang = lang || guessLang(text);
  var notes = [], todos = [];
  var fromRoot = opts.fromNs || detectSourceNs(text) || "ExamApp";
  var out = text;

  function replaceCounting(re, to) {
    var n = 0;
    out = out.replace(re, function () { n++; return to; });
    return n;
  }

  var rootNs = target.rootNs;
  if (rootNs) {
    var vmNs = target.vmNs || (rootNs + ".ViewModels");
    var viewNs = target.viewNs || (rootNs + ".Views");
    var modelNs = target.modelNs || (rootNs + ".Models");
    var esc = escapeRe(fromRoot);
    // longer, more specific prefixes FIRST so they are not eaten by the bare root
    var nVm = replaceCounting(new RegExp(esc + "\\.ViewModels\\b", "g"), vmNs);
    var nView = replaceCounting(new RegExp(esc + "\\.Views\\b", "g"), viewNs);
    var nModel = replaceCounting(new RegExp(esc + "\\.Models\\b", "g"), modelNs);
    var nRoot = replaceCounting(new RegExp("\\b" + esc + "\\b", "g"), rootNs);
    var touched = nVm + nView + nModel + nRoot;
    if (touched) {
      notes.push("Renamed the namespace from " + fromRoot + " to " + rootNs +
        " in " + touched + " place" + (touched === 1 ? "" : "s") +
        " so this file belongs to your project.");
      if (nVm) notes.push("ViewModel namespace is now " + vmNs + ".");
      if (nView) notes.push("View namespace / x:Class is now under " + viewNs + ".");
      if (nModel) notes.push("Model namespace is now " + modelNs + ".");
    } else {
      notes.push("Namespaces already match your project (" + rootNs + ") — nothing to rename there.");
    }
  } else {
    todos.push("Tell me your project: type its name (e.g. RectangleUI) or paste one of its files, so I know what to rename \"" + fromRoot + "\" to.");
  }

  // optional explicit identifier renames (class names, property -> provided instance, etc.)
  (opts.renames || []).forEach(function (r) {
    if (!r || !r.from || !r.to || r.from === r.to) return;
    var n = replaceCounting(new RegExp("\\b" + escapeRe(r.from) + "\\b", "g"), r.to);
    if (n) notes.push("Replaced " + r.from + " with " + r.to + " (" + n + "x).");
    else todos.push("Could not replace " + r.from + " -> " + r.to + ": \"" + r.from + "\" was not found in the pasted code.");
  });

  return { text: out, notes: uniq(notes), todos: uniq(todos), fromNs: fromRoot, lang: lang };
}

/* ---------------- bundled example (a generated ExamApp VM + a real target) ---------------- */
function example() {
  return {
    projectName: "RectangleUI",
    starter:
'<Window xmlns="https://github.com/avaloniaui"\n' +
'        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n' +
'        x:Class="RectangleUI.Views.MainWindow"\n' +
'        Title="RectangleUI">\n' +
'</Window>\n',
    generated:
'using CommunityToolkit.Mvvm.ComponentModel;\n' +
'using CommunityToolkit.Mvvm.Input;\n' +
'using System.Collections.ObjectModel;\n\n' +
'namespace ExamApp.ViewModels;\n\n' +
'public partial class MainWindowViewModel : ObservableObject\n' +
'{\n' +
'    public ObservableCollection<ExamApp.Models.RectangleData> Rectangles { get; } = new();\n\n' +
'    [ObservableProperty] private double _rectWidth = 50;\n' +
'    [ObservableProperty] private double _rectHeight = 50;\n\n' +
'    [RelayCommand]\n' +
'    private void Add() { /* ... */ }\n' +
'}\n',
  };
}

var API = {
  deriveTarget: deriveTarget,
  readProject: readProject,
  detectSourceNs: detectSourceNs,
  guessLang: guessLang,
  adapt: adapt,
  example: example,
};
global.ADAPT_CORE = API;
if (typeof module !== "undefined" && module.exports) module.exports = API;

})(typeof window !== "undefined" ? window : globalThis);
