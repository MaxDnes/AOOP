/* ============ PAST EXAMS (FULL WALKTHROUGHS) ============ */

window.TOPICS.push(

{
id: "ex-june-overview",
title: "June 2025 exam: all problems + answers",
cat: "Past Exams",
tags: ["june 2025", "summer exam", "documentmanager", "rectangleui", "counter", "spaceships"],
related: ["ex-june-p2-rectangle", "ex-june-p3-testing", "ex-june-p4-linq", "pb-problem1-analysis"],
blocks: [
  { p: "Spring/Summer examination, 10 June 2025. 100 points. Aids: C#, .NET System library, Avalonia, CommunityToolkit.Mvvm." },
  { table: { head: ["Problem", "Points", "Folder"], rows: [
    ["1 · OO Analysis (DocumentManager)", "20", "Problem_1_OOP — answers in Problem_1_Submission.txt"],
    ["2 · UI (RectangleUI)", "30", "Problem_2_UI"],
    ["3 · Unit Testing (Counter)", "15", "Problem_3_UnitTesting"],
    ["4 · JSON & LINQ (spaceships)", "35", "Problem_4_LINQ"],
  ]}},
  { h: "Problem 1: the DocumentManager analysis (20 pts)" },
  { p: "Console app: Invoices and Reports registered, validated, processed, summarized. Key classes: small role interfaces (`IProcessable`, `ISummarizable`, `IValidatable`, `IDisplayableInfo`), `ILogger`/`ConsoleLogger`, `DocumentProcessor` (pattern-matches `is IValidatable` before processing), `DocumentWorkflowManager` (holds `List<object>`, uses `OfType<T>()`, generic `GetAllDocumentsOfType<T>() where T : class`)." },
  { list: [
    "**1.1 What it models (2)**: a document management/workflow system for business documents (invoices, reports): register, validate, process, summarize.",
    "**1.2 Purpose of the interfaces (2)**: capability contracts; classes opt into only what they support (Report has no Validate); processor/manager work against abstractions → polymorphic, extensible handling.",
    "**1.3 Four OO principles (8)**: all present. Encapsulation: private setters (`Invoice.IsPaid` changed only via `MarkAsPaid()`), private `_logger`/`_allDocuments`. Abstraction: ILogger/IProcessable hide implementations. Inheritance: interface realization (`Invoice : IProcessable, ...`, `ConsoleLogger : ILogger`); note there is NO class-class inheritance, say so. Polymorphism: batch processing via `List<IProcessable>`, `OfType<T>()`, `is`-pattern matching, ToString overrides.",
    "**1.4 Two SOLID principles (4)**: best picks are ISP (many small capability interfaces instead of one fat IDocument) and DIP (ILogger injected via constructors everywhere; concrete ConsoleLogger chosen only in Program.cs). SRP also defensible.",
    "**1.5 One design pattern (4)**: Strategy via ILogger/ConsoleLogger (swappable behavior behind an interface), or Facade via DocumentWorkflowManager, or Dependency Injection. Name one, point at the code, state its role.",
  ]},
  { h: "Problems 2–4" },
  { p: "Full solutions: [[ex-june-p2-rectangle|Problem 2 RectangleUI]], [[ex-june-p3-testing|Problem 3 testing]], [[ex-june-p4-linq|Problem 4 spaceships]]." },
]},

{
id: "ex-june-p2-rectangle",
title: "June P2 · RectangleUI: full solution",
cat: "Past Exams",
tags: ["rectangleui", "canvas", "random position", "dispatchertimer", "slider", "add rectangle", "solution"],
related: ["av-itemscontrols", "pb-avalonia-ui", "th-ui-thread"],
blocks: [
  { p: "Task: Add button spawns rectangles at random positions on a 500×500 canvas, sized by two sliders, always fully visible (15 pts). Every 2 seconds all rectangles move and change color, UI responsive, UI-thread-safe (10 pts). MVVM explanation (5 pts). Only touch MainWindowViewModel.cs, RectangleData.cs, MainWindow.axaml." },
  { h: "Models/RectangleData.cs" },
  { code: String.raw`using Avalonia.Media;
using CommunityToolkit.Mvvm.ComponentModel;

namespace RectangleUI.Models;

// ObservableObject so position/color changes update the UI live (task 2.3!)
public partial class RectangleData : ObservableObject
{
    [ObservableProperty] private double _x;
    [ObservableProperty] private double _y;
    [ObservableProperty] private double _width;
    [ObservableProperty] private double _height;
    [ObservableProperty] private IBrush _color = Brushes.Red;
}`, lang: "csharp", title: "RectangleData.cs — complete" },
  { h: "ViewModels/MainWindowViewModel.cs" },
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
    private const double CanvasSize = 500;       // canvas is 500x500 in the axaml

    private readonly Random _random = new();
    private readonly IBrush[] _colors =
    {
        Brushes.Red, Brushes.Blue, Brushes.Green, Brushes.Orange, Brushes.Purple
    };

    public ObservableCollection<RectangleData> Rectangles { get; } = new();

    // bound to the two sliders (start at their Value="50")
    [ObservableProperty] private double _rectWidth = 50;
    [ObservableProperty] private double _rectHeight = 50;

    public MainWindowViewModel()
    {
        // 2.3: DispatcherTimer ticks ON the UI thread -> thread-safety requirement met
        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        timer.Tick += (_, _) => ShuffleRectangles();
        timer.Start();
    }

    [RelayCommand]
    private void AddRectangle()
    {
        // clamp so the rectangle is ALWAYS fully inside the canvas:
        Rectangles.Add(new RectangleData
        {
            Width  = RectWidth,
            Height = RectHeight,
            X = _random.NextDouble() * (CanvasSize - RectWidth),
            Y = _random.NextDouble() * (CanvasSize - RectHeight),
            Color = _colors[_random.Next(_colors.Length)]
        });
    }

    private void ShuffleRectangles()
    {
        foreach (var r in Rectangles)
        {
            r.X = _random.NextDouble() * (CanvasSize - r.Width);
            r.Y = _random.NextDouble() * (CanvasSize - r.Height);
            r.Color = _colors[_random.Next(_colors.Length)];
        }
    }
}`, lang: "csharp", title: "MainWindowViewModel.cs — complete" },
  { h: "Views/MainWindow.axaml (bindings filled in)" },
  { code: String.raw`<DockPanel LastChildFill="True">
    <StackPanel DockPanel.Dock="Left">
        <Button Margin="10" Content="Add Rectangle"
                Command="{Binding AddRectangleCommand}"/>
        <Slider Margin="10" Value="{Binding RectWidth}"  Minimum="0" Maximum="100"/>
        <Slider Margin="10" Value="{Binding RectHeight}" Minimum="0" Maximum="100"/>
    </StackPanel>

    <Panel>
        <ItemsControl ItemsSource="{Binding Rectangles}">
            <ItemsControl.ItemsPanel>
                <ItemsPanelTemplate>
                    <Canvas Background="LightGray" Width="500" Height="500"/>
                </ItemsPanelTemplate>
            </ItemsControl.ItemsPanel>
            <ItemsControl.ItemTemplate>
                <DataTemplate DataType="{x:Type models:RectangleData}">
                    <Rectangle Width="{Binding Width}" Height="{Binding Height}"
                               Fill="{Binding Color}"/>
                </DataTemplate>
            </ItemsControl.ItemTemplate>
            <ItemsControl.Styles>
                <Style Selector="ContentPresenter" x:DataType="models:RectangleData">
                    <Setter Property="Canvas.Left" Value="{Binding X}"/>
                    <Setter Property="Canvas.Top"  Value="{Binding Y}"/>
                </Style>
            </ItemsControl.Styles>
        </ItemsControl>
    </Panel>
</DockPanel>`, lang: "xml", title: "The starter axaml with the 6 binding edits (everything else untouched)" },
  { rule: "The starter file already contained the entire structure: your edits are exactly: Button Command, two Slider Values, ItemsSource, three bindings in the DataTemplate, two in the ContentPresenter style. Don't redesign the layout (\"the original layout should not change\")." },
  { h: "2.1 MVVM answer (5 pts, write in Problem_2_Submission.txt)" },
  { p: "MVVM separates UI from logic. The **Model** (RectangleData) holds the data for one rectangle. The **ViewModel** (MainWindowViewModel) holds presentation state (the rectangle collection, slider values) and logic (add/shuffle commands), exposing them via observable properties; it never touches controls. The **View** (MainWindow.axaml) declares the layout and connects to the ViewModel purely through data bindings and commands; property-change notifications flow back, so the UI updates automatically. Benefits: logic is unit-testable without UI, and View/logic can change independently." },
]},

{
id: "ex-june-p3-testing",
title: "June P3 · Counter tests: full solution",
cat: "Past Exams",
tags: ["counter", "xunit", "headless", "5 tests", "100 clicks", "solution"],
related: ["pb-unit-testing", "ut-headless", "mv-relaycommand"],
blocks: [
  { p: "Given: the Counter app (Increment always allowed; Decrement guarded by `Count > 0` via CanExecute). Tasks: create an xUnit project referencing Counter, write 5 specific VM tests (10 pts); set up headless Avalonia and simulate 100 clicks (5 pts)." },
  { p: "The system under test (provided, do not modify) is the CanExecute Counter ViewModel: see [[mv-relaycommand|RelayCommand & CanExecute]] for it verbatim." },
  { code: String.raw`dotnet new xunit -o Counter.Tests
dotnet add Counter.Tests reference Counter/Counter.csproj
dotnet add Counter.Tests package Avalonia.Headless.XUnit --version 11.2.1
dotnet test`, lang: "bash", title: "Setup" },
  { p: "The five required tests + the headless 100-click test are written out, complete and copy-ready, in [[pb-unit-testing|the testing playbook]]. Remember the extra requirement: \"make sure that the button and the output actually exist\" → `Assert.NotNull(button)` / `Assert.NotNull(output)` after FindControl, which means adding `Name=\"IncrementButton\"` / `Name=\"CountText\"` to the axaml first." },
]},

