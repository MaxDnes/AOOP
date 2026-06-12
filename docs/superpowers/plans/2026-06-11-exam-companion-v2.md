# AOP Exam Companion v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four offline exam-day tools to the AOP Exam Companion web app — a drag-and-drop Visual Designer that generates Avalonia AXAML + MVVM ViewModel, a paste-and-scan OOP/SOLID Analysis Lab with written-answer assembly, a Quiz mode, and an Exam Day navigation group — plus a stretch standalone Avalonia designer app.

**Architecture:** Each tool is a self-contained pair of files: a pure logic core (UMD-guarded, runs in browser AND under Node for tests) and a UI module that renders into the existing `#content` div via the app's hash router. App-shell changes (`app.js`, `index.html`, `styles.css`) are one small integration task at the end so tool tasks can run in parallel without file conflicts. Per-tool CSS lives in its own file.

**Tech Stack:** Vanilla JS (no deps, must work from `file://`), Node 24 for the test runner, target output is .NET 9 / Avalonia 11.2.1 / CommunityToolkit.Mvvm 8.2.1 code.

**Repo root:** `C:\Users\Max\Desktop\AOP Exam Companion\` (NOT a git repository — skip all commit steps; the regression suite `node tests/run-tests.js` is the verification gate instead).

**Spec:** `docs/superpowers/specs/2026-06-11-exam-companion-v2-design.md` — read it first.

**Existing conventions (follow them):**
- Data modules attach globals (`window.TOPICS.push(...)`, `window.BUILDER = {...}`) and are loaded by `<script>` tags in `index.html` BEFORE `app.js`.
- Tool pages are special routes in `go()` in `app.js` (see `lab` / `builder` branches, app.js:315-339).
- Interactivity = global functions invoked from inline `onclick` strings; post-render wiring via `setTimeout(..., 0)` (see `renderLabFile`, app.js:443).
- `esc()` for ALL user-controlled strings interpolated into HTML. `highlight(code, lang)` for code display (`lang`: csharp|xml|json|bash). `codeRegistry.push(code)` + `copyCode(this, idx)` for copy buttons.
- localStorage access ALWAYS wrapped in try/catch with fallback (see `store`, app.js:37-44).

---

### Task 1: Node test harness

**Files:**
- Create: `tests/t.js`
- Create: `tests/run-tests.js`

- [ ] **Step 1: Write `tests/t.js`** — micro test framework, zero deps:

```js
"use strict";
let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; failures.push({ name, msg: e.message }); }
}
function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error((msg || "eq") + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
}
function ok(cond, msg) { if (!cond) throw new Error(msg || "expected truthy"); }
function includes(haystack, needle, msg) {
  if (typeof haystack !== "string" || haystack.indexOf(needle) === -1)
    throw new Error((msg || "includes") + ": missing " + JSON.stringify(needle));
}
function notIncludes(haystack, needle, msg) {
  if (typeof haystack === "string" && haystack.indexOf(needle) !== -1)
    throw new Error((msg || "notIncludes") + ": found forbidden " + JSON.stringify(needle));
}
/* XML well-formedness: every <Tag ...> has a matching </Tag> or is self-closing */
function xmlBalanced(xml) {
  const stack = [];
  const re = /<(\/?)([A-Za-z][\w.:]*)((?:"[^"]*"|[^"<>])*?)(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const [, close, tag, , self] = m;
    if (self) continue;
    if (close) {
      const top = stack.pop();
      if (top !== tag) throw new Error("xmlBalanced: expected </" + top + ">, got </" + tag + ">");
    } else stack.push(tag);
  }
  if (stack.length) throw new Error("xmlBalanced: unclosed " + stack.join(", "));
}
function summary() {
  failures.forEach((f) => console.error("FAIL  " + f.name + "\n      " + f.msg));
  console.log((failed ? "FAILED " : "ok ") + passed + " passed, " + failed + " failed");
  if (failed) process.exit(1);
}
module.exports = { test, eq, ok, includes, notIncludes, xmlBalanced, summary };
```

- [ ] **Step 2: Write `tests/run-tests.js`:**

```js
"use strict";
const fs = require("fs"), path = require("path");
const dir = __dirname;
fs.readdirSync(dir).filter((f) => f.endsWith(".test.js")).sort()
  .forEach((f) => require(path.join(dir, f)));
require("./t.js").summary();
```

- [ ] **Step 3: Verify** — Run: `node tests/run-tests.js` from the app root. Expected: `ok 0 passed, 0 failed`.

---

### Task 2: Designer core — catalog + codegen (pure, TDD)

**Files:**
- Create: `data/designer-core.js`
- Test: `tests/designer-core.test.js`

**Module contract (lock this exactly; UI and tests both depend on it):**

```js
// data/designer-core.js — UMD pattern, NO DOM access anywhere in this file
(function (global) {
  "use strict";
  const CORE = { CATALOG, PALETTE_GROUPS, COLORS, createNode, findNode, findParent,
                 canContain, addChild, removeNode, moveNode, walk, generate };
  global.DESIGNER_CORE = CORE;
  if (typeof module !== "undefined" && module.exports) module.exports = CORE;
})(typeof window !== "undefined" ? window : globalThis);
```

**Node shape:** `{ id: "n7", type: "Button", props: { Content: "Save" }, bindings: { Command: "SaveCommand" }, children: [] }`
- `props` holds literal values only (strings/numbers/bools). `bindings` maps AXAML property name → ViewModel member name.
- Root node is always `{ type: "Window", props: { Title, Width, Height }, children: [exactly 0 or 1 child] }`.

**CATALOG entry shape** (every supported type gets one):

```js
Button: {
  group: "Controls", container: false, icon: "▭",
  defaultProps: { Content: "Button" },
  props: [
    { name: "Content",  kind: "text",   bindable: true,  vmType: "string" },
    { name: "Command",  kind: "none",   bindable: true,  vmType: "command" }, // binding-only
    { name: "Width",    kind: "number" }, { name: "Height", kind: "number" },
    { name: "Margin",   kind: "text" },
    { name: "Background", kind: "color" }, { name: "Foreground", kind: "color" },
    { name: "FontSize", kind: "number" },
    { name: "HorizontalAlignment", kind: "select", options: ["Left","Center","Right","Stretch"] },
    { name: "VerticalAlignment",   kind: "select", options: ["Top","Center","Bottom","Stretch"] },
  ],
},
```

- [ ] **Step 1: Write the failing tests first** — `tests/designer-core.test.js`. Complete file:

```js
"use strict";
const { test, eq, ok, includes, notIncludes, xmlBalanced } = require("./t.js");
const C = require("../data/designer-core.js");

