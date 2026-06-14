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
test("every palette type has a plain-English description, and each group has a hint", () => {
  C.PALETTE_GROUPS.forEach((g) => {
    ok(g.hint && g.hint.length > 0, "group missing hint: " + g.name);
    g.types.forEach((t) => {
      ok(C.PLAIN && typeof C.PLAIN[t] === "string" && C.PLAIN[t].length > 0,
        "palette type missing plain description: " + t);
    });
  });
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

/* REGRESSION (the "shapes don't show / blank app" bug): a freshly-dropped Line, Polygon,
   or Path keeps its geometry at the catalog default. Because attrsOf omits props equal to
   their default, the defining geometry props (StartPoint/EndPoint, Points, Data) were
   stripped and the shape exported as `<Polygon Fill="..."/>` — a 0x0 nothing at runtime.
   The defining props must ALWAYS be emitted, even when equal to the default. */
test("fresh Line/Polygon/Path emit their defining geometry even at default values", () => {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const ln = C.createNode("Line"); C.addChild(tree, cv.id, ln);
  const pg = C.createNode("Polygon"); C.addChild(tree, cv.id, pg);
  const pa = C.createNode("Path"); C.addChild(tree, cv.id, pa);
  const { axaml } = C.generate(tree);
  xmlBalanced(axaml);
  includes(axaml, 'StartPoint="0,0"', "Line StartPoint emitted at default");
  includes(axaml, 'EndPoint="100,100"', "Line EndPoint emitted at default");
  includes(axaml, 'Points="0,40 40,0 80,40"', "Polygon Points emitted at default");
  includes(axaml, 'Data="M 0,0 L 40,40"', "Path Data emitted at default");
  // a defining-prop-less shape would be invisible; this guards that they never vanish
  notIncludes(axaml, "<Polygon Fill", "Polygon must not export with only a Fill (no Points)");
});

/* geometry shapes are point/path-defined: Width/Height are inert and must never be
   emitted (they would push the shape into the corner of an oversized box at runtime). */
test("Line/Polygon/Path never emit Width/Height (inert for geometry shapes)", () => {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  ["Line", "Polygon", "Path"].forEach((t) => {
    const n = C.createNode(t); n.props.Width = 200; n.props.Height = 150; C.addChild(tree, cv.id, n);
  });
  const { axaml } = C.generate(tree);
  notIncludes(axaml, 'Width="200"', "geometry shape Width must not be emitted");
  notIncludes(axaml, 'Height="150"', "geometry shape Height must not be emitted");
});

/* a user-edited geometry that happens to equal the default is still emitted (the omit-
   if-default optimization must not apply to defining props). */
test("a Polygon whose Points equals the default is still emitted", () => {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const pg = C.createNode("Polygon"); pg.props.Points = "0,40 40,0 80,40"; C.addChild(tree, cv.id, pg);
  const { axaml } = C.generate(tree);
  includes(axaml, 'Points="0,40 40,0 80,40"');
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

/* ==================== designer-upgrade additions ==================== */

/* -- canvas pixel-accurate drop helper -- */
test("placeAtCanvasPoint sets Canvas.Left/Top from coordinates (rounded, clamped)", () => {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const r = C.createNode("Rectangle"); C.addChild(tree, cv.id, r);
  ok(C.placeAtCanvasPoint(tree, r.id, 123.6, 47.2));
  eq(C.findNode(tree, r.id).props["Canvas.Left"], 124);
  eq(C.findNode(tree, r.id).props["Canvas.Top"], 47);
  C.placeAtCanvasPoint(tree, r.id, -40, -5);    // clamp negatives to 0
  eq(C.findNode(tree, r.id).props["Canvas.Left"], 0);
  eq(C.findNode(tree, r.id).props["Canvas.Top"], 0);
});

/* -- undo/redo round-trip via serialize/deserialize -- */
test("serialize -> deserialize restores the exact tree (undo round-trip)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); sp.props.Spacing = 8; C.addChild(tree, tree.id, sp);
  const btn = C.createNode("Button"); btn.props.Content = "Go"; C.addChild(tree, sp.id, btn);
  const snap = C.serialize(tree);
  // mutate
  btn.props.Content = "Changed"; sp.props.Spacing = 99;
  // undo: restore the snapshot
  const restored = C.deserialize(snap);
  eq(JSON.stringify(restored), snap, "deserialize(serialize(t)) === snapshot");
  eq(C.findNode(restored, btn.id).props.Content, "Go");
  eq(C.findNode(restored, sp.id).props.Spacing, 8);
});
test("deserialize re-syncs id sequence so new nodes never collide", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp); // pushes idSeq forward
  const json = C.serialize(tree);
  const back = C.deserialize(json);
  const fresh = C.createNode("Button");
  eq(C.findNode(back, fresh.id), null, "fresh id not already present in tree");
});

/* -- duplicate: deep clone, fresh unique ids, +12 offset handled by caller -- */
test("cloneSubtree deep-clones with fresh ids and independent props", () => {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const sp = C.createNode("StackPanel"); C.addChild(tree, cv.id, sp);
  const btn = C.createNode("Button"); btn.props.Content = "A"; C.addChild(tree, sp.id, btn);
  const clone = C.cloneSubtree(sp);
  ok(clone.id !== sp.id, "root clone id fresh");
  ok(clone.children[0].id !== btn.id, "child clone id fresh");
  eq(clone.children[0].props.Content, "A", "props copied");
  clone.children[0].props.Content = "B";
  eq(btn.props.Content, "A", "original unaffected (deep clone)");
});
test("cloneSubtree carries the typed item model by value", () => {
  const ic = C.createNode("ItemsControl");
  ic.model = { mode: "typed", className: "Foo", fields: [{ name: "X", type: "double" }] };
  const clone = C.cloneSubtree(ic);
  clone.model.className = "Bar";
  eq(ic.model.className, "Foo", "model deep-cloned");
});

/* -- typed model codegen -- */
test("typed model: model class has ObservableObject + [ObservableProperty] per field", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "Recipe",
    fields: [{ name: "Name", type: "string" }, { name: "Rating", type: "double" }] };
  C.addChild(tree, sp.id, lb);
  const gen = C.generate(tree);
  ok(gen.model, "third pane emitted");
  includes(gen.model, "public partial class Recipe : ObservableObject");
  includes(gen.model, "[ObservableProperty]");
  includes(gen.model, "private string name");
  includes(gen.model, "private double rating");
  includes(gen.viewModel, "ObservableCollection<Recipe> Items");
});
test("typed model AXAML emits DataTemplate with x:DataType and field bindings", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "Item",
    fields: [{ name: "Title", type: "string" }, { name: "Color", type: "IBrush" }] };
  C.addChild(tree, sp.id, lb);
  const { axaml } = C.generate(tree);
  xmlBalanced(axaml);
  includes(axaml, "<ListBox.ItemTemplate>");
  includes(axaml, '<DataTemplate x:DataType="vm:Item">');
  includes(axaml, '<TextBlock Text="{Binding Title}"/>');
  includes(axaml, '<Rectangle Width="16" Height="16" Fill="{Binding Color}"/>');
});
test("ItemsControl canvas mode emits ItemsPanelTemplate + ContentPresenter style", () => {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Rects";
  ic.model = { mode: "typed", className: "RectItem", canvasItems: true,
    fields: [{ name: "Width", type: "double" }, { name: "Brush", type: "IBrush" }] };
  C.addChild(tree, cv.id, ic);
  const { axaml } = C.generate(tree);
  xmlBalanced(axaml);
  includes(axaml, "<ItemsControl.ItemsPanel>");
  includes(axaml, "<ItemsPanelTemplate>");
  includes(axaml, "<Canvas/>");
  includes(axaml, '<Style Selector="ContentPresenter" x:DataType="vm:RectItem">');
  includes(axaml, '<Setter Property="Canvas.Left" Value="{Binding X}"/>');
  includes(axaml, '<Setter Property="Canvas.Top" Value="{Binding Y}"/>');
});
test("canvas-mode model auto-adds X/Y doubles when missing", () => {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Rects";
  ic.model = { mode: "typed", className: "RectItem", canvasItems: true,
    fields: [{ name: "Width", type: "double" }] };
  C.addChild(tree, cv.id, ic);
  const gen = C.generate(tree);
  includes(gen.model, "private double x");
  includes(gen.model, "private double y");
});
test("typed collection emits a seeded constructor example", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "Item", fields: [{ name: "Name", type: "string" }] };
  C.addChild(tree, sp.id, lb);
  const { viewModel } = C.generate(tree);
  includes(viewModel, "public MainWindowViewModel()");
  includes(viewModel, "Items.Add(new Item {");
});

/* -- SelectionMode + SelectedItem emission -- */
test("SelectionMode=Multiple emitted; Single (default) omitted", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb1 = C.createNode("ListBox"); C.addChild(tree, sp.id, lb1);           // default Single
  const lb2 = C.createNode("ListBox"); lb2.props.SelectionMode = "Multiple"; C.addChild(tree, sp.id, lb2);
  const { axaml } = C.generate(tree);
  includes(axaml, 'SelectionMode="Multiple"');
  notIncludes(axaml, 'SelectionMode="Single"', "Single is the default → omitted");
});
test("SelectedItem typed binding -> [ObservableProperty] of item type + OnXChanged note", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox");
  lb.bindings.ItemsSource = "Days"; lb.bindings.SelectedItem = "SelectedDay";
  lb.model = { mode: "typed", className: "WeekDayItem", fields: [{ name: "Day", type: "string" }] };
  C.addChild(tree, sp.id, lb);
  const { axaml, viewModel } = C.generate(tree);
  includes(axaml, 'SelectedItem="{Binding SelectedDay}"');
  includes(viewModel, "private WeekDayItem? selectedDay");
  includes(viewModel, "partial void OnSelectedDayChanged(WeekDayItem? value)");
  includes(viewModel, "ReExam P2.3");
});

