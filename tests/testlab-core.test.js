"use strict";
const { test, eq, ok, includes, notIncludes, xmlBalanced } = require("./t.js");
const C = require("../data/testlab-core.js");

/* ---------- helpers ---------- */

/* brace-balance over C# source with literals/comments stripped so braces
   inside "{" strings or // comments are ignored. Throws on imbalance. */
function braceBalanced(code) {
  const s = C.stripForScan(code);
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") d++;
    else if (s[i] === "}") { d--; if (d < 0) throw new Error("braceBalanced: extra } at " + i); }
  }
  if (d !== 0) throw new Error("braceBalanced: unbalanced, depth " + d);
  return true;
}
/* same for parentheses */
function parenBalanced(code) {
  const s = C.stripForScan(code);
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") d++;
    else if (s[i] === ")") { d--; if (d < 0) throw new Error("parenBalanced: extra ) at " + i); }
  }
  if (d !== 0) throw new Error("parenBalanced: unbalanced, depth " + d);
  return true;
}

const COUNTER_VM = `
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace ExamApp.ViewModels;

public partial class CounterViewModel : ObservableObject
{
    [ObservableProperty]
    private int count;

    private bool _running;

    [RelayCommand]
    private async Task Start()
    {
        _running = true;
        while (_running) { Count++; await Task.Delay(100); }
    }

    [RelayCommand]
    private void Stop() => _running = false;

    [RelayCommand]
    private void Reset() { _running = false; Count = 0; }
}
`;

const SERVICE = `
public interface IRepo { void Save(string id); int Count(); bool Exists(string id); }

public class OrderService
{
    private readonly IRepo _repo;
    public OrderService(IRepo repo) { _repo = repo; }

    public bool IsValid(int amount) => amount > 0;
    public int Total(int a, int b) => a + b;
    public string Describe() => "order";
    public List<string> AllNames() => new();
    public void Process(string name) { _repo.Save(name); }
}
`;

function parse(text, name) { return C.parse([{ name: name || "Test.cs", text }]); }

/* ============ parser: toolkit ViewModel ============ */
test("parser: toolkit VM -> class, command names, generated property, async flag", () => {
  const m = parse(COUNTER_VM, "CounterViewModel.cs");
  eq(m.classes.length, 1);
  const c = m.classes[0];
  eq(c.name, "CounterViewModel");
  ok(c.isToolkitViewModel, "should detect toolkit VM");
  ok(c.usesObservableProperty, "should detect [ObservableProperty]");
  ok(c.usesRelayCommand, "should detect [RelayCommand]");
  /* generated property Count from `private int count` */
  ok(c.observableProps.some((p) => p.property === "Count" && p.field === "count" && p.type === "int"),
    "Count property must be generated from count field");
  /* command members */
  const cmds = c.commands.map((x) => x.command);
  includes(cmds.join(","), "StartCommand");
  includes(cmds.join(","), "StopCommand");
  includes(cmds.join(","), "ResetCommand");
  /* Start is async */
  ok(c.commands.find((x) => x.method === "Start").isAsync, "Start must be async");
  ok(!c.commands.find((x) => x.method === "Stop").isAsync, "Stop must be sync");
  ok(m.usesToolkit, "model.usesToolkit must be true");
});

/* ============ parser: plain service class ============ */
test("parser: service class -> ctor interface, methods, params, return types", () => {
  const m = parse(SERVICE, "OrderService.cs");
  const c = m.classes.find((x) => x.name === "OrderService");
  ok(c, "OrderService parsed");
  eq(c.isToolkitViewModel, false);
  /* ctor interface param flagged */
  eq(c.ctorParams.length, 1);
  eq(c.ctorParams[0].type, "IRepo");
  ok(c.ctorParams[0].isInterface, "IRepo must be flagged as interface");
  ok(c.ctorParams[0].knownInterface, "IRepo source pasted -> known");
  /* methods */
  const names = c.methods.map((x) => x.name);
  ["IsValid", "Total", "Describe", "AllNames", "Process"].forEach((n) => includes(names.join(","), n));
  /* return categories */
  eq(C.returnCategory(c.methods.find((x) => x.name === "IsValid").returnType), "bool");
  eq(C.returnCategory(c.methods.find((x) => x.name === "Total").returnType), "numeric");
  eq(C.returnCategory(c.methods.find((x) => x.name === "Describe").returnType), "string");
  eq(C.returnCategory(c.methods.find((x) => x.name === "AllNames").returnType), "collection");
  eq(C.returnCategory(c.methods.find((x) => x.name === "Process").returnType), "void");
  /* Total has two int params */
  eq(c.methods.find((x) => x.name === "Total").params.length, 2);
});

/* ============ command-name rules ============ */
test("commandName strips Async suffix and appends Command", () => {
  eq(C.commandName("Start"), "StartCommand");
  eq(C.commandName("LoadAsync"), "LoadCommand");
  eq(C.commandName("save"), "SaveCommand");
});

