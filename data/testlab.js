/* ============================================================
   TEST LAB · UI for the xUnit test proposer
   window.TESTLAB = { render, init }
   All event handlers live on window.TL.
   Pure string rendering; DOM access happens only inside
   functions so the module loads under Node for tests. Logic
   lives in data/testlab-core.js (window.TESTLAB_CORE).
   ============================================================ */

(function (global) {
"use strict";

const STORE_KEY = "aop-testlab-state";

/* small built-in example: a CommunityToolkit counter ViewModel that
   exercises every parser path (ObservableProperty, RelayCommand,
   async loop, Start/Stop/Reset). */
const EXAMPLE_NAME = "CounterViewModel.cs";
const EXAMPLE = [
  "using System.Threading.Tasks;",
  "using CommunityToolkit.Mvvm.ComponentModel;",
  "using CommunityToolkit.Mvvm.Input;",
  "",
  "namespace ExamApp.ViewModels;",
  "",
  "public partial class CounterViewModel : ObservableObject",
  "{",
  "    [ObservableProperty]",
  "    private int count;",
  "",
  "    private bool _running;",
  "",
  "    [RelayCommand]",
  "    private async Task Start()",
  "    {",
  "        _running = true;",
  "        while (_running)",
  "        {",
  "            Count++;",
  "            await Task.Delay(100);",
  "        }",
  "    }",
  "",
  "    [RelayCommand]",
  "    private void Stop() => _running = false;",
  "",
  "    [RelayCommand]",
  "    private void Reset()",
  "    {",
  "        _running = false;",
  "        Count = 0;",
  "    }",
  "}",
].join("\n");

const MODE_DEFS = [
  { key: "perFunction", label: "Per-function P/N/E" },
  { key: "plain",       label: "Plain xUnit" },
  { key: "viewModel",   label: "ViewModel tests" },
  { key: "headless",    label: "Headless scaffold" },
  { key: "async",       label: "Async patterns" },
  { key: "csproj",      label: "csproj + runbook" },
];

/* ---------------- module state ---------------- */
let state = null;        // { files:[{name,text}], active, options:{...} }
let lastFiles = null;    // generated [{fileName,code}] from TESTLAB_CORE.generate
let lastModel = null;    // parsed model
let lastError = null;    // {message, excerpt} when generation failed (spec 14)
let viewModes = {};      // file index -> "edit" | "view"
let collapsed = {};      // generated fileName -> true when its card is collapsed
let lastExampleId = null; // id of the worked example currently loaded (for the teaching note)
let saveTimer = null;
let genTimer = null;

/* current persisted-state schema version (spec 14: version-stamp payloads) */
const STORE_VERSION = 1;

/* ---------------- helpers ---------------- */
function core() { return global.TESTLAB_CORE; }

/* the worked-examples gallery (data/testlab-examples.js). Absent if that file
   did not load: the gallery strip hides itself rather than crash. */
function gallery() { return Array.isArray(global.TESTLAB_EXAMPLES) ? global.TESTLAB_EXAMPLES : []; }
function exampleById(id) {
  return gallery().filter(function (ex) { return ex && ex.id === id; })[0] || null;
}

/* the zip/scaffold core, loaded read-only. Absent if projzip-core.js did not
   load (e.g. a changed script order): the export button hides itself rather
   than crash, per spec 13's graceful-fallback requirement. */
function projzip() { return global.PROJZIP || null; }
function hasExport() {
  const Z = projzip();
  return !!(Z && typeof Z.xunitProject === "function" && typeof Z.makeZipBlobUrl === "function");
}

/* sanitize a project name for the file-name part of the download */
function exportNameFor() {
  ensureState();
  const Z = projzip();
  const raw = (state.exportName && state.exportName.trim()) || "ExamApp.Tests";
  return Z && typeof Z.sanitizeName === "function" ? Z.sanitizeName(raw, "ExamApp.Tests") : raw;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* escape for use inside an inline 'onclick="TL.x(\'...\')"' JS string */
function jsq(s) {
  return esc(String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
}

/* use the app's highlighter when present (browser); plain esc under Node */
function hiCS(code) {
  if (typeof global.highlight === "function") return global.highlight(code, "csharp");
  return esc(code);
}

function byId(id) { return document.getElementById(id); }
function paint(id, html) { const el = byId(id); if (el) el.innerHTML = html; }
function setStatus(msg) { const el = byId("tl-status"); if (el) el.textContent = msg; }

/* ---------------- persistence (localStorage, try/catch) ---------------- */
function defaultOptions() {
  /* Per-function P/N/E is the default mode; the old per-class modes stay
     available but start off so the two never produce duplicate Tests.cs. */
  return { perFunction: true, plain: false, viewModel: false, headless: true, async: true, csproj: true };
}

function defaultState() {
  return {
    files: [{ name: "Code.cs", text: "" }],
    active: 0,
    options: defaultOptions(),
    /* function picker selection, keyed by "Class.Method" -> bool.
       Absent key means selected (all-on by default). */
    selection: {},
    /* default project name for the .zip export (spec 13) */
    exportName: "ExamApp.Tests",
  };
}

/* Version-stamped load (spec 14): unknown / unversioned / corrupt shapes fall
   back to defaults instead of throwing. Any payload whose `v` we don't
   recognise is treated as legacy and re-read field-by-field defensively, so a
   future bump never wipes the user's pasted code without a chance to migrate. */
function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.files)) return defaultState();
    /* unknown future version: keep what we can read, drop the rest */
    const files = raw.files.filter(function (f) {
      return f && typeof f.name === "string" && typeof f.text === "string";
    });
    if (!files.length) return defaultState();
    const opts = defaultOptions();
    if (raw.options && typeof raw.options === "object") {
      Object.keys(opts).forEach(function (k) {
        if (typeof raw.options[k] === "boolean") opts[k] = raw.options[k];
      });
    }
    /* selection: keep only boolean entries keyed by "Class.Method" */
    const sel = {};
    if (raw.selection && typeof raw.selection === "object") {
      Object.keys(raw.selection).forEach(function (k) {
        if (typeof raw.selection[k] === "boolean") sel[k] = raw.selection[k];
      });
    }
    return {
      files: files,
      active: Math.min(Math.max(0, raw.active | 0), files.length - 1),
      options: opts,
      selection: sel,
      exportName: typeof raw.exportName === "string" && raw.exportName.trim()
        ? raw.exportName : "ExamApp.Tests",
    };
  } catch (e) { return defaultState(); }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: STORE_VERSION,
      files: state.files, active: state.active, options: state.options,
      selection: state.selection || {},
      exportName: state.exportName || "ExamApp.Tests",
    }));
  } catch (e) {}
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 300);
}