{
id: "ex-june-p4-linq",
title: "June P4 · Spaceships: full solution",
cat: "Past Exams",
tags: ["spaceships", "json", "linq", "rocinante", "binary search", "missing values", "solution"],
related: ["pb-linq-json", "al-search", "df-json"],
blocks: [
  { p: "35 points: parse `spaceships.json` into a list handling **missing values** (10), five queries (20), binary search for \"Rocinante\" (5). Data shape: 20 ships (`ShipId`, `Name`, `Type`, optional `TravelHistory` array of trips with optional `ArrivalDate`). 4 ships have NO TravelHistory property; ships still traveling have a trip without ArrivalDate. Rocinante = SHP-MIL-004, Military, 3 trips." },
  { code: String.raw`using System.Text.Json;

internal class Program
{
    public static void Main()
    {
        List<Spaceship> ships =
            JsonSerializer.Deserialize<List<Spaceship>>(File.ReadAllText("spaceships.json"))
            ?? new List<Spaceship>();

        // ---- 4.2 queries ----

        Console.WriteLine("--- 1. Military ships ---");
        var military = ships.Where(s => s.Type == "Military").ToList();
        military.ForEach(s => Console.WriteLine($"{s.Name} ({s.ShipId})"));

        Console.WriteLine("--- 2. Currently traveling (no arrival date yet) ---");
        var traveling = ships
            .Where(s => (s.TravelHistory ?? new()).Any(t => t.ArrivalDate == null))
            .ToList();
        traveling.ForEach(s => Console.WriteLine(s.Name));

        Console.WriteLine("--- 3. Sorted by number of trips (most first) ---");
        var byTrips = ships.OrderByDescending(s => s.TravelHistory?.Count ?? 0).ToList();
        byTrips.ForEach(s => Console.WriteLine($"{s.Name}: {s.TravelHistory?.Count ?? 0} trips"));

        Console.WriteLine("--- 4. Average trips per ship type ---");
        var avgPerType = ships
            .GroupBy(s => s.Type)
            .Select(g => new { Type = g.Key, Avg = g.Average(s => s.TravelHistory?.Count ?? 0) });
        foreach (var row in avgPerType)
            Console.WriteLine($"{row.Type}: {row.Avg:F2}");

        Console.WriteLine("--- 5. Departed Ganymede Port in 2245 ---");
        var ganymede = ships
            .Where(s => (s.TravelHistory ?? new()).Any(t =>
                t.DeparturePort == "Ganymede Port" && t.DepartureDate?.Year == 2245))
            .ToList();
        ganymede.ForEach(s => Console.WriteLine(s.Name));

        // ---- 4.3 binary search ----
        var sorted = ships.OrderBy(s => s.Name, StringComparer.Ordinal).ToList();
        int index = BinarySearchByName(sorted, "Rocinante");
        Console.WriteLine(index >= 0
            ? $"Found: {sorted[index].Name} ({sorted[index].ShipId}, {sorted[index].Type})"
            : "Rocinante not found");
    }

    static int BinarySearchByName(List<Spaceship> list, string name)
    {
        int lo = 0, hi = list.Count - 1;
        while (lo <= hi)
        {
            int mid = (lo + hi) / 2;
            int cmp = string.Compare(list[mid].Name, name, StringComparison.Ordinal);
            if (cmp == 0) return mid;
            else if (cmp < 0) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }
}

public class Spaceship
{
    public string ShipId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public List<Trip>? TravelHistory { get; set; }    // nullable: some ships lack it
}

public class Trip
{
    public string TripId { get; set; } = "";
    public string? DeparturePort { get; set; }
    public string? ArrivalPort { get; set; }
    public DateTime? DepartureDate { get; set; }
    public DateTime? ArrivalDate { get; set; }        // null = still traveling
}`, lang: "csharp", title: "Program.cs — complete solution" },
  { gotcha: "The PDF calls the file `spaceship.json` but the actual file is `spaceships.json`. Check the real filename in the data folder before hardcoding paths." },
]},

