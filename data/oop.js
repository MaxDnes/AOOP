/* ============ OOP FUNDAMENTALS ============ */

window.TOPICS.push(

{
id: "oop-four-principles",
title: "The four OO principles (overview)",
cat: "OOP Fundamentals",
tags: ["encapsulation", "inheritance", "abstraction", "polymorphism", "principles", "pillars"],
related: ["oop-encapsulation", "oop-inheritance", "oop-abstract", "oop-polymorphism-casting", "pb-problem1-analysis"],
blocks: [
  { p: "Problem 1 of the June exam asked, for each principle: is it present, where (code evidence), and what purpose it serves. Learn the one-liner + how each one LOOKS in code." },
  { table: { head: ["Principle", "One-liner", "Looks like in code"], rows: [
    ["Encapsulation", "One class hides its internals from others", "`private` fields, properties with logic, `private set`, controlled mutation methods"],
    ["Abstraction", "Expose WHAT, hide HOW", "interfaces and abstract classes; callers depend on `ILogger`, never on console details"],
    ["Inheritance", "is-a relationship; derived class gains all base members", "`class Jet : Airplane`, `: base(...)` constructor chaining; also interface realization `Invoice : IProcessable`"],
    ["Polymorphism", "Base-typed variable refers to derived object; runtime picks the override", "`List<Party>` holding DinnerParty + BirthdayParty, `virtual`/`override`, `is`/`as`, `OfType<T>()`"],
  ]}},
  { def: "Objects are small manageable program pieces which can change their State (fields) according to their Behaviors (methods). Classes are reusable blueprints for Objects.", term: "Objects & Classes (course wording)" },
  { tip: "If the exam code has no class-to-class inheritance, say so and point at **interface realization** as the inheritance-like is-a mechanism (this was exactly the situation in DocumentManager)." },
]},

{
id: "oop-encapsulation",
title: "Encapsulation & access modifiers",
cat: "OOP Fundamentals",
tags: ["encapsulation", "private", "public", "protected", "internal", "access modifiers", "information hiding"],
related: ["oop-properties", "oop-four-principles"],
blocks: [
  { def: "Encapsulation means having one class hide information from another. It makes your classes: easy to use, easy to maintain, flexible.", term: "Encapsulation" },
  { table: { head: ["Modifier", "Accessible from"], rows: [
    ["`public`", "anywhere"],
    ["`internal`", "only inside the same assembly (project)"],
    ["`private`", "only within the class (or struct)"],
    ["`protected`", "only within subclasses (and the containing class)"],
  ]}},
  { h: "The course's motivating bug (Party Planner)" },
  { p: "The DinnerParty class had a public `NumberOfPeople` field. The GUI changed it WITHOUT calling `CalculateCostOfDecorations` again, so the decoration cost went stale and the total was wrong. Lesson: **public mutable fields let callers break your invariants**." },
  { code: String.raw`// BROKEN: caller can change people without recalculating decorations
public int NumberOfPeople;
public decimal CostOfDecorations;

// FIX: private field + property whose setter keeps dependent state in sync
private int numberOfPeople;
public int NumberOfPeople
{
    get { return numberOfPeople; }
    set
    {
        numberOfPeople = value;
        CalculateCostOfDecorations(fancy);   // invariant restored automatically
    }
}`, lang: "csharp", title: "Encapsulation fixing the stale-state bug" },
  { rule: "Course quote: \"Other Developers won't always use your classes in exactly the way you expect. (Other Developers might include future you!)\" That sentence is a ready-made justification in written answers." },
]},

{
id: "oop-properties",
title: "Properties: the full ladder",
cat: "OOP Fundamentals",
tags: ["properties", "get", "set", "init", "auto property", "expression bodied", "private set", "backing field"],
related: ["oop-encapsulation", "oop-constructors"],
blocks: [
  { def: "Properties look like fields from the outside, but internally contain logic like methods. Essentially fields with getters and setters.", term: "Property" },
  { code: String.raw`public class Stock
{
    // 1. Full property with backing field + logic
    private decimal _price;
    public decimal Price
    {
        get { return _price; }
        set
        {
            if (value >= 0) _price = value;   // validating setter; 'value' keyword
            else _price = 0;
        }
    }

    // 2. Automatic property (compiler creates hidden backing field)
    public decimal CurrentPrice { get; set; }

    // 3. Expression-bodied (computed, read-only)
    public decimal Worth => CurrentPrice * SharesOwned;
    public decimal SharesOwned { get; set; }

    // 4. Read-only: settable ONLY in constructor or initializer expression
    public int Id { get; } = 7;

    // 5. Init-only: settable during object initialization (incl. object initializers)
    public string Ticker { get; init; } = "MSFT";

    // 6. Internally mutable only
    public int Volume { get; private set; }
}`, lang: "csharp", title: "All six property shapes" },
  { table: { head: ["Shape", "Set from outside?", "Set in object initializer?", "Set later inside class?"], rows: [
    ["`{ get; set; }`", "yes", "yes", "yes"],
    ["`{ get; }`", "no", "no", "no (ctor only)"],
    ["`{ get; init; }`", "only at creation", "yes", "no"],
    ["`{ get; private set; }`", "no", "no", "yes"],
  ]}},
  { gotcha: "`var note = new Note { Pitch = 30 };` works with `init`, fails with plain `{ get; }`. Assigning an init-only property after creation (`note.Pitch = 30;`) is a compile error. This exact distinction appeared on the slides." },
]},

{
id: "oop-constructors",
title: "Constructors, primary constructors, object initializers",
cat: "OOP Fundamentals",
tags: ["constructor", "primary constructor", "object initializer", "instantiation", "new", "overloading"],
related: ["oop-properties", "oop-inheritance"],
blocks: [
  { def: "Constructors run initialization code before the object exists; creating objects is called Instantiation. A class can have multiple constructors with different parameters (overloading).", term: "Constructor" },
  { code: String.raw`public class Car
{
    private string model;
    private int year;

    public Car()                       // parameterless
    {
        model = "Unknown";
        year = 0;
    }

    public Car(string model, int year) // parameterized (overload)
    {
        this.model = model;            // 'this.' disambiguates field vs parameter
        this.year = year;
    }
}

Car a = new Car("Tesla", 2024);
Car b = new();                          // target-typed new`, lang: "csharp", title: "Classic constructors" },
  { h: "Primary constructors (C# 12)" },
  { code: String.raw`// Long form
class Person
{
    string FirstName, LastName;
    public Person(string firstName, string lastName)
    {
        FirstName = firstName;
        LastName = lastName;
    }
    public void Print() => Console.WriteLine(FirstName + " " + LastName);
}

// Primary-constructor shorthand: parameters usable directly in the class body
class Person(string firstName, string lastName)
{
    public void Print() => Console.WriteLine(firstName + " " + lastName);
}`, lang: "csharp", title: "Primary constructor shorthand" },
  { h: "Object initializers" },
  { code: String.raw`public class Bunny
{
    public string Name;
    public bool LikesCarrots, LikesHumans;
    public Bunny() {}
    public Bunny(string n) => Name = n;
}

Bunny b1 = new Bunny { Name = "Bo", LikesCarrots = true, LikesHumans = false };
Bunny b2 = new Bunny("Bo") { LikesCarrots = true, LikesHumans = false };

// What the compiler actually generates for b1:
Bunny temp = new Bunny();
temp.Name = "Bo";
temp.LikesCarrots = true;
temp.LikesHumans = false;
Bunny b1 = temp;`, lang: "csharp", title: "Object initializers = compiler shorthand" },
  { tip: "Exam code uses object initializers everywhere (`new Recipe { Name = ..., Ingredients = { ... } }`). Properties initialized this way need `set` or `init` accessors." },
]},

{
id: "oop-inheritance",
title: "Inheritance: base & derived classes",
cat: "OOP Fundamentals",
tags: ["inheritance", "base", "derived", "is-a", "protected", "base constructor", "subclass"],
related: ["oop-override-vs-new", "oop-abstract", "oop-composition-aggregation"],
blocks: [
  { def: "Inheritance defines an is-a relationship between two types. The derived (sub) class gains all fields and methods of the base (super) class and specializes or customizes it.", term: "Inheritance" },
  { code: String.raw`// Base class
public class Airplane
{
    protected int Speed { get; set; }   // visible to subclasses, hidden from outsiders

    public Airplane(int speed)
    {
        Speed = speed;
    }
}

// Derived class
public class Jet : Airplane
{
    public int Acceleration { get; }

    public Jet(int speed, int acceleration) : base(speed)   // chain the base constructor
    {
        Acceleration = acceleration;
    }
}`, lang: "csharp", title: "Base + derived with constructor chaining" },
  { rule: "Three pieces of syntax to never fumble: `class Jet : Airplane` (inherit), `: base(speed)` (call base constructor), `protected` (subclass-only visibility)." },
  { h: "When inheritance pays off (course storyline)" },
  { p: "DinnerParty and BirthdayParty duplicated Id, NumberOfPeople, IsFancy and the food+decoration math. Extracting an abstract `Party` base class meant a new shared rule (extra fee for big parties) is written **once**. See the full Party class at [[oop-object-tostring-icomparable|Object, ToString & IComparable]]." },
  { gotcha: "The course's final OOP slide asks 'Do we need inheritance?' and shows the same domain solved with an interface (`IParty`) + a composed `PartyDetails` object instead. Be ready to sketch both and say: prefer composition when subclasses only share data, prefer inheritance when they share behavior that subclasses override." },
]},

{
id: "oop-override-vs-new",
title: "virtual/override vs new (hiding)",
cat: "OOP Fundamentals",
tags: ["virtual", "override", "new keyword", "hiding", "overloading", "runtime polymorphism", "compile time"],
related: ["oop-inheritance", "oop-abstract", "oop-polymorphism-casting"],
blocks: [
  { def: "Overriding: a child class replaces a base method using the same signature; at runtime the subclass version is called even through a base-typed reference. Aka Runtime Polymorphism.", term: "Override" },
  { def: "Hiding/Overloading: an inherited member is hidden by a member with the `new` keyword (or overloaded with a different signature). Resolution happens at compile time from the variable's static type. Aka Compile-Time Polymorphism.", term: "new / overload" },
  { code: String.raw`public class Airplane
{
    protected int Speed { get; set; }
    public Airplane(int speed) { Speed = speed; }

    public virtual void Accelerate()      // 'virtual' = may be overridden
    {
        Speed++;
    }
}

public class Jet : Airplane
{
    public int Acceleration { get; }
    public Jet(int speed, int acc) : base(speed) { Acceleration = acc; }

    public override void Accelerate()     // same signature, runtime dispatch
    {
        Speed = Speed * Acceleration;
    }
}

Airplane plane = new Jet(100, 10);
plane.Accelerate();    // Jet's version runs (runtime type wins) -> Speed = 1000`, lang: "csharp", title: "override → runtime polymorphism" },
  { code: String.raw`public class Jet : Airplane
{
    // ...
    public new void Accelerate()          // HIDES the base method instead
    {
        Speed = Speed * Acceleration;
    }
}

Airplane plane = new Jet(100, 10);
plane.Accelerate();    // Airplane's version runs! (static type wins) -> Speed = 101
Jet jet = new Jet(100, 10);
jet.Accelerate();      // Jet's version runs -> 1000`, lang: "csharp", title: "new → which method runs depends on the VARIABLE type" },
  { rule: "Slide quote to reuse verbatim: \"While Overloading in a single class is ok, hiding members of superclasses in subclasses is usually to be avoided.\"" },
  { gotcha: "Implementing an **abstract** member requires `override`, not `new`. (A course slide actually got this wrong with `public new void Accelerate()` under an abstract base; with `new` the abstract member stays unimplemented and the code does not compile. Great spot-the-bug material.)" },
]},

{
id: "oop-abstract",
title: "Abstract classes & abstract members",
cat: "OOP Fundamentals",
tags: ["abstract", "abstract class", "abstract method", "cannot instantiate"],
related: ["oop-interfaces", "oop-override-vs-new"],
blocks: [
  { def: "An abstract class cannot be instantiated; only its concrete subclasses can. Abstract members have no functionality and HAVE to be overridden by child classes. Abstract members can only exist in abstract classes.", term: "Abstract" },
  { code: String.raw`public abstract class AbstractShape : IShapeInterface
{
    public double Pi { get; } = Math.PI;

    public abstract double GetArea();             // no body; subclasses MUST override
    public abstract double GetCircumference();

    public override string ToString()             // shared concrete behavior lives here
        => GetType().Name + ": Area " + GetArea().ToString("0.00")
                          + ", Circumference " + GetCircumference().ToString("0.00");
}

public class Rectangle : AbstractShape
{
    private double l1, l2;
    public Rectangle(double l1, double l2) { this.l1 = l1; this.l2 = l2; }

    public override double GetArea() => l1 * l2;
    public override double GetCircumference() => 2 * (l1 + l2);
}

public class Square : Rectangle
{
    public Square(double l) : base(l, l) { }      // specialization via ctor delegation
}`, lang: "csharp", title: "Course shapes hierarchy (Polymorphism solution)" },
  { tip: "The shapes solution is a one-stop exam example: abstract class + interface + override + constructor delegation (`Circle : Ellipse` with `base(r, r)`) + polymorphic `List<IShapeInterface>` printing via overridden ToString." },
]},

{
id: "oop-interfaces",
title: "Interfaces (can-do) vs abstract classes",
cat: "OOP Fundamentals",
tags: ["interface", "can-do", "implements", "multiple interfaces", "contract"],
related: ["oop-abstract", "solid-isp", "dp-strategy"],
blocks: [
  { def: "An interface defines a can-do relationship. Similar to an abstract class but only specifies behavior and cannot include implementations. A class can implement ANY NUMBER of interfaces and must implement all their members. You cannot instantiate an interface, but you can reference one. Interfaces can inherit from other interfaces.", term: "Interface (course wording)" },
  { code: String.raw`public interface IFlyable  { void Fly(); }
public interface ISwimmable { void Swim(); }

public abstract class Animal
{
    public string Name { get; set; } = "";
    public abstract void MakeSound();
}

public class Bird : Animal, IFlyable
{
    public override void MakeSound() => Console.WriteLine("Tweet");
    public void Fly() => Console.WriteLine("Flap flap");
}

public class Duck : Animal, IFlyable, ISwimmable   // multiple can-do contracts
{
    public override void MakeSound() => Console.WriteLine("Quack");
    public void Fly() => Console.WriteLine("Flying south");
    public void Swim() => Console.WriteLine("Paddling");
}

// An unrelated class can share the same contracts:
public class Superhero : IFlyable, ISwimmable
{
    public void Fly() => Console.WriteLine("Up up and away");
    public void Swim() => Console.WriteLine("Aqua-mode");
}

// Reference by interface:
IFlyable f = new Duck();
f.Fly();`, lang: "csharp", title: "The course's Animal / Duck / Superhero example" },
  { table: { head: ["", "Interface", "Abstract class"], rows: [
    ["Relationship", "can-do", "is-a"],
    ["Implementations inside", "no (contract only)", "yes, mixes abstract + concrete members"],
    ["How many can a class take", "any number", "exactly one base class"],
    ["Fields / state", "no", "yes"],
    ["Constructors", "no", "yes"],
    ["Instantiable", "no (referenceable)", "no (only concrete subclasses)"],
  ]}},
  { tip: "Why putting Fly() on the Animal base class is wrong: Fish would be forced to have Fly(). Moving capabilities into small interfaces is also EXACTLY the Interface Segregation Principle: see [[solid-isp|ISP]]." },
]},

{
id: "oop-polymorphism-casting",
title: "Polymorphism, upcasting & downcasting",
cat: "OOP Fundamentals",
tags: ["polymorphism", "upcast", "downcast", "is", "as", "pattern matching", "OfType"],
related: ["oop-override-vs-new", "oop-interfaces", "solid-lsp"],
blocks: [
  { def: "Polymorphism means a variable of type X can refer to an object that subclasses X. The subclass has all members of the parent, so it can be implicitly used as the parent type. The other way around only might work explicitly.", term: "Polymorphism" },
  { def: "Upcasting = treating an object as its base type (implicit, always safe). Downcasting = treating it as a subclass (explicit, can fail).", term: "Up/Down-casting" },
  { code: String.raw`public class Airport
{
    public List<Airplane> Stationary = [];
    public List<Airplane> Flying = [];

    public void Start(Airplane plane) { Stationary.Remove(plane); Flying.Add(plane); }
    public void Launch(Jet jet)       { Stationary.Remove(jet);  Flying.Add(jet); }
}

var airport = new Airport();
var plane = new Airplane(100);
var jet = new Jet(100, 10);

airport.Start(plane);   // fine
airport.Start(jet);     // fine: IMPLICIT UPCAST Jet -> Airplane
airport.Launch(jet);    // fine
// airport.Launch(plane);  // COMPILE ERROR: no implicit downcast Airplane -> Jet`, lang: "csharp", title: "Upcast implicit, downcast not" },
  { h: "Safe downcasting patterns" },
  { code: String.raw`Airplane plane = new Jet(100, 10);

// 1. 'is' pattern matching (preferred, used in DocumentManager exam code)
if (plane is Jet jet1)
{
    jet1.Accelerate();
}

// 2. 'as' + null check (used in Party.CompareTo on the slides)
Jet? jet2 = plane as Jet;       // null if the cast fails
if (jet2 != null) jet2.Accelerate();

// 3. Hard cast (throws InvalidCastException on failure)
Jet jet3 = (Jet)plane;

// 4. Filtering a mixed list by type (DocumentManager exam code)
List<object> docs = new() { new Invoice(), new Report() };
foreach (var s in docs.OfType<ISummarizable>())
    Console.WriteLine(s.GenerateSummary());`, lang: "csharp", title: "is / as / cast / OfType" },
  { gotcha: "A downcast inside business logic (like `_recipeFinder as InMemoryRecipeRepository` in the re-exam) is a SOLID smell: it breaks LSP and DIP. If you see one in Problem 1 code, that IS the planted violation." },
]},

{
id: "oop-object-tostring-icomparable",
title: "Object, ToString & IComparable",
cat: "OOP Fundamentals",
tags: ["object", "tostring", "icomparable", "compareto", "equals", "gethashcode", "sort"],
related: ["oop-abstract", "al-sorting-simple", "col-list-array"],
blocks: [
  { p: "Every class in C# inherits from `Object` and therefore gets these members:" },
  { code: String.raw`public class Object
{
    public Object();
    public extern Type GetType();
    public virtual bool Equals(object obj);
    public static bool Equals(object objA, object objB);
    public static bool ReferenceEquals(object objA, object objB);
    public virtual int GetHashCode();
    public virtual string ToString();
    protected virtual void Finalize();
    protected extern object MemberwiseClone();
}`, lang: "csharp", title: "Object's members (slide verbatim)" },
  { code: String.raw`public class Panda
{
    public string Name = "";
    public override string ToString() => Name;
}

Panda p = new Panda { Name = "Petey" };
Console.WriteLine(p);   // "Petey"  (without the override it prints "Panda" = the type name)`, lang: "csharp", title: "ToString override changes what WriteLine / ListBox shows" },
  { rule: "A ListBox without an ItemTemplate displays each item's `ToString()`. That is why exam model classes override it (`$\"{Name} ({Email})\"`, `$\"{Day}: {RecipeName}\"`)." },
  { h: "IComparable: make your type sortable" },
  { code: String.raw`public abstract class Party : IComparable
{
    public Guid Id { get; } = Guid.NewGuid();
    protected const int CostOfFoodPerPerson = 180;
    public DateTime Date { get; set; }
    public int NumberOfPeople { get; set; }
    public bool IsFancy { get; set; } = false;

    public virtual decimal CalculateCost()
    {
        decimal totalCost = NumberOfPeople * CostOfFoodPerPerson;
        totalCost += NumberOfPeople * (IsFancy ? 100.00M : 50.00M)
                   + (IsFancy ? 300M : 200M);
        totalCost += NumberOfPeople > 12 ? 100 : 0;
        return totalCost;
    }

    public override string ToString() => $"{this.GetType()} on {Date.Date:d}";

    public int CompareTo(object obj)
    {
        if (obj == null) return 1;                       // null sorts first

        Party otherParty = obj as Party;
        if (otherParty != null)
            return this.Date.CompareTo(otherParty.Date); // delegate to DateTime
        else
            throw new ArgumentException("Object is not a Party");
    }
}

// usage:
parties.Sort();          // works because Party : IComparable`, lang: "csharp", title: "The full slide Party class — abstract + IComparable + ToString + virtual" },
  { rule: "CompareTo contract: negative = this before other, 0 = equal, positive = this after other. Convention from the slides: return 1 for null, `as`-cast + null check, throw ArgumentException for foreign types." },
  { tip: "Generic alternative: implement `IComparable<Party>` (`int CompareTo(Party? other)`) to skip the casting. Both are accepted; the slides used the non-generic one." },
]},

{
id: "oop-composition-aggregation",
title: "Composition vs Aggregation",
cat: "OOP Fundamentals",
tags: ["composition", "aggregation", "has-a", "part-of", "uml", "diamond"],
related: ["oop-inheritance", "pb-problem1-analysis"],
blocks: [
  { def: "Aggregation is a has-a relationship where one class references the other. The part can exist independently of the whole. (UML: hollow diamond.) Example: a Library holds Books, but the Books exist without the Library.", term: "Aggregation" },
  { def: "Composition is a part-of relationship where both classes are strongly linked. The part cannot exist without the whole. (UML: filled diamond.) Example: a House has Rooms; destroy the house and the rooms are gone.", term: "Composition" },
  { code: String.raw`// AGGREGATION: Pizza stores references to externally created, shareable Ingredients
public class Pizza
{
    public List<Ingredient> Ingredients { get; } = new List<Ingredient>();
    public void AddIngredient(Ingredient ingredient) => Ingredients.Add(ingredient);
}

Ingredient cheese = new Ingredient("Cheese");          // created independently
Ingredient tomatoSauce = new Ingredient("Tomato Sauce");

Pizza margherita = new Pizza();
margherita.AddIngredient(cheese);
Pizza pepperoni = new Pizza();
pepperoni.AddIngredient(cheese);                       // SAME cheese object shared`, lang: "csharp", title: "Aggregation: parts passed in from outside, shareable" },
  { code: String.raw`// COMPOSITION: Pizza creates and owns its own Ingredients
public class Pizza
{
    private List<Ingredient> Ingredients { get; } = new List<Ingredient>();

    public Pizza(List<string> ingredientNames)
    {
        foreach (var name in ingredientNames)
            Ingredients.Add(new Ingredient(name));     // whole constructs its parts
    }
}

Pizza margherita = new Pizza(["Cheese", "Tomato Sauce"]);
// when the Pizza is gone, its Ingredient objects are gone too`, lang: "csharp", title: "Composition: private list, whole creates parts" },
  { rule: "How to tell them apart in exam code: parts **passed in / public list** = aggregation. Parts **created inside the class / private list** = composition." },
]}

);
