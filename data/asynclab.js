/* ============================================================
   ASYNC LAB · UI for the async-ViewModel composer (Problem 3 solver)
   window.ASYNCLAB = { render, init }
   All event handlers live on window.AL.
   Pure string rendering; DOM access happens only inside functions
   so the module loads under Node for tests. Logic lives in
   data/asynclab-core.js (window.ASYNCLAB_CORE).
   ============================================================ */

(function (global) {
"use strict";

const STORE_KEY = "aop-asynclab-state";
const STATE_VERSION = 1;            // version-stamp the persisted payload (spec 14)
const DEFAULT_PROJECT = "AsyncApp"; // export project name default (spec 13)

const PATTERN_DEFS = [
  { key: "counter",  label: "Counter",        desc: "int +step per tick" },
  { key: "progress", label: "Progress worker", desc: "0..100, completes & stops" },
  { key: "list",     label: "List mutator",   desc: "adds to an ObservableCollection" },
];

const MECH_DEFS = [
  { key: "timer", label: "DispatcherTimer",       desc: "ticks on the UI thread already" },
  { key: "task",  label: "Task.Delay + CTS",      desc: "needs Dispatcher.UIThread (InvokeAsync/Post)" },
  { key: "both",  label: "Both",                  desc: "primary + alternate region" },
];

/* ---------------- module state ---------------- */
let state = null;        // { config:{...}, projectName:".." }
let lastFiles = null;    // generated [{fileName,lang,code}]
let lastError = null;    // string when generation/export hit a problem (styled panel, never a throw)
let saveTimer = null;
let genTimer = null;     // debounce for live regeneration on rapid form edits

/* ---------------- helpers ---------------- */
function core() { return global.ASYNCLAB_CORE; }
function projzip() { return global.PROJZIP; }      // zip + scaffold core (may be absent -> button hidden)
function hasProjzip() {
  const P = projzip();
  return !!(P && typeof P.avaloniaProject === "function" && typeof P.makeZipBlobUrl === "function");
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* use the app's highlighter when present (browser); plain esc under Node */
function hiFile(code, lang) {
  if (typeof global.highlight === "function") return global.highlight(code, lang || "csharp");
  return esc(code);
}

function byId(id) { return document.getElementById(id); }
function paint(id, html) { const el = byId(id); if (el) el.innerHTML = html; }
function setStatus(msg) { const el = byId("al-status"); if (el) el.textContent = msg; }

/* ---------------- persistence (localStorage, try/catch) ---------------- */
function defaultConfig() {
  const C = core();
  return C ? C.defaultConfig() : {
    pattern: "counter", mechanism: "timer", intervalMs: 100, step: 1,
    commands: { start: true, stop: true, reset: true, toggle: false },
    canExecute: false, resetStops: true, emitAxaml: false, emitTest: false,
    namespace: "Counter.ViewModels", baseType: "ViewModelBase",
  };
}

function defaultState() { return { config: defaultConfig(), projectName: DEFAULT_PROJECT }; }

function sanitizeProjectName(s) {
  /* mirror the projzip sanitiser when present so the displayed name matches the
     actual exported assembly/namespace; otherwise a light local fallback. */
  const P = projzip();
  if (P && typeof P.sanitizeName === "function") return P.sanitizeName(s, DEFAULT_PROJECT);
  s = String(s == null ? "" : s).trim().replace(/[^A-Za-z0-9_.]+/g, "_").replace(/^[._]+|[._]+$/g, "");
  return s || DEFAULT_PROJECT;
}

/* migrate any persisted shape (versioned or the v4 un-stamped {config}) into the
   current state; unknown / tampered blobs fall back to defaults, never throw. */
function migrateState(raw) {
  if (!raw || typeof raw !== "object") return defaultState();
  /* v4 stored a bare {config}; treat a missing/older v the same way: re-read config */
  const cfgIn = (raw.config && typeof raw.config === "object") ? raw.config : null;
  if (!cfgIn) return defaultState();
  const C = core();
  /* normalise through the core so a tampered/old blob can never break the UI */
  const cfg = C ? C.normalize(cfgIn) : cfgIn;
  const name = typeof raw.projectName === "string" && raw.projectName.trim()
    ? raw.projectName : DEFAULT_PROJECT;
  return { config: cfg, projectName: name };
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    return migrateState(raw);
  } catch (e) { return defaultState(); }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: STATE_VERSION, config: state.config, projectName: state.projectName,
    }));
  } catch (e) {}
}

