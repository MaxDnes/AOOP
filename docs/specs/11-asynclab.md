# Spec 11: Async Composer (NEW tool): configure a worker, get the full VM

Read docs/specs/00-master-plan.md first (constraints, looks, contracts).
You own ONLY these NEW files: data/asynclab-core.js, data/asynclab.js,
asynclab.css, tests/asynclab-core.test.js. DO NOT touch index.html or app.js.
Expose window.ASYNCLAB = {render, init}; follow analyzer/testlab patterns
(pure core + UI + guarded module.exports). Read the ReExam P3 counter
solution in data/solutions-reexam.js first; its verified code is the
calibration target.

Purpose: exam Problem 3 async variant (15-20 pts): "counter +1 every 100ms,
start/stop preserves value/resume continues/reset zeroes, all UI updates on
the UI thread". Max picks options, gets the complete ViewModel (and matching
AXAML bindings) without coding. This is a FORM tool (like UI Builder), not
drag-and-drop.

## 1. Configuration form (left pane)
- Pattern: Counter (int +step per tick) | Progress worker (0..100 with
  IsRunning flag, completes and stops) | Periodic list mutator (acts on an
  ObservableCollection: add item / recolor / remove first).
- Mechanism: DispatcherTimer (default; note: ticks on UI thread already) |
  Task.Delay loop + CancellationTokenSource (note: needs
  Dispatcher.UIThread.Post; both emitted lines carry the "// earns the
  thread-safety points" comment) | Both (emits primary + alternate region).
- Interval ms (default 100), step (default 1).
- Commands: checkboxes Start, Stop, Reset (+ Toggle single-button variant);
  CanExecute wiring option ([RelayCommand(CanExecute=...)] with
  [NotifyCanExecuteChangedFor] on the IsRunning property) on/off.
- Semantics fixed (exam rules): Start is idempotent while running (guard),
  Stop preserves the value, Start after Stop resumes from preserved value,
  Reset zeroes (and stops or not: toggle, default keeps running state as per
  ReExam: reset to zero only).
- Extras: matching AXAML snippet (TextBlock bound value + buttons bound to
  commands) on/off; matching headless xUnit test file for the chosen config
  on/off (reuse the exact headless boilerplate style from data/testlab-core.js
  generators; do not import it, replicate minimal needed parts).

## 2. Code generation (core, pure)
Complete MainWindowViewModel.cs: usings, ObservableObject partial,
[ObservableProperty] fields, [RelayCommand] methods implementing the exact
semantics, mechanism-specific members (DispatcherTimer field initialized in
ctor with interval; or CancellationTokenSource field + async Task loop with
try/catch (OperationCanceledException) ONLY, never catch-all, + UIThread.Post)
and point-earning comments. Zero TODOs in any configuration. The default
config (Counter, DispatcherTimer, 100ms, Start/Stop/Reset) must be
functionally identical to the verified ReExam P3 model solution; desk-check
against data/solutions-reexam.js.

## 3. UI (right pane)
Generated files as cards (ViewModel always; AXAML and test file when checked)
with copy buttons + Copy all. Live regenerate. Persist config to localStorage
aop-asynclab-state. A short "which mechanism when" note card (DispatcherTimer
for UI-tick simplicity; Task loop when the exam explicitly demands
tasks/cancellation; both score if thread-safe).

## Looks
Master-plan tokens; violet accent (distinct from designer amber, testlab
cyan, querylab green). Form controls styled like UI Builder's existing
checkboxes/selects (read data/builder.js rendering for class reuse).

## Tests (tests/asynclab-core.test.js)
- Default config output contains DispatcherTimer, interval 100, Start guard,
  Stop without zeroing, Reset zeroing, no catch-all catch, brace-balanced,
  no TODO.
- Task-loop config contains CancellationTokenSource, catch
  (OperationCanceledException), Dispatcher.UIThread.Post.
- CanExecute option emits [RelayCommand(CanExecute and
  [NotifyCanExecuteChangedFor.
- Progress + list-mutator patterns generate their distinctive members.
- AXAML snippet xmlBalanced; headless test contains [AvaloniaFact].
- Robustness + Node-loadable + escaping.

## Definition of done
Own tests green; full suite green at session end; default output desk-checked
equivalent to the verified ReExam solution.

## Return (final message, raw JSON)
{"done": bool, "patterns": [..], "mechanisms": [..], "tests": "X passed",
 "manual_checks": [..], "skipped": [..], "notes": ".."}
