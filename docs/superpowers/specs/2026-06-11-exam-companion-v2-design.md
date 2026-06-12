# AOP Exam Companion v2 — Design

Date: 2026-06-11. Exam: SDU Advanced Object-Oriented Programming (F26), in 2-3 days.
Constraint: all aids must work fully offline (no internet, no AI/LLMs during the exam).
Prepared-in-advance deterministic tools are allowed.

## Goal

Extend the existing offline web app at `C:\Users\Max\Desktop\AOP Exam Companion\`
(vanilla HTML/CSS/JS, hash routing in `app.js`, content modules in `data/*.js`)
with four exam-day tools, in this priority order:

1. Visual Designer — drag-and-drop Avalonia UI builder generating AXAML + ViewModel
2. Analysis Lab — paste C# code, heuristic OOP/SOLID violation scanner + written-answer builder
3. Quiz mode — self-test bank with per-category score tracking
4. Navigation cleanup — pinned Exam Day tools, collapsible sidebar, recently viewed
5. Stretch (only after 1-4 verified): standalone Avalonia desktop designer app

Known exam format (from 2025 summer + re-exam): 4 problems / 100 pts —
(1) written OOP/SOLID analysis of a console project with planted violations,
(2) Avalonia MVVM UI task with no code-behind edits,
(3) xUnit + headless testing or async counter,
(4) JSON + LINQ console task.
Stack: .NET 9, Avalonia 11.2.1, CommunityToolkit.Mvvm 8.2.1.

## 1. Visual Designer (`#designer`, `data/designer.js`)

Three-panel page:

- **Toolbox (left).** Grouped palette: layout containers (StackPanel, Grid, DockPanel,
  WrapPanel, Border, ScrollViewer, Canvas), controls (Button, TextBox, TextBlock,
  CheckBox, RadioButton, Slider, ComboBox, ListBox, ProgressBar, Image), shapes
  (Rectangle, Ellipse, Line, Polygon, Path), and a color swatch palette
  (drag a swatch onto an element to set Background/Fill; Foreground via inspector).
- **Canvas (center).** Live HTML/CSS approximation of the Window (same preview
  technique as the existing Design Gallery). Layout-tree based: dropping into a
  container nests the element and it lays out the way Avalonia would
  (stack/dock/wrap/grid). Click to select, drag to reorder/reparent, Delete to remove.
  Exception: inside a Canvas container children are freely draggable and get
  pixel Canvas.Left/Top — for shape-drawing tasks.
  Grid containers get a row/column definition editor (Auto / * / pixel) and each
  direct child gets Grid.Row/Grid.Column (+ spans) in the inspector.
- **Inspector (right).** Common properties for the selected element: Width, Height,
  Margin, Padding, HorizontalAlignment, VerticalAlignment, Background, Foreground,
  FontSize, FontWeight, CornerRadius, Text/Content, Spacing/Orientation on panels,
  control-specific extras (Minimum/Maximum/Value, Watermark, IsChecked, etc.).
  **Binding fields:** any bindable property can be switched from literal to binding.
  - TextBox.Text bound to `Name` → ViewModel gets `[ObservableProperty] private string name;`
  - Button.Command bound to `SaveCommand` → `[RelayCommand] private void Save() { }`
  - ListBox.ItemsSource bound to `Items` → `ObservableCollection<string> Items { get; } = new();`
    (item type configurable; SelectedItem binding supported)
  - Slider/ProgressBar Value, CheckBox IsChecked, etc. → typed observable properties.

**Code generation.** A pure function `tree -> { axaml, viewModel }`:
complete MainWindow.axaml (xmlns, x:Class, x:DataType, Design.DataContext) and a
complete MainWindowViewModel.cs using CommunityToolkit.Mvvm source generators,
matching the Starter Kit conventions. Output pane below the canvas with copy
buttons and short "paste where" guidance. Indentation 4 spaces, attributes split
when long — output should look hand-written.

**Persistence.** Named design slots in localStorage (pure client app, no backend,
so no autosave race concerns). New/Save/Load/Delete + a couple of seeded example
designs that mirror 2025 exam Problem 2 layouts.

## 2. Analysis Lab (`#analyzer`, `data/analyzer.js`)

- **Input.** Multi-file: tabs with filename + paste area (matches how the exam hands
  you a console project of several .cs files). Single-paste also fine.
- **Scanner.** Deterministic line/context heuristics (regex + light brace/scope
  tracking), each rule emitting findings `{ ruleId, principle, file, line(s),
  excerpt, confidence, theory, fixSketch, paragraphTemplate }`. Rules (initial set):
  - downcast via `as ConcreteType` or `(ConcreteType)expr` — LSP/DIP
  - `new Concrete...()` in constructors/field initializers of classes that should
    receive abstractions — DIP
  - `throw new NotImplementedException/NotSupportedException` in an override or
    interface member — LSP / ISP
  - `is Type` / `GetType() ==` chains and switch-on-type-or-kind — OCP
  - public mutable fields / public setters on collections — encapsulation
  - Console.Read/Write inside domain/model classes — SRP / separation of concerns
  - god class (size + mixed responsibilities: I/O + domain + persistence) — SRP
  - fat interface (many members) + implementors with empty/throwing bodies — ISP
  - static mutable state / singleton — DIP, testability
  - `new` member hiding instead of `override` — polymorphism misuse
- **Findings panel.** Grouped by principle, clickable line highlight in the code
  view, severity/confidence badge, theory blurb (sourced from existing
  `solid.js`/`oop.js` content), fix sketch, and a written-answer paragraph template
  with class names/line numbers auto-inserted.
- **Answer assembly.** Checkboxes per finding → generates a structured full draft
  of the Problem 1 written answer (intro, one section per confirmed violation with
  principle / evidence / consequence / fix, conclusion) into a copyable text area.
  Editable before copy.
- **Calibration.** The scanner must find the planted violations in both 2025 exam
  projects (sources in `C:\Users\Max\Desktop\AOP_extracted\`), including the
  re-exam's `as InMemoryRecipeRepository` downcast. These are regression tests.

## 3. Quiz (`#quiz`, `data/quiz.js`)

~100 hand-written questions across categories: OOP pillars, SOLID (incl.
spot-the-violation code snippets), Avalonia/MVVM/bindings, xUnit + headless testing,
async/threading, LINQ + JSON, collections/generics. Types: multiple choice
(auto-graded), code-snippet multiple choice, short answer with reveal +
self-grade (right/wrong buttons). Modes: by category, shuffled mixed exam-mix,
and "weak topics" (questions answered wrong are weighted up). Per-category stats
persisted in localStorage.

## 4. Navigation cleanup (`app.js`, `styles.css`)

- Pinned "Exam Day" group at the top of the sidebar: Visual Designer, Analysis Lab,
  UI Builder, Code Lab, Quiz, Playbooks, the two 2025 exams.
- Collapsible category groups (state persisted).
- "Recently viewed" list (last 8 topics, localStorage).
- `/` focuses search. Keep all existing routes working.

## 5. Stretch: standalone Avalonia designer

Separate solution `C:\Users\Max\Desktop\AOP Visual Designer\` (.NET 9,
Avalonia 11.2.1, CommunityToolkit.Mvvm 8.2.1 — all cached locally). Palette →
real-control canvas → property grid → generated AXAML pane. True-fidelity
rendering; also doubles as MVVM practice. Built only once items 1-4 are done,
tested, and polished.

## Architecture & testing

- New modules follow the existing pattern: plain script files attaching to a global
  registry, loaded from `index.html`. The designer codegen and the analyzer scanner
  are **pure functions** in their modules with a UMD-style guard
  (`if (typeof module !== 'undefined') module.exports = ...`) so they also run under Node.
- New top-level `tests/` folder in the app with a Node test runner
  (`node tests/run-tests.js`, zero dependencies): codegen golden/shape tests
  (well-formed AXAML, balanced tags, every binding has a ViewModel member) and
  analyzer regression tests against fixture snippets plus the real 2025 exam sources.
  Full suite must pass before each component is called done.
- No build step, no frameworks — the app must keep opening from `index.html`
  on a machine with no internet.

## Error handling

- Designer: invalid property values fall back to defaults with a small inline warning;
  codegen never throws — unknown nodes are skipped with a comment in the output.
- Analyzer: scanner is best-effort; a rule that errors on input is caught and skipped
  (one bad regex must never blank the page). Empty input → friendly hint.
- All localStorage reads wrapped with try/parse fallbacks (existing app convention).

## Out of scope

- No undo/redo stack in the designer v1 (delete + named save slots cover exam use).
- No DataGrid (not in the allowed simple stack's exam tasks so far).
- No styles/resources designer (inline properties only).
- Analyzer does not attempt full C# parsing — heuristics only, wizard fallback
  already covered by existing playbooks.
