/* ============ MODEL SOLUTIONS - SUMMER 2025 (compile-tested) ============
   Agent 4a. Every code block below was built + run/tested with .NET 9 and
   Avalonia 11.2.1 in "AOP Model Solutions/Summer2025". cat: "Model Solutions".
   Loadable in Node (node --check) and in the browser via a <script> tag after
   index.html sets window.TOPICS = []. */

// Host = window in the browser (index.html already did `window.TOPICS = []`),
// or the Node global in tests (run-tests.js / *.test.js do `global.window = global`).
// Guarding here means the file also loads under a bare `node -e require(...)`.
(typeof window !== "undefined" ? window : globalThis).TOPICS =
  (typeof window !== "undefined" ? window : globalThis).TOPICS || [];

(typeof window !== "undefined" ? window : globalThis).TOPICS.push(

/* ---------------------------------------------------------------- P1 ---- */
{
id: "sol-summer-p1",
title: "Summer 2025 P1 - DocumentManager: model written answer (20 pts)",
cat: "Model Solutions",
tags: ["summer 2025", "problem 1", "documentmanager", "oop analysis", "solid", "design pattern", "written answer", "model solution"],
related: ["sol-summer-p2", "sol-summer-p4", "ex-june-overview", "pb-problem1-analysis"],
blocks: [
  { p: "Problem 1 (20 pts) is a WRITTEN analysis of the console project in `Problem_1_OOP/DocumentManager/`; answers go in `Problem_1_Submission.txt`. Note the Summer rubric differs from the ReExam one: it is 1.1 general (2) + 1.2 interfaces (2) + 1.3 the FOUR basic OOP principles (8) + 1.4 TWO SOLID principles (4) + 1.5 ONE design pattern (4). The model answer below is copied verbatim from the compiled solution's Problem_1_Submission.txt." },
  { rule: "What the code actually contains: small role interfaces `IProcessable` / `ISummarizable` / `IValidatable` and the marker `IDisplayableInfo` (Interfaces.cs) plus `ILogger` (Logger.cs); `Invoice` (implements all four + IDisplayableInfo, has private setters, IsPaid only via MarkAsPaid, computed TotalAmount), `Report` (processable + summarizable + displayable, NOT validatable), `ConsoleLogger : ILogger`, `DocumentProcessor` (ctor-injected ILogger, `is IValidatable` pattern test), `DocumentWorkflowManager` (private List<object> _allDocuments, OfType<T>, generic GetAllDocumentsOfType<T> where T : class, creates its own internal processor), `Program.cs` composition root." },

  { h: "1.1 General Analysis (2 pts)" },
  { p: "The code models a document management / processing workflow for business documents. Different document types (Invoices and Reports) are registered with a central manager, optionally validated, processed (e.g. \"sent\" or \"distributed\"), and summarised - like a back-office system that takes in paperwork, checks it, acts on it, and produces overview summaries." },

  { h: "1.2 Purpose of the interfaces (2 pts)" },
  { p: "Interfaces.cs defines four small capability contracts (and Logger.cs a fifth, ILogger). Each says what a class can do, not what it is: IProcessable (DocumentId + ProcessDocument), ISummarizable (GenerateSummary), IValidatable (Validate -> error list), IDisplayableInfo (empty marker), ILogger (Log)." },
  { p: "Purpose: each document opts in to only the abilities it supports - Invoice is processable, summarizable, validatable and displayable; Report is processable, summarizable and displayable but NOT validatable. DocumentProcessor and DocumentWorkflowManager then work against these abstractions rather than concrete classes, so they handle any current/future document type polymorphically through the capability they need." },

  { h: "1.3 The four basic OOP principles (8 pts: 1 presence + 1 how/where each)" },
  { table: { head: ["Principle", "Present?", "Where / purpose"], rows: [
    ["Encapsulation", "Yes", "Private setters (Invoice.InvoiceNumber/DueDate/LineItems), IsPaid changeable only via MarkAsPaid(), private readonly _logger fields, private _allDocuments list, computed read-only TotalAmount. Purpose: outsiders can't put a document into an invalid state."],
    ["Abstraction", "Yes", "Processor/manager depend only on ILogger / IProcessable / ISummarizable - they never know the concrete Invoice/Report/ConsoleLogger. Purpose: high-level logic written once against contracts, decoupled from implementations."],
    ["Inheritance", "Yes (interface only)", "Every class realises interfaces (Invoice : IProcessable, ISummarizable, IValidatable, IDisplayableInfo; Report : ...; ConsoleLogger : ILogger). State HONESTLY: there is NO class-to-class inheritance. Purpose: a shared type lets Invoice and Report be stored/handled together (List<IProcessable>)."],
    ["Polymorphism", "Yes", "ProcessBatch loops List<IProcessable> calling ProcessDocument(); GenerateSummaries loops List<ISummarizable>; OfType<ISummarizable>(); generic GetAllDocumentsOfType<T>; run-time test `is IValidatable`; ToString() overrides. Purpose: one piece of code handles many types correctly."],
  ]}},
  { tip: "The grader's trap is Inheritance: many students claim full class inheritance. Score the point by being explicit that the only inheritance is interface implementation - that honesty is what earns it." },

  { h: "1.4 Two SOLID principles applied (4 pts)" },
  { list: [
    "**ISP (Interface Segregation)**: instead of one fat IDocument forcing Process+Summarise+Validate on everyone, the design splits them into IProcessable / ISummarizable / IValidatable. That is precisely why Report can avoid a meaningless Validate() - it simply does not implement IValidatable. Benefit: no class is forced to depend on members it doesn't use.",
    "**DIP (Dependency Inversion)**: DocumentProcessor, DocumentWorkflowManager, Invoice and Report all depend on the ILogger abstraction, injected via constructors; only Program.cs picks the concrete ConsoleLogger. Benefit: logging is swappable (file/test logger) and the classes are unit-testable in isolation. (SRP is also defensible: one job per class.)",
  ]},

  { h: "1.5 One design pattern (4 pts)" },
  { p: "**Strategy (with Dependency Injection) via ILogger/ConsoleLogger.** ILogger defines an interchangeable logging behaviour; ConsoleLogger is one concrete strategy; the processing classes hold an ILogger and call Log() without knowing which strategy runs; the concrete one is chosen once in Program.cs and injected. Swapping behaviour = passing a different ILogger, nothing else changes." },
  { p: "Equally valid: **Facade** - DocumentWorkflowManager exposes a simple entry point (RegisterAndProcessDocument, RetrieveAllSummaries) that hides the DocumentProcessor it creates and delegates to internally." },

  { rule: "How to adapt if F26 changes the domain: the structure of the answer is domain-independent. Re-map the four buckets: (1) what does it model, (2) what do the interfaces/abstract types give you, (3) the 4 OOP principles with one concrete code line each (always check inheritance honestly - interface vs class), (4) pick the two SOLID principles the code most clearly shows (ISP when there are many small interfaces, DIP when dependencies are constructor-injected), (5) name the one pattern you can point at in code (Strategy/Facade/DI/Template Method)." },
]},

/* ---------------------------------------------------------------- P2 ---- */
{
id: "sol-summer-p2",
title: "Summer 2025 P2 - RectangleUI: full solution (30 pts)",
cat: "Model Solutions",
tags: ["summer 2025", "problem 2", "rectangleui", "canvas", "itemscontrol", "dispatchertimer", "slider", "random", "clamp", "mvvm", "model solution"],
related: ["sol-summer-p1", "sol-summer-p3", "ex-june-p2-rectangle", "av-itemscontrols", "th-ui-thread"],
blocks: [
  { p: "30 pts total: 2.1 MVVM explanation (5), 2.2 Add button spawns rectangles at random positions, sized by two sliders, ALWAYS fully on the 500x500 canvas (15), 2.3 every 2s all rectangles move + recolour on the UI thread, still fully visible (10). EDIT ONLY: ViewModels/MainWindowViewModel.cs, Models/RectangleData.cs, Views/MainWindow.axaml, Problem_2_Submission.txt. Do NOT touch MainWindow.axaml.cs (code-behind)." },
  { rule: "The .axaml already contains the whole structure (Button, two Sliders, ItemsControl + Canvas ItemsPanelTemplate + ContentPresenter style). Your job is purely to add bindings - 6 edits - and fill in the two empty classes. Do not redesign the layout (\"the original layout should not change\")." },

  { h: "Models/RectangleData.cs (complete)" },
  { code: String.raw`using Avalonia.Media;
using CommunityToolkit.Mvvm.ComponentModel;

namespace RectangleUI.Models;

// The Model holds the data for a single rectangle.
// ObservableObject (via [ObservableProperty]) so that changing the position or
// colour AFTER the rectangle is on screen still updates the View live - this is
// exactly what makes task 2.3 (move + recolour every 2s) work without rebuilding
// the whole collection.
public partial class RectangleData : ObservableObject
{
    [ObservableProperty] private double _x;
    [ObservableProperty] private double _y;
    [ObservableProperty] private double _width;
    [ObservableProperty] private double _height;

    // IBrush (not Color) so the Rectangle's Fill can bind directly, no converter.
    [ObservableProperty] private IBrush _brush = Brushes.Red;
}`, lang: "csharp", title: "RectangleData.cs" },

  { h: "ViewModels/MainWindowViewModel.cs (complete)" },
  { code: String.raw`using System;
using System.Collections.ObjectModel;
using Avalonia.Media;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using RectangleUI.Models;

namespace RectangleUI.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    // The canvas in MainWindow.axaml is fixed at 500x500. Keeping the size as a
    // constant lets us clamp every rectangle so it stays fully inside the canvas.
    private const double CanvasSize = 500;

    private readonly Random _random = new();

    // 2.3 says the colours may just come from a predefined list.
    private readonly IBrush[] _colors =
    {
        Brushes.Red, Brushes.Blue, Brushes.Green,
        Brushes.Orange, Brushes.Purple, Brushes.Gold
    };

    // The View binds its ItemsControl.ItemsSource to this collection.
    // ObservableCollection raises CollectionChanged, so adding a rectangle shows
    // it on the canvas immediately.
    public ObservableCollection<RectangleData> Rectangles { get; } = new();

    // Bound two-way to the two sliders. Defaults match the sliders' Value="50".
    [ObservableProperty] private double _rectWidth = 50;
    [ObservableProperty] private double _rectHeight = 50;

    public MainWindowViewModel()
    {
        // 2.3: a DispatcherTimer raises its Tick event ON the UI thread, so every
        // mutation below happens on the UI thread -> the "changes to the UI happen
        // only on the UI thread" requirement is satisfied by construction.
        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        timer.Tick += (_, _) => ShuffleRectangles();
        timer.Start();
    }

    // The Add button binds to AddRectangleCommand (generated by [RelayCommand]).
    [RelayCommand]
    private void AddRectangle()
    {
        Rectangles.Add(new RectangleData
        {
            Width = RectWidth,
            Height = RectHeight,
            // Clamp so the rectangle is ALWAYS completely visible: max X is
            // (canvas width - rect width), likewise Y. NextDouble() is in [0,1).
            X = _random.NextDouble() * (CanvasSize - RectWidth),
            Y = _random.NextDouble() * (CanvasSize - RectHeight),
            Brush = _colors[_random.Next(_colors.Length)]
        });
    }

    // 2.3: move + recolour every rectangle. Same clamp as Add keeps them on-canvas.
    private void ShuffleRectangles()
    {
        foreach (RectangleData r in Rectangles)
        {
            r.X = _random.NextDouble() * (CanvasSize - r.Width);
            r.Y = _random.NextDouble() * (CanvasSize - r.Height);
            r.Brush = _colors[_random.Next(_colors.Length)];
        }
    }
}`, lang: "csharp", title: "MainWindowViewModel.cs" },

  { h: "Views/MainWindow.axaml - the 6 binding edits (everything else untouched)" },
  { tip: "This is a FRAGMENT of the existing MainWindow.axaml, not a whole file. Paste these edits into the starter Window, which already declares its root namespaces (xmlns, xmlns:x, and the vm/models xmlns the bindings need). Do not submit it as a standalone file." },
  { code: String.raw`<DockPanel LastChildFill="True">
    <StackPanel DockPanel.Dock="Left">
        <Button Margin="10" Content="Add Rectangle"
                Command="{Binding AddRectangleCommand}"/>            <!-- edit 1 -->
        <Slider Margin="10" Value="{Binding RectWidth}"  Minimum="0" Maximum="100"/>  <!-- edit 2 -->
        <Slider Margin="10" Value="{Binding RectHeight}" Minimum="0" Maximum="100"/>  <!-- edit 3 -->
    </StackPanel>

    <Panel>
        <ItemsControl ItemsSource="{Binding Rectangles}">            <!-- edit 4 -->
            <ItemsControl.ItemsPanel>
                <ItemsPanelTemplate>
                    <Canvas Background="LightGray" Width="500" Height="500"/>
                </ItemsPanelTemplate>
            </ItemsControl.ItemsPanel>
            <ItemsControl.ItemTemplate>
                <DataTemplate DataType="{x:Type models:RectangleData}">
                    <Rectangle Width="{Binding Width}" Height="{Binding Height}"
                               Fill="{Binding Brush}" />              <!-- edit 5 (3 binds) -->
                </DataTemplate>
            </ItemsControl.ItemTemplate>
            <ItemsControl.Styles>
                <Style Selector="ContentPresenter" x:DataType="models:RectangleData">
                    <Setter Property="Canvas.Left" Value="{Binding X}"/>   <!-- edit 6 -->
                    <Setter Property="Canvas.Top"  Value="{Binding Y}"/>
                </Style>
            </ItemsControl.Styles>
        </ItemsControl>
    </Panel>
</DockPanel>`, lang: "xml", title: "MainWindow.axaml (bindings filled in)" },

  { rule: "The ContentPresenter style is what positions each item on the Canvas: an ItemsControl wraps every item in a ContentPresenter, so Canvas.Left/Top must be set THERE (bound to X/Y), not on the Rectangle. This is the single most-missed detail in this task." },

  { h: "2.1 MVVM answer (5 pts, write in Problem_2_Submission.txt)" },
  { p: "MVVM separates the UI from the logic/data so they change independently and the logic is unit-testable with no UI. Model (RectangleData) holds one rectangle's data (X, Y, Width, Height, Brush) as an ObservableObject so later changes update the View. ViewModel (MainWindowViewModel) holds presentation state (the Rectangles collection, RectWidth/RectHeight) and logic (AddRectangle command, the 2s DispatcherTimer), exposed via observable properties + a RelayCommand; it never touches controls. View (MainWindow.axaml) declares the layout and connects to the ViewModel only through bindings/commands; change notifications flow back so the UI updates automatically." },

  { rule: "How to adapt if F26 changes the domain: the recipe is fixed regardless of the shape drawn. (1) Make the Model an ObservableObject with [ObservableProperty] for every value the View binds. (2) ViewModel: ObservableCollection<T> + [ObservableProperty] for each input control + [RelayCommand] for each button. (3) For 'always fully visible' clamp position to (containerSize - itemSize). (4) For a periodic UI change use DispatcherTimer (ticks on the UI thread = the thread-safety marks). (5) Position-on-Canvas always goes on the ContentPresenter style via Canvas.Left/Top. Swap 'rectangle' for 'circle/ellipse/image' and only the DataTemplate shape changes." },
]},

/* ---------------------------------------------------------------- P3 ---- */
{
id: "sol-summer-p3",
title: "Summer 2025 P3 - Counter tests: full solution (15 pts)",
cat: "Model Solutions",
tags: ["summer 2025", "problem 3", "counter", "xunit", "headless avalonia", "5 tests", "100 clicks", "canexecute", "model solution"],
related: ["sol-summer-p2", "sol-summer-p4", "ex-june-p3-testing", "pb-unit-testing", "ut-headless"],
blocks: [
  { p: "15 pts: 3.1 create an xUnit project referencing Counter and write 5 specific ViewModel tests (10), 3.2 set up headless Avalonia and simulate clicking the increment button 100 times, checking the output, with the button + output asserted to exist (5). The Counter VM is given: Increment always allowed; Decrement guarded by `CanDecrement() => Count > 0` via `[RelayCommand(CanExecute = nameof(CanDecrement))]`; OnCountChanged calls DecrementCommand.NotifyCanExecuteChanged()." },

  { h: "Create the test project (the offline way)" },
  { code: String.raw`# from Problem_3_UnitTesting/  (versions pinned to the Starter Kit / offline feed)
dotnet new xunit -o Counter.Tests
dotnet add Counter.Tests reference Counter/Counter.csproj
dotnet add Counter.Tests package Avalonia.Headless.XUnit --version 11.2.1
# then pin xunit 2.9.2, xunit.runner.visualstudio 2.8.2, Microsoft.NET.Test.Sdk 17.12.0
dotnet test`, lang: "bash", title: "Setup" },
  { code: String.raw`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
    <PackageReference Include="Avalonia.Headless.XUnit" Version="11.2.1" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\Counter\Counter.csproj" />
  </ItemGroup>
</Project>`, lang: "xml", title: "Counter.Tests.csproj" },

  { h: "3.1 The five \"normal\" (non-Avalonia) ViewModel tests (10 pts)" },
  { code: String.raw`using Counter.ViewModels;
using Xunit;

namespace Counter.Tests;

public class MainWindowViewModelTests
{
    [Fact]
    public void Counter_Is_Initialized_To_Zero()
    {
        var vm = new MainWindowViewModel();
        Assert.Equal(0, vm.Count);
    }

    [Fact]
    public void DecrementCommand_Cannot_Execute_After_Initialization()
    {
        var vm = new MainWindowViewModel();
        // Count starts at 0 and CanDecrement() requires Count > 0.
        Assert.False(vm.DecrementCommand.CanExecute(null));
    }

    [Fact]
    public void IncrementCommand_Increments_Counter_By_One()
    {
        var vm = new MainWindowViewModel();
        vm.IncrementCommand.Execute(null);
        Assert.Equal(1, vm.Count);
    }

    [Fact]
    public void DecrementCommand_Can_Execute_After_Incrementing()
    {
        var vm = new MainWindowViewModel();
        vm.IncrementCommand.Execute(null);
        Assert.True(vm.DecrementCommand.CanExecute(null));   // Count is now 1
    }

    [Fact]
    public void DecrementCommand_Decrements_Counter_By_One()
    {
        var vm = new MainWindowViewModel();
        vm.IncrementCommand.Execute(null);   // bring Count to 1 so we may decrement
        vm.DecrementCommand.Execute(null);
        Assert.Equal(0, vm.Count);
    }
}`, lang: "csharp", title: "MainWindowViewModelTests.cs - all 5 tests" },

  { h: "3.2 Headless Avalonia: link the app + the 100-click UI test (5 pts)" },
  { p: "First add `x:Name` to the controls in Counter/Views/MainWindow.axaml so the test can find them and assert they exist (the only change to the Counter app, and only naming): `<TextBlock x:Name=\"CountText\" .../>` and `<Button x:Name=\"IncrementButton\" .../>`." },
  { code: String.raw`using Avalonia;
using Avalonia.Headless;
using Counter;
using Counter.Tests;

// Links the headless tests to the Counter application. The
// [AvaloniaTestApplication] attribute is declared exactly once per test project.
[assembly: AvaloniaTestApplication(typeof(TestAppBuilder))]

namespace Counter.Tests;

public class TestAppBuilder
{
    public static AppBuilder BuildAvaloniaApp() => AppBuilder
        .Configure<App>()
        .WithInterFont()   // a font manager so TextBlock layout/measure works headless
        .UseHeadless(new AvaloniaHeadlessPlatformOptions());
}`, lang: "csharp", title: "TestAppBuilder.cs" },
  { code: String.raw`using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Counter.ViewModels;
using Counter.Views;
using Xunit;

namespace Counter.Tests;

public class MainWindowHeadlessTests
{
    [AvaloniaFact]                       // runs the body on the Avalonia UI thread
    public void Clicking_Increment_100_Times_Shows_100()
    {
        var window = new MainWindow { DataContext = new MainWindowViewModel() };
        window.Show();
        window.UpdateLayout();

        // PDF requirement: make sure the button and the output actually exist.
        var incrementButton = window.FindControl<Button>("IncrementButton");
        var countText = window.FindControl<TextBlock>("CountText");
        Assert.NotNull(incrementButton);
        Assert.NotNull(countText);

        // Activate the increment button 100 times. The button is focused and
        // activated with Space, which routes through the SAME Button activation
        // pipeline (Button.OnKeyDown -> Click -> IncrementCommand) as a mouse click.
        // Keyboard activation is used because the headless renderer does not reliably
        // hit-test a synthetic mouse pointer against this nested DockPanel/StackPanel/
        // Grid layout, whereas focus + Space is deterministic.
        incrementButton!.Focus();
        for (int i = 0; i < 100; i++)
        {
            window.KeyPress(Key.Space, RawInputModifiers.None, PhysicalKey.Space, " ");
            window.KeyRelease(Key.Space, RawInputModifiers.None, PhysicalKey.Space, " ");
        }

        var vm = (MainWindowViewModel)window.DataContext!;
        Assert.Equal(100, vm.Count);             // the ViewModel counted to 100
        Assert.Equal("100", countText!.Text);    // and the output displays it
    }
}`, lang: "csharp", title: "MainWindowHeadlessTests.cs" },
  { gotcha: "If you prefer to keep mouse syntax for the marks, `window.MouseDown(point, MouseButton.Left); window.MouseUp(point, MouseButton.Left);` is the documented API and works for a simple stretched button - but on THIS Counter layout the headless pointer hit-test silently misses, so the count stays 0. Verified: focus + Space reliably reaches 100. Either way assert BOTH vm.Count and the bound TextBlock.Text so the 'output' is genuinely checked." },
  { rule: "How to adapt if F26 changes the domain: 3.1 is always 'new the VM, drive the commands, assert state' - read the given VM, mirror each bullet to one [Fact] (init value, a CanExecute guard before, the command effect, the guard after, the reverse command). 3.2 boilerplate is fixed: TestAppBuilder + [assembly: AvaloniaTestApplication], [AvaloniaFact], name the controls, FindControl + Assert.NotNull, drive the interaction N times, assert VM state AND the bound output text. Pin all package versions to the Starter Kit." },
]},

/* ---------------------------------------------------------------- P4 ---- */
{
id: "sol-summer-p4",
title: "Summer 2025 P4 - Spaceships JSON+LINQ: full solution (35 pts)",
cat: "Model Solutions",
tags: ["summer 2025", "problem 4", "spaceships", "json", "linq", "binary search", "rocinante", "missing values", "groupby average", "model solution"],
related: ["sol-summer-p1", "sol-summer-p3", "ex-june-p4-linq", "pb-linq-json", "al-search"],
blocks: [
  { p: "35 pts: 4.1 parse spaceships.json into a list, handling missing values (10); 4.2 five LINQ queries (20: military 2, currently-travelling 4, sorted-by-trips 4, average-trips-per-type 5, departed Ganymede in 2245 5); 4.3 binary search for \"Rocinante\" (5). Data: 20 ships (ShipId, Name, Type, optional TravelHistory[]). Planted gaps: 4 ships have NO TravelHistory; one Military ship (SHP-MIL-005) has NO Name; travelling ships have a final trip with NO ArrivalDate. Make every maybe-missing field nullable so deserialize never throws." },
  { gotcha: "The PDF calls the file `spaceship.json` (singular) but the real file is `spaceships.json`. Check the actual name in /data before hardcoding the path." },

  { h: "Spaceships.csproj - copy the data file next to the exe" },
  { code: String.raw`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net9.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <None Include="..\data\spaceships.json">
      <Link>spaceships.json</Link>
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    </None>
  </ItemGroup>
</Project>`, lang: "xml", title: "Spaceships.csproj" },

  { h: "Program.cs (complete, compile-tested)" },
  { code: String.raw`using System.Text.Json;
using System.Text.Json.Serialization;

namespace Spaceships;

internal class Program
{
    private static void Main()
    {
        // ---- 4.1 Parse JSON into a list (10 pts) ----
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        // Resolve next to the exe so it works via dotnet run or a double-click.
        string jsonPath = Path.Combine(AppContext.BaseDirectory, "spaceships.json");
        List<Spaceship> ships =
            JsonSerializer.Deserialize<List<Spaceship>>(File.ReadAllText(jsonPath), options)
            ?? new List<Spaceship>();

        // ---- 4.2 Run Queries (20 pts) ----

        // 1. All military ships. (2)
        List<Spaceship> military = ships.Where(s => s.Type == "Military").ToList();

        // 2. Currently travelling: a trip with no arrival date yet. (4)
        List<Spaceship> traveling = ships
            .Where(s => s.Trips.Any(t => t.ArrivalDate == null)).ToList();

        // 3. Sorted by number of trips, most first. (4)
        List<Spaceship> byTrips = ships
            .OrderByDescending(s => s.Trips.Count).ToList();

        // 4. Average number of trips per ship type. (5)
        var avgPerType = ships
            .GroupBy(s => s.Type ?? "Unknown")
            .Select(g => new { Type = g.Key, Average = g.Average(s => s.Trips.Count) })
            .ToList();

        // 5. Departed Ganymede Port in the year 2245. (5)
        List<Spaceship> ganymede2245 = ships
            .Where(s => s.Trips.Any(t =>
                t.DeparturePort == "Ganymede Port" && t.DepartureDate?.Year == 2245))
            .ToList();

        // ---- print everything ----
        military.ForEach(s => Console.WriteLine($"Military: {s.DisplayName} ({s.ShipId})"));
        traveling.ForEach(s => Console.WriteLine($"Travelling: {s.DisplayName}"));
        byTrips.ForEach(s => Console.WriteLine($"{s.DisplayName}: {s.Trips.Count} trips"));
        foreach (var row in avgPerType) Console.WriteLine($"{row.Type}: {row.Average:F2}");
        ganymede2245.ForEach(s => Console.WriteLine($"Ganymede 2245: {s.DisplayName}"));

        // ---- 4.3 Binary search for "Rocinante" (5 pts) ----
        // Binary search needs a SORTED list: sort by Name with a null-safe Ordinal
        // comparer (one ship has no Name), then search with the same comparison.
        List<Spaceship> sortedByName = ships
            .OrderBy(s => s.Name, StringComparer.Ordinal).ToList();
        int index = BinarySearchByName(sortedByName, "Rocinante");
        Console.WriteLine(index >= 0
            ? $"Found: {sortedByName[index].Name} ({sortedByName[index].ShipId}, {sortedByName[index].Type})"
            : "Rocinante not found");
    }

    private static int BinarySearchByName(List<Spaceship> sortedByName, string target)
    {
        int low = 0, high = sortedByName.Count - 1;
        while (low <= high)
        {
            int mid = low + (high - low) / 2;
            int cmp = string.Compare(sortedByName[mid].Name ?? "", target, StringComparison.Ordinal);
            if (cmp == 0) return mid;
            if (cmp < 0) low = mid + 1; else high = mid - 1;
        }
        return -1;
    }
}

// 4.1: every field the JSON might omit is nullable, so a missing value
// deserializes to null instead of throwing.
public class Spaceship
{
    public string? ShipId { get; set; }
    public string? Name { get; set; }
    public string? Type { get; set; }
    public List<Trip>? TravelHistory { get; set; }

    [JsonIgnore] public List<Trip> Trips => TravelHistory ?? new List<Trip>();
    [JsonIgnore] public string DisplayName => Name ?? "(unnamed)";
}

public class Trip
{
    public string? TripId { get; set; }
    public string? DeparturePort { get; set; }
    public string? ArrivalPort { get; set; }
    public DateTime? DepartureDate { get; set; }
    public DateTime? ArrivalDate { get; set; }   // null = still travelling
}`, lang: "csharp", title: "Program.cs - complete solution" },

  { h: "Verified output on the real data (20 ships)" },
  { list: [
    "**Military (6)**: Aegis Hammer, UNN Scimitar, MCRN Donnager, Rocinante, (unnamed SHP-MIL-005), Earth Defense Monitor.",
    "**Currently travelling (5)**: Belt Hauler, Jupiter Ore Carrier, Titan Gas Hauler, Neptune Voyager, Belt Tourist (each has a last trip with no ArrivalDate).",
    "**Most trips**: Belt Hauler 5, then several with 4/3; the 4 ships with no TravelHistory show 0.",
    "**Average trips/type**: Cargo 3.25, Military 1.00, Passenger 3.17.",
    "**Departed Ganymede in 2245 (4)**: Jupiter Ore Carrier, Outer Rim Runner, Io Sulphur Tanker, Ganymede Flyer.",
    "**Binary search**: Found Rocinante (SHP-MIL-004, Military).",
  ]},
  { tip: "The DepartureDate?.Year == 2245 works because every date string is \"2245-MM-DD\", so JSON binds it straight to DateTime?. The null-safe Trips property (TravelHistory ?? new()) is what stops the four no-history ships from throwing in queries 2-5 and lets them count as 0 trips in query 3." },
  { rule: "How to adapt if F26 changes the domain: keep the 4-step skeleton. (1) Make every maybe-missing property nullable; add a non-null convenience accessor for any list you query (`Items => RawItems ?? new()`). (2) Map each requested query to one LINQ chain: Where for filters, OrderBy[Descending] for sorts, GroupBy + Select + Average/Count for per-group stats, Any for 'has a child matching'. (3) For 'currently X / not yet Y' look for the planted null field. (4) Binary search = OrderBy the key first (null-safe comparer), then the standard low/high loop using the SAME comparison. Print clearly labelled sections." },
]}

);
