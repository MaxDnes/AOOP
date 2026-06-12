/* ============================================================
   ANALYSIS LAB · UI for the OOP/SOLID scanner (Problem 1 solver)
   window.ANALYZER = { render, init, findingCard, presenceCard, templateCard }
   All event handlers live on window.ANZ.
   Pure string rendering; DOM access happens only inside functions
   so the module loads under Node for tests. Logic lives in
   data/analyzer-core.js (window.ANALYZER_CORE); the real 2025 exam
   codebases + answer keys live in data/exam-fixtures.js
   (window.EXAM_FIXTURES).
   ============================================================ */

(function (global) {
"use strict";

const STORE_KEY = "aop-analyzer-state";
const PRINCIPLE_ORDER = ["SRP", "OCP", "LSP", "ISP", "DIP", "ENC", "POLY"];
/* POLY folded into the theory chip row so its theory is reachable */
const THEORY_CHIPS = ["SRP", "OCP", "LSP", "ISP", "DIP", "ENC", "POLY"];
/* the 6 coverage chips the rubric maps to (one SOLID each + encapsulation) */
const COVERAGE_CHIPS = ["SRP", "OCP", "LSP", "ISP", "DIP", "ENC"];
const PRINCIPLE_COLORS = {
  SRP: "#7fd962", OCP: "#e6b450", LSP: "#f07178",
  ISP: "#39bae6", DIP: "#d2a6ff", ENC: "#f28fad", POLY: "#b8cfe6",
};

/* per-principle hunt checklist: patterns to look for and what they imply */
const HUNT_CHECKLIST = [
  { p: "SRP", tokens: ["Console.", "File.", "StreamWriter"], implies: "I/O or presentation inside a domain class — a second reason to change." },
  { p: "OCP", tokens: ["switch", "is ", "OfType<", "List<object>"], implies: "type-branching or object collections — new types force edits here, not extension." },
  { p: "LSP", tokens: ["as ", "(Type)", "is Type x", "new "], implies: "downcasts / member hiding — code that works for one concrete type, not the abstraction." },
  { p: "ISP", tokens: ["throw new Not", "interface "], implies: "throwing stubs or fat/marker interfaces — implementers forced into members they can't honour." },
  { p: "DIP", tokens: ["new ", "static", "private readonly"], implies: "concrete construction, global state, or a dead injected dependency." },
  { p: "ENC", tokens: ["public ", "public field;"], implies: "public mutable fields — state any caller can corrupt; should be a property." },
];

/* small built-in demo: exactly 3 planted violations
   (public field -> ENC, NotImplementedException stub -> LSP,
   'as EmailNotifier' downcast -> DIP (LSP secondary)) */
const DEMO_NAME = "Example.cs";
const DEMO = [
  "using System;",
  "",
  "namespace Demo",
  "{",
  "    public interface INotifier",
  "    {",
  "        void Notify(string message);",
  "    }",
  "",
  "    public class EmailNotifier : INotifier",
  "    {",
  "        public void Notify(string message) { /* send mail */ }",
  "    }",
  "",
  "    public class SmsNotifier : INotifier",
  "    {",
  "        public void Notify(string message)",
  "        {",
  "            throw new NotImplementedException();   // planted: throwing stub",
  "        }",
  "    }",
  "",
  "    public class OrderService",
  "    {",
  "        public int Total;                          // planted: public mutable field",
  "",
  "        private readonly INotifier _notifier;",
  "",
  "        public OrderService(INotifier notifier)",
  "        {",
  "            _notifier = notifier;",
  "        }",
  "",
  "        public void Checkout()",
  "        {",
  "            var email = _notifier as EmailNotifier; // planted: downcast of abstraction",
  "            email.Notify(\"Order placed, total \" + Total);",
  "        }",
  "    }",
  "}",
].join("\n");

/* ---------------- module state ---------------- */
let state = null;        // { files, active, checked, openPrinciple, tab, answerKey }
let lastScan = null;     // { findings, index } from ANALYZER_CORE.scan
let viewModes = {};      // file index -> "edit" | "view"
let saveTimer = null;
let draftText = "";      // current draft text (Draft tab textarea), survives tab switches
let banner = true;       // reword banner dismissible

/* ---------------- helpers ---------------- */
function core() { return global.ANALYZER_CORE; }
function fixtures() { return global.EXAM_FIXTURES || null; }

/* projzip-core.js (window.PROJZIP) is loaded read-only, purely as an optional
   export helper: when it is present the Analysis Lab can hand the pasted P1
   codebase back as a runnable .NET console project (.zip) so Max can confirm
   his SOLID analysis compiles. It is NOT wired into index.html by this agent,
   so the download button MUST degrade gracefully: it is only rendered when
   window.PROJZIP exposes the API we need, and the handler re-checks before
   touching anything. Nothing here mutates PROJZIP. */
function projzip() {
  const Z = global.PROJZIP;
  if (Z && typeof Z.consoleProject === "function" && typeof Z.makeZipBlobUrl === "function") return Z;
  return null;
}

/* true only when the export button should appear: PROJZIP is available AND
   there is at least one non-empty pasted file to package. */
function canExportZip() {
  if (!projzip()) return false;
  return !!(state && state.files && state.files.some(function (f) { return f.text && f.text.trim(); }));
}

/* build the project name from the first non-empty file (or a sane default) */
function exportProjectName() {
  const f = (state && state.files || []).filter(function (x) { return x.text && x.text.trim(); })[0];
  const base = f && f.name ? f.name.replace(/\.[^.]+$/, "") : "ExamProject";
  return base || "ExamProject";
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* escape a value for use inside an inline 'onclick="ANZ.x(\'...\')"' JS string */
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
function setStatus(msg) { const el = byId("anz-status"); if (el) el.textContent = msg; }

function findingKey(f) { return f.ruleId + "|" + f.file + "|" + f.line; }
function isPresence(f) { return f && f.kind === "presence"; }

/* current mode, falling back to "full" before state exists */
function curMode() { return state ? normalizeMode(state.mode) : "full"; }

/* findings the active mode renders: violations -> violation cards only,
   implementations -> presence cards only, full -> everything. The same list
   drives the results pane, the coverage strip, select-all and the draft, so
   the screen and the assembled answer never disagree. */
function modeFindings() {
  if (!lastScan) return [];
  const C = core();
  if (C && typeof C.filterByMode === "function") return C.filterByMode(lastScan.findings, curMode());
  /* defensive fallback if the core is older than this UI */
  const m = curMode();
  if (m === "violations") return lastScan.findings.filter(function (f) { return !isPresence(f); });
  if (m === "implementations") return lastScan.findings.filter(isPresence);
  return lastScan.findings.slice();
}

/* mode findings narrowed to the focused principle (per-principle deep dive),
   or all mode findings when no principle is pinned */
function visibleFindings() {
  const list = modeFindings();
  if (state && state.focusPrinciple) {
    return list.filter(function (f) { return f.principle === state.focusPrinciple; });
  }
  return list;
}

/* the three explicit analysis modes (spec 08). Default is the full exam
   answer so old behaviour is preserved for anyone with no persisted mode. */
const MODES = ["full", "violations", "implementations"];
const MODE_LABELS = { full: "Full exam answer", violations: "Violations", implementations: "Implementations" };
function normalizeMode(m) { return MODES.indexOf(m) !== -1 ? m : "full"; }

/* ---------------- persistence (localStorage, try/catch) ---------------- */
function defaultState() {
  return { files: [{ name: "Program.cs", text: "" }], active: 0, checked: {}, openPrinciple: null, tab: "findings", answerKey: null, mode: "full", focusPrinciple: null };
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (!raw || !Array.isArray(raw.files)) return defaultState();
    const files = raw.files.filter(function (f) {
      return f && typeof f.name === "string" && typeof f.text === "string";
    });
    if (!files.length) return defaultState();
    return {
      files: files,
      active: Math.min(Math.max(0, raw.active | 0), files.length - 1),
      checked: (raw.checked && typeof raw.checked === "object") ? raw.checked : {},
      openPrinciple: null,
      tab: (raw.tab === "templates" || raw.tab === "draft") ? raw.tab : "findings",
      answerKey: (raw.answerKey && typeof raw.answerKey === "object") ? raw.answerKey : null,
      mode: normalizeMode(raw.mode),
      focusPrinciple: null,
    };
  } catch (e) { return defaultState(); }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      files: state.files, active: state.active, checked: state.checked,
      tab: state.tab, answerKey: state.answerKey, mode: state.mode,
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
    h += '<div class="anz-tab' + (i === state.active ? " active" : "") + '" onclick="ANZ.activate(' + i + ')">' +
      '<input class="anz-tab-name" value="' + esc(f.name) + '" spellcheck="false"' +
      ' onchange="ANZ.rename(' + i + ', this.value)">' +
      '<button class="anz-tab-x" title="remove file" onclick="event.stopPropagation();ANZ.removeFile(' + i + ')">✕</button>' +
      "</div>";
  });
  h += '<button class="anz-tab-add" onclick="ANZ.addFile()">+ add file</button>';
  return h;
}

