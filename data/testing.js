/* ============ UNIT TESTING ============ */

window.TOPICS.push(

{
id: "ut-intro",
title: "Unit testing: concepts, AAA, naming",
cat: "Unit Testing",
tags: ["unit testing", "aaa", "arrange act assert", "naming convention", "why test"],
related: ["ut-setup", "ut-asserts", "pb-unit-testing"],
blocks: [
  { def: "Unit testing is writing tests for the smallest parts of your code so that when something is changed, the tests can be run and you can see if your program still works, and if not, where it does not, without having to run it yourself.", term: "Unit testing (slide verbatim)" },
  { code: String.raw`using Xunit;
using Prime.Services;

namespace Prime.UnitTests.Services
{
    // naming: ClassUnderTest_MethodShould
    public class PrimeService_IsPrimeShould
    {
        [Fact]
        // naming: Method_Scenario_ExpectedResult
        public void IsPrime_InputIs1_ReturnFalse()
        {
            var primeService = new PrimeService();          // Arrange
            bool result = primeService.IsPrime(1);          // Act

            Assert.False(result, "1 should not be prime");  // Assert (+ failure message)
        }
    }
}`, lang: "csharp", title: "The course's reference test (slide verbatim)" },
  { list: [
    "**Arrange** create the object under test and inputs. **Act** call the thing. **Assert** check the outcome. One logical assertion theme per test.",
    "Test the **ViewModel and Model**, not pixels: that is the payoff of MVVM (slide: \"we can and should still write tests for our Model\").",
    "Tests live in a separate project referencing the app project.",
  ]},
]},

{
id: "ut-setup",
title: "Test project setup (incl. offline csproj)",
cat: "Unit Testing",
tags: ["xunit", "setup", "dotnet new", "project reference", "csproj", "offline", "internalsvisibleto"],
related: ["pb-unit-testing", "ut-headless"],
blocks: [
  { code: String.raw`# 1. create the test project next to the app project
dotnet new xunit -o Counter.Tests

# 2. let it see the app's classes
dotnet add Counter.Tests reference Counter/Counter.csproj

# 3. (only for headless UI tests)
dotnet add Counter.Tests package Avalonia.Headless.XUnit --version 11.2.1

# 4. run
dotnet test`, lang: "bash", title: "The four commands" },
  { code: String.raw`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="coverlet.collector" Version="6.0.4" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />
    <!-- headless UI testing only: -->
    <PackageReference Include="Avalonia.Headless.XUnit" Version="11.2.1" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\Counter\Counter.csproj" />
  </ItemGroup>
</Project>`, lang: "xml", title: "Complete test .csproj (versions from the course's TestableCalculator)" },
  { gotcha: "ViewModels in the template are `public`, so normally no extra setup is needed. If something is `internal`, the app csproj needs `<ItemGroup><InternalsVisibleTo Include=\"Counter.Tests\"/></ItemGroup>` (the course solution used exactly this for its Avalonia test project)." },
  { tip: "Run `dotnet new xunit` + add the headless package ONCE at home before the exam so every package sits in your local NuGet cache and restores offline." },
]},

{
id: "ut-asserts",
title: "Assert cheat sheet + [Theory]",
cat: "Unit Testing",
tags: ["assert", "equal", "true", "false", "throws", "theory", "inlinedata", "fact"],
related: ["ut-testing-viewmodels", "ut-intro"],
blocks: [
  { table: { head: ["Assert", "Checks"], rows: [
    ["`Assert.Equal(expected, actual)`", "value equality (expected FIRST)"],
    ["`Assert.NotEqual(a, b)`", "inequality"],
    ["`Assert.True(cond)` / `Assert.False(cond)`", "boolean (optional failure message arg)"],
    ["`Assert.Null(x)` / `Assert.NotNull(x)`", "null-ness"],
    ["`Assert.Contains(item, collection)`", "membership (also substring in string)"],
    ["`Assert.Empty(coll)` / `Assert.NotEmpty(coll)`", "emptiness"],
    ["`Assert.Single(coll)`", "exactly one element (returns it)"],
    ["`Assert.IsType<T>(obj)`", "runtime type"],
    ["`Assert.Throws<TException>(() => code)`", "code throws exactly TException"],
    ["`Assert.Equal(expected, actual, precision)`", "floating point with tolerance"],
  ]}},
  { code: String.raw`// [Fact] = one fixed case. [Theory] = same test body, many data rows:
[Theory]
[InlineData(1, false)]
[InlineData(2, true)]
[InlineData(7, true)]
[InlineData(9, false)]
public void IsPrime_Values_ReturnExpected(int input, bool expected)
{
    var svc = new PrimeService();
    Assert.Equal(expected, svc.IsPrime(input));
}

// exception testing:
[Fact]
public void Divide_ByZero_Throws()
{
    var calc = new Calculator();
    Assert.Throws<DivideByZeroException>(() => calc.Divide(1, 0));
}`, lang: "csharp", title: "Theory + Throws" },
]},

{
id: "ut-testing-viewmodels",
title: "Testing ViewModels & commands",
cat: "Unit Testing",
tags: ["viewmodel test", "command test", "canexecute", "execute", "mvvm testing"],
related: ["mv-relaycommand", "pb-unit-testing", "ex-june-p3-testing"],
blocks: [
  { p: "A ViewModel is just a class: instantiate it, poke its generated properties/commands, assert. No Avalonia required. This is precisely why the exam splits 'normal' VM tests from headless UI tests." },
  { code: String.raw`using Calculator.ViewModels;
using Xunit;

public class CalculatorVmTests
{
    [Fact]
    public void AddCommand_AddsTwoNumbers()      // course solution, verbatim
    {
        MainWindowViewModel vm = new();
        Assert.Equal(0, vm.Result);

        vm.FirstOperand = 1;
        vm.SecondOperand = 1;
        vm.AddCommand.Execute(null);

        Assert.Equal(2, vm.Result);
    }

    [Fact]
    public void DivideCommand_CannotExecute_WhenSecondOperandIsZero()
    {
        MainWindowViewModel vm = new();
        Assert.False(vm.DivideCommand.CanExecute(null));   // guard active

        vm.SecondOperand = 10;
        Assert.True(vm.DivideCommand.CanExecute(null));    // guard released
    }
}`, lang: "csharp", title: "Command Execute + CanExecute testing (TestableCalculator)" },
  { list: [
    "`vm.SomeCommand.Execute(null)` runs the command method.",
    "`vm.SomeCommand.CanExecute(null)` evaluates the guard WITHOUT executing.",
    "Property writes go through generated setters, so `OnXChanged` hooks and `NotifyCanExecuteChangedFor` fire exactly like in the real app.",
    "Async commands: `await vm.LoadDataCommand.ExecuteAsync(null);` then assert.",
  ]},
  { p: "The June exam's exact five Counter tests are written out in [[pb-unit-testing|the testing playbook]]." },
]},

{
id: "ut-headless",
title: "Avalonia headless UI testing",
cat: "Unit Testing",
tags: ["headless", "avaloniafact", "avaloniatestapplication", "keytextinput", "keypressqwerty", "findcontrol", "ui test"],
related: ["pb-unit-testing", "ut-setup"],
blocks: [
  { def: "In Headless Mode we can run Avalonia without actually rendering the windows, and fake user interaction to test the UI directly.", term: "Headless testing (slide wording)" },
  { h: "Mandatory one-time setup per test project" },
  { code: String.raw`using Avalonia;
using Avalonia.Headless;
using Calculator;          // the app's namespace (for App)

[assembly: AvaloniaTestApplication(typeof(TestAppBuilder))]

public class TestAppBuilder
{
    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<App>()
        .UseHeadless(new AvaloniaHeadlessPlatformOptions());
}`, lang: "csharp", title: "TestAppBuilder.cs (course verbatim)" },
  { h: "Writing the tests" },
  { code: String.raw`using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Calculator.ViewModels;
using Calculator.Views;
using Xunit;

public class AvaloniaTests
{
    [AvaloniaFact]                      // ALWAYS AvaloniaFact, never plain Fact
    public void Should_Enable_Button_If_Not_Zero()      // course solution, verbatim
    {
        var window = new MainWindow
        {
            DataContext = new MainWindowViewModel()      // wire VM manually
        };

        window.Show();                  // REQUIRED even though nothing renders

        // named controls (Name="DivideButton" etc.) become fields on the window:
        bool isEnabled = window.DivideButton.IsEffectivelyEnabled;
        Assert.False(isEnabled);        // CanExecute guard disables it

        window.SecondOperandInput.Focus();
        window.KeyTextInput("10");      // simulate typing

        isEnabled = window.DivideButton.IsEffectivelyEnabled;
        Assert.True(isEnabled);
    }
}`, lang: "csharp", title: "Headless test (TestableCalculator solution)" },
  { table: { head: ["Interaction API", "Simulates"], rows: [
    ["`window.Show()`", "opening the window (mandatory first step)"],
    ["`control.Focus()`", "focusing a control"],
    ["`window.KeyTextInput(\"text\")`", "typing into the focused control"],
    ["`window.KeyPressQwerty(PhysicalKey.Enter, RawInputModifiers.None)`", "a key press (Enter on a focused button = click)"],
    ["`window.MouseDown(point, MouseButton.Left)` / `MouseUp`", "raw mouse input"],
    ["`button.Command?.Execute(null)`", "bypass input, invoke the bound command"],
    ["`window.FindControl<Button>(\"Name\")`", "locate by Name (returns null if absent → Assert.NotNull)"],
    ["`control.IsEffectivelyEnabled`", "enabled state incl. command CanExecute"],
  ]}},
  { gotcha: "Three classic failures: forgot `window.Show()`; used `[Fact]` instead of `[AvaloniaFact]`; controls have no `Name` so FindControl/fields return null. Fix all three before debugging anything else." },
]},

{
id: "ut-functional",
title: "Functional & manual test documentation",
cat: "Unit Testing",
tags: ["functional testing", "manual testing", "test cases", "documentation", "homework"],
related: ["ut-intro"],
blocks: [
  { p: "The homework (and good exam habits) require documented manual test cases alongside unit tests. Format that satisfies it:" },
  { code: String.raw`# Functional Tests - Library App

## TC-01 Borrow book (Member)
Steps: log in as member -> Library Catalog -> select "Dune" -> click Borrow
Expected: "Dune" appears under My Loans; status in catalog becomes Borrowed
Result: PASS (2026-06-09)

## TC-02 Return book (Member)
Steps: My Loans -> select "Dune" -> click Return
Expected: removed from My Loans; catalog status back to Available
Result: PASS

## TC-03 Login validation (System)
Steps: enter wrong password for librarian account
Expected: error message, no navigation
Result: PASS

## TC-04 Data persistence (System)
Steps: borrow a book, close app, reopen
Expected: loan still present (loaded from JSON)
Result: PASS`, lang: "text", title: "README.md test log pattern" },
  { list: [
    "Each case: **steps → expected → actual/result**. Cover each role's main flows plus login, search/filter, and persistence-after-restart.",
    "Unit tests cover logic in isolation; functional tests cover user-visible flows; headless tests sit between (real UI, simulated input).",
  ]},
]}

);