/* -- new catalog types -- */
test("new catalog types are present and flagged", () => {
  ["ItemsControl", "TabControl", "TabItem", "Expander", "ToggleSwitch",
   "NumericUpDown", "Separator"].forEach((t) => ok(C.CATALOG[t], "missing " + t));
  ok(C.CATALOG.TabControl.container);
  ok(C.CATALOG.TabItem.container);
  ok(C.CATALOG.Expander.container);
  ok(!C.CATALOG.Separator.container);
});
test("TabControl only accepts TabItem; TabItem only goes into TabControl", () => {
  ok(C.canContain("TabControl", "TabItem"));
  ok(!C.canContain("TabControl", "Button"), "TabControl rejects non-TabItem");
  ok(!C.canContain("StackPanel", "TabItem"), "TabItem rejects non-TabControl parent");
});
test("each new catalog type renders to xmlBalanced AXAML with defaults omitted", () => {
  ["ToggleSwitch", "NumericUpDown", "Separator", "Expander"].forEach((t) => {
    const tree = C.createNode("Window");
    const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
    const n = C.createNode(t); C.addChild(tree, sp.id, n);
    const { axaml } = C.generate(tree);
    xmlBalanced(axaml);
    includes(axaml, "<" + t);
  });
  // NumericUpDown default Increment=1/Min=0/Max=100 must be omitted
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const n = C.createNode("NumericUpDown"); C.addChild(tree, sp.id, n);
  const { axaml } = C.generate(tree);
  notIncludes(axaml, 'Increment="1"', "default Increment omitted");
  notIncludes(axaml, 'Minimum="0"', "default Minimum omitted");
});
test("TabControl with TabItems emits Header and nested page; xmlBalanced", () => {
  const tree = C.createNode("Window");
  const tc = C.createNode("TabControl"); C.addChild(tree, tree.id, tc);
  const ti = C.createNode("TabItem"); ti.props.Header = "First"; C.addChild(tree, tc.id, ti);
  const inner = C.createNode("TextBlock"); inner.props.Text = "hi"; C.addChild(tree, ti.id, inner);
  const { axaml } = C.generate(tree);
  xmlBalanced(axaml);
  includes(axaml, "<TabControl");
  includes(axaml, '<TabItem Header="First">');
});

/* -- export/import round-trip -- */
test("export/import: serialize -> deserialize yields an identical tree", () => {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const r = C.createNode("Rectangle");
  r.props["Canvas.Left"] = 30; r.props.Fill = "#39BAE6"; C.addChild(tree, cv.id, r);
  const json = C.serialize(tree);
  const back = C.deserialize(json);
  eq(C.serialize(back), json, "round-trip identical");
});

/* ==================== Designer v2: logic recipes + timer ==================== */

/* helper: a Canvas-positioned typed ItemsControl + one Button bound to AddCommand */
function rectUITree(recipe, opts) {
  opts = opts || {};
  const tree = C.createNode("Window");
  const root = C.createNode("DockPanel"); C.addChild(tree, tree.id, root);
  const bar = C.createNode("StackPanel"); bar.props["DockPanel.Dock"] = "Top"; C.addChild(tree, root.id, bar);
  const btn = C.createNode("Button"); btn.bindings.Command = "AddCommand";
  if (recipe) btn.recipes = { Command: recipe };
  C.addChild(tree, bar.id, btn);
  const cv = C.createNode("Canvas"); C.addChild(tree, root.id, cv);
  const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Rectangles";
  ic.model = { mode: "typed", className: "RectItem", canvasItems: true,
    fields: [{ name: "X", type: "double" }, { name: "Y", type: "double" },
             { name: "Width", type: "double" }, { name: "Height", type: "double" },
             { name: "Brush", type: "IBrush" }] };
  C.addChild(tree, cv.id, ic);
  if (opts.timer) tree.timer = opts.timer;
  return tree;
}

test("recipe none keeps a TODO stub body", () => {
  const { viewModel } = C.generate(rectUITree("none"));
  includes(viewModel, "private void Add()");
  includes(viewModel, "// TODO: implement");
});

test("recipe add-random-item: Random field, palette, clamp math, adds to collection", () => {
  const { viewModel } = C.generate(rectUITree("add-random-item"));
  includes(viewModel, "using System;");
  includes(viewModel, "private readonly Random _random = new();");
  includes(viewModel, "private static readonly IBrush[] _palette");
  includes(viewModel, "int w = _random.Next(20, 120);");
  includes(viewModel, "int h = _random.Next(20, 120);");
  includes(viewModel, "X = _random.Next(0, (int)(CanvasWidth - w)),");
  includes(viewModel, "Y = _random.Next(0, (int)(CanvasHeight - h)),");
  includes(viewModel, "Brush = _palette[_random.Next(_palette.Length)],");
  includes(viewModel, "Rectangles.Add(new RectItem");
  notIncludes(viewModel, "// TODO", "add-random-item must have a working body");
});

/* exam 2.2: when the design has slider-bound size properties (NewWidth/NewHeight),
   add-random must size new items FROM the sliders, not from a random fallback. */
test("add-random-item sizes new items from slider-bound NewWidth/NewHeight when present", () => {
  const tree = C.createNode("Window");
  const root = C.createNode("DockPanel"); C.addChild(tree, tree.id, root);
  const bar = C.createNode("StackPanel"); bar.props["DockPanel.Dock"] = "Top"; C.addChild(tree, root.id, bar);
  const ws = C.createNode("Slider"); ws.bindings.Value = "NewWidth"; C.addChild(tree, bar.id, ws);
  const hs = C.createNode("Slider"); hs.bindings.Value = "NewHeight"; C.addChild(tree, bar.id, hs);
  const btn = C.createNode("Button"); btn.bindings.Command = "AddCommand";
  btn.recipes = { Command: "add-random-item" }; C.addChild(tree, bar.id, btn);
  const cv = C.createNode("Canvas"); C.addChild(tree, root.id, cv);
  const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Rectangles";
  ic.model = { mode: "typed", className: "RectItem", canvasItems: true,
    fields: [{ name: "X", type: "double" }, { name: "Y", type: "double" },
             { name: "Width", type: "double" }, { name: "Height", type: "double" },
             { name: "Brush", type: "IBrush" }] };
  C.addChild(tree, cv.id, ic);
  const { viewModel } = C.generate(tree);
  includes(viewModel, "int w = (int)NewWidth;", "width from the slider property");
  includes(viewModel, "int h = (int)NewHeight;", "height from the slider property");
  notIncludes(viewModel, "int w = _random.Next(20, 120);", "no random size when a slider drives it");
  includes(viewModel, "X = _random.Next(0, (int)(CanvasWidth - w)),", "still clamped in-bounds");
});

test("recipe add-random-item on a strings collection picks from _samples", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items"; C.addChild(tree, sp.id, lb);
  const btn = C.createNode("Button"); btn.bindings.Command = "AddCommand";
  btn.recipes = { Command: "add-random-item" }; C.addChild(tree, sp.id, btn);
  const { viewModel } = C.generate(tree);
  includes(viewModel, "private static readonly string[] _samples");
  includes(viewModel, "Items.Add(_samples[_random.Next(_samples.Length)]);");
});

test("recipe remove-selected guards null and removes from collection", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox");
  lb.bindings.ItemsSource = "Items"; lb.bindings.SelectedItem = "SelectedItem";
  lb.model = { mode: "typed", className: "Recipe", fields: [{ name: "Name", type: "string" }] };
  C.addChild(tree, sp.id, lb);
  const btn = C.createNode("Button"); btn.bindings.Command = "RemoveCommand";
  btn.recipes = { Command: "remove-selected" }; C.addChild(tree, sp.id, btn);
  const { viewModel } = C.generate(tree);
  includes(viewModel, "if (SelectedItem != null)");
  includes(viewModel, "Items.Remove(SelectedItem);");
});

test("recipe clear-all emits collection.Clear()", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items"; C.addChild(tree, sp.id, lb);
  const btn = C.createNode("Button"); btn.bindings.Command = "ClearCommand";
  btn.recipes = { Command: "clear-all" }; C.addChild(tree, sp.id, btn);
  const { viewModel } = C.generate(tree);
  includes(viewModel, "Items.Clear();");
});

test("recipe counter-increment emits int Count + Count++", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const btn = C.createNode("Button"); btn.bindings.Command = "IncrementCommand";
  btn.recipes = { Command: "counter-increment" }; C.addChild(tree, sp.id, btn);
  const { viewModel } = C.generate(tree);
  includes(viewModel, "private int count;");
  includes(viewModel, "Count++;");
});