function editorHTML() {
  const f = state.files[state.active] || { name: "", text: "" };
  const mode = viewModes[state.active] === "view" ? "view" : "edit";
  let h = '<div class="anz-ed-head">' +
    '<span class="anz-ed-name">' + esc(f.name) + '</span>' +
    '<span class="anz-ed-mode">' + (mode === "edit" ? "editing" : "read-only · line view") + "</span>" +
    '<button class="copybtn" onclick="ANZ.toggleView()">' + (mode === "edit" ? "view" : "edit") + "</button>" +
    "</div>";
  if (mode === "edit") {
    h += '<textarea class="anz-src" id="anz-ta" spellcheck="false"' +
      ' placeholder="// paste one .cs file here — more files via + add file"' +
      ' oninput="ANZ.edit(this.value)">' + esc(f.text) + "</textarea>";
  } else {
    const lines = String(f.text).split("\n");
    h += '<pre class="anz-view" id="anz-view">';
    for (let i = 0; i < lines.length; i++) {
      h += '<div class="anz-ln" id="anz-l-' + (i + 1) + '">' +
        '<span class="anz-no">' + (i + 1) + "</span>" +
        '<span class="anz-lc">' + (lines[i] === "" ? "&nbsp;" : hiCS(lines[i])) + "</span>" +
        "</div>";
    }
    h += "</pre>";
  }
  return h;
}

/* ---------------- right pane: theory ---------------- */
function theoryHTML() {
  const P = core() ? core().PRINCIPLES : {};
  let h = '<div class="anz-chips">';
  THEORY_CHIPS.forEach(function (p) {
    if (!P[p]) return;
    h += '<span class="anz-chip' + (state.openPrinciple === p ? " open" : "") +
      '" style="--anz-color:' + (PRINCIPLE_COLORS[p] || "#84909f") +
      '" onclick="ANZ.theory(\'' + p + '\')">' + esc(p) + "</span>";
  });
  h += "</div>";
  if (state.openPrinciple && P[state.openPrinciple]) {
    const pr = P[state.openPrinciple];
    h += '<div class="anz-theory-body" style="--anz-color:' + (PRINCIPLE_COLORS[state.openPrinciple] || "#84909f") + '">' +
      "<b>" + esc(pr.name) + "</b><p>" + esc(pr.summary) + "</p></div>";
  }
  return h;
}

/* ---------------- mode selector (Violations / Implementations / Full) ---- */
function modeChipsHTML() {
  const cur = curMode();
  const hints = {
    full: "presence verdict + violations per principle (the full P1 rubric answer)",
    violations: "only SOLID issues — coverage and draft count violations",
    implementations: "only how each principle is implemented — coverage and draft count presence",
  };
  let h = '<div class="anz-modes"><span class="anz-modes-label">MODE</span>';
  MODES.forEach(function (m) {
    h += '<span class="anz-mode-chip' + (m === cur ? " active" : "") +
      '" onclick="ANZ.mode(\'' + m + '\')" title="' + esc(hints[m]) + '">' +
      esc(MODE_LABELS[m]) + "</span>";
  });
  h += '<span class="anz-modes-hint">' + esc(hints[cur]) + "</span></div>";
  return h;
}

