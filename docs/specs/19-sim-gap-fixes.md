# Spec 19: close the exam-simulation gaps

Read docs/specs/00-master-plan.md first. v3 through v8 are merged and green
(466/0). NEVER regress; extend. This spec fixes the gaps found by the
2026-06-13 full-exam simulation, where 8 student agents solved two
fresh-domain mock exams using only the app and scored 99 and 99.5 / 100.
Every fix below traces to a logged gap where the tool emitted wrong,
non-compiling, or missing output and a student had to hand-edit. Each fix
must be behavior-preserving for existing inputs (the 466 tests prove it)
and add a regression test.

The simulation artifacts (read for exact failing cases) are at
C:/Users/Max/Desktop/aop-exam-sim/REPORT.md and the per-problem GAP_LOGs.

## Agent QUERY (highest value)

Own: data/querylab-core.js, data/querylab.js, querylab.css,
tests/querylab-core.test.js.

G4 (HIGH): scalar comparisons are not null-aware or type-aware.
- genFilterEquals always routes the value through csString(), so there is
  no way to emit `field == null`. Add a null/empty match mode: a row flag
  (e.g. `value: null` or `match: "null"`) makes filter-equals emit
  `x.Field == null` (no quotes). For CSV-backed models where empty cells
  become null, the "is empty/missing" query must use this, not `== ""`.
- genFilterNestedAny's default (equals) branch always csString()-wraps the
  sub-field value, producing `t.Year == "2245"` which does NOT compile for
  an int sub-field. Make it consult the sub-field's inferred type: int/long
  /double/bool emit a bare literal (`== 2245`), string stays quoted.
G5 (MED): missing combinators.
- filter-nested-any can only produce one predicate. Add an optional
  root-level `andWhere` predicate (e.g. another field equals/!=) so a row
  can express `x.HomePort == "Gullhaven" && x.Items.Any(...)` in one query.
- sort-by on a nullable scalar emits a bare key; add an optional
  `nullValue` (emits `?? n`) so `OrderByDescending(s => s.Signups ?? 0)`
  is expressible.
- above-average always averages the full source with `?? 0`, which counts
  missing values as zero and skews the average. Add an `excludeNull` option
  that pre-filters `field != null`, averages the non-null values, and keeps
  the outer comparison null-safe.
Tests: each new mode emits the exact expected C# and (where it changes a
shape) the existing happy-path output is byte-unchanged. Add a Node
assertion that a generated program using the null mode + int nested-any +
compound-AND compiles-shaped (string-level) and, if you can, run ONE real
dotnet build of a console export exercising all three (5 min timeout).

## Agent ANALYZER

Own: data/analyzer-core.js, data/analyzer.js, tests/analyzer-core.test.js,
tests/analyzer-ui.test.js.

G3 (HIGH): a finding that breaks several principles must populate every
relevant section, never drop a mandatory one. The downcast rule is
principle DIP (keep that primary per spec 15), but on a full all-5-SOLID
draft the LSP and OCP sections come out empty because no finding is filed
under them. Give cross-cutting findings a `principles` array (primary plus
consequences, e.g. downcast -> [DIP, LSP, OCP]) and have assembleAnswer
(full mode) emit a derived entry in each listed principle's section,
framed for that principle (LSP: substitutability broken when a non-default
implementation is injected; OCP: a new implementation cannot be plugged
without editing this method). Never skip a RUBRIC-ordered principle that
has a cross-reference pointing at it. The june mode and the existing
spec-15/18 calibration must stay green.
G12 (MED): the Strategy detector mis-fires on capability/marker interfaces.
It currently picks any interface with multiple implementors, so it chose a
role marker (IAquatic, 3 unrelated implementors) over the real strategy
(ITankAssignmentStrategy, constructor-injected and invoked). Refine: prefer
an interface that is (a) constructor-injected into a class AND (b) invoked
through a stored field, and de-prioritize interfaces that look like
capability/role markers (named I<Adjective>able / I<Noun> with members that
are pure capability and many structurally-unrelated implementors). If
uncertain, the Strategy finding should hedge ("candidate strategy") rather
than assert a confidently wrong type.
Tests: a fixture with both a capability interface and a real injected
strategy yields the injected one for 1.5; the downcast fixture's full-mode
draft now contains a non-empty LSP section naming the downcast, and OCP,
with DIP still primary; spec-15 payment-gateway calibration unchanged.

## Agent TESTLAB

Own: data/testlab-core.js, data/testlab.js, data/testing.js,
tests/testlab-core.test.js.

G1 (HIGH): the headless [AvaloniaFact] test must interact with the real
control, because the rubric rewards finding and clicking the button, not
calling the VM command. Today the generated headless test (and the
ut-headless reference block in data/testing.js that models it) does
`vm.SomeCommand.Execute(null)`. Change BOTH to: construct the window, show
it, FindControl<Button>(name) and FindControl<TextBlock>(name), assert
both are non-null, then drive the button via its Command
(`button.Command.Execute(button.CommandParameter)`) or a simulated click in
a loop, then assert the bound TextBlock text. The control names should come
from the parsed view when available, else a clearly-marked placeholder the
student edits. Keep the existing headless smoke test compiling.
G9 (LOW/MED): stop hardcoding the Starter Kit identity. Accept options for
the target namespace, the view class name (default MainWindow, do NOT
derive it by stripping "ViewModel"), and the ProjectReference path, so the
generated test project references the real project. Default behavior when
no options are passed must match today's output (tests prove it) EXCEPT the
view-class default changes from <Stripped> to MainWindow; update the
asserting tests accordingly and note it.
Tests: the headless test now contains FindControl<Button> and a click path,
not a bare vm.Command.Execute; with target options the namespace/ref path
are stamped through; defaults unchanged except the documented view-class
default.