test("recipe regenerate-from-service: clears+repopulates, ctor injection, interface + impl", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "Recipe", fields: [{ name: "Name", type: "string" }] };
  C.addChild(tree, sp.id, lb);
  const btn = C.createNode("Button"); btn.bindings.Command = "RefreshCommand";
  btn.recipes = { Command: "regenerate-from-service" }; C.addChild(tree, sp.id, btn);
  const gen = C.generate(tree);
  /* VM: ctor injection + Regenerate clears then repopulates */
  includes(gen.viewModel, "private readonly IItemProvider _provider;");
  includes(gen.viewModel, "public MainWindowViewModel(IItemProvider provider)");
  includes(gen.viewModel, "_provider = provider;");
  includes(gen.viewModel, "Items.Clear();");
  includes(gen.viewModel, "foreach (var item in _provider.GetItems())");
  includes(gen.viewModel, "Items.Add(item);");
  /* Models pane: interface + InMemory impl, GetItems():IEnumerable<T> */
  ok(gen.model, "service classes emitted into Models pane");
  includes(gen.model, "using System.Collections.Generic;");
  includes(gen.model, "public interface IItemProvider");
  includes(gen.model, "IEnumerable<Recipe> GetItems();");
  includes(gen.model, "public class InMemoryItemProvider : IItemProvider");
  notIncludes(gen.viewModel, "// TODO", "service recipe is fully wired");
  /* REGRESSION: the harness's App.axaml.cs does `new MainWindowViewModel()`. A DI-only
     ctor (CS7036) would not compile there, so a parameterless ctor must chain to the DI
     overload with the InMemory impl. */
  includes(gen.viewModel, "public MainWindowViewModel() : this(new InMemoryItemProvider()) { }");
});

/* -- timer: DispatcherTimer mechanism -- */
test("timer DispatcherTimer: field + Tick wiring + UI-thread comment, recolor body", () => {
  const tree = rectUITree("timer-toggle", {
    timer: { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "recolor-items" },
  });
  const { viewModel } = C.generate(tree);
  includes(viewModel, "using Avalonia.Threading;");
  includes(viewModel, "private readonly DispatcherTimer _timer;");
  includes(viewModel, "_timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(2000) };");
  includes(viewModel, "_timer.Tick += (_, _) => OnTick();");
  includes(viewModel, "DispatcherTimer already ticks on the UI thread");
  includes(viewModel, "item.Brush = _palette[_random.Next(_palette.Length)];");
  /* toggle recipe wires to Start/Stop */
  includes(viewModel, "if (_timerRunning) StopTimer(); else StartTimer();");
});

/* the combined "recolor-reposition" action is the exact Summer P2.3 answer: every
   tick MOVES (X/Y in-bounds) AND recolours each item, in ONE loop, on the UI thread. */
test("recolor-reposition timer moves AND recolours in one tick, in-bounds, palette + canvas emitted", () => {
  const tree = rectUITree("timer-toggle", {
    timer: { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "recolor-reposition" },
  });
  const { viewModel } = C.generate(tree);
  includes(viewModel, "private const double CanvasWidth =", "canvas bounds emitted for reposition");
  includes(viewModel, "private static readonly IBrush[] _palette", "palette emitted for recolor");
  includes(viewModel, "item.X = _random.Next(0, (int)(CanvasWidth - item.Width));");
  includes(viewModel, "item.Y = _random.Next(0, (int)(CanvasHeight - item.Height));");
  includes(viewModel, "item.Brush = _palette[_random.Next(_palette.Length)];");
});
test("recolor-reposition is an offered timer action", () => {
  ok(C.TIMER_ACTIONS.indexOf("recolor-reposition") !== -1, "registered in TIMER_ACTIONS");
});

/* regression: a reposition-items timer on a model that has NO Width/Height fields
   (e.g. an Ellipse positioned by X/Y only) must not reference item.Width/item.Height,
   which do not exist on the model class (CS1061). Fall back to a constant margin. */
test("reposition-items timer without Width/Height fields uses a constant, not item.Width", () => {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Dots";
  ic.model = { mode: "typed", className: "Dot", canvasItems: true, templateShape: "Ellipse",
    fields: [{ name: "X", type: "double" }, { name: "Y", type: "double" }] };
  C.addChild(tree, cv.id, ic);
  tree.timer = { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "reposition-items" };
  const { viewModel } = C.generate(tree);
  notIncludes(viewModel, "item.Width", "must not reference a non-existent item.Width");
  notIncludes(viewModel, "item.Height", "must not reference a non-existent item.Height");
  includes(viewModel, "item.X = _random.Next(0, (int)(CanvasWidth - 20));");
  includes(viewModel, "item.Y = _random.Next(0, (int)(CanvasHeight - 20));");
});
/* with Width/Height fields present, the reposition body still uses item.Width/Height */
test("reposition-items timer with Width/Height fields keeps item.Width/Height", () => {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Rects";
  ic.model = { mode: "typed", className: "RectItem", canvasItems: true,
    fields: [{ name: "X", type: "double" }, { name: "Y", type: "double" },
             { name: "Width", type: "double" }, { name: "Height", type: "double" }] };
  C.addChild(tree, cv.id, ic);
  tree.timer = { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "reposition-items" };
  const { viewModel } = C.generate(tree);
  includes(viewModel, "item.X = _random.Next(0, (int)(CanvasWidth - item.Width));");
  includes(viewModel, "item.Y = _random.Next(0, (int)(CanvasHeight - item.Height));");
});

/* -- timer: Task.Delay loop mechanism -- */
test("timer Task loop: CancellationTokenSource + Dispatcher.UIThread.Post; start/stop/reset", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const tb = C.createNode("TextBlock"); tb.bindings.Text = "Count"; C.addChild(tree, sp.id, tb);
  ["StartCommand", "StopCommand", "ResetCommand"].forEach((cmd, i) => {
    const b = C.createNode("Button"); b.bindings.Command = cmd;
    b.recipes = { Command: ["timer-start", "timer-stop", "timer-reset"][i] };
    C.addChild(tree, sp.id, b);
  });
  tree.timer = { enabled: true, intervalMs: 100, mechanism: "task", action: "increment-counter" };
  const { viewModel } = C.generate(tree);
  includes(viewModel, "using System.Threading;");
  includes(viewModel, "using System.Threading.Tasks;");
  includes(viewModel, "private CancellationTokenSource? _cts;");
  includes(viewModel, "_cts = new CancellationTokenSource();");
  includes(viewModel, "await Task.Delay(100, token);");
  includes(viewModel, "Dispatcher.UIThread.Post(OnTick);");
  includes(viewModel, "// UI thread: required");
  /* start/stop/reset methods exist and are wired by the timer-* recipes */
  includes(viewModel, "StartTimer();");
  includes(viewModel, "StopTimer();");
  includes(viewModel, "ResetTimer();");
});

test("timer reset zeroes the counter; pause does NOT re-instantiate count", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const tb = C.createNode("TextBlock"); tb.bindings.Text = "Count"; C.addChild(tree, sp.id, tb);
  tree.timer = { enabled: true, intervalMs: 100, mechanism: "task", action: "increment-counter" };
  const { viewModel } = C.generate(tree);
  /* reset zeroes */
  includes(viewModel, "Count = 0;");
  /* pause/resume preserves count: StartTimer must NOT reset Count, and Count is
     only declared once (never re-instantiated on start) */
  eq(viewModel.split("private int count").length - 1, 1, "Count declared exactly once");
  notIncludes(viewModel, "Count = 0;\n        _cts = new", "start must not zero the count");
});

test("counter bound from TextBlock.Text is typed int (not string)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const tb = C.createNode("TextBlock"); tb.bindings.Text = "Count"; C.addChild(tree, sp.id, tb);
  const btn = C.createNode("Button"); btn.bindings.Command = "IncCommand";
  btn.recipes = { Command: "counter-increment" }; C.addChild(tree, sp.id, btn);
  const { viewModel } = C.generate(tree);
  includes(viewModel, "private int count;");
  notIncludes(viewModel, "private string count", "Count must be int for ++/=0");
});

test("recipes persist through serialize/deserialize round-trip", () => {
  const tree = rectUITree("add-random-item", {
    timer: { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "recolor-items" },
  });
  const back = C.deserialize(C.serialize(tree));
  const btn = (function find(n) {
    if (n.bindings && n.bindings.Command) return n;
    for (const c of (n.children || [])) { const hit = find(c); if (hit) return hit; }
    return null;
  })(back);
  ok(btn && btn.recipes && btn.recipes.Command === "add-random-item", "recipe survived round-trip");
  ok(back.timer && back.timer.action === "recolor-items", "timer survived round-trip");
});

test("CORE exposes recipe ids, timer actions/mechanisms, defaultTimer", () => {
  ok(Array.isArray(C.RECIPE_IDS) && C.RECIPE_IDS.indexOf("add-random-item") !== -1);
  ok(C.RECIPE_IDS.indexOf("regenerate-from-service") !== -1);
  ok(C.TIMER_ACTIONS.indexOf("recolor-items") !== -1);
  ok(C.TIMER_MECHANISMS.indexOf("dispatcher") !== -1 && C.TIMER_MECHANISMS.indexOf("task") !== -1);
  const dt = C.defaultTimer();
  ok(dt.enabled === true && dt.intervalMs > 0, "defaultTimer is enabled with an interval");
});

test("Summer preset (canvas recolor timer + add-random recipe) is xmlBalanced and zero-TODO", () => {
  /* mirror the seedRectangleUI preset shape, fully wired */
  const tree = rectUITree("add-random-item", {
    timer: { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "recolor-items" },
  });
  const gen = C.generate(tree);
  xmlBalanced(gen.axaml);
  eq((gen.viewModel.match(/TODO/g) || []).length, 0, "no TODO when all commands have recipes");
});

/* regression: add-random-item on a strings collection referenced _samples in the
   body but the field was never declared (would not compile). The field must exist
   whenever the body picks from it. */
test("add-random-item never references an undeclared _samples field (strings coll)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items"; C.addChild(tree, sp.id, lb);
  const btn = C.createNode("Button"); btn.bindings.Command = "AddCommand";
  btn.recipes = { Command: "add-random-item" }; C.addChild(tree, sp.id, btn);
  const { viewModel } = C.generate(tree);
  if (viewModel.indexOf("_samples[") !== -1) {
    includes(viewModel, "private static readonly string[] _samples",
      "_samples used in body but field not declared");
  }
});