/* ============ generator: plain xUnit ============ */
test("plain generator: [Fact], naming, usings, namespace, balanced", () => {
  const m = parse(SERVICE);
  const file = C.genPlain(m.classes.find((x) => x.name === "OrderService"));
  eq(file.fileName, "OrderServiceTests.cs");
  const code = file.code;
  includes(code, "namespace ExamApp.Tests;");
  includes(code, "using Xunit;");
  includes(code, "[Fact]");
  includes(code, "public class OrderServiceTests");
  /* Method_Scenario_Expected naming convention */
  ok(/public void \w+_\w+_\w+\(/.test(code), "method names must follow Method_Scenario_Expected");
  /* collection method gets NotNull + NotEmpty */
  includes(code, "Assert.NotNull(result)");
  includes(code, "Assert.NotEmpty(result)");
  braceBalanced(code);
  parenBalanced(code);
});

test("plain generator: bool-returning method gets an Assert.True AND Assert.False fact (a pair)", () => {
  const m = parse(SERVICE);
  const code = C.genPlain(m.classes.find((x) => x.name === "OrderService")).code;
  /* IsValid returns bool -> the spec wants a True/False pair, not one tautology */
  includes(code, "Assert.True(result);");
  includes(code, "Assert.False(result);");
  notIncludes(code, "Assert.True(result || !result)", "no tautological bool assert");
  /* two distinct facts, named for the outcome */
  includes(code, "IsValid_WhenConditionHolds_ReturnsTrue");
  includes(code, "IsValid_WhenConditionFails_ReturnsFalse");
  braceBalanced(code);
  parenBalanced(code);
});

test("plain generator: theory with InlineData for primitive-param method", () => {
  const m = parse(SERVICE);
  const code = C.genPlain(m.classes.find((x) => x.name === "OrderService")).code;
  includes(code, "[Theory]");
  includes(code, "[InlineData(");
  /* edge values present: 0 and -1 for int */
  includes(code, "[InlineData(0)]");
  includes(code, "[InlineData(-1)]");
  /* Theory must precede its InlineData rows (xUnit requirement) */
  const ti = code.indexOf("[Theory]");
  const ii = code.indexOf("[InlineData(0)]");
  ok(ti !== -1 && ii !== -1 && ti < ii, "[Theory] must appear before [InlineData]");
});

test("plain generator: fake class emitted for interface ctor param (real impl when source pasted)", () => {
  const m = parse(SERVICE);
  const code = C.genPlain(m.classes.find((x) => x.name === "OrderService")).code;
  includes(code, "new FakeRepo()");
  includes(code, "private sealed class FakeRepo : IRepo");
  /* implemented for real: members from the pasted interface present */
  includes(code, "public void Save(string id)");
  includes(code, "public int Count()");
  includes(code, "public bool Exists(string id)");
  notIncludes(code, "interface source not pasted");
});

test("plain generator: unknown interface emits TODO fake, not real members", () => {
  const m = parse(`public class Svc { private readonly IThing _t; public Svc(IThing t) { _t = t; } public void Go() {} }`);
  const code = C.genPlain(m.classes[0]).code;
  includes(code, "private sealed class FakeThing : IThing");
  includes(code, "// TODO: implement members of IThing (interface source not pasted)");
  braceBalanced(code);
});

/* ============ generator: ViewModel mode ============ */
test("VM mode: command execute lines + PropertyChanged capture present", () => {
  const m = parse(COUNTER_VM);
  const file = C.genViewModel(m.classes[0]);
  const code = file.code;
  includes(code, "namespace ExamApp.Tests;");
  /* command execution */
  includes(code, "vm.StopCommand.Execute(null);");
  includes(code, "vm.StartCommand.ExecuteAsync(null);");
  /* PropertyChanged capture helper */
  includes(code, "vm.PropertyChanged += (_, e) => changed.Add(e.PropertyName");
  includes(code, 'Assert.Contains("Count", changed)');
  braceBalanced(code);
  parenBalanced(code);
});

test("VM mode: CanExecute test emitted when [RelayCommand(CanExecute=...)] present", () => {
  const vm = `
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
namespace ExamApp.ViewModels;
public partial class TodoViewModel : ObservableObject
{
    [ObservableProperty] private string? newItem;
    [RelayCommand(CanExecute = nameof(CanAdd))]
    private void Add() { }
    private bool CanAdd() => !string.IsNullOrWhiteSpace(NewItem);
}`;
  const m = parse(vm);
  const c = m.classes[0];
  ok(c.commands[0].canExecute === "CanAdd", "CanExecute name parsed");
  const code = C.genViewModel(c).code;
  includes(code, "CanExecute(null)");
  includes(code, "Assert.False(vm.AddCommand.CanExecute(null))");
  braceBalanced(code);
});

/* ---- regression: VM-mode looping start must never AWAIT its unbounded loop ----
   The exported dotnet test hung forever because genViewModel emitted
   `await vm.StartCommand.ExecuteAsync(null);` for the counter VM's looping Start.
   The VM's Start runs `while (_running) { ...; await Task.Delay(...); }` and nothing
   sets `_running = false`, so the await never completes and the test host never
   exits (testhost killed by the watchdog after 12 minutes). VM-mode must use the
   same fire-and-stop pattern the per-function generator already uses: fire the
   looping start WITHOUT awaiting it, let it tick, then execute its stop-style
   command in the SAME test method. */
test("VM mode: looping Start is fire-and-forget then stopped, never awaited (no test-host hang)", () => {
  const m = parse(COUNTER_VM);
  const code = C.genViewModel(m.classes[0]).code;
  /* the bug exactly: an AWAITED looping start must NEVER appear anywhere */
  notIncludes(code, "await vm.StartCommand.ExecuteAsync(null)",
    "awaiting the looping Start would block until Stop and hang the test host");
  /* it IS fired-and-forgotten and then stopped within the same method */
  includes(code, "_ = vm.StartCommand.ExecuteAsync(null)");
  includes(code, "await Task.Delay(150); // let the loop tick at least once");
  includes(code, "vm.StopCommand.Execute(null); // stop the loop so it cannot leak");
  /* the Start test method becomes async Task so the fire/delay/stop can await */
  includes(code, "public async Task StartCommand_WhenExecuted_");
  /* the Tasks using is present so the awaits compile */
  includes(code, "using System.Threading.Tasks;");
  braceBalanced(code);
  parenBalanced(code);
});

test("VM mode: looping Start with NO stop-style command is not fired (guarded comment, not a leak)", () => {
  /* a VM whose only command is a looping Start and there is no Stop/Pause/etc.:
     VM-mode must NOT fire the unbounded loop (it would hang); it emits a guarded
     note instead of ever calling ExecuteAsync on it. */
  const vm = `
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
namespace ExamApp.ViewModels;
public partial class RunnerViewModel : ObservableObject
{
    [ObservableProperty] private int count;
    [RelayCommand]
    private async Task Start() { while (true) { Count++; await Task.Delay(100); } }
}`;
  const m = parse(vm, "RunnerViewModel.cs");
  const code = C.genViewModel(m.classes[0]).code;
  /* the loop is NEVER fired (no ExecuteAsync call at all) */
  notIncludes(code, "vm.StartCommand.ExecuteAsync(null)",
    "a looping start with no breaker must not be fired in VM mode");
  /* a guarded comment explains why it is not driven here */
  includes(code, "runs an unbounded loop and the VM exposes no");
  braceBalanced(code);
  parenBalanced(code);
});

test("VM mode: a non-looping async command keeps its await unchanged", () => {
  /* an async [RelayCommand] that is NOT a Start/Resume/Run/Begin loop must still
     be awaited normally — the fire-and-stop change only targets looping starts. */
  const vm = `
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
namespace ExamApp.ViewModels;
public partial class LoaderViewModel : ObservableObject
{
    [ObservableProperty] private int count;
    [RelayCommand]
    private async Task Load() { Count = await Task.FromResult(1); }
}`;
  const m = parse(vm, "LoaderViewModel.cs");
  const c = m.classes[0];
  ok(c.commands.find((x) => x.method === "Load").isAsync, "Load is async");
  const code = C.genViewModel(c).code;
  /* a plain async command is awaited normally */
  includes(code, "await vm.LoadCommand.ExecuteAsync(null);");
  includes(code, "public async Task LoadCommand_WhenExecuted_");
  /* and it is NOT treated as a fire-and-forget loop */
  notIncludes(code, "_ = vm.LoadCommand.ExecuteAsync(null)");
  braceBalanced(code);
  parenBalanced(code);
});

/* ============ generator: async ============ */
test("async generator: timing-tolerant InRange + stop/reset sequence + rationale", () => {
  const m = parse(COUNTER_VM);
  const code = C.genAsync(m.classes[0]).code;
  includes(code, "await Task.Delay(350)");
  includes(code, "Assert.InRange(vm.Count, 2, 4)");
  includes(code, "vm.ResetCommand.Execute(null);");
  includes(code, "Assert.Equal(0, vm.Count)");
  /* fire-and-forget for the looping start command (must NOT await it) */
  includes(code, "_ = vm.StartCommand.ExecuteAsync(null)");
  /* rationale comment block present */
  includes(code, "timing-tolerant");
  braceBalanced(code);
  parenBalanced(code);
});

/* ============ generator: headless ============ */
test("headless: TestAppBuilder + AvaloniaFact present, structure matches starter kit", () => {
  const files = C.genHeadless({ viewModel: "CounterViewModel", window: "MainWindow", command: "StartCommand" });
  const builder = files.find((f) => f.fileName === "TestAppBuilder.cs").code;
  const ui = files.find((f) => f.fileName === "HeadlessUiTests.cs").code;
  includes(builder, "[assembly: AvaloniaTestApplication(typeof(TestAppBuilder))]");
  includes(builder, "AppBuilder.Configure<App>()");
  includes(builder, ".UseHeadless(new AvaloniaHeadlessPlatformOptions());");
  includes(ui, "[AvaloniaFact]");
  includes(ui, "window.Show();");
  includes(ui, "for (var i = 0; i < 100; i++)");
  braceBalanced(builder);
  braceBalanced(ui);
  parenBalanced(ui);
});

/* ---- G1: headless test must find + click the real control, not call the VM ----
   The rubric rewards locating and clicking the Button and asserting the bound
   TextBlock, not bypassing the UI with vm.SomeCommand.Execute(null). */
test("G1 headless: finds Button + TextBlock, asserts non-null, clicks via Command, asserts text", () => {
  const ui = C.genHeadless({ viewModel: "CounterViewModel", command: "StartCommand" })
    .find((f) => f.fileName === "HeadlessUiTests.cs").code;
  /* the real controls are located and asserted non-null */
  includes(ui, 'window.FindControl<Button>(');
  includes(ui, 'window.FindControl<TextBlock>(');
  includes(ui, "Assert.NotNull(button);");
  includes(ui, "Assert.NotNull(text);");
  /* the button is clicked through its bound Command (a click, fire-and-stop) */
  includes(ui, "button!.Command?.Execute(button.CommandParameter);");
  /* the bound TextBlock text is what gets asserted */
  includes(ui, "text!.Text");
  /* the old VM-bypass pattern is GONE: never call vm.<cmd>.Execute(null) here */
  notIncludes(ui, "vm.StartCommand.Execute(null)",
    "headless must click the control, not call the VM command directly");
  /* never AWAIT a command in the headless click loop (would block the host) */
  notIncludes(ui, "ExecuteAsync", "no awaited command in the headless click loop");
  /* Xunit is imported so Assert resolves */
  includes(ui, "using Xunit;");
  braceBalanced(ui);
  parenBalanced(ui);
});

test("G1 headless: parsed control names are stamped through; absent names get a marked placeholder", () => {
  /* names known (from a parsed view): used verbatim, no placeholder TODO */
  const named = C.genHeadless({ viewModel: "CounterViewModel", buttonName: "IncrementButton", textName: "CountText" })
    .find((f) => f.fileName === "HeadlessUiTests.cs").code;
  includes(named, 'window.FindControl<Button>("IncrementButton")');
  includes(named, 'window.FindControl<TextBlock>("CountText")');
  includes(named, "Control names taken from the parsed view");
  notIncludes(named, "TODO: rename", "no rename TODO when names are known");
  /* names unknown: a clearly-marked placeholder the student edits */
  const placeholder = C.genHeadless({ viewModel: "CounterViewModel" })
    .find((f) => f.fileName === "HeadlessUiTests.cs").code;
  includes(placeholder, "TODO: rename");
  includes(placeholder, 'window.FindControl<Button>("ClickButton")');
  braceBalanced(named);
  braceBalanced(placeholder);
});

/* ---- G9: target namespace, view-class default, ProjectReference path ---- */
test("G9 headless: targetNamespace + viewClass options stamp through; default view class is MainWindow", () => {
  const def = C.genHeadless({ viewModel: "BoardViewModel" })
    .find((f) => f.fileName === "HeadlessUiTests.cs").code;
  /* default view class is MainWindow, NOT derived by stripping "ViewModel" */
  includes(def, "new MainWindow { DataContext = vm };");
  notIncludes(def, "new Board {", "view class must default to MainWindow, not <stripped VM>");
  /* options thread a real target namespace + view class through */
  const files = C.genHeadless({
    viewModel: "BoardViewModel", viewClass: "GameWindow", targetNamespace: "SpaceGame",
  });
  const ui = files.find((f) => f.fileName === "HeadlessUiTests.cs").code;
  const builder = files.find((f) => f.fileName === "TestAppBuilder.cs").code;
  includes(ui, "namespace SpaceGame.Tests;");
  includes(ui, "using SpaceGame.ViewModels;");
  includes(ui, "using SpaceGame.Views;");
  includes(ui, "new GameWindow { DataContext = vm };");
  includes(builder, "using SpaceGame;");
  braceBalanced(ui);
  braceBalanced(builder);
});

test("G9 headless: default output is byte-for-byte unchanged except the view-class default", () => {
  /* with no options the namespace defaults to ExamApp(.Tests) exactly as before */
  const ui = C.genHeadless({ viewModel: "MainWindowViewModel" })
    .find((f) => f.fileName === "HeadlessUiTests.cs").code;
  includes(ui, "namespace ExamApp.Tests;");
  includes(ui, "using ExamApp.ViewModels;");
  includes(ui, "using ExamApp.Views;");
  includes(ui, "new MainWindow { DataContext = vm };");
});

test("G9 csproj: ProjectReference path is an option, default unchanged", () => {
  /* default path byte-for-byte unchanged */
  includes(C.genCsproj().code, '<ProjectReference Include="..\\ExamApp\\ExamApp.csproj" />');
  /* a custom path stamps through so the test project references the real project */
  const custom = C.genCsproj({ projectReference: "..\\SpaceGame\\SpaceGame.csproj" }).code;
  includes(custom, '<ProjectReference Include="..\\SpaceGame\\SpaceGame.csproj" />');
  notIncludes(custom, "ExamApp.csproj", "the default ref must be replaced, not duplicated");
});

test("G9 generate(): headless file uses MainWindow (not the VM stripped of ViewModel)", () => {
  const m = parse(COUNTER_VM, "CounterViewModel.cs");
  const files = C.generate(m, { headless: true });
  const ui = files.find((f) => f.fileName === "HeadlessUiTests.cs").code;
  /* the historic bug emitted `new Counter { ... }` (no such window type) */
  notIncludes(ui, "new Counter {", "must not derive the window name by stripping ViewModel");
  includes(ui, "new MainWindow { DataContext = vm };");
  /* the VM is still the parsed one */
  includes(ui, "new CounterViewModel();");
  braceBalanced(ui);
});

/* ============ generator: csproj ============ */
test("csproj: exact verified versions, xml balanced", () => {
  const code = C.genCsproj().code;
  includes(code, "<TargetFramework>net9.0</TargetFramework>");
  includes(code, '<PackageReference Include="coverlet.collector" Version="6.0.4" />');
  includes(code, '<PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />');
  includes(code, '<PackageReference Include="xunit" Version="2.9.3" />');
  includes(code, '<PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />');
  includes(code, '<PackageReference Include="Avalonia.Headless.XUnit" Version="11.2.1" />');
  includes(code, '<ProjectReference Include="..\\ExamApp\\ExamApp.csproj" />');
  xmlBalanced(code);
});

/* ============ top-level generate ============ */
test("generate: counter VM yields VM + async + headless + csproj + runbook files", () => {
  const m = parse(COUNTER_VM);
  const files = C.generate(m, { plain: true, viewModel: true, headless: true, async: true, csproj: true });
  const names = files.map((f) => f.fileName);
  includes(names.join(","), "CounterViewModelTests.cs");
  includes(names.join(","), "CounterViewModelAsyncTests.cs");
  includes(names.join(","), "TestAppBuilder.cs");
  includes(names.join(","), "HeadlessUiTests.cs");
  includes(names.join(","), "ExamApp.Tests.csproj");
  includes(names.join(","), "RUNBOOK.txt");
  /* every generated C# file is brace-balanced */
  files.filter((f) => /\.cs$/.test(f.fileName)).forEach((f) => braceBalanced(f.code));
});

test("generate: option toggles select which files are produced", () => {
  const m = parse(SERVICE);
  const onlyPlain = C.generate(m, { plain: true, viewModel: false, headless: false, async: false, csproj: false });
  eq(onlyPlain.length, 1);
  eq(onlyPlain[0].fileName, "OrderServiceTests.cs");
});

/* ============ robustness ============ */
test("garbage input does not throw and returns empty model", () => {
  const m = C.parse([{ name: "x.cs", text: "}}}{{{ class ;;; %%% public void" }]);
  ok(Array.isArray(m.classes), "classes array present");
  /* generate must not throw on the garbage model */
  const files = C.generate(m, { plain: true, viewModel: true, headless: false, async: false, csproj: false });
  ok(Array.isArray(files), "files array present");
});
test("empty input -> empty classes", () => {
  eq(C.parse([]).classes.length, 0);
  eq(C.parse([{ name: "e.cs", text: "" }]).classes.length, 0);
});

/* ============ UI module loads under Node + escapes HTML ============ */
test("testlab.js never touches document at load time (only inside functions)", () => {
  const fs = require("fs");
  const src = fs.readFileSync(__dirname + "/../data/testlab.js", "utf8");
  const topLevel = src.replace(/function[\s\S]*?\n\}/g, "");
  ok(topLevel.indexOf("document.") === -1, "document.* found at top level");
});

