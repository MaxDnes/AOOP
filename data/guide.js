/* ============================================================
   EXAM GUIDE · the 4-hour plan, tool by tool (orientation tab)
   window.GUIDE = { render, init }
   Copy buttons live on window.GD. Pure string rendering; the
   module loads under Node for tests (no document access at load
   time, only inside functions). Navigation reuses the global
   go('<toolId>'); copy uses a self-contained copyText helper,
   same pattern as data/asynclab.js. All new styles are in
   guide.css, every class prefixed gd-.
   ============================================================ */

(function (global) {
"use strict";

/* ---------------- helpers ---------------- */
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* the four play cards: exam problem -> the tool that solves it */
const PLAYS = [
  { tool: "analyzer", label: "Analysis Lab", icon: "⌖", color: "#f07178",
    p: "P1", title: "Written OOP / SOLID analysis",
    desc: "Paste the Problem 1 console project, scan for violations, build the full-answer draft, copy it out." },
  { tool: "designer", label: "Visual Designer", icon: "⌗", color: "#7fd962",
    p: "P2", title: "Avalonia MVVM UI",
    desc: "Load or drag the closest preset, adapt it, then download the two graded files for Problem 2." },
  { tool: "asynclab", label: "Async Composer", icon: "↻", color: "#d2a6ff",
    p: "P3", title: "Async worker / counter",
    desc: "Configure the worker, verify it, optionally self-check in Test Lab, then download the Problem 3 pair." },
  { tool: "querylab", label: "Query Lab", icon: "⌹", color: "#39bae6",
    p: "P4", title: "JSON deserialize + LINQ",
    desc: "Paste the exam JSON, click the query rows, then download Program.cs and Models.cs for Problem 4." },
];

/* the six exact submission file names (spec 16), rendered verbatim once each
   in the submission section. Order matches the flat folder layout. */
const SUBMISSION_FILES = [
  "Problem_2_MainWindowViewModel.cs",
  "Problem_2_MainWindow.axaml",
  "Problem_3_MainWindowViewModel.cs",
  "Problem_3_MainWindow.axaml",
  "Problem_4_Program.cs",
  "Problem_4_Models.cs",
];

/* a copyable command line: mono code block + a copy button wired to GD.copy */
function codeLine(cmd) {
  return '<div class="gd-code">' +
    '<code class="gd-code-text">' + esc(cmd) + "</code>" +
    '<button class="gd-copy copybtn" onclick="GD.copy(this)" data-cmd="' + esc(cmd) + '">copy</button>' +
    "</div>";
}

function toolCard(play) {
  return '<div class="gd-play homecard" style="--cat-color:' + play.color +
    '" onclick="go(\'' + play.tool + "')\">" +
    '<div class="gd-play-top"><span class="gd-play-icon">' + play.icon + "</span>" +
    '<span class="gd-play-p">' + esc(play.p) + "</span></div>" +
    '<div class="hc-cat">' + esc(play.label) + "</div>" +
    '<div class="hc-title">' + esc(play.title) + "</div>" +
    '<div class="hc-desc">' + esc(play.desc) + "</div></div>";
}

/* a numbered click path inside a play block */
function steps(items) {
  return '<ol class="gd-steps">' +
    items.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") +
    "</ol>";
}

function section(id, kicker, title, bodyHtml) {
  return '<section class="gd-section" id="' + id + '">' +
    '<div class="gd-kicker">' + esc(kicker) + "</div>" +
    '<h2 class="gd-h2">' + esc(title) + "</h2>" +
    bodyHtml + "</section>";
}

/* a single play block: header with time budget, the steps, the verify line */
function play(opts) {
  let h = '<div class="gd-block" style="--cat-color:' + opts.color + '">';
  h += '<div class="gd-block-head">';
  h += '<span class="gd-block-p">' + esc(opts.p) + "</span>";
  h += '<span class="gd-block-title">' + esc(opts.title) + "</span>";
  h += '<span class="gd-budget">' + esc(opts.budget) + "</span>";
  h += "</div>";
  h += '<div class="gd-block-tool">Tool: <a class="gd-link" onclick="go(\'' +
    opts.tool + "')\">" + esc(opts.toolLabel) + "</a>";
  if (opts.selfCheck) {
    h += '<span class="gd-block-sep"> · self-check: </span>' +
      '<a class="gd-link" onclick="go(\'' + opts.selfCheck.tool + "')\">" +
      esc(opts.selfCheck.label) + "</a>";
  }
  h += "</div>";
  h += steps(opts.steps);
  if (opts.deliver) h += '<div class="gd-deliver">' + opts.deliver + "</div>";
  h += "</div>";
  return h;
}

/* ---------------- the page ---------------- */
function render() {
  let h = '<div class="content-inner content-wide gd">';

  /* crumb + title (no <b> tag: the guide style rule forbids bold markup) */
  h += '<div class="crumb"><span class="gd-crumb-label">EXAM GUIDE</span></div>';
  h += '<h1 class="topic-title">How to run the exam</h1>';

  /* 1. hero: one line mapping the exam to the tools, then the four plays */
  h += '<p class="bp gd-hero">Four problems, four tools. Problem 1 written analysis goes through the ' +
    'Analysis Lab. Problem 2 Avalonia UI is the Visual Designer. Problem 3 async is the Async Composer, ' +
    'with Test Lab as your self-check. Problem 4 JSON and LINQ is the Query Lab. Click a card to jump ' +
    'straight there.</p>';
  h += '<div class="homegrid gd-plays">';
  PLAYS.forEach(function (p) { h += toolCard(p); });
  h += "</div>";

  /* 2. minute zero: environment check */
  h += section("gd-minute-zero", "Minute zero", "Before you read the exam, check the machine",
    '<p class="bp">Open PowerShell 7 and run the environment check. It must end with all checks passed. ' +
    'This proves .NET 9, an offline restore, and a headless xUnit test all work with the network off.</p>' +
    codeLine('& "C:\\Users\\Max\\Desktop\\AOP Exam Companion\\scripts\\verify-exam-env.ps1"') +
    '<p class="bp gd-fallback">If it fails on the offline feed (a fresh lab machine with an empty feed), ' +
    'rebuild the feed with make-offline-feed.ps1, then re-run the check. If any later restore hits network ' +
    'errors, force it offline by pointing at the feed:</p>' +
    codeLine('dotnet restore --configfile scripts\\nuget.offline.config'));

  /* 3. identify the exam family in 2 minutes */
  h += section("gd-family", "First 2 minutes", "Identify the exam family",
    '<div class="gd-family-grid">' +
    '<div class="gd-fam">' +
      '<div class="gd-fam-h">Summer family</div>' +
      '<p class="gd-fam-tell">Tell: a Canvas with rectangles and sliders (RectangleUI, spaceships).</p>' +
      '<p class="gd-fam-lean">Lean on the AOP Model Solutions Summer2025 folder, plus the RectangleUI ' +
      'and Canvas topics in Code Lab and the Design Gallery. In Query Lab load the Summer spaceships preset.</p>' +
    "</div>" +
    '<div class="gd-fam">' +
      '<div class="gd-fam-h">ReExam family</div>' +
      '<p class="gd-fam-tell">Tell: two ListBoxes and a Generate button (MealPlanner, Counter, recipes).</p>' +
      '<p class="gd-fam-lean">Lean on the AOP Model Solutions ReExam2025 folder, plus the MealPlanner and ' +
      'async counter topics. In Query Lab load the ReExam recipes preset; the Async Composer default is ' +
      'already the verified ReExam counter.</p>' +
    "</div>" +
    "</div>" +
    '<p class="bp gd-fam-note">The F26 paper is most likely a variation of one of these two. Pick the ' +
    'family, open the matching model solution folder, and adapt from there.</p>');

  /* the two-button rule, stated once, referenced per play */
  h += section("gd-two-buttons", "The rule for every solver", "Two buttons, two jobs",
    '<div class="gd-twobtn">' +
    '<div class="gd-twobtn-row gd-twobtn-zip">' +
      '<span class="gd-twobtn-name">Export project (.zip)</span>' +
      '<span class="gd-twobtn-job">proves your code builds. Unzip it, then dotnet build, dotnet run or ' +
      'dotnet test. This is for checking, not for handing in.</span>' +
    "</div>" +
    '<div class="gd-twobtn-row gd-twobtn-submit">' +
      '<span class="gd-twobtn-name">Download submission files</span>' +
      '<span class="gd-twobtn-job">produces exactly what you hand in, with the professor file names. ' +
      'Build with the zip, submit with these.</span>' +
    "</div>" +
    "</div>");

  /* 4. the four plays, one block each */
  let plays = "";
  plays += play({
    p: "P1", title: "Written OOP / SOLID analysis", budget: "45 min",
    tool: "analyzer", toolLabel: "Analysis Lab", color: "#f07178",
    steps: [
      "Paste the whole Problem 1 console project into the Analysis Lab and scan it.",
      "Read the findings, each with its code location and the SOLID principle it touches.",
      "Pick the mode chips: full for everything, violations for what is broken, implementations for what is already honored. Answer presence first.",
      "Tick the findings you will use, then build the Full-answer Draft and copy it out.",
    ],
    deliver: "The draft is the deliverable. Problem 1 has no submission file in the flat set, so there is " +
      "nothing to download here. Paste the draft into the channel the exam paper names.",
  });
  plays += play({
    p: "P2", title: "Avalonia MVVM UI", budget: "75 min",
    tool: "designer", toolLabel: "Visual Designer", color: "#7fd962",
    steps: [
      "Build or load the closest preset, then adapt it to match the exam screenshot. Leave the code-behind untouched.",
      "Verify with Export project (.zip): unzip, dotnet build, dotnet run, and eyeball the window.",
      "When it looks right, click Download submission files.",
    ],
    deliver: "That downloads the two graded Problem 2 files. Any typed model class is inlined into the " +
      "ViewModel file automatically, because the flat set allows no third file per problem.",
  });
  plays += play({
    p: "P3", title: "Async worker / counter", budget: "45 min",
    tool: "asynclab", toolLabel: "Async Composer", color: "#d2a6ff",
    selfCheck: { tool: "testlab", label: "Test Lab" },
    steps: [
      "Configure the worker in the Async Composer: pattern, mechanism, interval, step, commands. The default is the verified ReExam counter.",
      "Verify with Export project (.zip): unzip, dotnet build, dotnet run.",
      "Optional self-check: paste the ViewModel into Test Lab to generate timing-tolerant tests and run dotnet test. Those tests are NOT handed in.",
      "Click Download submission files.",
    ],
    deliver: "That downloads the Problem 3 pair. The filename to use is the manifest one " +
      "(see the submission ritual below for the trap).",
  });
  plays += play({
    p: "P4", title: "JSON deserialize + LINQ", budget: "60 min",
    tool: "querylab", toolLabel: "Query Lab", color: "#39bae6",
    steps: [
      "Paste the exam JSON FIRST and let Query Lab infer the model; missing and null fields become nullable, which is the planted trap.",
      "Add the query rows in the order the paper asks, and reorder them if needed.",
      "Verify with Export project (.zip): unzip, cd into the unzipped folder, then dotnet run so the data file resolves.",
      "Click Download submission files.",
    ],
    deliver: "That downloads Program.cs and Models.cs for Problem 4. Check the printed results use the " +
      "EXACT key names from the paper before you move on.",
  });
  h += section("gd-plays-detail", "The four plays", "One block per problem, in order", plays);

  /* 4b. the supporting cast: the tools that back the four plays up */
  let cast = '<p class="bp">The four solvers are the main act; these back them up when you are ' +
    'stuck or want a different angle.</p>';
  cast += '<ul class="gd-cast">';
  cast += '<li><a class="gd-link" onclick="go(\'builder\')">UI Builder</a>: tick features (list, ' +
    'buttons, timer, canvas, JSON) and get a complete ViewModel plus AXAML in one shot. The fast path ' +
    'for P2 or P3 when you already know exactly what you need and dragging it out in the Designer ' +
    'would be slower.</li>';
  cast += '<li><a class="gd-link" onclick="go(\'lab\')">Code Lab</a>: the nine exam-critical files ' +
    'explained line by line. When a model-solution line looks like magic, find it here and read the ' +
    'why before you copy it. Walk with j and k.</li>';
  cast += '<li>Reference topics: press <span class="kbd">/</span> and search anything: GroupBy, ' +
    'OrderBy, lock, RelayCommand, JsonSerializer, DispatcherTimer. The LINQ category holds the exact ' +
    'query patterns Query Lab generates, with the reasoning, and the written-answer quotes for P1 ' +
    'live in the SOLID and playbook topics.</li>';
  cast += '<li><a class="gd-link" onclick="go(\'quiz\')">Quiz</a>: self-test that tracks weak spots. ' +
    'For tonight and tomorrow, not for the exam itself.</li>';
  cast += "</ul>";
  h += section("gd-cast-sec", "The supporting cast", "Builder, Code Lab, topics, Quiz", cast);

  /* 5. the submission ritual: the flat 6-file folder, exact names verbatim */
  let sub = '<p class="bp gd-budget-line">Budget the last <span class="gd-budget">15 min</span> for ' +
    'packaging and verifying. Do not skip it.</p>';
  sub += '<p class="bp">The thing you hand in is one flat folder with exactly these six files and these ' +
    'exact names, nothing else. No bin, no obj, no subfolders.</p>';
  sub += '<div class="gd-folder">';
  sub += '<div class="gd-folder-root">AOP_Exam_Submission/</div>';
  sub += '<ul class="gd-folder-list">';
  SUBMISSION_FILES.forEach(function (name) {
    sub += '<li class="gd-folder-file">' + esc(name) + "</li>";
  });
  sub += "</ul></div>";
  sub += '<p class="bp">Assemble the folder, then verify it before you hand in:</p>';
  sub += codeLine('& "C:\\Users\\Max\\Desktop\\AOP Exam Companion\\scripts\\verify-submission.ps1" -Folder "C:\\path\\to\\your\\submission" -Variant f26');
  sub += '<div class="gd-trap">' +
    '<div class="gd-trap-h">The Problem 3 filename trap</div>' +
    '<p class="gd-trap-body">The ReExam prose tells you to name the async file AutoCounterViewModel.cs, ' +
    'but the submission manifest and the starter file both call it Problem_3_MainWindowViewModel.cs. ' +
    'Follow the manifest, never the prose: submit Problem_3_MainWindowViewModel.cs. The class name inside ' +
    'can stay whatever the starter uses; only the file name you hand in must match the manifest.</p>' +
    "</div>";
  h += section("gd-submission", "Packaging", "The submission ritual", sub);

  /* 6. when things break */
  let fix = '<ul class="gd-fix">';
  fix += '<li><span class="gd-fix-sym">locked obj or a hung build</span>' +
    '<span class="gd-fix-cure">run dotnet build-server shutdown, then build again.</span></li>';
  fix += '<li><span class="gd-fix-sym">restore fails offline</span>' +
    '<span class="gd-fix-cure">point at the feed: dotnet restore --configfile scripts\\nuget.offline.config (rebuild the feed with make-offline-feed.ps1 first if it is empty).</span></li>';
  fix += '<li><span class="gd-fix-sym">CS0414 about an unused _timerRunning field</span>' +
    '<span class="gd-fix-cure">harmless. It is a warning, not an error, and does not block the build.</span></li>';
  fix += "</ul>";
  fix += '<p class="bp gd-runbook">The full runbook is README-EXAM-DAY.md, sitting next to index.html.</p>';
  h += section("gd-break", "When things break", "Quick fixes", fix);

  /* 7. keys */
  let keys = '<ul class="gd-keys">';
  keys += '<li><span class="kbd">/</span> focus search</li>';
  keys += '<li><span class="kbd">H</span> home</li>';
  keys += '<li><span class="kbd">j</span> and <span class="kbd">k</span> walk Code Lab lines, note by note</li>';
  keys += "</ul>";
  h += section("gd-keys-sec", "Keys", "The shortcuts worth knowing", keys);

  h += "</div>";
  return h;
}

/* nothing to wire after mount, but keep the render + init contract the other
   module tools use so app.js can call init() uniformly. */
function init() {}

/* ---------------- copy (self-contained, same pattern as asynclab.js) ---------------- */
function copy(btn) {
  if (!btn) return;
  const text = btn.getAttribute("data-cmd") || "";
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
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
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
const GD = { copy: copy };
const GUIDE = { render: render, init: init, SUBMISSION_FILES: SUBMISSION_FILES };

global.GUIDE = GUIDE;
global.GD = GD;
if (typeof module !== "undefined" && module.exports) module.exports = GUIDE;
})(typeof window !== "undefined" ? window : globalThis);
