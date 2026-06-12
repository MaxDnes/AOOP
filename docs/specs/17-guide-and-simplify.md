# Spec 17: Exam Guide tab + conservative simplification pass

Read docs/specs/00-master-plan.md first. v3 through v6 are merged and green
(393/0): every solver tool has a project .zip export (spec 13), the polish
pass (spec 14), analyzer attribution fixes (spec 15), and the flat 6-file
submission export (spec 16). NEVER regress any of it; extend.

## Why this spec exists

Max asked for two things two days before the exam:
1. A Guide tab inside the app that explains how to use all the tools in
   tandem during the 4-hour exam: which tool solves which problem, in what
   order, what to click, what to verify, and what to hand in.
2. A review of the whole system with careful simplification and improvement
   where it is safe. The exam is in ~2 days and the suite is green, so the
   bar for any change is: user-visible value or risk reduction, low
   regression risk, and still fully covered by tests afterwards.

## Part A: the Guide agent

File ownership (complete list, never touch anything else):
data/guide.js, guide.css, tests/guide.test.js (all three are NEW files).

Contract:
- data/guide.js defines a global GUIDE object (window.GUIDE, plus the same
  guarded module.exports pattern every other tool file uses) with a
  render() function that returns the full tab HTML as a string. app.js
  mounts it via content.innerHTML = GUIDE.render() exactly like the other
  module tools. No app.js/index.html edits from this agent; the
  integration agent registers the tool.
- Navigation to other tools uses the global go('<toolId>') in inline
  onclick handlers (toolIds: analyzer, designer, asynclab, testlab,
  querylab, quiz, lab, builder). Copy buttons use a self-contained
  copyText helper inside guide.js, same pattern as data/asynclab.js.
- guide.css carries all new styles, every class prefixed gd-. Reuse the
  app shell classes (content-inner, crumb, topic-title, bp, kbd, homegrid,
  homecard) where they fit instead of re-inventing them.
- Everything works from file:// offline, vanilla JS, no modules, no fetch.

Content, in this order (plain casual prose, no em dashes, no bold):

1. Hero: one line that maps the exam to the tools. P1 written analysis ->
   Analysis Lab. P2 Avalonia UI -> Visual Designer. P3 async ->
   Async Composer, with Test Lab as the self-check. P4 JSON + LINQ ->
   Query Lab. Render the four plays as clickable cards (go() links).
2. Minute zero (before reading the exam): run the environment check, with
   the command in a copyable code block:
   & "C:\Users\Max\Desktop\AOP Exam Companion\scripts\verify-exam-env.ps1"
   plus one line on the offline-feed fallback (make-offline-feed.ps1 and
   dotnet restore --configfile scripts\nuget.offline.config).
3. Identify the exam family in 2 minutes: Canvas + rectangles + sliders
   means Summer family (RectangleUI / spaceships); two ListBoxes +
   Generate button means ReExam family (MealPlanner / Counter / recipes).
   Say which model solution folder and in-app topics to lean on.
4. The four plays, one block per problem, each with: time budget
   (P1 45 min, P2 75 min, P3 45 min, P4 60 min, packaging 15 min), the
   numbered click path through its tool, what to copy or download, and how
   to verify before moving on. Must include:
   - The two-button rule, stated once and referenced per play: the green
     Export project (.zip) button proves your code builds (unzip, dotnet
     build / run / test); the Download submission files button produces
     exactly what you hand in (professor file names).
   - P1: scan, pick the mode chips, build the Full-answer Draft, copy it
     out; the draft is the deliverable, there is no P1 submission file.
   - P2: build or load the closest preset, adapt, verify with the zip
     export, then Download submission files (model class gets inlined
     into the VM file automatically).
   - P3: configure the worker in Async Composer, verify with the zip
     export, optionally paste the VM into Test Lab to generate self-check
     tests (those tests are NOT handed in), then Download submission
     files.
   - P4: paste the exam JSON first and let the model infer, add the query
     rows, verify with the zip export (cd into the unzipped folder before
     dotnet run), then Download submission files.
5. The submission ritual: the flat 6-file folder with the six EXACT names
   from spec 16 rendered verbatim, no bin, no obj, no subfolders; run
   scripts\verify-submission.ps1 before handing in; the P3 filename trap
   (the manifest and starter say Problem_3_MainWindowViewModel.cs, follow
   the manifest, never the prose).
6. When things break: locked obj or hung build means dotnet build-server
   shutdown; restore failing offline means the configfile command from
   section 2; CS0414 about an unused _timerRunning field is harmless;
   the full runbook is README-EXAM-DAY.md next to index.html.
