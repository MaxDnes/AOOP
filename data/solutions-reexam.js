/* ============ MODEL SOLUTIONS · ReExam (August 2025, FamilyMealPlanner) ============
   COMPILE-TESTED against .NET 9 / Avalonia 11.2.1 / CommunityToolkit.Mvvm 8.2.1.
   Source of truth: C:\Users\Max\Desktop\AOP Model Solutions\ReExam2025\
   One topic per problem; P1 is the full written submission. cat: "Model Solutions".
   Loaded via <script> in the browser; window.TOPICS is created before this runs. */

window.TOPICS.push(

/* ---------------- PROBLEM 1: SOLID written answer ---------------- */
{
id: "sol-reexam-p1",
title: "ReExam P1 · SOLID on FamilyMealPlanner: model written answer",
cat: "Model Solutions",
tags: ["reexam", "august 2025", "solid", "familymealplanner", "written answer", "downcast", "lsp", "model solution"],
related: ["sol-reexam-p2", "sol-reexam-p3", "sol-reexam-p4", "ex-reexam-overview"],
blocks: [
  { p: "Problem 1 (25 pts). Rubric is **5 × (1 + 2 + 2)** per principle: presence (1), how/where + a code example (2), general purpose + how it applies here (2). The console project is `FamilyMealPlanner`. Two flaws are PLANTED: the `_recipeFinder as InMemoryRecipeRepository` downcast inside `MealPlanner.GenerateMealPlan`, and the injected-but-never-used `List<IDietaryRule> _rules`. Name both for full marks." },
  { table: { head: ["Principle", "Verdict", "One-line reason"], rows: [
    ["SRP", "PRESENT", "one responsibility per class (planner / shopping list / repo / notifier / each rule)"],
    ["OCP", "PARTIAL", "rule/finder/notifier interfaces are extensible, but the downcast + dead _rules block real extension"],
    ["LSP", "VIOLATED", "`as InMemoryRecipeRepository` breaks substitutability of IRecipeFinder"],
    ["ISP", "PRESENT", "three small single-method interfaces, no fat interface"],
    ["DIP", "PARTIAL", "ctor injection + Program.cs composition root, but the concrete downcast reaches past the abstraction"],
  ]}},
  { h: "1) SRP — PRESENT" },
  { p: "**How/where:** each class has one reason to change — `MealPlanner` builds the plan, `ShoppingListGenerator` turns a plan into a deduped sorted list, `InMemoryRecipeRepository` only stores/retrieves, `ConsoleNotifier` only writes, each `IDietaryRule` encodes one rule. Reporting is delegated to `INotifier` instead of `Console.WriteLine` inside the planner. **Example:** `ShoppingListGenerator.Generate(...)` does only `AddRange` + `Distinct().OrderBy(...)`. **Purpose here:** a change to one concern (e.g. output channel) does not ripple into unrelated code; each unit is small and independently testable." },
  { h: "2) OCP — PARTIAL (intent present, undermined)" },
  { p: "**How/where:** `IDietaryRule` / `IRecipeFinder` / `INotifier` let you add a new rule, finder or notifier as a NEW class without editing existing ones (e.g. add `GlutenFreeRule : IDietaryRule`). **Undermined by** the `var inMemoryRepo = _recipeFinder as InMemoryRecipeRepository;` downcast (a new finder forces the planner to fail) and by the `List<IDietaryRule> _rules` that is stored and never used — the filtering is hard-coded in `InMemoryRecipeRepository.FindRecipes`, so adding a rule object does NOT extend behaviour. **Purpose here:** open for extension, closed for modification; the interfaces show the right idea, the downcast and dead list are where it falls short." },
  { h: "3) LSP — VIOLATED" },
  { code: String.raw`var inMemoryRepo = _recipeFinder as InMemoryRecipeRepository;
if (inMemoryRepo == null)
{
    _notifier.Notify("Error: Recipe finder does not support random selection.");
    return mealPlan;          // any other IRecipeFinder => empty plan!
}`, lang: "csharp", title: "MealPlanner.GenerateMealPlan — the substitutability break" },
  { p: "**How/where:** `MealPlanner` accepts an `IRecipeFinder` but then assumes the concrete `InMemoryRecipeRepository`; substituting any other valid finder silently yields an empty plan. `GetRandomRecipe` lives only on the concrete class, not the interface, so the planner cannot stay at the abstraction. **Purpose here:** subtypes must be usable wherever the supertype is expected; here the contract 'I accept any IRecipeFinder' is a lie. **Fix:** move random selection onto `IRecipeFinder` and drop the downcast. (You may note LSP is 'trivially present' with one implementation, but the honest, point-earning answer is that the downcast deliberately breaks it.)" },
  { h: "4) ISP — PRESENT" },
  { code: String.raw`public interface IRecipeFinder { IEnumerable<Recipe> FindRecipes(FamilyProfile family); }
public interface INotifier     { void Notify(string message); }
public interface IDietaryRule  { bool IsSatisfiedBy(Recipe recipe, FamilyProfile family); }`, lang: "csharp", title: "Interfaces.cs — three small role interfaces" },
  { p: "**How/where:** three single-method interfaces instead of one fat `IMealService`; no implementer is forced to implement a method it does not need (`ConsoleNotifier` only `Notify`, `VegetarianRule` only `IsSatisfiedBy`). **Purpose here:** clients depend only on the tiny contract they actually use — the cleanest principle in this codebase." },
  { h: "5) DIP — PARTIAL" },
  { code: String.raw`// high-level MealPlanner depends on abstractions, injected via ctor:
public MealPlanner(IRecipeFinder recipeFinder, INotifier notifier, List<IDietaryRule> rules) { ... }

// concretes chosen ONLY in Program.cs (the composition root):
IRecipeFinder recipeRepo = new InMemoryRecipeRepository();
INotifier notifier = new ConsoleNotifier();
var planner = new MealPlanner(recipeRepo, notifier, rules);`, lang: "csharp", title: "Constructor injection + composition root" },
  { p: "**How/where:** high-level policy depends on `IRecipeFinder`/`INotifier`; concretes are wired only at the top — textbook DIP. **Undermined by** the same downcast (a concrete dependency dragged back into the high-level class) and the unused `_rules` (an injected dependency never consumed). **Purpose here:** both high- and low-level modules depend on abstractions; the injection is right, the downcast is the one place that couples the planner to a concrete type." },
  { gotcha: "Two deliberate flaws to name for full marks: (1) the `_recipeFinder as InMemoryRecipeRepository` downcast (hurts OCP, LSP, DIP); (2) the injected-but-unused `List<IDietaryRule> _rules` (dead dependency; real filtering is hard-coded in the repository)." },
  { p: "**Adapt if F26 changes the domain:** the analysis structure is domain-independent — keep the 5×(1+2+2) shape, then hunt for the same smells: a `... as ConcreteType` downcast behind an interface (LSP/DIP/OCP), a constructor-injected collaborator that is stored but never used (OCP/DIP), filtering/logic duplicated inside a concrete instead of using the injected strategies. Small role interfaces = ISP present; one-job classes = SRP present." },
]},

/* ---------------- PROBLEM 2: FamilyMealPlannerUI ---------------- */
{
id: "sol-reexam-p2",
title: "ReExam P2 · FamilyMealPlannerUI: full solution (2 ListBoxes + Generate + highlight)",
cat: "Model Solutions",
tags: ["reexam", "august 2025", "avalonia", "mvvm", "listbox", "selecteditems", "multiple selection", "observableproperty", "onselectedrecipechanged", "model solution"],
related: ["sol-reexam-p1", "sol-reexam-p3", "av-itemscontrols", "mv-observableproperty"],
blocks: [
  { p: "Problem 2 (30 pts). Avalonia MVVM. **Only two files are graded/submitted:** `Problem_2_MainWindowViewModel.cs` and `Problem_2_MainWindow.axaml`. The class stays `MainWindowViewModel` (in `FamilyMealPlannerUI.ViewModels`) and the view stays `x:Class=\"FamilyMealPlannerUI.Views.MainWindow\"` — do NOT rename them to match the filename. The DI is already done in `App.axaml.cs`; the VM constructor receives `recipeRepo, planner, family, shoppingListGenerator, rules`." },
  { list: [
    "**2.1 Layout (10):** two ListBoxes side by side (left = Meal Plan, right = Shopping List) + a Generate button below.",
    "**2.2 Basic (10):** left ListBox shows one `WeeklyItem` per weekday via the injected `MealPlanner`; right ListBox shows the shopping list via the injected `ShoppingListGenerator`; Generate regenerates both; a plan is generated on startup.",
    "**2.3 Advanced (10):** clicking a meal on the left multi-select-highlights its ingredients on the right, driven by the auto-generated `OnSelectedRecipeChanged` partial.",
  ]},
  { h: "ViewModels/Problem_2_MainWindowViewModel.cs (complete)" },
  { code: String.raw`using System.Collections.Generic;
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using FamilyMealPlannerUI.Models;

namespace FamilyMealPlannerUI.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    // ---- injected core (already provided by App.axaml.cs) ----
    public IRecipeFinder RecipeRepo { get; }
    public MealPlanner Planner { get; }
    public ShoppingListGenerator ShoppingListGenerator { get; }
    public List<IDietaryRule> Rules { get; }
    public FamilyProfile Family { get; }

    private readonly string[] daysOfWeek = { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" };

    // raw recipes for the current plan, index-aligned with MealPlan so we can look up a
    // selected day's ingredients WITHOUT modifying the provided WeeklyItem class.
    private List<Recipe> currentPlan = new();

    public ObservableCollection<WeeklyItem> MealPlan { get; } = new();          // 2.2 left ListBox
    public ObservableCollection<string> ShoppingList { get; } = new();          // 2.2 right ListBox
    public ObservableCollection<string> SelectedIngredients { get; } = new();   // 2.3 right ListBox SelectedItems

    [ObservableProperty]
    public WeeklyItem? selectedRecipe;                                          // 2.3 left ListBox SelectedItem

    public MainWindowViewModel(IRecipeFinder recipeRepo, MealPlanner planner, FamilyProfile family, ShoppingListGenerator shoppingListGenerator, List<IDietaryRule> rules)
    {
        RecipeRepo = recipeRepo;
        Planner = planner;
        Family = family;
        ShoppingListGenerator = shoppingListGenerator;
        Rules = rules;

        CreateWeeklyPlan();   // startup: generate + display one week immediately
    }

    [RelayCommand]
    public void CreateWeeklyPlan()
    {
        currentPlan = Planner.GenerateWeeklyPlan(Family, daysOfWeek.Length);

        MealPlan.Clear();
        for (int i = 0; i < currentPlan.Count && i < daysOfWeek.Length; i++)
        {
            MealPlan.Add(new WeeklyItem { Day = daysOfWeek[i], RecipeName = currentPlan[i].Name });
        }

        ShoppingList.Clear();
        foreach (var ingredient in ShoppingListGenerator.Generate(currentPlan))
        {
            ShoppingList.Add(ingredient);
        }

        SelectedRecipe = null;        // fresh plan => clear any highlight
        SelectedIngredients.Clear();
    }

    // auto-generated callback from [ObservableProperty]; highlight this recipe's ingredients.
    partial void OnSelectedRecipeChanged(WeeklyItem? value)
    {
        SelectedIngredients.Clear();
        if (value is null) return;

        int index = MealPlan.IndexOf(value);
        if (index < 0 || index >= currentPlan.Count) return;

        foreach (var ingredient in currentPlan[index].Ingredients)
        {
            if (ShoppingList.Contains(ingredient))
                SelectedIngredients.Add(ingredient);
        }
    }
}`, lang: "csharp", title: "Problem_2_MainWindowViewModel.cs — complete" },
  { h: "Views/Problem_2_MainWindow.axaml (complete)" },
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

    <Grid Margin="15" RowDefinitions="Auto,*,Auto" ColumnDefinitions="2*,*">

        <TextBlock Grid.Row="0" Grid.Column="0" Text="Meal Plan" FontWeight="Bold" Margin="0,0,0,8"/>
        <TextBlock Grid.Row="0" Grid.Column="1" Text="Shopping List" FontWeight="Bold"
                   Margin="10,0,0,8" HorizontalAlignment="Right"/>

        <!-- left: weekly meal plan, single selection drives the highlight -->
        <ListBox Grid.Row="1" Grid.Column="0" Margin="0,0,5,0"
                 ItemsSource="{Binding MealPlan}"
                 SelectedItem="{Binding SelectedRecipe}"
                 SelectionMode="Single"/>

        <!-- right: shopping list, MULTIPLE selection so the VM can highlight several at once (2.3) -->
        <ListBox Grid.Row="1" Grid.Column="1" Margin="5,0,0,0"
                 ItemsSource="{Binding ShoppingList}"
                 SelectedItems="{Binding SelectedIngredients}"
                 SelectionMode="Multiple"/>

        <Button Grid.Row="2" Grid.Column="0" Grid.ColumnSpan="2"
                Content="Generate Meal Plan" HorizontalAlignment="Left"
                Margin="0,12,0,0" Padding="20,8"
                Command="{Binding CreateWeeklyPlanCommand}"/>
    </Grid>
</Window>`, lang: "xml", title: "Problem_2_MainWindow.axaml — complete" },
  { h: "Key idioms (where the points are)" },
  { list: [
    "**`WeeklyItem.ToString()`** already returns `\"{Day}: {RecipeName}\"`, so binding the left ListBox straight to `ObservableCollection<WeeklyItem>` renders `Monday: Spaghetti Bolognese` with no ItemTemplate needed.",
    "**`[RelayCommand] CreateWeeklyPlan`** → the toolkit generates `CreateWeeklyPlanCommand`; that exact name is what the button binds to.",
    "**`[ObservableProperty] WeeklyItem? selectedRecipe`** → generates the `SelectedRecipe` property AND the `OnSelectedRecipeChanged(WeeklyItem?)` partial hook. The partial parameter must be `WeeklyItem?` (nullable) to actually match the generated signature.",
    "**Highlight via `SelectedItems`** (`System.Collections.IList SelectedItems { get; set; }`): bind the right ListBox's `SelectedItems` to an `ObservableCollection<string>` and mutate THAT instance. `SelectionMode=\"Multiple\"` lets several rows light up. Strings match by value, so adding the recipe's ingredient strings selects the matching rows.",
    "**No code-behind:** all behaviour is bindings + the VM. `MainWindow.axaml.cs` stays as the starter shipped it.",
  ]},
  { gotcha: "Do NOT rename the class to `Problem_2_MainWindowViewModel` — the file is named that, but the TYPE is `MainWindowViewModel` and `App.axaml.cs` + the axaml `x:DataType` reference `MainWindowViewModel`. Rename the type and the project stops compiling." },
  { gotcha: "`WeeklyItem` lives in the GLOBAL namespace (no namespace declaration in WeeklyItem.cs), so the VM uses it unqualified — do not add a `using` for it." },
  { p: "**Adapt if F26 changes the domain:** the recipe-highlight pattern generalises — a master ListBox (`SelectedItem` → `[ObservableProperty]`) and a detail ListBox whose `SelectedItems` is bound to a VM `ObservableCollection` you refill inside the `On...Changed` partial. Keep a parallel `List<TModel>` index-aligned with the display collection so you can map the selected display item back to its underlying data without editing the provided item class." },
]},