test("testlab UI module loads under Node and exposes render/init", () => {
  global.window = global;
  require("../data/testlab-core.js");
  require("../data/testlab.js");
  ok(typeof global.TESTLAB.render === "function", "TESTLAB.render missing");
  ok(typeof global.TESTLAB.init === "function", "TESTLAB.init missing");
  ok(global.TL && typeof global.TL.generate === "function", "handlers must live on window.TL");
  ok(typeof global.TL.loadExample === "function", "TL.loadExample missing");
  ok(typeof global.TL.setMode === "function", "TL.setMode missing");
});

test("rendered output escapes HTML in generated code (XSS-safe)", () => {
  /* minimal DOM + storage so the UI's generate->render path runs under Node */
  const els = {};
  global.window = global;
  global.localStorage = {
    _d: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
  };
  global.document = {
    getElementById(id) { return els[id] || (els[id] = { innerHTML: "", textContent: "" }); },
  };
  require("../data/testlab-core.js");
  const TL = require("../data/testlab.js");
  /* render builds the page and registers the output container */
  const page = global.TESTLAB.render();
  ok(page.indexOf("TEST LAB") !== -1, "render produced page");
  /* paste code whose class name carries an XSS payload, then generate */
  global.TL.edit('public class Pwn<script>alert(1)</script> { public void Go() {} }');
  global.TL.generate();
  const out = els["tl-output"].innerHTML;
  ok(out.length > 0, "output rendered");
  notIncludes(out, "<script>", "raw <script> must never reach innerHTML");
  includes(out, "&lt;", "angle brackets in generated code must be escaped");
});

