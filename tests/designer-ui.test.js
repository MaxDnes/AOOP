"use strict";
const { test, ok, includes, eq, xmlBalanced, notIncludes } = require("./t.js");
global.window = global;            // designer.js attaches to window; no DOM calls at load time

/* in-memory localStorage so the exam-preset seeding path can run under Node */
(function () {
  const store = {};
  global.localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
  };
})();

/* minimal document stub: seedExamples()/repaintSlots()/msg() touch the DOM at
   runtime (never at load time). Under Node there is no real DOM, so every lookup
   must return null and the toolbar repaint becomes a no-op — exactly the behaviour
   we want for a headless seeding/codegen check.
   NOTE: we force getElementById to return null even when a sibling test file
   (loaded earlier by run-tests.js) installed a global.document whose
   getElementById returns truthy element stubs — otherwise designer.js's msg()
   would call .classList.add on a stub that has no classList. We preserve any
   other methods that stub provided so later files keep working. */
global.document = Object.assign({}, global.document, {
  getElementById: function () { return null; },
});

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
test("DSG exposes the new upgrade handlers", () => {
  ["undo", "redo", "duplicate", "exportDesigns", "importDesigns", "onImportFile",
   "setItemsMode", "setModelClass", "setCanvasItems", "addField", "removeField",
   "setFieldName", "setFieldType", "setColorText"].forEach((fn) => {
    ok(typeof global.DSG[fn] === "function", "missing DSG." + fn);
  });
});
/* spec 19: the new gap-fix handlers (templateShape / nested / projectNamespace) */
test("DSG exposes the spec-19 gap-fix handlers", () => {
  ["setTemplateShape", "setNested", "setProjectNamespace"].forEach((fn) => {
    ok(typeof global.DSG[fn] === "function", "missing DSG." + fn);
  });
});
test("setProjectNamespace persists on the tree and stamps into generated code", () => {
  const C = global.DESIGNER_CORE;
  global.DSG.newDesign();                       // fresh Window selected
  global.DSG.setProjectNamespace("MealPlanner");
  /* read the live tree back through render -> the generated code in the preview */
  const tree = JSON.parse(global.localStorage.getItem("aop-designer-current")).tree;
  C.syncIdSeq(tree);
  eq(tree.projectNamespace, "MealPlanner", "namespace stored on the tree");
  includes(C.generate(tree).axaml, 'x:Class="MealPlanner.Views.MainWindow"');
  /* blank / ExamApp clears it back to the default (projzip-rewrite path) */
  global.DSG.setProjectNamespace("ExamApp");
  const tree2 = JSON.parse(global.localStorage.getItem("aop-designer-current")).tree;
  ok(tree2.projectNamespace == null, "ExamApp resets to the unset default");
});
test("typed items inspector offers the Item shape + Nested-in-VM + SelectedItems controls", () => {
  const C = global.DESIGNER_CORE;
  /* stage a tree whose selected node is a typed ListBox so render()'s initState()
     restores it as the selection and the inspector renders the items panel. */
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "Item", fields: [{ name: "Name", type: "string" }] };
  C.addChild(tree, sp.id, lb);
  global.localStorage.setItem("aop-designer-current",
    JSON.stringify({ v: 1, tree: tree, selectedId: lb.id, slot: "" }));
  const html = reloadDesignerFresh().render();
  includes(html, "DSG.setTemplateShape");      // G2 item-shape dropdown
  includes(html, "DSG.setNested");             // G6 nested-in-VM toggle
  includes(html, "DSG.setBind('SelectedItems'");   // G6 SelectedItems bind row
});
test("root inspector offers the project Namespace field (G8)", () => {
  const C = global.DESIGNER_CORE;
  const tree = C.createNode("Window");
  global.localStorage.setItem("aop-designer-current",
    JSON.stringify({ v: 1, tree: tree, selectedId: tree.id, slot: "" }));
  const html = reloadDesignerFresh().render();
  includes(html, "DSG.setProjectNamespace");
});
test("templateShape model still previews without throwing (debug-list fallback in HTML)", () => {
  const C = global.DESIGNER_CORE;
  const tree = C.createNode("Window");
  const cv = C.createNode("Canvas"); C.addChild(tree, tree.id, cv);
  const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Rects";
  ic.model = { mode: "typed", className: "RectItem", canvasItems: true, templateShape: "Ellipse",
    fields: [{ name: "Width", type: "double" }, { name: "Brush", type: "IBrush" }] };
  C.addChild(tree, cv.id, ic);
  const html = global.DESIGNER.previewHTML(tree);
  ok(typeof html === "string" && html.indexOf("RectItem") !== -1, "preview renders the model");
});
test("preview HTML escapes user text", () => {
  const C = global.DESIGNER_CORE;
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const tb = C.createNode("TextBlock"); tb.props.Text = '<img onerror=x>'; C.addChild(tree, sp.id, tb);
  const html = global.DESIGNER.previewHTML(tree);
  includes(html, "&lt;img");
});
test("preview renders new catalog types without throwing", () => {
  const C = global.DESIGNER_CORE;
  ["ToggleSwitch", "NumericUpDown", "Separator", "ItemsControl"].forEach((t) => {
    const tree = C.createNode("Window");
    const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
    C.addChild(tree, sp.id, C.createNode(t));
    const html = global.DESIGNER.previewHTML(tree, sp.id);
    ok(typeof html === "string" && html.indexOf("pv-" + t) !== -1, "rendered " + t);
  });
  // TabControl with a TabItem
  const tree = C.createNode("Window");
  const tc = C.createNode("TabControl"); C.addChild(tree, tree.id, tc);
  const ti = C.createNode("TabItem"); C.addChild(tree, tc.id, ti);
  const html = global.DESIGNER.previewHTML(tree);
  includes(html, "pv-tabstrip");
});
test("typed-model items host preview shows the model class chip", () => {
  const C = global.DESIGNER_CORE;
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Items";
  lb.model = { mode: "typed", className: "Recipe", fields: [] };
  C.addChild(tree, sp.id, lb);
  const html = global.DESIGNER.previewHTML(tree);
  includes(html, "Recipe");
  /* no fields -> still neutral ghost strips, no sample rows */
  includes(html, "pv-ghost");
  notIncludes(html, "pv-sample-row", "empty model shows ghosts, not sample rows");
});
test("typed-model preview renders 3 sample rows with a swatch for IBrush fields", () => {
  const C = global.DESIGNER_CORE;
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const lb = C.createNode("ListBox"); lb.bindings.ItemsSource = "Days";
  lb.model = { mode: "typed", className: "WeekDayItem",
    fields: [{ name: "Day", type: "string" }, { name: "RecipeName", type: "string" }] };
  C.addChild(tree, sp.id, lb);
  const html = global.DESIGNER.previewHTML(tree);
  eq((html.match(/pv-sample-row/g) || []).length, 3, "exactly 3 sample rows");
  notIncludes(html, "pv-ghost", "typed model replaces the ghost strips");
  includes(html, "pv-cell-str");
  /* IBrush field renders a colored swatch in the sample row */
  const cv = C.createNode("Window");
  const c2 = C.createNode("Canvas"); C.addChild(cv, cv.id, c2);
  const ic = C.createNode("ItemsControl"); ic.bindings.ItemsSource = "Rects";
  ic.model = { mode: "typed", className: "RectItem", canvasItems: true,
    fields: [{ name: "Width", type: "double" }, { name: "Brush", type: "IBrush" }] };
  C.addChild(cv, c2.id, ic);
  const html2 = global.DESIGNER.previewHTML(cv);
  includes(html2, "pv-swatch");
  includes(html2, "pv-cell-num");
});