{
id: "ex-reexam-overview",
title: "August 2025 re-exam: all problems + answers",
cat: "Past Exams",
tags: ["august 2025", "reexam", "familymealplanner", "solid analysis", "submission format"],
related: ["ex-reexam-p2-mealplanner", "ex-reexam-p3-async", "ex-reexam-p4-linq", "solid-lsp"],
blocks: [
  { p: "Summer examination (re-exam), 18 August 2025. 100 points. Same aids. One domain across the paper: FamilyMealPlanner." },
  { table: { head: ["Problem", "Points", "Submission file(s)"], rows: [
    ["1 · SOLID analysis (FamilyMealPlanner)", "25", "Problem_1_Submission.txt"],
    ["2 · UI (FamilyMealPlannerUI)", "30", "Problem_2_MainWindowViewModel.cs + Problem_2_MainWindow.axaml"],
    ["3 · Async (Counter auto-increment)", "20", "Problem_3_MainWindowViewModel.cs"],
    ["4 · LINQ (recipes)", "25", "Problem_4_Program.cs + Problem_4_Query_Results.json"],
  ]}},
  { gotcha: "Submission format was STRICT: a flat folder with exactly those 6 files, no bin/obj. Verify names character by character before handing in." },
  { h: "Problem 1: SOLID on FamilyMealPlanner (25 pts: 1+2+2 per principle)" },
  { p: "The codebase: `IRecipeFinder` / `INotifier` / `IDietaryRule` interfaces; `VegetarianRule` + `NutAllergyRule`; `InMemoryRecipeRepository` (11 hardcoded recipes, hardcodes filtering inline, has non-interface `GetRandomRecipe`); `MealPlanner` (constructor-injects finder+notifier+rules, but downcasts to the concrete repo and never uses `_rules`); `ShoppingListGenerator` (Distinct+OrderBy ingredients); `Program.cs` composition root." },
  { p: "Per-principle model answers (state / where / purpose) are written out in [[pb-problem1-analysis|the Problem 1 playbook]]. Summary verdicts: SRP present (one job per class). OCP present via IDietaryRule but undermined (repository hardcodes filtering; rules injected but unused). LSP **violated** (the `as InMemoryRecipeRepository` downcast + error branch). ISP present (three small interfaces). DIP partially present (constructor injection done right, then broken by the downcast because GetRandomRecipe is missing from the interface)." },
]},

