"use strict";
const { test, ok, includes, notIncludes } = require("./t.js");
global.window = global;            // analyzer.js attaches to window; no DOM calls at load time
require("../data/analyzer-core.js");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../data/analyzer.js", "utf8");

test("analyzer.js never touches document at load time (only inside functions)", () => {
  const topLevel = src.replace(/function[\s\S]*?\n\}/g, "");
  ok(topLevel.indexOf("document.") === -1, "document.* found at top level");
});

test("analyzer UI module loads under Node and exposes render/init/findingCard", () => {
  require("../data/analyzer.js");
  ok(typeof global.ANALYZER.render === "function", "ANALYZER.render missing");
  ok(typeof global.ANALYZER.init === "function", "ANALYZER.init missing");
  ok(typeof global.ANALYZER.findingCard === "function", "ANALYZER.findingCard missing");
  ok(global.ANZ && typeof global.ANZ.scan === "function", "handlers must live on window.ANZ");
  ok(typeof global.ANZ.toggle === "function", "ANZ.toggle missing");
  ok(typeof global.ANZ.buildAnswer === "function", "ANZ.buildAnswer missing");
});

test("findingCard escapes excerpt and message (XSS)", () => {
  const f = {
    ruleId: "downcast", principle: "LSP", severity: "high",
    file: "Evil.cs", line: 3,
    excerpt: 'var x = repo as Evil; // <script>alert("xss")</script>',
    message: "<script>msg</script>",
    theory: "theory <script>t</script>", fix: "fix <script>f</script>",
    paragraph: "paragraph text",
  };
  const html = global.ANALYZER.findingCard(f);
  includes(html, "&lt;script&gt;", "excerpt must be escaped");
  notIncludes(html, "<script>", "raw <script> must never reach the DOM");
  includes(html, "Evil.cs", "file:line must be shown");
  includes(html, "include in answer", "include checkbox must be present");
});

test("presenceCard escapes fixture-derived message and excerpt (XSS)", () => {
  const f = {
    kind: "presence", ruleId: "presence-dip-0", principle: "DIP", verdict: "present",
    file: "Evil.cs", line: 7,
    excerpt: 'private readonly IRepo _r; // <script>alert(1)</script>',
    message: "DIP present <img src=x onerror=alert(2)>",
    paragraph: "Dependency Inversion is present <script>bad()</script>",
  };
  const html = global.ANALYZER.presenceCard(f);
  includes(html, "&lt;script&gt;", "presence excerpt must be escaped");
  notIncludes(html, "<script>", "raw <script> must never reach the DOM from a presence card");
  notIncludes(html, "<img", "raw <img onerror=...> must never form a live element");
  includes(html, "&lt;img", "the injected img tag must be neutralised to text");
  includes(html, "present", "presence badge must render");
});

test("templateCard escapes title/text and renders ___ blanks as spans", () => {
  const t = {
    id: "evil", group: "G", principle: "SRP",
    title: "Title <script>x</script>",
    text: "Fill ___ here with <script>y</script> and ___ there.",
  };
  const html = global.ANALYZER.templateCard(t);
  notIncludes(html, "<script>", "template text/title must be escaped");
  includes(html, "anz-blank", "___ blanks must render as styled spans");
});

test("exam fixtures + their answer keys are plain escapable text (no raw <script>)", () => {
  const FX = require("../data/exam-fixtures.js");
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  ["summer2025", "reexam2025"].forEach((k) => {
    FX[k].files.forEach((file) => {
      notIncludes(esc(file.text), "<script>", "escaped fixture code must contain no live <script>");
    });
    FX[k].answerKey.forEach((e) => {
      notIncludes(esc(e.paragraph), "<script>", "escaped answer-key text must contain no live <script>");
    });
  });
});

/* ======================================================================
   ANALYZER MODES UI (spec 08) — chips render, mode switch filters render,
   per-principle deep dive. localStorage + a no-op document shim let render()
   and the handlers run headless (paint()/byId() resolve to null safely).
   loadExample() is the public action that resets module state and scans the
   built-in demo, which carries both presence findings AND violations — ideal
   for exercising the mode filter end-to-end through the real render path.
   ====================================================================== */
