/* ============ 3-DAY BOOTCAMP ============ */

window.TOPICS.push(

{
id: "bc-plan",
title: "The 3-day plan (start here)",
cat: "3-Day Bootcamp",
tags: ["bootcamp", "plan", "schedule", "3 days", "study plan"],
related: ["bc-d1-lesson", "bc-d2-lesson", "bc-d3-tasks", "bc-starter-kit"],
blocks: [
  { p: "You know C#, OOP, LINQ, JSON and some unit testing. That already covers roughly half the exam points. The gap is Avalonia + MVVM Toolkit (30 pts) and async (up to 20 pts). This bootcamp closes the gap by TYPING, not reading: every day has a lesson dissection, an exam task broken down, and tasks with hidden solutions. Checkboxes save automatically." },
  { tip: "New: every lesson now carries the example itself — a green **▶ Download runnable project (.zip)** button, a live preview of it running, and the full source one click away. No hopping to other tabs or hunting through `AOP_extracted\\` folders: unzip, press F5, see it work." },
  { table: { head: ["Day", "Theme", "Topics in this tab"], rows: [
    ["Day 1", "Avalonia + MVVM (the 30-point gap)", "[[bc-d1-lesson|Lesson: ContactList dissected]] → [[bc-d1-exam|Exam: RectangleUI broken down]] → [[bc-d1-tasks|Tasks]]"],
    ["Day 2", "Testing + async (Problem 3, both variants)", "[[bc-d2-lesson|Lesson: TestableCalculator dissected]] → [[bc-d2-exam|Exam: Counter tests & async]] → [[bc-d2-tasks|Tasks]]"],
    ["Day 3", "LINQ/SOLID consolidation + full mock", "[[bc-d3-lesson|Lesson: LINQ pipeline anatomy]] → [[bc-d3-exam|Exam: spaceships & SOLID answers]] → [[bc-d3-tasks|Tasks + mock + checklist]]"],
  ]}},
  { tasks: [
    "Day 1 morning: read the ContactList dissection, then RETYPE the ViewModel + axaml from memory in the [[bc-starter-kit|starter kit]] app",
    "Day 1 afternoon: rebuild June RectangleUI from the real starter files without peeking",
    "Day 1 evening: build the August MealPlanner UI from its starter, compare with the official solution",
    "Day 2 morning: create test projects from scratch (this also caches NuGet packages for offline!), write the 5 Counter tests",
    "Day 2 afternoon: headless 100-click test + async counter implemented 3 ways",
    "Day 3 morning: LINQ drills + spaceships exam cold",
    "Day 3 midday: write both Problem-1 submission texts cold, compare with model answers",
    "Day 3 afternoon: full timed mock of the August re-exam, including the 6-file submission folder",
  ]},
  { rule: "Self-check after Day 1: if the RectangleUI rebuild still feels like fighting the framework, steal time from Day 3's LINQ block (your strength) and do more UI reps instead." },
]},

{
id: "bc-starter-kit",
title: "Your ready-to-open starter kit (zero setup)",
cat: "3-Day Bootcamp",
tags: ["starter kit", "minimal setup", "template", "ready project", "no setup", "scaffold"],
related: ["bc-plan", "av-project-structure", "ut-setup"],
blocks: [
  { p: "On your Desktop (or download it right here): `AOP Exam Starter Kit\\` with a solution you just open and type into. No Avalonia setup, no template hunting, packages pre-restored (so they sit in your offline NuGet cache)." },
  { demo: "starter-kit" },
  { table: { head: ["Project", "What it is", "Use for"], rows: [
    ["`ExamApp/`", "Minimal Avalonia MVVM app, exam-identical stack (net9.0, Avalonia 11.2.1, Toolkit 8.2.1), one working binding + command + list already in place", "any UI work, practicing, or as a scratch app"],
    ["`ExamApp.Tests/`", "xUnit + Avalonia.Headless.XUnit wired to ExamApp, TestAppBuilder done, one VM test + one headless test passing", "Problem 3a: copy/adapt instead of creating from scratch"],
    ["`ExamConsole/`", "Console app with JSON model + deserialize + sample query + save-results skeleton, `data.json` included", "Problem 4: paste your queries into a working pipeline"],
    ["`StarterKit.sln`", "One solution with all three", "open this, F5, go"],
  ]}},
  { steps: [
    "Open `StarterKit.sln` (or the folder in VS Code).",
    "`dotnet run --project ExamApp` → window with a working input + button + list.",
    "`dotnet test` → 2 passing tests (one plain, one headless).",
    "`dotnet run --project ExamConsole` → reads data.json, prints a query, writes results.json.",
  ]},
  { tip: "At the exam, Problems 1–3 hand you their own projects. The kit matters most for June-style Problem 3 (\"create a new xUnit project\") and Problem 4 (\"create a new console application\"): copy the kit project next to the exam files, rename, adjust the ProjectReference, done in 2 minutes." },
  { gotcha: "If the exam machine is not this laptop, copy the WHOLE kit folder AND run `dotnet build` on that machine once while you still have internet, so its NuGet cache gets populated too." },
]},

{
id: "bc-d1-lesson",
title: "Day 1 · Lesson dissected: ContactList line by line",
cat: "3-Day Bootcamp",
tags: ["day 1", "contactlist", "dissection", "mvvm explained", "line by line"],
related: ["mv-contactlist-full", "bc-d1-exam", "mv-binding-cookbook"],
blocks: [
  { p: "The course's flagship MVVM app, taken apart so every line has a WHY. The whole runnable app is right here: download it, press F5, then read the annotations below against the live window. (Deeper dive: [[mv-contactlist-full|ContactList MVVM]].)" },
  { demo: "contactlist" },
  { h: "The data flow (hold this picture)" },
  { steps: [
    "You type in the Name TextBox → TwoWay binding writes `NewContactName` in the VM.",
    "You click Add → the `Command` binding invokes `AddContact()` on the VM.",
    "`AddContact()` adds a Contact to the `ObservableCollection` → the collection raises CollectionChanged → the ListBox inserts a row showing `Contact.ToString()`.",
    "Setting `NewContactName = null` at the end → PropertyChanged → the TextBox clears itself. The VM never touched a control.",
  ]},
  { h: "The ViewModel, annotated" },
  { code: String.raw`public partial class MainWindowViewModel : ObservableObject
//           ^ partial: the source generator adds members to THIS class
//                                ^ ObservableObject: supplies PropertyChanged plumbing
{
    public ObservableCollection<Contact> Contacts { get; }
    // get-only: the View binds to ONE collection instance forever; we mutate it,
    // we never replace it (replacing a get-only property breaks the binding)

    private readonly IContactRepository _contactRepository;
    // interface, not JSONContactRepository: DIP -- the VM doesn't care where data lives

    [ObservableProperty]
    private string? newContactName;
    // generator emits: public string? NewContactName { get; set; } with notification
    // lowercase field -> PascalCase property. ALWAYS use the property in code.

    [ObservableProperty]
    private Contact? selectedContact;
    // bound to ListBox.SelectedItem; null when nothing is selected -> hence Contact?

    public MainWindowViewModel(IContactRepository contactRepository)
    {
        _contactRepository = contactRepository;       // injected by App.axaml.cs
        Contacts = _contactRepository.Load("contacts.json");
        // constructor = "on startup" work. Exams love "already populated on startup".
    }

    public void AddContact()
    {
        if (string.IsNullOrWhiteSpace(NewContactName) ||
            string.IsNullOrWhiteSpace(NewContactEmail))
            return;                                   // guard: free robustness points

        Contacts.Add(new Contact { Name = NewContactName!, Email = NewContactEmail! });
        NewContactName = NewContactEmail = null;      // property write -> UI clears
    }

    public void DeleteContact()
    {
        if (SelectedContact is not null)
            Contacts.Remove(SelectedContact);         // remove what the ListBox selected
    }
}`, lang: "csharp", title: "Every line justified" },
  { h: "The View, annotated" },
  { code: String.raw`<Window ...
        x:DataType="vm:MainWindowViewModel">
        <!-- ^ compiled bindings: typos in binding paths become COMPILE errors -->

    <StackPanel Spacing="10" Margin="10">

        <ListBox ItemsSource="{Binding Contacts}"
                 SelectedItem="{Binding SelectedContact}"/>
        <!-- ItemsSource: the list. SelectedItem: TwoWay sync of the selection.
             Rows display Contact.ToString() => "Name (Email)" -->

        <TextBox Text="{Binding NewContactName}"/>
        <!-- TextBox.Text is TwoWay by default: typing writes the VM property -->

        <Button Content="Add Contact" Command="{Binding AddContact}"/>
        <!-- bound straight to the method here; with [RelayCommand] you would
             bind AddContactCommand instead. Know both spellings. -->

        <TextBlock Text="{Binding SelectedContact.Name}"/>
        <!-- nested path: re-resolves whenever SelectedContact changes -->
    </StackPanel>
</Window>`, lang: "xml", title: "Every binding justified" },
  { gotcha: "The three failure modes to burn in now: forgot `partial` (generator can't extend the class), wrote to `_field` instead of `Property` (no notification), bound a `List<T>` instead of `ObservableCollection<T>` (UI never updates). These three cause 90% of exam UI bugs." },
]},

{
id: "bc-d1-exam",
title: "Day 1 · Exam dissected: RectangleUI as 8 decisions",
cat: "3-Day Bootcamp",
tags: ["day 1", "rectangleui", "exam breakdown", "decisions", "june p2"],
related: ["ex-june-p2-rectangle", "bc-d1-tasks", "av-itemscontrols"],
blocks: [
  { p: "June 2025 Problem 2 (30 pts), reframed as the sequence of decisions YOU make at the desk. Train the decisions, not the memorized file. The finished solution is downloadable and runnable right below — build it, watch the 2-second shuffle, then walk the 8 decisions. (Deeper dive: [[ex-june-p2-rectangle|RectangleUI solution]].)" },
  { demo: "rectangleui" },
  { h: "Decision 1 · Read the starter, list the holes" },
  { p: "The axaml ships with `ItemsSource=\"\"`, hardcoded `Width=\"100\" Height=\"100\" Fill=\"Red\"`, hardcoded `Canvas.Left/Top` setters, an unbound Button and two unbound Sliders. So the work IS: one collection, one command, two slider properties, five item bindings. Listing the holes first = your TODO list." },
  { h: "Decision 2 · What is one rectangle? (the Model)" },
  { p: "It has X, Y, Width, Height, Color, and they CHANGE every 2 seconds while on screen. Changing-while-visible forces `partial class RectangleData : ObservableObject` with `[ObservableProperty]` fields. A plain POCO would freeze every rectangle at its spawn values." },
  { h: "Decision 3 · Where does the collection live?" },
  { p: "`ObservableCollection<RectangleData> Rectangles { get; }` in the VM: items get added at runtime, the ItemsControl must see each Add. Get-only, mutate forever." },
  { h: "Decision 4 · The Add button" },
  { code: String.raw`[RelayCommand]                       // -> AddRectangleCommand
private void AddRectangle() { ... }  // XAML: Command="{Binding AddRectangleCommand}"`, lang: "csharp" },
  { h: "Decision 5 · 'Completely visible' = the clamp formula" },
  { code: String.raw`// canvas is 500x500; a rect at X spans [X, X + Width]
// so the legal range for X is [0, 500 - Width]:
X = _random.NextDouble() * (CanvasSize - RectWidth);
Y = _random.NextDouble() * (CanvasSize - RectHeight);`, lang: "csharp", title: "This one line is worth several points" },
  { h: "Decision 6 · Sliders" },
  { p: "`Value=\"{Binding RectWidth}\"` + `[ObservableProperty] double rectWidth = 50` (Slider.Value is double, default matches the starter's Value=\"50\"). The command reads the CURRENT property values when clicked: no extra wiring needed." },
  { h: "Decision 7 · Items positioned on the Canvas" },
  { p: "The starter already gave the exotic part: the `ContentPresenter` style with `Canvas.Left`/`Canvas.Top` setters. Your edit is replacing `Value=\"10\"` with `Value=\"{Binding X}\"` / `{Binding Y}` (plus `x:DataType` already in place). If you ever must write it from scratch, it is the 3-part pattern in [[av-itemscontrols|ItemsControl on Canvas]]." },
  { h: "Decision 8 · Every 2 seconds, UI-thread-safe" },
  { p: "Options: DispatcherTimer (ticks ON the UI thread → requirement satisfied by construction, simplest), or Task loop + `Dispatcher.UIThread.Post`. Pick DispatcherTimer at the exam; mention the thread-safety argument in a comment. Colors: predefined `IBrush[]`, pick with `_random.Next(_colors.Length)`." },
  { tip: "Total typing for 30 points: ~45 lines of VM, ~8 attribute edits in axaml. The skill is recognizing the 8 decisions fast: that's what Day 1's tasks drill." },
]},

{
id: "bc-d1-tasks",
title: "Day 1 · Tasks (UI reps)",
cat: "3-Day Bootcamp",
tags: ["day 1", "tasks", "practice", "exercises", "ui reps"],
related: ["bc-d1-lesson", "bc-d1-exam", "ex-reexam-p2-mealplanner"],
blocks: [
  { p: "Do these in order. Use the [[bc-starter-kit|starter kit]] app for T1–T2; the real exam starters for T3–T4. Check off as you go." },
  { tasks: [
    "T1 · In the starter kit app: add a Delete button that removes the selected item, and a TextBlock showing 'N items' that stays correct (15 min)",
    "T2 · Turn the kit's plain ListBox into card-style rows with a bold title + gray subtitle via ItemTemplate (15 min)",
    "T3 · THE BIG ONE: open AOP_2025_Exam_One\\Problem_2_UI\\RectangleUI and solve 2.2 + 2.3 completely, no peeking; compare afterwards (90 min)",
    "T4 · Open AOP_2025_ReExam\\Problem 2 - UI\\FamilyMealPlannerUI and solve 2.1–2.3; compare with the official solution (75 min)",
    "T5 · Close everything and retype the RectangleUI ViewModel from a blank file in under 12 minutes",
  ]},
  { h: "T1 solution" },
  { reveal: [
    { code: String.raw`// ViewModel additions:
[ObservableProperty]
[NotifyPropertyChangedFor(nameof(ItemCountText))]
private string? selectedItem;

public string ItemCountText => $"{Items.Count} items";

[RelayCommand]
private void DeleteItem()
{
    if (SelectedItem is not null) Items.Remove(SelectedItem);
    OnPropertyChanged(nameof(ItemCountText));
}

// also call OnPropertyChanged(nameof(ItemCountText)) at the end of AddItem().
// (Alternative: Items.CollectionChanged += (_, _) => OnPropertyChanged(nameof(ItemCountText));
//  wired once in the constructor -- covers Add AND Remove automatically.)`, lang: "csharp" },
    { code: String.raw`<Button Content="Delete" Command="{Binding DeleteItemCommand}"/>
<TextBlock Text="{Binding ItemCountText}"/>
<!-- ListBox needs: SelectedItem="{Binding SelectedItem}" -->`, lang: "xml" },
  ]},
  { h: "T2 solution" },
  { reveal: [
    { code: String.raw`<ListBox ItemsSource="{Binding Items}" Background="Transparent">
    <ListBox.ItemTemplate>
        <DataTemplate>
            <Border Background="White" BorderBrush="#E3E3E3" BorderThickness="1"
                    CornerRadius="8" Padding="10" Margin="0,3">
                <StackPanel>
                    <TextBlock Text="{Binding}" FontWeight="SemiBold"/>
                    <TextBlock Text="tap to select" Foreground="#888888" FontSize="11"/>
                </StackPanel>
            </Border>
        </DataTemplate>
    </ListBox.ItemTemplate>
</ListBox>
<!-- items are plain strings here, so Text="{Binding}" binds the item itself;
     with a model class you would bind {Binding Name} etc. -->`, lang: "xml" },
  ]},
  { p: "T3 solution: [[ex-june-p2-rectangle|RectangleUI full solution]]. T4 solution: [[ex-reexam-p2-mealplanner|official MealPlanner solution]]. Score yourself per sub-task: layout / basic / advanced." },
]},

{
id: "bc-d2-lesson",
title: "Day 2 · Lesson dissected: TestableCalculator",
cat: "3-Day Bootcamp",
tags: ["day 2", "testablecalculator", "dissection", "testing explained"],
related: ["ut-testing-viewmodels", "ut-headless", "bc-d2-exam"],
blocks: [
  { p: "The unit-testing lecture's flagship: one calculator app + two test projects. Download and run it below (`dotnet run`) — type 0 into operand 2 and watch the **/** button grey itself out — then read why each piece exists." },
  { demo: "testablecalculator" },
  { h: "The system under test" },
  { code: String.raw`public partial class MainWindowViewModel : ViewModelBase
{
    [ObservableProperty]
    private int _firstOperand;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(DivideCommand))]
    private int _secondOperand;
    // ^ whenever SecondOperand changes, re-ask CanExecute -> the / button
    //   enables/disables itself. THIS attribute is the whole lesson.

    [ObservableProperty]
    private float _result;

    [RelayCommand]
    private void Add() => Result = FirstOperand + SecondOperand;

    [RelayCommand(CanExecute = nameof(CheckIfDivisionByZero))]
    private void Divide() => Result = FirstOperand / SecondOperand;

    private bool CheckIfDivisionByZero() => SecondOperand != 0;
    // guard instead of try/catch: the bad action becomes impossible, not handled
}`, lang: "csharp", title: "Calculator VM (course verbatim, annotated)" },
  { h: "Test 1: plain xUnit, no Avalonia anywhere" },
  { code: String.raw`[Fact]
public void AddCommand_AddsTwoNumbers()
{
    MainWindowViewModel vm = new();      // ARRANGE: a VM is just a class
    Assert.Equal(0, vm.Result);          // (baseline assert: starts clean)

    vm.FirstOperand = 1;                 // ACT: set state through the
    vm.SecondOperand = 1;                //      GENERATED properties
    vm.AddCommand.Execute(null);         //      invoke the GENERATED command

    Assert.Equal(2, vm.Result);          // ASSERT
}
// Why this works without a window: MVVM means logic lives in a plain class.
// This test IS the argument for the pattern -- say so in written answers.`, lang: "csharp" },
  { h: "Test 2: headless, because enabled-state lives in the UI" },
  { code: String.raw`[AvaloniaFact]
public void Should_Enable_Button_If_Not_Zero()
{
    var window = new MainWindow { DataContext = new MainWindowViewModel() };
    window.Show();                                   // mandatory, even headless

    Assert.False(window.DivideButton.IsEffectivelyEnabled);
    // ^ tests the CHAIN: CanExecute=false -> Button disabled. A VM test
    //   can check CanExecute(); only a UI test proves the BUTTON obeys it.

    window.SecondOperandInput.Focus();
    window.KeyTextInput("10");                       // real input pipeline:
    // TextBox -> TwoWay binding -> SecondOperand -> NotifyCanExecuteChangedFor
    Assert.True(window.DivideButton.IsEffectivelyEnabled);
}`, lang: "csharp" },
  { list: [
    "Why two projects: plain tests must not drag in the Avalonia headless platform; the course separates Calculator.Test and Calculator.AvaloniaTest.",
    "`window.DivideButton` works because the control has `Name=\"DivideButton\"` in the axaml AND the app csproj grants `InternalsVisibleTo` to the test project.",
    "TestAppBuilder + `[assembly: AvaloniaTestApplication]` exist ONCE per headless test project: they boot a windowless Avalonia. Forgetting them = cryptic dispatcher errors.",
  ]},
]},

{
id: "bc-d2-exam",
title: "Day 2 · Exam dissected: Counter tests & async counter",
cat: "3-Day Bootcamp",
tags: ["day 2", "counter", "exam breakdown", "tests mapped", "async decisions"],
related: ["pb-unit-testing", "pb-async", "bc-d2-tasks"],
blocks: [
  { h: "June P3: what each required test actually proves" },
  { table: { head: ["Required test", "It proves", "The one line that matters"], rows: [
    ["Counter initialized to zero", "constructor behavior", "`Assert.Equal(0, vm.Count)`"],
    ["Decrement CANNOT execute after init", "the CanExecute guard at boundary", "`Assert.False(vm.DecrementCommand.CanExecute(null))`"],
    ["Increment increments by one", "command effect", "`vm.IncrementCommand.Execute(null); Assert.Equal(1, vm.Count)`"],
    ["Decrement CAN execute after increment", "guard re-evaluation (OnCountChanged → NotifyCanExecuteChanged)", "`Assert.True(...CanExecute(null))` after one Execute"],
    ["Decrement decrements by one", "command effect + symmetry", "inc, dec, `Assert.Equal(0, vm.Count)`"],
  ]}},
  { p: "Notice the pattern: tests 2 and 4 are about `CanExecute`, not about arithmetic. The examiner is checking you know commands have a second half. The five tests are a ready-to-run project below — download it and `dotnet test` goes green. (Deeper dive: [[pb-unit-testing|testing playbook]].)" },
  { demo: "counter-tests" },
  { h: "August P3: requirements → mechanism mapping" },
  { table: { head: ["Requirement (points)", "Mechanism", "Why"], rows: [
    ["+1 every 100 ms (10)", "DispatcherTimer Interval=100ms, or Task loop with `await Task.Delay(100, token)`", "a loop with delay IS a timer"],
    ["Pause, resume from same number (4)", "Stop the timer / cancel the CTS and null it. Don't touch Count", "state survives because you never reset it"],
    ["Reset to zero (4)", "`Count = 0` in ResetCommand", "independent of running state"],
    ["UI updates on UI thread (2)", "DispatcherTimer = already there; Task variant = `Dispatcher.UIThread.Post(() => Count++)`", "bound-property writes must happen on the UI thread"],
  ]}},
  { h: "The two traps in the async variant" },
  { list: [
    "**Double-start**: clicking Start twice must not create two loops (counter would jump by 2). Guard: `if (_cts is not null) return;` or `if (_timer is { IsEnabled: true }) return;`",
    "**Resume vs restart**: pause means cancel the LOOP, keep the VALUE. People who stuff `Count = 0` into Stop lose the resume points.",
  ]},
  { p: "All three full implementations are in the runnable download below (Solution A is wired up; B and C are in the source). Click Start to watch it climb, Stop to pause, Start to resume. (Deeper dive: [[pb-async|async playbook]].)" },
  { demo: "async-counter" },
]},

{
id: "bc-d2-tasks",
title: "Day 2 · Tasks (testing + async reps)",
cat: "3-Day Bootcamp",
tags: ["day 2", "tasks", "practice", "testing reps", "async reps", "quiz"],
related: ["bc-d2-lesson", "bc-d2-exam", "th-async-await"],
blocks: [
  { tasks: [
    "T1 · From scratch: dotnet new xunit, reference the June Counter project, write all 5 required tests, green run of dotnet test (45 min). Doubles as NuGet cache prep!",
    "T2 · Add Avalonia.Headless.XUnit, name the Counter's controls, write the 100-click headless test, green (30 min)",
    "T3 · Implement the August async counter with DispatcherTimer, run it, click Start twice to verify your double-start guard (20 min)",
    "T4 · Reimplement it with Task.Run + CancellationToken + Dispatcher.UIThread.Post (25 min)",
    "T5 · Reimplement it with PeriodicTimer + async RelayCommand (15 min)",
    "T6 · Answer the 3 quiz questions below BEFORE revealing",
  ]},
  { h: "Quiz 1 · Predict the output order" },
  { p: "The lecture's numbered async example: `Run()` prints 1, calls `DoSomethingAsync()` (not awaited), prints 2. Inside: prints 3, starts a Task printing 7 ten times, sleeps, prints 4, sleeps, prints 5, awaits, prints 6. What order do 1–7 appear in?" },
  { reveal: [
    { p: "1, 3, then 7s start interleaving, 4, 5, THEN 2 (the await finally yields control back to Run), more 7s, and 6 last (after the task finishes). Key rules: the Task starts when CREATED, not when awaited; `Thread.Sleep` blocks so 2 cannot appear until the first real `await`; 6 is the continuation. Full trace: [[th-async-await|async/await mechanics]]." },
  ], label: "Show answer" },
  { h: "Quiz 2 · The race" },
  { p: "10 tasks each increment a shared `int` 1000 times without locking. Expected final value? Likely actual value? Why? What is the two-line fix?" },
  { reveal: [
    { p: "Expected 10,000; actual is typically LESS because `counter++` is read-modify-write and concurrent threads overwrite each other's increments (lost updates). Fix: a dedicated `private readonly object _lock = new();` and `lock (_lock) { counter++; }`. Definition requires BOTH: concurrent access AND at least one writer." },
  ], label: "Show answer" },
  { h: "Quiz 3 · IO vs CPU" },
  { p: "You must (a) download 3 files, (b) compute primes up to 3 million, (c) keep a progress bar alive during both. Which tool for which?" },
  { reveal: [
    { p: "(a) IO-bound → async/await the naturally-async API, start all three then `await Task.WhenAll` so they run concurrently. (b) CPU-bound → `await Task.Run(() => CountPrimes(...))` to move it off the UI thread. (c) The progress bar stays alive automatically as long as you never block the UI thread: that is the whole point of both choices." },
  ], label: "Show answer" },
]},

{
id: "bc-d3-lesson",
title: "Day 3 · Lesson dissected: anatomy of a LINQ pipeline",
cat: "3-Day Bootcamp",
tags: ["day 3", "linq anatomy", "pipeline", "groupby join", "dissection"],
related: ["lq-cookbook", "bc-d3-exam", "lq-lazy-evaluation"],
blocks: [
  { p: "You know LINQ; this dissection is about WRITING the exam's hardest query shape calmly: best-selling product = group + aggregate + sort + join + first. Watch the TYPE at every stage; that's the skill. To run LINQ live while you read, grab the spaceships console in the [[bc-d3-exam|next lesson]] or the [[bc-starter-kit|starter kit]]'s ExamConsole and paste these stages in." },
  { code: String.raw`var bestSeller = sales                       // List<Sale>
    .GroupBy(s => s.ProductId)               // IEnumerable<IGrouping<int, Sale>>
    //  each group: Key = ProductId, contents = that product's Sale rows

    .Select(g => new {                       // IEnumerable<anon{ProductId, Total}>
        ProductId = g.Key,
        Total = g.Sum(s => s.QuantitySold)   // aggregate INSIDE each group
    })

    .OrderByDescending(x => x.Total)         // same type, sorted

    .Join(products,                          // IEnumerable<anon{Name, Total}>
        x => x.ProductId,                    // key from the aggregated side
        p => p.Id,                           // key from products
        (x, p) => new { p.Name, x.Total })   // shape the final row

    .First();                                // anon{Name, Total} -- EXECUTES here

Console.WriteLine($"{bestSeller.Name}: {bestSeller.Total} units");`, lang: "csharp", title: "Five stages, five types" },
  { list: [
    "Build it stage by stage: write `.GroupBy(...)`, hover/print, THEN add `.Select(...)`. Never write the whole chain blind.",
    "Everything before `.First()` is deferred (lazy): the query runs once, at the terminal operator.",
    "Group-then-join beats join-then-group here: aggregate 15 sale rows down to 12 product totals BEFORE joining.",
    "The null-guard habit for exam data: any optional collection is `(x.List ?? new())` and any optional count is `x.List?.Count ?? 0`.",
  ]},
  { h: "The decision table (which operator do I reach for?)" },
  { table: { head: ["The task says", "You reach for"], rows: [
    ["\"all X where...\"", "`Where`"],
    ["\"only the names/...\"", "`Select`"],
    ["\"sorted by..., most first\"", "`OrderByDescending`"],
    ["\"per type / per category / per year\"", "`GroupBy` + `Select` with aggregates"],
    ["\"average/total/number of...\"", "`Average` / `Sum` / `Count` (maybe inside a group)"],
    ["\"combine the two files/lists\"", "`Join`"],
    ["\"the single / the first / the top 3\"", "`Single(pred)` / `First()` / `Take(3)`"],
    ["\"is there any / do all\"", "`Any(pred)` / `All(pred)`"],
    ["\"without duplicates\"", "`Distinct()` (after `SelectMany` if flattening)"],
  ]}},
]},

{
id: "bc-d3-exam",
title: "Day 3 · Exam dissected: spaceships queries & SOLID answers",
cat: "3-Day Bootcamp",
tags: ["day 3", "spaceships breakdown", "solid answer construction", "exam reasoning"],
related: ["ex-june-p4-linq", "pb-problem1-analysis", "bc-d3-tasks"],
blocks: [
  { h: "Spaceships (June P4): the reasoning per query" },
  { table: { head: ["Query", "The catch", "The move"], rows: [
    ["1 · all military ships", "none: warm-up", "`Where(s => s.Type == \"Military\")`"],
    ["2 · currently traveling", "'traveling' is NOT a field: it's defined as 'a trip with no ArrivalDate'. Translate words → data condition", "`Where(s => (s.TravelHistory ?? new()).Any(t => t.ArrivalDate == null))`"],
    ["3 · sorted by trip count", "ships with NO TravelHistory must sort as 0, not crash", "`OrderByDescending(s => s.TravelHistory?.Count ?? 0)`"],
    ["4 · average trips per type", "average of a COUNT, grouped", "`GroupBy(Type)` then `g.Average(s => s.TravelHistory?.Count ?? 0)`"],
    ["5 · departed Ganymede in 2245", "two conditions on the same trip + nullable date", "`Any(t => t.DeparturePort == \"Ganymede Port\" && t.DepartureDate?.Year == 2245)`"],
  ]}},
  { p: "The 10 'parse JSON' points are really nullable-modeling points: `List<Trip>?` and `DateTime?` absorb the missing values. And 4.3's binary search has one silent killer: sort by Name FIRST. The complete console is downloadable and runnable below — `dotnet run` prints the labelled results, Rocinante and all. (Deeper dive: [[ex-june-p4-linq|spaceships solution]].)" },
  { demo: "spaceships-linq" },
  { h: "SOLID written answers (Aug P1): the construction recipe" },
  { steps: [
    "Sentence 1: verdict. \"LSP: VIOLATED.\" / \"ISP: PRESENT.\" The grader can tick the 1-point box instantly.",
    "Sentence 2: evidence with NAMES. \"MealPlanner.GenerateMealPlan downcasts _recipeFinder with 'as InMemoryRecipeRepository' and errors out for other implementations.\" Class + method + the actual code fragment.",
    "Sentence 3: principle purpose tied to THIS code. \"Implementations should be substitutable for the abstraction; here a DatabaseRecipeFinder would be rejected, so they are not.\"",
    "Optional sentence 4 (cheap extra credit): the fix. \"Adding GetRandomRecipe to IRecipeFinder removes the cast.\"",
  ]},
  { p: "Apply the recipe five times and you have the full 25 points. Model answers for all five: [[pb-problem1-analysis|Problem 1 playbook]]." },
]},

{
id: "bc-d3-tasks",
title: "Day 3 · Tasks: drills, mock & exam-day checklist",
cat: "3-Day Bootcamp",
tags: ["day 3", "tasks", "linq drills", "mock exam", "checklist", "exam day"],
related: ["bc-d3-lesson", "bc-d3-exam", "pb-exam-overview"],
blocks: [
  { h: "LINQ drills (fresh, not from past exams)" },
  { p: "Use the course practice file `Collections\\LINQ_Query_Examples.cs` (12 products, 15 sales) in the [[bc-starter-kit|starter kit]] console. Solve all six, then reveal." },
  { tasks: [
    "D1 · All Office products, cheapest first",
    "D2 · Names and prices of the 3 most expensive products",
    "D3 · Is any product cheaper than 15 kr? (one boolean)",
    "D4 · Total revenue per category (needs the sales list)",
    "D5 · The single sale with the highest revenue (date + product name + amount)",
    "D6 · Products sold more than once (by number of sale rows)",
  ]},
  { reveal: [
    { code: String.raw`// D1
var office = products.Where(p => p.Category == "Office")
                     .OrderBy(p => p.Price).ToList();
// Desk Chair 149.99, Standing Desk 299.99

// D2
var top3 = products.OrderByDescending(p => p.Price)
                   .Take(3)
                   .Select(p => new { p.Name, p.Price }).ToList();
// Laptop 899.99, Smartphone 599.99, Tablet 499.99

// D3
bool anyCheap = products.Any(p => p.Price < 15);   // true (Sci-Fi Novel 14.99)

// D4
var revenuePerCategory = sales
    .Join(products, s => s.ProductId, p => p.Id,
          (s, p) => new { p.Category, Revenue = p.Price * s.QuantitySold })
    .GroupBy(x => x.Category)
    .Select(g => new { Category = g.Key, Total = g.Sum(x => x.Revenue) })
    .OrderByDescending(x => x.Total);

// D5
var biggestSale = sales
    .Join(products, s => s.ProductId, p => p.Id,
          (s, p) => new { s.Date, p.Name, Revenue = p.Price * s.QuantitySold })
    .OrderByDescending(x => x.Revenue)
    .First();
// 10 Smartphones on 2026-03-02 = 5999.90

// D6
var soldMoreThanOnce = sales
    .GroupBy(s => s.ProductId)
    .Where(g => g.Count() > 1)
    .Join(products, g => g.Key, p => p.Id, (g, p) => p.Name)
    .ToList();
// Laptop, Smartphone, Shoes`, lang: "csharp", title: "All six drills solved (with expected results)" },
  ], label: "Show drill solutions" },
  { h: "Theory drill + the mock" },
  { tasks: [
    "W1 · MCQ theory: for June's DocumentManager, name each OOP pillar / SOLID principle / pattern present and the planted violation cold (25 min); this is exactly the 20-MCQ skill. Drill the Quiz Exam-Theory set too.",
    "W2 · Do the same for FamilyMealPlanner's five SOLID principles cold (25 min), compare with the model analysis",
    "M1 · FULL TIMED MOCK (2026 shape): ~30 min on the 20 MCQs, 75 min P2 UI, 45 min P3 async, 50 min P4 LINQ, 20 min assembling the flat 6-file folder (P2 VM+axaml, P3 VM+axaml, P4 Program+Models)",
    "M2 · Post-mortem: for every point you'd have lost, find the matching topic in this app and re-read it",
  ]},
  { h: "Exam-day checklist (tick these the evening before)" },
  { tasks: [
    "`dotnet --info` shows a .NET 9 SDK on the exam machine",
    "Created one xUnit + one headless test project on THAT machine with internet once (NuGet cache is warm); `dotnet test` ran green offline",
    "AOP Exam Companion folder copied to the exam machine and opens in the browser",
    "AOP_extracted folder (course solutions) and AOP Exam Starter Kit copied over",
    "IDE of choice opens an Avalonia solution without prompting for downloads",
    "Plan recalled: read ALL problems + submission rules first, then order of attack: 4 or 2 first, Problem 1 in the gaps",
    "Laptop charged + charger packed (if bring-your-own-device)",
  ]},
]}

);