/* ---------------- coverage strip ---------------- */
/* the strip counts whatever the active mode shows: violations in violations
   mode, presence in implementations mode, both in full mode. Clicking a chip
   pins that principle (deep dive); clicking it again unpins. */
function coverageHTML() {
  if (!lastScan) return "";
  const mode = curMode();
  const list = modeFindings();
  const counts = {};
  list.forEach(function (f) { counts[f.principle] = (counts[f.principle] || 0) + 1; });
  const noun = mode === "implementations" ? "implementation" : mode === "violations" ? "violation" : "finding";
  let h = '<div class="anz-coverage"><span class="anz-cov-label">COVERAGE</span>';
  COVERAGE_CHIPS.forEach(function (p) {
    const n = counts[p] || 0;
    const on = n > 0;
    const focused = state && state.focusPrinciple === p;
    const title = on
      ? n + " " + noun + (n === 1 ? "" : "s") + " — click to focus this principle"
      : "no " + noun + "s — worth a manual pass";
    /* only lit chips are clickable: focusing a principle with no findings in
       this mode would show an empty list, which helps nobody */
    const click = on ? ' onclick="ANZ.focusPrinciple(\'' + p + '\')"' : "";
    h += '<span class="anz-cov-chip' + (on ? " on" : " off") + (focused ? " focus" : "") + (on ? " clickable" : "") + '" style="--anz-color:' +
      (PRINCIPLE_COLORS[p] || "#84909f") + '" title="' + esc(title) + '"' + click + ">" +
      esc(p) + (on ? " · " + n : "") + "</span>";
  });
  const hint = mode === "implementations"
    ? "click a lit chip to work one principle at a time; dim chips have no detected implementation"
    : mode === "violations"
      ? "exams usually plant ~one violation per principle; dim chips deserve a manual pass"
      : "exams usually plant ~one per principle; click a chip to focus it, dim chips deserve a manual pass";
  h += '<span class="anz-cov-hint">' + esc(hint) + "</span></div>";
  return h;
}

/* ---------------- manual-hunt checklist ---------------- */
function huntHTML() {
  let h = '<details class="anz-hunt"><summary>Manual-hunt checklist — patterns to look for</summary><div class="anz-hunt-body">';
  HUNT_CHECKLIST.forEach(function (row) {
    h += '<div class="anz-hunt-row"><span class="anz-hunt-p" style="--anz-color:' + (PRINCIPLE_COLORS[row.p] || "#84909f") + '">' +
      esc(row.p) + "</span><span class=\"anz-hunt-toks\">";
    row.tokens.forEach(function (t) { h += '<code class="anz-tok">' + esc(t) + "</code>"; });
    h += '</span><span class="anz-hunt-im">' + esc(row.implies) + "</span></div>";
  });
  h += "</div></details>";
  return h;
}

/* ---------------- finding / presence cards ---------------- */
function findingCard(f) {
  const key = findingKey(f);
  const sev = String(f.severity || "info").toLowerCase();
  const color = PRINCIPLE_COLORS[f.principle] || "#84909f";
  const isChecked = !!(state && state.checked && state.checked[key]);
  const line = Number(f.line) || 1;
  let h = '<div class="anz-card anz-sev-' + esc(sev) + '">';
  h += '<div class="anz-card-head">';
  h += '<span class="anz-sev">' + esc(sev) + "</span>";
  h += '<span class="anz-prin" style="--anz-color:' + esc(color) + '">' + esc(f.principle || "?") + "</span>";
  h += '<a class="anz-loc" onclick="ANZ.goto(\'' + jsq(f.file) + "'," + line + ')">' +
    esc(f.file) + ":" + line + "</a>";
  h += '<label class="anz-inc"><input type="checkbox"' + (isChecked ? " checked" : "") +
    ' onchange="ANZ.toggle(\'' + jsq(key) + '\', this.checked)"> include in answer</label>';
  h += "</div>";
  h += '<div class="anz-finding-msg">' + esc(f.message || "") + "</div>";
  if (f.excerpt) h += '<pre class="anz-excerpt">' + hiCS(f.excerpt) + "</pre>";
  if (f.theory) {
    h += '<details class="anz-det"><summary>theory</summary>' +
      '<div class="anz-det-body">' + esc(f.theory) + "</div></details>";
  }
  if (f.before || f.after) {
    h += '<details class="anz-det"><summary>before / after</summary><div class="anz-ba">' +
      '<div class="anz-ba-col"><span class="anz-ba-lab anz-ba-bad">before</span><pre class="anz-excerpt">' + hiCS(f.before || "") + "</pre></div>" +
      '<div class="anz-ba-col"><span class="anz-ba-lab anz-ba-good">after</span><pre class="anz-excerpt">' + hiCS(f.after || "") + "</pre></div>" +
      "</div></details>";
  }
  if (f.fix) h += '<div class="anz-fix"><span class="anz-fix-label">FIX</span><span>' + esc(f.fix) + "</span></div>";
  h += "</div>";
  return h;
}

function presenceCard(f) {
  const key = findingKey(f);
  const isChecked = !!(state && state.checked && state.checked[key]);
  const line = Number(f.line) || 1;
  let h = '<div class="anz-card anz-presence">';
  h += '<div class="anz-card-head">';
  h += '<span class="anz-sev anz-sev-present">present</span>';
  h += '<span class="anz-prin anz-prin-present">' + esc(f.principle || "?") + "</span>";
  h += '<a class="anz-loc" onclick="ANZ.goto(\'' + jsq(f.file) + "'," + line + ')">' +
    esc(f.file) + ":" + line + "</a>";
  h += '<label class="anz-inc"><input type="checkbox"' + (isChecked ? " checked" : "") +
    ' onchange="ANZ.toggle(\'' + jsq(key) + '\', this.checked)"> include in answer</label>';
  h += "</div>";
  h += '<div class="anz-finding-msg">' + esc(f.message || "") + "</div>";
  if (f.excerpt) h += '<pre class="anz-excerpt">' + hiCS(f.excerpt) + "</pre>";
  h += "</div>";
  return h;
}

