/* ============ ERROR DECODER · core (static knowledge base) ============
   The offline safety net. During the exam there is no LLM and no internet, so
   when the build goes red a non-coder is stuck. This is a hand-written lookup of
   the errors that actually show up in THIS stack (.NET 9, Avalonia 11.2.1,
   CommunityToolkit.Mvvm 8.2.1, xUnit + Avalonia.Headless.XUnit, System.Text.Json),
   each with a plain-English cause, the exact fix, and which file to touch.

     match(pastedError) -> [{ entry, score, why }]   ranked best-first
     search(query)      -> [entry]                    filter by code/keyword

   No DOM, plain data. UMD: window.ERRORS_CORE / module.exports.
*/
(function (global) {
"use strict";

function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }

var CATEGORIES = [
  { key: "compile", label: "Compile (CS####)" },
  { key: "mvvm",    label: "MVVM toolkit" },
  { key: "xaml",    label: "XAML / Avalonia" },
  { key: "binding", label: "Bindings not working" },
  { key: "async",   label: "Async / threading" },
  { key: "test",    label: "Tests / headless" },
  { key: "nuget",   label: "Restore / NuGet (offline)" },
  { key: "runtime", label: "Runtime / JSON / LINQ" },
];

/* Each entry:
   { id, code?, cat, title, msg (a quoted fragment of the real message),
     cause, fix (plain language; `backticks` become code), file, tags:[] } */
var ENTRIES = [
  /* ---------------- compile ---------------- */
  {
    id: "cs0246", code: "CS0246", cat: "compile",
    title: "The type or namespace 'X' could not be found",
    msg: "The type or namespace name '...' could not be found",
    cause: "You used a type but never told the file where it lives. Either a `using` line is missing, or the project doesn't reference the package that defines it.",
    fix: "Add the matching `using` at the top of the file. The usual ones: `ObservableObject` -> `using CommunityToolkit.Mvvm.ComponentModel;` · `RelayCommand` / `ICommand` -> `using CommunityToolkit.Mvvm.Input;` · `DispatcherTimer` / `Dispatcher` -> `using Avalonia.Threading;` · `IBrush` / `Brush` / `Brushes` -> `using Avalonia.Media;` · `JsonSerializer` -> `using System.Text.Json;` · `List<T>` -> `using System.Collections.Generic;` · `ObservableCollection<T>` -> `using System.Collections.ObjectModel;` · `Where` / `Select` / `OrderBy` -> `using System.Linq;`. If it's a type from the exam's own project, the test project is missing a `ProjectReference` to it.",
    file: "top of the .cs file (or the .csproj for a missing reference)",
    tags: ["could not be found", "type or namespace", "missing using", "namespace name", "directive"],
  },
  {
    id: "cs0103", code: "CS0103", cat: "compile",
    title: "The name 'X' does not exist in the current context",
    msg: "The name '...' does not exist in the current context",
    cause: "You referred to something that isn't in scope here. In a ViewModel this is almost always because you tried to use a control's `x:Name` (like `Circle` or `SizeSlider`) — those names only exist in the View's code-behind, never in the ViewModel.",
    fix: "In MVVM the ViewModel never touches controls by name. Replace the control reference with a bound property: declare `[ObservableProperty] private double _size;` and bind the control's `Value=\"{Binding Size}\"` in the .axaml. If it's just a typo or a missing `using`, fix the name or add the using.",
    file: "the ViewModel (.cs) and the .axaml",
    tags: ["does not exist", "current context", "name", "scope", "x:name"],
  },
  {
    id: "cs1061", code: "CS1061", cat: "compile",
    title: "'X' does not contain a definition for 'Y'",
    msg: "does not contain a definition for",
    cause: "You used a property or method name the type doesn't actually have. A very common trap with the MVVM toolkit: for `[ObservableProperty] private int _count;` the PUBLIC property the toolkit generates is `Count` (capitalised, no underscore), and `[RelayCommand] private void Add()` generates `AddCommand`.",
    fix: "Use the generated public names: bind to `Count` (not `_count` or `count`) and to `AddCommand` (not `Add`). If you genuinely mistyped a member name, correct it.",
    file: "wherever you used the member (.cs or .axaml binding)",
    tags: ["does not contain a definition", "no definition", "observableproperty", "generated", "command", "property name"],
  },
  {
    id: "cs8618", code: "CS8618", cat: "compile",
    title: "Non-nullable property must contain a non-null value (nullable warning)",
    msg: "Non-nullable ... must contain a non-null value when exiting constructor",
    cause: "Your model class has a non-nullable property, but when JSON is missing that field it deserializes to null. This is the planted Problem 4 trap ('be aware there might be missing values').",
    fix: "Make model properties nullable so missing JSON fields are allowed: `public string? Name { get; set; }`, `public int? Trips { get; set; }`, `public DateTime? ArrivalDate { get; set; }`. Then null-check / filter before using them in a query.",
    file: "the model class (Problem_4_Models.cs)",
    tags: ["non-nullable", "null value", "nullable", "json", "missing values", "warning"],
  },
  {
    id: "cs0234", code: "CS0234", cat: "compile",
    title: "The type or namespace 'X' does not exist in the namespace 'Y'",
    msg: "does not exist in the namespace",
    cause: "The namespace path you wrote is wrong, or the assembly that defines it isn't referenced (e.g. referencing `Avalonia.Headless` without the package).",
    fix: "Check the namespace spelling against the real one. If it's a generated file from a tool, the namespace probably still says `ExamApp` — run it through the Adapt Lab to match your project. For headless test types, reference the `Avalonia.Headless.XUnit` package.",
    file: "top of the .cs file / the .csproj",
    tags: ["does not exist in the namespace", "namespace", "assembly reference", "examapp"],
  },
  {
    id: "cs7036", code: "CS7036", cat: "compile",
    title: "There is no argument given that corresponds to the required parameter",
    msg: "no argument given that corresponds to the required formal parameter",
    cause: "The class has a constructor that needs arguments (its dependencies were injected), but you created it with `new MainWindowViewModel()` and gave nothing.",
    fix: "Construct it with the things it needs, e.g. in a unit test: `var vm = new MainWindowViewModel(new MealPlanner(), new ShoppingListGenerator());`. Look at the constructor in the provided code to see exactly what to pass.",
    file: "the test class, or wherever you `new` the type",
    tags: ["no argument given", "required parameter", "constructor", "formal parameter", "dependency"],
  },
  {
    id: "cs0029", code: "CS0029", cat: "compile",
    title: "Cannot implicitly convert type 'A' to 'B'",
    msg: "Cannot implicitly convert type",
    cause: "You assigned a value of one type to a variable of another. Common case: a `Slider.Value` is a `double` but you bound or assigned it to an `int`, or a JSON field is a string where you expected a number.",
    fix: "Make the types line up. Use `double` for slider-driven properties; convert explicitly where needed (`(int)value`, `value.ToString()`, `int.Parse(...)`). For JSON, match the model property type to the data.",
    file: "the line the error points at",
    tags: ["cannot implicitly convert", "convert type", "double", "int", "type mismatch"],
  },
  {
    id: "cs0102-collision", code: "CS0102", cat: "compile",
    title: "The type already contains a definition for 'X'",
    msg: "already contains a definition for",
    cause: "Two members share a name. With the MVVM toolkit this happens when `[ObservableProperty] private int _count;` generates a `Count` property AND you also wrote your own `Count` property — they collide.",
    fix: "Keep only one. If you're using `[ObservableProperty]`, delete the hand-written property of the same name and just use the generated one.",
    file: "the ViewModel (.cs)",
    tags: ["already contains a definition", "duplicate", "collision", "observableproperty"],
  },
  {
    id: "entrypoint", code: "CS0017", cat: "compile",
    title: "Program has more than one entry point defined",
    msg: "more than one entry point",
    cause: "There are two `Main` methods — usually a top-level-statements file plus a `Program.cs` that also has `static void Main`.",
    fix: "Keep a single entry point. For the LINQ console app, put everything in one `Program.cs` (either top-level statements OR a single `Main`, not both).",
    file: "Program.cs",
    tags: ["more than one entry point", "main", "entry point", "program.cs"],
  },
  {
    id: "cs1998", code: "CS1998", cat: "compile",
    title: "This async method lacks 'await' operators and will run synchronously",
    msg: "async method lacks 'await' operators and will run synchronously",
    cause: "You marked a method `async Task` (e.g. an `[RelayCommand] async Task` in Problem 3) but never `await` anything inside it, so the `async` does nothing and the body runs synchronously on the caller's thread.",
    fix: "Either add the awaited work — `await Task.Delay(...)` / `await SomeAsyncCall()` — so it really runs asynchronously, or drop `async` and return `Task.CompletedTask` from a plain `Task` method when there is genuinely nothing to await.",
    file: "the ViewModel (.cs)",
    tags: ["async method lacks", "await operators", "run synchronously", "async", "task", "relaycommand", "warning"],
  },
  {
    id: "cs4014", code: "CS4014", cat: "compile",
    title: "Call is not awaited; execution continues before the call completes",
    msg: "Because this call is not awaited, execution of the current method continues",
    cause: "You called an async method without `await` (fire-and-forget), so the rest of the method keeps running before that work finishes — exceptions are swallowed and ordering is not guaranteed.",
    fix: "`await` the call: `await StartAsync();`. If the fire-and-forget is genuinely intentional, assign it to a discard with an explicit comment — `_ = StartAsync(); // intentional fire-and-forget` — so the warning goes away and the intent is documented.",
    file: "the ViewModel (.cs)",
    tags: ["not awaited", "execution of the current method continues", "fire-and-forget", "await", "async", "discard", "warning"],
  },

  /* ---------------- mvvm toolkit ---------------- */
  {
    id: "op-partial", cat: "mvvm",
    title: "[ObservableProperty] / [RelayCommand] generate nothing (no Count, no AddCommand)",
    msg: "ObservableProperty ... must be ... partial",
    cause: "The CommunityToolkit source generator only runs when the class is `partial` and derives from `ObservableObject` (or `ViewModelBase`, which already does). Without `partial`, no public property or command is generated, and every binding to it fails.",
    fix: "Declare the class as `public partial class MainWindowViewModel : ObservableObject`. The field stays lowercase (`private int _count;`) and you bind to the generated PascalCase name (`Count`).",
    file: "the ViewModel (.cs)",
    tags: ["partial", "observableproperty", "relaycommand", "observableobject", "source generator", "not generated"],
  },
  {
    id: "mvvmtk0019", code: "MVVMTK0019", cat: "mvvm",
    title: "[ObservableProperty] on a field in a class that isn't partial / doesn't inherit ObservableObject",
    msg: "The MVVM Toolkit ... ObservableProperty ... must inherit",
    cause: "The CommunityToolkit source generator (diagnostics MVVMTK0019 / MVVMTK0045) refuses to run: a field has `[ObservableProperty]` but its containing class is not `partial`, or it doesn't inherit `ObservableObject` (nor declare `[INotifyPropertyChanged]` / `[ObservableObject]`). No public property is generated, so every binding to it fails.",
    fix: "Make the class `partial` and inherit `ObservableObject`: `public partial class MainWindowViewModel : ObservableObject`. (Or annotate it with `[INotifyPropertyChanged]` / `[ObservableObject]` and keep it `partial`.) Then bind to the generated PascalCase property.",
    file: "the ViewModel (.cs)",
    tags: ["mvvmtk0019", "mvvmtk0045", "mvvm toolkit", "observableproperty", "partial", "observableobject", "inotifypropertychanged", "source generator"],
  },
  {
    id: "field-case", cat: "mvvm",
    title: "Binding to the field name (_count / count) instead of the generated property",
    msg: "binding to _field does not update",
    cause: "`[ObservableProperty] private int _count;` does not make `_count` bindable — it generates a separate public `Count`. Binding to `_count` or `count` silently shows nothing.",
    fix: "Bind to the generated PascalCase property: `Text=\"{Binding Count}\"`. Rule: drop the leading underscore and capitalise the first letter.",
    file: "the .axaml binding",
    tags: ["field", "underscore", "pascalcase", "generated property", "binding empty"],
  },

  /* ---------------- xaml / avalonia ---------------- */
  {
    id: "xaml-vm-resolve", cat: "xaml",
    title: "Unable to resolve type 'vm:MainWindowViewModel' / prefix 'vm' not found",
    msg: "Unable to resolve type",
    cause: "The `xmlns:vm` namespace declared at the top of the .axaml doesn't point at the ViewModel's real namespace — usually because the file is generated under `ExamApp.ViewModels` but your project uses a different name.",
    fix: "Set `xmlns:vm=\"using:YourProject.ViewModels\"` to your project's actual ViewModel namespace, and make sure `x:DataType=\"vm:MainWindowViewModel\"` matches the class. The Adapt Lab fixes this automatically — paste the generated .axaml and your project name.",
    file: "the root of the .axaml",
    tags: ["unable to resolve type", "vm", "xmlns", "prefix", "using", "x:datatype", "examapp"],
  },
  {
    id: "compiled-binding", code: "AVLN0004", cat: "xaml",
    title: "A compiled binding was used without an x:DataType",
    msg: "compiled binding ... without ... x:DataType",
    cause: "Avalonia compiled bindings need to know the data type they bind against. You have `{Binding Something}` but no `x:DataType` is in scope (diagnostic AVLN0004 / AVLN:0004).",
    fix: "Add `x:DataType=\"vm:MainWindowViewModel\"` on the root `<Window>` (with `xmlns:vm=\"using:YourProject.ViewModels\"`). Inside a `DataTemplate` / `ItemsControl`, set `x:DataType` to the item type on the template.",
    file: "the .axaml (root, or the DataTemplate)",
    tags: ["compiled binding", "x:datatype", "datatype", "binding", "avln0004", "avln:0004"],
  },
  {
    id: "xaml-no-property", cat: "xaml",
    title: "Avalonia: could not find property 'X' / no suitable setter",
    msg: "Unable to find suitable setter or adder",
    cause: "You set or bound an attribute the control doesn't have, or you used a plain property where an attached one is needed. Classic case: positioning on a Canvas with `Left=` / `Top=` instead of the attached `Canvas.Left` / `Canvas.Top`.",
    fix: "Use the right property name. On a Canvas, position with `Canvas.Left=\"{Binding X}\"` and `Canvas.Top=\"{Binding Y}\"`. Check the control actually has the property you're setting.",
    file: "the .axaml",
    tags: ["suitable setter", "could not find property", "canvas.left", "attached property", "adder"],
  },
  {
    id: "xclass-mismatch", cat: "xaml",
    title: "x:Class does not match / class not found for the view",
    msg: "x:Class",
    cause: "The `x:Class` in the .axaml must be the exact full name (namespace + class) of its code-behind class. If they differ, the view won't build or won't find its code-behind.",
    fix: "Make `x:Class=\"YourProject.Views.MainWindow\"` match the code-behind's `namespace` + class. When pasting generated .axaml into a project, run it through the Adapt Lab so the namespace matches.",
    file: "the .axaml root and its .axaml.cs",
    tags: ["x:class", "does not match", "code-behind", "view", "namespace"],
  },
  {
    id: "dup-xname", cat: "xaml",
    title: "Duplicate x:Name in the view",
    msg: "with the name ... already exists",
    cause: "Two controls in the same scope share an `x:Name`.",
    fix: "Rename one so every `x:Name` is unique. In MVVM you usually don't need `x:Name` at all — bind instead.",
    file: "the .axaml",
    tags: ["duplicate", "x:name", "already exists", "name scope"],
  },

  /* ---------------- bindings not working ---------------- */
  {
    id: "binding-noupdate", cat: "binding",
    title: "The binding shows nothing or never updates",
    msg: "binding does not update / textblock empty",
    cause: "The bound property isn't observable, or the DataContext isn't set. A plain `public int Count { get; set; }` does NOT notify the UI when it changes.",
    fix: "Use `[ObservableProperty] private int _count;` in a `partial` class deriving from `ObservableObject`, and bind to `Count`. For lists that grow/shrink at runtime use `ObservableCollection<T>`, not `List<T>`. Make sure the DataContext is the ViewModel (set in the View constructor or App.axaml.cs).",
    file: "the ViewModel (.cs) and DataContext wiring",
    tags: ["binding", "does not update", "empty", "observable", "datacontext", "observablecollection", "notify"],
  },
  {
    id: "canvas-items", cat: "binding",
    title: "ItemsControl items all stack at 0,0 instead of their positions",
    msg: "items not positioned on canvas",
    cause: "An `ItemsControl` wraps each item in a container. Binding `Canvas.Left` on the DataTemplate's root element doesn't move the container that's actually on the Canvas, so everything piles at the top-left.",
    fix: "Set the panel to a Canvas with `<ItemsControl.ItemsPanel><ItemsPanelTemplate><Canvas/></ItemsPanelTemplate></ItemsControl.ItemsPanel>`, then put `Canvas.Left` / `Canvas.Top` on the container via `<ItemsControl.Styles><Style Selector=\"ContentPresenter\"><Setter Property=\"Canvas.Left\" Value=\"{Binding X}\"/>...</Style></ItemsControl.Styles>`.",
    file: "the .axaml (the ItemsControl)",
    tags: ["itemscontrol", "canvas", "itemspanel", "canvas.left", "contentpresenter", "rectangles", "position"],
  },

  /* ---------------- async / threading ---------------- */
  {
    id: "invalid-thread", cat: "async",
    title: "Call from invalid thread / InvalidOperationException updating the UI",
    msg: "Call from invalid thread",
    cause: "You changed a bound property from a background task (e.g. inside a `Task.Run` or after `await Task.Delay` on a thread-pool thread). Avalonia only allows UI updates on the UI thread — this is the Problem 3 thread-safety point.",
    fix: "Marshal UI updates to the UI thread: `Dispatcher.UIThread.Post(() => Count++);`. Simplest safe option for the counter: use a `DispatcherTimer` (its Tick already runs on the UI thread) instead of a background loop.",
    file: "the ViewModel (.cs)",
    tags: ["invalid thread", "ui thread", "dispatcher", "invalidoperationexception", "background", "thread safety", "post"],
  },
  {
    id: "counter-doublestart", cat: "async",
    title: "Counter speeds up / jumps by 2 after pressing Start twice",
    msg: "counter increments too fast / multiple timers",
    cause: "Each press of Start began a NEW timer/loop while the old one kept running, so multiple loops increment the same number.",
    fix: "Guard Start so it does nothing if already running: keep an `_isRunning` flag (or check the timer / `CancellationTokenSource`), and only start when not already running. Stop/Pause cancels the existing one.",
    file: "the ViewModel (.cs)",
    tags: ["timer", "double start", "too fast", "increment", "guard", "isrunning", "cancellationtokensource"],
  },
  {
    id: "counter-resume", cat: "async",
    title: "Counter restarts from 0 instead of resuming after Pause",
    msg: "counter resets on resume",
    cause: "Start re-initialises the count to zero every time, so pressing Start after Pause loses the value.",
    fix: "Only set the count to 0 in the Reset command. Start should continue from the current field value. Pause just stops the timer / cancels the token without touching the number.",
    file: "the ViewModel (.cs)",
    tags: ["resume", "pause", "reset", "continue", "last number", "counter"],
  },

  /* ---------------- tests / headless ---------------- */
  {
    id: "no-tests", cat: "test",
    title: "No tests found in the project",
    msg: "No test is available / No tests found",
    cause: "Either the methods aren't marked as tests, or the test project doesn't reference the app it's testing, or the xUnit packages are missing.",
    fix: "Mark each test method with `[Fact]` (and add `using Xunit;`). Make sure the test .csproj has a `<ProjectReference>` to the app project and references `xunit` + `xunit.runner.visualstudio`. Run `dotnet test` from the test project folder.",
    file: "the test class + the test .csproj",
    tags: ["no tests found", "no test is available", "fact", "xunit", "projectreference", "dotnet test"],
  },
  {
    id: "headless", cat: "test",
    title: "Headless Avalonia test won't run / Avalonia not initialized",
    msg: "[AvaloniaFact] / headless / Avalonia not initialized",
    cause: "UI tests that touch real controls must run under the headless Avalonia harness. Using `[Fact]` for a UI test, or forgetting the headless setup, makes it fail or throw.",
    fix: "Reference `Avalonia.Headless.XUnit`. Add the assembly attribute once: `[assembly: AvaloniaTestApplication(typeof(TestAppBuilder))]` with a `TestAppBuilder` that builds your `App`. Mark UI test methods `[AvaloniaFact]` (not `[Fact]`). Plain ViewModel tests (no controls) can stay `[Fact]`. The Test Lab generates this whole scaffold.",
    file: "the test project (a TestAppBuilder.cs + the test class)",
    tags: ["headless", "avaloniafact", "avaloniatestapplication", "testappbuilder", "ui test", "not initialized", "100 times"],
  },
  {
    id: "ctor-fixture", cat: "test",
    title: "Constructor parameters did not have matching fixture data",
    msg: "constructor ... did not have matching fixture data",
    cause: "xUnit treats a test class's constructor parameters as fixtures to inject. If you put your own arguments there (like a ViewModel's dependencies), xUnit can't supply them.",
    fix: "Don't put arbitrary parameters on the test class constructor. Create the objects you need INSIDE each test method instead: `var vm = new MainWindowViewModel();`.",
    file: "the test class",
    tags: ["fixture data", "constructor", "matching fixture", "xunit", "injection"],
  },

  /* ---------------- restore / nuget (offline) ---------------- */
  {
    id: "service-index", cat: "nuget",
    title: "Unable to load the service index for source nuget.org",
    msg: "Unable to load the service index for source https://api.nuget.org",
    cause: "`dotnet restore` is trying to reach the internet, which is off during the exam.",
    fix: "Restore from your local offline feed: `dotnet restore --configfile \"...\\AOP Exam Companion\\scripts\\nuget.offline.config\"`, or copy `scripts\\nuget.offline.config` next to the .sln and rename it `nuget.config`. If the feed is empty (fresh machine), build it first with `scripts\\make-offline-feed.ps1`.",
    file: "run in the project folder / nuget.config",
    tags: ["service index", "nuget.org", "restore", "offline", "network", "nuget.config", "feed"],
  },
  {
    id: "nu1101", code: "NU1101", cat: "nuget",
    title: "Unable to find package 'X' (or the right version)",
    msg: "Unable to find package",
    cause: "The exact package/version isn't in the local cache or offline feed.",
    fix: "Use the exam's exact versions so they resolve from the cache: Avalonia `11.2.1`, CommunityToolkit.Mvvm `8.2.1`, target `net9.0`. Then restore from the offline feed (see the service-index fix). The .csproj that every Export-project button generates already pins these.",
    file: "the .csproj + nuget.config",
    tags: ["unable to find package", "nu1101", "version", "11.2.1", "8.2.1", "offline feed"],
  },
  {
    id: "nu1605", code: "NU1605", cat: "nuget",
    title: "Detected package downgrade / version conflict",
    msg: "Detected package downgrade",
    cause: "Two projects in the solution ask for different versions of the same package (often Avalonia).",
    fix: "Make every project use the SAME Avalonia version (11.2.1). Edit the lower one's .csproj to match, then restore again.",
    file: "the .csproj files",
    tags: ["downgrade", "nu1605", "version conflict", "avalonia", "mismatch"],
  },
  {
    id: "tfm", cat: "nuget",
    title: "Wrong target framework / packages need a newer framework",
    msg: "TargetFramework / net9.0",
    cause: "The project targets the wrong .NET version for the exam's packages.",
    fix: "Set `<TargetFramework>net9.0</TargetFramework>` in the .csproj. The exam stack is .NET 9.",
    file: "the .csproj",
    tags: ["targetframework", "net9.0", "framework", "tfm"],
  },

  /* ---------------- runtime / json / linq ---------------- */
  {
    id: "nullref", cat: "runtime",
    title: "NullReferenceException at runtime (object reference not set)",
    msg: "Object reference not set to an instance",
    cause: "Something was null when you used it. In Problem 4 this is the missing-JSON-field trap: a field that wasn't in the data deserialized to null and you used it without checking.",
    fix: "Make the model property nullable (`string?`, `int?`, `DateTime?`), and filter/guard before use, e.g. `ships.Where(s => s.ArrivalDate != null)` or `s.Name ?? \"\"`. 'Currently travelling' = `ArrivalDate == null` is the intended query, not a bug.",
    file: "the model + the query (Problem_4_*.cs)",
    tags: ["nullreferenceexception", "object reference not set", "null", "json", "missing", "linq"],
  },
  {
    id: "json-convert", cat: "runtime",
    title: "JsonException: the JSON value could not be converted",
    msg: "The JSON value could not be converted",
    cause: "A JSON field's type doesn't match your model property (e.g. a number arriving as a string, or a property name that doesn't line up), so deserialization throws.",
    fix: "Match the model property type to the data, and allow case differences: `JsonSerializer.Deserialize<List<T>>(text, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })`. Keep fields that may be missing nullable. Query Lab's generated code already does null-safe, case-insensitive deserialize.",
    file: "the deserialize call + the model",
    tags: ["jsonexception", "could not be converted", "deserialize", "propertynamecaseinsensitive", "json", "type"],
  },
  {
    id: "collection-modified", cat: "runtime",
    title: "Collection was modified; enumeration operation may not execute",
    msg: "Collection was modified",
    cause: "You added to or removed from a list while looping over it with `foreach`.",
    fix: "Loop over a snapshot (`foreach (var x in items.ToList())`), or build a new list with LINQ instead of mutating in place.",
    file: "the loop in question",
    tags: ["collection was modified", "enumeration", "foreach", "modified", "tolist"],
  },
  {
    id: "binarysearch", cat: "runtime",
    title: "Binary search returns a negative number / wrong result",
    msg: "List.BinarySearch returns negative",
    cause: "`BinarySearch` only works on a list that is already SORTED by the same key/comparer you search with. On an unsorted list it returns a meaningless (often negative) value.",
    fix: "Sort first by the search key, then search with a matching comparer. For 'find the ship named Rocinante': `ships.Sort((a,b) => string.Compare(a.Name, b.Name));` then `int i = ships.BinarySearch(new Ship{Name=\"Rocinante\"}, Comparer<Ship>.Create((a,b)=>string.Compare(a.Name,b.Name)));` and check `i >= 0`.",
    file: "Problem_4_Program.cs",
    tags: ["binarysearch", "binary search", "negative", "sorted", "comparer", "rocinante"],
  },
];

/* ---------------- matching a pasted error ---------------- */
function match(text) {
  text = String(text == null ? "" : text).toLowerCase();
  if (!text.trim()) return [];
  var codes = text.match(/\b(cs\d{3,4}|nu\d{3,4}|mvvmtk\d+|avln\d+|xamlil\d*)\b/g) || [];
  var scored = ENTRIES.map(function (e) {
    var score = 0, why = [];
    if (e.code && codes.indexOf(e.code.toLowerCase()) !== -1) { score += 100; why.push(e.code); }
    if (e.msg && text.indexOf(e.msg.toLowerCase().slice(0, 22)) !== -1) { score += 25; why.push("message text"); }
    (e.tags || []).forEach(function (t) {
      t = String(t).toLowerCase();
      if (t.length >= 4 && text.indexOf(t) !== -1) { score += 7; why.push(t); }
    });
    return { entry: e, score: score, why: uniq(why) };
  }).filter(function (x) { return x.score > 0; });
  scored.sort(function (a, b) { return b.score - a.score; });
  return scored;
}

/* ---------------- keyword / code search ---------------- */
function search(query) {
  query = String(query == null ? "" : query).toLowerCase().trim();
  if (!query) return ENTRIES.slice();
  var terms = query.split(/\s+/).filter(Boolean);
  return ENTRIES.filter(function (e) {
    var hay = (e.code || "") + " " + e.title + " " + e.cat + " " + e.cause + " " +
      e.fix + " " + (e.tags || []).join(" ");
    hay = hay.toLowerCase();
    return terms.every(function (t) { return hay.indexOf(t) !== -1; });
  });
}

function byCategory(key) {
  return ENTRIES.filter(function (e) { return e.cat === key; });
}

var API = { ENTRIES: ENTRIES, CATEGORIES: CATEGORIES, match: match, search: search, byCategory: byCategory };
global.ERRORS_CORE = API;
if (typeof module !== "undefined" && module.exports) module.exports = API;

})(typeof window !== "undefined" ? window : globalThis);