/* ---- exam presets generate pasteable AXAML + VM + model ---- */
function presetTree(name) {
  const C = global.DESIGNER_CORE;
  global.DSG.seedExamples();                       // writes presets into localStorage slots
  const slots = JSON.parse(global.localStorage.getItem("aop-designer-slots") || "{}");
  ok(slots[name], "preset present: " + name);
  const t = JSON.parse(JSON.stringify(slots[name]));
  C.syncIdSeq(t);
  return t;
}
test("preset 'Summer 2025 · RectangleUI' emits the canvas ItemsControl idiom", () => {
  const C = global.DESIGNER_CORE;
  const t = presetTree("Summer 2025 · RectangleUI");
  const gen = C.generate(t);
  xmlBalanced(gen.axaml);
  includes(gen.axaml, "<ItemsControl");
  includes(gen.axaml, "<ItemsControl.ItemsPanel>");
  includes(gen.axaml, '<Setter Property="Canvas.Left" Value="{Binding X}"/>');
  includes(gen.axaml, '<Style Selector="ContentPresenter" x:DataType="vm:RectItem">');
  includes(gen.axaml, '{Binding AddCommand}');
  ok(gen.model, "RectItem model pane emitted");
  includes(gen.model, "public partial class RectItem : ObservableObject");
  includes(gen.model, "private IBrush brush = Brushes.SteelBlue;");   // initialized (no CS8618)
  includes(gen.viewModel, "ObservableCollection<RectItem> Rectangles");
  includes(gen.viewModel, "[RelayCommand]");
  /* CountText is wired to the rectangle count so the display updates on Add */
  includes(gen.viewModel, "Rectangles.CollectionChanged += (_, _) => UpdateCountText();");
  includes(gen.viewModel, 'CountText = $"{Rectangles.Count} rectangles";');
});
test("preset 'ReExam 2025 · MealPlanner' emits typed ListBox + Multiple + SelectedItem", () => {
  const C = global.DESIGNER_CORE;
  const t = presetTree("ReExam 2025 · MealPlanner");
  const gen = C.generate(t);
  xmlBalanced(gen.axaml);
  includes(gen.axaml, 'SelectionMode="Multiple"');
  includes(gen.axaml, 'SelectedItem="{Binding SelectedRecipe}"');
  includes(gen.axaml, '<DataTemplate x:DataType="vm:WeekDayItem">');
  includes(gen.axaml, '{Binding GenerateCommand}');
  ok(gen.model, "WeekDayItem model emitted");
  includes(gen.model, "public partial class WeekDayItem : ObservableObject");
  includes(gen.viewModel, "partial void OnSelectedRecipeChanged(WeekDayItem? value)");
});

