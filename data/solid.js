/* ============ SOLID + DESIGN PATTERNS ============ */

window.TOPICS.push(

{
id: "solid-overview",
title: "SOLID: the five definitions",
cat: "SOLID",
tags: ["solid", "srp", "ocp", "lsp", "isp", "dip", "definitions"],
related: ["pb-problem1-analysis", "solid-srp", "solid-ocp", "solid-lsp", "solid-isp", "solid-dip"],
blocks: [
  { p: "The exact wording from the course slides (memorize these; the written exam asks you to reproduce and apply them):" },
  { table: { head: ["P", "Name", "Slide definition (verbatim)", "Meme mnemonic"], rows: [
    ["S", "Single Responsibility", "Each software module should have one and only one reason to change.", "Swiss-army-knife monster: just because you can, doesn't mean you should"],
    ["O", "Open / Closed", "A module should be open for extension but closed for modification.", "Open-chest surgery isn't needed when putting on a coat"],
    ["L", "Liskov Substitution", "Subclasses should be substitutable for their base classes.", "If it quacks like a duck but needs batteries, you have the wrong abstraction"],
    ["I", "Interface Segregation", "Many client specific interfaces are better than one general purpose interface.", "You want me to plug this in WHERE?"],
    ["D", "Dependency Inversion", "Depend upon Abstractions. Do not depend upon concretions.", "Would you solder a lamp directly to the wiring in a wall?"],
  ]}},
  { h: "Spotting each one in unknown exam code (fast heuristics)" },
  { list: [
    "**SRP**: count the jobs per class. One class = one noun doing one thing (Planner plans, Notifier notifies, Repository stores). Violated by God classes mixing UI + logic + storage.",
    "**OCP**: can you add a new variant by ADDING a class (new IDietaryRule, new IView)? Applied. Do you have to edit an existing switch/if-chain? Violated.",
    "**LSP**: would another implementation of the interface work? Look for downcasts (`as Concrete`), type checks, or 'does not support' error branches. Those violate it.",
    "**ISP**: are interfaces small and focused (1–3 members) and do classes implement only what they need (Report skips IValidatable)? Applied. One fat IDocument interface forcing empty methods? Violated.",
    "**DIP**: do high-level classes receive interfaces via constructor (injected), with concretes chosen only in Program.cs / App.axaml.cs? Applied. `new ConcreteThing()` inside business logic? Violated.",
  ]},
  { tip: "Exam code deliberately mixes applied principles with one or two planted violations. Saying \"X is present here BUT undermined there\" with code evidence reads as top-grade analysis." },
]},

{
id: "solid-srp",
title: "SRP · Single Responsibility",
cat: "SOLID",
tags: ["srp", "single responsibility", "one reason to change", "god class"],
related: ["solid-overview", "solid-ocp"],
blocks: [
  { def: "Each software module should have one and only one reason to change.", term: "SRP" },
  { code: String.raw`// VIOLATION: one class with three reasons to change
public class ReportManager
{
    public string BuildReport(List<Sale> sales) { /* formatting logic */ return ""; }
    public void SaveToFile(string report) { File.WriteAllText("r.txt", report); }
    public void EmailToBoss(string report) { /* smtp logic */ }
}

// FIXED: each class has exactly one job (one reason to change)
public class ReportBuilder { public string Build(List<Sale> sales) { return ""; } }
public class ReportSaver   { public void Save(string report) { File.WriteAllText("r.txt", report); } }
public class ReportMailer  { public void Email(string report) { } }`, lang: "csharp", title: "Violation → fix" },
  { p: "Course-code evidence you can cite: FamilyMealPlanner splits MealPlanner (planning) / ShoppingListGenerator (list building) / ConsoleNotifier (output) / InMemoryRecipeRepository (storage) / each IDietaryRule (one policy each). MVVM itself is SRP at architecture scale: View renders, ViewModel holds presentation state, Model holds data." },
]},

{
id: "solid-ocp",
title: "OCP · Open / Closed",
cat: "SOLID",
tags: ["ocp", "open closed", "extension", "modification", "strategy"],
related: ["solid-srp", "dp-strategy"],
blocks: [
  { def: "A module should be open for extension but closed for modification.", term: "OCP" },
  { code: String.raw`// VIOLATION: every new rule means EDITING this method (switch grows forever)
public bool IsRecipeAllowed(Recipe recipe, FamilyProfile family)
{
    if (family.IsVegetarianFamily && !recipe.DietaryTags.Contains("Vegetarian"))
        return false;
    if (family.Allergies.Contains("Nuts") && recipe.DietaryTags.Contains("ContainsNuts"))
        return false;
    // next week: && gluten && lactose && ... endless modification
    return true;
}

// FIXED: new rules are ADDED as new classes; the checker never changes again
public interface IDietaryRule
{
    bool IsSatisfiedBy(Recipe recipe, FamilyProfile family);
}

public class VegetarianRule : IDietaryRule
{
    public bool IsSatisfiedBy(Recipe r, FamilyProfile f)
        => !f.IsVegetarianFamily || r.DietaryTags.Contains("Vegetarian");
}

public class NutAllergyRule : IDietaryRule
{
    public bool IsSatisfiedBy(Recipe r, FamilyProfile f)
        => !f.Allergies.Contains("Nuts") || !r.DietaryTags.Contains("ContainsNuts");
}

public bool IsRecipeAllowed(Recipe recipe, FamilyProfile family, List<IDietaryRule> rules)
    => rules.All(rule => rule.IsSatisfiedBy(recipe, family));`, lang: "csharp", title: "Violation → fix (the exam's own domain)" },
  { gotcha: "In the actual re-exam code the rules WERE injected into MealPlanner but never used: `InMemoryRecipeRepository.FindRecipes` hardcoded the filtering anyway. Perfect example of \"OCP set up but then undermined\", and worth writing exactly that." },
]},

{
id: "solid-lsp",
title: "LSP · Liskov Substitution",
cat: "SOLID",
tags: ["lsp", "liskov", "substitutable", "downcast", "violation"],
related: ["solid-dip", "oop-polymorphism-casting"],
blocks: [
  { def: "Subclasses should be substitutable for their base classes (and implementations for their interfaces) without breaking the program.", term: "LSP" },
  { code: String.raw`// THE planted violation from the August 2025 re-exam (FamilyMealPlanner Core.cs):
public List<Recipe> GenerateMealPlan(FamilyProfile family, int numberOfMeals)
{
    var suitableRecipes = _recipeFinder.FindRecipes(family).ToList();
    var mealPlan = new List<Recipe>();

    var inMemoryRepo = _recipeFinder as InMemoryRecipeRepository;  // <-- DOWNCAST!

    if (inMemoryRepo == null)
    {
        _notifier.Notify("Error: Recipe finder does not support random selection.");
        return mealPlan;     // any OTHER IRecipeFinder implementation fails here
    }
    // ... uses inMemoryRepo.GetRandomRecipe(...) which is NOT on the interface
}`, lang: "csharp", title: "Spot it: downcast + 'does not support' branch" },
  { p: "Why it violates LSP: a `DatabaseRecipeFinder : IRecipeFinder` is a perfectly legal substitute, yet the planner refuses to work with it. Substitutes are not substitutable." },
  { code: String.raw`// FIX: put the needed capability ON the abstraction, delete the cast
public interface IRecipeFinder
{
    IEnumerable<Recipe> FindRecipes(FamilyProfile family);
    Recipe? GetRandomRecipe(IEnumerable<Recipe> from);   // now every finder must provide it
}
// MealPlanner then calls _recipeFinder.GetRandomRecipe(...) directly.`, lang: "csharp", title: "The fix to propose" },
  { p: "Classic textbook framing if asked generally: a `Square : Rectangle` that breaks `SetWidth`/`SetHeight` expectations, or the rubber duck that needs batteries. Behavior promised by the base must hold for every subclass." },
]},

{
id: "solid-isp",
title: "ISP · Interface Segregation",
cat: "SOLID",
tags: ["isp", "interface segregation", "fat interface", "role interface"],
related: ["oop-interfaces", "solid-overview"],
blocks: [
  { def: "Many client specific interfaces are better than one general purpose interface.", term: "ISP" },
  { code: String.raw`// VIOLATION: one fat interface forces empty implementations
public interface IDocument
{
    bool ProcessDocument();
    string GenerateSummary();
    List<string> Validate();      // but Reports have nothing to validate!
}

public class Report : IDocument
{
    public bool ProcessDocument() { return true; }
    public string GenerateSummary() { return "..."; }
    public List<string> Validate() => throw new NotImplementedException(); // forced junk
}

// FIXED (= the June exam's DocumentManager design): small role interfaces,
// classes opt in to exactly the capabilities they have
public interface IProcessable  { Guid DocumentId { get; } bool ProcessDocument(); }
public interface ISummarizable { string GenerateSummary(); }
public interface IValidatable  { List<string> Validate(); }

public class Invoice : IProcessable, ISummarizable, IValidatable { /* all three */ }
public class Report  : IProcessable, ISummarizable { /* no Validate -- and no junk */ }`, lang: "csharp", title: "Fat interface → role interfaces" },
  { p: "Consumers also get cleaner: `DocumentProcessor.GenerateSummaries(List<ISummarizable>)` needs ONLY the summarize capability and can receive anything that has it." },
]},

{
id: "solid-dip",
title: "DIP · Dependency Inversion (+ DI)",
cat: "SOLID",
tags: ["dip", "dependency inversion", "dependency injection", "abstraction", "composition root", "constructor injection"],
related: ["dp-dependency-injection", "solid-lsp", "mv-contactlist-full"],
blocks: [
  { def: "Depend upon Abstractions. Do not depend upon concretions.", term: "DIP" },
  { code: String.raw`// VIOLATION: high-level class constructs its own low-level dependency
public class MealPlanner
{
    private InMemoryRecipeRepository _repo = new InMemoryRecipeRepository(); // concretion!
}

// FIXED: depend on the interface; receive it from outside (constructor injection)
public class MealPlanner
{
    private readonly IRecipeFinder _recipeFinder;
    private readonly INotifier _notifier;

    public MealPlanner(IRecipeFinder recipeFinder, INotifier notifier)
    {
        _recipeFinder = recipeFinder;
        _notifier = notifier;
    }
}

// The ONLY place that knows concrete types is the composition root (Program.cs):
IRecipeFinder repo = new InMemoryRecipeRepository();
INotifier notifier = new ConsoleNotifier();
var planner = new MealPlanner(repo, notifier);`, lang: "csharp", title: "Concretion → injected abstraction" },
  { p: "Benefits to cite: swap implementations without touching the planner (file repo, database repo), and unit tests can pass a fake INotifier / in-memory finder. DIP is the principle; **Dependency Injection is the technique** that delivers it." },
  { gotcha: "DIP applied at the constructor can still be broken in the body: the re-exam planner downcasts `_recipeFinder as InMemoryRecipeRepository`, silently re-introducing the dependency on the concretion. Constructor injection alone is not proof of DIP." },
]},

{
id: "dp-overview",
title: "Design patterns: course catalog",
cat: "Design Patterns",
tags: ["design patterns", "catalog", "facade", "singleton", "strategy", "command", "observer", "di", "adapter"],
related: ["dp-singleton", "dp-facade", "dp-adapter", "dp-strategy", "dp-command", "dp-observer", "dp-dependency-injection"],
blocks: [
  { p: "The Lecture 12 list names exactly these six. Where each one already exists in course/exam code:" },
  { table: { head: ["Pattern", "Intent (one line)", "Where you saw it"], rows: [
    ["Facade", "One simple entry point over a complex subsystem", "ShapeFacade.GetShapeInfo(...); DocumentWorkflowManager"],
    ["Singleton", "Exactly one instance, globally reachable", "ShapeFacade with Lazy<T> + private constructor"],
    ["Strategy", "Family of interchangeable algorithms behind one interface", "IDietaryRule rules; ILogger; IView console views"],
    ["Command", "Encapsulate an action as an object (execute / can-execute)", "ICommand / RelayCommand bound to every Button"],
    ["Observer", "Subject notifies subscribed observers of state changes", "IObservable/IObserver console app; events; INotifyPropertyChanged"],
    ["Dependency Injection", "Push dependencies in from outside (constructor)", "Every exam project's Program.cs / App.axaml.cs"],
  ]}},
  { tip: "MVC / MVVM are architectural patterns built FROM these: MVVM = Observer (PropertyChanged) + Command (RelayCommand) + DI (composition root)." },
  { p: "Beyond the core six, exams also probe the classic structural patterns by intent. The one to know cold is [[dp-adapter|Adapter]]: it wraps an existing/incompatible class and re-exposes it through the interface the client expects (compatibility), versus Facade which simplifies a subsystem behind one entry point." },
]},

{
id: "dp-singleton",
title: "Singleton",
cat: "Design Patterns",
tags: ["singleton", "lazy", "instance", "private constructor", "sealed"],
related: ["dp-facade", "dp-overview"],
blocks: [
  { def: "Ensure a class has exactly one instance and provide a global access point to it.", term: "Singleton" },
  { code: String.raw`public sealed class ShapeFacade
{
    // thread-safe lazy initialization -- the instance is created on first access
    private static readonly Lazy<ShapeFacade> Lazy = new(() => new ShapeFacade());

    public static ShapeFacade GetInstance => Lazy.Value;

    private ShapeFacade() { }     // private ctor: nobody else can construct it

    // ... instance members ...
}

// usage:
ShapeFacade.GetInstance.GetShapeInfo(ShapeFacade.Shapes.Circle, 3.4);`, lang: "csharp", title: "Course implementation: Lazy<T> singleton (ShapeFacade)" },
  { code: String.raw`// Simpler eager variant (fine to write if asked to implement one quickly)
public sealed class Settings
{
    public static Settings Instance { get; } = new Settings();
    private Settings() { }
}`, lang: "csharp", title: "Eager static-property variant" },
  { list: [
    "Recognize it by: `private` constructor + `static` instance accessor + `sealed`.",
    "Why Lazy<T>: thread-safe and created only when first needed.",
    "Honest critique if asked: global state hurts testability; prefer DI for dependencies.",
  ]},
]},

{
id: "dp-facade",
title: "Facade",
cat: "Design Patterns",
tags: ["facade", "simplified interface", "subsystem"],
related: ["dp-singleton", "dp-overview"],
blocks: [
  { def: "Provide a single simplified interface to a larger body of code / subsystem.", term: "Facade" },
  { code: String.raw`public sealed class ShapeFacade
{
    public enum Shapes { Ellipse, Rectangle, Circle, Square }

    // ONE method hides four constructors + ToString details behind a simple API
    public string GetShapeInfo(Shapes shape, params double[] p)
    {
        switch (shape)
        {
            case Shapes.Ellipse:   return new Ellipse(p[0], p[1]).ToString();
            case Shapes.Rectangle: return new Rectangle(p[0], p[1]).ToString();
            case Shapes.Circle:    return new Circle(p[0]).ToString();
            case Shapes.Square:    return new Square(p[0]).ToString();
            default:               return "Shape not recognized.";
        }
    }
}`, lang: "csharp", title: "Course facade over the shapes subsystem (also note 'params double[]')" },
  { p: "DocumentWorkflowManager in the June exam is also a facade: callers say `RegisterAndProcessDocument(doc)` and the manager coordinates registration, validation, processing and logging internally. If asked to name ONE pattern in such code, Facade is defensible; explain what complexity it hides." },
]},

{
id: "dp-adapter",
title: "Adapter",
cat: "Design Patterns",
tags: ["adapter", "wrapper", "incompatible interface", "structural", "legacy", "third party"],
related: ["dp-facade", "dp-strategy", "dp-overview"],
blocks: [
  { def: "Convert the interface of an existing class into the interface a client expects. The adapter WRAPS the incompatible service (the adaptee) and re-exposes its functionality through the interface the client already depends on, so two classes that could not talk before now work together.", term: "Adapter" },
  { p: "Tell it apart from its neighbours: Facade simplifies a complex subsystem behind ONE easy entry point (you control the subsystem); Adapter makes an EXISTING, often unchangeable class (legacy code, a third-party SDK) satisfy an interface you already have. The intent is compatibility, not simplification." },
  { code: String.raw`// The client only knows this interface:
public interface IPaymentService
{
    void Pay(decimal amount);
}

// The adaptee: a third-party SDK with an incompatible shape you cannot edit.
public class StripeSdk
{
    public void MakeCharge(int cents, string currency) { /* ... */ }
}

// The Adapter: implements the client interface, holds the adaptee,
// and TRANSLATES each call from the expected shape to the real one.
public class StripeAdapter : IPaymentService
{
    private readonly StripeSdk _stripe;          // the wrapped service
    public StripeAdapter(StripeSdk stripe) => _stripe = stripe;

    public void Pay(decimal amount)              // client's interface...
        => _stripe.MakeCharge((int)(amount * 100), "USD");   // ...mapped onto the adaptee
}

// The client depends on IPaymentService and never sees Stripe:
IPaymentService payment = new StripeAdapter(new StripeSdk());
payment.Pay(19.99m);`, lang: "csharp", title: "Object adapter: wrap the service, expose the client's interface" },
  { list: [
    "**Recognize it**: a class that implements interface X, holds a field of an unrelated type Y, and whose methods mostly forward to Y after reshaping the arguments.",
    "**Why**: integrate legacy or third-party code without rewriting it, and keep the client decoupled from the foreign API (swap the adaptee or the SDK without touching callers).",
    "**Exam framing**: \"how does the Adapter typically let a client use a class with an incompatible interface?\" -> the adapter wraps the service and exposes an interface compatible with the client (NOT the other way round, and it always references the adaptee).",
  ]},
]},

{
id: "dp-strategy",
title: "Strategy",
cat: "Design Patterns",
tags: ["strategy", "interchangeable", "algorithm", "interface", "plug in"],
related: ["solid-ocp", "dp-dependency-injection"],
blocks: [
  { def: "Define a family of algorithms, encapsulate each behind a common interface, and make them interchangeable at runtime.", term: "Strategy" },
  { code: String.raw`// Strategy contract
public interface IDietaryRule
{
    bool IsSatisfiedBy(Recipe recipe, FamilyProfile family);
}

// Concrete strategies -- each one small, swappable, independently testable
public class VegetarianRule : IDietaryRule
{
    public bool IsSatisfiedBy(Recipe r, FamilyProfile f)
        => !f.IsVegetarianFamily || r.DietaryTags.Contains("Vegetarian");
}
public class NutAllergyRule : IDietaryRule
{
    public bool IsSatisfiedBy(Recipe r, FamilyProfile f)
        => !f.Allergies.Contains("Nuts") || !r.DietaryTags.Contains("ContainsNuts");
}

// Context: works with ANY set of strategies
public class RecipeFilter
{
    private readonly List<IDietaryRule> _rules;
    public RecipeFilter(List<IDietaryRule> rules) => _rules = rules;

    public IEnumerable<Recipe> Filter(IEnumerable<Recipe> recipes, FamilyProfile family)
        => recipes.Where(r => _rules.All(rule => rule.IsSatisfiedBy(r, family)));
}`, lang: "csharp", title: "Strategy = the OCP enabler" },
  { p: "Other course sightings: `ILogger`/`ConsoleLogger` (swap logging behavior), `IView` with Normal/Upper/Reversed console views, `Func<int,int>` passed into `Transform` (a delegate IS a lightweight strategy)." },
]},

{
id: "dp-command",
title: "Command (ICommand / RelayCommand)",
cat: "Design Patterns",
tags: ["command", "icommand", "relaycommand", "canexecute", "execute"],
related: ["mv-relaycommand", "dp-overview"],
blocks: [
  { def: "Encapsulate a request as an object with Execute (do it) and CanExecute (is it allowed right now), decoupling the invoker (Button) from the receiver (ViewModel logic).", term: "Command" },
  { code: String.raw`// The interface behind every Button binding:
public interface ICommand
{
    bool CanExecute(object? parameter);
    void Execute(object? parameter);
    event EventHandler? CanExecuteChanged;   // tells the UI to re-evaluate enabled state
}

// You almost never implement it by hand -- the MVVM Toolkit generates it:
[RelayCommand(CanExecute = nameof(CanDecrement))]
private void Decrement() => Count--;
private bool CanDecrement() => Count > 0;

// generated: public IRelayCommand DecrementCommand { get; }
// XAML invoker: <Button Content="-" Command="{Binding DecrementCommand}"/>
// Button disables itself automatically while CanExecute is false.`, lang: "csharp", title: "Command pattern as it appears in this course" },
  { tip: "Theory link for written answers: the Button never knows WHAT happens, only that it can ask 'may I?' (CanExecute) and say 'do it' (Execute). That decoupling is the pattern's whole point." },
]},

{
id: "dp-observer",
title: "Observer (manual → events → INotifyPropertyChanged)",
cat: "Design Patterns",
tags: ["observer", "subject", "notify", "subscribe", "iobservable", "iobserver"],
related: ["cs-events", "mv-inotify", "dp-overview"],
blocks: [
  { def: "The Observer Pattern defines a Subject and any number of Observers. Whenever the subject's state changes, the observers are notified and can react. Changes might be pushed to or pulled by the observers.", term: "Observer (course wording)" },
  { h: "Stage 1: hand-rolled (course console example, complete)" },
  { code: String.raw`public interface IObservable
{
    void AddObserver(IObserver observer);
    void RemoveObserver(IObserver observer);
    void Notify();
}

public interface IObserver
{
    void Update(string message);
}

// The Subject: notifies on every change of Text
class TextModel : IObservable
{
    public List<IObserver> Observers { get; set; } = new List<IObserver>();

    private string _text = "Default text";
    public string Text
    {
        get => _text;
        set { _text = value; Notify(); }     // setter pushes the change
    }

    public void AddObserver(IObserver observer) => Observers.Add(observer);
    public void RemoveObserver(IObserver observer) => Observers.Remove(observer);

    public void Notify()
    {
        foreach (var observer in Observers)
            observer.Update(Text);
    }
}

// Observers: any number, any kind
class NormalTextView : IObserver
{
    public void Update(string message) => Console.WriteLine("Current Text: " + message);
}
class UpperCaseTextView : IObserver
{
    public void Update(string message) => Console.WriteLine("Capitalized: " + message.ToUpper());
}`, lang: "csharp", title: "Manual Observer (lecture example 04)" },
  { h: "Stage 2: the same thing with events" },
  { code: String.raw`class TextModel
{
    public event Action<string>? TextChanged;     // the event IS the observer list

    private string _text = "";
    public string Text
    {
        get => _text;
        set { _text = value; TextChanged?.Invoke(value); }
    }
}

var model = new TextModel();
model.TextChanged += t => Console.WriteLine("Current: " + t);     // subscribe
model.TextChanged += t => Console.WriteLine("Upper: " + t.ToUpper());`, lang: "csharp", title: "Events = built-in Observer" },
  { h: "Stage 3: the GUI version" },
  { p: "`INotifyPropertyChanged` is the standardized Observer that data binding subscribes to: the binding system is the observer, your ViewModel is the subject. Full pattern at [[mv-inotify|INotifyPropertyChanged]]. In Avalonia lecture example 05, views literally were `TextBlock, IObserver` subclasses updating their own Text on `Update(message)`." },
]},

{
id: "dp-dependency-injection",
title: "Dependency Injection & the composition root",
cat: "Design Patterns",
tags: ["dependency injection", "di", "constructor injection", "composition root", "testability"],
related: ["solid-dip", "mv-contactlist-full"],
blocks: [
  { def: "Instead of a class creating its own dependencies, they are injected from outside (usually via the constructor). The single place that constructs and wires everything is the composition root.", term: "Dependency Injection" },
  { code: String.raw`// Class declares WHAT it needs, not HOW to build it:
public partial class MainWindowViewModel : ObservableObject
{
    private readonly IContactRepository _contactRepository;

    public MainWindowViewModel(IContactRepository contactRepository)
    {
        _contactRepository = contactRepository;
        Contacts = _contactRepository.Load("contacts.json");
    }
}

// Composition root (App.axaml.cs in Avalonia apps -- READ ONLY at the exam):
public override void OnFrameworkInitializationCompleted()
{
    if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
    {
        IContactRepository contactRepository = new JSONContactRepository();  // choice made HERE
        desktop.MainWindow = new MainWindow
        {
            DataContext = new MainWindowViewModel(contactRepository)
        };
    }
    base.OnFrameworkInitializationCompleted();
}`, lang: "csharp", title: "Constructor injection + composition root (ContactList solution)" },
  { list: [
    "**Why**: swap implementations (JSON ↔ database ↔ in-memory) without touching consumers; unit tests inject fakes.",
    "**Recognize**: constructors taking interfaces; `new` of concretes appearing ONLY in Program.cs / App.axaml.cs.",
    "**Exam relevance**: both 2025 Problem-2 ViewModels received all their services pre-injected; your job was to USE them, never construct them.",
  ]},
]}

);