function ensureState() { if (!state) state = loadState(); }

/* ---------------- left pane: tabs + editor ---------------- */
function tabsHTML() {
  let h = "";
  state.files.forEach(function (f, i) {
    h += '<div class="tl-tab' + (i === state.active ? " active" : "") + '" onclick="TL.activate(' + i + ')">' +
      '<input class="tl-tab-name" value="' + esc(f.name) + '" spellcheck="false"' +
      ' onchange="TL.rename(' + i + ', this.value)">' +
      '<button class="tl-tab-x" title="remove file" onclick="event.stopPropagation();TL.removeFile(' + i + ')">&#10005;</button>' +
      "</div>";
  });
  h += '<button class="tl-tab-add" onclick="TL.addFile()">+ add file</button>';
  return h;
}

function editorHTML() {
  const f = state.files[state.active] || { name: "", text: "" };
  const mode = viewModes[state.active] === "view" ? "view" : "edit";
  let h = '<div class="tl-ed-head">' +
    '<span class="tl-ed-name">' + esc(f.name) + '</span>' +
    '<span class="tl-ed-mode">' + (mode === "edit" ? "editing" : "read-only · line view") + "</span>" +
    '<button class="copybtn" onclick="TL.toggleView()">' + (mode === "edit" ? "view" : "edit") + "</button>" +
    "</div>";
  if (mode === "edit") {
    h += '<textarea class="tl-src" id="tl-ta" spellcheck="false"' +
      ' placeholder="// paste a C# class or ViewModel here — more files via + add file"' +
      ' oninput="TL.edit(this.value)">' + esc(f.text) + "</textarea>";
  } else {
    const lines = String(f.text).split("\n");
    h += '<pre class="tl-view" id="tl-view">';
    for (let i = 0; i < lines.length; i++) {
      h += '<div class="tl-ln">' +
        '<span class="tl-no">' + (i + 1) + "</span>" +
        '<span class="tl-lc">' + (lines[i] === "" ? "&nbsp;" : hiCS(lines[i])) + "</span>" +
        "</div>";
    }
    h += "</pre>";
  }
  return h;
}