function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 250); }

function ensureState() { if (!state) state = loadState(); }

/* ---------------- left pane: configuration form ---------------- */
function cfg() { return state.config; }

function radioGroup(name, defs, current, handler) {
  let h = '<div class="al-radios">';
  defs.forEach(function (d) {
    const on = current === d.key;
    h += '<label class="al-radio' + (on ? " on" : "") + '">' +
      '<input type="radio" name="' + name + '"' + (on ? " checked" : "") +
      ' onchange="AL.' + handler + "('" + d.key + "')\">" +
      '<span class="al-radio-l">' + esc(d.label) + "</span>" +
      '<span class="al-radio-d">' + esc(d.desc) + "</span></label>";
  });
  h += "</div>";
  return h;
}

function checkbox(label, on, handler, desc) {
  return '<label class="al-check' + (on ? " on" : "") + '">' +
    '<input type="checkbox"' + (on ? " checked" : "") + ' onchange="AL.' + handler + '(this.checked)">' +
    '<span class="al-check-l">' + esc(label) + "</span>" +
    (desc ? '<span class="al-check-d">' + esc(desc) + "</span>" : "") + "</label>";
}

function formHTML() {
  const c = cfg();
  let h = "";

  h += '<div class="al-field"><div class="al-field-h">Pattern</div>' +
    radioGroup("al-pattern", PATTERN_DEFS, c.pattern, "setPattern") + "</div>";

  h += '<div class="al-field"><div class="al-field-h">Mechanism</div>' +
    radioGroup("al-mech", MECH_DEFS, c.mechanism, "setMechanism") + "</div>";

  /* interval + step */
  h += '<div class="al-field"><div class="al-field-h">Timing</div><div class="al-nums">' +
    '<label class="al-num">Interval (ms)' +
    '<input type="number" min="1" step="1" value="' + esc(c.intervalMs) +
    '" oninput="AL.setInterval(this.value)"></label>' +
    '<label class="al-num">Step (per tick)' +
    '<input type="number" step="1" value="' + esc(c.step) +
    '" oninput="AL.setStep(this.value)"></label></div></div>';

  /* commands */
  h += '<div class="al-field"><div class="al-field-h">Commands</div><div class="al-checks">' +
    checkbox("Start", c.commands.start, "setCmdStart") +
    checkbox("Stop", c.commands.stop, "setCmdStop") +
    checkbox("Reset", c.commands.reset, "setCmdReset") +
    checkbox("Toggle (single button)", c.commands.toggle, "setCmdToggle", "Start/Stop in one") +
    "</div></div>";

  /* options */
  h += '<div class="al-field"><div class="al-field-h">Options</div><div class="al-checks">' +
    checkbox("CanExecute wiring", c.canExecute, "setCanExecute", "guards + NotifyCanExecuteChangedFor") +
    checkbox("Reset also stops", c.resetStops, "setResetStops", "off = zero but keep running") +
    checkbox("Emit matching AXAML", c.emitAxaml, "setEmitAxaml") +
    checkbox("Emit headless xUnit test", c.emitTest, "setEmitTest") +
    "</div></div>";

  return h;
}

