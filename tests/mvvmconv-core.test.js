"use strict";
/* MVVM Converter core: the forward direction (CodeBehind -> MVVM) is the exam
   path and must produce a clean, allowed-libraries-only View + ViewModel from the
   CircleCodeBehind project. The reverse is a study-aid scaffold and only needs to
   stay valid (no duplicate x:Name, MVVM-only bits stripped). */
const { test, ok, eq, xmlBalanced } = require("./t.js");
const C = require("../data/mvvmconv-core.js");

const ex = C.example();
const fwd = C.toMvvm(ex.axaml, ex.codeBehind);
const vm = fwd.viewModel;
const view = fwd.view;

test("example() returns a non-empty CircleCodeBehind project", () => {
  ok(ex.axaml && /Ellipse/.test(ex.axaml), "axaml has the Ellipse");
  ok(ex.codeBehind && /SizeSlider\.ValueChanged/.test(ex.codeBehind), "code-behind has the slider handler");
});

test("ViewModel: slider becomes an [ObservableProperty] double Size = 50", () => {
  ok(/\[ObservableProperty\]\s*private\s+double\s+_size\s*=\s*50;/.test(vm), "Size property");
});

test("ViewModel: combo becomes Colors list + SelectedColor + the 5 colors", () => {
  ok(/public\s+List<string>\s+Colors\s*\{\s*get;\s*\}\s*=\s*new\(\)/.test(vm), "Colors list");
  ["Green", "Red", "Blue", "Purple", "Black"].forEach((c) =>
    ok(vm.indexOf('"' + c + '"') !== -1, "color " + c));
  ok(/_selectedColor\s*=\s*"Green"/.test(vm), "SelectedColor defaults to Green");
});

test("ViewModel: color string -> derived IBrush via OnSelectedColorChanged", () => {
  ok(/IBrush\s+_circleFill\s*=\s*Brush\.Parse\("Green"\)/.test(vm), "CircleFill brush property");
  ok(/partial void OnSelectedColorChanged\(string value\)\s*=>\s*CircleFill = Brush\.Parse\(value\);/.test(vm), "OnChanged bridge");
});

test("ViewModel: Reset button becomes a [RelayCommand] setting Size = 100", () => {
  ok(/\[RelayCommand\]/.test(vm), "has RelayCommand");
  ok(/void Reset\(\)\s*=>\s*Size = 100;/.test(vm), "Reset sets Size = 100");
});

test("ViewModel uses only allowed libraries (System / Avalonia / CommunityToolkit)", () => {
  const usings = (vm.match(/^using .+;$/gm) || []);
  ok(usings.length >= 3, "has using directives");
  usings.forEach((u) =>
    ok(/^using (System|Avalonia|CommunityToolkit)\b/.test(u), "foreign using: " + u));
});

test("ViewModel is a ViewModel, not a view (no x:Name / InitializeComponent)", () => {
  ok(vm.indexOf("x:Name") === -1, "no x:Name in VM");
  ok(vm.indexOf("InitializeComponent") === -1, "no InitializeComponent in VM");
  ok(/class MainWindowViewModel : ObservableObject/.test(vm), "derives ObservableObject");
});

test("View: every control is data-bound, with the vm namespace on the root", () => {
  ['Value="{Binding Size}"', 'Width="{Binding Size}"', 'Height="{Binding Size}"',
   'Fill="{Binding CircleFill}"', 'ItemsSource="{Binding Colors}"',
   'SelectedItem="{Binding SelectedColor}"', 'Command="{Binding ResetCommand}"',
   'Text="{Binding Size}"'].forEach((frag) =>
    ok(view.indexOf(frag) !== -1, "view missing binding: " + frag));
  ok(/xmlns:vm="using:ExamApp\.ViewModels"/.test(view), "vm namespace");
  ok(/x:DataType="vm:MainWindowViewModel"/.test(view), "x:DataType");
  ok(/x:Class="ExamApp\.Views\.MainWindow"/.test(view), "view class renamespaced");
});

test("View has no leftover x:Name or fixed literals that fight the bindings", () => {
  ok(view.indexOf("x:Name") === -1, "all x:Name stripped");
  ok(view.indexOf('Fill="green"') === -1, "old literal Fill replaced");
  ok(view.indexOf('SelectedIndex') === -1, "SelectedIndex dropped (SelectedItem bound instead)");
});

test("the example converts with zero TODOs (fully mapped)", () => {
  eq(fwd.todos.length, 0, "todos: " + JSON.stringify(fwd.todos));
  ok(fwd.notes.length >= 5, "has explanatory notes");
});

test("an unrecognised Click body is preserved as a TODO, not dropped", () => {
  const cb =
    'public partial class MainWindow : Window {\n' +
    '  public MainWindow() {\n' +
    '    InitializeComponent();\n' +
    '    SaveButton.Click += (_, _) => { DoSomethingWeird(); };\n' +
    '  }\n}';
  const axaml = '<Window x:Class="X.MainWindow"><StackPanel><Button x:Name="SaveButton">Save</Button></StackPanel></Window>';
  const r = C.toMvvm(axaml, cb);
  ok(/\[RelayCommand\][\s\S]*void Save\(\)/.test(r.viewModel), "Save command generated");
  ok(/TODO/.test(r.viewModel), "unmapped body kept as TODO in the command");
  ok(r.todos.length >= 1, "todo surfaced to the user");
});

test("empty input does not throw and yields no result files", () => {
  const r = C.toMvvm("", "");
  ok(r && Array.isArray(r.notes), "returns a shape");
  // view/viewModel are still strings (skeleton), never undefined
  ok(typeof r.view === "string" && typeof r.viewModel === "string", "string outputs");
});