## Agent DESIGNER

Own: data/designer-core.js, data/designer.js, designer.css,
tests/designer-core.test.js, tests/designer-ui.test.js.

G2 (HIGH): items can only render as a debug StackPanel+TextBlock list.
Add a `templateShape` option on the ItemsControl/items model (one of
Ellipse, Rectangle, none). When set, itemTemplateAxaml() emits
`<{shape} Width="{Binding Width}" Height="{Binding Height}"
Fill="{Binding Color}"/>` (Color binding only if the model has a brush
field; else a default fill) instead of the debug list. Default (unset)
keeps today's output.
G6 (MED): two compiled-binding breakers.
- When the item model class is nested inside the ViewModel, the DataType
  must be `vm:Outer+Inner`, not `vm:Inner` (which fails compiled bindings).
  Detect a nested model and emit the qualified form.
- The ListBox catalog exposes SelectedItem but not SelectedItems; add
  SelectedItems as a bindable property so multi-select-from-VM (selection
  sync) is expressible without hand-editing.
G8 (MED): adapt to the target project and propagate canvas size.
- Accept a `projectNamespace` option that fills xmlns:vm and x:Class
  instead of the hardcoded ExamApp (default stays ExamApp so existing
  output and the projzip namespace-rewrite path are unchanged).
- needCanvasBounds and canvasItemsAxaml() must read the ItemsControl
  node's Width/Height (when set) into the inner `<Canvas Width=.. Height=..>`
  and into the clamp constants, instead of always emitting 400/300 and a
  bare `<Canvas/>`. Default when unset stays today's behavior.
Tests: templateShape emits the shape; a nested model yields the `+`
qualifier; SelectedItems binds; projectNamespace stamps through; a sized
ItemsControl propagates Width/Height to the inner Canvas and clamp consts;
all existing designer output for unset options is byte-unchanged.

## Agent ASYNC

Own: data/asynclab-core.js, data/asynclab.js, tests/asynclab-core.test.js.

G11 (LOW): the pause/stop button label is hardcoded "Stop" while the spec
often says "Pause". Add a `pauseLabel` config option (default "Stop" so
existing output is unchanged) that sets the button Content; keep the
command name as-is. Test: pauseLabel:"Pause" yields Content="Pause" with
the binding unchanged; default unchanged.

## Integration agent (runs ALONE, last before verify)

Own: app.js, index.html, styles.css, README.txt, README-EXAM-DAY.md,
data/guide.js, tests/integration.test.js, tests/guide.test.js.
- No new tools/registry changes. Surface the new capabilities lightly:
  README.txt Query Lab/Designer/Test Lab paragraphs gain one sentence each
  (null/empty + compound queries; item shapes + multi-select; headless
  tests now click the real control). Guide P3 and P4 plays may gain a short
  clause; update guide.test pins only if you change pinned strings.
- Full suite green: node tests/run-tests.js (baseline 466 plus the new
  agents' tests).

## Verify (loop, up to 3 fix rounds)

1. node tests/run-tests.js fully green.
2. node --check on app.js and every data/*.js; index.html refs exist.
3. Re-solve checks (the exact sim failures must now be tool-native):
   - Query Lab: a null/empty filter row emits `== null`; an int nested-any
     emits `== 2245` (no quotes) and the program compiles; a compound-AND
     row emits both predicates; an above-average excludeNull row excludes
     nulls from the average.
   - Analyzer: full-mode draft on a downcast fixture has a non-empty LSP
     section AND an OCP section, DIP still primary; Strategy 1.5 on a
     fixture with a capability interface + an injected strategy names the
     injected strategy.
   - Test Lab: generated headless test contains FindControl<Button> and a
     click/Command path, not a bare vm.Command.Execute; target-namespace
     options stamp through.
   - Designer: templateShape Ellipse emits an Ellipse template; nested
     model emits `vm:Outer+Inner`; SelectedItems binds; projectNamespace
     stamps; sized ItemsControl sizes the inner Canvas.
   - Async: pauseLabel "Pause" emits Content="Pause".
4. Real dotnet canaries (5 min timeout, hang = failure, clean up):
   (a) a Query Lab console export exercising the null filter + int
   nested-any + compound-AND -> dotnet build green AND dotnet run produces
   sane output; (b) the existing designer Summer-preset avalonia canary
   still builds (regression); (c) a Test Lab export with the new headless
   click pattern -> dotnet test green (watch for the historic hang).
5. JSON/CSV regression: the Summer spaceships JSON preset and a simple CSV
   still generate and run with unchanged happy-path output.