/* ---------------- right pane: mode toggles + output ---------------- */
function modesHTML() {
  let h = '<div class="tl-modes">';
  MODE_DEFS.forEach(function (md) {
    const on = !!state.options[md.key];
    h += '<label class="tl-mode' + (on ? " on" : "") + '">' +
      '<input type="checkbox"' + (on ? " checked" : "") +
      ' onchange="TL.setMode(\'' + md.key + '\', this.checked)">' +
      "<span>" + esc(md.label) + "</span></label>";
  });
  h += "</div>";
  return h;
}

/* ---------------- right pane: function picker ---------------- */
/* True when key is currently selected (absent = on by default). */
function funcSelected(key) {
  const sel = state.selection || {};
  if (!Object.prototype.hasOwnProperty.call(sel, key)) return true;
  return sel[key] !== false;
}

/* The picker only matters when Per-function P/N/E is the active mode and a
   model has been parsed. Groups functions by class with an amber header and a
   compact mono checkbox row per function. */
function pickerHTML() {
  if (!state.options.perFunction) return "";
  const C = core();
  if (!C || !lastModel) return "";
  const fns = C.listAllFunctions(lastModel);
  if (!fns.length) return "";

  /* group by class, preserving first-seen order */
  const groups = [];
  const byClass = {};
  fns.forEach(function (fn) {
    if (!byClass[fn.className]) { byClass[fn.className] = { name: fn.className, items: [] }; groups.push(byClass[fn.className]); }
    byClass[fn.className].items.push(fn);
  });

  const total = fns.length;
  let onCount = 0;
  fns.forEach(function (fn) { if (funcSelected(fn.key)) onCount++; });

  let h = '<div class="tl-picker" id="tl-picker">';
  h += '<div class="tl-picker-head">';
  h += '<span class="tl-picker-title">Functions to test</span>';
  h += '<span class="tl-picker-count">' + onCount + " / " + total + " selected</span>";
  h += '<button class="tl-picker-act" onclick="TL.allFuncs(true)">all</button>';
  h += '<button class="tl-picker-act" onclick="TL.allFuncs(false)">none</button>';
  h += "</div>";
  groups.forEach(function (g) {
    h += '<div class="tl-picker-group">';
    h += '<div class="tl-picker-cls">' + esc(g.name) + "</div>";
    g.items.forEach(function (fn) {
      const on = funcSelected(fn.key);
      h += '<label class="tl-fn' + (on ? " on" : "") + '" title="' + esc(fn.key) + '">' +
        '<input type="checkbox"' + (on ? " checked" : "") +
        ' onchange="TL.setFunc(\'' + jsq(fn.key) + '\', this.checked)">' +
        '<span class="tl-fn-kind tl-fn-' + (fn.isCommand ? "cmd" : "method") + '">' + (fn.isCommand ? "cmd" : "fn") + "</span>" +
        '<span class="tl-fn-sig">' + esc(fn.signature) + "</span>" +
        "</label>";
    });
    h += "</div>";
  });
  h += "</div>";
  return h;
}

/* ---------------- right pane: project export (spec 13) ---------------- */
/* The export row: a project-name input + a green "Export project (.zip)"
   button. It renders only when the zip core is present (graceful fallback when
   PROJZIP did not load) and there is generated output to package. The headless
   packages + TestAppBuilder are included iff the Headless mode toggle is on. */