/* ===================================================================== */
/* ============ Spec 09: function picker + P/N/E trios ================== */
/* ===================================================================== */

/* a representative service: string param, int param, collection return */
const TRIO_SERVICE = `
public class CatalogService
{
    public string Label(string code) => code;
    public int Score(int weight) => weight;
    public List<string> Find(string query) => new();
}
`;

/* ---- function picker model ---- */
test("picker: listFunctions yields stable Class.Method keys for methods and commands", () => {
  const m = parse(COUNTER_VM, "CounterViewModel.cs");
  const fns = C.listFunctions(m.classes[0]);
  const keys = fns.map((f) => f.key);
  includes(keys.join(","), "CounterViewModel.Start");
  includes(keys.join(","), "CounterViewModel.Stop");
  includes(keys.join(","), "CounterViewModel.Reset");
  /* commands are flagged and carry their generated command member name */
  const start = fns.find((f) => f.name === "Start");
  ok(start.isCommand, "Start is a command");
  ok(start.isAsync, "Start is async");
  includes(start.signature, "StartCommand");
  /* the key helper is the single source of truth for the key shape */
  eq(C.functionKey("CounterViewModel", "Start"), "CounterViewModel.Start");
});

test("picker: listAllFunctions spans classes and skips interfaces; plain methods listed", () => {
  const m = parse(TRIO_SERVICE, "CatalogService.cs");
  const fns = C.listAllFunctions(m);
  const names = fns.map((f) => f.name).sort().join(",");
  eq(names, "Find,Label,Score");
  fns.forEach((f) => ok(!f.isCommand, "service methods are not commands"));
  /* signatures are mono-friendly with the real return type */
  includes(fns.find((f) => f.name === "Find").signature, "List<string> Find(string query)");
});

test("picker: isSelected defaults to on; explicit false unchecks", () => {
  ok(C.isSelected(null, "A.b"), "no selection map -> selected");
  ok(C.isSelected({}, "A.b"), "absent key -> selected");
  ok(C.isSelected({ "A.b": true }, "A.b"), "true -> selected");
  eq(C.isSelected({ "A.b": false }, "A.b"), false);
});

