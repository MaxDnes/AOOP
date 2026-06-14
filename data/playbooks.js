/* ============ EXAM PLAYBOOKS ============ */

window.TOPICS.push(

{
id: "pb-exam-overview",
title: "Read this first: exam format & strategy",
cat: "Exam Playbooks",
tags: ["exam", "format", "strategy", "points", "submission", "allowed aids"],
related: ["pb-problem1-analysis", "pb-avalonia-ui", "pb-unit-testing", "pb-async", "pb-linq-json"],
blocks: [
  { p: "The 2026 (F26) exam is **20 MCQs (1 point each) plus 3 coding tasks**, 100 points, 4 hours, and you can switch between the MCQs and the coding tasks at any time. The coding tasks closely resemble the 2025 papers (P2 Avalonia UI, P3 async, P4 LINQ); the written Problem 1 of 2025 is now the 20 multiple-choice questions." },
  { table: { head: ["#", "Type", "Points", "What you do"], rows: [
    ["MCQ", "OOP / SOLID / pattern theory", "20", "20 multiple-choice questions, 1 pt each: which principle or pattern a snippet shows, or which one it violates."],
    ["2", "Avalonia MVVM UI", "30", "Wire up ViewModel + bindings in a prepared project. Strictly MVVM."],
    ["3", "Async Avalonia UI", "25", "Implement an async worker (auto-counter): Start / Pause(resume) / Reset, all UI updates on the UI thread."],
    ["4", "JSON/CSV + LINQ console", "25", "Deserialize JSON or CSV, run queries, maybe binary search, save results to JSON."],
  ]}},
  { rule: "Allowed libraries (stated on both papers): **C#, the .NET System library, Avalonia, and CommunityToolkit.Mvvm**. Nothing else." },
  { rule: "Tech stack used in all exam projects: **.NET 9, Avalonia 11.2.1, CommunityToolkit.Mvvm 8.2.1**, compiled bindings ON (`AvaloniaUseCompiledBindingsByDefault=true`), nullable enabled." },
  { gotcha: "Submit a **strict flat folder of exactly 6 files**, the professor's exact names, no bin/ or obj/, no subfolders: Problem_2_MainWindowViewModel.cs, Problem_2_MainWindow.axaml, Problem_3_MainWindowViewModel.cs, Problem_3_MainWindow.axaml, Problem_4_Program.cs, Problem_4_Models.cs. There is no Problem_1 file (that part is the MCQs); note P3 now ALSO submits its .axaml and P4 submits Models.cs. Always read the day's submission instructions FIRST and re-read them before handing in. Wrong format costs real points." },
  { gotcha: "UI problems say: only modify the ViewModel, the Model and the .axaml. **Code added to MainWindow.axaml.cs (code-behind) scores ZERO.** Same for App.axaml.cs: read it, never edit it." },
  { h: "Suggested time budget (4-hour exam)" },
  { steps: [
    "**0:00–0:10** Open everything, read ALL coding problems + the submission rules. Decide order.",
    "**The 20 MCQs (~30 min)**: do them first while fresh or last in the gaps; you can switch any time. Each is 1 point, so do not get stuck on one.",
    "**Problem 4 (LINQ, 25 pts)** early if LINQ is your strength: it is mechanical and high-value.",
    "**Problem 2 (UI, 30 pts)** deserves the biggest block; do layout first (free points), then bindings, then the advanced part.",
    "**Problem 3 (async, 25 pts)**: the auto-counter pattern, Start / Pause(resume) / Reset, UI-thread updates.",
    "**Final 15–20 min**: build everything once more, assemble the flat 6-file folder, verify file names character by character.",
  ]},
  { tip: "Every sub-task earns points independently. A half-working Problem 2.2 with no 2.3 still scores. Never burn an hour polishing one sub-task while another is untouched." },
  { h: "Official topic list (Lecture 12 repetition)" },
  { list: [
    "OO analysis: 4 principles, composition & aggregation → category **OOP Fundamentals**",
    "SOLID: SRP, OCP, LSP, ISP, DIP → category **SOLID**",
    "Design patterns: Facade, Singleton, Strategy, Command, Observer, Dependency Injection → category **Design Patterns**",
    "Classes, constructors, object initializers, properties, interfaces → **OOP Fundamentals**",
    "Collections, LINQ + lambdas, Object/ToString/IComparable → **Collections**, **LINQ**",
    "File handling, JSON & CSV parsing, exception handling → **Data & Files**",
    "MVC & MVVM, MVVM Toolkit, data binding, binding to lists, layout, styling & animations → **Avalonia UI**, **MVVM & Binding**",
    "Unit testing & Avalonia headless testing → **Unit Testing**",
    "Search & sorting, runtime complexity → **Algorithms & Big-O**",
    "Multithreading: tasks, async/await, UI thread, locking, concurrent collections, cancellation, WhenAll, PeriodicTimer → **Threading & Async**",
  ]},
]},

{
id: "pb-problem1-analysis",
title: "Playbook · Problem 1: written OOP/SOLID analysis",
cat: "Exam Playbooks",
tags: ["problem 1", "analysis", "solid", "oop", "written", "txt", "design pattern identification"],
related: ["solid-overview", "oop-four-principles", "dp-overview", "ex-june-overview", "ex-reexam-overview"],
blocks: [
  { tip: "In the 2026 exam this analysis skill is tested as the **20 MCQs**, not a written `.txt`: each question shows a snippet and asks which OOP pillar, SOLID principle or design pattern it shows or violates. The method below is exactly how you reason about those snippets fast; drill it in the Quiz Exam-Theory set." },
  { p: "The 2025 papers gave a small working console project (DocumentManager in June, FamilyMealPlanner in August) and answered in a provided `.txt`. The code always **mixes genuine good design with at least one planted violation** — spotting it is the whole skill, MCQ or written." },
  { h: "Step-by-step method" },
  { steps: [
    "Open `Program.cs` first: it is the composition root and shows you every class and how they connect.",
    "Open `Interfaces.cs`: list each interface and which classes implement it.",
    "Scan each class: note constructor parameters (injected dependencies), private fields, public surface.",
    "Hunt for the planted violation: look for **downcasts** (`as ConcreteType`, `(ConcreteType)x`), unused injected dependencies, God classes, fat interfaces, `new ConcreteType()` deep inside logic classes.",
    "Write answers using the templates below: claim → code evidence (class/method name) → purpose/benefit.",
  ]},
  { rule: "Every answer needs THREE parts: (1) name the principle, (2) point to a specific class/method/line as evidence, (3) explain what it buys THIS code. One sentence each is enough." },
  { h: "Answer template: the 4 OO principles" },
  { code: String.raw`Encapsulation: PRESENT. Fields are private with controlled access, e.g. Invoice.IsPaid
has a private setter and can only change through MarkAsPaid(). This protects invariants:
callers cannot put the object into an inconsistent state.

Abstraction: PRESENT. Interfaces like ILogger / IProcessable hide implementation details.
DocumentProcessor only knows the IProcessable contract, not Invoice internals, so
implementations can change freely without breaking callers.

Inheritance: PRESENT (interface realization). Invoice : IProcessable, ISummarizable,
IValidatable and ConsoleLogger : ILogger. (There is no class-to-class inheritance here;
the is-a relationships are interface implementations.)

Polymorphism: PRESENT. ProcessBatch(List<IProcessable>) treats Invoices and Reports
uniformly through the interface; OfType<T>() and 'is' pattern matching dispatch on the
runtime type; ToString() overrides change behavior per class.`, lang: "text", title: "Adapt names to the actual exam code" },
  { h: "Answer template: SOLID (per principle)" },
  { code: String.raw`SRP: PRESENT. Each class has one reason to change: MealPlanner plans meals,
ShoppingListGenerator builds the shopping list, ConsoleNotifier handles output,
each IDietaryRule is one policy. UI/storage/logic changes touch different classes.

OCP: PARTIALLY PRESENT. New dietary rules can be added by writing a new IDietaryRule
class without modifying MealPlanner (open for extension). BUT InMemoryRecipeRepository
hardcodes the vegetarian/nut filtering inside FindRecipes instead of using the rules,
so adding a rule still forces a modification there (closed-for-modification is broken).

LSP: VIOLATED. MealPlanner downcasts its IRecipeFinder to InMemoryRecipeRepository
(var repo = _recipeFinder as InMemoryRecipeRepository) and bails out for any other
implementation. A substitute IRecipeFinder does not work, so subclasses/implementations
are NOT substitutable for the abstraction.

ISP: PRESENT. Three small client-specific interfaces (IRecipeFinder, INotifier,
IDietaryRule) instead of one fat interface; no class is forced to implement members
it does not use.

DIP: PARTIALLY PRESENT. High-level MealPlanner depends on abstractions injected via
the constructor (IRecipeFinder, INotifier, List<IDietaryRule>) -- that is DIP applied.
The downcast to the concrete repository breaks it: the high-level module ends up
depending on a concretion because GetRandomRecipe is missing from the interface.
Fix: add GetRandomRecipe to IRecipeFinder (or a new interface) and remove the cast.`, lang: "text", title: "August-exam style model answer (FamilyMealPlanner)" },
  { h: "Design pattern identification" },
  { p: "When asked to name one pattern in the provided code, these are the safe candidates and their tell-tale signatures:" },
  { table: { head: ["Pattern", "You see in code", "One-line role"], rows: [
    ["Strategy", "Interface with one method + multiple small implementations (ILogger/ConsoleLogger, IDietaryRule rules)", "Swappable behavior chosen at composition time"],
    ["Dependency Injection", "Dependencies passed in via constructor, wired in Program.cs / App.axaml.cs", "Decouples classes from concrete implementations; enables testing"],
    ["Facade", "One class offering a simple API over several subsystems (DocumentWorkflowManager wraps processor + registry)", "Simplifies a complex subsystem behind one entry point"],
    ["Observer", "events / PropertyChanged / register-notify lists", "Subject pushes state changes to subscribers"],
    ["Singleton", "private constructor + static Instance (often Lazy<T>)", "Exactly one shared instance"],
  ]}},
  { tip: "If multiple patterns fit, pick the one you can evidence in TWO sentences. Strategy via a one-method interface plus constructor injection is almost always defensible in this course's exam code." },
]},

{
id: "pb-avalonia-ui",
title: "Playbook · Problem 2: Avalonia MVVM UI task",
cat: "Exam Playbooks",
tags: ["problem 2", "ui", "avalonia", "mvvm", "bindings", "30 points", "recipe"],
related: ["mv-binding-cookbook", "ex-june-p2-rectangle", "ex-reexam-p2-mealplanner", "av-itemscontrols", "mv-toolkit-observableproperty"],
blocks: [
  { p: "You get a runnable Avalonia MVVM template where the ViewModel is empty and the View is either a skeleton or has deliberately broken bindings (`ItemsSource=\"\"`, hardcoded values). 30 points, always split: explain MVVM (5) / basic functionality (10–15) / advanced functionality (10)." },
  { h: "The non-negotiable rules" },
  { rule: "Only touch the files the paper lists: usually `MainWindowViewModel.cs`, a Model class, and `MainWindow.axaml`. NEVER the code-behind, NEVER App.axaml.cs. The DataContext is already wired for you." },
  { h: "Step-by-step method" },
  { steps: [
    "Run the project first. See what exists.",
    "Read `App.axaml.cs` (read only!): note what gets injected into the ViewModel constructor; those instances are your toolbox.",
    "Read the provided .axaml: list every control that needs a binding (Button → Command, Slider → Value, ListBox/ItemsControl → ItemsSource + SelectedItem, TextBox → Text).",
    "In the ViewModel: add an `ObservableCollection<T>` for each list, `[ObservableProperty]` fields for each value, `[RelayCommand]` methods for each button.",
    "Wire the bindings in the .axaml. Build after every 2–3 changes; binding typos surface as compile errors thanks to compiled bindings.",
    "Advanced part: usually selection-reaction (use the generated `On<Property>Changed` partial method) or periodic updates (use `DispatcherTimer`).",
  ]},
  { h: "ViewModel skeleton that fits every exam variant" },
  { code: String.raw`using System;
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace MyApp.ViewModels;

public partial class MainWindowViewModel : ViewModelBase   // ViewModelBase : ObservableObject
{
    // a list the View binds to -- mutate it (Add/Remove/Clear), never new it up after ctor
    public ObservableCollection<ItemType> Items { get; } = new();

    // simple bindable values: lowercase field -> generator creates PascalCase property
    [ObservableProperty]
    private double someValue = 50;

    // selection target; the partial OnSelectedItemChanged below fires automatically
    [ObservableProperty]
    private ItemType? selectedItem;

    public MainWindowViewModel()
    {
        // exam apps usually want initial content on startup:
        DoTheThing();
    }

    [RelayCommand]               // generates DoTheThingCommand
    private void DoTheThing()
    {
        Items.Add(new ItemType());
    }

    partial void OnSelectedItemChanged(ItemType? value)
    {
        // react to ListBox selection here (advanced sub-task)
    }
}`, lang: "csharp", title: "Universal exam ViewModel shape" },
  { h: "Binding quick table (the 9 you will actually need)" },
  { table: { head: ["Control", "XAML", "ViewModel member"], rows: [
    ["Button", "`Command=\"{Binding AddItemCommand}\"`", "`[RelayCommand] void AddItem()`"],
    ["Slider", "`Value=\"{Binding RectWidth}\"`", "`[ObservableProperty] double rectWidth`"],
    ["TextBox", "`Text=\"{Binding Name}\"`", "`[ObservableProperty] string? name`"],
    ["TextBlock", "`Text=\"{Binding Count}\"`", "any property; one-way display"],
    ["ListBox list", "`ItemsSource=\"{Binding Items}\"`", "`ObservableCollection<T> Items`"],
    ["ListBox selection", "`SelectedItem=\"{Binding SelectedItem}\"`", "`[ObservableProperty] T? selectedItem`"],
    ["ListBox multi-select", "`SelectionMode=\"Multiple\" SelectedItems=\"{Binding SelectedThings}\"`", "`[ObservableProperty] List<T> selectedThings`"],
    ["CheckBox", "`IsChecked=\"{Binding IsFancy}\"`", "`[ObservableProperty] bool isFancy`"],
    ["Inside DataTemplate", "`Text=\"{Binding Day}\"`", "property of the ITEM class (make item an ObservableObject if it changes)"],
  ]}},
  { gotcha: "`[RelayCommand] void AddItem()` generates `AddItemCommand`. Binding `{Binding AddItem}` to the bare method also works in Avalonia, but `{Binding AddItemCommand}` is the canonical, always-safe form. Use it." },
  { gotcha: "If items must change on screen AFTER being added (move, recolor), the **item class itself** must be a `partial class : ObservableObject` with `[ObservableProperty]` members. An ObservableCollection only notifies about add/remove, not about property changes inside items." },
  { h: "Periodic updates (the recurring advanced sub-task)" },
  { code: String.raw`using Avalonia.Threading;

// In the ViewModel constructor -- DispatcherTimer runs ON the UI thread,
// which satisfies "changes to the UI happen only on the UI thread" for free.
var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
timer.Tick += (_, _) =>
{
    foreach (var r in Rectangles)
    {
        r.X = _random.NextDouble() * (CanvasSize - r.Width);   // keep fully visible
        r.Y = _random.NextDouble() * (CanvasSize - r.Height);
        r.Color = _colors[_random.Next(_colors.Length)];
    }
};
timer.Start();`, lang: "csharp", title: "Every-2-seconds updates, UI-thread safe" },
  { rule: "Random position that keeps an element fully inside a W×H canvas: `x = random.NextDouble() * (CanvasW - elementWidth)`. Same for Y. This exact clamp was worth points in June." },
  { tip: "Full worked solutions: [[ex-june-p2-rectangle|RectangleUI (June)]] and [[ex-reexam-p2-mealplanner|FamilyMealPlannerUI (August, official solution)]]." },
]},

{
id: "pb-unit-testing",
title: "Playbook · Problem 3a: unit testing task",
cat: "Exam Playbooks",
tags: ["problem 3", "unit testing", "xunit", "headless", "test project", "counter"],
related: ["ut-setup", "ut-testing-viewmodels", "ut-headless", "ex-june-p3-testing"],
blocks: [
  { p: "June 2025: given a working Counter app (increment / guarded decrement), create an xUnit test project from scratch (10 pts) and a headless Avalonia UI test (5 pts)." },
  { h: "Create and wire the test project" },
  { code: String.raw`# from the solution folder (Counter.csproj lives in ./Counter)
dotnet new xunit -o Counter.Tests
dotnet add Counter.Tests reference Counter/Counter.csproj
dotnet test`, lang: "bash", title: "Plain xUnit project" },
  { code: String.raw`# for the headless UI test project (separate or same project):
dotnet add Counter.Tests package Avalonia.Headless.XUnit --version 11.2.1`, lang: "bash", title: "Add headless support (match the app's Avalonia version)" },
  { gotcha: "No internet at the exam? `dotnet new xunit` works offline (templates are local), and NuGet usually restores from the local cache (%userprofile%\\.nuget\\packages) if you have EVER restored these packages before. **Before exam day: create one xUnit + one Avalonia.Headless.XUnit project at home so every package is cached.**" },
  { h: "The 5 ViewModel tests (June asked for exactly these)" },
  { code: String.raw`using Counter.ViewModels;
using Xunit;

namespace Counter.Tests;

public class MainWindowViewModelTests
{
    [Fact]
    public void Counter_IsInitializedToZero()
    {
        var vm = new MainWindowViewModel();
        Assert.Equal(0, vm.Count);
    }

    [Fact]
    public void DecrementCommand_CannotExecute_AfterInitialization()
    {
        var vm = new MainWindowViewModel();
        Assert.False(vm.DecrementCommand.CanExecute(null));
    }

    [Fact]
    public void IncrementCommand_IncrementsCountByOne()
    {
        var vm = new MainWindowViewModel();
        vm.IncrementCommand.Execute(null);
        Assert.Equal(1, vm.Count);
    }

    [Fact]
    public void DecrementCommand_CanExecute_AfterIncrement()
    {
        var vm = new MainWindowViewModel();
        vm.IncrementCommand.Execute(null);
        Assert.True(vm.DecrementCommand.CanExecute(null));
    }

    [Fact]
    public void DecrementCommand_DecrementsCountByOne()
    {
        var vm = new MainWindowViewModel();
        vm.IncrementCommand.Execute(null);
        vm.DecrementCommand.Execute(null);
        Assert.Equal(0, vm.Count);
    }
}`, lang: "csharp", title: "Counter.Tests/MainWindowViewModelTests.cs — complete" },
  { h: "Headless UI test (full setup)" },
  { code: String.raw`using Avalonia;
using Avalonia.Headless;
using Counter;

[assembly: AvaloniaTestApplication(typeof(TestAppBuilder))]

public class TestAppBuilder
{
    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<App>()
        .UseHeadless(new AvaloniaHeadlessPlatformOptions());
}`, lang: "csharp", title: "TestAppBuilder.cs — mandatory once per test project" },
  { code: String.raw`using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Counter.ViewModels;
using Counter.Views;
using Xunit;

public class CounterUiTests
{
    [AvaloniaFact]   // NOT [Fact] -- headless tests need the Avalonia dispatcher
    public void Clicking_Increment_100_Times_Displays_100()
    {
        var window = new MainWindow { DataContext = new MainWindowViewModel() };
        window.Show();                       // required even though nothing renders

        // Controls need Name="..." in the axaml. Add them if missing -- that IS part
        // of the task ("make sure the button and the output actually exist").
        var button = window.FindControl<Button>("IncrementButton");
        var output = window.FindControl<TextBlock>("CountText");
        Assert.NotNull(button);
        Assert.NotNull(output);

        for (int i = 0; i < 100; i++)
        {
            button!.Focus();
            window.KeyPressQwerty(PhysicalKey.Enter, RawInputModifiers.None);
        }

        Assert.Equal("100", output!.Text);
    }
}`, lang: "csharp", title: "CounterUiTests.cs — simulate 100 clicks, assert output" },
  { gotcha: "The exam Counter axaml ships its controls WITHOUT `Name` attributes. Add `Name=\"IncrementButton\"` to the + button and `Name=\"CountText\"` to the TextBlock so `FindControl` works. (If the paper forbids touching the axaml, click via `button.Command!.Execute(null)` after locating it by traversing `window.GetVisualDescendants()`.)" },
  { tip: "Test naming convention the course showed: `Method_Scenario_ExpectedResult` (e.g. `IsPrime_InputIs1_ReturnFalse`). Use it; it reads as intent and may be graded." },
]},

{
id: "pb-async",
title: "Playbook · Problem 3b: async auto-counter task",
cat: "Exam Playbooks",
tags: ["problem 3", "async", "start stop reset", "dispatcher", "ui thread", "100ms"],
related: ["th-ui-thread", "th-cancellation", "th-periodictimer", "ex-reexam-p3-async"],
blocks: [
  { p: "August 2025: Counter app with Start / Stop(Pause) / Reset buttons. Make the number increase by 1 every 100 ms (10 pts), pause resumably (4), reset to zero (4), and keep all UI updates on the UI thread (2)." },
  { h: "Solution A: DispatcherTimer (simplest, recommended)" },
  { code: String.raw`using System;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace Counter.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    [ObservableProperty]
    private int _count = 0;

    private DispatcherTimer? _timer;

    [RelayCommand]
    private void Start()
    {
        if (_timer is { IsEnabled: true }) return;   // guard against double-start

        _timer ??= CreateTimer();
        _timer.Start();
    }

    private DispatcherTimer CreateTimer()
    {
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
        timer.Tick += (_, _) => Count++;   // Tick fires ON the UI thread => thread-safe
        return timer;
    }

    [RelayCommand]
    private void Stop() => _timer?.Stop();     // Count untouched => Start resumes

    [RelayCommand]
    private void Reset() => Count = 0;
}`, lang: "csharp", title: "DispatcherTimer solution — UI-thread requirement satisfied by design" },
  { h: "Solution B: background Task + CancellationToken + Dispatcher" },
  { code: String.raw`using System;
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace Counter.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    [ObservableProperty]
    private int _count = 0;

    private CancellationTokenSource? _cts;

    [RelayCommand]
    private void Start()
    {
        if (_cts is not null) return;            // already running
        _cts = new CancellationTokenSource();
        CancellationToken token = _cts.Token;

        Task.Run(async () =>
        {
            try
            {
                while (!token.IsCancellationRequested)
                {
                    await Task.Delay(100, token);
                    // we are on a thread-pool thread here -> marshal to UI thread:
                    Dispatcher.UIThread.Post(() => Count++);
                }
            }
            catch (OperationCanceledException) { /* expected on Stop */ }
        }, token);
    }

    [RelayCommand]
    private void Stop()
    {
        _cts?.Cancel();
        _cts = null;          // allows Start to run again, Count resumes from last value
    }

    [RelayCommand]
    private void Reset() => Dispatcher.UIThread.Post(() => Count = 0);
}`, lang: "csharp", title: "Task.Run + CTS — shows off cancellation + Dispatcher knowledge" },
  { h: "Solution C: PeriodicTimer on the UI thread" },
  { code: String.raw`private CancellationTokenSource? _cts;

[RelayCommand]
private async Task Start()         // async [RelayCommand] => generates an AsyncRelayCommand
{
    if (_cts is not null) return;
    _cts = new CancellationTokenSource();

    using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(100));
    try
    {
        // awaiting on the UI thread: continuations resume on the UI thread,
        // so Count++ here is already thread-safe.
        while (await timer.WaitForNextTickAsync(_cts.Token))
        {
            Count++;
        }
    }
    catch (OperationCanceledException) { }
    finally
    {
        _cts = null;
    }
}

[RelayCommand]
private void Stop() => _cts?.Cancel();

[RelayCommand]
private void Reset() => Count = 0;`, lang: "csharp", title: "PeriodicTimer — modern and compact" },
  { rule: "The 2 thread-safety points = every mutation of a bound property from a background thread goes through `Dispatcher.UIThread.Post(...)` (or you avoid background threads entirely with DispatcherTimer / awaiting on the UI thread). Write a comment in your code saying which strategy you used — make the grader's job easy." },
  { gotcha: "Button names vs commands: the paper said Pause, the code's button says Stop and binds `StopCommand`. Bind to what the **provided axaml** references, not what the PDF prose calls it." },
]},

{
id: "pb-linq-json",
title: "Playbook · Problem 4: JSON + LINQ console task",
cat: "Exam Playbooks",
tags: ["problem 4", "linq", "json", "deserialize", "queries", "binary search", "console"],
related: ["lq-cookbook", "df-json", "al-search", "ex-june-p4-linq", "ex-reexam-p4-linq"],
blocks: [
  { p: "You get a JSON dataset and 4–5 queries to run and print. June: build the console app + models yourself, **missing values in the data**, plus a binary search. August: starter project given, plus saving all results into one JSON file." },
  { h: "Step-by-step method" },
  { steps: [
    "Open the JSON in a text editor FIRST. Note: property names, nesting, which properties are sometimes missing, date formats.",
    "Write model classes mirroring the JSON. Make anything that can be missing **nullable** (`List<Trip>?`, `DateTime?`).",
    "Deserialize with `JsonSerializer.Deserialize<List<T>>(File.ReadAllText(path))`.",
    "Write each query as its own variable; print results in a labelled `foreach` per query.",
    "If asked to save: build an anonymous object with the required property names and `Serialize` with `WriteIndented = true`.",
  ]},
  { code: String.raw`# create the console app (June style, no starter project)
dotnet new console -o SpaceQueries
cd SpaceQueries
# put the json file next to the .csproj, then make it copy to output:
# <ItemGroup><None Update="spaceships.json" CopyToOutputDirectory="PreserveNewest"/></ItemGroup>
# ...or just read it with a relative path from the project folder while running 'dotnet run'.`, lang: "bash", title: "Project setup" },
  { h: "Defensive models + deserialization (June's 'missing values' points)" },
  { code: String.raw`using System.Text.Json;

public class Spaceship
{
    public string ShipId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";          // "Military" / "Cargo" / "Passenger"
    public List<Trip>? TravelHistory { get; set; }  // some ships have NO TravelHistory at all
}

public class Trip
{
    public string TripId { get; set; } = "";
    public string? DeparturePort { get; set; }
    public string? ArrivalPort { get; set; }
    public DateTime? DepartureDate { get; set; }
    public DateTime? ArrivalDate { get; set; }      // null => currently traveling
}

// in Main:
List<Spaceship> ships =
    JsonSerializer.Deserialize<List<Spaceship>>(File.ReadAllText("spaceships.json"))
    ?? new List<Spaceship>();`, lang: "csharp", title: "Nullable members absorb missing JSON values" },
  { rule: "Null-safe LINQ over optional collections: `s.TravelHistory?.Count ?? 0` and `(s.TravelHistory ?? new()).Any(...)`. This pattern is worth several points whenever the data has holes." },
  { h: "The June queries, solved" },
  { code: String.raw`// 1. All military ships (2 pts)
var military = ships.Where(s => s.Type == "Military").ToList();

// 2. Currently traveling = some trip has no ArrivalDate yet (4 pts)
var traveling = ships
    .Where(s => (s.TravelHistory ?? new()).Any(t => t.ArrivalDate == null))
    .ToList();

// 3. Sorted by number of trips, most at top (4 pts)
var byTrips = ships
    .OrderByDescending(s => s.TravelHistory?.Count ?? 0)
    .ToList();

// 4. Average number of trips per ship type (5 pts)
var avgPerType = ships
    .GroupBy(s => s.Type)
    .Select(g => new { Type = g.Key, AvgTrips = g.Average(s => s.TravelHistory?.Count ?? 0) });

// 5. Ships that departed Ganymede Port in 2245 (5 pts)
var ganymede2245 = ships
    .Where(s => (s.TravelHistory ?? new()).Any(t =>
        t.DeparturePort == "Ganymede Port" && t.DepartureDate?.Year == 2245))
    .ToList();

// printing pattern:
Console.WriteLine("--- 1. Military ships ---");
foreach (var s in military) Console.WriteLine($"{s.Name} ({s.ShipId})");`, lang: "csharp", title: "Queries 1–5 (June 2025, 20 pts)" },
  { h: "The August queries + saving results (25 pts)" },
  { code: String.raw`var vegetarian        = recipes.Where(r => r.DietaryTags.Contains("Vegetarian")).ToList();
var noRestrictions    = recipes.Where(r => r.DietaryTags.Count == 0).ToList();
var sortedByIngCount  = recipes.OrderByDescending(r => r.Ingredients.Count).ToList();

double avg            = recipes.Average(r => r.Ingredients.Count);
var aboveAverage      = recipes.Where(r => r.Ingredients.Count > avg).ToList();

// 4.2 Save ALL results into ONE json file with the exact required keys (5 pts):
var results = new
{
    vegetarianRecipes       = vegetarian,
    noDietaryRestrictions   = noRestrictions,
    sortedByIngredientCount = sortedByIngCount,
    aboveAverageIngredients = aboveAverage
};

File.WriteAllText("Problem_4_Query_Results.json",
    JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true }));`, lang: "csharp", title: "Queries + combined output file (August 2025)" },
  { h: "Binary search by name (June 4.3, 5 pts)" },
  { code: String.raw`// Binary search REQUIRES a sorted list -- sort by the search key first!
var sorted = ships.OrderBy(s => s.Name, StringComparer.Ordinal).ToList();

int BinarySearchByName(List<Spaceship> list, string name)
{
    int lo = 0, hi = list.Count - 1;
    while (lo <= hi)
    {
        int mid = (lo + hi) / 2;
        int cmp = string.Compare(list[mid].Name, name, StringComparison.Ordinal);
        if (cmp == 0) return mid;
        else if (cmp < 0) lo = mid + 1;   // target is in the upper half
        else hi = mid - 1;                // target is in the lower half
    }
    return -1;                            // not found
}

int index = BinarySearchByName(sorted, "Rocinante");
Console.WriteLine(index >= 0
    ? $"Found: {sorted[index].Name} ({sorted[index].ShipId}, {sorted[index].Type})"
    : "Rocinante not found");`, lang: "csharp", title: "Hand-rolled binary search (shows you understand it)" },
  { tip: "Built-in alternative: `sortedNames.BinarySearch(\"Rocinante\")` on a `List<string>`, or `list.BinarySearch(item, comparer)` with an `IComparer<T>`. Hand-rolling is safer for points if the task says 'run a binary search'." },
]},

{
id: "pb-snippet-bank",
title: "Snippet bank: 20 blocks you will paste",
cat: "Exam Playbooks",
tags: ["snippets", "cheat sheet", "copy paste", "quick reference"],
related: ["mv-binding-cookbook", "lq-cookbook", "pb-troubleshoot"],
blocks: [
  { p: "The highest-frequency building blocks across every exam task, in one place. Each is self-contained." },
  { h: "1 · ObservableProperty + RelayCommand pair" },
  { code: String.raw`[ObservableProperty]
private string? inputText;          // generates public string? InputText

[RelayCommand]                      // generates SubmitCommand
private void Submit() { /* ... */ }`, lang: "csharp" },
  { h: "2 · Command with CanExecute that re-evaluates" },
  { code: String.raw`[ObservableProperty]
[NotifyCanExecuteChangedFor(nameof(DecrementCommand))]
private int _count;

[RelayCommand(CanExecute = nameof(CanDecrement))]
private void Decrement() => Count--;

private bool CanDecrement() => Count > 0;`, lang: "csharp" },
  { h: "3 · ObservableCollection bound to a ListBox" },
  { code: String.raw`public ObservableCollection<Contact> Contacts { get; } = new();`, lang: "csharp" },
  { code: String.raw`<ListBox ItemsSource="{Binding Contacts}" SelectedItem="{Binding SelectedContact}"/>`, lang: "xml" },
  { h: "4 · DataTemplate for list items" },
  { code: String.raw`<ListBox ItemsSource="{Binding WeekPlan}">
  <ListBox.ItemTemplate>
    <DataTemplate>
      <StackPanel Orientation="Horizontal" Spacing="6">
        <TextBlock FontWeight="Bold" Text="{Binding Day}"/>
        <TextBlock Text="{Binding RecipeName}"/>
      </StackPanel>
    </DataTemplate>
  </ListBox.ItemTemplate>
</ListBox>`, lang: "xml" },
  { h: "5 · Item class whose changes show up live" },
  { code: String.raw`public partial class RectangleData : ObservableObject
{
    [ObservableProperty] private double _x;
    [ObservableProperty] private double _y;
    [ObservableProperty] private double _width;
    [ObservableProperty] private double _height;
    [ObservableProperty] private IBrush _color = Brushes.Red;
}`, lang: "csharp" },
  { h: "6 · Items on a Canvas at bound positions" },
  { code: String.raw`<ItemsControl ItemsSource="{Binding Rectangles}">
  <ItemsControl.ItemsPanel>
    <ItemsPanelTemplate>
      <Canvas Background="LightGray" Width="500" Height="500"/>
    </ItemsPanelTemplate>
  </ItemsControl.ItemsPanel>
  <ItemsControl.ItemTemplate>
    <DataTemplate DataType="{x:Type models:RectangleData}">
      <Rectangle Width="{Binding Width}" Height="{Binding Height}" Fill="{Binding Color}"/>
    </DataTemplate>
  </ItemsControl.ItemTemplate>
  <ItemsControl.Styles>
    <Style Selector="ContentPresenter" x:DataType="models:RectangleData">
      <Setter Property="Canvas.Left" Value="{Binding X}"/>
      <Setter Property="Canvas.Top" Value="{Binding Y}"/>
    </Style>
  </ItemsControl.Styles>
</ItemsControl>`, lang: "xml" },
  { h: "7 · React to selection (partial method)" },
  { code: String.raw`[ObservableProperty]
private WeeklyItem? selectedRecipe;

partial void OnSelectedRecipeChanged(WeeklyItem? value)
{
    if (value is null) return;
    var recipe = mealPlan.Find(r => r.Name == value.RecipeName);
    if (recipe is not null) SelectedIngredients = recipe.Ingredients;
}`, lang: "csharp" },
  { h: "8 · DispatcherTimer" },
  { code: String.raw`var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
timer.Tick += (_, _) => { /* runs on UI thread */ };
timer.Start();`, lang: "csharp" },
  { h: "9 · Background work without freezing the UI" },
  { code: String.raw`[RelayCommand]
private async Task DoWork()
{
    await Task.Run(() =>
    {
        // heavy CPU work here (off the UI thread)
    });
    StatusText = "Done";   // back on the UI thread after await
}`, lang: "csharp" },
  { h: "10 · Marshal to the UI thread" },
  { code: String.raw`Dispatcher.UIThread.Post(() => Count++);`, lang: "csharp" },
  { h: "11 · Cancellation" },
  { code: String.raw`private CancellationTokenSource? _cts;
// start:
_cts = new CancellationTokenSource();
await Task.Delay(100, _cts.Token);   // throws OperationCanceledException on cancel
// stop:
_cts?.Cancel(); _cts = null;`, lang: "csharp" },
  { h: "12 · lock around shared state" },
  { code: String.raw`private readonly object _lock = new object();
lock (_lock) { sharedCounter++; }`, lang: "csharp" },
  { h: "13 · JSON round-trip" },
  { code: String.raw`var list = JsonSerializer.Deserialize<List<Contact>>(File.ReadAllText("data.json")) ?? new();
File.WriteAllText("data.json", JsonSerializer.Serialize(list, new JsonSerializerOptions { WriteIndented = true }));`, lang: "csharp" },
  { h: "14 · GroupBy + aggregate" },
  { code: String.raw`var perCategory = products
    .GroupBy(p => p.Category)
    .Select(g => new { Category = g.Key, Total = g.Sum(p => p.Price),
                       Avg = g.Average(p => p.Price), Count = g.Count() });`, lang: "csharp" },
  { h: "15 · Join two datasets" },
  { code: String.raw`var report = sales.Join(products,
    sale => sale.ProductId,        // key from outer
    product => product.Id,         // key from inner
    (sale, product) => new { product.Name, sale.QuantitySold,
                             Revenue = product.Price * sale.QuantitySold });`, lang: "csharp" },
  { h: "16 · xUnit test skeleton" },
  { code: String.raw`[Fact]
public void Method_Scenario_ExpectedResult()
{
    var vm = new MainWindowViewModel();   // Arrange
    vm.IncrementCommand.Execute(null);    // Act
    Assert.Equal(1, vm.Count);            // Assert
}`, lang: "csharp" },
  { h: "17 · Headless test boilerplate" },
  { code: String.raw`[assembly: AvaloniaTestApplication(typeof(TestAppBuilder))]
public class TestAppBuilder
{
    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<App>()
        .UseHeadless(new AvaloniaHeadlessPlatformOptions());
}`, lang: "csharp" },
  { h: "18 · Try/catch with specific exception" },
  { code: String.raw`try
{
    string text = File.ReadAllText("data.json");
}
catch (FileNotFoundException)
{
    Console.WriteLine("File does not exist");
}
finally
{
    Console.WriteLine("Cleanup");
}`, lang: "csharp" },
  { h: "19 · IComparable for sortable models" },
  { code: String.raw`public class Party : IComparable
{
    public DateTime Date { get; set; }
    public int CompareTo(object? obj)
    {
        if (obj == null) return 1;
        if (obj is Party other) return Date.CompareTo(other.Date);
        throw new ArgumentException("Object is not a Party");
    }
}`, lang: "csharp" },
  { h: "20 · ToString override for ListBox display" },
  { code: String.raw`public override string ToString() => $"{Name} ({Email})";`, lang: "csharp" },
]},

{
id: "pb-troubleshoot",
title: "When things break: rapid fixes",
cat: "Exam Playbooks",
tags: ["errors", "troubleshooting", "compile error", "binding not working", "fixes", "debug"],
related: ["mv-toolkit-observableproperty", "pb-snippet-bank"],
blocks: [
  { p: "The fastest diagnosis table for the errors that actually happen during this exam." },
  { table: { head: ["Symptom", "Cause", "Fix"], rows: [
    ["'The name InputText does not exist'", "Class not marked `partial`, so the source generator can't add the property", "`public partial class MyViewModel : ViewModelBase`"],
    ["[ObservableProperty] generates nothing", "Field name wrong shape", "Field must be `_camelCase` or `camelCase`; generator emits `PascalCase` property"],
    ["Binding compiles but UI never updates", "Property set bypasses the generated setter (you wrote to the field)", "Assign to the generated PascalCase property: `Count++`, not `_count++`"],
    ["List shows items only after restart", "Bound to `List<T>` or you replaced the ObservableCollection instance", "Use `ObservableCollection<T>`; mutate with Add/Remove/Clear (or make the property `[ObservableProperty]` and assign a new collection)"],
    ["Items added but they never move/recolor", "Item class is a plain POCO", "Make the item `partial class : ObservableObject` with `[ObservableProperty]` members"],
    ["Button does nothing", "Bound to method name while CanExecute exists, or command name typo", "Bind `{Binding FooCommand}`; remember `[RelayCommand] void Foo()` → `FooCommand`"],
    ["Compile error in .axaml binding", "Compiled bindings can't find the property on the `x:DataType`", "Check `x:DataType=\"vm:MainWindowViewModel\"` is present and the property name matches exactly"],
    ["'Call from invalid thread' exception", "UI property touched from Task.Run", "Wrap in `Dispatcher.UIThread.Post(() => ...)`"],
    ["UI freezes during work", "Long synchronous work in a command on the UI thread", "`[RelayCommand] async Task ...` + `await Task.Run(...)`"],
    ["Headless test: NullReference on FindControl", "Control has no `Name` in axaml, or `window.Show()` missing", "Add `Name=\"...\"`, call `window.Show()` before interacting"],
    ["Headless test never runs / dispatcher error", "Used `[Fact]` instead of `[AvaloniaFact]`, or TestAppBuilder missing", "Add the `[assembly: AvaloniaTestApplication]` file and use `[AvaloniaFact]`"],
    ["JSON loads but all properties are null/0", "Property name mismatch (case or spelling)", "Match JSON names exactly, or pass `new JsonSerializerOptions { PropertyNameCaseInsensitive = true }`"],
    ["Deserialize throws on missing field", "Non-nullable type for an optional field", "Make it nullable: `DateTime?`, `List<T>?`, then `?? new()` when querying"],
    ["File not found at runtime", "Relative path resolved from bin/Debug folder", "Run from project dir, copy file to output (`CopyToOutputDirectory`), or adjust the relative path"],
    ["dotnet add package fails (offline)", "No NuGet cache for that package", "Copy the `<PackageReference>` + version from a project that already uses it; the local cache restores it"],
  ]}},
  { h: "Binding debug checklist (60 seconds)" },
  { steps: [
    "Does the Window/UserControl have `x:DataType=\"vm:MainWindowViewModel\"`?",
    "Is the DataContext set (look in App.axaml.cs — read only)?",
    "Is the property `public` and spelled identically in the binding?",
    "Is it an `[ObservableProperty]` (or raises PropertyChanged) if it changes after startup?",
    "For lists: ObservableCollection? For commands: binding the generated `...Command`?",
  ]},
]}

);