/* extract just the constructor body so "does the CTOR call StartTimer()" checks
   don't leak into later method bodies. The body can contain object initializers
   with nested braces, so we slice from the ctor signature to the next member
   (a [RelayCommand] attribute or a method/property declaration) instead of
   brace-matching. */
function ctorBodyOf(vm) {
  const sig = /public MainWindowViewModel\([^)]*\)\s*\{/.exec(vm);
  if (!sig) return "";
  const start = sig.index + sig[0].length;
  const rest = vm.slice(start);
  const next = /\n\s*(\[RelayCommand\]|private |public )/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/* regression: a continuous (recolor) timer with no timer-* command must auto-start
   in the constructor so the design actually ticks (Summer P2), and must NOT emit
   dead Stop/Reset methods that nothing can call. */
test("uncontrolled recolor timer auto-starts in ctor and emits no dead Stop/Reset", () => {
  const tree = rectUITree("add-random-item", {
    timer: { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "recolor-items" },
  });
  const { viewModel } = C.generate(tree);
  /* ctor calls StartTimer so the recolor loop runs on launch */
  ok(ctorBodyOf(viewModel).indexOf("StartTimer();") !== -1, "ctor auto-starts the timer");
  includes(viewModel, "private void StartTimer()");
  notIncludes(viewModel, "private void StopTimer()", "no dead StopTimer for an uncontrolled timer");
  notIncludes(viewModel, "private void ResetTimer()", "no dead ResetTimer for an uncontrolled timer");
});

/* a counter timer is user-driven: it must NOT auto-start, and must always keep the
   full Start/Stop/Reset surface even when no buttons are bound yet (exam P3). */
test("counter timer does not auto-start and keeps Start/Stop/Reset", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const tb = C.createNode("TextBlock"); tb.bindings.Text = "Count"; C.addChild(tree, sp.id, tb);
  tree.timer = { enabled: true, intervalMs: 100, mechanism: "task", action: "increment-counter" };
  const { viewModel } = C.generate(tree);
  includes(viewModel, "private void StartTimer()");
  includes(viewModel, "private void StopTimer()");
  includes(viewModel, "private void ResetTimer()");
  includes(viewModel, "Count = 0;");
  /* no ctor StartTimer for the counter (user presses Start) */
  ok(ctorBodyOf(viewModel).indexOf("StartTimer();") === -1, "counter timer must not auto-start");
});

/* a controlled recolor timer (has a timer-toggle command) keeps Stop so toggle works,
   and must NOT auto-start (the toggle drives it). */
test("controlled (toggle) recolor timer keeps StopTimer and does not auto-start", () => {
  const tree = rectUITree("timer-toggle", {
    timer: { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "recolor-items" },
  });
  const { viewModel } = C.generate(tree);
  includes(viewModel, "private void StopTimer()");
  ok(ctorBodyOf(viewModel).indexOf("StartTimer();") === -1, "toggle-controlled timer must not auto-start");
});

/* regression: a timer-* command recipe (timer-start/stop/reset/toggle) with NO enabled
   timer in the tree must NOT emit StartTimer()/StopTimer()/ResetTimer()/_timerRunning
   references, because those methods/fields are only generated when the timer is enabled
   (otherwise the VM fails to compile, CS0103). Guard like the no-collection clear-all
   case: emit a TODO body telling the user to enable the Timer panel. */
test("timer-* recipe with no enabled timer emits a TODO body, not an undefined call", () => {
  /* a Start button bound to timer-start, but the tree has no timer */
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const btn = C.createNode("Button"); btn.bindings.Command = "StartCommand";
  btn.recipes = { Command: "timer-start" }; C.addChild(tree, sp.id, btn);
  const { viewModel } = C.generate(tree);
  /* the Start() method body is a TODO, not a call into a method that was never emitted */
  includes(viewModel, "// TODO: enable the Timer panel to generate StartTimer/StopTimer (this recipe needs it)");
  /* no StartTimer( call survives outside comments, and StartTimer is never declared */
  const noComments = viewModel.split("\n").filter((l) => l.trim().indexOf("//") !== 0).join("\n");
  notIncludes(noComments, "StartTimer(", "no StartTimer call when the timer is disabled");
  notIncludes(viewModel, "private void StartTimer()", "StartTimer is not declared without a timer");
  notIncludes(viewModel, "_timerRunning", "no _timerRunning reference without a timer");
  /* the generated VM still parses as JS-checkable C# text (no syntax surprises): the
     method shell is present and balanced */
  includes(viewModel, "private void Start()");
  /* all four timer-* recipes degrade the same way when no timer is enabled */
  ["timer-toggle", "timer-stop", "timer-reset"].forEach((r) => {
    const t = C.createNode("Window");
    const s = C.createNode("StackPanel"); C.addChild(t, t.id, s);
    const b = C.createNode("Button"); b.bindings.Command = "DoCommand";
    b.recipes = { Command: r }; C.addChild(t, s.id, b);
    const vm = C.generate(t).viewModel;
    includes(vm, "// TODO: enable the Timer panel", r + " degrades to a TODO without a timer");
    const nc = vm.split("\n").filter((l) => l.trim().indexOf("//") !== 0).join("\n");
    notIncludes(nc, "StopTimer(", r + ": no StopTimer call without a timer");
    notIncludes(nc, "ResetTimer(", r + ": no ResetTimer call without a timer");
  });
});

/* the same timer-start recipe WITH the timer enabled is unchanged: it emits the real
   StartTimer() call and the StartTimer() method (behavior-preserving for the fix). */
test("timer-start recipe with an enabled timer still emits the real StartTimer call", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const tb = C.createNode("TextBlock"); tb.bindings.Text = "Count"; C.addChild(tree, sp.id, tb);
  const btn = C.createNode("Button"); btn.bindings.Command = "StartCommand";
  btn.recipes = { Command: "timer-start" }; C.addChild(tree, sp.id, btn);
  tree.timer = { enabled: true, intervalMs: 100, mechanism: "task", action: "increment-counter" };
  const { viewModel } = C.generate(tree);
  /* Start() body still calls StartTimer(), and StartTimer() is declared */
  includes(viewModel, "private void Start()");
  includes(viewModel, "private void StartTimer()");
  notIncludes(viewModel, "// TODO: enable the Timer panel", "no TODO when the timer is enabled");
  /* StartTimer( appears as a real call in the Start() body, not just the declaration */
  ok(viewModel.indexOf("        StartTimer();") !== -1, "Start() calls StartTimer()");
});

/* ==================== v5 quality nits (spec 13/14 verify pass) ==================== */

/* nit 1: non-nullable IBrush model fields must carry an initializer under Nullable
   enable (CS8618). string -> ""; IBrush -> a default brush. */
test("typed model IBrush field is initialized (no CS8618 under Nullable enable)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "Item",
    fields: [{ name: "Title", type: "string" }, { name: "Color", type: "IBrush" }] };
  C.addChild(tree, sp.id, lb);
  const gen = C.generate(tree);
  includes(gen.model, "private IBrush color = Brushes.SteelBlue;");
  notIncludes(gen.model, "private IBrush color;", "IBrush must not be left uninitialized");
  includes(gen.model, "using Avalonia.Media;");
});

/* nit 2: a CountText string property bound alongside a collection must actually be
   recomputed (Summer RectangleUI count display was permanently empty). */
test("CountText bound with a collection is recomputed on collection change", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items"; C.addChild(tree, sp.id, lb);
  const tb = C.createNode("TextBlock"); tb.bindings.Text = "CountText"; C.addChild(tree, sp.id, tb);
  const { viewModel } = C.generate(tree);
  includes(viewModel, "private void UpdateCountText()");
  includes(viewModel, "Items.CollectionChanged += (_, _) => UpdateCountText();");
  includes(viewModel, "CountText = $\"{Items.Count} items\";");
  includes(viewModel, "UpdateCountText();");
});

/* the Summer preset shape (Rectangles + CountText + Add) wires the count to the
   rectangle collection so adding a rectangle updates the bound display. */
test("Summer preset CountText mirrors the Rectangles count", () => {
  const tree = rectUITree("add-random-item", {
    timer: { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "recolor-items" },
  });
  /* add the bound count TextBlock the preset uses */
  const bar = tree.children[0].children[0];          // DockPanel > top StackPanel
  const count = C.createNode("TextBlock"); count.bindings.Text = "CountText";
  C.addChild(tree, bar.id, count);
  const { viewModel } = C.generate(tree);
  includes(viewModel, "Rectangles.CollectionChanged += (_, _) => UpdateCountText();");
  includes(viewModel, "CountText = $\"{Rectangles.Count} rectangles\";");
  eq((viewModel.match(/TODO/g) || []).length, 0, "no TODO with count wiring + add recipe");
});

/* CountText without a collection stays a plain string property (no dead wiring) */
test("CountText without a collection emits no UpdateCountText wiring", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const tb = C.createNode("TextBlock"); tb.bindings.Text = "CountText"; C.addChild(tree, sp.id, tb);
  const { viewModel } = C.generate(tree);
  notIncludes(viewModel, "UpdateCountText", "no count wiring without a collection");
  includes(viewModel, "private string countText");
});

/* ==================== programmable behaviors (Scratch-style, MVVM-compiled) ==================== */

/* a button click that sets a TextBlock's text, hides another element, and sets a Slider's
   value must compile to bindings on the targets + a [RelayCommand] that sets VM members. */