/* ---- localStorage version stamp + graceful migration (spec 14 hardening) ---- */
test("saved working state is version-stamped {v:1, ...}", () => {
  /* a handler that persists: select() -> refresh -> saveCurrent() */
  global.DSG.newDesign();          // fresh Window, triggers a save
  const raw = JSON.parse(global.localStorage.getItem("aop-designer-current") || "null");
  ok(raw && raw.v === 1, "current payload carries v:1");
  ok(raw.tree && raw.tree.type === "Window", "payload still carries the Window tree");
});
/* reload designer.js with a fresh module cache so its module-level `tree` is reset
   and initState() re-runs loadCurrent() against whatever we staged in localStorage */
function reloadDesignerFresh() {
  delete require.cache[require.resolve("../data/designer.js")];
  require("../data/designer.js");
  return global.DESIGNER;
}
test("legacy unversioned working state is migrated and loaded on init", () => {
  const C = global.DESIGNER_CORE;
  const legacy = C.createNode("Window"); legacy.props.Title = "LegacyDesign";
  global.localStorage.setItem("aop-designer-current",
    JSON.stringify({ tree: legacy, selectedId: legacy.id, slot: "" }));   // no v stamp
  const html = reloadDesignerFresh().render();
  includes(html, "LegacyDesign", "legacy payload migrated and rendered");
});
test("unknown/future version is ignored, falling back to a blank Window", () => {
  const C = global.DESIGNER_CORE;
  const future = C.createNode("Window"); future.props.Title = "FromTheFuture";
  global.localStorage.setItem("aop-designer-current",
    JSON.stringify({ v: 999, tree: future, selectedId: future.id, slot: "" }));
  const html = reloadDesignerFresh().render();
  notIncludes(html, "FromTheFuture", "future-version payload must be rejected");
  /* fell back to a fresh default Window title */
  includes(html, "Exam App");
});