/* ---------------- right pane: mechanism note + generated files ---------------- */
function noteHTML() {
  const C = core();
  const note = C ? C.mechanismNote() : [];
  let h = '<div class="al-note"><div class="al-note-h">Which mechanism when</div><div class="al-note-body">';
  note.forEach(function (line) {
    h += line === "" ? "<br>" : '<div class="al-note-line">' + esc(line) + "</div>";
  });
  h += "</div></div>";
  return h;
}

function semanticsHTML() {
  return '<div class="al-sem"><div class="al-sem-h">Fixed exam semantics</div>' +
    '<ul class="al-sem-list">' +
    "<li><b>Start</b> is idempotent while running (guarded).</li>" +
    "<li><b>Stop</b> preserves the value (pause, no reset).</li>" +
    "<li><b>Start after Stop</b> resumes from the preserved value.</li>" +
    "<li><b>Reset</b> zeroes" +
    (cfg().resetStops ? " and stops the worker." : " but keeps the worker running.") + "</li>" +
    "<li>All UI updates run on the <b>UI thread</b> (the point-earning rule).</li>" +
    "</ul></div>";
}

function errorPanelHTML(msg) {
  return '<div class="al-error" role="alert">' +
    '<div class="al-error-h">Generation problem</div>' +
    '<pre class="al-error-body">' + esc(msg) + "</pre>" +
    '<div class="al-error-hint">Pick a different pattern/mechanism on the left, or press “Reset to default”.</div>' +
    "</div>";
}

function emptyHTML() {
  return '<div class="al-empty">' +
    '<div class="al-empty-h">Start here</div>' +
    '<ol class="al-empty-steps">' +
    "<li>Pick a <b>pattern</b> and <b>mechanism</b> on the left.</li>" +
    "<li>Set the interval, step and which <b>commands</b> you need.</li>" +
    "<li><b>Copy all</b> into your exam project, or hit <b>Export project (.zip)</b> for a ready-to-build app.</li>" +
    "</ol>" +
    '<div class="al-empty-note">The default (Counter · DispatcherTimer · 100&nbsp;ms · Start/Stop/Reset) is the verified Re-exam P3 solution.</div>' +
    "</div>";
}

/* the output toolbar: Copy all (left) + the submission download (primary) and the
   project .zip export (success action, right). The submission download is ALWAYS
   available (plain blobs, no zip core); the .zip export controls only render when
   window.PROJZIP loaded — graceful hidden fallback (spec 13/16). */
function outputBarHTML() {
  let h = '<div class="al-bar">';
  h += '<button class="copybtn copybtn-primary" onclick="AL.copyAll(this)">copy all</button>';
  h += '<span class="al-bar-spacer"></span>';
  /* the final-deliverable path: two flat files with the professor's exact names */
  h += '<button class="al-submit" onclick="AL.downloadSubmission(this)" ' +
    'title="Download Problem_3_MainWindowViewModel.cs and Problem_3_MainWindow.axaml (the two graded files)">' +
    'Download submission files</button>';
  if (hasProjzip()) {
    h += '<label class="al-proj">project' +
      '<input type="text" id="al-proj-name" value="' + esc(state.projectName) +
      '" spellcheck="false" autocomplete="off" oninput="AL.setProjectName(this.value)"></label>';
    h += '<button class="al-export" onclick="AL.exportProject(this)" title="Download a complete, runnable Avalonia project (.zip)">Export project (.zip)</button>';
  }
  h += "</div>";
  /* the flat-submit reminder, shared across every tool (plain casual prose) */
  h += '<div class="al-submit-hint">submit flat: 6 files, no bin/obj, no subfolders</div>';
  return h;
}

function filesHTML() {
  if (lastError) return outputBarHTML() + errorPanelHTML(lastError);
  if (!lastFiles || !lastFiles.length) return emptyHTML();

  let h = outputBarHTML();
  lastFiles.forEach(function (file, i) {
    h += '<div class="al-card">';
    h += '<div class="al-card-head">';
    h += '<span class="al-file">' + esc(file.fileName) + "</span>";
    h += '<button class="copybtn" onclick="AL.copyOne(this,' + i + ')">copy</button>';
    h += "</div>";
    h += '<pre class="al-code">' + hiFile(file.code, file.lang) + "</pre>";
    h += "</div>";
  });
  return h;
}