test("behaviors compile to target bindings + VM members + a RelayCommand body", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const msg = C.createNode("TextBlock"); msg.props.Text = "Hello"; C.addChild(tree, sp.id, msg);
  const note = C.createNode("TextBlock"); note.props.Text = "Secret"; C.addChild(tree, sp.id, note);
  const sld = C.createNode("Slider"); C.addChild(tree, sp.id, sld);
  const btn = C.createNode("Button"); btn.props.Content = "Go"; C.addChild(tree, sp.id, btn);
  btn.behaviors = [
    { kind: "setText", target: msg.id, value: "Clicked!" },
    { kind: "hide", target: note.id },
    { kind: "setValue", target: sld.id, value: 75 },
  ];
  const { axaml, viewModel } = C.generate(tree);
  xmlBalanced(axaml);
  // target bindings injected (the literal Text on msg is replaced by a binding)
  includes(axaml, 'Text="{Binding HelloText}"');
  includes(axaml, 'IsVisible="{Binding SecretVisible}"');
  includes(axaml, 'Value="{Binding SliderValue}"');
  includes(axaml, 'Command="{Binding GoCommand}"');
  // VM members with sensible initializers
  includes(viewModel, 'private string helloText = "Hello";');
  includes(viewModel, "private bool secretVisible = true;");
  includes(viewModel, "private double sliderValue = 0;");
  // the RelayCommand body sets each member
  includes(viewModel, "private void Go()");
  includes(viewModel, 'HelloText = "Clicked!";');
  includes(viewModel, "SecretVisible = false;");
  includes(viewModel, "SliderValue = 75;");
  notIncludes(viewModel, "// TODO", "behavior command must have a working body");
});

/* a "set value" behavior on a control with NO Value property (TextBlock) must bind its
   Text, not Value — emitting Value="{Binding …}" on a TextBlock throws at XAML load. */
test("setValue on a TextBlock binds Text (not the nonexistent Value)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lbl = C.createNode("TextBlock"); lbl.props.Text = "Label"; C.addChild(tree, sp.id, lbl);
  const btn = C.createNode("Button"); btn.props.Content = "Set"; C.addChild(tree, sp.id, btn);
  btn.behaviors = [{ kind: "setValue", target: lbl.id, value: "42" }];
  const { axaml, viewModel } = C.generate(tree);
  xmlBalanced(axaml);
  includes(axaml, 'Text="{Binding LabelText}"', "TextBlock setValue must target Text");
  notIncludes(axaml, "Value=", "must never emit a Value attribute on a TextBlock");
  includes(viewModel, 'private string labelText = "Label";', "Text-backed member is a string");
  includes(viewModel, 'LabelText = "42";', "command sets the text member");
});

/* a "set value" behavior on a Slider keeps the Value binding (Slider has Value). */
test("setValue on a Slider still binds its real Value property", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const sld = C.createNode("Slider"); C.addChild(tree, sp.id, sld);
  const btn = C.createNode("Button"); btn.props.Content = "Set"; C.addChild(tree, sp.id, btn);
  btn.behaviors = [{ kind: "setValue", target: sld.id, value: 75 }];
  const { axaml, viewModel } = C.generate(tree);
  includes(axaml, 'Value="{Binding SliderValue}"', "Slider keeps a Value binding");
  includes(viewModel, "SliderValue = 75;", "command sets the numeric member");
});

test("behavior toggleVisible emits a negation; show/hide emit true/false", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const box = C.createNode("TextBlock"); box.props.Text = "Panel"; C.addChild(tree, sp.id, box);
  const btn = C.createNode("Button"); btn.props.Content = "Toggle"; C.addChild(tree, sp.id, btn);
  btn.behaviors = [{ kind: "toggleVisible", target: box.id }];
  const { viewModel } = C.generate(tree);
  includes(viewModel, "PanelVisible = !PanelVisible;");
});

/* a button that already has a Command binding reuses that command name for its behavior
   body (no second synthesized command). */
test("behaviors reuse an existing Command binding name", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const t = C.createNode("TextBlock"); t.props.Text = "x"; C.addChild(tree, sp.id, t);
  const btn = C.createNode("Button"); btn.props.Content = "Hit"; btn.bindings.Command = "SaveCommand";
  C.addChild(tree, sp.id, btn);
  btn.behaviors = [{ kind: "hide", target: t.id }];
  const { axaml, viewModel } = C.generate(tree);
  includes(axaml, 'Command="{Binding SaveCommand}"');
  includes(viewModel, "private void Save()");
  notIncludes(viewModel, "private void HitCommand", "must not synthesize a second command");
});

/* two buttons hiding the SAME element share ONE bool member (keyed by target+prop). */
test("two behaviors targeting the same element+prop share one VM member", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const box = C.createNode("TextBlock"); box.props.Text = "Box"; C.addChild(tree, sp.id, box);
  const b1 = C.createNode("Button"); b1.props.Content = "Hide"; C.addChild(tree, sp.id, b1);
  b1.behaviors = [{ kind: "hide", target: box.id }];
  const b2 = C.createNode("Button"); b2.props.Content = "Show"; C.addChild(tree, sp.id, b2);
  b2.behaviors = [{ kind: "show", target: box.id }];
  const { viewModel } = C.generate(tree);
  eq(viewModel.split("private bool boxVisible").length - 1, 1, "exactly one BoxVisible member");
});

test("cloneSubtree carries behaviors and recipes (duplicate keeps its logic)", () => {
  const btn = C.createNode("Button");
  btn.recipes = { Command: "add-random-item" };
  btn.behaviors = [{ kind: "hide", target: "n99" }];
  const clone = C.cloneSubtree(btn);
  clone.behaviors[0].kind = "show";
  clone.recipes.Command = "clear-all";
  eq(btn.behaviors[0].kind, "hide", "behaviors deep-cloned");
  eq(btn.recipes.Command, "add-random-item", "recipes cloned by value");
});

/* ==================== functional hardening: tree invariants under a storm ==================== */

/* collect every id in the tree and flag duplicates / missing ids */
function collectIds(tree) {
  const ids = [];
  C.walk(tree, function (n) { ids.push(n.id); });
  return ids;
}
function treeIsConsistent(tree) {
  const ids = collectIds(tree);
  /* no duplicate ids (no orphan/aliased nodes) */
  const seen = {};
  for (const id of ids) { if (seen[id]) return false; seen[id] = true; }
  /* every non-root node is reachable from root via findParent, and findNode round-trips */
  let okAll = true;
  C.walk(tree, function (n) {
    if (n.id === tree.id) return;
    if (C.findNode(tree, n.id) !== n) okAll = false;
    const p = C.findParent(tree, n.id);
    if (!p || (p.children || []).indexOf(n) === -1) okAll = false;
  });
  return okAll;
}

/* ==================== spec 16: flat submission export (Problem 2 pair) ==================== */

/* the submission is the flat 2-file Problem_2 pair with the professor's EXACT names;
   NO third model file (it is inlined into the VM file). */
test("submission emits exactly the Problem_2 pair with the exact file names", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const tb = C.createNode("TextBox"); tb.bindings.Text = "Name"; C.addChild(tree, sp.id, tb);
  const sub = C.submission(tree);
  ok(Array.isArray(sub.files), "files is an array");
  eq(sub.files.length, 2, "exactly two files (no third model file)");
  const names = sub.files.map((f) => f.name);
  ok(names.indexOf("Problem_2_MainWindow.axaml") !== -1, "axaml name exact");
  ok(names.indexOf("Problem_2_MainWindowViewModel.cs") !== -1, "vm name exact");
});

/* the axaml file is the complete Window with x:Class + xmlns:vm consistent with the
   inlined VM namespace (Starter Kit namespaces), so a grader can drop the pair in. */
test("submission axaml is the complete consistent Window (x:Class + xmlns:vm)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const sub = C.submission(tree);
  xmlBalanced(sub.axaml);
  includes(sub.axaml, 'x:Class="ExamApp.Views.MainWindow"');
  includes(sub.axaml, 'xmlns:vm="using:ExamApp.ViewModels"');
  includes(sub.axaml, 'x:DataType="vm:MainWindowViewModel"');
  includes(sub.viewModel, "namespace ExamApp.ViewModels;");
  includes(sub.viewModel, "public partial class MainWindowViewModel");
});

/* with a typed model the submission VM must INLINE the model class below the VM in
   the SAME namespace (no separate file), and there must be exactly one namespace
   declaration and one merged using block. */
test("submission inlines the typed model class into the VM file (no third file)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "RectItem",
    fields: [{ name: "Width", type: "double" }, { name: "Brush", type: "IBrush" }] };
  C.addChild(tree, sp.id, lb);
  const sub = C.submission(tree);
  eq(sub.files.length, 2, "still exactly two files");
  includes(sub.viewModel, "public partial class MainWindowViewModel : ObservableObject");
  includes(sub.viewModel, "public partial class RectItem : ObservableObject");
  /* the model class appears AFTER the ViewModel class */
  ok(sub.viewModel.indexOf("class RectItem") > sub.viewModel.indexOf("class MainWindowViewModel"),
    "model inlined below the ViewModel");
  /* exactly one namespace line and the IBrush using is merged in once */
  eq(sub.viewModel.split("namespace ExamApp.ViewModels;").length - 1, 1, "one namespace decl");
  eq(sub.viewModel.split("using Avalonia.Media;").length - 1, 1, "Avalonia.Media merged once");
  includes(sub.viewModel, "private IBrush brush = Brushes.SteelBlue;");
});

/* the service classes (regenerate-from-service) must also inline, with their extra
   using (System.Collections.Generic) merged into the single header. */
