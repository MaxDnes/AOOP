# AOP Exam Companion

An offline, single-page study app for the Advanced Object-Oriented Programming (F26) course:
Avalonia + MVVM Toolkit, SOLID, unit testing, LINQ/JSON, threading/async. It is a searchable
curriculum plus a set of "exam day" tools that generate ready-to-paste C#/AXAML and runnable
.NET projects. It is what a student opens during the (offline, no-AI) exam.

## Running and testing

- Run the app: open `index.html` in any browser. It is 100% offline, `file://`-safe, no server,
  no build step, no package manager, no dependencies. Plain HTML/CSS/JS.
- Run the tests: `node tests/run-tests.js` from the repo root. This is a custom harness (no Jest,
  no npm). It auto-discovers every `tests/*.test.js`, runs them in one process, and prints
  `ok N passed, 0 failed` (exit 1 on failure). There is no lint or typecheck step.
- After fixing a bug, wire a regression test into the suite (just add/extend a `tests/*.test.js`)
  and run the full suite before committing.

## Architecture

`index.html` loads ~44 `data/*.js` modules (content + tools), then `app.js` last.

### app.js (the engine)
The single-file engine: hash router, full-text search, the topic/block renderer, the sidebar nav,
the home page, and the tool dispatcher. It is NOT Node-loadable: it touches `document` at load
time, so tests treat it as a string (regex / `includes`) rather than requiring it.

Two registries near the top of `app.js` are the single source of truth:
- `CATEGORIES`: ordered list of content categories (name + color).
- `TOOLS`: the exam-day tools (id, label, module global name, home-card copy). The router, nav,
  home cards, and search pseudo-topics all read this array.

### data/*.js (content + tools)
All data modules are Node-loadable: they wrap their body in an IIFE that assigns to `window`
(browser) and `module.exports` (Node), and never touch the DOM at load time. The test suite
depends on this.

There are two kinds:

1. Content modules (oop.js, csharp.js, solid.js, avalonia.js, mvvm.js, linq.js, exams.js,
   playbooks.js, bootcamp.js, ...). Each does `window.TOPICS.push({...})`. A topic is:
   ```js
   { id, title, cat, tags: [], related: [ids], blocks: [ ... ] }
   ```
   `cat` must be a name in `CATEGORIES`. Blocks are small typed objects rendered by
   `renderBlock` in app.js. Supported block kinds: `p`, `h`, `list`, `steps`, `rule`, `def`,
   `tip`, `gotcha`, `table`, `tasks`, `reveal`, `preview`, `code` (with `lang`/`title`), and
   `demo` (a bootcamp runnable-demo id). Inline markup inside text: `` `code` ``, `**bold**`,
   and `[[id|label]]` cross-links. Use `String.raw` for code snippets.

2. Tool modules. Each tool is usually a pair: a `*-core.js` (pure logic, Node-loadable, exposes
   `window.X_CORE`) plus a `*.js` UI (exposes `window.X = { render, init }`). The tool is listed
   in the `TOOLS` array with its module global; the router calls `mod.render()` then `mod.init()`.
   Tools degrade gracefully when an optional dependency (PROJZIP) is absent.

### The twelve tools (each maps to an exam problem)
guide (Exam Guide), lab (Code Lab), builder (UI Builder), designer (Visual Designer, Problem 2),
analyzer (Analysis Lab, Problem 1), testlab (Test Lab, Problem 3a), querylab (Query Lab,
Problem 4), asynclab (Async Composer, Problem 3b), convert (MVVM Converter), adapt (Adapt Lab),
errors (Error Decoder), quiz (Quiz).

### PROJZIP (data/projzip-core.js)
A pure-JS ZIP writer (CRC-32, STORE method, no deps) plus .NET project scaffolds:
`avaloniaProject`, `xunitProject`, `consoleProject`, and `makeZip` / `makeZipBlobUrl`. Exposes
`window.PROJZIP`. Package versions are pinned to the exam stack (net9.0, Avalonia 11.2.1,
CommunityToolkit.Mvvm 8.2.1, xUnit). The scaffolds are calibrated against the real on-disk
`AOP Exam Starter Kit`. It must load before every export-capable tool and before app.js. Tools
that export hide their export button when `window.PROJZIP` is absent. The default project
namespace is the literal `ExamApp`; do not change it, the namespace-rewrite path replaces
`\bExamApp\b`.