/* ---------------- page ---------------- */
function render() {
  ensureState();
  let h = '<div class="content-inner content-wide">';
  h += '<div class="crumb"><b>ASYNC COMPOSER</b></div>';
  h += '<h1 class="topic-title">Async Composer</h1>';
  h += '<p class="bp">Configure the Problem 3 async worker and get the complete <b>MainWindowViewModel</b>, plus matching AXAML, a headless xUnit test, or a ready-to-build project (.zip), with no coding. Defaults are the verified Re-exam counter: DispatcherTimer, +1 every 100&nbsp;ms, Start/Stop/Reset.</p>';
  h += '<div class="al">';
  h += '<div class="al-left">';
  h += '<div class="al-form" id="al-form">' + formHTML() + "</div>";
  h += '<div class="al-actions">' +
    '<button class="al-gen" onclick="AL.regenerate()">Regenerate</button>' +
    '<button class="copybtn" onclick="AL.reset()">Reset to default</button>' +
    '<span class="al-status" id="al-status"></span></div>';
  h += semanticsHTML();
  h += "</div>";
  h += '<div class="al-right">';
  h += '<div class="al-note-wrap" id="al-note">' + noteHTML() + "</div>";
  h += '<div class="al-files" id="al-files">' + filesHTML() + "</div>";
  h += "</div>";
  h += "</div></div>";
  return h;
}

function init() {
  ensureState();
  doGenerate(true);
}

/* ---------------- repaint helpers ---------------- */
function paintForm() { paint("al-form", formHTML()); }
function paintFiles() { paint("al-files", filesHTML()); }
function paintSemantics() {
  /* semantics card lives in the left column; re-render the whole left form area's sibling */
  const el = document.querySelector(".al-sem");
  if (el) el.outerHTML = semanticsHTML();
}

/* ---------------- generation ---------------- */
function doGenerate(silent) {
  ensureState();
  const C = core();
  if (!C) {
    lastFiles = [];
    lastError = "Async Lab core (data/asynclab-core.js) did not load. Reopen the app from index.html.";
    paintFiles();
    setStatus("core not loaded");
    return;
  }
  lastError = null;
  try {
    lastFiles = C.generate(state.config);
    if (!Array.isArray(lastFiles) || !lastFiles.length) {
      lastFiles = [];
      lastError = "The composer produced no files for this configuration.";
    }
  } catch (e) {
    lastFiles = [];
    lastError = "Could not generate the ViewModel: " + (e && e.message ? e.message : String(e));
  }
  paintFiles();
  if (!silent) {
    if (lastError) { setStatus("generation problem, see panel"); return; }
    const n = lastFiles ? lastFiles.length : 0;
    setStatus(n + " file" + (n === 1 ? "" : "s") + " generated");
  }
}

/* debounced live regeneration — rapid form edits coalesce into one regen so the
   right pane never thrashes; unsaved option state is preserved across the wait. */
function scheduleGenerate() {
  clearTimeout(genTimer);
  genTimer = setTimeout(function () { doGenerate(true); }, 120);
}

/* ---------------- config setters (window.AL) ---------------- */
function update(mutator, opts) {
  ensureState();
  mutator(state.config);
  /* re-normalise so dependent invariants hold (e.g. Start forced on) */
  const C = core();
  if (C) state.config = C.normalize(state.config);
  saveState();
  if (opts && opts.repaintForm) paintForm();
  if (opts && opts.repaintSemantics) paintSemantics();
  scheduleGenerate();
}

