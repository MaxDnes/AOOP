/* ============ MVVM & BINDING ============ */

window.TOPICS.push(

{
id: "mv-mvc-vs-mvvm",
title: "MVC vs MVVM (theory)",
cat: "MVVM & Binding",
tags: ["mvc", "mvvm", "model", "view", "controller", "viewmodel", "architecture", "decoupling"],
related: ["mv-mvvm-rules", "dp-observer", "mv-inotify"],
blocks: [
  { def: "Decoupling is the practice of separating UI code (how the app looks) from Business Logic (what the app does). Instead of the UI directly controlling data, it reacts to changes in the data.", term: "Decoupling UI and Logic" },
  { list: [
    "**Testability**: unit test logic without clicking buttons or launching windows.",
    "**Reusability**: the same logic can power desktop, mobile, or a web API.",
    "**Maintainability**: designers change the View without breaking the ViewModel.",
  ]},
  { def: "MVC is an architectural design pattern whose main goal is to decouple Views and Models as much as possible. Models hold and maintain data/state and core functionality. Views present data and might be interactable. Controllers handle user interaction and update Models and Views accordingly.", term: "Model-View-Controller" },
  { def: "MVVM structures a UI application using a data binding system that moves data between View and ViewModel, separating application logic (view model) from the display of the UI (view).", term: "Model-View-ViewModel" },
  { p: "Flow comparison: in MVC the **Controller** sits in the middle pushing updates both ways. In MVVM the View talks to the ViewModel only through **data bindings and commands**, and the ViewModel talks back only through **notifications** (PropertyChanged). The ViewModel never touches controls; the View has no logic." },
  { table: { head: ["Layer", "Responsibility (slide wording)", "In exam projects"], rows: [
    ["Model", "Data + business logic. POCOs: plain .NET, no framework dependency. Reusable, testable.", "`Contact`, `Recipe`, `RectangleData`, repository/services"],
    ["ViewModel", "Middleman; holds presentation state + logic; implements Observer so the View can bind; handles user interaction but never manipulates UI directly.", "`MainWindowViewModel` with [ObservableProperty] + [RelayCommand]"],
    ["View", "Layout + appearance, defined in XAML, no logic; bound to its ViewModel; replaceable without breaking the program.", "`MainWindow.axaml` (+ empty code-behind)"],
  ]}},
  { p: "Evolution shown by the course (worth narrating in a theory answer): everything-in-Main → MVC console → MVC with multiple IView implementations → Observer (model notifies views) → events/INotifyPropertyChanged → MVVM with data binding. Each step removes one coupling." },
  { tip: "5-point exam answer for \"explain MVVM in this app\": name the three layers, say WHICH class plays each role in the given project, and state the two glue mechanisms: data binding View→VM and PropertyChanged notifications VM→View." },
]},

{
id: "mv-inotify",
title: "INotifyPropertyChanged (the manual pattern)",
cat: "MVVM & Binding",
tags: ["inotifypropertychanged", "propertychanged", "onpropertychanged", "observer", "manual", "quiz"],
related: ["mv-toolkit-observableproperty", "dp-observer", "cs-events"],
blocks: [
  { def: "INotifyPropertyChanged is the usual C# way to implement the Observer Pattern and therefore introduce Data Binding to a GUI library.", term: "INotifyPropertyChanged (course wording)" },
  { code: String.raw`using System.ComponentModel;

public class Stock : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    private double _price;
    public double Price
    {
        get => _price;
        set
        {
            if (_price != value)              // only notify if it actually changed
            {
                _price = value;
                OnPropertyChanged(nameof(Price));
            }
        }
    }

    protected virtual void OnPropertyChanged(string propertyName)
    {
        // ?. -> only invoke if someone subscribed
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}`, lang: "csharp", title: "The canonical manual implementation (slide verbatim)" },
  { rule: "The three details graders look for: (1) compare old vs new value before notifying, (2) raise via `PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(...))`, (3) use `nameof(Price)` instead of a magic string." },
  { code: String.raw`using System.Runtime.CompilerServices;

// [CallerMemberName] variant: the compiler fills in the calling property's name
private void NotifyPropertyChanged([CallerMemberName] string propertyName = "")
{
    PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}

public string NewLogEntry
{
    get => _newLogEntry;
    set
    {
        if (value != _newLogEntry)
        {
            _newLogEntry = value;
            NotifyPropertyChanged();      // no argument needed
        }
    }
}`, lang: "csharp", title: "CallerMemberName variant (the SOLID-folder quiz answer)" },
  { h: "The course quiz blanks, answered" },
  { list: [
    "`public partial class MainWindowViewModel : ` **INotifyPropertyChanged**",
    "`public ` **event PropertyChangedEventHandler?** ` PropertyChanged;`",
    "in the setter: **NotifyPropertyChanged();**",
    "the method bound by `Command=\"{Binding SaveLog}\"` is **public void SaveLog()**",
    "persistence line: **File.AppendAllText(FILE_PATH, logWithDate + Environment.NewLine);**",
  ]},
]},

{
id: "mv-toolkit-observableproperty",
title: "[ObservableProperty]: rules & generated code",
cat: "MVVM & Binding",
tags: ["observableproperty", "mvvm toolkit", "communitytoolkit", "source generator", "partial", "onchanged"],
related: ["mv-relaycommand", "mv-inotify", "pb-troubleshoot"],
blocks: [
  { p: "The MVVM Toolkit (`CommunityToolkit.Mvvm`) generates the INotifyPropertyChanged boilerplate from attributes. This is the exam's standard tool." },
  { code: String.raw`using CommunityToolkit.Mvvm.ComponentModel;

public partial class StockViewModel : ObservableObject   // partial + ObservableObject: BOTH required
{
    [ObservableProperty]
    private double _price;        // generates: public double Price { get; set; } with notification
}`, lang: "csharp", title: "The 4-line replacement for the whole manual pattern" },
  { table: { head: ["You write (field)", "Generator creates (property)"], rows: [
    ["`private double _price;`", "`public double Price`"],
    ["`private string? newContactName;`", "`public string? NewContactName`"],
    ["`private int _count;`", "`public int Count`"],
  ]}},
  { rule: "Rules: the class must be `partial` and inherit `ObservableObject` (directly or via `ViewModelBase`). The field must be `_camelCase` or `camelCase`. In code you USE the generated PascalCase property (`Count++`), never the field, or no notification fires." },
  { h: "Generated hooks you get for free" },
  { code: String.raw`[ObservableProperty]
private WeeklyItem? selectedRecipe;

// 1. Partial change-hook methods (implement any you need):
partial void OnSelectedRecipeChanged(WeeklyItem? value)
{
    // runs AFTER the property changed -- the re-exam's master-detail task lived here
}

// 2. Chain notifications to other members:
[ObservableProperty]
[NotifyPropertyChangedFor(nameof(FullName))]     // FullName re-read when FirstName changes
private string? firstName;
public string FullName => $"{FirstName} {LastName}";

// 3. Re-evaluate a command's CanExecute when this property changes:
[ObservableProperty]
[NotifyCanExecuteChangedFor(nameof(DivideCommand))]
private int _secondOperand;`, lang: "csharp", title: "OnChanged partials + Notify* attributes" },
  { gotcha: "Slide inconsistency to not copy: one lecture slide declared `public partial class StockViewModel` WITHOUT `: ObservableObject`. Without the base class (or another source of PropertyChanged) the generator has nothing to hook into; the correct version includes `: ObservableObject`." },
]},

{
id: "mv-relaycommand",
title: "[RelayCommand]: commands & CanExecute",
cat: "MVVM & Binding",
tags: ["relaycommand", "command", "canexecute", "asyncrelaycommand", "notifycanexecutechanged", "icommand"],
related: ["dp-command", "mv-toolkit-observableproperty", "ex-june-p3-testing"],
blocks: [
  { code: String.raw`using CommunityToolkit.Mvvm.Input;

[RelayCommand]                       // generates: public IRelayCommand AddContactCommand
public void AddContact()
{
    Contacts.Add(new Contact { Name = NewContactName!, Email = NewContactEmail! });
    NewContactName = NewContactEmail = null;
}

// async variant -> AsyncRelayCommand; button auto-disables while running
[RelayCommand]
private async Task LoadData()
{
    await Task.Run(() => { /* heavy work off the UI thread */ });
}

// with a parameter -> Command + CommandParameter in XAML
[RelayCommand]
private void Delete(Contact contact) => Contacts.Remove(contact);`, lang: "csharp", title: "Method → generated command" },
  { rule: "Name generation: `void Foo()` → `FooCommand`. An `Async` suffix is dropped: `Task LoadDataAsync()` → `LoadDataCommand`." },
  { h: "CanExecute: the full Counter pattern (exam-tested twice)" },
  { code: String.raw`public partial class MainWindowViewModel : ViewModelBase
{
    [ObservableProperty]
    private int _count;

    [RelayCommand]
    private void Increment()
    {
        Count++;
    }

    [RelayCommand(CanExecute = nameof(CanDecrement))]
    private void Decrement()
    {
        Count--;
    }

    private bool CanDecrement() => Count > 0;

    // CanExecute is NOT re-checked automatically -- you must announce changes:
    partial void OnCountChanged(int value)
    {
        DecrementCommand.NotifyCanExecuteChanged();
    }

    public MainWindowViewModel()
    {
        _count = 0;
    }
}`, lang: "csharp", title: "Counter ViewModel (verbatim June exam starter)" },
  { code: String.raw`<TextBlock Width="250" Text="{Binding Count}"/>
<Button Content="+" Command="{Binding IncrementCommand}"/>
<Button Content="-" Command="{Binding DecrementCommand}"/>
<!-- the '-' button greys out automatically while CanDecrement() is false -->`, lang: "xml" },
  { p: "Alternative to the partial method: put `[NotifyCanExecuteChangedFor(nameof(DecrementCommand))]` on the `_count` field. Same effect, one line." },
  { gotcha: "In tests, `vm.DecrementCommand.CanExecute(null)` checks the guard, and `vm.DecrementCommand.Execute(null)` runs it. The June exam's five required unit tests are exactly about this behavior." },
]},

{
id: "mv-binding-cookbook",
title: "Data binding cookbook (every binding you need)",
cat: "MVVM & Binding",
tags: ["binding", "mode", "twoway", "oneway", "itemssource", "selecteditem", "command", "elementname", "datacontext"],
related: ["pb-avalonia-ui", "av-itemscontrols", "mv-observablecollection"],
blocks: [
  { def: "Data Binding binds your data objects to UI Controls so the controls automatically update when the data changes, and the other way around. The mechanism: the binding system subscribes to the data object's PropertyChanged event.", term: "Data Binding" },
  { code: String.raw`<!-- value bindings -->
<TextBlock Text="{Binding Count}"/>                          <!-- display -->
<TextBox   Text="{Binding NewContactName}"/>                 <!-- edit (TwoWay by default) -->
<TextBox   Text="{Binding FirstOperand, Mode=TwoWay}"/>      <!-- explicit mode -->
<Slider    Value="{Binding RectWidth}"/>
<CheckBox  IsChecked="{Binding IsFancy}"/>

<!-- command bindings -->
<Button Content="Add"    Command="{Binding AddContactCommand}"/>
<Button Content="Delete" Command="{Binding DeleteCommand}" CommandParameter="{Binding SelectedContact}"/>

<!-- collection bindings -->
<ListBox ItemsSource="{Binding Contacts}"
         SelectedItem="{Binding SelectedContact}"
         SelectionMode="Single,Toggle"/>
<ListBox ItemsSource="{Binding ShoppingList}"
         SelectionMode="Multiple"
         SelectedItems="{Binding SelectedIngredients}"/>

<!-- nested property path -->
<TextBlock Text="{Binding SelectedContact.Name}"/>

<!-- bind to another CONTROL by name -->
<Slider Name="OpaSlider" Minimum="0" Maximum="1"/>
<Rectangle Opacity="{Binding #OpaSlider.Value}"/>

<!-- binding inside an ItemTemplate resolves against the ITEM -->
<ListBox ItemsSource="{Binding WeekPlan}">
  <ListBox.ItemTemplate>
    <DataTemplate>
      <TextBlock Text="{Binding RecipeName}"/>
    </DataTemplate>
  </ListBox.ItemTemplate>
</ListBox>`, lang: "xml", title: "The complete binding vocabulary" },
  { table: { head: ["Mode", "Direction", "Default for"], rows: [
    ["OneWay", "VM → View", "most properties (TextBlock.Text etc.)"],
    ["TwoWay", "VM ⇄ View", "user-editable: TextBox.Text, CheckBox.IsChecked, Slider.Value, SelectedItem"],
    ["OneTime", "VM → View once", "set explicitly when you want a snapshot"],
    ["OneWayToSource", "View → VM", "rare; set explicitly"],
  ]}},
  { rule: "For a binding to update the UI at runtime, the source property must notify: `[ObservableProperty]` (or manual PropertyChanged) for values, `ObservableCollection` for lists. No notification = UI shows the startup value forever." },
  { gotcha: "Compiled bindings (exam default) need `x:DataType` on the root. If a binding targets something other than the DataContext type inside a template/style, add `x:DataType` there too (see the ContentPresenter style in [[av-itemscontrols|Canvas items]])." },
]},

{
id: "mv-observablecollection",
title: "ObservableCollection & binding to lists",
cat: "MVVM & Binding",
tags: ["observablecollection", "collectionchanged", "list binding", "itemssource", "add", "remove"],
related: ["mv-binding-cookbook", "col-overview", "av-itemscontrols"],
blocks: [
  { def: "ObservableCollection is a dynamic data collection providing notifications when items are added, removed, or the list is refreshed. Essentially a List<T> that implements INotifyCollectionChanged and INotifyPropertyChanged.", term: "ObservableCollection (course wording)" },
  { code: String.raw`using System.Collections.ObjectModel;

public ObservableCollection<Contact> Contacts { get; } = new();

// every mutation updates the bound ListBox instantly:
Contacts.Add(new Contact { Name = "John", Email = "j@d.com" });
Contacts.Remove(SelectedContact);
Contacts.Clear();`, lang: "csharp" },
  { table: { head: ["Scenario", "What to use"], rows: [
    ["Items appear/disappear at runtime", "`ObservableCollection<T>`, get-only property, mutate it"],
    ["Whole list replaced at once", "`[ObservableProperty] private List<WeeklyItem> weekPlan;` and assign a NEW list (re-exam solution did exactly this)"],
    ["Items' own properties change on screen", "item class = `partial : ObservableObject` with `[ObservableProperty]` members"],
    ["Static dropdown options", "plain `List<string>` / static property is fine (never changes)"],
  ]}},
  { code: String.raw`// Derived property recomputed when the collection changes (lecture slide):
private ObservableCollection<string> names { get; } = [];

public string AllNames => names.Aggregate("", (a, b) => a + b);

// wire it up once (e.g. in the constructor):
names.CollectionChanged += (_, _) => OnPropertyChanged(nameof(AllNames));`, lang: "csharp", title: "CollectionChanged event + derived property" },
  { gotcha: "Replacing the instance of a get-only ObservableCollection property breaks the binding silently (the View still watches the old object). Either mutate the existing collection, or make the property `[ObservableProperty]` so replacement notifies." },
]},

{
id: "mv-datacontext",
title: "DataContext: how View finds ViewModel",
cat: "MVVM & Binding",
tags: ["datacontext", "app.axaml.cs", "composition root", "design.datacontext", "wiring"],
related: ["av-project-structure", "dp-dependency-injection"],
blocks: [
  { p: "`DataContext` is the object all `{Binding ...}` paths resolve against. It flows down the control tree: set it on the Window and every child control inherits it (until a DataTemplate scopes it to an item)." },
  { code: String.raw`public override void OnFrameworkInitializationCompleted()
{
    if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
    {
        // template removes Avalonia's DataAnnotations validator to avoid
        // duplicate validation with the MVVM Toolkit:
        DisableAvaloniaDataAnnotationValidation();

        desktop.MainWindow = new MainWindow
        {
            DataContext = new MainWindowViewModel(),   // <- THE wiring point
        };
    }
    base.OnFrameworkInitializationCompleted();
}`, lang: "csharp", title: "App.axaml.cs (read at the exam to learn what the VM receives)" },
  { list: [
    "Exam VMs often have constructor parameters: App.axaml.cs builds the services (repository, planner, rules) and passes them in. Those pre-built instances are what you must use.",
    "`Design.DataContext` in XAML affects ONLY the previewer.",
    "In headless tests you set it yourself: `new MainWindow { DataContext = new MainWindowViewModel() }`.",
    "Inside a `DataTemplate`, the DataContext is the individual ITEM, which is why `{Binding Day}` works there.",
  ]},
]},

{
id: "mv-contactlist-full",
title: "Complete reference app: ContactList MVVM",
cat: "MVVM & Binding",
tags: ["contactlist", "full app", "crud", "repository", "json", "complete example"],
related: ["dp-dependency-injection", "mv-binding-cookbook", "df-json"],
blocks: [
  { p: "The course's flagship MVVM solution: CRUD list + selection + JSON persistence behind a repository interface. If you can re-type this from memory, you can solve any exam Problem 2. All five meaningful files:" },
  { code: String.raw`namespace ContactListMVVM.Models;

public class Contact
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    public override string ToString() => $"{Name} ({Email})";
}`, lang: "csharp", title: "Models/Contact.cs — POCO model" },
  { code: String.raw`using System.Collections.ObjectModel;
using ContactListMVVM.Models;

namespace ContactListMVVM.Services;

public interface IContactRepository
{
    void Save(string filename, ObservableCollection<Contact> data);
    ObservableCollection<Contact> Load(string filename);
}`, lang: "csharp", title: "Services/IContactRepository.cs — the DIP abstraction" },
  { code: String.raw`using System.Collections.ObjectModel;
using System.IO;
using System.Text.Json;
using ContactListMVVM.Models;

namespace ContactListMVVM.Services;

public class JSONContactRepository : IContactRepository
{
    public void Save(string filename, ObservableCollection<Contact> data)
    {
        File.WriteAllText(filename, JsonSerializer.Serialize(data));
    }

    public ObservableCollection<Contact> Load(string filename)
    {
        if (!File.Exists(filename))
            return new ObservableCollection<Contact>();

        return JsonSerializer.Deserialize<ObservableCollection<Contact>>(
            File.ReadAllText(filename))!;
    }
}`, lang: "csharp", title: "Services/JSONContactRepository.cs — JSON persistence" },
  { code: String.raw`using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using ContactListMVVM.Models;
using ContactListMVVM.Services;

namespace ContactListMVVM.ViewModels;

public partial class MainWindowViewModel : ObservableObject
{
    public ObservableCollection<Contact> Contacts { get; }

    private readonly IContactRepository _contactRepository;

    [ObservableProperty]
    private string? newContactName;

    [ObservableProperty]
    private string? newContactEmail;

    [ObservableProperty]
    private Contact? selectedContact;

    public MainWindowViewModel(IContactRepository contactRepository)
    {
        _contactRepository = contactRepository;
        Contacts = _contactRepository.Load("contacts.json");
    }

    public void AddContact()
    {
        if (string.IsNullOrWhiteSpace(NewContactName) ||
            string.IsNullOrWhiteSpace(NewContactEmail))
            return;

        Contacts.Add(new Contact { Name = NewContactName!, Email = NewContactEmail! });
        NewContactName = NewContactEmail = null;
    }

    public void DeleteContact()
    {
        if (SelectedContact is not null)
            Contacts.Remove(SelectedContact);
    }

    public void SaveData()
    {
        _contactRepository.Save("contacts.json", Contacts);
    }
}`, lang: "csharp", title: "ViewModels/MainWindowViewModel.cs" },
  { code: String.raw`<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="using:ContactListMVVM.ViewModels"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        mc:Ignorable="d" d:DesignWidth="800" d:DesignHeight="450"
        x:Class="ContactListMVVM.Views.MainWindow"
        x:DataType="vm:MainWindowViewModel"
        Title="Contact List">
    <StackPanel Spacing="10" Margin="10">
        <ListBox Name="ContactsListBox" ItemsSource="{Binding Contacts}"
                 SelectionMode="Single,Toggle"
                 SelectedItem="{Binding SelectedContact}"/>
        <TextBox Name="NameTextBox"  Text="{Binding NewContactName}"/>
        <TextBox Name="EmailTextBox" Text="{Binding NewContactEmail}"/>
        <StackPanel Orientation="Horizontal">
            <Button Name="AddContactButton"    Content="Add Contact"    Command="{Binding AddContact}"/>
            <Button Name="DeleteContactButton" Content="Delete Contact" Command="{Binding DeleteContact}"/>
            <Button Name="SaveContactsButton"  Content="Save"           Command="{Binding SaveData}"/>
        </StackPanel>
        <TextBlock Text="{Binding SelectedContact.Name}"/>
        <TextBlock Text="{Binding SelectedContact.Email}"/>
    </StackPanel>
</Window>`, lang: "xml", title: "Views/MainWindow.axaml" },
  { p: "Wiring: App.axaml.cs creates `new JSONContactRepository()` and injects it (see [[dp-dependency-injection|Dependency Injection]]). Note the course binds buttons straight to method names here (`{Binding AddContact}`); adding `[RelayCommand]` and binding `AddContactCommand` is the by-the-book alternative; both work." },
]},

{
id: "mv-mvvm-rules",
title: "The MVVM rules (what graders check)",
cat: "MVVM & Binding",
tags: ["mvvm rules", "strictly mvvm", "code behind", "separation"],
related: ["pb-avalonia-ui", "mv-mvc-vs-mvvm"],
blocks: [
  { rule: "Views must not contain logic. ViewModels must not touch UI controls. Models are POCOs with no framework dependency. (All three sentences are near-verbatim slide statements: quote them.)" },
  { table: { head: ["Want to...", "MVVM way", "NOT this"], rows: [
    ["React to a button", "`[RelayCommand]` + `Command={Binding ...}`", "Click handler in code-behind"],
    ["Show changing values", "`[ObservableProperty]` + `{Binding ...}`", "`myTextBlock.Text = ...`"],
    ["Show a list", "`ObservableCollection` + `ItemsSource`", "`listBox.Items.Add(...)`"],
    ["React to selection", "`SelectedItem` binding + `OnXxxChanged` partial", "`SelectionChanged` event handler"],
    ["Periodic UI updates", "`DispatcherTimer` in the VM updating bound properties", "timer in code-behind poking controls"],
    ["Disable a button conditionally", "`CanExecute` on the command", "`button.IsEnabled = ...`"],
  ]}},
  { gotcha: "The exam phrasing: \"Strictly follow the MVVM pattern... Any code you add or modify in other files will not count toward your solution. For example, do not modify the CodeBehind (MainWindow.axaml.cs).\" Take it literally." },
]}

);