7. Keys: / to search, H for home, j and k to walk Code Lab lines.

Tests (tests/guide.test.js, wired into the auto-discovering runner):
- GUIDE global exists, render() returns a string of meaningful length.
- All six submission file names appear verbatim, exactly once each in the
  submission section.
- go() links exist for analyzer, designer, asynclab, testlab, querylab.
- verify-exam-env.ps1 and verify-submission.ps1 both appear.
- The P3 trap names Problem_3_MainWindowViewModel.cs as the file to use.
- The output contains no em dash character, no <b> or <strong> tags, and
  no markdown ** bold markers.
- Time budgets 45/75/45/60/15 all present.
- HTML sanity: angle-bracket balance for div tags (same xmlBalanced-style
  helper the other suites use, simplified is fine).

Definition of done: own test file green standalone AND the new file is
picked up by node tests/run-tests.js (auto-discovery); render() output
desk-checks as coherent HTML; prose follows the style rules.

## Part B: review agents (read-only)

Six parallel agents, one per area, NO file edits, returning structured
findings only. Areas and the files they read:
- shell: app.js, index.html, styles.css, README.txt, README-EXAM-DAY.md
- designer: designer-core.js, designer.js, designer.css + their tests
- testlab: testlab-core.js, testlab.js, testlab.css + tests
- querylab: querylab-core.js, querylab.js, querylab.css + tests
- asynclab: asynclab-core.js, asynclab.js, asynclab.css + tests
- analyzer+cores: analyzer-core.js, analyzer.js, exam-fixtures.js,
  projzip-core.js, tests/run-tests.js + tests

Each finding: file, exact location, what is wrong or improvable, why it
matters for the exam, the minimal fix, and a risk grade (low/medium/high).
Hunt for: dead code, stale or wrong user-facing text, UX traps (a click
path that silently does nothing, a hint that lies, an error that throws
instead of rendering), inconsistencies between tools (button labels,
hint wording, copy feedback), and genuinely unnecessary complexity that
can be deleted without behavior change. Do NOT propose cross-file
refactors, shared-helper extractions, API renames, or stylistic rewrites;
ownership boundaries from specs 14/16 stay law.

## Part C: fix agents (after orchestrator triage)

The orchestrator (main session) triages Part B findings and dispatches at
most one fix agent per tool area with an explicit list of approved fixes.
Rules: behavior-preserving unless the approved finding says otherwise;
never rename an exported core function; tests may only change where a
deliberately changed user-visible string is asserted; each agent re-runs
its own test file; ownership lists are the Part B read lists minus shell
(shell fixes belong to the integration agent).

## Part D: integration agent (runs ALONE, last before verify)

File ownership: app.js, index.html, styles.css, README.txt,
README-EXAM-DAY.md, tests/integration.test.js.

1. Register the guide tool FIRST in the TOOLS registry in app.js (it is
   the orientation tab): id "guide", label "Exam Guide", sub "the 4-hour
   plan, tool by tool", icon "★", color "#e6b450", module "GUIDE",
   homeTitle "How to run the exam", homeDesc one plain sentence. Keep the
   other eight entries and their relative order untouched.
2. index.html: guide.css link beside the other tool css links; data/guide.js
   script tag with the other tool UI scripts (guide has no core file; place
   it after asynclab.js with a one-line comment).
3. tests/integration.test.js: the eight-tools assertions become nine-tools
   (registry id list, order check, script-tag existence); add guide.js to
   the Node-loadability sweep if one exists.
4. Apply the shell-area fixes the orchestrator approved from Part B,
   exactly as approved, nothing more.
5. README.txt gets a short Exam Guide paragraph in the tools list;
   README-EXAM-DAY.md section 2 gets one line saying the same plan lives
   in the app as the Exam Guide tab.
6. Full suite green: node tests/run-tests.js (baseline 393 passing, more
   after the guide tests land).

## Verify (loop, up to 3 fix rounds)

1. node tests/run-tests.js fully green.
2. Static integrity: every script src and css link in index.html exists;
   node --check on app.js and every data/*.js.
3. Guide content in Node: require data/guide.js with the standard stubs,
   assert the six exact submission names, the five go() tool links, both
   ps1 script names, and the style rules (no em dash, no bold).
4. Registry: TOOLS has nine entries with guide first; search() surfaces
   guide for "guide", "plan" and "submission" queries if search reads the
   registry (it does; confirm, do not force).
5. Regression canary: one designer Summer preset avaloniaProject zip ->
   expand -> dotnet build green (proves the solver chain still works
   end to end after any simplification fixes).
6. If any tool files changed in Part C, that tool's own test file passes
   standalone in addition to the suite.