function setPattern(p) { update(function (c) { c.pattern = p; }, { repaintForm: true }); }
function setMechanism(m) { update(function (c) { c.mechanism = m; }, { repaintForm: true }); }
function setInterval(v) { update(function (c) { c.intervalMs = v; }); }
function setStep(v) { update(function (c) { c.step = v; }); }
function setCmdStart(on) { update(function (c) { c.commands.start = !!on; }, { repaintForm: true }); }
function setCmdStop(on) { update(function (c) { c.commands.stop = !!on; }, { repaintForm: true }); }
function setCmdReset(on) { update(function (c) { c.commands.reset = !!on; }, { repaintForm: true }); }
function setCmdToggle(on) { update(function (c) { c.commands.toggle = !!on; }, { repaintForm: true }); }
function setCanExecute(on) { update(function (c) { c.canExecute = !!on; }, { repaintForm: true }); }
function setResetStops(on) { update(function (c) { c.resetStops = !!on; }, { repaintForm: true, repaintSemantics: true }); }
function setEmitAxaml(on) { update(function (c) { c.emitAxaml = !!on; }, { repaintForm: true }); }
function setEmitTest(on) { update(function (c) { c.emitTest = !!on; }, { repaintForm: true }); }

function regenerate() { clearTimeout(genTimer); doGenerate(false); }

function reset() {
  ensureState();
  state.config = defaultConfig();
  saveState();
  paintForm();
  paintSemantics();
  doGenerate(false);
  setStatus("reset to default (Re-exam P3 counter)");
}

/* ---------------- copy ---------------- */
function copyOne(btn, i) {
  if (!lastFiles || !lastFiles[i]) return;
  copyText(lastFiles[i].code, btn);
}

function copyAll(btn) {
  if (!lastFiles || !lastFiles.length) return;
  const text = lastFiles.map(function (f) {
    return "// ===== " + f.fileName + " =====\n" + f.code;
  }).join("\n\n");
  copyText(text, btn);
}

function copyText(text, btn) {
  const done = function () {
    const orig = btn.getAttribute("data-orig") || btn.textContent;
    btn.setAttribute("data-orig", orig);
    btn.textContent = "copied ✓";
    btn.classList.add("done");
    setTimeout(function () { btn.textContent = orig; btn.classList.remove("done"); }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
  } else fallbackCopy(text, done);
}

function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
  done();
}

/* ---------------- export project (.zip) ---------------- */
function setProjectName(v) {
  ensureState();
  state.projectName = String(v == null ? "" : v);
  saveState();   /* no regen needed: the name only affects the exported zip */
}

/* Build the avaloniaProject entries for the CURRENT composer state: the generated
   ViewModel + the matching AXAML snippet wrapped in the scaffold's MainWindow.
   The VM namespace is forced to "<sanitizedName>.ViewModels" so it lines up with
   the scaffold (App.axaml.cs does `new MainWindowViewModel()` in that namespace). */
function buildExportEntries() {
  const C = core(), P = projzip();
  if (!C || !P) return null;
  const rawName = (state.projectName && state.projectName.trim()) ? state.projectName : DEFAULT_PROJECT;
  const safe = P.sanitizeName(rawName, DEFAULT_PROJECT);
  /* clone the config so the live UI state is never mutated, then pin the namespace
     and force the AXAML on so we always have a snippet to wrap. */
  const exportCfg = C.normalize(Object.assign({}, state.config, {
    namespace: safe + ".ViewModels",
    emitAxaml: true,
  }));
  const vm = C.generateViewModel(exportCfg).code;
  const axaml = C.generateAxaml(exportCfg).code;
  return { name: rawName, entries: P.avaloniaProject(rawName, { axaml: axaml, viewModel: vm }) };
}