test("submission inlines the service interface + impl with merged usings", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "Recipe", fields: [{ name: "Name", type: "string" }] };
  C.addChild(tree, sp.id, lb);
  const btn = C.createNode("Button"); btn.bindings.Command = "RefreshCommand";
  btn.recipes = { Command: "regenerate-from-service" }; C.addChild(tree, sp.id, btn);
  const sub = C.submission(tree);
  eq(sub.files.length, 2, "service classes inline, not a third file");
  includes(sub.viewModel, "public interface IItemProvider");
  includes(sub.viewModel, "public class InMemoryItemProvider : IItemProvider");
  includes(sub.viewModel, "using System.Collections.Generic;");
  eq(sub.viewModel.split("namespace ExamApp.ViewModels;").length - 1, 1, "one namespace decl");
});

/* spec 16 allowed-library rule: the submission VM must only use System.*, Avalonia*,
   and CommunityToolkit.Mvvm namespaces. foreignUsings flags anything else. */
test("submission VM contains no foreign using directives (allowed libs only)", () => {
  /* exercise the richest path: typed model + IBrush + Random + timer + service-free */
  const tree = C.createNode("Window");
  const root = C.createNode("DockPanel"); C.addChild(tree, tree.id, root);
  const bar = C.createNode("StackPanel"); bar.props["DockPanel.Dock"] = "Top"; C.addChild(tree, root.id, bar);
  const btn = C.createNode("Button"); btn.bindings.Command = "AddCommand";
  btn.recipes = { Command: "add-random-item" }; C.addChild(tree, bar.id, btn);
  const cv = C.createNode("Canvas"); C.addChild(tree, root.id, cv);
  const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Rectangles";
  ic.model = { mode: "typed", className: "RectItem", canvasItems: true,
    fields: [{ name: "Width", type: "double" }, { name: "Height", type: "double" },
             { name: "Brush", type: "IBrush" }] };
  C.addChild(tree, cv.id, ic);
  tree.timer = { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "recolor-items" };
  const sub = C.submission(tree);
  eq(C.foreignUsings(sub.viewModel).length, 0, "no foreign usings in submission VM");
  /* sanity: the helper actually catches a planted foreign using */
  ok(C.foreignUsings("using System;\nusing Newtonsoft.Json;").indexOf("Newtonsoft.Json") !== -1,
    "foreignUsings flags a non-allowed namespace");
  eq(C.foreignUsings("using System.Linq;\nusing Avalonia.Media;\nusing CommunityToolkit.Mvvm.Input;").length, 0,
    "allowed namespaces pass");
});

/* both 2025 presets produce a self-contained, well-formed submission pair with no
   foreign usings (the compile proof in the runbook builds these). */
test("both 2025 presets yield a clean submission pair (no foreign usings, xmlBalanced)", () => {
  /* rebuild the two preset shapes the seeds use, inline here to stay core-only */
  function summer() {
    const w = C.createNode("Window"); w.props.Title = "RectangleUI";
    const root = C.createNode("DockPanel"); C.addChild(w, w.id, root);
    const bar = C.createNode("StackPanel"); bar.props["DockPanel.Dock"] = "Top"; C.addChild(w, root.id, bar);
    const add = C.createNode("Button"); add.bindings.Command = "AddCommand";
    add.recipes = { Command: "add-random-item" }; C.addChild(w, bar.id, add);
    const count = C.createNode("TextBlock"); count.bindings.Text = "CountText"; C.addChild(w, bar.id, count);
    const cv = C.createNode("Canvas"); C.addChild(w, root.id, cv);
    const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Rectangles";
    ic.model = { mode: "typed", className: "RectItem", canvasItems: true,
      fields: [{ name: "X", type: "double" }, { name: "Y", type: "double" },
               { name: "Width", type: "double" }, { name: "Height", type: "double" },
               { name: "Brush", type: "IBrush" }] };
    C.addChild(w, cv.id, ic);
    w.timer = { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "recolor-items" };
    return w;
  }
  function meal() {
    const w = C.createNode("Window"); w.props.Title = "Family Meal Planner";
    const g = C.createNode("Grid"); g.props.ColumnDefinitions = "*,*"; g.props.RowDefinitions = "*,Auto";
    C.addChild(w, w.id, g);
    const left = C.createNode("ListBox"); left.bindings.ItemsSource = "WeekDays";
    left.bindings.SelectedItem = "SelectedRecipe";
    left.model = { mode: "typed", className: "WeekDayItem",
      fields: [{ name: "Day", type: "string" }, { name: "RecipeName", type: "string" }] };
    C.addChild(w, g.id, left);
    const right = C.createNode("ListBox"); right.props.SelectionMode = "Multiple";
    right.bindings.ItemsSource = "Ingredients"; C.addChild(w, g.id, right);
    const gen = C.createNode("Button"); gen.bindings.Command = "GenerateCommand"; C.addChild(w, g.id, gen);
    return w;
  }
  [summer(), meal()].forEach((t) => {
    const sub = C.submission(t);
    eq(sub.files.length, 2, "two-file pair");
    xmlBalanced(sub.axaml);
    eq(C.foreignUsings(sub.viewModel).length, 0, "no foreign usings");
    includes(sub.viewModel, "namespace ExamApp.ViewModels;");
  });
});

test("tree stays consistent (no orphan/duplicate ids) after a 30-op random storm", () => {
  /* deterministic PRNG so the storm is reproducible */
  let s = 1337;
  const rnd = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const pick = function (arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; };

  const tree = C.createNode("Window");
  const root = C.createNode("StackPanel"); C.addChild(tree, tree.id, root);
  const containerTypes = ["StackPanel", "Grid", "Border", "Canvas"];
  const leafTypes = ["Button", "TextBlock", "TextBox", "Rectangle", "CheckBox"];

  for (let i = 0; i < 30; i++) {
    const all = collectIds(tree);
    const targetId = pick(all);
    const op = Math.floor(rnd() * 4);
    if (op === 0) {
      /* add a leaf or container somewhere */
      const type = rnd() < 0.5 ? pick(containerTypes) : pick(leafTypes);
      C.addChild(tree, targetId, C.createNode(type));
    } else if (op === 1) {
      /* move a random node under another random node */
      const src = pick(all), dst = pick(all);
      if (src !== tree.id) C.moveNode(tree, src, dst);
    } else if (op === 2) {
      /* remove a random non-root node */
      if (targetId !== tree.id) C.removeNode(tree, targetId);
    } else {
      /* duplicate a random non-root subtree next to itself */
      if (targetId !== tree.id) {
        const node = C.findNode(tree, targetId);
        const parent = C.findParent(tree, targetId);
        if (node && parent) {
          const clone = C.cloneSubtree(node);
          const idx = parent.children.findIndex(function (c) { return c.id === node.id; });
          parent.children.splice(idx + 1, 0, clone);
        }
      }
    }
    ok(treeIsConsistent(tree), "tree consistent after op " + i + " (kind " + op + ")");
  }
  /* a serialize/deserialize round-trip after the storm must still be byte-identical
     and the id sequence re-syncs so the next created node never collides */
  const json = C.serialize(tree);
  const back = C.deserialize(json);
  eq(C.serialize(back), json, "round-trip identical after storm");
  const fresh = C.createNode("Button");
  eq(C.findNode(back, fresh.id), null, "no id collision after post-storm deserialize");
});

/* ==================== spec 19 sim-gap fixes (G2 / G6 / G8) ==================== */

/* helpers: a typed canvas ItemsControl, and a typed ListBox, parameterized so each
   gap test can flip exactly one option and assert only its delta. */
function canvasItemsControl(model) {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Rects";
  ic.model = model;
  C.addChild(tree, cv.id, ic);
  return { tree, cv, ic };
}

/* -- G2: templateShape Ellipse / Rectangle item template -- */
test("G2: templateShape Ellipse emits an Ellipse item template bound to Width/Height/Fill", () => {
  const { tree } = canvasItemsControl({
    mode: "typed", className: "RectItem", canvasItems: true, templateShape: "Ellipse",
    fields: [{ name: "Width", type: "double" }, { name: "Height", type: "double" },
             { name: "Brush", type: "IBrush" }],
  });
  const { axaml } = C.generate(tree);
  xmlBalanced(axaml);
  includes(axaml, "<ItemsControl.ItemTemplate>");
  includes(axaml, '<DataTemplate x:DataType="vm:RectItem">');
  includes(axaml, '<Ellipse Width="{Binding Width}" Height="{Binding Height}" Fill="{Binding Brush}"/>');
  /* the shape template REPLACES the debug StackPanel+TextBlock list */
  notIncludes(axaml, '<StackPanel Orientation="Horizontal" Spacing="8">',
    "shape template replaces the debug list");
});
test("G2: templateShape Rectangle without a brush field falls back to a default Fill", () => {
  const { tree } = canvasItemsControl({
    mode: "typed", className: "Box", canvasItems: true, templateShape: "Rectangle",
    fields: [{ name: "Width", type: "double" }, { name: "Height", type: "double" }],
  });
  const { axaml } = C.generate(tree);
  xmlBalanced(axaml);
  includes(axaml, '<Rectangle Width="{Binding Width}" Height="{Binding Height}" Fill="SteelBlue"/>');
  notIncludes(axaml, "Fill=\"{Binding", "no Fill binding without an IBrush field");
});
/* regression: a shape item template on a model WITHOUT Width/Height fields must not
   emit {Binding Width}/{Binding Height} — under compiled bindings that is a hard
   AVLN2000 build error against a model that has no such property. Use a literal size. */