function resultsHTML() {
  if (!lastScan) {
    return modeChipsHTML() + '<div class="anz-empty">Paste the exam&#39;s .cs files on the left (one tab per file) and press <b>Scan</b>, or load a real 2025 exam below. Every finding is a lead to verify against the code — confirm it, tick it, build the answer. Green cards are principles you got <b>right</b>; tick them too — the rubric scores presence.</div>' + huntHTML();
  }
  const mode = curMode();
  let h = modeChipsHTML() + coverageHTML();

  /* findings the active mode renders (before the per-principle focus filter) */
  const modeList = modeFindings();
  if (!modeList.length) {
    const noun = mode === "implementations" ? "implementation finding" : mode === "violations" ? "violation" : "finding";
    const empty = mode === "implementations"
      ? "No implementation findings yet. Switch to Full or Violations mode, or use the manual-hunt checklist — the rubric still wants each principle's purpose stated by hand."
      : mode === "violations"
        ? "No violations found. Either the code is clean or the smell is outside the rule set — use the manual-hunt checklist and the principle chips above."
        : "No findings. Either the code is clean or the smell is outside the rule set — use the manual-hunt checklist and the principle chips above.";
    return h + '<div class="anz-empty">' + empty + "</div>" + huntHTML();
  }

  const viol = modeList.filter(function (f) { return !isPresence(f); });
  const pres = modeList.filter(isPresence);

  /* summary line counts only what the mode shows */
  h += '<div class="anz-summary"><span class="anz-summary-n">';
  if (mode === "violations") h += viol.length + " violation" + (viol.length === 1 ? "" : "s");
  else if (mode === "implementations") h += pres.length + " implementation" + (pres.length === 1 ? "" : "s") + " detected";
  else h += viol.length + " violation" + (viol.length === 1 ? "" : "s") + ", " + pres.length + " present";
  h += "</span>";
  const counts = {};
  modeList.forEach(function (f) { counts[f.principle] = (counts[f.principle] || 0) + 1; });
  const order = PRINCIPLE_ORDER.slice();
  Object.keys(counts).forEach(function (p) { if (order.indexOf(p) === -1) order.push(p); });
  order.forEach(function (p) {
    if (!counts[p]) return;
    h += '<span class="anz-chip" style="--anz-color:' + (PRINCIPLE_COLORS[p] || "#84909f") + '">' +
      esc(p) + " × " + counts[p] + "</span>";
  });
  h += "</div>";

  /* per-principle focus banner: a pinned principle filters the cards below */
  if (state && state.focusPrinciple) {
    const fp = state.focusPrinciple;
    h += '<div class="anz-focus" style="--anz-color:' + (PRINCIPLE_COLORS[fp] || "#84909f") + '">' +
      '<span>Focused on <b>' + esc(fp) + "</b> — working this principle on its own. </span>" +
      '<button class="anz-focus-x" onclick="ANZ.focusPrinciple(\'' + fp + '\')">show all principles ✕</button></div>';
  }

  h += huntHTML();

  const P = core() ? core().PRINCIPLES : {};
  /* apply the per-principle focus filter to both halves */
  const fp = state && state.focusPrinciple;
  const presShown = fp ? pres.filter(function (f) { return f.principle === fp; }) : pres;
  const violShown = fp ? viol.filter(function (f) { return f.principle === fp; }) : viol;

  /* presence section first (the answer's presence half), then violations.
     Implementations mode shows only presence; violations mode only violations. */
  if (mode !== "violations" && presShown.length) {
    h += '<div class="anz-group anz-group-present"><div class="anz-group-h anz-group-h-present">' +
      (mode === "implementations" ? "HOW EACH PRINCIPLE IS IMPLEMENTED (tick — these are your answer)" : "PRINCIPLES PRESENT (tick — the rubric scores these)") +
      '<span class="anz-group-n">' + presShown.length + "</span></div>";
    presShown.forEach(function (f) { h += presenceCard(f); });
    h += "</div>";
  }
  if (mode !== "implementations") {
    order.forEach(function (p) {
      const group = violShown.filter(function (f) { return f.principle === p; });
      if (!group.length) return;
      h += '<div class="anz-group">' +
        '<div class="anz-group-h" style="--anz-color:' + (PRINCIPLE_COLORS[p] || "#84909f") + '">' +
        esc(P[p] ? P[p].name : p) + '<span class="anz-group-n">' + group.length + "</span></div>";
      group.forEach(function (f) { h += findingCard(f); });
      h += "</div>";
    });
  }
  return h;
}

/* ---------------- templates tab ---------------- */
function templateCard(t) {
  return '<div class="anz-tpl" style="--anz-color:' + (PRINCIPLE_COLORS[t.principle] || "#84909f") + '">' +
    '<div class="anz-tpl-head"><span class="anz-tpl-title">' + esc(t.title) + "</span>" +
    '<button class="anz-tpl-ins" onclick="ANZ.insertTemplate(\'' + jsq(t.id) + '\')">Insert →</button></div>' +
    '<div class="anz-tpl-text">' + tplWithBlanks(t.text) + "</div></div>";
}

/* render ___ blanks as styled spans (escaped text around them) */
function tplWithBlanks(text) {
  const parts = String(text).split(/(___+)/g);
  let out = "";
  parts.forEach(function (p) {
    if (/^_+$/.test(p)) out += '<span class="anz-blank">' + esc(p) + "</span>";
    else out += esc(p);
  });
  return out;
}

