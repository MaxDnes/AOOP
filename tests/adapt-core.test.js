"use strict";
/* Adapt Lab core: rewrite generated "ExamApp" code so its namespaces + class
   names match the exam's actual starter project. Deterministic string work;
   tested against the real 2025/2026 project shapes. */
const { test, ok, eq } = require("./t.js");
const C = require("../data/adapt-core.js");

/* ---------- deriveTarget ---------- */
test("deriveTarget builds the standard sub-namespaces from a project name", () => {
  const t = C.deriveTarget("RectangleUI");
  eq(t.rootNs, "RectangleUI");
  eq(t.vmNs, "RectangleUI.ViewModels");
  eq(t.viewNs, "RectangleUI.Views");
  eq(t.modelNs, "RectangleUI.Models");
});
test("deriveTarget strips a sub-namespace back to the root", () => {
  eq(C.deriveTarget("FamilyMealPlannerUI.ViewModels").rootNs, "FamilyMealPlannerUI");
});
test("deriveTarget returns null for empty input", () => {
  eq(C.deriveTarget("  "), null);
});

/* ---------- readProject: the 2026 practice exam view ---------- */
const circleAxaml =
  '<Window xmlns="https://github.com/avaloniaui"\n' +
  '        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n' +
  '        x:Class="CircleCodeBehind.MainWindow" Title="CircleCodeBehind">\n' +
  '  <StackPanel Margin="50">\n' +
  '    <Ellipse x:Name="Circle" Fill="green" Height="50" Width="50"/>\n' +
  '    <ComboBox x:Name="ColorSelector"/>\n' +
  '    <Slider x:Name="SizeSlider"/>\n' +
  '    <Button x:Name="ResetButton">Reset</Button>\n' +
  '    <TextBlock x:Name="Output"/>\n' +
  '  </StackPanel>\n' +
  '</Window>\n';

test("readProject reads class + root namespace out of an axaml x:Class", () => {
  const p = C.readProject(circleAxaml);
  eq(p.className, "MainWindow");
  eq(p.rootNs, "CircleCodeBehind");
  eq(p.viewNs, "CircleCodeBehind");          // flat code-behind project
});
test("readProject lists every x:Name control", () => {
  const p = C.readProject(circleAxaml);
  ["Circle", "ColorSelector", "SizeSlider", "ResetButton", "Output"].forEach((n) =>
    ok(p.controls.indexOf(n) !== -1, "missing control " + n));
});

/* ---------- readProject: the August FamilyMealPlanner VM with provided instances ---------- */
const mealVm =
  'using CommunityToolkit.Mvvm.ComponentModel;\n' +
  'namespace FamilyMealPlannerUI.ViewModels;\n' +
  'public partial class MainWindowViewModel : ViewModelBase\n' +
  '{\n' +
  '    private readonly MealPlanner _mealPlanner = new();\n' +
  '    private readonly ShoppingListGenerator _shoppingListGenerator = new();\n' +
  '    [ObservableProperty] private WeekDayItem selectedRecipe;\n' +
  '    public string Title { get; set; }\n' +
  '    public List<string> Notes { get; } = new();\n' +
  '}\n';

test("readProject learns the VM namespace and the project root", () => {
  const p = C.readProject(mealVm);
  eq(p.vmNs, "FamilyMealPlannerUI.ViewModels");
  eq(p.rootNs, "FamilyMealPlannerUI");
  eq(p.viewNs, "FamilyMealPlannerUI.Views");   // derived from root
});
test("readProject surfaces the provided domain instances, not the primitives", () => {
  const p = C.readProject(mealVm);
  const names = p.instances.map((i) => i.name);
  ok(names.indexOf("_mealPlanner") !== -1, "found _mealPlanner");
  ok(names.indexOf("_shoppingListGenerator") !== -1, "found _shoppingListGenerator");
  ok(names.indexOf("selectedRecipe") !== -1, "found selectedRecipe (WeekDayItem)");
  ok(names.indexOf("Title") === -1, "string Title is not a provided instance");
  ok(names.indexOf("Notes") === -1, "List Notes is not a provided instance");
});