function exportHTML() {
  if (!hasExport()) return "";                 /* core missing -> hide entirely */
  if (!lastFiles || !lastFiles.length) return ""; /* nothing generated to package */
  const name = esc((state && state.exportName) || "ExamApp.Tests");
  const headless = !!(state && state.options && state.options.headless);
  let h = '<div class="tl-export" id="tl-export-inner">';
  h += '<div class="tl-export-row">';
  h += '<span class="tl-export-lbl">Project</span>';
  h += '<input class="tl-export-name" id="tl-export-name" spellcheck="false" value="' + name +
    '" oninput="TL.setExportName(this.value)" title="name for the exported test project">';
  h += '<button class="tl-export-btn" id="tl-export-btn" onclick="TL.exportProject(this)">' +
    'Export project (.zip)</button>';
  h += "</div>";
  h += '<div class="tl-export-hint">Downloads a standalone xUnit project: your pasted code under <b>Source/</b>, the generated tests under <b>Tests/</b>, and the exact-version <b>' +
    esc(exportNameFor()) + '.csproj</b>' +
    (headless ? ' with the Avalonia headless packages + TestAppBuilder' : '') +
    '. Unzip, then <b>dotnet test</b>.</div>';
  h += '<div class="tl-export-status" id="tl-export-status"></div>';
  h += "</div>";
  return h;
}

function summaryHTML() {
  if (!lastModel) return "";
  const classes = (lastModel.classes || []).filter(function (c) { return c.kind !== "interface"; });
  const vmCount = classes.filter(function (c) { return c.isToolkitViewModel; }).length;
  const ifaceCount = (lastModel.interfaces || []).length;
  const fileCount = lastFiles ? lastFiles.length : 0;
  let h = '<div class="tl-summary">';
  h += '<span class="tl-summary-n">' + classes.length + " class" + (classes.length === 1 ? "" : "es") + "</span>";
  if (vmCount) h += '<span class="tl-chip">' + vmCount + " toolkit VM" + (vmCount === 1 ? "" : "s") + "</span>";
  if (ifaceCount) h += '<span class="tl-chip">' + ifaceCount + " interface" + (ifaceCount === 1 ? "" : "s") + "</span>";
  h += '<span class="tl-chip">' + fileCount + " test file" + (fileCount === 1 ? "" : "s") + " generated</span>";
  h += "</div>";
  return h;
}

/* a row of "copy <fn>" chips for each selected function in a per-function file */
function perFuncCopyHTML(className) {
  const C = core();
  if (!C || !lastModel) return "";
  const fns = C.listAllFunctions(lastModel).filter(function (fn) {
    return fn.className === className && funcSelected(fn.key);
  });
  if (!fns.length) return "";
  let h = '<div class="tl-fncopy"><span class="tl-fncopy-lbl">copy one trio:</span>';
  fns.forEach(function (fn) {
    h += '<button class="tl-fncopy-btn" onclick="TL.copyFunc(this,\'' + jsq(className) + '\',\'' + jsq(fn.name) + '\')">' +
      esc(fn.name) + "</button>";
  });
  h += "</div>";
  return h;
}

function outputHTML() {
  /* parse/generation failure: a styled red panel with a mono excerpt, never a
     blank pane or a thrown exception (spec 14, item 4). */
  if (lastError) {
    let h = '<div class="tl-error">';
    h += '<div class="tl-error-head">Could not generate tests</div>';
    h += '<div class="tl-error-msg">' + esc(lastError.message) + "</div>";
    if (lastError.excerpt) {
      h += '<pre class="tl-error-pre">' + esc(lastError.excerpt) + "</pre>";
    }
    h += '<div class="tl-error-hint">Check that the pasted text is a complete C# class or ViewModel with its <b>class</b> / <b>partial class</b> declaration, then press Generate again.</div>';
    h += "</div>";
    return h;
  }
  if (!lastFiles) {
    let h = '<div class="tl-empty">';
    h += '<div class="tl-empty-title">Start here</div>';
    h += '<ol class="tl-empty-steps">';
    h += "<li>paste your C# class or ViewModel on the left (or press <b>Load example</b>)</li>";
    h += "<li>pick the test kinds and tick the functions you care about</li>";
    h += "<li>press <b>Generate</b>, then <b>copy</b> a file or <b>Export project (.zip)</b></li>";
    h += "</ol>";
    h += '<div class="tl-empty-foot">Real asserts are filled in where derivable; everything else is a marked <span class="tl-todo">TODO</span> for your judgement.</div>';
    h += "</div>";
    return h;
  }
  if (!lastFiles.length) {
    return '<div class="tl-empty">No classes detected. Paste a full C# class or ViewModel (with its <b>class</b> / <b>partial class</b> declaration) and try again.</div>';
  }
  let h = teachHTML();
  h += summaryHTML();
  h += '<div class="tl-bar"><button class="copybtn" onclick="TL.copyAll(this)">copy all</button></div>';
  /* collapsible cards once there are more than 2 files (spec 14, item 5) */
  const collapsible = lastFiles.length > 2;
  lastFiles.forEach(function (file, i) {
    const lang = /\.csproj$/.test(file.fileName) ? "xml"
      : /\.txt$/.test(file.fileName) ? "bash" : "csharp";
    const isCollapsed = collapsible && collapsed[file.fileName] === true;
    h += '<div class="tl-card' + (isCollapsed ? " collapsed" : "") + '">';
    h += '<div class="tl-card-head">';
    if (collapsible) {
      h += '<button class="tl-collapse" title="' + (isCollapsed ? "expand" : "collapse") +
        '" onclick="TL.toggleCard(\'' + jsq(file.fileName) + '\')">' + (isCollapsed ? "▸" : "▾") + "</button>";
    }
    h += '<span class="tl-file">' + esc(file.fileName) + "</span>";
    h += '<button class="copybtn" onclick="TL.copyOne(this,' + i + ')">copy</button>';
    h += "</div>";
    if (!isCollapsed) {
      /* per-function copy strip for Per-function P/N/E files */
      if (file.perFunction && file.className) {
        h += perFuncCopyHTML(file.className);
      }
      h += '<pre class="tl-code">' + hiFile(file.code, lang) + "</pre>";
    }
    h += "</div>";
  });
  return h;
}