{
id: "ex-reexam-p2-mealplanner",
title: "August P2 · MealPlanner UI: official solution",
cat: "Past Exams",
tags: ["familymealplannerui", "weeklyitem", "shopping list", "selecteditems", "master detail", "official solution"],
related: ["pb-avalonia-ui", "av-itemscontrols", "mv-toolkit-observableproperty"],
blocks: [
  { p: "Task: two ListBoxes (weekly meal plan left, combined shopping list right) + Generate button (10 pts layout, 10 pts functionality, generate on startup). Advanced: selecting a recipe highlights its ingredients in the shopping list (10 pts). This is the **lecturer's own solution** from ReExam_Problem2_Solution.zip." },
  { h: "ViewModels/Problem_2_MainWindowViewModel.cs (official)" },
  { code: String.raw`using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using FamilyMealPlannerUI.Models;

namespace FamilyMealPlannerUI.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    public IRecipeFinder RecipeRepo { get; }
    public MealPlanner Planner { get; }
    public ShoppingListGenerator ShoppingListGenerator { get; }
    public List<IDietaryRule> Rules { get; }
    public FamilyProfile Family { get; }
    private readonly string[] daysOfWeek =
        { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" };

    private List<Recipe> mealPlan = [];

    [ObservableProperty]
    private List<string> shoppingList = [];

    [ObservableProperty]
    private List<WeeklyItem> weekPlan = [];

    [ObservableProperty]
    public WeeklyItem? selectedRecipe;

    [ObservableProperty]
    private List<string> selectedIngredients = [];

    public MainWindowViewModel(IRecipeFinder recipeRepo, MealPlanner planner,
        FamilyProfile family, ShoppingListGenerator shoppingListGenerator,
        List<IDietaryRule> rules)
    {
        RecipeRepo = recipeRepo;
        Planner = planner;
        Family = family;
        ShoppingListGenerator = shoppingListGenerator;
        Rules = rules;

        CreateWeeklyPlan();          // startup requirement: plan exists immediately
    }

    [RelayCommand]
    public void CreateWeeklyPlan()
    {
        mealPlan = Planner.GenerateWeeklyPlan(Family, 7);

        List<WeeklyItem> newMealPlan = [];
        for (int i = 0; i < 7; i++)
        {
            newMealPlan.Add(new WeeklyItem
            {
                Day = daysOfWeek[i],
                RecipeName = mealPlan[i].Name
            });
        }

        WeekPlan = newMealPlan;                              // assign NEW list -> notifies
        ShoppingList = ShoppingListGenerator.Generate(mealPlan);
    }

    partial void OnSelectedRecipeChanged(WeeklyItem value)
    {
        if (mealPlan is not null)
        {
            Recipe selectedRecipe = mealPlan.Find(r => r.Name == value.RecipeName);
            if (selectedRecipe is not null)
                SelectedIngredients = selectedRecipe.Ingredients;   // highlights rows
        }
    }
}`, lang: "csharp", title: "Official solution ViewModel, verbatim" },
  { h: "Views/Problem_2_MainWindow.axaml (official)" },
  { code: String.raw`<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="using:FamilyMealPlannerUI.ViewModels"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        mc:Ignorable="d" d:DesignWidth="800" d:DesignHeight="450"
        x:Class="FamilyMealPlannerUI.Views.MainWindow"
        x:DataType="vm:MainWindowViewModel"
        Icon="/Assets/avalonia-logo.ico"
        Title="FamilyMealPlannerUI">

    <Design.DataContext>
        <vm:MainWindowViewModel/>
    </Design.DataContext>

    <Window.Styles>
        <Style Selector="TextBlock"><Setter Property="Margin" Value="20"/></Style>
        <Style Selector="Button"><Setter Property="Margin" Value="20"/></Style>
        <Style Selector="ListBox"><Setter Property="Margin" Value="20"/></Style>
    </Window.Styles>

    <DockPanel>
        <StackPanel Background="Gray" Width="400" DockPanel.Dock="Right">
            <TextBlock Text="Shopping List" FontWeight="Bold"/>
            <ListBox SelectedItems="{Binding SelectedIngredients}"
                     SelectionMode="Multiple"
                     ItemsSource="{Binding ShoppingList}"/>
        </StackPanel>
        <StackPanel>
            <TextBlock Text="Meal Plan" FontWeight="Bold"/>
            <ListBox SelectedItem="{Binding SelectedRecipe}"
                     ItemsSource="{Binding WeekPlan}">
                <ListBox.ItemTemplate>
                    <DataTemplate>
                        <StackPanel Orientation="Horizontal">
                            <TextBlock FontWeight="Bold" Text="{Binding Day}"/>
                            <TextBlock Text="{Binding RecipeName}"/>
                        </StackPanel>
                    </DataTemplate>
                </ListBox.ItemTemplate>
            </ListBox>
            <Button Command="{Binding CreateWeeklyPlanCommand}" Content="Generate Mealplan"/>
        </StackPanel>
    </DockPanel>
</Window>`, lang: "xml", title: "Official solution View, verbatim" },
  { list: [
    "Techniques on display: `[ObservableProperty]` on whole lists + assigning NEW lists to notify; `[RelayCommand]` → `CreateWeeklyPlanCommand`; ItemTemplate with item-scoped bindings; `SelectionMode=\"Multiple\"` + `SelectedItems` for the highlight trick; `OnSelectedRecipeChanged` partial method for master-detail; constructor calls the command method for the startup requirement.",
    "Provided helper `WeeklyItem`: `partial class : ObservableObject` with `[ObservableProperty] _day`, `_recipeName` and `ToString() => $\"{Day}: {RecipeName}\"`. The PDF calls it `WeekDayItem`; the code says `WeeklyItem`. Follow the code.",
  ]},
]},