/* ---- export full project (.zip): graceful fallback + entry shape (spec 13) ---- */
test("DSG exposes exportProject", () => {
  ok(typeof global.DSG.exportProject === "function", "missing DSG.exportProject");
});
test("toolbar hides the Export-project group when PROJZIP is not loaded", () => {
  /* order-independent: temporarily remove PROJZIP so this holds no matter which
     sibling test files have already loaded the core into the shared global */
  const saved = global.PROJZIP;
  try {
    delete global.PROJZIP;
    const html = global.DESIGNER.render();
    includes(html, "dsg-exportproj-wrap");
    /* the wrap must be display:none so the button is never offered without the core */
    ok(/dsg-exportproj-wrap"[^>]*style="display:none"/.test(html), "export group hidden");
  } finally {
    if (saved) global.PROJZIP = saved;
  }
});
test("toolbar shows the Export-project group when PROJZIP is loaded", () => {
  const saved = global.PROJZIP;
  global.PROJZIP = saved || require("../data/projzip-core.js");
  const html = global.DESIGNER.render();
  includes(html, "dsg-exportproj-wrap");
  includes(html, "Export project (.zip)");
  ok(!/dsg-exportproj-wrap"[^>]*style="display:none"/.test(html), "export group visible");
});
test("exportProject builds a buildable-looking Avalonia project once PROJZIP loads", () => {
  const C = global.DESIGNER_CORE;
  const PZ = require("../data/projzip-core.js");      // now global.PROJZIP is set
  ok(global.PROJZIP, "PROJZIP available after load");
  /* mirror exactly what DSG.exportProject assembles from a design's codegen */
  const t = presetTree("Summer 2025 · RectangleUI");
  const gen = C.generate(t);
  const opts = { axaml: gen.axaml, viewModel: gen.viewModel };
  if (gen.model) opts.models = [{ path: "ViewModels/Item.cs", text: gen.model }];
  const entries = PZ.avaloniaProject("RectangleUI", opts);
  const byPath = {};
  entries.forEach((e) => { byPath[e.path] = e.text; });
  /* the complete scaffold is present */
  ["RectangleUI.csproj", "Program.cs", "App.axaml", "App.axaml.cs",
   "Views/MainWindow.axaml", "Views/MainWindow.axaml.cs",
   "ViewModels/MainWindowViewModel.cs", "ViewModels/Item.cs"].forEach((p) => {
    ok(byPath[p] != null, "missing entry: " + p);
  });
  /* csproj is well-formed and carries the exact Avalonia version */
  xmlBalanced(byPath["RectangleUI.csproj"]);
  includes(byPath["RectangleUI.csproj"], 'Include="Avalonia" Version="11.2.1"');
  /* the designer's ExamApp.* namespaces were rewritten to the project name */
  includes(byPath["Views/MainWindow.axaml"], 'x:Class="RectangleUI.Views.MainWindow"');
  includes(byPath["ViewModels/MainWindowViewModel.cs"], "namespace RectangleUI.ViewModels;");
  includes(byPath["ViewModels/Item.cs"], "namespace RectangleUI.ViewModels;");
  notIncludes(byPath["ViewModels/Item.cs"], "namespace ExamApp", "ExamApp ns fully rewritten");
  xmlBalanced(byPath["Views/MainWindow.axaml"]);
});
test("exportProject default name comes from the window Title, sanitized", () => {
  const PZ = global.PROJZIP || require("../data/projzip-core.js");
  /* a Title with spaces/punctuation sanitizes to a legal assembly name */
  ok(PZ.sanitizeName("Family Meal Planner", "ExamApp") === "Family_Meal_Planner");
});

/* ---- spec 16: flat submission download (Problem 2 pair) ---- */
test("DSG exposes exportSubmission", () => {
  ok(typeof global.DSG.exportSubmission === "function", "missing DSG.exportSubmission");
});
test("toolbar renders the Download submission files button + flat-folder hint", () => {
  const html = global.DESIGNER.render();
  includes(html, "dsg-submit-wrap");
  includes(html, "Download submission files");
  includes(html, "DSG.exportSubmission()");
  includes(html, "submit flat: 6 files, no bin/obj, no subfolders");
});
/* the integration agent greps the tool UI file for the exact submission file names;
   they must literally appear in the wiring so a grader gets the professor's names. */
test("designer.js wires the exact Problem_2 submission file names", () => {
  ok(src.indexOf("Problem_2_MainWindow.axaml") !== -1, "axaml name present in wiring");
  ok(src.indexOf("Problem_2_MainWindowViewModel.cs") !== -1, "vm name present in wiring");
});
/* the submission download must NOT depend on PROJZIP (plain blobs, no zip): the
   button is offered even when the zip core never loaded. */
test("submission button is offered even when PROJZIP is absent", () => {
  const saved = global.PROJZIP;
  try {
    delete global.PROJZIP;
    const html = global.DESIGNER.render();
    includes(html, "Download submission files");
    ok(html.indexOf('dsg-submit-wrap"') !== -1, "submit wrap rendered");
    /* the submit wrap must not be hidden the way the zip group is */
    ok(!/dsg-submit-wrap"[^>]*style="display:none"/.test(html), "submit button never hidden");
  } finally {
    if (saved) global.PROJZIP = saved;
  }
});
/* the generated submission VM for a preset carries no foreign using directives. */
test("preset submission VM contains only allowed-library usings", () => {
  const C = global.DESIGNER_CORE;
  ["Summer 2025 · RectangleUI", "ReExam 2025 · MealPlanner"].forEach((name) => {
    const t = presetTree(name);
    const sub = C.submission(t);
    eq(C.foreignUsings(sub.viewModel).length, 0, "no foreign usings for " + name);
    eq(sub.files.length, 2, "two-file flat pair for " + name);
  });
});

/* per-side Margin editor: the handler composes the four sides into a thickness string */
test("DSG.setThicknessSide exists and composes a four-side Margin on the selected node", () => {
  require("../data/designer.js");
  ok(typeof global.DSG.setThicknessSide === "function", "missing DSG.setThicknessSide");
  global.DSG.newDesign();                       // fresh Window selected
  global.DSG.setThicknessSide("Margin", 0, "10");   // Left
  global.DSG.setThicknessSide("Margin", 2, "20");   // Right
  const tree = JSON.parse(global.localStorage.getItem("aop-designer-current")).tree;
  eq(tree.props.Margin, "10,0,20,0", "left + right sides compose into the L,T,R,B string");
});

/* center move handle: the selected element renders a drag-to-move gizmo */
test("selected element renders a center move handle (drag-to-set-Margin)", () => {
  require("../data/designer.js");
  const C = global.DESIGNER_CORE;
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const el = C.createNode("Ellipse"); C.addChild(tree, sp.id, el);
  const html = global.DESIGNER.previewHTML(tree, el.id);
  includes(html, 'data-grip="move"', "selected element shows the move handle");
  includes(html, 'class="dsg-move"');
  /* an unselected element does not get a move handle */
  const html2 = global.DESIGNER.previewHTML(tree, sp.id);
  ok(html2.indexOf('class="dsg-move"') !== -1, "the selected StackPanel itself gets one");
});

/* with every element sizable, resize grips now appear on controls that had none */
test("any element (e.g. CheckBox) shows resize grips when selected", () => {
  require("../data/designer.js");
  const C = global.DESIGNER_CORE;
  const tree = C.createNode("Window");
  const sp = C.createNode("StackPanel"); C.addChild(tree, tree.id, sp);
  const cb = C.createNode("CheckBox"); C.addChild(tree, sp.id, cb);
  const html = global.DESIGNER.previewHTML(tree, cb.id);
  includes(html, 'data-grip="nw"', "CheckBox is resizable now");
  includes(html, 'data-grip="se"');
});