const { eq } = require("./t.js");
global.localStorage = global.localStorage || {
  _d: {}, getItem(k) { return this._d[k] || null; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
};
/* headless DOM shim: every lookup misses, so paint()/setStatus() are no-ops */
global.document = global.document || { getElementById() { return null; }, querySelectorAll() { return []; } };
require("../data/analyzer.js");

test("render() shows the three mode chips, Full exam answer active by default", () => {
  global.localStorage.removeItem("aop-analyzer-state");
  global.ANZ.loadExample();      // fresh state + scan of the demo
  global.ANZ.mode("full");
  const html = global.ANALYZER.render();
  includes(html, "anz-mode-chip", "mode chips must render");
  includes(html, "Full exam answer", "full mode chip label");
  includes(html, "Violations", "violations mode chip label");
  includes(html, "Implementations", "implementations mode chip label");
  const fullAt = html.indexOf("Full exam answer");
  const activeAt = html.lastIndexOf("anz-mode-chip active", fullAt);
  ok(activeAt !== -1 && activeAt < fullAt, "Full exam answer chip is active in full mode");
});

test("ANZ.mode switches mode, persists it, and reframes the coverage/hint copy", () => {
  global.ANZ.loadExample();
  global.ANZ.mode("implementations");
  const saved = JSON.parse(global.localStorage.getItem("aop-analyzer-state"));
  eq(saved.mode, "implementations", "mode must persist to aop-analyzer-state");
  const html = global.ANALYZER.render();
  const implAt = html.indexOf("Implementations");
  const activeAt = html.lastIndexOf("anz-mode-chip active", implAt);
  ok(activeAt !== -1 && activeAt < implAt, "Implementations chip is active after the switch");
  includes(html, "how each principle is implemented", "mode hint reframed for implementations");
});

test("render: implementations mode hides violation cards, violations mode hides the presence group", () => {
  global.ANZ.loadExample();
  global.ANZ.mode("implementations");
  const impl = global.ANALYZER.render();
  includes(impl, "HOW EACH PRINCIPLE IS IMPLEMENTED", "implementations group header shown");
  notIncludes(impl, "anz-sev-high", "no high-severity violation cards in implementations mode");

  global.ANZ.mode("violations");
  const viol = global.ANALYZER.render();
  notIncludes(viol, "HOW EACH PRINCIPLE IS IMPLEMENTED", "implementations group hidden in violations mode");
  notIncludes(viol, "PRINCIPLES PRESENT", "presence group hidden in violations mode");
  includes(viol, "anz-card anz-sev-high", "violation cards shown in violations mode");
  global.ANZ.mode("full");
});

test("coverage strip is clickable and reframes its noun per mode", () => {
  global.ANZ.loadExample();
  global.ANZ.mode("violations");
  const html = global.ANALYZER.render();
  includes(html, "anz-cov-chip on clickable", "lit coverage chips are clickable in violations mode");
  includes(html, "violation", "coverage chip titles count violations");
});

test("focusPrinciple pins a principle (focus banner) and toggling it clears it", () => {
  global.ANZ.loadExample();      // demo has ENC + LSP findings
  global.ANZ.mode("full");
  global.ANZ.focusPrinciple("LSP");
  const focused = global.ANALYZER.render();
  includes(focused, "anz-focus", "focus banner appears when a principle is pinned");
  includes(focused, "show all principles", "focus banner offers a way back");
  /* toggling the same principle unpins it */
  global.ANZ.focusPrinciple("LSP");
  const cleared = global.ANALYZER.render();
  notIncludes(cleared, '<div class="anz-focus"', "focus banner gone after unpinning");
});

test("a fresh scan clears any pinned principle", () => {
  global.ANZ.loadExample();
  global.ANZ.focusPrinciple("LSP");
  global.ANZ.scan();             // re-scan
  const html = global.ANALYZER.render();
  notIncludes(html, '<div class="anz-focus"', "re-scan drops the focus pin");
});

test("draft action bar shows the active mode badge and a mode-specific hint", () => {
  global.ANZ.loadExample();
  global.ANZ.mode("violations");
  global.ANZ.tab("draft");
  const html = global.ANALYZER.render();
  includes(html, "Violations mode", "draft action bar names the active mode");
  includes(html, "principles with none get a one-line note", "violations-mode draft hint");
  global.ANZ.mode("full");
  global.ANZ.tab("findings");
});

test("buildAnswer respects the active mode (implementations draft carries no violation language)", () => {
  /* loadExample scans the in-module demo; the demo text is exported so we can
     recompute its finding keys and tick the presence ones via the public toggle */
  const A2 = require("../data/analyzer-core.js");
  global.ANZ.loadExample();
  global.ANZ.mode("implementations");
  const demoText = global.ANALYZER.DEMO; // the built-in demo, exposed for tests
  const findings = A2.scan([{ name: global.ANALYZER.DEMO_NAME, text: demoText }]).findings;
  const presence = findings.filter((f) => f.kind === "presence");
  ok(presence.length >= 1, "the demo must yield at least one presence finding");
  presence.forEach((f) => global.ANZ.toggle(f.ruleId + "|" + f.file + "|" + f.line, true));
  global.ANZ.buildAnswer();
  global.ANZ.tab("draft");
  const html = global.ANALYZER.render();
  /* the draft textarea now holds an implementations-only answer */
  notIncludes(html, "Violation &mdash;", "no violation heading should be escaped into the draft");
  notIncludes(html, "Violation —", "implementations draft must not contain violation paragraphs");
  includes(html, "Implementations mode", "the draft bar confirms implementations mode");
  global.ANZ.mode("full");
  global.ANZ.tab("findings");
});

/* ======================================================================
   OPTIONAL PROJECT EXPORT (window.PROJZIP) — graceful hidden-button fallback.
   The Analysis Lab may hand the pasted P1 code back as a runnable .zip, but
   projzip-core.js is NOT wired into index.html by the analyzer agent, so the
   button MUST stay hidden (and the handler must stay safe) until PROJZIP is
   loaded. These tests pin both halves of that contract.
   ====================================================================== */
test("export button is hidden when window.PROJZIP is absent (graceful fallback)", () => {
  const saved = global.PROJZIP;
  try {
    delete global.PROJZIP;                 // simulate projzip-core.js not loaded
    global.localStorage.removeItem("aop-analyzer-state");
    global.ANZ.loadExample();              // there IS code, so only PROJZIP gates the button
    const html = global.ANALYZER.render();
    notIncludes(html, "Download project (.zip)", "no export button without PROJZIP");
    /* the handler must also be a no-op (not throw) when PROJZIP is missing */
    global.ANZ.downloadZip();              // must not throw
  } finally {
    if (saved) global.PROJZIP = saved; else delete global.PROJZIP;
  }
});

test("export button is hidden when PROJZIP is present but there is no pasted code", () => {
  const saved = global.PROJZIP;
  try {
    global.PROJZIP = require("../data/projzip-core.js");
    /* clear every tab back to a single empty Program.cs so there is no code to
       package (removeFile collapses to one empty file when the last is removed).
       Loop generously to cover whatever files earlier tests left in module state. */
    for (let i = 0; i < 12; i++) global.ANZ.removeFile(0);
    const html = global.ANALYZER.render(); // empty files => nothing to package
    notIncludes(html, "Download project (.zip)", "no export button when there is no code");
  } finally {
    if (saved) global.PROJZIP = saved; else delete global.PROJZIP;
  }
});

test("export button renders and downloadZip packages the pasted code when PROJZIP is loaded", () => {
  const saved = global.PROJZIP;
  const savedCreate = global.document.createElement;
  let clicked = null, downloadName = null;
  try {
    global.PROJZIP = require("../data/projzip-core.js");
    /* capture the anchor the handler creates+clicks, and give Blob/URL shims so
       makeZipBlobUrl works headlessly */
    global.Blob = global.Blob || function (parts) { this.parts = parts; };
    global.URL = global.URL || {};
    global.URL.createObjectURL = function () { return "blob:fake"; };
    global.URL.revokeObjectURL = function () {};
    global.document.body = global.document.body || { appendChild() {}, removeChild() {} };
    global.document.createElement = function (tag) {
      if (tag === "a") {
        const a = { set href(v) { this._h = v; }, get href() { return this._h; },
                    click() { clicked = this; downloadName = this.download; } };
        return a;
      }
      return savedCreate ? savedCreate.call(global.document, tag) : {};
    };
    global.localStorage.removeItem("aop-analyzer-state");
    global.ANZ.loadExample();              // OrderService demo => real C# to package
    const html = global.ANALYZER.render();
    includes(html, "Download project (.zip)", "export button shows with PROJZIP + code");

    global.ANZ.downloadZip();
    ok(clicked, "downloadZip must create and click a download anchor");
    ok(/\.zip$/.test(downloadName || ""), "the download must target a .zip file, got " + downloadName);

    /* and the entries the handler builds are a real, buildable console project */
    const entries = global.PROJZIP.consoleProject("X", { extraFiles: [{ path: "Example.cs", text: global.ANALYZER.DEMO }] });
    ok(entries.some((e) => /\.csproj$/.test(e.path)), "the packaged project must contain a .csproj");
    ok(entries.some((e) => e.path === "Example.cs"), "the pasted file must be copied into the project");
    const bytes = global.PROJZIP.makeZip(entries);
    ok(bytes.length > 0 && bytes[0] === 0x50 && bytes[1] === 0x4b, "makeZip must emit a real PK zip");
  } finally {
    global.document.createElement = savedCreate;
    if (saved) global.PROJZIP = saved; else delete global.PROJZIP;
  }
});

/* ======================================================================
   LOADFIXTURE CONFIRM GUARD — loadFixture() replaces ALL pasted tabs
   (unlike loadExample, which appends). When the current state holds
   non-empty user code, it must confirm before wiping it. The guard only
   fires when a global confirm() exists, so the legacy Node behaviour
   (replace-and-go, no confirm) is preserved and the rest of the suite is
   untouched. These tests pin all three branches: cancel, accept, legacy.
   ====================================================================== */
require("../data/exam-fixtures.js"); // sets global.EXAM_FIXTURES for loadFixture
(function () {
  const savedConfirm = Object.prototype.hasOwnProperty.call(global, "confirm") ? global.confirm : undefined;
  const hadConfirm = Object.prototype.hasOwnProperty.call(global, "confirm");
  function restoreConfirm() {
    if (hadConfirm) global.confirm = savedConfirm; else delete global.confirm;
  }
  /* seed module state with non-empty pasted user code, distinct from any fixture */
  function seedUserCode() {
    global.localStorage.removeItem("aop-analyzer-state");
    global.ANZ.loadExample(); // populates the single Example.cs tab with the demo
  }

  test("loadFixture leaves pasted code untouched when confirm() returns false", () => {
    seedUserCode();
    const before = JSON.parse(global.localStorage.getItem("aop-analyzer-state"));
    global.confirm = function () { return false; };
    try {
      global.ANZ.loadFixture("summer2025");
    } finally { restoreConfirm(); }
    const after = JSON.parse(global.localStorage.getItem("aop-analyzer-state"));
    eq(after.files.length, before.files.length, "cancelling confirm must not change the file count");
    eq(after.files[0].name, before.files[0].name, "cancelling confirm must keep the pasted file name");
    eq(after.files[0].text, before.files[0].text, "cancelling confirm must keep the pasted file text");
    notIncludes(after.files.map((f) => f.name).join("|"), "DocumentWorkflowManager", "no fixture file leaked in on cancel");
  });

  test("loadFixture replaces pasted code when confirm() returns true", () => {
    seedUserCode();
    global.confirm = function () { return true; };
    try {
      global.ANZ.loadFixture("summer2025");
    } finally { restoreConfirm(); }
    const after = JSON.parse(global.localStorage.getItem("aop-analyzer-state"));
    includes(after.files.map((f) => f.name).join("|"), "DocumentWorkflowManager", "accepting confirm must load the fixture files");
    ok(after.answerKey && /Summer 2025/.test(after.answerKey.label), "accepting confirm must stash the fixture answer key");
  });

  test("loadFixture replaces pasted code with no confirm defined (legacy Node behaviour)", () => {
    seedUserCode();
    restoreConfirm();
    if (Object.prototype.hasOwnProperty.call(global, "confirm")) delete global.confirm; // ensure confirm is absent
    global.ANZ.loadFixture("reexam2025");
    const after = JSON.parse(global.localStorage.getItem("aop-analyzer-state"));
    includes(after.files.map((f) => f.name).join("|"), "Core.cs", "with no confirm, the fixture replaces as before");
    ok(after.answerKey && /Re-exam 2025/.test(after.answerKey.label), "legacy path still stashes the answer key");
    restoreConfirm();
  });
})();

/* ======================================================================
   SPEC 18 §A — June rubric mode UI: the fourth mode chip ("June rubric"),
   the "Copy as Problem_1_Submission.txt" button on the Draft pane, and the
   ANZ.copySubmission handler. The headless DOM shim above makes paint()/byId
   no-ops so render() and the handlers run in Node.
   ====================================================================== */
require("../data/analyzer.js");
require("../data/exam-fixtures.js");

test("june: render() shows the fourth mode chip labelled 'June rubric'", () => {
  global.localStorage.removeItem("aop-analyzer-state");
  global.ANZ.loadFixture("summer2025");      // real DocumentManager fixture + scan
  global.ANZ.mode("june");
  const html = global.ANALYZER.render();
  includes(html, "June rubric", "the June rubric mode chip must render");
  const juneAt = html.indexOf("June rubric");
  const activeAt = html.lastIndexOf("anz-mode-chip active", juneAt);
  ok(activeAt !== -1 && activeAt < juneAt, "the June rubric chip is active after switching to june mode");
  global.ANZ.mode("full");
});

test("june: ANZ.mode('june') persists and is exposed as a real mode", () => {
  global.ANZ.loadFixture("summer2025");
  global.ANZ.mode("june");
  const saved = JSON.parse(global.localStorage.getItem("aop-analyzer-state"));
  eq(saved.mode, "june", "june mode must persist to aop-analyzer-state");
  ok(typeof global.ANZ.copySubmission === "function", "ANZ.copySubmission handler must exist");
  global.ANZ.mode("full");
});

test("june: the 'Copy as Problem_1_Submission.txt' button shows on the Draft pane in june mode only", () => {
  global.ANZ.loadFixture("summer2025");
  global.ANZ.mode("june");
  global.ANZ.tab("draft");
  const juneHtml = global.ANALYZER.render();
  includes(juneHtml, "Copy as Problem_1_Submission.txt", "the submission-copy button must appear in june mode");
  includes(juneHtml, "June rubric mode", "the draft action bar names the June rubric mode");

  /* the button is june-only: it must NOT appear in the other modes' draft pane */
  global.ANZ.mode("full");
  const fullHtml = global.ANALYZER.render();
  notIncludes(fullHtml, "Copy as Problem_1_Submission.txt", "the submission button is june-only, hidden in full mode");
  global.ANZ.tab("findings");
});

test("june: buildAnswer with NOTHING ticked still produces a complete 1.1-1.5 draft (one-click)", () => {
  /* unlike the August modes (which demand a tick), June builds from all scanned
     findings when nothing is ticked, so Max gets the full answer in one click */
  global.localStorage.removeItem("aop-analyzer-state");
  global.ANZ.loadFixture("summer2025");
  global.ANZ.mode("june");
  /* ensure no findings are ticked */
  const saved = JSON.parse(global.localStorage.getItem("aop-analyzer-state"));
  eq(Object.keys(saved.checked || {}).length, 0, "precondition: nothing ticked");
  global.ANZ.buildAnswer();
  global.ANZ.tab("draft");
  const html = global.ANALYZER.render();
  ["1.1 General analysis", "1.4 SOLID principles", "1.5 Design pattern"].forEach((h) =>
    includes(html, h, "an unticked June build must still contain " + h));
  /* it reproduces the calibration substance from the files alone */
  includes(html, "IProcessable", "names the capability interfaces even with nothing ticked");
  includes(html, "NO class-to-class inheritance", "states the inheritance honesty even with nothing ticked");
  global.ANZ.mode("full");
  global.ANZ.tab("findings");
});

test("june: buildAnswer in june mode produces a 1.1-1.5 draft and copySubmission strips the heading decoration", () => {
  /* tick the fixture's findings, build the June draft, then drive the public
     copySubmission handler. Give a realistic createElement/body/execCommand shim
     so the clipboard-fallback path runs end to end and we can capture what it
     would copy (clipboard API is absent in Node). Restored in finally. */
  const A2 = require("../data/analyzer-core.js");
  const savedCreate = global.document.createElement;
  const savedBody = global.document.body;
  const savedExec = global.document.execCommand;
  let copied = null;
  try {
    global.document.createElement = function () {
      return { style: {}, set value(v) { this._v = v; copied = v; }, get value() { return this._v; }, select() {} };
    };
    global.document.body = { appendChild() {}, removeChild() {} };
    global.document.execCommand = function () { return true; };

    global.ANZ.loadFixture("summer2025");
    global.ANZ.mode("june");
    const sc = A2.scan(global.EXAM_FIXTURES.summer2025.files);
    sc.findings.forEach((f) => global.ANZ.toggle(f.ruleId + "|" + f.file + "|" + f.line, true));
    global.ANZ.buildAnswer();
    global.ANZ.tab("draft");
    const html = global.ANALYZER.render();
    includes(html, "1.1 General analysis", "the June draft is rendered into the answer textarea");
    includes(html, "1.5 Design pattern", "all five June sections reach the draft");

    /* the textarea lookup returns null in this shim, so copySubmission reads the
       persisted draftText; the fallback copy captures the plain submission text */
    global.ANZ.copySubmission(null);
    ok(copied && copied.indexOf("1.1 General analysis") !== -1, "copySubmission copies the June draft");
    ok(copied.indexOf("=== 1.1") === -1, "copySubmission strips the '=== ===' heading decoration");
    ok(copied.indexOf("1.5 Design pattern") !== -1, "the plain 1.1-1.5 headings survive in the copied text");
  } finally {
    global.document.createElement = savedCreate;
    global.document.body = savedBody;
    global.document.execCommand = savedExec;
    global.ANZ.mode("full");
    global.ANZ.tab("findings");
  }
});

/* ======================================================================
   ANALYZER-2 (staleness) — the Analysis Lab intro + empty-state must frame
   the 2026 reality: SOLID/OOP/patterns are now tested via the 20 MCQs (no
   written Problem 1), and this lab trains that pattern-spotting on real code.
   The intro is in render(); the empty-state lives in resultsHTML() (only
   reachable before a scan), so we pin its current copy against the module
   source string. Detection logic is unchanged, so the mode chips/headings
   that the other tests assert must all still be present.
   ====================================================================== */
test("analyzer-2: the intro paragraph frames the 2026 MCQ reality, not a written Problem 1", () => {
  global.localStorage.removeItem("aop-analyzer-state");
  global.ANZ.loadFixture("summer2025");      // any scanned state; the intro is mode-independent
  global.ANZ.mode("full");
  const html = global.ANALYZER.render();
  includes(html, "20 MCQs", "the intro must state that SOLID/OOP/patterns are now tested via the 20 MCQs");
  includes(html, "pattern-spotting", "the intro must frame the lab as pattern-spotting practice");
  /* the stale 'Problem 1 codebase' framing must be gone from the intro prose */
  notIncludes(html, "Paste the Problem 1 codebase",
     "the stale written-Problem-1 framing must be removed from the intro");
  global.ANZ.mode("full");
  global.ANZ.tab("findings");
});

test("analyzer-2: the empty-state copy reflects the 2026 MCQ reality", () => {
  /* resultsHTML()'s empty-state only renders before a scan (lastScan persists
     across the suite), so pin the source copy directly. */
  includes(src, "there is no written Problem 1",
     "the empty-state must state plainly there is no written Problem 1 in 2026");
  includes(src, "20 MCQs", "the empty-state must point at the 20 MCQs");
  notIncludes(src, "Paste the exam&#39;s .cs files on the left (one tab per file) and press <b>Scan</b>, or load a real 2025 exam below. Every finding is a lead to verify against the code — confirm it, tick it, build the answer. Green cards are principles you got <b>right</b>; tick them too — the rubric scores presence.",
     "the stale empty-state copy must be replaced");
});

test("analyzer-2: the module header no longer calls the lab a 'Problem 1 solver'", () => {
  notIncludes(src, "Problem 1 solver", "the stale 'Problem 1 solver' header label must be updated");
});
