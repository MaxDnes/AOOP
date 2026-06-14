/* ============================================================
   TEST LAB · per-mode testing guidance
   window.TESTLAB_GUIDE = [ { key, label, what, when, steps:[...], snippet, gotcha }, ... ]

   One entry per Test Lab mode (keys match MODE_DEFS in data/testlab.js). The Lab
   renders these as a collapsible "How to write each kind of test" panel so the
   reader knows when to reach for unit tests vs headless vs async, and the exact
   idiom each one needs. Pure data, no DOM. Browser global + Node export.
   ============================================================ */

(function (global) {
"use strict";

var TESTLAB_GUIDE = [
  {
    key: "perFunction",
    label: "Per-function P/N/E",
    what: "One labeled Positive / Negative / Edge test for each method and command.",
    when: "The default for a Problem 3 unit-test task: tick the methods you care about and get a trio each.",
    steps: [
      "Pick the functions in the picker, then press Generate.",
      "Each function gets three tests: a happy path (Positive), an invalid-input case (Negative), and a boundary case (Edge).",
      "Replace each marked TODO with the value you actually expect. The Arrange / Act / Assert structure is already written.",
    ],
    snippet: [
      "[Fact]",
      "public void Add_WithValidInput_ReturnsExpectedNumber()",
      "{",
      "    var sut = new Calculator();   // Arrange",
      "    var result = sut.Add(2, 3);   // Act",
      "    Assert.Equal(5, result);      // Assert",
      "}",
    ].join("\n"),
    gotcha: "A void method has no return value to check, so its Positive test asserts a property the call changed (deposit, then check Balance).",
  },
  {
    key: "plain",
    label: "Plain xUnit",
    what: "Classic [Fact] / [Theory] tests grouped by method, without the P/N/E labelling.",
    when: "A plain service or helper class where you just want straightforward per-method unit tests.",
    steps: [
      "Follow Arrange / Act / Assert: build the object, call the method, check the outcome.",
      "Use one [Fact] per behaviour you want to pin down.",
      "Use a [Theory] with [InlineData(...)] rows to run the same test over several inputs.",
    ],
    snippet: [
      "[Theory]",
      "[InlineData(0, 0)]",
      "[InlineData(2, 3)]",
      "public void Add_AddsBothNumbers(int a, int b)",
      "{",
      "    var sut = new Calculator();",
      "    Assert.Equal(a + b, sut.Add(a, b));",
      "}",
    ].join("\n"),
    gotcha: "[InlineData] values must be compile-time constants. You cannot pass a decimal, an object, or a 'new ...' there; use a [MemberData] source instead.",
  },
  {
    key: "viewModel",
    label: "ViewModel tests",
    what: "Tests for a CommunityToolkit ViewModel's generated commands and observable properties.",
    when: "An [ObservableObject] that uses [RelayCommand] and [ObservableProperty].",
    steps: [
      "[RelayCommand] on Foo generates a FooCommand property. Call vm.FooCommand.Execute(null), not the private Foo method.",
      "[ObservableProperty] on a field 'count' generates a public Count property. Assert against that after running a command.",
      "To prove a property notified the UI, subscribe to vm.PropertyChanged and record the property names it raised.",
    ],
    snippet: [
      "var vm = new CounterViewModel();",
      "var raised = new List<string>();",
      "vm.PropertyChanged += (_, e) => raised.Add(e.PropertyName!);",
      "",
      "vm.ResetCommand.Execute(null);",
      "",
      "Assert.Equal(0, vm.Count);",
      "Assert.Contains(nameof(vm.Count), raised);",
    ].join("\n"),
    gotcha: "The command member appends 'Command' to the name, and an async method FooAsync still becomes FooCommand (the Async suffix is dropped).",
  },
  {
    key: "headless",
    label: "Headless scaffold",
    what: "Avalonia headless tests that run UI code on the UI thread without opening a real window.",
    when: "When the behaviour lives in the View, or needs the Avalonia runtime: a control, a binding, or a UI-thread timer.",
    steps: [
      "Mark the test [AvaloniaFact] (not [Fact]) so it runs on the headless UI thread.",
      "Register the test app once with [assembly: AvaloniaTestApplication(typeof(TestAppBuilder))] (the generated TestAppBuilder.cs).",
      "Construct the ViewModel or control, drive it, and assert the resulting state.",
    ],
    snippet: [
      "[AvaloniaFact]",
      "public void CounterViewModel_ConstructsUnderHeadlessPlatform()",
      "{",
      "    var vm = new CounterViewModel();",
      "    vm.ResetCommand.Execute(null);",
      "    Assert.Equal(0, vm.Count);",
      "}",
    ].join("\n"),
    gotcha: "A plain [Fact] that touches Avalonia throws 'call from invalid thread'. Use [AvaloniaFact]. Reference a real Window/View only inside the full app project, never a standalone test project.",
  },
  {
    key: "async",
    label: "Async patterns",
    what: "Timing-tolerant tests for async commands and loops (await, Task.Delay, a while-running loop).",
    when: "A command that awaits, loops, or ticks on a timer, such as a Start / Stop counter.",
    steps: [
      "Fire the command without awaiting it: _ = vm.StartCommand.ExecuteAsync(null);",
      "Let it run a moment with await Task.Delay(...), then call Stop so the loop cannot leak past the test.",
      "Assert a range, never an exact tick count: Assert.True(vm.Count > 0) or Assert.InRange(vm.Count, 1, 100).",
    ],
    snippet: [
      "[Fact]",
      "public async Task Start_TicksThenStops()",
      "{",
      "    var vm = new CounterViewModel();",
      "    _ = vm.StartCommand.ExecuteAsync(null);  // fire-and-forget",
      "    await Task.Delay(150);                    // let it tick",
      "    vm.StopCommand.Execute(null);             // stop the loop",
      "    Assert.True(vm.Count > 0);",
      "}",
    ].join("\n"),
    gotcha: "Never Assert.Equal an exact count from a timer. Real timing varies, so the test goes flaky. Always stop the loop, or it runs forever and the test hangs.",
  },
  {
    key: "csproj",
    label: "csproj + runbook",
    what: "The exact-version xUnit test project file plus an offline run-and-troubleshoot guide.",
    when: "When you need the tests to actually compile and run, especially offline on exam day.",
    steps: [
      "Drop the generated .csproj next to the tests. Its package versions match the starter kit exactly.",
      "If you are offline, restore against the local feed, then run dotnet test.",
      "RUNBOOK.txt lists the commands and the usual restore / headless errors with their fixes.",
    ],
    snippet: [
      "dotnet restore --source <local-offline-feed>",
      "dotnet test",
    ].join("\n"),
    gotcha: "If restore tries to reach nuget.org you are online by mistake. Point --source at the local feed, and confirm every Version= in the csproj exists in your package cache.",
  },
];

global.TESTLAB_GUIDE = TESTLAB_GUIDE;
if (typeof module !== "undefined" && module.exports) module.exports = TESTLAB_GUIDE;

})(typeof window !== "undefined" ? window : globalThis);