test("picker: generation respects unchecked functions", () => {
  const m = parse(COUNTER_VM, "CounterViewModel.cs");
  /* uncheck everything except Start */
  const sel = {};
  C.listAllFunctions(m).forEach((f) => { if (f.name !== "Start") sel[f.key] = false; });
  const files = C.genPerFunction(m, sel);
  eq(files.length, 1);
  const code = files[0].code;
  includes(code, "===================== Start =====================");
  notIncludes(code, "===================== Stop =====================");
  notIncludes(code, "===================== Reset =====================");
  braceBalanced(code);
});

/* ---- P/N/E trio generation ---- */
test("trio: representative service emits region-labeled Positive/Negative/Edge per function", () => {
  const m = parse(TRIO_SERVICE, "CatalogService.cs");
  const code = C.genPerFunction(m, {})[0].code;
  /* region labels present */
  includes(code, "// --- Positive ---");
  includes(code, "// --- Negative ---");
  includes(code, "// --- Edge ---");
  /* positive happy-path Fact */
  includes(code, "[Fact]");
  includes(code, "_WithValidInput_");
  /* negative: null ref-param throw OR an out-of-range / TODO-choice comment */
  ok(/Assert\.Throws<ArgumentNullException>/.test(code), "ref-param negative uses Assert.Throws");
  ok(/if \w+ tolerates null, assert the fallback/.test(code), "TODO-choice comment present for null contract");
  braceBalanced(code);
  parenBalanced(code);
});

test("trio: edge [Theory] rows are type-aware (no string rows for int params)", () => {
  const m = parse(TRIO_SERVICE, "CatalogService.cs");
  const code = C.genPerFunction(m, {})[0].code;
  /* int param Score -> numeric boundary rows 0 / 1 / -1, never a quoted string */
  includes(code, "[InlineData(0)]");
  includes(code, "[InlineData(1)]");
  includes(code, "[InlineData(-1)]");
  /* the Score theory signature is int, and must not carry a string InlineData */
  const scoreBlock = code.slice(code.indexOf("Score_BoundaryValues_AreHandled") - 200,
    code.indexOf("Score_BoundaryValues_AreHandled") + 60);
  notIncludes(scoreBlock, '[InlineData("', "no string InlineData on an int-param theory");
  /* string param Label -> empty / whitespace / single-char rows, never a bare int */
  includes(code, '[InlineData("")]');
  includes(code, '[InlineData(" ")]');
});

test("trio: collection-returning method gets NotNull/NotEmpty positive assert", () => {
  const m = parse(TRIO_SERVICE, "CatalogService.cs");
  const code = C.genPerFunction(m, {})[0].code;
  includes(code, "Assert.NotNull(result);");
  includes(code, "Assert.NotEmpty(result)");
});

test("trio: mixed string+int edge theory type-checks each column independently", () => {
  const m = parse("public class Svc { public int F(string s, int n) => n; }", "Svc.cs");
  const code = C.genPerFunction(m, {})[0].code;
  /* rows must pair a quoted string with a bare int, e.g. [InlineData("", 0)] */
  ok(/\[InlineData\("(?:|\s|a)", -?\d+(?:\.\d+)?\)\]/.test(code), "rows pair string + numeric");
  braceBalanced(code);
  parenBalanced(code);
});

/* ---- counter VM wrong-state negative ---- */
test("trio: Counter Stop command gets a wrong-state (Stop-before-Start) negative", () => {
  const m = parse(COUNTER_VM, "CounterViewModel.cs");
  /* select only Stop */
  const sel = {};
  C.listAllFunctions(m).forEach((f) => { if (f.name !== "Stop") sel[f.key] = false; });
  const code = C.genPerFunction(m, sel)[0].code;
  includes(code, "// --- Negative ---");
  /* the negative is a Stop-before-Start no-op test */
  includes(code, "StopCommand_BeforeStart_IsNoOp");
  includes(code, "Stop before Start is a wrong-state call");
  /* it executes Stop (the command under test), not Start */
  includes(code, "vm.StopCommand.Execute(null);");
  includes(code, "Assert.Equal(0, vm.Count)");
  braceBalanced(code);
  parenBalanced(code);
});

test("trio: selecting only Start yields a compilable labeled trio (DoD scenario)", () => {
  const m = parse(COUNTER_VM, "CounterViewModel.cs");
  const sel = {};
  C.listAllFunctions(m).forEach((f) => { if (f.name !== "Start") sel[f.key] = false; });
  const code = C.genPerFunction(m, sel)[0].code;
  /* the looping Start command is fired without awaiting (no deadlock) */
  includes(code, "_ = vm.StartCommand.ExecuteAsync(null)");
  notIncludes(code, "await vm.StartCommand.ExecuteAsync(null)");
  /* all three regions present and braces/parens balanced */
  includes(code, "// --- Positive ---");
  includes(code, "// --- Negative ---");
  includes(code, "// --- Edge ---");
  braceBalanced(code);
  parenBalanced(code);
});

/* ---- regression: looping-start trio must never leak an unstopped loop ----
   The e2e dotnet-test of the exported project hung because the looping Start
   command's Positive and CalledTwice tests fired StartCommand.ExecuteAsync(null)
   but never stopped the infinite loop, so the orphaned loop kept the test host
   alive forever (fatal under the single-threaded Avalonia headless dispatcher
   that owns the whole assembly). Every fire of a looping start must be followed
   by a stop-style command, and the firing method must be `async Task`. */
test("trio: looping Start command stops its loop (no orphaned infinite loop leaks)", () => {
  const m = parse(COUNTER_VM, "CounterViewModel.cs");
  const sel = {};
  C.listAllFunctions(m).forEach((f) => { if (f.name !== "Start") sel[f.key] = false; });
  const code = C.genPerFunction(m, sel)[0].code;
  /* every fire of the looping start must be paired with a stop in the same trio */
  const fires = (code.match(/_ = vm\.StartCommand\.ExecuteAsync\(null\)/g) || []).length;
  const stops = (code.match(/vm\.StopCommand\.Execute\(null\); \/\/ stop the loop so it cannot leak/g) || []).length;
  ok(fires > 0, "the looping start is fired at least once");
  eq(stops, fires, "each looping-start fire is matched by a stop (no orphan loop)");
  /* a tick delay lets the loop run before it is stopped, so the assert is meaningful */
  includes(code, "await Task.Delay(150); // let the loop tick at least once");
  /* the methods that fire-and-stop the loop are async Task, never void */
  includes(code, "public async Task StartCommand_WhenExecuted_UpdatesState()");
  includes(code, "public async Task StartCommand_CalledTwice_RemainsConsistent()");
  /* still no AWAITED start (awaiting the unbounded loop would itself deadlock) */
  notIncludes(code, "await vm.StartCommand.ExecuteAsync(null)");
  /* the file carries the Tasks using so the awaits compile */
  includes(code, "using System.Threading.Tasks;");
  braceBalanced(code);
  parenBalanced(code);
});