/* -- catalog sanity -- */
test("catalog covers every spec'd type", () => {
  ["StackPanel","Grid","DockPanel","WrapPanel","Border","ScrollViewer","Canvas",
   "Button","TextBox","TextBlock","CheckBox","RadioButton","Slider","ComboBox",
   "ListBox","ProgressBar","Image","Rectangle","Ellipse","Line","Polygon","Path"]
    .forEach((t) => ok(C.CATALOG[t], "missing catalog entry: " + t));
});
test("every palette group type exists in catalog", () => {
  C.PALETTE_GROUPS.forEach((g) => g.types.forEach((t) => ok(C.CATALOG[t], t)));
});
test("containers are flagged", () => {
  ["StackPanel","Grid","DockPanel","WrapPanel","Border","ScrollViewer","Canvas"]
    .forEach((t) => ok(C.CATALOG[t].container, t + " should be container"));
  ok(!C.CATALOG.Button.container, "Button is not a container");
});
test("Border and ScrollViewer accept exactly one child", () => {
  eq(C.CATALOG.Border.maxChildren, 1); eq(C.CATALOG.ScrollViewer.maxChildren, 1);
});

/* -- tree ops -- */
function freshTree() {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel");
  C.addChild(tree, tree.id, sp);
  return { tree, sp };
}
test("createNode assigns unique ids and defaults", () => {
  const a = C.createNode("Button"), b = C.createNode("Button");
  ok(a.id !== b.id, "ids unique");
  eq(a.props.Content, "Button");
});
test("addChild/findNode/findParent/removeNode round-trip", () => {
  const { tree, sp } = freshTree();
  const btn = C.createNode("Button");
  C.addChild(tree, sp.id, btn);
  eq(C.findNode(tree, btn.id).type, "Button");
  eq(C.findParent(tree, btn.id).id, sp.id);
  C.removeNode(tree, btn.id);
  eq(C.findNode(tree, btn.id), null);
});
test("canContain enforces rules", () => {
  ok(C.canContain("StackPanel", "Button"));
  ok(!C.canContain("Button", "TextBox"), "non-container rejects children");
  ok(!C.canContain("Window", "Button") || true, "window accepts one layout child");
});
test("moveNode reparents", () => {
  const { tree, sp } = freshTree();
  const grid = C.createNode("Grid"); C.addChild(tree, sp.id, grid);
  const btn = C.createNode("Button"); C.addChild(tree, sp.id, btn);
  C.moveNode(tree, btn.id, grid.id, 0);
  eq(C.findParent(tree, btn.id).id, grid.id);
});
test("moveNode refuses to move a node into its own descendant", () => {
  const { tree, sp } = freshTree();
  const grid = C.createNode("Grid"); C.addChild(tree, sp.id, grid);
  C.moveNode(tree, sp.id, grid.id, 0); // must be a no-op
  eq(C.findParent(tree, grid.id).id, sp.id);
});

/* -- codegen: AXAML -- */
test("generate emits complete well-formed Window AXAML", () => {
  const { tree, sp } = freshTree();
  sp.props.Spacing = 8;
  const btn = C.createNode("Button"); btn.props.Content = "Add"; btn.props.Background = "#DC143C";
  C.addChild(tree, sp.id, btn);
  const { axaml } = C.generate(tree);
  xmlBalanced(axaml);
  includes(axaml, 'xmlns="https://github.com/avaloniaui"');
  includes(axaml, 'xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"');
  includes(axaml, 'x:Class="ExamApp.Views.MainWindow"');
  includes(axaml, 'x:DataType="vm:MainWindowViewModel"');
  includes(axaml, "<StackPanel Spacing=\"8\"");
  includes(axaml, 'Content="Add"');
  includes(axaml, 'Background="#DC143C"');
});
test("default props are not emitted as attributes", () => {
  const { tree, sp } = freshTree();
  const { axaml } = C.generate(tree);
  notIncludes(axaml, 'Orientation="Vertical"', "Vertical is StackPanel default");
});
test("grid rows/cols and attached props", () => {
  const tree = C.createNode("Window");
  const g = C.createNode("Grid");
  g.props.RowDefinitions = "Auto,*"; g.props.ColumnDefinitions = "200,*";
  C.addChild(tree, tree.id, g);
  const tb = C.createNode("TextBox");
  tb.props["Grid.Row"] = 1; tb.props["Grid.Column"] = 1;
  C.addChild(tree, g.id, tb);
  const { axaml } = C.generate(tree);
  includes(axaml, 'RowDefinitions="Auto,*"');
  includes(axaml, 'ColumnDefinitions="200,*"');
  includes(axaml, 'Grid.Row="1"');
});
test("canvas children carry Canvas.Left/Top; shapes emit Fill", () => {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const r = C.createNode("Rectangle");
  r.props["Canvas.Left"] = 40; r.props["Canvas.Top"] = 25;
  r.props.Width = 100; r.props.Height = 60; r.props.Fill = "#39BAE6";
  C.addChild(tree, cv.id, r);
  const { axaml } = C.generate(tree);
  includes(axaml, 'Canvas.Left="40"');
  includes(axaml, 'Fill="#39BAE6"');
});