/* ---------------- PROBLEM 3: async counter ---------------- */
{
id: "sol-reexam-p3",
title: "ReExam P3 · AutoCounter: full solution (DispatcherTimer + Task.Delay alternate)",
cat: "Model Solutions",
tags: ["reexam", "august 2025", "async", "counter", "dispatchertimer", "task.delay", "cancellationtokensource", "ui thread", "model solution"],
related: ["sol-reexam-p2", "th-ui-thread", "mv-relaycommand"],
blocks: [
  { p: "Problem 3 (20 pts). Modify the counter ViewModel so Start counts +1 every 100 ms (10), Pause stops but KEEPS the value and Start resumes from it (4), Reset zeroes (4), and all UI updates run on the UI thread (2). The starter VM has `[ObservableProperty] int _count` and `Start` / `Stop` / `Reset` `[RelayCommand]`s (note: the 'Pause' button binds `StopCommand`)." },
  { gotcha: "FILENAME MISMATCH: the PDF says submit `AutoCounterViewModel.cs` and 'modify the AutoCounterViewModel', but the starter project actually ships `ViewModels/Problem_3_MainWindowViewModel.cs` containing class `MainWindowViewModel` (that's what App.axaml.cs + the axaml use). Implement in the file/type the PROJECT uses so it compiles, and submit it under the name your submission profile requires (`Problem_3_MainWindowViewModel.cs`). Do not rename the class." },
  { h: "PRIMARY — ViewModels/Problem_3_MainWindowViewModel.cs (DispatcherTimer)" },
  { code: String.raw`using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System;
using Avalonia.Threading;

namespace Counter.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    [ObservableProperty]
    private int _count = 0;

    // built once; Stop() does NOT reset Count, so Start() resumes from the last number.
    private readonly DispatcherTimer _timer;

    public MainWindowViewModel()
    {
        _timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) }; // +1 / 100 ms
        _timer.Tick += OnTick;
    }

    // DispatcherTimer.Tick fires ON the UI thread -> thread-safety requirement met for free.
    private void OnTick(object? sender, EventArgs e) => Count++;

    [RelayCommand] private void Start() => _timer.Start();   // begin / resume
    [RelayCommand] private void Stop()  => _timer.Stop();    // pause, keep value
    [RelayCommand] private void Reset() { _timer.Stop(); Count = 0; } // zero
}`, lang: "csharp", title: "Problem_3_MainWindowViewModel.cs — primary, complete" },
  { p: "Why DispatcherTimer is the clean answer: its `Tick` is raised on the UI (dispatcher) thread, so mutating the `Count` observable property is automatically thread-safe — no `Dispatcher.UIThread.Post`, no locks. Pause = `Stop()` leaves `_count` untouched; Start = `Start()` keeps ticking from there; Reset stops and zeroes." },
  { h: "ALTERNATE — Task.Delay + CancellationTokenSource (sibling file AutoCounterViewModel.Alternative.cs)" },
  { code: String.raw`using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Threading;

namespace Counter.ViewModels;

// identical behaviour via async loop; rename to MainWindowViewModel to use it instead.
public partial class AutoCounterViewModelAsync : ViewModelBase
{
    [ObservableProperty]
    private int _count = 0;

    private CancellationTokenSource? _cts;   // null when paused/stopped

    [RelayCommand]
    private void Start()
    {
        if (_cts is not null) return;        // already running
        _cts = new CancellationTokenSource();
        _ = RunAsync(_cts.Token);            // fire-and-forget the loop
    }

    private async Task RunAsync(CancellationToken token)
    {
        try
        {
            while (!token.IsCancellationRequested)
            {
                await Task.Delay(100, token);
                // UI thread: required for the ObservableProperty update to be safe.
                await Dispatcher.UIThread.InvokeAsync(() => Count++);
            }
        }
        catch (TaskCanceledException) { /* expected on Pause/Reset */ }
    }

    [RelayCommand]
    private void Stop() { _cts?.Cancel(); _cts?.Dispose(); _cts = null; }   // pause, keep value

    [RelayCommand]
    private void Reset() { _cts?.Cancel(); _cts?.Dispose(); _cts = null; Count = 0; }
}`, lang: "csharp", title: "AutoCounterViewModel.Alternative.cs — alternate, complete" },
  { list: [
    "**`await Dispatcher.UIThread.InvokeAsync(() => Count++)`** is the thread-safety line for the async variant: the loop runs off the UI thread, so the increment is marshalled back onto it.",
    "**`Task.Delay(100, token)`** both spaces the ticks AND lets Pause cancel an in-flight delay immediately; catch `TaskCanceledException` so cancellation is silent.",
    "**Idempotent Start** (`if (_cts is not null) return;`) avoids spawning two loops if Start is clicked twice.",
  ]},
  { p: "**Adapt if F26 changes the domain:** any 'tick every N ms, start/pause/reset, UI-thread-safe' task is this exact shape. Prefer the DispatcherTimer version (less to get wrong, thread-safety is automatic); reach for the `Task.Delay`+`CancellationTokenSource` loop only if they explicitly demand async/Task-based code, and remember the `Dispatcher.UIThread` marshal." },
]},