function templatesHTML() {
  const TPL = core() ? core().TEMPLATES : null;
  if (!TPL || !TPL.length) return '<div class="anz-empty">Template bank unavailable.</div>';
  const groups = {};
  const order = [];
  TPL.forEach(function (t) {
    if (!groups[t.group]) { groups[t.group] = []; order.push(t.group); }
    groups[t.group].push(t);
  });
  let h = '<div class="anz-tpl-intro">Fill-in-the-blank paragraphs. <b>Insert</b> drops one into your Draft, then replace the <span class="anz-blank">___</span> blanks with names and line numbers from the code.</div>';
  order.forEach(function (g) {
    h += '<div class="anz-tpl-group-h">' + esc(g) + "</div>";
    groups[g].forEach(function (t) { h += templateCard(t); });
  });
  return h;
}

/* ---------------- draft tab ---------------- */
function draftHTML() {
  let h = "";
  if (banner) {
    h += '<div class="anz-warn"><span>⚠ Reword in your own voice — examiners compare answers, and identical phrasing across students is a red flag.</span>' +
      '<button class="anz-warn-x" onclick="ANZ.dismissBanner()">✕</button></div>';
  }
  const sel = selectedFindings();
  const mode = curMode();
  const draftHint = mode === "violations"
    ? "violations per principle, in S·O·L·I·D order; principles with none get a one-line note"
    : mode === "implementations"
      ? "how each principle is implemented, in S·O·L·I·D order"
      : "presence first, then violations, in S·O·L·I·D order";
  h += '<div class="anz-draft-actions">' +
    '<span class="anz-mode-badge anz-mode-' + esc(mode) + '">' + esc(MODE_LABELS[mode]) + " mode</span>" +
    '<button class="anz-build" onclick="ANZ.buildAnswer()">' + (draftText ? "Rebuild from " : "Build draft from ") + sel.length + " ticked</button>" +
    '<span class="anz-draft-hint">' + esc(draftHint) + "</span></div>";
  h += '<div class="anz-answer">' +
    '<div class="anz-ed-head"><span class="anz-ed-name">written answer draft — edit freely, then copy</span>' +
    '<button class="copybtn" onclick="ANZ.copyAnswer(this)">copy</button></div>' +
    '<textarea class="anz-answer-ta" id="anz-answer-ta" spellcheck="false"' +
    ' oninput="ANZ.editDraft(this.value)" placeholder="// tick findings on the Findings tab, then Build draft — or Insert templates and write here">' +
    esc(draftText) + "</textarea></div>";
  return h;
}

/* ---------------- answer-key reveal ---------------- */
function answerKeyHTML() {
  if (!state.answerKey) return "";
  const ak = state.answerKey;
  let h = '<details class="anz-key"><summary>✨ Model answer key (' + esc(ak.label) + ') — scan and try first!</summary>' +
    '<div class="anz-key-warn">Open this only after you have scanned, ticked findings, and drafted your own answer. Comparing too early trains nothing.</div>';
  (ak.answerKey || []).forEach(function (k) {
    h += '<div class="anz-key-row" style="--anz-color:' + (PRINCIPLE_COLORS[k.principle] || "#84909f") + '">' +
      '<div class="anz-key-h"><span class="anz-prin" style="--anz-color:' + (PRINCIPLE_COLORS[k.principle] || "#84909f") + '">' +
      esc(k.principle) + '</span><span class="anz-key-v anz-key-v-' + esc(k.verdict) + '">' + esc(k.verdict) + "</span></div>" +
      '<div class="anz-key-p">' + esc(k.paragraph) + "</div></div>";
  });
  h += "</details>";
  return h;
}

/* ---------------- right-pane tab bar + body ---------------- */
function tabBarHTML() {
  const tabs = [["findings", "Findings"], ["templates", "Templates"], ["draft", "Draft"]];
  let h = '<div class="anz-rtabs">';
  tabs.forEach(function (t) {
    h += '<button class="anz-rtab' + (state.tab === t[0] ? " active" : "") +
      '" onclick="ANZ.tab(\'' + t[0] + '\')">' + esc(t[1]) + "</button>";
  });
  h += "</div>";
  return h;
}

function rightBodyHTML() {
  if (state.tab === "templates") return templatesHTML();
  if (state.tab === "draft") return draftHTML();
  return resultsHTML() + answerKeyHTML();
}

/* checked findings, narrowed to the active mode so the draft never mixes
   in a presence card while in Violations mode (or vice versa). The mode chips
   thus filter the draft exactly as they filter the on-screen findings. */
function selectedFindings() {
  if (!lastScan) return [];
  const checked = {};
  Object.keys(state.checked || {}).forEach(function (k) { checked[k] = 1; });
  return modeFindings().filter(function (f) { return checked[findingKey(f)]; });
}

/* ---------------- page ---------------- */
function render() {
  ensureState();
  let h = '<div class="content-inner content-wide">';
  h += '<div class="crumb"><b>ANALYSIS LAB</b></div>';
  h += '<h1 class="topic-title">Analysis Lab</h1>';
  h += '<p class="bp">Paste the Problem 1 codebase (or load a real 2025 exam), press <b>Scan</b>, and confirm the OOP/SOLID findings. Green cards are principles the code applies <b>well</b> — the rubric scores presence, so tick those too. Then switch to <b>Draft</b> for a rubric-shaped, five-principle written answer.</p>';
  h += '<div class="anz">';
  h += '<div class="anz-left">';
  h += '<div class="anz-tabs" id="anz-tabs">' + tabsHTML() + "</div>";
  h += '<div class="anz-editor" id="anz-editor">' + editorHTML() + "</div>";
  h += '<div class="anz-actions">' +
    '<button class="anz-scan" onclick="ANZ.scan()">Scan</button>' +
    '<button class="copybtn" onclick="ANZ.loadExample()">Load example</button>' +
    '<button class="copybtn" onclick="ANZ.loadFixture(\'summer2025\')">Load Summer 2025</button>' +
    '<button class="copybtn" onclick="ANZ.loadFixture(\'reexam2025\')">Load Re-exam 2025</button>' +
    /* optional export button: only when window.PROJZIP is loaded AND there is
       code to package. Absent projzip-core.js => the button simply never shows. */
    (canExportZip() ? '<button class="copybtn" onclick="ANZ.downloadZip()" title="Package the pasted P1 code as a runnable net9.0 console project (.zip)">Download project (.zip)</button>' : '') +
    '<span class="anz-status" id="anz-status"></span></div>';
  h += '<div class="anz-split" id="anz-split"></div>';
  h += "</div>";
  h += '<div class="anz-right">';
  h += '<div class="anz-theory" id="anz-theory">' + theoryHTML() + "</div>";
  h += '<div class="anz-rtabbar" id="anz-rtabbar">' + tabBarHTML() + "</div>";
  h += '<div class="anz-rbody" id="anz-rbody">' + rightBodyHTML() + "</div>";
  h += "</div>";
  h += "</div></div>";
  return h;
}