/* highlight a generated file by its language, falling back to esc under Node */
function hiFile(code, lang) {
  if (typeof global.highlight === "function") return global.highlight(code, lang);
  return esc(code);
}

/* ---------------- worked-examples gallery ---------------- */
/* A strip of one-click examples. Each loads a realistic C# input and shows a
   plain-language note on how its tests were generated, so the reader can watch
   the Positive / Negative / Edge mapping happen instead of guessing at it. */
function galleryHTML() {
  const exs = gallery();
  if (!exs.length) return "";
  let h = '<div class="tl-gallery" id="tl-gallery">';
  h += '<div class="tl-gallery-head">' +
    '<span class="tl-gallery-title">Worked examples</span>' +
    '<span class="tl-gallery-sub">load one to see how its tests are generated</span></div>';
  h += '<div class="tl-gallery-row">';
  exs.forEach(function (ex) {
    const on = lastExampleId === ex.id;
    h += '<button class="tl-ex' + (on ? " on" : "") + '" onclick="TL.loadGallery(\'' + jsq(ex.id) + '\')" title="' + esc(ex.summary || "") + '">' +
      '<span class="tl-ex-title">' + esc(ex.title || ex.name || ex.id) + "</span>" +
      '<span class="tl-ex-sum">' + esc(ex.summary || "") + "</span>" +
      "</button>";
  });
  h += "</div></div>";
  return h;
}

/* The teaching panel shown above generated output once a worked example is
   loaded: a numbered list of why-this-test notes plus a one-time legend of the
   Arrange/Act/Assert and Positive/Negative/Edge conventions. */
function teachHTML() {
  if (!lastExampleId) return "";
  const ex = exampleById(lastExampleId);
  if (!ex || !Array.isArray(ex.notes) || !ex.notes.length) return "";
  let h = '<div class="tl-teach" id="tl-teach">';
  h += '<div class="tl-teach-head">How these tests are generated · <b>' + esc(ex.title || ex.name) + "</b></div>";
  h += '<ol class="tl-teach-notes">';
  ex.notes.forEach(function (n) { h += "<li>" + esc(n) + "</li>"; });
  h += "</ol>";
  h += '<div class="tl-teach-legend">' +
    '<span class="tl-teach-key"><b>Arrange / Act / Assert</b> set up the object, call the method, then check the outcome.</span>' +
    '<span class="tl-teach-key"><b>Positive</b> a valid call works · <b>Negative</b> a bad call is rejected · <b>Edge</b> the boundary values hold.</span>' +
    "</div>";
  h += "</div>";
  return h;
}