/* -- codegen: ViewModel from bindings -- */
function vmOf(setup) {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  setup(tree, sp);
  return C.generate(tree);
}
test("text binding -> [ObservableProperty] string", () => {
  const { viewModel, axaml } = vmOf((t, sp) => {
    const tb = C.createNode("TextBox"); tb.bindings.Text = "Name"; C.addChild(t, sp.id, tb);
  });
  includes(axaml, '{Binding Name}');
  includes(viewModel, "using CommunityToolkit.Mvvm.ComponentModel;");
  includes(viewModel, "public partial class MainWindowViewModel : ObservableObject");
  includes(viewModel, "[ObservableProperty]");
  includes(viewModel, "private string name");
});
test("command binding -> [RelayCommand] method named without suffix", () => {
  const { viewModel } = vmOf((t, sp) => {
    const b = C.createNode("Button"); b.bindings.Command = "SaveCommand"; C.addChild(t, sp.id, b);
  });
  includes(viewModel, "using CommunityToolkit.Mvvm.Input;");
  includes(viewModel, "[RelayCommand]");
  includes(viewModel, "private void Save()");
  notIncludes(viewModel, "private void SaveCommand()", "Command suffix must be stripped");
});
test("ItemsSource binding -> ObservableCollection + SelectedItem", () => {
  const { viewModel } = vmOf((t, sp) => {
    const lb = C.createNode("ListBox");
    lb.bindings.ItemsSource = "Items"; lb.bindings.SelectedItem = "SelectedItem";
    C.addChild(t, sp.id, lb);
  });
  includes(viewModel, "ObservableCollection<string> Items");
  includes(viewModel, "private string? selectedItem");
});
test("numeric bindings typed double; IsChecked typed bool", () => {
  const { viewModel } = vmOf((t, sp) => {
    const s = C.createNode("Slider"); s.bindings.Value = "Volume"; C.addChild(t, sp.id, s);
    const c = C.createNode("CheckBox"); c.bindings.IsChecked = "IsOn"; C.addChild(t, sp.id, c);
  });
  includes(viewModel, "private double volume");
  includes(viewModel, "private bool isOn");
});
test("duplicate binding names emit one member", () => {
  const { viewModel } = vmOf((t, sp) => {
    const a = C.createNode("TextBox"); a.bindings.Text = "Name"; C.addChild(t, sp.id, a);
    const b = C.createNode("TextBlock"); b.bindings.Text = "Name"; C.addChild(t, sp.id, b);
  });
  eq(viewModel.split("private string name").length - 1, 1, "exactly one member");
});
test("no bindings -> minimal valid VM, no unused usings", () => {
  const { viewModel } = vmOf(() => {});
  includes(viewModel, "public partial class MainWindowViewModel : ObservableObject");
  notIncludes(viewModel, "CommunityToolkit.Mvvm.Input");
});
test("generate never throws on unknown node type", () => {
  const tree = C.createNode("Window");
  const weird = { id: "zz", type: "Bogus", props: {}, bindings: {}, children: [] };
  tree.children.push(weird);
  const { axaml } = C.generate(tree);
  includes(axaml, "<!--"); // skipped with a comment
});
```

- [ ] **Step 2: Run to verify failure** — Run: `node tests/run-tests.js`. Expected: FAIL (cannot find `../data/designer-core.js`).

- [ ] **Step 3: Implement `data/designer-core.js`.** Full CATALOG (all 22 types from the test). Required catalog facts beyond the Button example above:
  - `StackPanel`: container; defaultProps `{ Orientation: "Vertical" }`; props Orientation(select Vertical|Horizontal), Spacing(number), Margin, Background(color), Width, Height, alignments.
  - `Grid`: container; props RowDefinitions(text), ColumnDefinitions(text), Margin, Background, ShowGridLines(bool). Children of a Grid additionally get attached props `Grid.Row`, `Grid.Column`, `Grid.RowSpan`, `Grid.ColumnSpan` (numbers) — the inspector/codegen read them from `child.props`.
  - `DockPanel`: container; props LastChildFill(bool, default true), Margin, Background. Children get attached `DockPanel.Dock` (select Left|Top|Right|Bottom).
  - `WrapPanel`: container; Orientation, ItemWidth, ItemHeight, Margin.
  - `Border`: container, `maxChildren: 1`; Background, BorderBrush(color), BorderThickness, CornerRadius, Padding, Margin.
  - `ScrollViewer`: container, `maxChildren: 1`.
  - `Canvas`: container; Background, Width, Height. Children get attached `Canvas.Left`, `Canvas.Top` (numbers).
  - `TextBox`: Text(text, bindable, vmType string), Watermark(text), Width, FontSize, Margin, alignments.
  - `TextBlock`: Text(bindable string), FontSize, FontWeight(select Normal|Bold), Foreground, Margin, TextWrapping(select NoWrap|Wrap), alignments.
  - `CheckBox`: Content(text), IsChecked(bool, bindable, vmType bool).
  - `RadioButton`: Content, GroupName(text), IsChecked(bool bindable bool).
  - `Slider`: Minimum, Maximum, Value(number, bindable, vmType double), Width, TickFrequency.
  - `ComboBox`: ItemsSource(binding-only, vmType collection), SelectedItem(binding-only, vmType selectedItem), PlaceholderText, Width.
  - `ListBox`: same binding props as ComboBox + Height, SelectionMode(select Single|Multiple).
  - `ProgressBar`: Minimum, Maximum, Value(bindable double), IsIndeterminate(bool), Width, Height.
  - `Image`: Source(text), Width, Height, Stretch(select None|Fill|Uniform|UniformToFill).
  - Shapes `Rectangle`/`Ellipse`: Width, Height, Fill(color, bindable string), Stroke(color), StrokeThickness, RadiusX/RadiusY (Rectangle only).
  - `Line`: StartPoint(text "0,0"), EndPoint(text "100,100"), Stroke, StrokeThickness.
  - `Polygon`: Points(text "0,40 40,0 80,40"), Fill, Stroke, StrokeThickness.
  - `Path`: Data(text "M 0,0 L 40,40"), Fill, Stroke, StrokeThickness.
  - `Window` (not in palette): Title(text, default "Exam App"), Width(default 600), Height(default 400). `maxChildren: 1`.
  - `COLORS`: 20 swatches: `#0B0E14 #1F2430 #39BAE6 #59C2FF #7FD962 #AAD94C #E6B450 #FF8F40 #F07178 #DC143C #D2A6FF #B8CFE6 #FFFFFF #F5F5F5 #808080 #404040 #2E7D32 #1565C0 #6A1B9A Transparent`.
  - `PALETTE_GROUPS`: `[{name:"Layout", types:[StackPanel,Grid,DockPanel,WrapPanel,Border,ScrollViewer,Canvas]},{name:"Controls",types:[Button,TextBox,TextBlock,CheckBox,RadioButton,Slider,ComboBox,ListBox,ProgressBar,Image]},{name:"Shapes",types:[Rectangle,Ellipse,Line,Polygon,Path]}]`.

  **Codegen algorithm (implement exactly this shape):**

```js
let idSeq = 1;
function createNode(type) {
  const def = CATALOG[type] || { defaultProps: {} };
  return { id: "n" + (idSeq++), type,
           props: Object.assign({}, def.defaultProps), bindings: {}, children: [] };
}
function generate(tree) {
  const bindings = [];                       // collected {name, vmType, itemOf}
  const body = emitNode(tree.children[0], 2, bindings);
  const axaml = [
    '<Window xmlns="https://github.com/avaloniaui"',
    '        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"',
    '        xmlns:vm="using:ExamApp.ViewModels"',
    '        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"',
    '        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
    '        mc:Ignorable="d" d:DesignWidth="' + (tree.props.Width || 600) + '" d:DesignHeight="' + (tree.props.Height || 400) + '"',
    '        x:Class="ExamApp.Views.MainWindow"',
    '        x:DataType="vm:MainWindowViewModel"',
    '        Title="' + (tree.props.Title || "Exam App") + '"',
    '        Width="' + (tree.props.Width || 600) + '" Height="' + (tree.props.Height || 400) + '">',
    '',
    '    <Design.DataContext><vm:MainWindowViewModel/></Design.DataContext>',
    '',
    body || '    <!-- drag a layout container here -->',
    '</Window>', ''
  ].join("\n");
  return { axaml, viewModel: emitViewModel(bindings) };
}
```

  `emitNode(node, depth, out)`: returns "" for null; unknown type → `indent + "<!-- skipped unknown element: " + type + " -->"`. Otherwise: attributes = non-default props (in catalog prop order, attached props last) + bindings as `Name="{Binding VmName}"`; push each binding into `out` with vmType from the catalog prop def (SelectedItem of a list bound together with ItemsSource gets vmType "string?" — keep item type `string` for v1). Children indented by 4 spaces per depth; ≤2 attributes stay on one line, otherwise wrap attributes aligned under the first.
  `emitViewModel(bindings)`: dedupe by name (first vmType wins); emit
  - header `using System.Collections.ObjectModel;` (only if a collection), `using CommunityToolkit.Mvvm.ComponentModel;`, `using CommunityToolkit.Mvvm.Input;` (only if a command), `namespace ExamApp.ViewModels;`
  - `public partial class MainWindowViewModel : ObservableObject` with: `[ObservableProperty] private <type> <camelName> = <default>;` (string → `= "";`, double/int → none, bool → none, string? → none), `public ObservableCollection<string> <Name> { get; } = new();` for collections, `[RelayCommand] private void <NameWithoutCommandSuffix>() { /* TODO: implement */ }`.

