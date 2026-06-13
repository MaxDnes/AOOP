/* ============ MVVM Converter · UI module ============
   window.MVVMCONV = { render, init }; short alias window.MC for onclick handlers.
   Pure string rendering; DOM access only inside functions. All transform logic
   lives in data/mvvmconv-core.js (window.MVVMCONV_CORE).

   Two directions:
     CodeBehind -> MVVM   (the exam task: paste MainWindow.axaml + .axaml.cs)
     MVVM -> CodeBehind   (study aid: see the equivalence; not for hand-in)
*/
(function (global) {
"use strict";

var CORE = function () { return global.MVVMCONV_CORE; };

var state = null;
function defaults() {
  var ex = CORE() ? CORE().example() : { axaml: "", codeBehind: "" };
  return {
    direction: "toMvvm",
    problem: "2",
    cbAxaml: ex.axaml,
    cbCode: ex.codeBehind,
    mvAxaml: "",
    mvVM: "",
  };
}
function ensureState() {
  if (state) return;
  try { state = JSON.parse(localStorage.getItem("aop-mvvmconv") || "null"); } catch (e) { state = null; }
  if (!state || typeof state !== "object") state = defaults();
  // backfill any missing field (schema growth safety)
  var d = defaults();
  Object.keys(d).forEach(function (k) { if (state[k] == null) state[k] = d[k]; });
}
function save() { try { localStorage.setItem("aop-mvvmconv", JSON.stringify(state)); } catch (e) {} }

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------------- compute ---------------- */
var result = null, computeError = "";
function recompute() {
  ensureState();
  result = null; computeError = "";
  var core = CORE();
  if (!core) { computeError = "Converter core not loaded."; return; }
  try {
    if (state.direction === "toMvvm") {
      if (!state.cbAxaml.trim() && !state.cbCode.trim()) { computeError = ""; return; }
      var r = core.toMvvm(state.cbAxaml, state.cbCode);
      result = {
        a: { name: "MainWindow.axaml", text: r.view },
        b: { name: "MainWindowViewModel.cs", text: r.viewModel },
        notes: r.notes, todos: r.todos,
      };
    } else {
      if (!state.mvAxaml.trim() && !state.mvVM.trim()) { computeError = ""; return; }
      var r2 = core.toCodeBehind(state.mvAxaml, state.mvVM);
      result = {
        a: { name: "MainWindow.axaml", text: r2.view },
        b: { name: "MainWindow.axaml.cs", text: r2.codeBehind },
        notes: r2.notes, todos: r2.todos,
      };
    }
  } catch (e) {
    computeError = "Conversion failed: " + (e && e.message ? e.message : String(e));
  }
}

/* ---------------- render ---------------- */
function render() {
  ensureState();
  recompute();
  var toMvvm = state.direction === "toMvvm";
  var h = '<div class="content-inner content-wide">';

  h += '<div class="mc-head"><div>';
  h += '<div class="crumb"><b>MVVM CONVERTER</b></div>';
  h += '<h1 class="topic-title">Convert: CodeBehind &harr; MVVM</h1>';
  h += '<p class="mc-sub">Paste the given <b>MainWindow.axaml</b> and <b>MainWindow.axaml.cs</b> and get the MVVM pair: a bound <b>View</b> and a <b>ViewModel</b> with [ObservableProperty] / [RelayCommand]. Anything it cannot map automatically is kept as a clearly marked <code>// TODO</code> so you know exactly what is left. Reverse direction is a study aid, not for hand-in.</p>';
  h += "</div>";
  h += '<div class="mc-toolbar">' +
    '<div class="mc-dir">' +
      '<button class="' + (toMvvm ? "on" : "") + '" onclick="MC.setDirection(\'toMvvm\')">CodeBehind &rarr; MVVM</button>' +
      '<button class="' + (!toMvvm ? "on" : "") + '" onclick="MC.setDirection(\'toCodeBehind\')">MVVM &rarr; CodeBehind</button>' +
    "</div>" +
    '<span class="mc-tb-sep"></span>' +
    '<button class="mc-btn" title="load the CircleCodeBehind exam project" onclick="MC.loadExample()">▣ Load example</button>' +
    '<button class="mc-btn" onclick="MC.clearAll()">✕ Clear</button>' +
    '<span class="mc-msg" id="mc-status"></span>' +
  "</div>";
  h += "</div>"; // mc-head

  h += '<div class="mc">';

  // LEFT: inputs
  h += '<div class="mc-left">';
  if (toMvvm) {
    h += '<div class="mc-pane-h">MainWindow.axaml (the given view)</div>';
    h += '<textarea class="mc-ta" id="mc-axaml" spellcheck="false" oninput="MC.setAxaml(this.value)" placeholder="// paste the CodeBehind MainWindow.axaml">' + esc(state.cbAxaml) + "</textarea>";
    h += '<div class="mc-pane-h">MainWindow.axaml.cs (the code-behind logic)</div>';
    h += '<textarea class="mc-ta" id="mc-code" spellcheck="false" oninput="MC.setCode(this.value)" placeholder="// paste the MainWindow.axaml.cs">' + esc(state.cbCode) + "</textarea>";
  } else {
    h += '<div class="mc-pane-h">MainWindow.axaml (a bound MVVM view)</div>';
    h += '<textarea class="mc-ta" id="mc-axaml" spellcheck="false" oninput="MC.setAxaml(this.value)" placeholder="// paste a bound MainWindow.axaml">' + esc(state.mvAxaml) + "</textarea>";
    h += '<div class="mc-pane-h">MainWindowViewModel.cs</div>';
    h += '<textarea class="mc-ta" id="mc-code" spellcheck="false" oninput="MC.setCode(this.value)" placeholder="// paste the ViewModel">' + esc(state.mvVM) + "</textarea>";
  }
  h += "</div>";

  // RIGHT: output
  h += '<div class="mc-right"><div id="mc-out">' + outputHTML() + "</div></div>";

  h += "</div></div>";
  return h;
}

function fileBlock(file) {
  var h = '<div class="mc-file">';
  h += '<div class="mc-file-head"><span class="mc-file-name">' + esc(file.name) + "</span>" +
    '<button class="mc-copybtn" onclick="MC.copy(this, ' + (file.which) + ')">⧉ copy</button></div>';
  h += '<pre class="mc-pre"><code>' + esc(file.text) + "</code></pre>";
  h += "</div>";
  return h;
}

function outputHTML() {
  if (computeError) return '<div class="mc-err"><b>' + esc(computeError) + "</b></div>";
  if (!result) {
    return '<div class="mc-empty">Paste a project on the left (or click <b>Load example</b>) and the converted files appear here.</div>';
  }
  var toMvvm = state.direction === "toMvvm";
  var h = "";
  h += fileBlock({ name: result.a.name, text: result.a.text, which: 0 });
  h += fileBlock({ name: result.b.name, text: result.b.text, which: 1 });

  // actions
  h += '<div class="mc-actions">';
  if (toMvvm) {
    h += 'Problem <select class="mc-btn" onchange="MC.setProblem(this.value)">' +
      '<option value="2"' + (state.problem === "2" ? " selected" : "") + ">2</option>" +
      '<option value="3"' + (state.problem === "3" ? " selected" : "") + ">3</option>" +
      "</select>";
    h += '<button class="mc-copybtn mc-submit" title="download the two flat hand-in files for this problem" onclick="MC.downloadSubmission(this)">⭳ Download submission files</button>';
  }
  h += "</div>";
  if (toMvvm) h += '<div class="mc-msg">Hand-in names: Problem_' + esc(state.problem) + "_MainWindow.axaml + Problem_" + esc(state.problem) + "_MainWindowViewModel.cs — submit flat: 6 files, no bin/obj, no subfolders.</div>";

  // notes
  if (result.notes && result.notes.length) {
    h += '<div class="mc-notes"><b>What it mapped</b><ul>';
    result.notes.forEach(function (n) { h += "<li>" + esc(n) + "</li>"; });
    h += "</ul></div>";
  }
  // todos
  if (result.todos && result.todos.length) {
    h += '<div class="mc-todos"><b>Left for you (TODO)</b><ul>';
    result.todos.forEach(function (n) { h += "<li>" + esc(n) + "</li>"; });
    h += "</ul></div>";
  }
  h += cheatSheet();
  return h;
}

function cheatSheet() {
  var rows = [
    ["<code>Button.Click +=</code> handler", "<code>[RelayCommand]</code> method + <code>Command=\"{Binding NameCommand}\"</code>"],
    ["read/write <code>Slider.Value</code> etc.", "<code>[ObservableProperty]</code> + <code>Value=\"{Binding Prop}\"</code>"],
    ["<code>label.Text = x</code> in a handler", "bind <code>Text=\"{Binding Prop}\"</code> — no code sets it"],
    ["<code>combo.ItemsSource = list</code>", "<code>public List&lt;T&gt; Items { get; }</code> + <code>ItemsSource=\"{Binding Items}\"</code>"],
    ["read <code>combo.SelectedItem</code>", "<code>[ObservableProperty]</code> Selected… + <code>SelectedItem=\"{Binding …}\"</code>"],
    ["color string &rarr; <code>shape.Fill</code>", "derived <code>IBrush</code> set in <code>On…Changed</code>, bind <code>Fill</code> to it"],
    ["<code>x:Name</code> + logic in .axaml.cs", "bindings in the view; the code-behind keeps only <code>InitializeComponent()</code>"],
    ["<code>DataContext</code> set in code", "set it in App.axaml.cs (composition root), never in the View"],
  ];
  var h = '<details class="mc-cheat"><summary>CodeBehind → MVVM cheat-sheet (every idiom → its MVVM form)</summary><table><tr><th>CodeBehind idiom</th><th>MVVM equivalent</th></tr>';
  rows.forEach(function (r) { h += "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td></tr>"; });
  h += "</table></details>";
  return h;
}

function init() { ensureState(); }

/* ---------------- repaint helpers ---------------- */
function paintOut() {
  var el = document.getElementById("mc-out");
  if (el) el.innerHTML = outputHTML();
}
function rerender() {
  var c = document.getElementById("content");
  if (c) c.innerHTML = render();
}
function setStatus(msg) {
  var el = document.getElementById("mc-status");
  if (el) el.textContent = msg || "";
}

/* ---------------- handlers ---------------- */
function setDirection(dir) { ensureState(); state.direction = dir; save(); rerender(); }
function setProblem(p) { ensureState(); state.problem = p; save(); paintOut(); }
function setAxaml(v) {
  ensureState();
  if (state.direction === "toMvvm") state.cbAxaml = v; else state.mvAxaml = v;
  save(); recompute(); paintOut();
}
function setCode(v) {
  ensureState();
  if (state.direction === "toMvvm") state.cbCode = v; else state.mvVM = v;
  save(); recompute(); paintOut();
}
function loadExample() {
  ensureState();
  var core = CORE();
  if (!core) return;
  var ex = core.example();
  if (state.direction === "toMvvm") {
    state.cbAxaml = ex.axaml; state.cbCode = ex.codeBehind;
  } else {
    // derive a bound MVVM pair from the example so the reverse has real input
    var fwd = core.toMvvm(ex.axaml, ex.codeBehind);
    state.mvAxaml = fwd.view; state.mvVM = fwd.viewModel;
  }
  save(); rerender(); setStatus("loaded the CircleCodeBehind example");
}
function clearAll() {
  ensureState();
  if (state.direction === "toMvvm") { state.cbAxaml = ""; state.cbCode = ""; }
  else { state.mvAxaml = ""; state.mvVM = ""; }
  save(); rerender();
}

/* ---------------- copy + download ---------------- */
function flashButton(btn, label) {
  if (!btn) return;
  var orig = btn.getAttribute("data-orig") || btn.textContent;
  btn.setAttribute("data-orig", orig);
  btn.textContent = label; btn.classList.add("done");
  setTimeout(function () { btn.textContent = orig; btn.classList.remove("done"); }, 1600);
}
function copy(btn, which) {
  if (!result) return;
  var text = which === 0 ? result.a.text : result.b.text;
  copyText(text, btn);
}
function copyText(text, btn) {
  var done = function () { flashButton(btn, "copied ✓"); };
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  var ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta); done();
}
function downloadText(fileName, text) {
  try {
    var blob = new Blob([String(text == null ? "" : text)], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1500);
  } catch (e) { setStatus("download failed: " + (e && e.message)); }
}
/* the flat hand-in pair for Problem 2 or 3 — plain blobs, no zip, works on file:// */
function downloadSubmission(btn) {
  if (!result || state.direction !== "toMvvm") return;
  var n = state.problem === "3" ? "3" : "2";
  downloadText("Problem_" + n + "_MainWindow.axaml", result.a.text);
  downloadText("Problem_" + n + "_MainWindowViewModel.cs", result.b.text);
  flashButton(btn, "downloaded ✓");
  setStatus("downloaded Problem_" + n + "_MainWindow.axaml + Problem_" + n + "_MainWindowViewModel.cs — drop both into the flat submission folder");
}

var MC = {
  setDirection: setDirection, setProblem: setProblem,
  setAxaml: setAxaml, setCode: setCode,
  loadExample: loadExample, clearAll: clearAll,
  copy: copy, downloadSubmission: downloadSubmission,
};
var MVVMCONV = { render: render, init: init, outputHTML: outputHTML };

global.MVVMCONV = MVVMCONV;
global.MC = MC;
if (typeof module !== "undefined" && module.exports) module.exports = MVVMCONV;

})(typeof window !== "undefined" ? window : globalThis);