/* ---------------- page ---------------- */
function render() {
  ensureState();
  let h = '<div class="content-inner content-wide">';
  h += '<div class="crumb"><b>TEST LAB</b></div>';
  h += '<h1 class="topic-title">Test Lab</h1>';
  h += '<p class="bp">Paste the Problem 3 class or ViewModel and generate ready-to-paste xUnit files. The default <b>Per-function P/N/E</b> mode lists every method and command it finds: tick the ones you care about and it emits a labeled <b>Positive / Negative / Edge</b> trio for each. The other modes (plain unit tests, ViewModel command tests, headless Avalonia scaffold, timing-tolerant async patterns, the exact-version csproj and an offline runbook) stay available. Real asserts are filled in where derivable; everything else is a marked TODO.</p>';
  h += '<p class="bp">New to writing tests? Load a <b>worked example</b> below: it fills the editor with real C#, generates its tests, and explains line by line how each method turned into a Positive / Negative / Edge case.</p>';
  h += '<div class="tl-gallery-wrap" id="tl-gallery-wrap">' + galleryHTML() + "</div>";
  h += '<div class="tl">';
  h += '<div class="tl-left">';
  h += '<div class="tl-tabs" id="tl-tabs">' + tabsHTML() + "</div>";
  h += '<div class="tl-editor" id="tl-editor">' + editorHTML() + "</div>";
  h += '<div class="tl-actions">' +
    '<button class="tl-gen" onclick="TL.generate()">Generate</button>' +
    '<button class="copybtn" onclick="TL.loadExample()">Load example</button>' +
    '<span class="tl-status" id="tl-status"></span></div>';
  h += "</div>";
  h += '<div class="tl-right">';
  h += '<div class="tl-modes-wrap" id="tl-modes">' + modesHTML() + "</div>";
  h += '<div class="tl-picker-wrap" id="tl-picker-wrap">' + pickerHTML() + "</div>";
  h += '<div class="tl-export-wrap" id="tl-export-wrap">' + exportHTML() + "</div>";
  h += '<div class="tl-output" id="tl-output">' + outputHTML() + "</div>";
  h += "</div>";
  h += "</div></div>";
  return h;
}

function init() {
  ensureState();
  /* regenerate on revisit if there is pasted code */
  if (!lastFiles && state.files.some(function (f) { return f.text && f.text.trim(); })) {
    doGenerate(true);
  }
}

/* ---------------- repaint helpers ---------------- */
function paintTabs() { paint("tl-tabs", tabsHTML()); }
function paintEditor() { paint("tl-editor", editorHTML()); }
function paintModes() { paint("tl-modes", modesHTML()); }
function paintPicker() { paint("tl-picker-wrap", pickerHTML()); }
function paintExport() { paint("tl-export-wrap", exportHTML()); }
function paintOutput() { paint("tl-output", outputHTML()); }
function paintGallery() { paint("tl-gallery-wrap", galleryHTML()); }

/* ---------------- actions (window.TL) ---------------- */
function doGenerate(silent) {
  ensureState();
  const C = core();
  if (!C) { setStatus("test-lab core not loaded"); return; }
  const nonEmpty = state.files.filter(function (f) { return f.text && f.text.trim(); });
  if (!nonEmpty.length) { if (!silent) setStatus("paste some code first"); lastFiles = null; lastModel = null; lastError = null; paintOutput(); paintExport(); return; }
  try {
    lastModel = C.parse(state.files);
    pruneSelection();
    const opts = Object.assign({}, state.options, { selection: state.selection || {} });
    lastFiles = C.generate(lastModel, opts);
    lastError = null;
  } catch (e) {
    /* never blank the pane or throw to the page: surface a styled error panel
       (spec 14, item 4). The active file's first lines give a useful excerpt. */
    lastModel = { classes: [], interfaces: [] };
    lastFiles = [];
    const active = state.files[state.active] || nonEmpty[0] || { text: "" };
    lastError = {
      message: (e && e.message) ? String(e.message) : "could not parse the pasted code",
      excerpt: String(active.text || "").split("\n").slice(0, 6).join("\n"),
    };
  }
  paintPicker();
  paintOutput();
  paintExport();
  if (!silent) {
    const n = lastFiles.length;
    setStatus(n + " file" + (n === 1 ? "" : "s") + " generated from " +
      nonEmpty.length + " source file" + (nonEmpty.length === 1 ? "" : "s"));
  }
}