### The two "examples" systems (keep them separate)
- Topic examples: `data/examples.js` -> `window.TOPIC_EXAMPLES[topicId] = [{title, lang, code}]`.
  Read-only, collapsible "Examples" boxes auto-appended to every reference-doc topic by
  `renderExamples()` in app.js. Content lives centrally here, NOT inline in the content modules.
- Bootcamp runnable demos: `data/bootcamp-demos.js` -> `window.BOOTCAMP_DEMOS`. A `{demo:"id"}`
  block in the 3-Day Bootcamp that renders a Download (.zip) button + a live preview + the full
  source inline. Distinct from topic examples; do not merge them.
- Test Lab worked examples: `data/testlab-examples.js` -> `window.TESTLAB_EXAMPLES`, a one-click
  gallery inside the Test Lab.

## Visual Designer (the most complex tool)

- `data/designer-core.js` (`window.DESIGNER_CORE`): the `CATALOG` of element types,
  `createNode` / `addChild` / `findNode` / `findParent`, `generate(tree) -> {axaml, viewModel, model}`,
  and `submission(tree)`. `ensureLayoutPropsForAll()` injects Width/Height/Margin/alignment into
  every non-root element so anything can be sized.
- `data/designer.js` (`window.DESIGNER = { render, init, previewHTML }`): `previewHTML(tree, selId)`
  is PURE and Node-testable; `pvNode` renders each node; `baseStyle` builds the inline style;
  pointer-based move/resize; and the `DSG.*` onclick handlers.

Designer invariants worth knowing before editing it:
- `attrsOf` omits a prop whose value equals the catalog default (keeps output clean). So putting a
  value in `defaultProps` does NOT force it into the export.
- The preview fakes sensible visual defaults; the export must emit them too or the running app is
  blank. Geometry shapes guarantee a visible stroke/fill in `generate` (a Line gets `Stroke="Black"`
  `StrokeThickness="2"`; Rectangle/Ellipse get a default fill + 80x50; Polygon/Path get a fill).
- Line and Polygon are point-defined (StartPoint/EndPoint, Points), not Width/Height. They are not
  resizable via grips, their preview box hugs the geometry, and `generate` strips inert Width/Height.
- Rotation: `node.props.Rotation` (degrees) -> `RenderTransform="rotate(Ndeg)"` +
  `RenderTransformOrigin="50%,50%"`. Use `50%,50%`, not `0.5,0.5` (Avalonia reads a unit-less
  RelativePoint as absolute pixels, which rotates around the top-left corner).
- Window size-lock: `tree.props.SizeLocked` (default locked) emits `CanResize="False"` so the
  running window keeps the design layout. `SizeLocked === false` makes it resizable.
- Per-element lock: `node.locked` is a designer-only flag (never exported) that removes the move
  handle and resize grips so an element can't be nudged by accident.

## Exam submission format (the real deliverable)

A flat folder of exactly 6 files with the professor's exact names, no `bin`/`obj`, no subfolders:
`Problem_1_Submission.txt`, `Problem_2_MainWindow.axaml`, `Problem_2_MainWindowViewModel.cs`,
`Problem_3_MainWindowViewModel.cs`, `Problem_4_Program.cs`, `Problem_4_Models.cs`. This is the real
exam's structure (from the professor portal), which differs from the practice PDF's 4-file layout;
do not "fix" tool naming to match the PDF. Only these usings are allowed in submitted code:
`System*`, `Avalonia*`, `CommunityToolkit.Mvvm*`. The "Download submission files" actions emit plain
text blobs and must NOT depend on PROJZIP (they work even when the zip writer is absent); the
"Export project (.zip)" actions are the only PROJZIP consumers.

## Conventions and gotchas

- Load order in `index.html`: a tool's `*-core.js` before its UI, `projzip-core.js` before every
  export-capable tool, all data modules before `app.js`.
- Verify Avalonia / .NET library behavior through Context7 rather than from memory before relying on
  it in generated code (this caught a real RenderTransformOrigin bug).
- Tests: the harness lives in `tests/t.js` (`test`, `eq`, `ok`, `includes`, `notIncludes`,
  `xmlBalanced`, `summary`). `run-tests.js` clears the `data/` module cache between files so each
  test file behaves as it would in isolation.
- TOPICS contamination: the suite shares one process and `global.TOPICS` persists across files. Any
  test that populates `global.TOPICS` MUST reset it to `[]` at the start and end, or
  `integration.test.js` reports every topic id as a duplicate.
- app.js is verified as a string (its functions are not callable in Node); data modules are
  `require`d and exercised directly.