/* mvvmconv-1: the bound View must explain who sets the DataContext (the provided
   project, not these two submitted files) and emit a previewer-only Design.DataContext
   block for designer/asynclab parity — WITHOUT setting a runtime DataContext attribute. */
test("View emits a previewer-only Design.DataContext + a DataContext note (mvvmconv-1)", () => {
  ok(/<Design\.DataContext>/.test(view), "Design.DataContext block present");
  ok(/<vm:MainWindowViewModel\s*\/>/.test(view), "previewer VM instance inside the block");
  ok(/xmlns:d="http:\/\/schemas\.microsoft\.com\/expression\/blend\/2008"/.test(view), "blend namespace for Design.*");
  // contract: NEVER a runtime DataContext attribute on the submitted axaml
  ok(view.indexOf('DataContext="') === -1, "no runtime DataContext attribute set in the view");
  xmlBalanced(view);
  ok(fwd.notes.some((n) => /DataContext/.test(n) && /provided project|App\.axaml\.cs/.test(n)),
     "a note points the student at the provided project for the runtime DataContext");
});

/* mvvmconv-2: an object-typed ItemsSource (List<Recipe>) must keep its element type
   instead of being silently forced to List<string> with a string SelectedItem. */
test("object-typed ItemsSource keeps its element type, not forced to string (mvvmconv-2)", () => {
  const axaml = '<Window x:Class="X.MainWindow"><StackPanel><ListBox x:Name="RecipeList"></ListBox></StackPanel></Window>';
  const cb =
    'public partial class MainWindow : Window {\n' +
    '  public List<Recipe> recipes = new(){};\n' +
    '  public MainWindow() {\n' +
    '    InitializeComponent();\n' +
    '    RecipeList.ItemsSource = recipes;\n' +
    '    RecipeList.SelectionChanged += (_, _) => { var x = RecipeList.SelectedItem; };\n' +
    '  }\n}';
  const r = C.toMvvm(axaml, cb);
  ok(/public\s+List<Recipe>\s+Recipes/.test(r.viewModel), "list keeps List<Recipe>, not List<string>");
  ok(/Recipe\?\s+_selectedRecipe/.test(r.viewModel), "SelectedItem typed Recipe?, not string");
  ok(r.viewModel.indexOf("List<string>") === -1, "no silently-wrong List<string>");
  ok(r.todos.some((t) => /Recipe/.test(t)), "unknown element type surfaced as a TODO");
});

/* mvvmconv-3: a bare ListBox/ComboBox with no SelectedItem usage must NOT get a
   forced SelectedItem property + binding. */
test("bare ListBox without SelectedItem usage gets no forced SelectedItem (mvvmconv-3)", () => {
  const axaml = '<Window x:Class="X.MainWindow"><StackPanel><ListBox x:Name="PlainList"></ListBox></StackPanel></Window>';
  const cb = 'public partial class MainWindow : Window { public MainWindow() { InitializeComponent(); } }';
  const r = C.toMvvm(axaml, cb);
  ok(r.view.indexOf("SelectedItem=") === -1, "no SelectedItem binding when unused");
  ok(r.viewModel.indexOf("_selectedPlain") === -1, "no SelectedPlain property when unused");
});

test("SelectedItem IS added when actually used (binding present) (mvvmconv-3)", () => {
  const axaml = '<Window x:Class="X.MainWindow"><StackPanel><ListBox x:Name="UsedList"></ListBox></StackPanel></Window>';
  const cb =
    'public partial class MainWindow : Window { public MainWindow() { InitializeComponent();' +
    ' UsedList.SelectionChanged += (_, _) => { var x = UsedList.SelectedItem; }; } }';
  const r = C.toMvvm(axaml, cb);
  ok(/SelectedItem="\{Binding SelectedUsed\}"/.test(r.view), "SelectedItem bound when used");
});

/* mvvmconv-4: a ListBox named RecipeList must yield SelectedRecipe, not SelectedRecipeList. */
test("List/View suffix stripped for list controls so names read well (mvvmconv-4)", () => {
  const axaml = '<Window x:Class="X.MainWindow"><StackPanel><ListBox x:Name="RecipeList"></ListBox></StackPanel></Window>';
  const cb =
    'public partial class MainWindow : Window { public MainWindow() { InitializeComponent();' +
    ' RecipeList.SelectionChanged += (_, _) => { var x = RecipeList.SelectedItem; }; } }';
  const r = C.toMvvm(axaml, cb);
  ok(/_selectedRecipe\b/.test(r.viewModel), "yields SelectedRecipe");
  ok(r.viewModel.indexOf("SelectedRecipeList") === -1, "not the awkward SelectedRecipeList");
  // non-list controls keep their existing naming (List/View only stripped for lists)
  eq(C.propName("RecipeList"), "RecipeList", "plain propName leaves List on (non-list control)");
  eq(C.propName("RecipeList", true), "Recipe", "list-aware propName strips List");
});

test("reverse (MVVM -> CodeBehind) stays valid: unique x:Name, vm bits stripped, code-behind shell", () => {
  const rev = C.toCodeBehind(fwd.view, fwd.viewModel);
  ok(/InitializeComponent\(\);/.test(rev.codeBehind), "code-behind calls InitializeComponent");
  ok(/: Window/.test(rev.codeBehind), "is a Window code-behind");
  ok(rev.view.indexOf("{Binding") === -1, "bindings stripped from the view");
  ok(rev.view.indexOf("xmlns:vm") === -1, "vm namespace removed");
  // no duplicate x:Name values
  const names = (rev.view.match(/x:Name="([^"]+)"/g) || []);
  eq(names.length, new Set(names).size, "x:Name values are unique: " + names.join(", "));
});