/* ---------------- PROBLEM 4: recipes LINQ console ---------------- */
{
id: "sol-reexam-p4",
title: "ReExam P4 · Recipes LINQ: full solution + exact-key JSON output",
cat: "Model Solutions",
tags: ["reexam", "august 2025", "linq", "json", "recipes", "vegetarian", "above average", "model solution"],
related: ["sol-reexam-p1", "sol-reexam-p2", "pb-linq-json", "df-json"],
blocks: [
  { p: "Problem 4 (25 pts). Deserialize `recipes.json` into `List<Recipe>`, run four LINQ queries (20), and serialize all four into ONE file `Problem_4_Query_Results.json` with the EXACT keys (5). Submit `Problem_4_Program.cs` + `Problem_4_Query_Results.json`." },
  { list: [
    "**1. Vegetarian (5):** `DietaryTags` contains `\"Vegetarian\"`.",
    "**2. No dietary restrictions (5):** `DietaryTags` is empty.",
    "**3. Sorted by ingredient count (5):** `OrderByDescending(Ingredients.Count)` — most first.",
    "**4. Above average (5):** more ingredients than the list average.",
  ]},
  { h: "Problem_4_Program.cs (complete, verified output)" },
  { code: String.raw`namespace RecipeQueries;

using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Collections.Generic;

internal class Program
{
    public static void Main()
    {
        // case-insensitive + null-safe against planted nulls / missing fields
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        List<Recipe> recipes =
            JsonSerializer.Deserialize<List<Recipe>>(File.ReadAllText("recipes.json"), options)
            ?? new List<Recipe>();

        // 1. Vegetarian (5)
        var vegetarianRecipes = recipes
            .Where(r => r.DietaryTags?.Contains("Vegetarian") ?? false)
            .ToList();

        // 2. No dietary restrictions (5)
        var noDietaryRestrictions = recipes
            .Where(r => (r.DietaryTags?.Count ?? 0) == 0)
            .ToList();

        // 3. Sorted by ingredient count, most first (5)
        var sortedByIngredientCount = recipes
            .OrderByDescending(r => r.Ingredients?.Count ?? 0)
            .ToList();

        // 4. More ingredients than the average (5)
        double averageIngredients = recipes.Any()
            ? recipes.Average(r => r.Ingredients?.Count ?? 0)
            : 0;
        var aboveAverageIngredients = recipes
            .Where(r => (r.Ingredients?.Count ?? 0) > averageIngredients)
            .ToList();

        // 4.2 ONE file, EXACT keys (5)
        var results = new
        {
            vegetarianRecipes,
            noDietaryRestrictions,
            sortedByIngredientCount,
            aboveAverageIngredients
        };

        File.WriteAllText(
            "Problem_4_Query_Results.json",
            JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true }));
    }
}`, lang: "csharp", title: "Problem_4_Program.cs — complete solution" },
  { h: "Verified results on the provided recipes.json (15 recipes, avg 3.33)" },
  { table: { head: ["Query", "Count", "Members"], rows: [
    ["vegetarianRecipes", "7", "Vegetable Curry, Lentil Soup, Mushroom Risotto, Quinoa Salad, Nutty Granola Bars, Vegan Chili, Gluten-Free Pancakes"],
    ["noDietaryRestrictions", "7", "Tagiatelle Carbonara, Spaghetti Bolognese, Chicken Stir-fry, Salmon w/ Asparagus, Beef Tacos, Pork Chops w/ Apples, Shepherd's Pie"],
    ["sortedByIngredientCount", "15", "the five 4-ingredient recipes first, then the 3-ingredient ones"],
    ["aboveAverageIngredients", "5", "Tagiatelle Carbonara, Quinoa Salad, Vegan Chili, Gluten-Free Pancakes, Shrimp Scampi (all 4 > 3.33)"],
  ]}},
  { h: "Output shape (Problem_4_Query_Results.json)" },
  { code: String.raw`{
  "vegetarianRecipes":       [ { "Name": "...", "Ingredients": [...], "DietaryTags": [...] }, ... ],
  "noDietaryRestrictions":   [ ... ],
  "sortedByIngredientCount": [ ... ],
  "aboveAverageIngredients": [ ... ]
}`, lang: "json", title: "exact top-level keys" },
  { list: [
    "**Null-safety idiom:** `r.Ingredients?.Count ?? 0` / `r.DietaryTags?.Contains(...) ?? false` so a planted `null` list never throws (works whether the model lists are nullable or default to empty).",
    "**Exact keys for free:** an anonymous object whose member names ARE the required keys (`vegetarianRecipes`, etc.) → serialized verbatim, no attributes needed.",
    "**`WriteIndented = true`** for a human-readable result file; `PropertyNameCaseInsensitive` on deserialize for robustness.",
  ]},
  { gotcha: "The PDF says 'five LINQ queries' then lists four — trust the list (four). It also paths the data at `Problem_4_LINQ/data/recipes.json`, but in the starter the file sits next to the csproj; read the real path before hardcoding. 'No dietary restrictions' means an EMPTY DietaryTags list, not the absence of the 'Vegetarian' tag (Shrimp Scampi is excluded — it carries 'Seafood')." },
  { p: "**Adapt if F26 changes the domain:** swap the model and the four predicates; the skeleton (case-insensitive null-safe deserialize → four LINQ queries → anonymous object with exact keys → indented serialize) is reusable verbatim. For 'above average', compute the average ONCE into a `double` and compare with `>` (strictly greater, not `>=`)." },
]}

);