test("trio: a looping Resume tested before Start also stops its loop, not leaks it", () => {
  /* a VM with an async looping Resume + a Stop: Resume-before-Start is a
     wrong-state negative that fires the Resume loop; it must be stopped too. */
  const vm = `
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
namespace ExamApp.ViewModels;
public partial class TimerViewModel : ObservableObject
{
    [ObservableProperty] private int count;
    private bool _running;
    [RelayCommand]
    private async Task Resume() { _running = true; while (_running) { Count++; await Task.Delay(100); } }
    [RelayCommand]
    private void Stop() => _running = false;
}`;
  const m = parse(vm, "TimerViewModel.cs");
  const sel = {};
  C.listAllFunctions(m).forEach((f) => { if (f.name !== "Resume") sel[f.key] = false; });
  const code = C.genPerFunction(m, sel)[0].code;
  /* the Resume-before-Start negative still fires Resume, but stops the loop */
  includes(code, "ResumeCommand.ExecuteAsync(null)");
  includes(code, "vm.StopCommand.Execute(null); // stop the loop so it cannot leak");
  /* no awaited unbounded loop */
  notIncludes(code, "await vm.ResumeCommand.ExecuteAsync(null)");
  braceBalanced(code);
  parenBalanced(code);
});

test("trio: looping start with NO stop-style command does not fire the loop (guarded comment)", () => {
  /* a VM whose only command is a looping Start and there is no Stop/Pause/etc.:
     we must NOT fire the unbounded loop (it would hang); emit a guarded note. */
  const vm = `
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
namespace ExamApp.ViewModels;
public partial class RunnerViewModel : ObservableObject
{
    [ObservableProperty] private int count;
    [RelayCommand]
    private async Task Start() { while (true) { Count++; await Task.Delay(100); } }
}`;
  const m = parse(vm, "RunnerViewModel.cs");
  const code = C.genPerFunction(m, {})[0].code;
  /* the loop is NOT fired (no ExecuteAsync), a guarded comment explains why */
  notIncludes(code, "vm.StartCommand.ExecuteAsync(null)");
  includes(code, "runs an unbounded loop and the VM exposes no");
  braceBalanced(code);
  parenBalanced(code);
});

/* ---- per-function trio extraction (copy-one) ---- */
test("genFunctionTrio: returns just one function's trio, balanced", () => {
  const m = parse(TRIO_SERVICE, "CatalogService.cs");
  const trio = C.genFunctionTrio(m, "CatalogService", "Label");
  ok(trio.indexOf("Label") !== -1, "trio names the function");
  notIncludes(trio, "Score", "trio is scoped to Label only");
  includes(trio, "// --- Positive ---");
  includes(trio, "// --- Negative ---");
  includes(trio, "// --- Edge ---");
  /* wrap as a class so the brace checker can validate the snippet */
  braceBalanced("class W {" + trio + "}");
  eq(C.genFunctionTrio(m, "Nope", "Nope"), "");
});

/* ---- per-function mode in top-level generate + brace balance ---- */
test("generate: perFunction mode produces one Tests.cs per class, all balanced", () => {
  const m = parse(COUNTER_VM + "\n" + TRIO_SERVICE);
  const files = C.generate(m, { perFunction: true, selection: {} });
  const names = files.map((f) => f.fileName);
  includes(names.join(","), "CounterViewModelTests.cs");
  includes(names.join(","), "CatalogServiceTests.cs");
  files.filter((f) => /\.cs$/.test(f.fileName)).forEach((f) => braceBalanced(f.code));
});

/* ---- regression: perFunction + viewModel on a VM must not collide on names ----
   Both genPerFunction and genViewModel emit a <Class>Tests.cs declaring a
   public class <Class>Tests; shipping both together used to fail the exported
   zip's dotnet build with CS0101 (duplicate type) and an MSBuild duplicate-file
   warning. The VM file (and its class) is now renamed to <Class>VmTests when
   perFunction is also on. */
test("generate: perFunction + viewModel on a VM yields unique file names and class decls", () => {
  const m = parse(COUNTER_VM, "CounterViewModel.cs");
  const files = C.generate(m, { perFunction: true, viewModel: true, selection: {} });
  const csFiles = files.filter((f) => /\.cs$/.test(f.fileName));
  /* file names are all distinct */
  const names = csFiles.map((f) => f.fileName);
  eq(names.length, new Set(names).size, "no two emitted .cs files share a name");
  /* both expected names are present and distinct */
  includes(names.join(","), "CounterViewModelTests.cs");
  includes(names.join(","), "CounterViewModelVmTests.cs");
  /* every `public class` declaration across all files is unique (no CS0101) */
  const decls = [];
  csFiles.forEach((f) => {
    (f.code.match(/public class \w+/g) || []).forEach((d) => decls.push(d));
  });
  ok(decls.indexOf("public class CounterViewModelTests") !== -1, "per-function class kept");
  ok(decls.indexOf("public class CounterViewModelVmTests") !== -1, "VM class renamed");
  eq(decls.length, new Set(decls).size, "no duplicate public class declaration across files");
  csFiles.forEach((f) => braceBalanced(f.code));
});

/* viewModel WITHOUT perFunction keeps the original <Class>Tests naming. */
test("generate: viewModel only (no perFunction) keeps the original CounterViewModelTests name", () => {
  const m = parse(COUNTER_VM, "CounterViewModel.cs");
  const files = C.generate(m, { perFunction: false, viewModel: true, selection: {} });
  const vm = files.find((f) => /Tests\.cs$/.test(f.fileName) && /public class CounterViewModelTests\b/.test(f.code));
  ok(vm, "VM file still named CounterViewModelTests.cs with class CounterViewModelTests");
  eq(vm.fileName, "CounterViewModelTests.cs");
  notIncludes(files.map((f) => f.fileName).join(","), "CounterViewModelVmTests.cs",
    "no Vm suffix when perFunction is off");
});

/* ---- UI: picker render + selection persistence + per-fn copy strip ---- */
test("UI: function picker renders, persists selection by Class.Method, drops unchecked trios", () => {
  const els = {};
  const store = {};
  global.window = global;
  global.localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
  };
  global.document = {
    getElementById(id) { return els[id] || (els[id] = { innerHTML: "", textContent: "" }); },
  };
  require("../data/testlab-core.js");
  require("../data/testlab.js");
  global.TESTLAB.render();
  global.TL.edit(COUNTER_VM);
  global.TL.generate();
  /* picker lists every command */
  const picker = els["tl-picker-wrap"].innerHTML;
  includes(picker, "CounterViewModel");
  includes(picker, "Start");
  includes(picker, "Stop");
  includes(picker, "Reset");
  /* per-function copy strip present in the output */
  includes(els["tl-output"].innerHTML, "tl-fncopy");
  /* uncheck Stop -> its trio disappears, selection persists keyed by Class.Method */
  global.TL.setFunc("CounterViewModel.Stop", false);
  const out = els["tl-output"].innerHTML;
  notIncludes(out, "===================== Stop", "unchecked Stop trio removed");
  includes(out, "===================== Start", "Start trio remains");
  const saved = JSON.parse(store["aop-testlab-state"]);
  eq(saved.selection["CounterViewModel.Stop"], false);
});

