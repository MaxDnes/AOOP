# Spec 07: Designer v2 "Elementor mode": logic recipes + reference image

Read docs/specs/00-master-plan.md first (constraints, looks, test commands).
You own ONLY: data/designer-core.js, data/designer.js, designer.css,
tests/designer-core.test.js, tests/designer-ui.test.js. Read them fully first;
the designer is mature (pixel drops, drag-move, resize, undo, typed models,
exam presets). Goal of this round: the generated ViewModel must contain WORKING
method bodies so Max can build a UI and paste code that RUNS, not TODO stubs.

## 1. Logic recipes for commands
Anywhere a [RelayCommand] is generated (bound Button etc.), the inspector's
binding row gains a "recipe" dropdown choosing the command's implementation:
- none (current TODO stub, default for unknown intents)
- add-random-item: requires a typed-model ItemsControl/ListBox in the design;
  body creates the model instance with Random values for numeric fields
  (clamped 0..containerSize-itemSize when the items host is a Canvas free-
  position panel and the model has X/Y/Width/Height), random Brush from a
  palette array for IBrush fields, random pick from a sample-strings array for
  string fields; adds to the collection.
- remove-selected: removes SelectedItem from the collection (guard null);
  pairs with the SelectedItem binding feature.
- clear-all: collection.Clear().
- regenerate-from-service: emits a ctor-injected interface (name configurable,
  default IItemProvider with GetItems():IEnumerable<T>), body clears and
  repopulates the collection from the service; also emits the interface
  declaration + a simple InMemory implementation class in the Models pane so
  the paste compiles standalone.
- counter-increment: int [ObservableProperty] Count, body Count++.
- timer-toggle / timer-start / timer-stop / timer-reset: see section 2.
Recipe choice is per-command, persisted in the design tree, exported/imported
with designs, undo-aware (it is a prop mutation).

## 2. Timer block
A design-level "Timer" option (toolbar or VM panel): when enabled, configure
interval ms (default 2000 or 100 for counter), mechanism (DispatcherTimer
default, or Task.Delay loop + CancellationTokenSource), and tick action:
- recolor-items (random Brush per item; requires typed model with IBrush field)
- reposition-items (random X/Y with clamping)
- increment-counter (Count++)
- custom (TODO comment body)
Generated code: correctly initialized timer field, start/stop/reset methods
wired to any timer-* recipe commands, UI-thread safety where the mechanism
needs it (Task loop posts via Dispatcher.UIThread.Post with a comment "// UI
thread: required"; DispatcherTimer gets a comment that it already ticks on the
UI thread). Pause must preserve state, resume continues, reset zeroes (exam P3
semantics). The Summer preset gains the 2s recolor/reposition timer so the
preset now solves Summer P2 end to end; the counter semantics match ReExam P3.

## 3. Reference image overlay ("match the task's sketch")
Toolbar button "Reference image": file input loads an image (FileReader data
URL), shown UNDER the stage content at an adjustable opacity (slider 10-80%),
toggle on/off, remove. Session-only state (do NOT write data URLs into
localStorage slots; too big), but include in Export JSON behind a checkbox
"include reference image". Stage children render above it; the overlay never
intercepts pointer events.

## 4. Working-code guarantee
With a recipe selected, generated VM compiles standalone: all needed usings
(System, System.Collections.ObjectModel, Avalonia.Media, Avalonia.Threading,
CommunityToolkit.Mvvm.*, System.Threading etc.), Random field, palette array,
service interface + impl when used. Audit the whole generation path for
leftover TODOs when recipes are chosen; "none" recipes may keep TODO bodies.

## Looks
Recipe dropdown styled like existing inspector selects. Timer panel: small
card in the VM/output column header area. Reference image controls: compact
toolbar popover; opacity slider mono-labeled. Reuse tokens only.

## Tests (extend existing files)
- Each recipe generates its body (assert key lines: clamping math for
  add-random-item on canvas, Clear+repopulate for service, Count++).
- Timer codegen both mechanisms: DispatcherTimer field+Tick, Task loop with
  CancellationTokenSource + Dispatcher.UIThread.Post; start/stop/reset wiring;
  reset zeroes; pause-resume preserves count (assert structure, e.g. no
  re-instantiation of count on start).
- Summer preset now contains the timer + recipes and stays xmlBalanced;
  generated VM contains zero "TODO" when all its commands have recipes.
- Export round-trip preserves recipes; image excluded by default.
- UI file still Node-loadable.

## Definition of done
Own tests green; full suite green at session end; both exam presets generate
code that would compile and behave per the original exam statements (desk-check
carefully line by line; you know Avalonia + CommunityToolkit).

## Return (final message, raw JSON)
{"done": bool, "recipes": [..], "timer_mechanisms": [..], "tests": "X passed",
 "manual_checks": [..], "skipped": [..], "notes": ".."}