function init() {
  ensureState();
  /* restore findings (and the persisted checkboxes) on revisit */
  if (!lastScan && state.files.some(function (f) { return f.text && f.text.trim(); })) {
    doScan(true);
  }
}

/* ---------------- repaint helpers ---------------- */
function paintTabs() { paint("anz-tabs", tabsHTML()); }
function paintEditor() { paint("anz-editor", editorHTML()); }
function paintTheory() { paint("anz-theory", theoryHTML()); }
function paintRTabBar() { paint("anz-rtabbar", tabBarHTML()); }
function paintRBody() { paint("anz-rbody", rightBodyHTML()); }
function paintSplit() { paint("anz-split", splitHTML()); }

/* ---------------- paste-splitter ---------------- */
/* detect a pasted blob that holds multiple files: explicit // File: markers,
   or 2+ top-level type/namespace declarations in one tab. */
function splitCandidate() {
  const f = state.files[state.active];
  if (!f || !f.text || !f.text.trim()) return null;
  if (state.files.filter(function (x) { return x.text && x.text.trim(); }).length > 1) return null;
  const text = f.text;
  if (/(^|\n)\s*\/\/\s*File:\s*\S+/i.test(text)) return "markers";
  const C = core();
  const stripped = C ? C.stripForScan(text) : text;
  const decls = (stripped.match(/\b(?:public|internal|sealed|abstract|static|partial)?\s*(?:class|interface|record|enum|namespace)\s+[A-Za-z_]\w*/g) || []);
  /* count namespace + top-level types; 2+ suggests several files glued together */
  return decls.length >= 2 ? "decls" : null;
}

function splitHTML() {
  const kind = splitCandidate();
  if (!kind) return "";
  return '<div class="anz-splitbar"><span>This looks like several files in one tab' +
    (kind === "markers" ? " (‘// File:’ markers found)" : "") +
    '. Split them into separate tabs?</span>' +
    '<button class="anz-split-btn" onclick="ANZ.splitPaste()">Split into files</button></div>';
}

/* split the active file into multiple tabs, preferring // File: marker names */
function splitPaste() {
  ensureState();
  const f = state.files[state.active];
  if (!f || !f.text) return;
  const text = f.text;
  let parts = [];
  const markerRe = /(^|\n)\s*\/\/\s*File:\s*(\S+)[^\n]*\n/gi;
  if (markerRe.test(text)) {
    markerRe.lastIndex = 0;
    let m, last = null, lastName = null, lastStart = 0;
    while ((m = markerRe.exec(text))) {
      if (last !== null) parts.push({ name: lastName, text: text.slice(lastStart, m.index).replace(/^\s*\n/, "") });
      lastName = m[2].replace(/[^A-Za-z0-9_.\-]/g, "") || ("File" + (parts.length + 1) + ".cs");
      if (!/\.\w+$/.test(lastName)) lastName += ".cs";
      lastStart = m.index + m[0].length;
      last = m.index;
    }
    if (last !== null) parts.push({ name: lastName, text: text.slice(lastStart).replace(/^\s*\n/, "") });
  } else {
    parts = splitByTypeDecls(text);
  }
  parts = parts.filter(function (p) { return p.text && p.text.trim(); });
  if (parts.length < 2) { setStatus("could not split — nothing to do"); paintSplit(); return; }
  state.files = parts.map(function (p) { return { name: p.name, text: p.text.replace(/\s+$/, "") + "\n" }; });
  state.active = 0;
  viewModes = {};
  saveState();
  paintTabs(); paintEditor(); paintSplit();
  doScan(false);
  setStatus("split into " + parts.length + " files");
}

/* split a blob at top-level type declarations, naming each tab after the type;
   leading using/namespace stays attached to the first type. */
function splitByTypeDecls(text) {
  const C = core();
  const stripped = C ? C.stripForScan(text) : text;
  const re = /\b(class|interface|record|enum)\s+([A-Za-z_]\w*)/g;
  const heads = [];
  let m;
  while ((m = re.exec(stripped))) {
    /* only top-level (depth-aware would be better; line start heuristic is fine) */
    const lineStart = stripped.lastIndexOf("\n", m.index) + 1;
    heads.push({ idx: lineStart, name: m[2] });
  }
  if (heads.length < 2) return [{ name: "File1.cs", text: text }];
  const parts = [];
  for (let i = 0; i < heads.length; i++) {
    const start = i === 0 ? 0 : heads[i].idx;
    const end = i + 1 < heads.length ? heads[i + 1].idx : text.length;
    parts.push({ name: heads[i].name + ".cs", text: text.slice(start, end) });
  }
  return parts;
}