test("UI: TL exposes setFunc / allFuncs / copyFunc and perFunction is the default mode", () => {
  global.window = global;
  require("../data/testlab-core.js");
  require("../data/testlab.js");
  ok(typeof global.TL.setFunc === "function", "TL.setFunc missing");
  ok(typeof global.TL.allFuncs === "function", "TL.allFuncs missing");
  ok(typeof global.TL.copyFunc === "function", "TL.copyFunc missing");
});

/* ===================================================================== */
/* ============ Spec 13: project export (xunitProject args) ============ */
/* ===================================================================== */

const Z = require("../data/projzip-core.js");

/* the default options the UI starts with (perFunction + headless + async + csproj) */
function exportOpts(over) {
  return Object.assign(
    { perFunction: true, plain: false, viewModel: false, headless: true, async: true, csproj: true, selection: {} },
    over || {}
  );
}

test("buildExport: returns xunitProject args from sources + generated files", () => {
  const sources = [{ name: "CounterViewModel.cs", text: COUNTER_VM }];
  const m = C.parse(sources);
  const opts = exportOpts();
  const gen = C.generate(m, opts);
  const exp = C.buildExport(m, gen, opts, sources);
  ok(exp.ok, "export viable");
  ok(exp.args && Array.isArray(exp.args.sourceFiles), "sourceFiles present");
  ok(Array.isArray(exp.args.testFiles), "testFiles present");
  eq(exp.args.headless, true, "headless flag passed through");
});

test("buildExport: source path keeps a single .cs (no Foo.cs.cs)", () => {
  const sources = [{ name: "CounterViewModel.cs", text: COUNTER_VM }];
  const m = C.parse(sources);
  const exp = C.buildExport(m, C.generate(m, exportOpts()), exportOpts(), sources);
  /* PROJZIP uses `path` verbatim; the basename must stay CounterViewModel.cs */
  const entries = Z.xunitProject("ExamApp.Tests", exp.args);
  const paths = entries.map((e) => e.path);
  ok(paths.indexOf("Source/CounterViewModel.cs") !== -1, "single .cs source path");
  notIncludes(paths.join(","), "CounterViewModel.cs.cs", "must not double the extension");
});

test("buildExport: drops the app-coupled headless scaffold (HeadlessUiTests/TestAppBuilder from core)", () => {
  const sources = [{ name: "CounterViewModel.cs", text: COUNTER_VM }];
  const m = C.parse(sources);
  const opts = exportOpts();
  const gen = C.generate(m, opts);
  /* the generator DOES emit the app-coupled scaffold */
  includes(gen.map((f) => f.fileName).join(","), "HeadlessUiTests.cs");
  const exp = C.buildExport(m, gen, opts, sources);
  const testNames = exp.args.testFiles.map((t) => t.name).join(",");
  /* but the export must NOT ship it (it references ExamApp.Views.MainWindow/App) */
  notIncludes(testNames, "HeadlessUiTests", "app-coupled headless test excluded from export");
  /* nor the core TestAppBuilder (PROJZIP supplies its own standalone one) */
  notIncludes(testNames, "TestAppBuilder", "core TestAppBuilder excluded; PROJZIP supplies its own");
  /* the pure test files survive */
  includes(testNames, "CounterViewModelTests", "per-function tests kept");
  includes(testNames, "CounterViewModelAsyncTests", "async tests kept");
});

test("buildExport: csproj + runbook are not shipped as test files (PROJZIP writes the csproj)", () => {
  const sources = [{ name: "CounterViewModel.cs", text: COUNTER_VM }];
  const m = C.parse(sources);
  const opts = exportOpts();
  const exp = C.buildExport(m, C.generate(m, opts), opts, sources);
  const names = exp.args.testFiles.map((t) => t.name).join(",");
  notIncludes(names, "ExamApp.Tests", "no csproj smuggled into Tests/");
  notIncludes(names, "RUNBOOK", "no runbook smuggled into Tests/");
});

test("buildExport: headless on with a parameterless VM adds a standalone headless smoke test", () => {
  const sources = [{ name: "CounterViewModel.cs", text: COUNTER_VM }];
  const m = C.parse(sources);
  const opts = exportOpts({ headless: true });
  const exp = C.buildExport(m, C.generate(m, opts), opts, sources);
  const smoke = exp.args.testFiles.find((t) => t.name === "HeadlessSmokeTests");
  ok(smoke, "HeadlessSmokeTests added when headless on");
  includes(smoke.text, "[AvaloniaFact]");
  includes(smoke.text, "new CounterViewModel()");
  /* must NOT reference Window/View types (would not compile standalone) */
  notIncludes(smoke.text, "MainWindow");
  notIncludes(smoke.text, ".Views");
  braceBalanced(smoke.text);
});

test("buildExport: headless off ships no headless smoke + no headless flag", () => {
  const sources = [{ name: "CounterViewModel.cs", text: COUNTER_VM }];
  const m = C.parse(sources);
  const opts = exportOpts({ headless: false });
  const exp = C.buildExport(m, C.generate(m, opts), opts, sources);
  eq(exp.args.headless, false, "headless flag off");
  notIncludes(exp.args.testFiles.map((t) => t.name).join(","), "HeadlessSmokeTests");
});

test("buildExport: no source -> ok=false with a reason, never throws", () => {
  const exp = C.buildExport({ classes: [] }, [], exportOpts(), []);
  eq(exp.ok, false, "not viable without source");
  ok(typeof exp.reason === "string" && exp.reason.length, "human-readable reason present");
});

test("buildExport: plain service exports compilable per-function tests + the source", () => {
  const sources = [{ name: "OrderService.cs", text: SERVICE }];
  const m = C.parse(sources);
  const opts = exportOpts({ headless: false });
  const exp = C.buildExport(m, C.generate(m, opts), opts, sources);
  const entries = Z.xunitProject("ExamApp.Tests", exp.args);
  const paths = entries.map((e) => e.path).join(",");
  includes(paths, "Source/OrderService.cs", "source copied in");
  includes(paths, "Tests/OrderServiceTests.cs", "per-function tests included");
  /* every generated test file stays brace-balanced after the export round-trip */
  exp.args.testFiles.forEach((t) => braceBalanced(t.code || t.text));
});