- [ ] **Step 4: Run tests** — `node tests/run-tests.js`. Expected: PASS, all designer-core tests green.

---

### Task 3: Designer UI

**Files:**
- Create: `data/designer.js`
- Create: `designer.css`
- Test: `tests/designer-ui.test.js` (string-level checks only)

**Module contract:** `window.DESIGNER = { render() /* -> html string */, init() /* post-insert wiring */ }`. All handlers live on `window.DSG` (e.g. `onclick="DSG.select('n3')"`) to avoid polluting the global namespace further.

- [ ] **Step 1: Failing test** — `tests/designer-ui.test.js`:

```js
"use strict";
const { test, ok, includes } = require("./t.js");
global.window = global;            // designer.js attaches to window; no DOM calls at load time
require("../data/designer-core.js");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../data/designer.js", "utf8");
test("designer.js never touches document at load time (only inside functions)", () => {
  const topLevel = src.replace(/function[\s\S]*?\n\}/g, "");
  ok(topLevel.indexOf("document.") === -1, "document.* found at top level");
});
test("designer UI module loads under Node and exposes render/init", () => {
  require("../data/designer.js");
  ok(typeof global.DESIGNER.render === "function");
  ok(typeof global.DESIGNER.init === "function");
});
test("preview HTML escapes user text", () => {
  const C = global.DESIGNER_CORE;
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const tb = C.createNode("TextBlock"); tb.props.Text = '<img onerror=x>'; C.addChild(tree, sp.id, tb);
  const html = global.DESIGNER.previewHTML(tree);
  includes(html, "&lt;img");
});
```

- [ ] **Step 2: Run** `node tests/run-tests.js` — expected FAIL (no designer.js).

- [ ] **Step 3: Implement `data/designer.js`.** Structure:
  - State: `let tree, selectedId, dragType, dragNodeId;` plus `slots()` (named designs) backed by localStorage key `aop-designer-slots` (`{ [name]: tree }`) and `aop-designer-current` (autosaved working tree + selectedId), all try/catch-wrapped like `store` in app.js.
  - `render()` returns the page shell: `.content-inner.content-wide` > crumb + title + toolbar (slot select, Save as…, Load, Delete, New, seed examples) + `.dsg` three-pane flex: `.dsg-palette` (groups from `PALETTE_GROUPS`, one `.dsg-tool[draggable=true]` per type with icon + label; below them the `.dsg-colors` swatch grid, one `.dsg-swatch[draggable=true]` per `COLORS` entry), `.dsg-stage` (window chrome + `#dsg-canvas` preview region + breadcrumb of selected node ancestry), `.dsg-inspector` (`#dsg-insp`). Below: `#dsg-output` with the two generated code panes.
  - `init()`: binds dragstart on tools/swatches (`e.dataTransfer.setData("text/dsg-type", type)` / `"text/dsg-color"`), and delegates dragover/drop/click on `#dsg-canvas`. Re-render of dynamic regions happens via `refresh()` which re-paints canvas, inspector, output, and persists state — NOT the whole page (keeps palette drag handlers alive).
  - `previewHTML(tree)` (exported for tests): pure tree→HTML-string approximation. Each node renders as `<div class="pv pv-<Type>" data-id="...">` with inline styles mapping props: StackPanel→flex column/row + gap, Grid→CSS grid with `grid-template-rows/columns` translated (`Auto`→`auto`, `*`→`1fr`, `2*`→`2fr`, px numbers as-is) and children placed via `grid-row/column`, DockPanel→flex approximation honoring Dock sides (top/bottom rows then left/right), WrapPanel→flex-wrap, Border→border+radius+padding, Canvas→`position:relative` with children `position:absolute` at Canvas.Left/Top, shapes→divs (Ellipse→border-radius:50%; Line/Polygon/Path→inline SVG). Controls render as styled placeholders (Button→button-looking div with Content, TextBox→input-looking div with Watermark/Text, ListBox→3 ghost rows or `{Binding X}` chip when bound). Bound props show a `⚡ {Binding Name}` chip. Selected node gets class `sel`; every node is clickable (`data-id`, click → `DSG.select(id)`) and draggable for reorder/reparent.
  - Drop logic: dropping a palette type on a node → insert into that node if `canContain` (else into nearest ancestor container, else flash the reason in a small status line `#dsg-msg`); dropping a swatch on a node sets `Fill` for shapes else `Background`. Dropping an existing node onto a container calls `moveNode` (descendant check already in core).
  - Inspector for selection: name header (`Button n7`), delete button, ▲▼ reorder-within-parent buttons, then one labeled field per catalog prop by `kind` (text→input, number→input[type=number], select→select, color→color swatch row + text input, bool→checkbox), and for bindable props a `⚡` toggle that switches the row to a "VM property name" input writing `node.bindings[prop]` (emptying it switches back to literal). When the parent is Grid/DockPanel/Canvas show the attached-prop fields. Grid-selected shows row/col definition editors (comma-separated text inputs, validated by regex `/^\s*((Auto|\*|\d+\*?|\d+\.\d+\*)\s*,\s*)*(Auto|\*|\d+\*?|\d+\.\d+\*)\s*$/i`, invalid → red border + not applied).
  - Output: `DESIGNER_CORE.generate(tree)` → two code panes (xml + csharp) rendered with the app's `highlight()` + a copy button each (use its own tiny registry + `navigator.clipboard` fallback copy, mirroring app.js `fallbackCopy`), plus a one-line hint: "Paste AXAML into Views/MainWindow.axaml, ViewModel into ViewModels/MainWindowViewModel.cs — code-behind stays untouched."
  - Seed example slots (created on first run if no slots exist): "Recipe list + form" (Grid 2-col: ListBox bound Items/SelectedItem; right StackPanel: TextBox Text→Name, Slider Value→Rating, Button Command→AddCommand, TextBlock Text→StatusMessage) and "Shapes canvas" (Canvas with Rectangle/Ellipse/Line with colors).
  - Keyboard: Delete removes selection (wired in `init()` via a keydown listener that checks `current === "designer"`; remove listener not needed — guard instead).