/* ---------------- actions (window.ANZ) ---------------- */
function doScan(silent) {
  ensureState();
  const C = core();
  if (!C) { setStatus("scanner core not loaded"); return; }
  const nonEmpty = state.files.filter(function (f) { return f.text && f.text.trim(); });
  if (!nonEmpty.length) { if (!silent) setStatus("paste some code first"); return; }
  try { lastScan = C.scan(state.files); }
  catch (e) { lastScan = { findings: [], index: {} }; }
  /* drop checked keys that no longer match a finding */
  const valid = {};
  lastScan.findings.forEach(function (f) {
    const k = findingKey(f);
    if (state.checked[k]) valid[k] = 1;
  });
  state.checked = valid;
  /* a fresh scan changes the finding set — drop any pinned principle so the
     new results show in full before the user narrows again */
  state.focusPrinciple = null;
  saveState();
  if (state.tab !== "findings") { state.tab = "findings"; paintRTabBar(); }
  paintRBody();
  paintSplit();
  if (!silent) {
    const viol = lastScan.findings.filter(function (f) { return !isPresence(f); }).length;
    const pres = lastScan.findings.length - viol;
    setStatus(viol + " violation" + (viol === 1 ? "" : "s") + ", " + pres + " present in " +
      nonEmpty.length + " file" + (nonEmpty.length === 1 ? "" : "s"));
  }
}

function addFile() {
  ensureState();
  state.files.push({ name: "File" + (state.files.length + 1) + ".cs", text: "" });
  state.active = state.files.length - 1;
  viewModes[state.active] = "edit";
  saveState();
  paintTabs(); paintEditor(); paintSplit();
  setTimeout(function () { const ta = byId("anz-ta"); if (ta) ta.focus(); }, 0);
}

function removeFile(i) {
  ensureState();
  state.files.splice(i, 1);
  if (!state.files.length) state.files.push({ name: "Program.cs", text: "" });
  state.active = Math.min(state.active, state.files.length - 1);
  viewModes = {};
  saveState();
  paintTabs(); paintEditor(); paintSplit();
  if (lastScan) setStatus("file removed — re-scan to refresh findings");
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
  paintTabs(); paintEditor(); paintSplit();
}

function edit(value) {
  ensureState();
  if (!state.files[state.active]) return;
  state.files[state.active].text = value;
  scheduleSave();
  paintSplit();
}

function toggleView() {
  ensureState();
  viewModes[state.active] = viewModes[state.active] === "view" ? "edit" : "view";
  paintEditor();
}

function loadExample() {
  ensureState();
  const allEmpty = state.files.every(function (f) { return !f.text || !f.text.trim(); });
  if (allEmpty) state.files = [{ name: DEMO_NAME, text: DEMO }];
  else state.files.push({ name: DEMO_NAME, text: DEMO });
  state.active = state.files.length - 1;
  state.answerKey = null;
  viewModes = {};
  saveState();
  paintTabs(); paintEditor(); paintSplit();
  doScan(false);
}

/* load a real 2025 exam fixture into the tabs + stash its answer key */
function loadFixture(which) {
  ensureState();
  const FX = fixtures();
  if (!FX || !FX[which]) { setStatus("exam fixtures not loaded"); return; }
  const fx = FX[which];
  /* loadFixture replaces ALL tabs (unlike loadExample, which appends). Guard
     against silently wiping pasted exam code: if any current tab holds
     non-empty user content, confirm first. With confirm absent (Node) the
     legacy replace-and-go behaviour is unchanged so existing tests pass. */
  const hasUserCode = state.files.some(function (f) { return f.text && f.text.trim(); });
  if (hasUserCode && typeof confirm === "function" && !confirm("Replace the pasted code with the " + fx.label + " fixture?")) return;
  state.files = fx.files.map(function (f) { return { name: f.name, text: f.text }; });
  state.active = 0;
  state.checked = {};
  state.answerKey = { label: fx.label, answerKey: fx.answerKey };
  state.tab = "findings";
  viewModes = {};
  saveState();
  paintTabs(); paintEditor(); paintRTabBar(); paintSplit();
  doScan(false);
  setStatus("loaded " + fx.label + " — scan results below; answer key hidden until you try");
}

function toggle(key, on) {
  ensureState();
  if (on) state.checked[key] = 1;
  else delete state.checked[key];
  saveState();
  /* update the draft action count if the draft tab is showing */
  if (state.tab === "draft") paintRBody();
}

function tab(name) {
  ensureState();
  if (name !== "findings" && name !== "templates" && name !== "draft") return;
  state.tab = name;
  saveState();
  paintRTabBar(); paintRBody();
}

