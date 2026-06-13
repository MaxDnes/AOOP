/* ============ ADAPT LAB · UI module ============
   window.ADAPT = { render, init }; short alias window.AD for onclick handlers.
   Pure string rendering; DOM access only inside functions. All rewrite logic
   lives in data/adapt-core.js (window.ADAPT_CORE).

   The job: paste a file your other tools generated (it says "ExamApp"), tell me
   your real project (name or one of its files), and get the same code with the
   names rewritten so it drops straight in. No hand-editing, no red errors.
*/
(function (global) {
"use strict";

var CORE = function () { return global.ADAPT_CORE; };

var state = null;
function defaults() {
  var ex = CORE() ? CORE().example() : { projectName: "", starter: "", generated: "" };
  return {
    projectName: ex.projectName || "",
    starter: ex.starter || "",
    generated: ex.generated || "",
    renames: [],
  };
}
function ensureState() {
  if (state) return;
  try { state = JSON.parse(localStorage.getItem("aop-adapt") || "null"); } catch (e) { state = null; }
  if (!state || typeof state !== "object") state = defaults();
  var d = defaults();
  Object.keys(d).forEach(function (k) { if (state[k] == null) state[k] = d[k]; });
  if (!Array.isArray(state.renames)) state.renames = [];
}
function save() { try { localStorage.setItem("aop-adapt", JSON.stringify(state)); } catch (e) {} }

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------------- compute ---------------- */
var result = null, projectInfo = null, computeError = "", targetSource = null;
function validRenames() {
  return (state.renames || []).filter(function (r) { return r && r.from && r.to && r.from !== r.to; });
}
function recompute() {
  ensureState();
  result = null; projectInfo = null; computeError = ""; targetSource = null;
  var core = CORE();
  if (!core) { computeError = "Adapt Lab core not loaded."; return; }
  try {
    projectInfo = state.starter.trim() ? core.readProject(state.starter) : null;
    var target = (projectInfo && projectInfo.rootNs) ? projectInfo : core.deriveTarget(state.projectName);
    targetSource = (projectInfo && projectInfo.rootNs) ? "file" : (target ? "name" : null);
    if (!state.generated.trim()) { result = null; return; }
    var lang = core.guessLang(state.generated);
    result = core.adapt(state.generated, lang, target, { renames: validRenames() });
  } catch (e) {
    computeError = "Adapt failed: " + (e && e.message ? e.message : String(e));
  }
}

/* ---------------- render ---------------- */
function render() {
  ensureState();
  recompute();
  var h = '<div class="content-inner content-wide">';

  h += '<div class="ad-head"><div>';
  h += '<div class="crumb"><b>ADAPT LAB</b></div>';
  h += '<h1 class="topic-title">Make generated code fit your project</h1>';
  h += '<p class="ad-sub">Your other tools write code under the placeholder name <code>ExamApp</code>. The exam gives you a project with its OWN name. Paste the generated file below, tell me your project (its name, or paste one of its files), and I rewrite the namespaces and class names so the code drops in with <b>no red errors and no hand-editing</b>.</p>';
  h += "</div>";
  h += '<div class="ad-toolbar">' +
    '<button class="ad-btn" title="load a sample generated VM + a RectangleUI target" onclick="AD.loadExample()">▣ Load example</button>' +
    '<button class="ad-btn" onclick="AD.clearAll()">✕ Clear</button>' +
    '<span class="ad-msg" id="ad-status"></span>' +
  "</div>";
  h += "</div>"; // ad-head

  h += '<div class="ad">';

  // LEFT: inputs
  h += '<div class="ad-left">';

  h += '<div class="ad-step">1 · Your exam project</div>';
  h += '<input class="ad-name" id="ad-name" type="text" spellcheck="false" autocomplete="off" ' +
    'placeholder="project name, e.g. RectangleUI" value="' + esc(state.projectName) + '" oninput="AD.setName(this.value)">';
  h += '<div class="ad-or">— or paste one file from the starter project (its MainWindow.axaml is ideal) —</div>';
  h += '<textarea class="ad-ta ad-ta-sm" id="ad-starter" spellcheck="false" placeholder="// optional: paste the starter project\'s MainWindow.axaml or any .cs so I can read its real names" oninput="AD.setStarter(this.value)">' + esc(state.starter) + "</textarea>";
  h += '<div id="ad-detect">' + detectHTML() + "</div>";

  h += '<div class="ad-step">2 · The generated code to drop in</div>';
  h += '<textarea class="ad-ta" id="ad-generated" spellcheck="false" placeholder="// paste the file you got from Visual Designer / Async Composer / Test Lab / Query Lab / MVVM Converter" oninput="AD.setGenerated(this.value)">' + esc(state.generated) + "</textarea>";

  h += '<div class="ad-step">3 · Extra renames (optional)</div>';
  h += '<div class="ad-renames-note">Map any other name the auto-pass can\'t know about — e.g. a generated property to a provided instance, or a class name. Left = the name in the generated code, right = the name your project uses.</div>';
  h += '<div id="ad-renames">' + renamesHTML() + "</div>";

  h += "</div>"; // ad-left

  // RIGHT: output
  h += '<div class="ad-right"><div id="ad-out">' + outHTML() + "</div></div>";

  h += "</div></div>";
  return h;
}

function detectHTML() {
  if (computeError) return "";
  if (!projectInfo && !state.projectName.trim()) {
    return '<div class="ad-detect ad-detect-empty">Type your project name or paste a starter file and I\'ll show what I learned about it.</div>';
  }
  var info = projectInfo;
  var h = '<div class="ad-detect">';
  if (targetSource === "file" && info && info.rootNs) {
    h += '<div class="ad-detect-h">Read from your file ✓</div>';
    h += '<table class="ad-kv">';
    h += row("Project (root)", info.rootNs);
    h += row("ViewModel namespace", info.vmNs);
    h += row("View namespace", info.viewNs);
    if (info.className) h += row("View class", info.className);
    h += "</table>";
    if (info.instances && info.instances.length) {
      h += '<div class="ad-detect-h2">Provided in your project — use these EXACT names</div><ul class="ad-instances">';
      info.instances.forEach(function (it) { h += "<li><code>" + esc(it.type) + " " + esc(it.name) + "</code></li>"; });
      h += "</ul>";
    }
    if (info.controls && info.controls.length) {
      h += '<div class="ad-detect-h2">Controls (x:Name) in the view</div><div class="ad-chips">';
      info.controls.forEach(function (c) { h += '<span class="ad-chip">' + esc(c) + "</span>"; });
      h += "</div>";
    }
  } else if (state.projectName.trim()) {
    var t = CORE().deriveTarget(state.projectName);
    if (t) {
      h += '<div class="ad-detect-h">Using the name you typed ✓</div>';
      h += '<table class="ad-kv">';
      h += row("Project (root)", t.rootNs);
      h += row("ViewModel namespace", t.vmNs);
      h += row("View namespace", t.viewNs);
      h += "</table>";
      h += '<div class="ad-detect-tip">Tip: paste the project\'s real <code>MainWindow.axaml</code> above to also see its provided instances and control names.</div>';
    }
  }
  h += "</div>";
  return h;
}
function row(k, v) {
  return "<tr><th>" + esc(k) + "</th><td><code>" + esc(v == null ? "—" : v) + "</code></td></tr>";
}

function renamesHTML() {
  var h = '<div class="ad-renames">';
  var rows = state.renames.length ? state.renames : [];
  rows.forEach(function (r, i) {
    h += '<div class="ad-rename-row">' +
      '<input class="ad-rn" type="text" spellcheck="false" placeholder="generated name" value="' + esc(r.from) + '" oninput="AD.setRename(' + i + ",'from',this.value)\">" +
      '<span class="ad-arrow">→</span>' +
      '<input class="ad-rn" type="text" spellcheck="false" placeholder="your project\'s name" value="' + esc(r.to) + '" oninput="AD.setRename(' + i + ",'to',this.value)\">" +
      '<button class="ad-rn-x" title="remove" onclick="AD.removeRename(' + i + ')">✕</button>' +
      "</div>";
  });
  h += '<button class="ad-btn ad-add" onclick="AD.addRename()">+ add a rename</button>';
  h += "</div>";
  return h;
}

function outHTML() {
  if (computeError) return '<div class="ad-err"><b>' + esc(computeError) + "</b></div>";
  if (!result) {
    return '<div class="ad-empty">Paste the generated code on the left (or click <b>Load example</b>) and the project-ready version appears here, with a note on everything it changed.</div>';
  }
  var lang = result.lang === "xml" ? "axaml" : "cs";
  var fname = result.lang === "xml" ? "MainWindow.axaml" : "MainWindowViewModel.cs";
  var h = "";
  h += '<div class="ad-file">';
  h += '<div class="ad-file-head"><span class="ad-file-name">ready to paste — ' + esc(fname) + "</span>" +
    '<span class="ad-file-actions">' +
    '<button class="ad-copybtn" onclick="AD.copyOut(this)">⧉ copy</button>' +
    '<button class="ad-copybtn" onclick="AD.downloadOut(this)">⭳ download</button>' +
    "</span></div>";
  h += '<pre class="ad-pre"><code>' + esc(result.text) + "</code></pre>";
  h += "</div>";

  h += '<div class="ad-msg2">Source name detected: <code>' + esc(result.fromNs) + "</code>. Paste this over the matching file in your project.</div>";

  if (result.notes && result.notes.length) {
    h += '<div class="ad-notes"><b>What I changed</b><ul>';
    result.notes.forEach(function (n) { h += "<li>" + esc(n) + "</li>"; });
    h += "</ul></div>";
  }
  if (result.todos && result.todos.length) {
    h += '<div class="ad-todos"><b>Still up to you</b><ul>';
    result.todos.forEach(function (n) { h += "<li>" + esc(n) + "</li>"; });
    h += "</ul></div>";
  }
  return h;
}

function init() { ensureState(); }

/* ---------------- repaint helpers (no-op without a DOM, so handlers are headless-safe) ---------------- */
function paintOut() { if (typeof document === "undefined") return; var el = document.getElementById("ad-out"); if (el) el.innerHTML = outHTML(); }
function paintDetect() { if (typeof document === "undefined") return; var el = document.getElementById("ad-detect"); if (el) el.innerHTML = detectHTML(); }
function rerender() { if (typeof document === "undefined") return; var c = document.getElementById("content"); if (c) c.innerHTML = render(); }
function setStatus(m) { if (typeof document === "undefined") return; var el = document.getElementById("ad-status"); if (el) el.textContent = m || ""; }

/* ---------------- handlers ---------------- */
function setName(v) { ensureState(); state.projectName = v; save(); recompute(); paintDetect(); paintOut(); }
function setStarter(v) { ensureState(); state.starter = v; save(); recompute(); paintDetect(); paintOut(); }
function setGenerated(v) { ensureState(); state.generated = v; save(); recompute(); paintOut(); }
function addRename() { ensureState(); state.renames.push({ from: "", to: "" }); save(); rerender(); }
function removeRename(i) { ensureState(); state.renames.splice(i, 1); save(); rerender(); }
function setRename(i, field, v) {
  ensureState();
  if (!state.renames[i]) state.renames[i] = { from: "", to: "" };
  state.renames[i][field] = v;
  save(); recompute(); paintOut();
}
function loadExample() {
  ensureState();
  var core = CORE(); if (!core) return;
  var ex = core.example();
  state.projectName = ex.projectName; state.starter = ex.starter; state.generated = ex.generated; state.renames = [];
  save(); rerender(); setStatus("loaded a generated ExamApp ViewModel + a RectangleUI target");
}
function clearAll() {
  ensureState();
  state.projectName = ""; state.starter = ""; state.generated = ""; state.renames = [];
  save(); rerender();
}

/* ---------------- copy / download ---------------- */
function flashButton(btn, label) {
  if (!btn) return;
  var orig = btn.getAttribute("data-orig") || btn.textContent;
  btn.setAttribute("data-orig", orig);
  btn.textContent = label; btn.classList.add("done");
  setTimeout(function () { btn.textContent = orig; btn.classList.remove("done"); }, 1600);
}
function copyOut(btn) {
  if (!result) return;
  var text = result.text, done = function () { flashButton(btn, "copied ✓"); };
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
function downloadOut(btn) {
  if (!result) return;
  var fname = result.lang === "xml" ? "MainWindow.axaml" : "MainWindowViewModel.cs";
  try {
    var blob = new Blob([String(result.text)], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1500);
    flashButton(btn, "downloaded ✓");
  } catch (e) { setStatus("download failed: " + (e && e.message)); }
}

var AD = {
  setName: setName, setStarter: setStarter, setGenerated: setGenerated,
  addRename: addRename, removeRename: removeRename, setRename: setRename,
  loadExample: loadExample, clearAll: clearAll, copyOut: copyOut, downloadOut: downloadOut,
};
var ADAPT = { render: render, init: init, outHTML: outHTML };

global.ADAPT = ADAPT;
global.AD = AD;
if (typeof module !== "undefined" && module.exports) module.exports = ADAPT;

})(typeof window !== "undefined" ? window : globalThis);