function scheduleGenerate() {
  clearTimeout(genTimer);
  genTimer = setTimeout(function () { if (lastFiles) doGenerate(true); }, 450);
}

function addFile() {
  ensureState();
  state.files.push({ name: "File" + (state.files.length + 1) + ".cs", text: "" });
  state.active = state.files.length - 1;
  viewModes[state.active] = "edit";
  saveState();
  paintTabs(); paintEditor();
  setTimeout(function () { const ta = byId("tl-ta"); if (ta) ta.focus(); }, 0);
}

function removeFile(i) {
  ensureState();
  state.files.splice(i, 1);
  if (!state.files.length) state.files.push({ name: "Code.cs", text: "" });
  state.active = Math.min(state.active, state.files.length - 1);
  viewModes = {};
  saveState();
  paintTabs(); paintEditor();
  if (lastFiles) doGenerate(true);
}

function rename(i, value) {
  ensureState();
  const v = String(value || "").trim();
  if (!v || !state.files[i]) { paintTabs(); return; }
  state.files[i].name = v;
  saveState();
  paintTabs(); paintEditor();
}

function activate(i) {
  ensureState();
  if (i === state.active || !state.files[i]) return;
  state.active = i;
  saveState();
  paintTabs(); paintEditor();
}

function edit(value) {
  ensureState();
  if (!state.files[state.active]) return;
  state.files[state.active].text = value;
  /* once the reader hand-edits, the loaded example no longer matches the
     source, so drop the teaching note (repaint the gallery to clear its
     highlight only on the edit that first detaches it). */
  if (lastExampleId !== null) { lastExampleId = null; paintGallery(); }
  scheduleSave();
  scheduleGenerate();
}

function toggleView() {
  ensureState();
  viewModes[state.active] = viewModes[state.active] === "view" ? "edit" : "view";
  paintEditor();
}

function loadExample() {
  ensureState();
  const allEmpty = state.files.every(function (f) { return !f.text || !f.text.trim(); });
  if (allEmpty) state.files = [{ name: EXAMPLE_NAME, text: EXAMPLE }];
  else state.files.push({ name: EXAMPLE_NAME, text: EXAMPLE });
  state.active = state.files.length - 1;
  viewModes = {};
  lastExampleId = null;
  saveState();
  paintTabs(); paintEditor(); paintGallery();
  doGenerate(false);
}

/* Load a worked example from the gallery: replace the editor with its single
   source file, remember which example it is (so the teaching note shows), then
   generate so the reader sees the source and its tests together. */
function loadGallery(id) {
  ensureState();
  const ex = exampleById(id);
  if (!ex) return;
  state.files = [{ name: ex.name || (ex.id + ".cs"), text: ex.source || "" }];
  state.active = 0;
  state.selection = {};        /* every function on, so the trio is complete */
  viewModes = {};
  lastExampleId = ex.id;
  saveState();
  paintTabs(); paintEditor(); paintGallery();
  doGenerate(false);
  setStatus("loaded example: " + (ex.title || ex.name || ex.id));
}

function setMode(key, on) {
  ensureState();
  state.options[key] = !!on;
  saveState();
  paintModes();
  paintPicker();
  if (lastFiles) doGenerate(true);
}

/* drop selection keys for functions that are no longer in the parsed model,
   so the persisted store does not grow unbounded across pastes. */
function pruneSelection() {
  const C = core();
  if (!C || !lastModel || !state.selection) return;
  const live = {};
  C.listAllFunctions(lastModel).forEach(function (fn) { live[fn.key] = true; });
  Object.keys(state.selection).forEach(function (k) {
    if (!live[k]) delete state.selection[k];
  });
}

/* toggle a single function in the picker, persist, regenerate */
function setFunc(key, on) {
  ensureState();
  if (!state.selection) state.selection = {};
  if (on) delete state.selection[key];   /* selected = absent (the default) */
  else state.selection[key] = false;
  saveState();
  paintPicker();
  if (lastFiles) doGenerate(true);
}