function gotoFinding(file, line) {
  ensureState();
  let idx = -1;
  state.files.forEach(function (f, i) { if (idx === -1 && f.name === file) idx = i; });
  if (idx === -1) { setStatus("'" + file + "' is gone — re-scan"); return; }
  state.active = idx;
  viewModes[idx] = "view";
  paintTabs(); paintEditor();
  setTimeout(function () {
    document.querySelectorAll(".anz-hot").forEach(function (el) { el.classList.remove("anz-hot"); });
    const el = byId("anz-l-" + line);
    if (el) {
      el.classList.add("anz-hot");
      if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, 0);
}

function theory(p) {
  ensureState();
  state.openPrinciple = state.openPrinciple === p ? null : p;
  paintTheory();
}

/* switch analysis mode (Violations / Implementations / Full). Re-renders the
   findings list, coverage strip, select-all set and draft hint. Drops any
   per-principle focus so the new mode starts from a clean, full view. */
function setMode(m) {
  ensureState();
  const next = normalizeMode(m);
  if (next === state.mode) return;
  state.mode = next;
  state.focusPrinciple = null;
  saveState();
  if (state.tab === "findings") paintRBody();
  else { paintRTabBar(); paintRBody(); }
}

/* per-principle deep dive: pin a principle to filter the findings to it (and
   scroll the list into view); click the same principle again to unpin. */
function focusPrinciple(p) {
  ensureState();
  state.focusPrinciple = state.focusPrinciple === p ? null : p;
  /* deep dive operates on the findings tab; jump there if we're elsewhere */
  if (state.tab !== "findings") { state.tab = "findings"; paintRTabBar(); }
  paintRBody();
  if (state.focusPrinciple) {
    setStatus("focused on " + p + " — working it on its own");
    setTimeout(function () {
      const el = byId("anz-rbody");
      if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 0);
  } else {
    setStatus("showing all principles");
  }
}

function buildAnswer() {
  ensureState();
  const sel = selectedFindings();
  const mode = curMode();
  if (!sel.length) {
    const why = mode === "violations" ? "tick at least one violation first"
      : mode === "implementations" ? "tick at least one implementation finding first"
      : "tick at least one finding first";
    setStatus(why); state.tab = "draft"; paintRTabBar(); paintRBody(); return;
  }
  const first = state.files[0] && state.files[0].name || "Project.cs";
  const project = first.replace(/\.[^.]+$/, "");
  let text = "";
  try { text = core().assembleAnswer(sel, { project: project, mode: mode }); }
  catch (e) { text = ""; }
  draftText = text;
  state.tab = "draft";
  saveState();
  paintRTabBar(); paintRBody();
  setTimeout(function () {
    const el = byId("anz-answer-ta");
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, 0);
}

function editDraft(value) {
  draftText = value; /* not persisted to localStorage by design (large/transient) */
}

function insertTemplate(id) {
  ensureState();
  const TPL = core() ? core().TEMPLATES : [];
  const t = TPL && TPL.filter(function (x) { return x.id === id; })[0];
  if (!t) return;
  draftText = (draftText ? draftText.replace(/\s*$/, "") + "\n\n" : "") + t.text;
  state.tab = "draft";
  saveState();
  paintRTabBar(); paintRBody();
  setStatus("inserted “" + t.title + "” into the draft");
  setTimeout(function () {
    const el = byId("anz-answer-ta");
    if (el) { el.scrollTop = el.scrollHeight; if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" }); }
  }, 0);
}

function dismissBanner() {
  banner = false;
  paintRBody();
}

function copyAnswer(btn) {
  const ta = byId("anz-answer-ta");
  if (!ta) return;
  const text = ta.value;
  const done = function () {
    btn.textContent = "copied ✓";
    btn.classList.add("done");
    setTimeout(function () { btn.textContent = "copy"; btn.classList.remove("done"); }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function () { anzFallbackCopy(text, done); });
  } else anzFallbackCopy(text, done);
}

function anzFallbackCopy(text, done) {
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

/* ---------------- project export (optional, via window.PROJZIP) ----------------
   Package the pasted P1 codebase as a runnable net9.0 console project so Max can
   open it offline and confirm his SOLID analysis compiles. Entirely optional:
   guarded behind projzip()/canExportZip(), so when projzip-core.js is not loaded
   the button never renders and this code is never reached. */
function buildZipEntries() {
  const Z = projzip();
  if (!Z) return null;
  const name = exportProjectName();
  const files = (state.files || []).filter(function (f) { return f.text && f.text.trim(); });
  /* keep each pasted file as-is (extra file); only synthesize a Program.cs when
     none of the pasted files already declares a top-level Main entry point */
  const hasMain = files.some(function (f) {
    const C = core();
    const s = C && typeof C.stripForScan === "function" ? C.stripForScan(f.text) : f.text;
    return /\bstatic\b[^;{}]*\bMain\s*\(/.test(s); /* an explicit 'static ... Main(...)' entry point */
  });
  const extraFiles = files.map(function (f) {
    let p = String(f.name || "Class.cs");
    if (!/\.cs$/i.test(p)) p += ".cs";
    return { path: p, text: f.text };
  });
  const opts = { dataFiles: [], extraFiles: extraFiles };
  /* The console scaffold always writes a Program.cs. To keep exactly one entry
     point: when a pasted file already owns Main, make that Program.cs a comment;
     otherwise put a tiny no-op Main in it so the pasted P1 code still compiles. */
  if (hasMain) {
    /* a pasted file owns Main; make the scaffold's Program.cs a harmless comment
       so there is exactly one entry point in the compiled project */
    opts.programCs = "// Entry point is defined in one of the project's own files.\n";
  } else {
    opts.programCs = "// Auto-generated entry point so the pasted P1 code compiles and runs.\n" +
      "Console.WriteLine(\"" + name.replace(/"/g, "") + " — paste-to-project scaffold. Replace with the exam's own Main if needed.\");\n";
  }
  return { name: name, entries: Z.consoleProject(name, opts) };
}

function downloadZip() {
  ensureState();
  const Z = projzip();
  if (!Z) { setStatus("project export unavailable (PROJZIP not loaded)"); return; }
  let built;
  try { built = buildZipEntries(); } catch (e) { built = null; }
  if (!built || !built.entries || !built.entries.length) { setStatus("paste some code first, then export"); return; }
  let url;
  try { url = Z.makeZipBlobUrl(built.entries); }
  catch (e) { setStatus("could not build the zip in this environment"); return; }
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = built.name + ".zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatus("downloaded " + built.name + ".zip — unzip and 'dotnet run'");
    setTimeout(function () { try { if (global.URL && global.URL.revokeObjectURL) global.URL.revokeObjectURL(url); } catch (e) {} }, 4000);
  } catch (e) { setStatus("download failed in this browser"); }
}

/* ---------------- export ---------------- */
const ANZ = {
  scan: function () { doScan(false); },
  addFile: addFile,
  removeFile: removeFile,
  rename: rename,
  activate: activate,
  edit: edit,
  toggleView: toggleView,
  loadExample: loadExample,
  loadFixture: loadFixture,
  toggle: toggle,
  tab: tab,
  "goto": gotoFinding,
  theory: theory,
  mode: setMode,
  focusPrinciple: focusPrinciple,
  buildAnswer: buildAnswer,
  editDraft: editDraft,
  insertTemplate: insertTemplate,
  dismissBanner: dismissBanner,
  splitPaste: splitPaste,
  copyAnswer: copyAnswer,
  downloadZip: downloadZip,
};

const ANALYZER = { render: render, init: init, findingCard: findingCard, presenceCard: presenceCard, templateCard: templateCard, DEMO: DEMO, DEMO_NAME: DEMO_NAME };

global.ANALYZER = ANALYZER;
global.ANZ = ANZ;
if (typeof module !== "undefined" && module.exports) module.exports = ANALYZER;
})(typeof window !== "undefined" ? window : globalThis);