{
id: "ex-reexam-p3-async",
title: "August P3 · Async counter: solution",
cat: "Past Exams",
tags: ["async counter", "start stop reset", "100ms", "thread safety", "solution"],
related: ["pb-async", "th-ui-thread", "th-cancellation"],
blocks: [
  { p: "20 points: Start (count +1 every 100 ms; 10), Pause/Stop resumable (4), Reset to 0 (4), all UI updates on the UI thread (2). Starter ViewModel already imports `System.Threading`, `System.Threading.Tasks` and `Avalonia.Threading` — a broad hint that any of the three standard solutions is welcome." },
  { p: "All three complete solutions (DispatcherTimer, Task.Run + CancellationToken + Dispatcher, PeriodicTimer) are in [[pb-async|the async playbook]]. The starter binds `StartCommand`, `StopCommand`, `ResetCommand` and `{Binding Count}`: keep those generated names by keeping methods `Start()`, `Stop()`, `Reset()`." },
  { tip: "Add a one-line comment over your Count mutations stating the thread-safety argument (\"DispatcherTimer ticks on the UI thread\" or \"all mutations marshalled via Dispatcher.UIThread.Post\"). Those 2 points should be undeniable." },
]},

{
id: "ex-reexam-p4-linq",
title: "August P4 · Recipes LINQ: full solution",
cat: "Past Exams",
tags: ["recipes", "linq", "vegetarian", "above average", "query results json", "solution"],
related: ["pb-linq-json", "df-json", "lq-cookbook"],
blocks: [
  { p: "25 points: four queries over `recipes.json` (15 recipes; tags include Vegetarian, Vegan, ContainsNuts, GlutenFree, Seafood; several have empty DietaryTags) + save all results into ONE structured JSON file. Starter project provides `Recipe` (Name, Ingredients, DietaryTags, ToString→Name) and the Deserialize line." },
  { code: String.raw`using System.Text.Json;

internal class Program
{
    public static void Main()
    {
        List<Recipe> recipes =
            JsonSerializer.Deserialize<List<Recipe>>(File.ReadAllText("recipes.json"))!;

        // 1. Vegetarian recipes (5 pts)
        var vegetarian = recipes
            .Where(r => r.DietaryTags.Contains("Vegetarian"))
            .ToList();

        // 2. No dietary restrictions (5 pts)
        var noRestrictions = recipes
            .Where(r => r.DietaryTags.Count == 0)
            .ToList();

        // 3. Sorted by ingredient count, most first (5 pts)
        var sortedByIngredients = recipes
            .OrderByDescending(r => r.Ingredients.Count)
            .ToList();

        // 4. More ingredients than average (5 pts)
        double avg = recipes.Average(r => r.Ingredients.Count);
        var aboveAverage = recipes
            .Where(r => r.Ingredients.Count > avg)
            .ToList();

        // print them (labelled):
        Console.WriteLine("--- Vegetarian ---");
        vegetarian.ForEach(Console.WriteLine);          // Recipe.ToString() prints Name
        Console.WriteLine("--- No restrictions ---");
        noRestrictions.ForEach(Console.WriteLine);
        Console.WriteLine("--- By ingredient count ---");
        sortedByIngredients.ForEach(r => Console.WriteLine($"{r.Name}: {r.Ingredients.Count}"));
        Console.WriteLine($"--- Above average ({avg:F2}) ---");
        aboveAverage.ForEach(Console.WriteLine);

        // 4.2 Save all results into one JSON file with the EXACT keys (5 pts)
        var results = new
        {
            vegetarianRecipes       = vegetarian,
            noDietaryRestrictions   = noRestrictions,
            sortedByIngredientCount = sortedByIngredients,
            aboveAverageIngredients = aboveAverage
        };

        File.WriteAllText("Problem_4_Query_Results.json",
            JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true }));
    }
}`, lang: "csharp", title: "Problem_4_Program.cs — complete solution" },
  { gotcha: "The PDF says \"five LINQ queries\" then lists four: trust the list. It also says the json lives in `Problem_4_LINQ/data/` but the file sits in the project root next to the csproj. Look before you path." },
]}

);