/* select all / none in the picker (relative to the current parsed model) */
function allFuncs(on) {
  ensureState();
  const C = core();
  if (!C || !lastModel) return;
  if (!state.selection) state.selection = {};
  C.listAllFunctions(lastModel).forEach(function (fn) {
    if (on) delete state.selection[fn.key];
    else state.selection[fn.key] = false;
  });
  saveState();
  paintPicker();
  if (lastFiles) doGenerate(true);
}

/* ---------------- project export (spec 13) ---------------- */
function setExportName(value) {
  ensureState();
  state.exportName = String(value == null ? "" : value);
  scheduleSave();
  /* don't repaint the input mid-typing (would lose the caret); only the hint
     label is stale, which refreshes on the next generate/paint. */
}

function setExportStatus(msg, kind) {
  const el = byId("tl-export-status");
  if (!el) return;
  el.textContent = msg || "";
  el.className = "tl-export-status" + (kind ? " " + kind : "");
}

/* Build the standalone xUnit project zip from the current model + pasted
   sources + generated files, then trigger a browser download. All failure
   paths surface a styled status line instead of throwing. */
function exportProject(btn) {
  ensureState();
  const C = core();
  const Z = projzip();
  if (!C || !Z || !hasExport()) { setExportStatus("project export is unavailable (zip core not loaded)", "err"); return; }
  if (!lastModel || !lastFiles) { setExportStatus("press Generate first", "err"); return; }

  let built;
  try {
    const opts = Object.assign({}, state.options, { selection: state.selection || {} });
    built = C.buildExport(lastModel, lastFiles, opts, state.files);
  } catch (e) {
    setExportStatus("export failed: " + ((e && e.message) || "could not assemble the project"), "err");
    return;
  }
  if (!built || !built.ok) {
    setExportStatus(built && built.reason ? built.reason : "nothing to export yet", "err");
    return;
  }

  const projName = exportNameFor();
  let url;
  try {
    const entries = Z.xunitProject(projName, built.args);
    url = Z.makeZipBlobUrl(entries);
  } catch (e) {
    setExportStatus("export failed: " + ((e && e.message) || "could not build the .zip"), "err");
    return;
  }

  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = projName + ".zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    /* release the object URL on the next tick so the download can start */
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000);
  } catch (e) {
    setExportStatus("export failed: " + ((e && e.message) || "could not start the download"), "err");
    return;
  }

  const tn = built.args.testFiles.length;
  setExportStatus("downloaded " + projName + ".zip — " + built.args.sourceFiles.length +
    " source file" + (built.args.sourceFiles.length === 1 ? "" : "s") + ", " +
    tn + " test file" + (tn === 1 ? "" : "s") +
    (built.args.headless ? ", headless" : "") + ". Unzip then: dotnet test", "ok");
  if (btn) {
    const orig = btn.getAttribute("data-orig") || btn.textContent;
    btn.setAttribute("data-orig", orig);
    btn.textContent = "exported ✓";
    btn.classList.add("done");
    setTimeout(function () { btn.textContent = orig; btn.classList.remove("done"); }, 1800);
  }
}

/* collapse / expand one generated file's card (spec 14, item 5) */
function toggleCard(fileName) {
  collapsed[fileName] = !collapsed[fileName];
  paintOutput();
}

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

/* copy just one function's Positive/Negative/Edge trio */
function copyFunc(btn, className, methodName) {
  const C = core();
  if (!C || !lastModel) return;
  const trio = C.genFunctionTrio(lastModel, className, methodName);
  if (!trio) return;
  copyText(trio, btn);
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

/* ---------------- export ---------------- */
const TL = {
  generate: function () { doGenerate(false); },
  addFile: addFile,
  removeFile: removeFile,
  rename: rename,
  activate: activate,
  edit: edit,
  toggleView: toggleView,
  loadExample: loadExample,
  loadGallery: loadGallery,
  setMode: setMode,
  setFunc: setFunc,
  allFuncs: allFuncs,
  copyOne: copyOne,
  copyAll: copyAll,
  copyFunc: copyFunc,
  toggleCard: toggleCard,
  setExportName: setExportName,
  exportProject: exportProject,
};

const TESTLAB = { render: render, init: init, outputHTML: outputHTML };

global.TESTLAB = TESTLAB;
global.TL = TL;
if (typeof module !== "undefined" && module.exports) module.exports = TESTLAB;
})(typeof window !== "undefined" ? window : globalThis);