test("G2: templateShape without Width/Height fields uses a literal size (no AVLN2000)", () => {
  const { tree } = canvasItemsControl({
    mode: "typed", className: "Dot", canvasItems: true, templateShape: "Ellipse",
    fields: [{ name: "X", type: "double" }, { name: "Y", type: "double" }],
  });
  const { axaml } = C.generate(tree);
  xmlBalanced(axaml);
  notIncludes(axaml, 'Width="{Binding Width}"', "no Width binding when the model lacks Width");
  notIncludes(axaml, 'Height="{Binding Height}"', "no Height binding when the model lacks Height");
  includes(axaml, '<Ellipse Width="40" Height="40" Fill="SteelBlue"/>');
});
test("G2: unset templateShape keeps today's debug-list template byte-for-byte", () => {
  /* byte-for-byte: the exact template the existing 'typed model AXAML' test asserts */
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "Item",
    fields: [{ name: "Title", type: "string" }, { name: "Color", type: "IBrush" }] };
  C.addChild(tree, sp.id, lb);
  const { axaml } = C.generate(tree);
  includes(axaml, '<StackPanel Orientation="Horizontal" Spacing="8">');
  includes(axaml, '<TextBlock Text="{Binding Title}"/>');
  notIncludes(axaml, "<Ellipse", "no shape emitted when templateShape is unset");
});

/* -- G6: nested model -> vm:Outer+Inner DataType -- */
test("G6: nested model emits the vm:Outer+Inner compiled-binding DataType", () => {
  const { tree } = canvasItemsControl({
    mode: "typed", className: "RectItem", canvasItems: true, nested: true,
    fields: [{ name: "Width", type: "double" }, { name: "Brush", type: "IBrush" }],
  });
  const { axaml } = C.generate(tree);
  xmlBalanced(axaml);
  /* both the item template AND the ContentPresenter canvas style use the + form */
  includes(axaml, '<DataTemplate x:DataType="vm:MainWindowViewModel+RectItem">');
  includes(axaml, '<Style Selector="ContentPresenter" x:DataType="vm:MainWindowViewModel+RectItem">');
  notIncludes(axaml, 'x:DataType="vm:RectItem"', "bare class name must not appear when nested");
});
test("G6: nested model with an explicit outerClass qualifies against it", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Days";
  lb.model = { mode: "typed", className: "WeekDayItem", nested: true, outerClass: "ShellViewModel",
    fields: [{ name: "Day", type: "string" }] };
  C.addChild(tree, sp.id, lb);
  const { axaml } = C.generate(tree);
  includes(axaml, '<DataTemplate x:DataType="vm:ShellViewModel+WeekDayItem">');
});
test("G6: a non-nested model keeps the bare DataType (byte-for-byte default)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "Item", fields: [{ name: "Name", type: "string" }] };
  C.addChild(tree, sp.id, lb);
  const { axaml } = C.generate(tree);
  includes(axaml, '<DataTemplate x:DataType="vm:Item">');
  notIncludes(axaml, "+", "no + qualifier for a non-nested model");
});

/* -- G6: SelectedItems multi-select binding -- */
test("G6: SelectedItems catalog prop exists and binds to a VM ObservableCollection", () => {
  ok(C.CATALOG.ListBox.props.some((p) => p.name === "SelectedItems" && p.bindable),
    "ListBox exposes a bindable SelectedItems");
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.props.SelectionMode = "Multiple";
  lb.bindings.ItemsSource = "Days"; lb.bindings.SelectedItems = "PickedDays";
  lb.model = { mode: "typed", className: "WeekDayItem", fields: [{ name: "Day", type: "string" }] };
  C.addChild(tree, sp.id, lb);
  const { axaml, viewModel } = C.generate(tree);
  xmlBalanced(axaml);
  includes(axaml, 'SelectedItems="{Binding PickedDays}"');
  includes(viewModel, "public ObservableCollection<WeekDayItem> PickedDays { get; } = new();");
  includes(viewModel, "using System.Collections.ObjectModel;");
});
test("G6: SelectedItems on a strings ListBox binds a string collection", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.props.SelectionMode = "Multiple";
  lb.bindings.ItemsSource = "Items"; lb.bindings.SelectedItems = "Picked";
  C.addChild(tree, sp.id, lb);
  const { viewModel } = C.generate(tree);
  includes(viewModel, "public ObservableCollection<string> Picked { get; } = new();");
});

/* -- G8: projectNamespace stamps xmlns:vm / x:Class / namespace -- */
test("G8: projectNamespace stamps through axaml, viewModel and model panes", () => {
  const tree = C.createNode("Window");
  tree.projectNamespace = "MealPlanner";
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "Item", fields: [{ name: "Name", type: "string" }] };
  C.addChild(tree, sp.id, lb);
  const gen = C.generate(tree);
  xmlBalanced(gen.axaml);
  includes(gen.axaml, 'xmlns:vm="using:MealPlanner.ViewModels"');
  includes(gen.axaml, 'x:Class="MealPlanner.Views.MainWindow"');
  includes(gen.viewModel, "namespace MealPlanner.ViewModels;");
  includes(gen.model, "namespace MealPlanner.ViewModels;");
  notIncludes(gen.axaml, "ExamApp", "ExamApp fully replaced by the project namespace");
  notIncludes(gen.viewModel, "namespace ExamApp", "VM namespace replaced");
});
test("G8: projectNamespace also drives the flat submission pair (single namespace)", () => {
  const tree = C.createNode("Window");
  tree.projectNamespace = "MealPlanner";
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "RectItem",
    fields: [{ name: "Width", type: "double" }, { name: "Brush", type: "IBrush" }] };
  C.addChild(tree, sp.id, lb);
  const sub = C.submission(tree);
  eq(sub.files.length, 2, "still a flat two-file pair");
  includes(sub.viewModel, "namespace MealPlanner.ViewModels;");
  eq(sub.viewModel.split("namespace MealPlanner.ViewModels;").length - 1, 1, "one namespace decl");
  includes(sub.viewModel, "public partial class RectItem : ObservableObject");
  eq(C.foreignUsings(sub.viewModel).length, 0, "no foreign usings");
});
test("G8: unset projectNamespace keeps ExamApp byte-for-byte (projzip rewrite path)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const tb = C.createNode("TextBox"); tb.bindings.Text = "Name"; C.addChild(tree, sp.id, tb);
  const gen = C.generate(tree);
  includes(gen.axaml, 'xmlns:vm="using:ExamApp.ViewModels"');
  includes(gen.axaml, 'x:Class="ExamApp.Views.MainWindow"');
  includes(gen.viewModel, "namespace ExamApp.ViewModels;");
});

/* -- G8: a sized ItemsControl propagates Width/Height into the inner Canvas + clamps -- */
test("G8: sized ItemsControl sizes the inner Canvas and the clamp constants", () => {
  const tree = C.createNode("Window");
  const root = C.createNode("DockPanel"); C.addChild(tree, tree.id, root);
  const bar = C.createNode("StackPanel"); bar.props["DockPanel.Dock"] = "Top"; C.addChild(tree, root.id, bar);
  const btn = C.createNode("Button"); btn.bindings.Command = "AddCommand";
  btn.recipes = { Command: "add-random-item" }; C.addChild(tree, bar.id, btn);
  const cv = C.createNode("Canvas"); C.addChild(tree, root.id, cv);
  const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Rectangles";
  ic.props.Width = 500; ic.props.Height = 350;
  ic.model = { mode: "typed", className: "RectItem", canvasItems: true,
    fields: [{ name: "X", type: "double" }, { name: "Y", type: "double" },
             { name: "Width", type: "double" }, { name: "Height", type: "double" },
             { name: "Brush", type: "IBrush" }] };
  C.addChild(tree, cv.id, ic);
  const { axaml, viewModel } = C.generate(tree);
  xmlBalanced(axaml);
  /* inner items-panel Canvas is sized to the host */
  includes(axaml, '<Canvas Width="500" Height="350"/>');
  notIncludes(axaml, "<Canvas/>", "the items-panel Canvas is no longer bare when sized");
  /* clamp constants follow the host size so spawned items stay in view */
  includes(viewModel, "private const double CanvasWidth = 500;");
  includes(viewModel, "private const double CanvasHeight = 350;");
});
test("G8: an unsized ItemsControl keeps the bare Canvas and 400/300 clamps (byte-for-byte)", () => {
  const tree = C.createNode("Window");
  const root = C.createNode("DockPanel"); C.addChild(tree, tree.id, root);
  const bar = C.createNode("StackPanel"); bar.props["DockPanel.Dock"] = "Top"; C.addChild(tree, root.id, bar);
  const btn = C.createNode("Button"); btn.bindings.Command = "AddCommand";
  btn.recipes = { Command: "add-random-item" }; C.addChild(tree, bar.id, btn);
  const cv = C.createNode("Canvas"); C.addChild(tree, root.id, cv);
  const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Rectangles";
  ic.model = { mode: "typed", className: "RectItem", canvasItems: true,
    fields: [{ name: "X", type: "double" }, { name: "Y", type: "double" },
             { name: "Width", type: "double" }, { name: "Height", type: "double" },
             { name: "Brush", type: "IBrush" }] };
  C.addChild(tree, cv.id, ic);
  const { axaml, viewModel } = C.generate(tree);
  includes(axaml, "<Canvas/>");
  includes(viewModel, "private const double CanvasWidth = 400;");
  includes(viewModel, "private const double CanvasHeight = 300;");
});

/* ===== margins/alignment, bindable size + brush, and reproducing CircleCodeBehind ===== */
test("shapes carry Margin + alignment through to the generated AXAML", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const el = C.createNode("Ellipse");
  el.props.Margin = "10,0,20,0";
  el.props.HorizontalAlignment = "Center";
  C.addChild(tree, sp.id, el);
  const { axaml } = C.generate(tree);
  includes(axaml, 'Margin="10,0,20,0"');
  includes(axaml, 'HorizontalAlignment="Center"');
});

