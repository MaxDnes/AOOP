# Master Plan: AOP Exam Companion v3 "Task Solvers"

Date: 2026-06-11. Exam in ~3 days. Goal per Max: tools that SOLVE exam tasks for him,
not just reference material. Three solver pillars plus safety net:

1. Visual Designer upgrade: true drag/drop/resize/recolor on a canvas, typed-model
   codegen, exam-matching presets. "Drag elements, get the full Avalonia code."
2. Analysis Lab upgrade: paste the Problem 1 code, get violations AND present
   principles detected, and compose the full written submission draft.
3. Test Lab (NEW): paste any C# class or ViewModel, get proposed xUnit tests,
   headless Avalonia scaffolds, and the offline test-project runbook.
4. Model solutions for both 2025 exams (compile-tested) + exam-day scripts
   (offline NuGet feed, env verify, submission verifier) + quiz upgrades.

## Context every agent needs

The app: `C:\Users\Max\Desktop\AOP Exam Companion\` is a 100% offline single-page app
opened via file:// (double-click index.html). HARD CONSTRAINTS:
- Vanilla JS only, NO ES modules, NO fetch/XHR (file:// blocks it), no external deps.
- Data/code loads via script tags that assign window globals (see index.html).
- Each data/*.js stays loadable in Node for tests (follow the existing pattern at the
  bottom of data/designer-core.js / analyzer-core.js: guarded module.exports).
- Tests: tests/*.test.js auto-discovered by tests/run-tests.js, helpers in tests/t.js
  (test, eq, ok, includes, notIncludes, xmlBalanced). Suite currently 52 passing.
- Run the FULL suite only at the end of your work session:
  `cd "C:\Users\Max\Desktop\AOP Exam Companion" && node tests/run-tests.js`
  While other agents work in parallel, run ONLY your own test file:
  `node -e "require('C:/Users/Max/Desktop/AOP Exam Companion/tests/YOURFILE.test.js'); require('C:/Users/Max/Desktop/AOP Exam Companion/tests/t.js').summary()"`
  If an unrelated test fails during the parallel window, ignore it; your own must pass.

The exam (F26, ~2026-06-14, all offline aids allowed, no internet/AI):
4 problems / 100 pts, stack: .NET 9, Avalonia 11.2.1, CommunityToolkit.Mvvm 8.2.1,
xUnit + Avalonia.Headless.XUnit. Only System/Avalonia/CommunityToolkit.Mvvm allowed.
- P1 (20-25 pts): written OOP/SOLID analysis of a console project with planted
  violations. ReExam rubric: for EACH of the 5 SOLID principles state presence (1),
  how/where with code example (2), general purpose + application here (2).
- P2 (30 pts): Avalonia MVVM UI task, code-behind must stay untouched, starter XAML
  given. Summer 2025: RectangleUI (Canvas + ItemsControl, random rects, sliders,
  2-second recolor timer). ReExam 2025: FamilyMealPlanner (two ListBoxes + Generate
  button, startup population, multi-select highlight of selected meal's ingredients
  via OnSelectedRecipeChanged partial).
- P3 (15-20 pts): create xUnit (+headless) tests, OR async counter (start/stop/
  resume/reset, +1 per 100ms, UI-thread updates).
- P4 (25 pts): JSON deserialize + LINQ queries + serialize results with EXACT key
  names. Planted nulls/missing fields in the JSON.

## Visual language ("the looks")

Existing tokens in styles.css :root, reuse them, never invent new palettes:
ink-0..ink-4 (dark base), --line, --text/--text-dim/--text-faint,
--amber (primary accent), --cyan (secondary), --green (success/presence),
--red (errors/violations), --violet (rare highlight), --mono "Cascadia Code",
--radius 10px. Aesthetic: "exam HUD instrument panel". Dense, monospace flavored,
amber-on-ink. Buttons: ink-3 background, 1px --line border, amber text on hover.
Cards: ink-1/ink-2 background, --radius, 1px --line. Tool-specific CSS lives in the
tool's own css file (designer.css, analyzer.css, quiz.css, testlab.css).

## File ownership (STRICT, agents run in parallel, no git safety net)

- designer agent: data/designer-core.js, data/designer.js, designer.css,
  tests/designer-core.test.js, tests/designer-ui.test.js
- analyzer agent: data/analyzer-core.js, data/analyzer.js, analyzer.css,
  data/exam-fixtures.js (new), tests/analyzer-core.test.js, tests/analyzer-ui.test.js
- testlab agent: data/testlab-core.js (new), data/testlab.js (new), testlab.css (new),
  tests/testlab-core.test.js (new)
- quiz agent: data/quiz.js, data/quiz-bank.js, quiz.css, tests/quiz.test.js,
  tests/quiz-ui.test.js (new)
- summer-solutions agent: C:\Users\Max\Desktop\AOP Model Solutions\Summer2025\** (new),
  data/solutions-summer.js (new)
- reexam-solutions agent: C:\Users\Max\Desktop\AOP Model Solutions\ReExam2025\** (new),
  data/solutions-reexam.js (new)
- scripts agent: scripts/** (new folder in the companion), README-EXAM-DAY.md (new,
  in companion root)
- integration agent (runs AFTER all of the above): app.js, index.html, README.txt,
  styles.css

DO NOT touch index.html or app.js unless you are the integration agent. New tools/
topics get wired in afterwards; just create your own files and make their tests pass.

## Definition of done (global gates)

1. `node tests/run-tests.js` fully green after integration (>= 52 + all new tests).
2. Both model solutions build with `dotnet build` and their tests pass offline.
3. Every new UI is reachable from sidebar + home + search after integration.
4. No file outside your ownership list modified.
5. Each agent returns a JSON report: what was built, test counts, manual checks
   for Max, and anything intentionally skipped.