/* ---------- detectSourceNs ---------- */
test("detectSourceNs finds ExamApp inside generated C#", () => {
  eq(C.detectSourceNs("namespace ExamApp.ViewModels;\nclass X {}"), "ExamApp");
});
test("detectSourceNs finds the root from a generated axaml", () => {
  eq(C.detectSourceNs('<Window xmlns:vm="using:ExamApp.ViewModels" x:Class="ExamApp.Views.MainWindow"/>'), "ExamApp");
});

/* ---------- adapt: C# ViewModel ---------- */
const genVm =
  'using CommunityToolkit.Mvvm.ComponentModel;\n' +
  'namespace ExamApp.ViewModels;\n' +
  'public partial class MainWindowViewModel : ObservableObject\n' +
  '{\n' +
  '    public ExamApp.Models.RectangleData Data { get; } = new();\n' +
  '}\n';

test("adapt renames ExamApp -> the target project across namespace + qualified refs", () => {
  const r = C.adapt(genVm, "csharp", C.deriveTarget("RectangleUI"));
  ok(/namespace RectangleUI\.ViewModels;/.test(r.text), "VM namespace renamed");
  ok(/RectangleUI\.Models\.RectangleData/.test(r.text), "qualified Models ref renamed");
  ok(r.text.indexOf("ExamApp") === -1, "no ExamApp left anywhere");
  eq(r.fromNs, "ExamApp");
  ok(r.notes.length >= 1, "explains what it changed");
});

test("adapt auto-detects the source namespace when the target is given by name", () => {
  const r = C.adapt(genVm, "csharp", C.deriveTarget("CircleCodeBehind"));
  ok(/namespace CircleCodeBehind\.ViewModels;/.test(r.text), "renamed to CircleCodeBehind");
});

/* ---------- adapt: AXAML view ---------- */
const genAxaml =
  '<Window xmlns="https://github.com/avaloniaui"\n' +
  '        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n' +
  '        xmlns:vm="using:ExamApp.ViewModels"\n' +
  '        x:Class="ExamApp.Views.MainWindow"\n' +
  '        x:DataType="vm:MainWindowViewModel">\n' +
  '</Window>\n';

test("adapt rewrites xmlns:vm and x:Class but keeps the vm: alias", () => {
  const r = C.adapt(genAxaml, "xml", C.deriveTarget("RectangleUI"));
  ok(/xmlns:vm="using:RectangleUI\.ViewModels"/.test(r.text), "vm namespace rewritten");
  ok(/x:Class="RectangleUI\.Views\.MainWindow"/.test(r.text), "x:Class rewritten");
  ok(/x:DataType="vm:MainWindowViewModel"/.test(r.text), "vm: alias preserved");
  ok(r.text.indexOf("ExamApp") === -1, "no ExamApp left");
});

/* ---------- adapt: explicit renames + no-target guard ---------- */
test("adapt applies explicit identifier renames (e.g. property -> provided instance)", () => {
  const r = C.adapt(genVm, "csharp", C.deriveTarget("RectangleUI"),
    { renames: [{ from: "Data", to: "RectangleData" }] });
  ok(/RectangleData Data/.test(r.text) === false, "Data identifier replaced");
  ok(r.notes.some((n) => /Replaced Data with RectangleData/.test(n)), "note recorded");
});
test("adapt records a TODO when a rename target is not present", () => {
  const r = C.adapt(genVm, "csharp", C.deriveTarget("RectangleUI"),
    { renames: [{ from: "Nonexistent", to: "Whatever" }] });
  ok(r.todos.some((t) => /Nonexistent/.test(t)), "missing rename surfaced");
});
test("adapt with no target asks for one instead of throwing", () => {
  const r = C.adapt(genVm, "csharp", null);
  ok(typeof r.text === "string", "still returns text");
  ok(r.todos.some((t) => /type its name|paste one of its files/.test(t)), "asks for the project");
});

/* ---------- guessLang + example ---------- */
test("guessLang distinguishes axaml from C#", () => {
  eq(C.guessLang(genAxaml), "xml");
  eq(C.guessLang(genVm), "csharp");
});
test("example round-trips: its generated code adapts cleanly to its target", () => {
  const ex = C.example();
  const r = C.adapt(ex.generated, "csharp", C.deriveTarget(ex.projectName));
  ok(r.text.indexOf("ExamApp") === -1, "example fully renamed");
  ok(/namespace RectangleUI\.ViewModels;/.test(r.text), "example VM namespace correct");
});