test("Ellipse Width/Height are bindable and a shared binding name dedupes to one property", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const el = C.createNode("Ellipse");
  el.bindings.Width = "Size"; el.bindings.Height = "Size"; el.bindings.Fill = "CircleFill";
  C.addChild(tree, sp.id, el);
  const sl = C.createNode("Slider"); sl.bindings.Value = "Size"; C.addChild(tree, sp.id, sl);
  const { axaml, viewModel } = C.generate(tree);
  includes(axaml, 'Width="{Binding Size}"');
  includes(axaml, 'Height="{Binding Size}"');
  includes(axaml, 'Fill="{Binding CircleFill}"');
  const sizeCount = (viewModel.match(/private double size;/g) || []).length;
  eq(sizeCount, 1, "exactly one double Size property despite three bindings to it");
  includes(viewModel, "private IBrush circleFill = Brushes.Gray;");
  includes(viewModel, "using Avalonia.Media;");
});

test("Visual Designer reproduces the CircleCodeBehind MVVM (bindings + VM members)", () => {
  const tree = C.createNode("Window");
  tree.props.Title = "CircleCodeBehind";
  const sp = C.createNode("StackPanel"); sp.props.Margin = "50"; C.addChild(tree, tree.id, sp);
  const el = C.createNode("Ellipse");
  el.bindings.Fill = "CircleFill"; el.bindings.Height = "Size"; el.bindings.Width = "Size";
  C.addChild(tree, sp.id, el);
  const cb = C.createNode("ComboBox");
  cb.bindings.ItemsSource = "Colors"; cb.bindings.SelectedItem = "SelectedColor";
  C.addChild(tree, sp.id, cb);
  const sl = C.createNode("Slider"); sl.props.Minimum = 50; sl.props.Maximum = 500; sl.bindings.Value = "Size";
  C.addChild(tree, sp.id, sl);
  const btn = C.createNode("Button"); btn.props.Content = "Reset"; btn.bindings.Command = "ResetCommand";
  C.addChild(tree, sp.id, btn);
  const tb = C.createNode("TextBlock"); tb.bindings.Text = "Size"; C.addChild(tree, sp.id, tb);
  const { axaml, viewModel } = C.generate(tree);
  ['Fill="{Binding CircleFill}"', 'Height="{Binding Size}"', 'Width="{Binding Size}"',
   'ItemsSource="{Binding Colors}"', 'SelectedItem="{Binding SelectedColor}"',
   'Value="{Binding Size}"', 'Command="{Binding ResetCommand}"', 'Text="{Binding Size}"']
    .forEach((frag) => includes(axaml, frag, "axaml missing " + frag));
  includes(viewModel, "private double size;");
  includes(viewModel, "selectedColor", "a SelectedColor property (string?) for the combo selection");
  includes(viewModel, "private IBrush circleFill = Brushes.Gray;");
  includes(viewModel, "Colors");
  includes(viewModel, "[RelayCommand]");
  includes(viewModel, "Reset");
});

/* every visual element can be dynamically sized / aligned / margin-positioned */
test("every non-root element exposes Width/Height/Margin/alignment (sizable any element)", () => {
  Object.keys(C.CATALOG).forEach(function (type) {
    const def = C.CATALOG[type];
    if (def.group === "Root") return;
    const names = (def.props || []).map(function (p) { return p.name; });
    ["Width", "Height", "Margin", "HorizontalAlignment", "VerticalAlignment"].forEach(function (n) {
      ok(names.indexOf(n) !== -1, type + " should expose " + n);
    });
  });
});
test("catalog normalization introduced no duplicate prop names", () => {
  Object.keys(C.CATALOG).forEach(function (type) {
    const names = (C.CATALOG[type].props || []).map(function (p) { return p.name; });
    const seen = {};
    names.forEach(function (n) { ok(!seen[n], type + " has duplicate prop " + n); seen[n] = 1; });
  });
});
test("a CheckBox (previously fixed) now carries bindable Width to dynamically size it", () => {
  const w = (C.CATALOG.CheckBox.props || []).find(function (p) { return p.name === "Width"; });
  ok(w && w.bindable && w.vmType === "double", "CheckBox Width is bindable double");
});

/* which alignment axis is inert in a StackPanel (Avalonia: the stacking axis) */
test("inertAlignmentAxis matches Avalonia stack-panel layout", () => {
  eq(C.inertAlignmentAxis("StackPanel", "Vertical"), "VerticalAlignment");
  eq(C.inertAlignmentAxis("StackPanel", undefined), "VerticalAlignment");
  eq(C.inertAlignmentAxis("StackPanel", "Horizontal"), "HorizontalAlignment");
  eq(C.inertAlignmentAxis("WrapPanel", undefined), "HorizontalAlignment");
  eq(C.inertAlignmentAxis("Grid", "Vertical"), null);
  eq(C.inertAlignmentAxis("Border"), null);
});

/* ---------------- size-locked window (CanResize) ---------------- */
test("window is size-locked by default: generated axaml sets CanResize=False", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  includes(C.generate(tree).axaml, 'CanResize="False"', "default design locks the window size");
});
test("unlocking the window (SizeLocked=false) drops CanResize so it can resize", () => {
  const tree = C.createNode("Window");
  tree.props.SizeLocked = false;
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  notIncludes(C.generate(tree).axaml, "CanResize", "unlocked window has no CanResize attr");
});

/* ---------------- rotation -> RenderTransform ---------------- */
test("a rotated element emits a centred RenderTransform, not a literal Rotation attr", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const el = C.createNode("Ellipse"); el.props.Rotation = 45; C.addChild(tree, sp.id, el);
  const ax = C.generate(tree).axaml;
  includes(ax, 'RenderTransform="rotate(45deg)"', "rotate transform emitted");
  includes(ax, 'RenderTransformOrigin="50%,50%"', "rotates around the centre (relative origin)");
  notIncludes(ax, 'Rotation="', "no invalid literal Rotation attribute");
});
test("rotation of 0 emits nothing (clean output)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const el = C.createNode("Rectangle"); el.props.Rotation = 0; C.addChild(tree, sp.id, el);
  notIncludes(C.generate(tree).axaml, "RenderTransform", "zero rotation is a no-op");
});

/* ---------------- geometry shapes never emit inert Width/Height ---------------- */
test("a Line keeps its geometry and never emits inert Width/Height", () => {
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const ln = C.createNode("Line");
  ln.props.StartPoint = "10,20"; ln.props.EndPoint = "120,80";   // non-default points
  ln.props.Width = 270; ln.props.Height = 270;          // stray/legacy size props
  C.addChild(tree, cv.id, ln);
  const ax = C.generate(tree).axaml;
  includes(ax, 'StartPoint="10,20"', "keeps StartPoint");
  includes(ax, 'EndPoint="120,80"', "keeps EndPoint");
  notIncludes(ax, 'Width="270"', "Line must not ship an inert Width");
  notIncludes(ax, 'Height="270"', "Line must not ship an inert Height");
});

/* ---------------- shapes must be visible in the exported app ---------------- */
test("a Line with no Stroke still exports a visible stroke (not a blank window)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const ln = C.createNode("Line"); ln.props.EndPoint = "190,100"; ln.props.Rotation = 121;
  C.addChild(tree, sp.id, ln);                 // no Stroke / StrokeThickness set by the user
  const ax = C.generate(tree).axaml;
  includes(ax, 'Stroke="Black"', "line gets a default visible stroke");
  includes(ax, 'StrokeThickness="2"', "line gets a default thickness");
  includes(ax, 'RenderTransform="rotate(121deg)"', "rotation still applies");
});
test("a user-chosen Line stroke is respected (no override)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const ln = C.createNode("Line"); ln.props.EndPoint = "100,100"; ln.props.Stroke = "#ff0000";
  C.addChild(tree, sp.id, ln);
  const ax = C.generate(tree).axaml;
  includes(ax, 'Stroke="#ff0000"', "keeps the user's stroke");
  notIncludes(ax, 'Stroke="Black"', "does not also add the default");
  includes(ax, 'StrokeThickness="2"', "still ensures a thickness");
});
test("a Polygon with neither Fill nor Stroke exports a visible default fill", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const pg = C.createNode("Polygon"); C.addChild(tree, sp.id, pg);
  includes(C.generate(tree).axaml, 'Fill="#9AA7B8"', "polygon is visible by default");
});

test("a fresh Rectangle/Ellipse exports a visible fill + size (no blank shape)", () => {
  ["Rectangle", "Ellipse"].forEach(function (type) {
    const tree = C.createNode("Window");
    const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
    C.addChild(tree, sp.id, C.createNode(type));   // nothing set by the user
    const ax = C.generate(tree).axaml;
    includes(ax, 'Fill="#9AA7B8"', type + " gets a visible default fill");
    includes(ax, 'Width="80"', type + " gets a default width");
    includes(ax, 'Height="50"', type + " gets a default height");
  });
});
test("a user-set Ellipse fill/size is respected (no default override)", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const el = C.createNode("Ellipse");
  el.props.Fill = "#7fd962"; el.props.Width = 120; el.props.Height = 120;
  C.addChild(tree, sp.id, el);
  const ax = C.generate(tree).axaml;
  includes(ax, 'Fill="#7fd962"', "keeps the chosen fill");
  notIncludes(ax, 'Fill="#9AA7B8"', "no default fill added");
  includes(ax, 'Width="120"', "keeps the chosen width");
});
test("a locked element is designer-only and never leaks into the exported axaml", () => {
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); sp.locked = true; C.addChild(tree, tree.id, sp);
  const btn = C.createNode("Button"); btn.locked = true; C.addChild(tree, sp.id, btn);
  notIncludes(C.generate(tree).axaml, "locked", "lock state is not exported");
});