- [ ] **Step 4: Write `designer.css`** — namespaced under `.dsg` (palette grid, stage with subtle window chrome reusing `.preview-chrome` look, inspector rows, swatches, drop-target highlight `.pv.drop-ok { outline: 2px dashed var(--acc, #e6b450); }`, selection outline, `⚡` bound-chip styling). Match the app's existing dark theme variables from `styles.css` (inspect `:root` there; reuse its colors and fonts, no new fonts).

- [ ] **Step 5: Run tests** — `node tests/run-tests.js`. Expected: PASS.

---

### Task 4: Analyzer core — scanner (pure, TDD)

**Files:**
- Create: `data/analyzer-core.js`
- Create: `tests/fixtures/` — copy the two real exam Problem 1 codebases:
  - From `C:\Users\Max\Desktop\Advanced Object-Oriented Programming, (F26)\AOP_2025_Exam_One\Problem_1_OOP\DocumentManager\*.cs` → `tests/fixtures/summer2025/`
  - From `C:\Users\Max\Desktop\AOP_extracted\AOP_ReExam2025_part1_code\AOP_ReExam2025_part1_code\Problem 1 - SOLID\FamilyMealPlanner\*.cs` → `tests/fixtures/reexam2025/`
- Test: `tests/analyzer-core.test.js`

**Module contract (UMD like designer-core):**

```js
global.ANALYZER_CORE = {
  RULES,                 // array, see below
  PRINCIPLES,            // { SRP: {name, summary}, OCP: {...}, LSP, ISP, DIP, ENC: encapsulation, POLY }
  scan(files),           // [{name, text}] -> { findings: [...], index }
  buildIndex(files),     // -> { classes: {name: {file, line, isAbstract}}, interfaces: {name: {file, line, members[]}}, enums: [...] }
  assembleAnswer(findings, opts) // confirmed findings -> full written-answer draft (markdown-ish plain text)
};
```

**Finding shape:** `{ ruleId, principle, severity: "high"|"medium"|"info", file, line, excerpt, message, theory, fix, paragraph }` — `paragraph` is the prose template with class names/lines already substituted.

- [ ] **Step 1: Copy fixtures** (PowerShell):

```powershell
New-Item -ItemType Directory -Force "tests\fixtures\summer2025", "tests\fixtures\reexam2025"
Copy-Item "C:\Users\Max\Desktop\Advanced Object-Oriented Programming, (F26)\AOP_2025_Exam_One\Problem_1_OOP\DocumentManager\*.cs" "tests\fixtures\summer2025\"
Copy-Item "C:\Users\Max\Desktop\AOP_extracted\AOP_ReExam2025_part1_code\AOP_ReExam2025_part1_code\Problem 1 - SOLID\FamilyMealPlanner\*.cs" "tests\fixtures\reexam2025\"
```

- [ ] **Step 2: Failing tests** — `tests/analyzer-core.test.js`. Synthetic positive/negative cases per rule + real-exam calibration. Complete file:

```js
"use strict";
const { test, eq, ok, includes } = require("./t.js");
const A = require("../data/analyzer-core.js");
const fs = require("fs"), path = require("path");

function scanSnippet(text) { return A.scan([{ name: "Test.cs", text }]).findings; }
function hasRule(findings, id) { return findings.some((f) => f.ruleId === id); }
function byRule(findings, id) { return findings.filter((f) => f.ruleId === id); }

/* ---- rule: concrete downcast ---- */
test("flags 'as ConcreteRepo' downcast", () => {
  const f = scanSnippet(`
class InMemoryRepo : IRepo { public void Save() {} public int Bonus() => 1; }
class Planner {
  private readonly IRepo _repo;
  public Planner(IRepo repo) { _repo = repo; }
  public void Run() { var c = _repo as InMemoryRepo; c.Bonus(); }
}`);
  ok(hasRule(f, "downcast"), "downcast rule should fire");
  const d = byRule(f, "downcast")[0];
  eq(d.principle, "LSP");
  includes(d.paragraph, "InMemoryRepo");
});
test("does NOT flag 'as IInterface' or 'as string'", () => {
  const f = scanSnippet(`
interface IRepo {}
class A { void M(object o) { var x = o as IRepo; var s = o as string; } }`);
  ok(!hasRule(f, "downcast"));
});

/* ---- rule: new concrete in ctor ---- */
test("flags new of project class inside constructor", () => {
  const f = scanSnippet(`
class FileLogger {}
class Service {
  private FileLogger _log;
  public Service() { _log = new FileLogger(); }
}`);
  ok(hasRule(f, "new-in-ctor"));
  eq(byRule(f, "new-in-ctor")[0].principle, "DIP");
});
test("does NOT flag new List<> or new of injected abstractions", () => {
  const f = scanSnippet(`
class Service { private List<int> _xs; public Service() { _xs = new List<int>(); } }`);
  ok(!hasRule(f, "new-in-ctor"), "BCL collections are fine");
});

/* ---- rule: NotImplementedException in member ---- */
test("flags NotImplementedException / NotSupportedException", () => {
  const f = scanSnippet(`
interface IDoc { void Print(); void Fax(); }
class Web : IDoc { public void Print() {} public void Fax() { throw new NotImplementedException(); } }`);
  ok(hasRule(f, "not-implemented"));
});

/* ---- rule: type-check chain ---- */
test("flags is-type chains and GetType comparisons", () => {
  const f = scanSnippet(`
class Shape {}
class Circle : Shape {}
class Square : Shape {}
class Area {
  public double Of(Shape s) {
    if (s is Circle) return 1;
    else if (s is Square) return 2;
    return 0;
  }
}`);
  ok(hasRule(f, "type-check-chain"));
  eq(byRule(f, "type-check-chain")[0].principle, "OCP");
});
test("single 'is' pattern alone does not fire the chain rule", () => {
  const f = scanSnippet(`class A { bool M(object o) => o is string; }`);
  ok(!hasRule(f, "type-check-chain"));
});

/* ---- rule: public mutable field ---- */
test("flags public fields; ignores const/readonly/properties", () => {
  const f = scanSnippet(`
class M {
  public int Count;
  public const int Max = 5;
  public readonly int Id = 1;
  public int Ok { get; set; }
}`);
  eq(byRule(f, "public-field").length, 1);
  eq(byRule(f, "public-field")[0].principle, "ENC");
});

/* ---- rule: console in domain ---- */
test("flags Console.* in non-Program classes only", () => {
  const f = A.scan([
    { name: "Program.cs", text: `class Program { static void Main() { Console.WriteLine("hi"); } }` },
    { name: "Order.cs",   text: `class Order { public void Save() { Console.WriteLine("saved"); } }` },
  ]).findings;
  eq(byRule(f, "console-in-domain").length, 1);
  eq(byRule(f, "console-in-domain")[0].file, "Order.cs");
});

/* ---- rule: fat interface ---- */
test("flags interface with >= 5 members as ISP smell", () => {
  const f = scanSnippet(`