test("export: the full zip of the default headless export round-trips intact", () => {
  const sources = [{ name: "CounterViewModel.cs", text: COUNTER_VM }];
  const m = C.parse(sources);
  const opts = exportOpts();
  const exp = C.buildExport(m, C.generate(m, opts), opts, sources);
  const entries = Z.xunitProject("ExamApp.Tests", exp.args);
  const buf = Z.makeZip(entries);
  ok(buf instanceof Uint8Array && buf.length > 0, "zip bytes produced");
  /* the standalone TestAppBuilder PROJZIP ships configures base Application */
  const tab = entries.find((e) => e.path === "TestAppBuilder.cs");
  ok(tab, "PROJZIP TestAppBuilder present for headless");
  includes(tab.text, "AppBuilder.Configure<Application>()");
});

/* ===================================================================== */
/* ============ Spec 14: error state + versioned round-trip ============ */
/* ===================================================================== */

/* a fresh DOM + storage harness so the UI generate->render path runs in Node */
function uiHarness() {
  const els = {};
  const store = {};
  global.window = global;
  global.localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
  };
  global.document = {
    getElementById(id) { return els[id] || (els[id] = { innerHTML: "", textContent: "", className: "" }); },
    createElement() { return { style: {}, setAttribute() {}, click() {}, appendChild() {} }; },
    body: { appendChild() {}, removeChild() {} },
  };
  /* clean any state cached by a previous test in this file */
  delete require.cache[require.resolve("../data/testlab.js")];
  require("../data/testlab-core.js");
  require("../data/testlab.js");
  return { els, store };
}

test("UI: garbage input never throws and never blanks the output pane", () => {
  const { els } = uiHarness();
  global.TESTLAB.render();
  let threw = false;
  try {
    global.TL.edit("public class { this is not valid c# at all <<< ");
    global.TL.generate();
  } catch (e) { threw = true; }
  ok(!threw, "garbage input must not throw to the page");
  const out = els["tl-output"].innerHTML;
  ok(out.length > 0, "output pane is never blank");
});

test("UI: a parser throw is caught and shown as tl-error (not propagated)", () => {
  const { els } = uiHarness();
  global.TESTLAB.render();
  /* stub the core parse to throw, proving doGenerate's catch surfaces a panel */
  const realParse = global.TESTLAB_CORE.parse;
  global.TESTLAB_CORE.parse = function () { throw new Error("boom"); };
  let threw = false;
  try {
    global.TL.edit("public class X { public void Go() {} }");
    global.TL.generate();
  } catch (e) { threw = true; }
  global.TESTLAB_CORE.parse = realParse;
  ok(!threw, "generate must not propagate the parser throw");
  includes(els["tl-output"].innerHTML, "tl-error", "styled error panel shown");
  includes(els["tl-output"].innerHTML, "boom", "error message surfaced");
});

test("UI: localStorage payload is version-stamped and round-trips", () => {
  const { store } = uiHarness();
  global.TESTLAB.render();
  global.TL.edit("public class Foo { public int Bar() => 1; }");
  /* edit() debounces the save (setTimeout); a mode toggle saves synchronously,
     which is what flushes the current files to storage under Node. */
  global.TL.setMode("csproj", true);
  const saved = JSON.parse(store["aop-testlab-state"]);
  eq(saved.v, 1, "payload carries the schema version stamp");
  ok(Array.isArray(saved.files), "files persisted");
  ok(saved.files.some((f) => /public class Foo/.test(f.text)), "pasted code round-trips");
});

test("UI: unknown / corrupt stored shape falls back to defaults without throwing", () => {
  const els = {};
  const store = { "aop-testlab-state": '{"v":999,"garbage":true}' };
  global.window = global;
  global.localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
  };
  global.document = {
    getElementById(id) { return els[id] || (els[id] = { innerHTML: "", textContent: "", className: "" }); },
    createElement() { return { style: {}, setAttribute() {}, click() {}, appendChild() {} }; },
    body: { appendChild() {}, removeChild() {} },
  };
  delete require.cache[require.resolve("../data/testlab.js")];
  require("../data/testlab-core.js");
  require("../data/testlab.js");
  let threw = false;
  try { global.TESTLAB.render(); } catch (e) { threw = true; }
  ok(!threw, "render survives an unknown stored shape");
});

test("UI: export button is hidden when PROJZIP is absent (graceful fallback)", () => {
  const { els } = uiHarness();
  delete global.PROJZIP;                 /* zip core not loaded */
  global.TESTLAB.render();
  global.TL.edit(COUNTER_VM);
  global.TL.generate();
  const wrap = els["tl-export-wrap"];
  ok(!wrap || !/tl-export-btn/.test(wrap.innerHTML), "no export button without PROJZIP");
  /* and the rest of the tool still works */
  ok(els["tl-output"].innerHTML.length > 0, "output still rendered");
});

test("UI: export button appears when PROJZIP is present, with the project-name input", () => {
  const { els } = uiHarness();
  /* re-run the projzip IIFE so window.PROJZIP is set even if a prior test
     deleted it (the module may already be cached). */
  delete require.cache[require.resolve("../data/projzip-core.js")];
  require("../data/projzip-core.js");    /* (re)assigns window.PROJZIP */
  global.TESTLAB.render();
  global.TL.edit(COUNTER_VM);
  global.TL.generate();
  const wrap = els["tl-export-wrap"].innerHTML;
  includes(wrap, "tl-export-btn", "export button rendered");
  includes(wrap, "Export project (.zip)", "button label present");
  includes(wrap, "tl-export-name", "project-name input present");
  ok(typeof global.TL.exportProject === "function", "TL.exportProject handler exists");
  ok(typeof global.TL.setExportName === "function", "TL.setExportName handler exists");
});

test("UI: exportProject runs end-to-end in Node (blob URL stubbed) without throwing", () => {
  const { els } = uiHarness();
  delete require.cache[require.resolve("../data/projzip-core.js")];
  require("../data/projzip-core.js");
  /* makeZipBlobUrl needs Blob/URL; stub a minimal URL so the handler completes */
  const hadURL = typeof global.URL !== "undefined";
  if (!hadURL || typeof global.URL.createObjectURL !== "function") {
    global.URL = { createObjectURL() { return "blob:stub"; }, revokeObjectURL() {} };
    global.Blob = function () {};
  }
  global.TESTLAB.render();
  global.TL.edit(COUNTER_VM);
  global.TL.generate();
  let threw = false;
  try { global.TL.exportProject({ getAttribute() { return null; }, setAttribute() {}, classList: { add() {}, remove() {} } }); }
  catch (e) { threw = true; }
  ok(!threw, "exportProject must not throw");
  /* a success status line is written into the export status element */
  const status = els["tl-export-status"];
  ok(status && /downloaded|dotnet test/.test(status.textContent || ""), "success status surfaced");
});

test("UI: TL exposes toggleCard for collapsible cards", () => {
  global.window = global;
  delete require.cache[require.resolve("../data/testlab.js")];
  require("../data/testlab-core.js");
  require("../data/testlab.js");
  ok(typeof global.TL.toggleCard === "function", "TL.toggleCard missing");
});
