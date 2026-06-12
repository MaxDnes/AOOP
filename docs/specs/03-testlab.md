# Spec 03: Test Lab (NEW tool) "paste code, get proposed xUnit tests"

Read docs/specs/00-master-plan.md first. You own ONLY these NEW files:
data/testlab-core.js, data/testlab.js, testlab.css, tests/testlab-core.test.js.
DO NOT touch index.html or app.js; the integration agent wires the tool in later.
Before building, read data/analyzer-core.js + data/analyzer.js to copy their
architecture (pure core without DOM + UI module + guarded module.exports for Node),
and read tests/analyzer-core.test.js for the test style. Also read
"C:\Users\Max\Desktop\AOP Exam Starter Kit\ExamApp.Tests\ExamApp.Tests.csproj" and
"C:\Users\Max\Desktop\AOP Exam Starter Kit\ExamApp.Tests\*.cs" so generated csproj
versions and headless boilerplate match the known-good local setup EXACTLY.

Purpose: exam Problem 3 is "write xUnit tests (possibly Avalonia.Headless) for given
code" or "implement an async counter". This tool takes pasted C# and PROPOSES the
tests: ready-to-paste test files with real asserts where derivable and clearly marked
TODOs where judgment is needed.

## Core (data/testlab-core.js, pure JS, no DOM)

### Parser
Strip comments/strings (preserve line offsets), then extract per class:
- name, base type, implemented interfaces, is it an ObservableObject / does it use
  [ObservableProperty] / [RelayCommand] (CommunityToolkit detection)
- ctor parameter list (name + type; flag interface types)
- public methods: name, params (name+type), return type, async or not
- public properties (name, type, get/set)
- [ObservableProperty] private fields -> generated PascalCase property names
- [RelayCommand] methods -> generated <Name>Command members (strip Execute prefix
  and Async/Command suffixes per toolkit rules)
Window.TESTLAB_CORE with: parse(files) -> model, and the generators below.

### Generators (all return {fileName, code} objects, complete compilable files with
usings and namespace ExamApp.Tests)
1. Plain xUnit per class: one test class <Name>Tests. Per public method a [Fact]
   named Method_Scenario_Expected with Arrange/Act/Assert:
   - sut construction: dummy args for primitives, `new Fake<Interface>()` for
     interface ctor params PLUS an emitted minimal inline fake class per interface
     (implements members with simple recording/returns and TODO bodies where the
     interface is unknown beyond its name: emit `// TODO: implement members` only
     when member list is unknown; when the interface is also in the pasted code,
     implement its members for real).
   - assert heuristics: bool return -> Assert.True/False pair of tests; numeric ->
     Assert.Equal with TODO expected; collection/IEnumerable -> Assert.NotNull +
     Assert.NotEmpty + comment; string -> Assert.Equal TODO; void -> act then assert
     on an affected public property if one exists, else TODO comment.
   - methods with 1-2 primitive params additionally get a [Theory] with 2-3
     [InlineData] rows including edge values (0, -1, empty string, null for
     nullable/string).
2. ViewModel mode (auto when toolkit detected): tests that drive commands
   (`vm.AddCommand.Execute(null);`) and assert ObservableCollection counts /
   generated property values; a PropertyChanged capture helper test
   (List<string> changed; vm.PropertyChanged += (_, e) => changed.Add(e.PropertyName);)
   asserting notification on property set; CanExecute test when
   [RelayCommand(CanExecute=...)] present.
3. Headless scaffold (static, parameterized by VM/Window names): complete
   TestAppBuilder.cs with [AvaloniaTestApplication] + UseHeadless, and
   HeadlessUiTests.cs with [AvaloniaFact] creating the Window, finding a control,
   invoking a command N times in a loop (the classic 100-click test) and asserting.
   Must match the Starter Kit's working files (read them; reuse verbatim structure).
4. Async tests: for async methods / counter-style VMs (Start/Stop/Reset commands
   present): a test pattern with `await Task.Delay(350); Assert.InRange(vm.Count, 2, 4);`
   style timing-tolerant asserts plus stop-resume-reset sequence test, and a comment
   block on why exact equality is flaky.
5. csproj generator: emits ExamApp.Tests.csproj content with the EXACT versions from
   the local Starter Kit csproj (read at build time by YOU the agent, hardcode the
   verified numbers into the generator).
6. Runbook (static string array of steps): offline test-project creation:
   `dotnet new xunit -o ExamApp.Tests`, `dotnet add ExamApp.Tests reference ExamApp`,
   csproj edits (paste from #5), `dotnet test`, plus troubleshooting (restore fails
   offline -> use scripts/offline-feed per README-EXAM-DAY.md; version pins must
   match the NuGet cache).

## UI (data/testlab.js + testlab.css)
window.TESTLAB = { render(rootEl), init() } following the analyzer's contract
exactly (the integration agent will call it like the others; verify the contract in
data/analyzer.js and match it).
Left pane: source file tabs (add/rename/remove, paste areas) like the Analysis Lab,
persisted to localStorage key "aop-testlab-state" (files, active tab, options).
A "Load example" button with a small CounterViewModel sample.
Right pane: mode toggles (checkboxes): Plain xUnit / ViewModel tests / Headless
scaffold / Async patterns / csproj + runbook. Below: generated output as cards, one
per generated file, header = file name (mono, amber), copy button per card and a
"Copy all" producing one concatenated paste. Regenerate live on input (debounced)
or via a Generate button; your call, keep it snappy.
Everything XSS-escaped. No fetch, no modules.

## Looks
Mirror analyzer.css patterns: two panes, ink-1 cards, cyan as this tool's accent
color (analyzer uses red/amber for violations; test lab is cyan/green = constructive).
Output code blocks reuse the app's existing code styling conventions (check how
analyzer/designer render code blocks and reuse the classes if global, else replicate).

## Tests (tests/testlab-core.test.js, Node, use tests/t.js helpers)
- Parser: feed a realistic toolkit VM string (counter with [ObservableProperty]
  int count and [RelayCommand] Start/Stop/Reset, async loop) -> classes, command
  names (StartCommand...), generated property (Count), ctor interfaces detected.
- Parser: plain service class with interface ctor param + bool/string/collection
  methods -> correct method/param/return extraction.
- Generators: output contains [Fact], naming convention, balanced braces (write a
  simple brace-balance helper), usings present, namespace present; theory generated
  for primitive-param method with [InlineData]; fake class emitted for interface
  param; implemented-for-real when interface source pasted.
- VM mode: command execute lines + PropertyChanged capture present.
- Headless: [AvaloniaTestApplication] and [AvaloniaFact] present; csproj contains
  the exact verified package versions and is xmlBalanced.
- UI file loads in Node without DOM errors (same trick as analyzer-ui tests) and
  escapes HTML in rendered output.
- Robustness: garbage input does not throw, returns empty model.

## Definition of done
- Own test file green; full suite green at session end (ignore mid-session failures
  in files you do not own).
- Generated plain + VM + headless output for the example VM is plausible C# you
  would paste into the Starter Kit (eyeball it carefully; you know C#).
- csproj versions verified against the real file, stated in your report.
- No file outside ownership touched (especially index.html/app.js).

## Return (final message, raw JSON)
{"done": bool, "parser_capabilities": [..], "generators": [..], "tests": "X passed",
 "csproj_versions": {..}, "manual_checks": [..], "skipped": [..], "notes": ".."}