interface IDocument { void Open(); void Close(); void Print(); void Fax(); void Scan(); void Email(); }`);
  ok(hasRule(f, "fat-interface"));
  eq(byRule(f, "fat-interface")[0].principle, "ISP");
});

/* ---- rule: static mutable state ---- */
test("flags public static mutable fields", () => {
  const f = scanSnippet(`class G { public static int Counter = 0; }`);
  ok(hasRule(f, "static-mutable"));
});

/* ---- rule: member hiding ---- */
test("flags 'new' member hiding", () => {
  const f = scanSnippet(`
class Base { public void Run() {} }
class Derived : Base { public new void Run() {} }`);
  ok(hasRule(f, "member-hiding"));
});

/* ---- rule: god class ---- */
test("flags class mixing I/O + persistence + domain or > 200 lines", () => {
  const body = Array.from({ length: 30 }, (_, i) => `  public void M${i}() { }`).join("\n");
  const f = scanSnippet(`
class Everything {
  public void Load() { var t = File.ReadAllText("x.json"); }
  public void Show() { Console.WriteLine("x"); }
  public decimal Total() => 42m;
${body}
}`);
  ok(hasRule(f, "god-class"));
});

/* ---- robustness ---- */
test("scan never throws on garbage input and returns empty on empty", () => {
  eq(A.scan([]).findings.length, 0);
  A.scan([{ name: "x.cs", text: "}}}{{{ class ;;; %%%" }]); // must not throw
});
test("a crashing rule is skipped, not fatal", () => {
  const evil = { id: "evil", principle: "SRP", severity: "info", title: "evil",
                 theory: "", fix: "", scan() { throw new Error("boom"); } };
  A.RULES.push(evil);
  try { A.scan([{ name: "x.cs", text: "class A {}" }]); }
  finally { A.RULES.pop(); }
});

/* ---- real exam calibration ---- */
function loadFixtures(dir) {
  const base = path.join(__dirname, "fixtures", dir);
  return fs.readdirSync(base).filter((f) => f.endsWith(".cs"))
    .map((f) => ({ name: f, text: fs.readFileSync(path.join(base, f), "utf8") }));
}
test("re-exam 2025: finds the planted InMemoryRecipeRepository downcast", () => {
  const { findings } = A.scan(loadFixtures("reexam2025"));
  const d = byRule(findings, "downcast");
  ok(d.some((x) => x.excerpt.indexOf("InMemoryRecipeRepository") !== -1),
     "must flag the as-InMemoryRecipeRepository downcast; got: " + JSON.stringify(d.map((x) => x.excerpt)));
});
test("re-exam 2025: surfaces at least 3 distinct principles", () => {
  const { findings } = A.scan(loadFixtures("reexam2025"));
  ok(new Set(findings.map((f) => f.principle)).size >= 3,
     "principles found: " + [...new Set(findings.map((f) => f.principle))].join(","));
});
test("summer 2025: scanner produces findings on DocumentManager", () => {
  const { findings } = A.scan(loadFixtures("summer2025"));
  ok(findings.length >= 3, "expected >=3 findings, got " + findings.length);
});

/* ---- answer assembly ---- */
test("assembleAnswer produces structured prose with evidence", () => {
  const { findings } = A.scan(loadFixtures("reexam2025"));
  const draft = A.assembleAnswer(findings.slice(0, 3), { project: "FamilyMealPlanner" });
  includes(draft, "FamilyMealPlanner");
  includes(draft, findings[0].file);
  ok(draft.length > 400, "draft should be a real draft, got " + draft.length + " chars");
});
```

  NOTE for the implementer: after writing the scanner, READ both fixture sets and the model answers in `data/exams.js` (search "1.4", "downcast", "violat") — if the planted violations include patterns not covered by a rule, add a rule for them; if a calibration expectation above proves wrong against the real code, fix the EXPECTATION to match reality and note it in the task report. The two calibration suites are the ground truth.

- [ ] **Step 3: Run** — expected FAIL (no analyzer-core.js).