function exportProject(btn) {
  ensureState();
  if (!hasProjzip()) { setStatus("export core not loaded"); return; }
  let built;
  try { built = buildExportEntries(); }
  catch (e) { built = null; }
  if (!built || !built.entries || !built.entries.length) {
    lastError = "Could not assemble the project zip for export.";
    paintFiles();
    setStatus("export failed");
    return;
  }
  const P = projzip();
  const fileName = P.sanitizeName(built.name, DEFAULT_PROJECT) + ".zip";
  try {
    const url = P.makeZipBlobUrl(built.entries);
    triggerDownload(url, fileName);
    /* the object URL is consumed by the click; revoke shortly after to free memory */
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000);
    flashBtn(btn, "downloaded ✓");
    setStatus("exported " + fileName + " (" + built.entries.length + " files)");
  } catch (e) {
    lastError = "Export failed: " + (e && e.message ? e.message : String(e));
    paintFiles();
    setStatus("export failed");
  }
}

function triggerDownload(url, fileName) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ---------------- download submission files (flat 6-file format, spec 16) ----------------
   One click downloads THIS tool's two graded files with the professor's exact names:
   Problem_3_MainWindowViewModel.cs + Problem_3_MainWindow.axaml. Plain text blobs, no
   zip, so it works on file:// and never depends on window.PROJZIP. The files use the
   Exam Starter Kit namespaces (ExamApp.*) so a grader can drop the pair into a standard
   Avalonia project and build. */
function downloadSubmission(btn) {
  ensureState();
  const C = core();
  if (!C || typeof C.generateSubmission !== "function") {
    lastError = "Async Lab core (data/asynclab-core.js) did not load. Reopen the app from index.html.";
    paintFiles();
    setStatus("submission export unavailable");
    return;
  }
  let files;
  try { files = C.generateSubmission(state.config); }
  catch (e) { files = null; }
  if (!Array.isArray(files) || !files.length) {
    lastError = "Could not assemble the submission files for this configuration.";
    paintFiles();
    setStatus("submission export failed");
    return;
  }
  try {
    files.forEach(function (f) { downloadTextFile(f.fileName, f.code); });
    flashBtn(btn, "downloaded ✓");
    setStatus("downloaded " + files.map(function (f) { return f.fileName; }).join(" + "));
  } catch (e) {
    lastError = "Submission download failed: " + (e && e.message ? e.message : String(e));
    paintFiles();
    setStatus("submission export failed");
  }
}

/* write one plain-text file to a blob anchor (file:// safe, no zip core). */
function downloadTextFile(fileName, text) {
  const blob = new Blob([String(text == null ? "" : text)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  /* the object URL is consumed by the click; revoke shortly after to free memory */
  setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000);
}

/* brief button confirmation, mirroring the copybtn "copied ✓" affordance */
function flashBtn(btn, label) {
  if (!btn) return;
  const orig = btn.getAttribute("data-orig") || btn.textContent;
  btn.setAttribute("data-orig", orig);
  btn.textContent = label;
  btn.classList.add("done");
  setTimeout(function () { btn.textContent = orig; btn.classList.remove("done"); }, 1800);
}

/* ---------------- export ---------------- */
const AL = {
  setPattern: setPattern,
  setMechanism: setMechanism,
  setInterval: setInterval,
  setStep: setStep,
  setCmdStart: setCmdStart,
  setCmdStop: setCmdStop,
  setCmdReset: setCmdReset,
  setCmdToggle: setCmdToggle,
  setCanExecute: setCanExecute,
  setResetStops: setResetStops,
  setEmitAxaml: setEmitAxaml,
  setEmitTest: setEmitTest,
  regenerate: regenerate,
  reset: reset,
  copyOne: copyOne,
  copyAll: copyAll,
  setProjectName: setProjectName,
  exportProject: exportProject,
  downloadSubmission: downloadSubmission,
};

const ASYNCLAB = { render: render, init: init };

global.ASYNCLAB = ASYNCLAB;
global.AL = AL;
if (typeof module !== "undefined" && module.exports) module.exports = ASYNCLAB;
})(typeof window !== "undefined" ? window : globalThis);