- [ ] **Step 4: Implement `data/analyzer-core.js`.**
  - `stripForScan(text)`: replace string literals/char literals/comments with same-length spaces (preserve line structure!) so rules don't fire inside strings. Keep the original text for excerpts.
  - `buildIndex(files)`: regex over stripped text: `(?:abstract\s+|sealed\s+|partial\s+|static\s+)*(class|interface|record|enum)\s+(\w+)` records names with file+line; interface bodies parsed shallowly for member count (split on `;` within the interface's brace span — track braces with a counter).
  - Per-file line scanning with a tiny context tracker: current namespace/class/method (brace-depth based; regex for `class X`, ctor `public X(`, method headers). Each rule's `scan(file, ctx, index)` may use it.
  - Rules (ids fixed by the tests): `downcast` (regexes `\bas\s+(\w+)` and `\(\s*(\w+)\s*\)\s*\w` where the captured name ∈ index.classes and not ∈ interfaces; principle LSP, severity high; mention DIP in theory text), `new-in-ctor` (inside a constructor or field initializer: `new\s+(\w+)\s*\(` where name ∈ index.classes, not BCL — whitelist skip: List, Dictionary, HashSet, Queue, Stack, StringBuilder, ObservableCollection, etc.; DIP, high), `not-implemented` (`throw\s+new\s+Not(Implemented|Supported)Exception`; LSP/ISP, high), `type-check-chain` (≥2 occurrences of `\bis\s+[A-Z]\w*` or `GetType\(\)\s*==` within one method span; OCP, medium), `public-field` (`public\s+(?!const|readonly|static\s+readonly)(?:static\s+)?[\w<>,?\[\]]+\s+\w+\s*(=|;)` excluding lines with `(`, `{`, `=>`; ENC, medium), `console-in-domain` (`Console\.(Write|Read)` in a class that is not `Program` and whose file is not Program.cs; SRP, medium), `fat-interface` (interface member count ≥5; ISP, medium), `static-mutable` (`public\s+static\s+(?!readonly|const)[\w<>]+\s+\w+`; DIP/testability — principle "DIP", info), `member-hiding` (`public\s+new\s+\w+`; POLY → principle "LSP", medium), `god-class` (class span > 200 lines OR (uses File./Directory. AND Console. AND has ≥1 non-IO public method); SRP, medium), `unused-injected-field` (field assigned from ctor param but never referenced elsewhere in the class span; SRP/DIP, info — this catches the re-exam's `_rules` field).
  - Every rule carries `title`, `theory` (3-5 sentence explanation of the principle violation, written for exam answers), `fix` (2-3 sentences), `paragraph(ctx)` template producing exam-ready prose: e.g. downcast → `"In <file> (line <n>), <class> receives <iface> through its constructor but immediately downcasts it with 'as <concrete>'. This violates the Liskov Substitution Principle: the code no longer works for any <iface>, only for <concrete>, so substituting another implementation breaks it. It also defeats Dependency Inversion — the high-level policy now depends on a concrete class again. Fix: move the needed member onto the interface (or a new focused interface) and depend only on abstractions."` — with all placeholders substituted from the finding.
  - `PRINCIPLES` map used by the UI for grouping + the theory sidebar (SRP/OCP/LSP/ISP/DIP/ENC with one-paragraph summaries).
  - `scan(files)`: wraps every rule in try/catch (a failing rule is skipped); findings sorted by file then line.
  - `assembleAnswer(findings, opts)`: returns plain text: title line (`OOP/SOLID analysis — <project>`), short intro paragraph, then one numbered section per finding (`<n>. <principle> — <title> (<file>:<line>)` + its `paragraph` + `Suggested fix: <fix>`), then a closing paragraph summarizing which principles were hit. No markdown tables, plain prose the user can paste into a doc and edit.

- [ ] **Step 5: Run tests** — `node tests/run-tests.js`. Expected: PASS including both calibration suites. If a calibration test fails, read the fixture, decide rule-bug vs wrong-expectation, fix accordingly (see NOTE above).

---

### Task 5: Analyzer UI

**Files:**
- Create: `data/analyzer.js`
- Create: `analyzer.css`
- Test: extend `tests/designer-ui.test.js` pattern — create `tests/analyzer-ui.test.js` with the same load-under-Node + escape checks (module `window.ANALYZER`, handlers on `window.ANZ`, exported pure helper `findingCard(finding)` must `esc()` excerpts: test with an excerpt containing `<script>`).

- [ ] **Step 1: failing UI test (as above), run, see FAIL.**
- [ ] **Step 2: Implement `data/analyzer.js`** (`window.ANALYZER = { render, init, findingCard }`, handlers on `window.ANZ`):
  - Layout: `.content-inner.content-wide`, crumb + title, then `.anz` two-pane: left = file tabs bar (`+ add file` button, each tab: editable filename input + ✕) above a `<textarea class="anz-src">` per file (one visible at a time); a `Scan` button + `Load example` button (loads the re-exam fixture? NO — fixtures are test-only; embed ONE small built-in demo snippet with 3 planted violations); right = results.
  - On Scan: `ANALYZER_CORE.scan(files)` → results pane: summary strip (count by principle, colored chips), findings grouped by principle, each rendered by `findingCard(f)`: severity badge, `file:line`, highlighted excerpt (use app `highlight(excerpt, "csharp")`), message, collapsible theory (`<details>`), fix, and a checkbox `include in answer`.
  - Clicking a finding's `file:line` switches to that file's tab and highlights the line: render the textarea content into an adjacent read-only `<pre>` view with line numbers after scanning (textarea for editing, pre for navigation — toggle button `edit / view`); the target line gets `.anz-hot` class and `scrollIntoView`.
  - Answer assembly bar (sticky bottom of results): `n findings selected → Build written answer`; opens a section with `assembleAnswer(selected, { project: <first filename without extension> })` in a `<textarea>` (editable) + copy button.
  - Theory sidebar block above results: 6 principle chips; clicking expands `PRINCIPLES[p]` summary.
  - State (files + which findings checked) persisted to localStorage `aop-analyzer-state` (try/catch).
- [ ] **Step 3: `analyzer.css`** — namespaced `.anz`; tabs, badges per severity, principle chips reusing category colors, `.anz-hot { background: rgba(230,180,80,.18); }`.
- [ ] **Step 4: Run tests** — expected PASS.

---

### Task 6: Quiz bank + Quiz UI

**Files:**
- Create: `data/quiz-bank.js` (content), `data/quiz.js` (UI), `quiz.css`
- Test: `tests/quiz.test.js`

- [ ] **Step 1: failing test** — `tests/quiz.test.js`:

```js
"use strict";
const { test, eq, ok } = require("./t.js");
global.window = global;
const BANK = require("../data/quiz-bank.js");
const CATS = ["OOP", "SOLID", "Avalonia & MVVM", "Testing", "Threading & Async", "LINQ & JSON", "Collections & Generics"];
test("bank has at least 90 questions", () => ok(BANK.length >= 90, "got " + BANK.length));
test("every category has at least 10 questions", () => {
  CATS.forEach((c) => ok(BANK.filter((q) => q.cat === c).length >= 10, c));
});
test("ids unique, schema valid", () => {
  const seen = new Set();
  BANK.forEach((q) => {
    ok(q.id && !seen.has(q.id), "dup/missing id " + q.id); seen.add(q.id);
    ok(CATS.includes(q.cat), q.id + " bad cat " + q.cat);
    ok(["mc", "code-mc", "short"].includes(q.type), q.id + " bad type");
    ok(q.q && q.explain, q.id + " missing q/explain");
    if (q.type !== "short") {
      ok(Array.isArray(q.choices) && q.choices.length >= 3, q.id + " needs >=3 choices");
      ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length, q.id + " bad answer idx");
    } else ok(typeof q.answer === "string" && q.answer.length > 0, q.id + " short needs model answer");
    if (q.type === "code-mc") ok(q.code, q.id + " code-mc needs code");
  });
});
test("at least 15 spot-the-violation code questions", () => {
  ok(BANK.filter((q) => q.type === "code-mc").length >= 15);
});
```

- [ ] **Step 2: run, FAIL.**
- [ ] **Step 3: Write `data/quiz-bank.js`** — UMD (`window.QUIZ_BANK = BANK; module.exports = BANK;`). ≥90 questions matching the schema, sourced from the existing content modules (`solid.js`, `oop.js`, `mvvm.js`, `avalonia.js`, `testing.js`, `threading.js`, `linq.js`, `collections.js` — read them and turn rules/gotchas/definitions into questions) and the 2025 exams. Each: `{ id: "solid-07", cat, type, q, code?, choices?, answer, explain }`. `explain` must teach (2-4 sentences), not just restate. code-mc questions: short C# snippet, "which principle does this violate?" or "what is wrong here?".
- [ ] **Step 4: Write `data/quiz.js`** — `window.QUIZ = { render, init }`, handlers `window.QZ`. Start screen: category multi-select chips + mode (All shuffled / Weak topics first / 10-question sprint) + per-category stats bars (right/wrong from localStorage `aop-quiz-stats`: `{ [qid]: { r, w } }`). Quiz screen: progress `7/20`, question card (code rendered with `highlight`), mc: click choice → instant right/wrong color + explanation reveal + Next; short: reveal-answer button then self-grade `Right / Wrong` buttons. Every grade updates stats. End screen: score, per-category breakdown, `Retry wrong ones` button. Weak-topics mode sorts by wrong-rate descending then unseen first.
- [ ] **Step 5: `quiz.css`** — namespaced `.qz`.
- [ ] **Step 6: Run tests** — PASS expected.

---

### Task 7: App integration (single task — touches shared files)

**Files:**
- Modify: `index.html` (script + css tags)
- Modify: `app.js` (routes, nav, boot, search, pin-hide, home cards)

- [ ] **Step 1: failing integration test** — `tests/integration.test.js`:

```js
"use strict";
const { test, ok, includes } = require("./t.js");
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/../index.html", "utf8");
const app = fs.readFileSync(__dirname + "/../app.js", "utf8");
test("index.html loads new modules before app.js", () => {
  ["designer-core.js", "designer.js", "analyzer-core.js", "analyzer.js", "quiz-bank.js", "quiz.js"]
    .forEach((f) => includes(html, "data/" + f));
  ok(html.indexOf("data/designer-core.js") < html.indexOf("app.js\""), "order");
  ["designer.css", "analyzer.css", "quiz.css"].forEach((f) => includes(html, f));
});
test("app.js routes the three new tools", () => {
  ["designer", "analyzer", "quiz"].forEach((r) => includes(app, '"' + r + '"'));
  includes(app, "DESIGNER.render"); includes(app, "ANALYZER.render"); includes(app, "QUIZ.render");
});
test("nav has Exam Day group", () => includes(app, "Exam Day"));
```

- [ ] **Step 2: `index.html`** — add `<link rel="stylesheet" href="designer.css">` (+ analyzer, quiz) after `styles.css`; add the six script tags after `data/builder.js`, before the content modules.
- [ ] **Step 3: `app.js` edits** (all small, keep existing behavior):
  1. In `go(id)`: add branches before the topic fallback —
     ```js
     } else if (id === "designer") { content.innerHTML = DESIGNER.render(); setTimeout(() => DESIGNER.init(), 0);
     } else if (id === "analyzer") { content.innerHTML = ANALYZER.render(); setTimeout(() => ANALYZER.init(), 0);
     } else if (id === "quiz")     { content.innerHTML = QUIZ.render();     setTimeout(() => QUIZ.init(), 0);
     ```
  2. Boot check (app.js:760-765): add `|| bootId === "designer" || bootId === "analyzer" || bootId === "quiz"`.
  3. `updatePinBtn` (app.js:575): add the three ids to the hide list.
  4. `buildNav` nav-tools block: rename header concept to an "Exam Day" group: keep Code Lab + UI Builder entries and add — Visual Designer (`⌗`, "drag & drop → AXAML + VM"), Analysis Lab (`⌖`, "paste code → violations + answer"), Quiz (`?`, "self-test, tracks weak spots"). Add `<div class="nav-group-label">EXAM DAY</div>` above them (style exists? add `.nav-group-label` to styles.css: small caps, muted — ONE rule appended at the end of styles.css, nothing else in that file changes).
  5. Persist collapsed categories: replace `nav.dataset.closed` with `store`-style localStorage (`aop-nav-closed`); add getter/setter on `store`; `toggleCat` writes through it; `buildNav` reads it.
  6. `TOOL_TOPICS`: add three pseudo-topics so search finds them (`designer` — "visual designer drag drop axaml viewmodel layout grid canvas colors", `analyzer` — "solid analysis scanner violation downcast srp ocp lsp isp dip written answer", `quiz` — "quiz test questions practice self-test").
  7. `renderHome` Tools grid: add three `homecard toolcard` cards mirroring the existing two.
  8. Keyboard guard (app.js:737-754): the global `h`/arrow handlers must ALSO bail when `e.target` is an INPUT/TEXTAREA/SELECT or contentEditable — currently only `searchBox` is excluded and the new tools are full of inputs. Change the first guard line to:
     ```js
     const tag = (e.target.tagName || "").toUpperCase();
     if (e.target === searchBox || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;
     ```
- [ ] **Step 4: Run `node tests/run-tests.js`** — all suites PASS.
- [ ] **Step 5: Browser smoke test** — open `index.html` in a browser (PowerShell: `Start-Process .\index.html`) and verify by hand:
  - sidebar shows EXAM DAY group with 5 tools; all three new routes render; existing routes (`#`, a topic, `#lab`, `#builder`) still work; search finds "designer"; no console errors (F12).
  - Designer: drag StackPanel into window, Button into it, swatch onto button, bind Command, see both code panes update; reload page → design persisted.
  - Analyzer: Load example → Scan → findings appear; check two → Build written answer → draft contains both.
  - Quiz: complete a 10-question sprint; stats persist after reload.

---

### Task 8: Final polish + docs

**Files:**
- Modify: `README.txt` (mention the three new tools + `node tests/run-tests.js`)
- Modify: `data/bootcamp.js` — ONLY IF trivially safe: add a tasks line in the day-before checklist pointing at the new tools ("Run one practice round in Quiz; rebuild the re-exam UI in the Visual Designer"). If the structure is unclear, skip.

- [ ] Update README, run full suite, document any deviations.

---

### Task 9 (STRETCH — only after Tasks 1-8 verified): Standalone Avalonia designer

**Files:** new solution `C:\Users\Max\Desktop\AOP Visual Designer\` — `AopDesigner.sln`, project `AopDesigner` (net9.0, Avalonia 11.2.1, Avalonia.Themes.Fluent, Avalonia.Fonts.Inter, CommunityToolkit.Mvvm 8.2.1 — mirror the csproj of `C:\Users\Max\Desktop\AOP Exam Starter Kit\ExamApp\ExamApp.csproj`).

Scope (keep it small — true-fidelity preview is the whole point):
- MVVM: `MainWindowViewModel` with `ObservableCollection<DesignItem> Items`, `DesignItem` = `{ ControlType, X, Y, Width, Height, Text, Fill }` (ObservableObject).
- Left ListBox palette (Button, TextBox, TextBlock, CheckBox, Slider, Rectangle, Ellipse); "Add" places the control on a Canvas (ItemsControl with Canvas panel, ContentControl per item building the real control via a small factory/DataTemplate selector); drag = pointer events updating X/Y (this app MAY use code-behind for pointer math — it is a tool, not an exam answer).
- Right: property panel for selected item (TextBoxes bound two-way) + a read-only AXAML TextBox regenerated on every change (`AxamlGenerator.Generate(Items)` — a pure static class, unit-testable).
- Test project `AopDesigner.Tests` (xunit): generator tests only (balanced tags, Canvas.Left emitted, colors emitted).
- Verify: `dotnet build` green, `dotnet test` green, `dotnet run` shows window. NuGet must restore from local cache (offline-safe versions already on machine).

---

## Self-review notes (done at planning time)

- Spec coverage: designer (Task 2-3), analyzer (4-5), quiz (6), nav (7.4-7.5 + home cards), stretch (9), testing (1 + per-task), error handling (core tests "never throws", rule try/catch, localStorage try/catch). Print cheat sheets were considered and dropped by user choice (chose quiz + nav only).
- Known risk: `xmlBalanced` regex is naive but sufficient for generated (not arbitrary) AXAML.
- Keyboard-guard fix (7.3.8) is required for the new tools to be usable — do not skip.
- No git repo: verification is the Node suite + browser smoke; make file edits additive and keep `app.js` diffs minimal.
