/* ============ TOPIC EXAMPLES ============
   Collapsed, per-topic "Examples" sections shown under every reference topic.
   Shape: window.TOPIC_EXAMPLES[topicId] = [ { title, lang, code }, ... ].
   renderExamples() in app.js turns each entry into a <details> the reader expands;
   every code block gets a working copy button. Browser global + Node export.

   Coverage (every reference-doc topic has >=1 example) is pinned by
   tests/examples.test.js. Generated/assembled per category; safe to hand-edit. */
(function (global) {
"use strict";

var TOPIC_EXAMPLES = {
  "oop-four-principles": [
    {
      "title": "All four principles in one tiny file",
      "lang": "csharp",
      "code": "public interface IPrintable { string Render(); }          // ABSTRACTION: what, not how\n\npublic abstract class Document : IPrintable                 // INHERITANCE base\n{\n    private string _title = \"\";                             // ENCAPSULATION: hidden field\n    public string Title { get => _title; set => _title = value.Trim(); }\n    public abstract string Render();                        // each subtype renders itself\n}\n\npublic class Invoice : Document\n{\n    public decimal Total { get; init; }\n    public override string Render() => $\"INVOICE {Title}: {Total:C}\";\n}\n\nDocument doc = new Invoice { Title = \"  ACME  \", Total = 99 };\nConsole.WriteLine(doc.Render());   // POLYMORPHISM: Invoice.Render runs via Document ref"
    },
    {
      "title": "Spotting each principle by its tell",
      "lang": "csharp",
      "code": "// ENCAPSULATION  -> private field + property guarding it\nprivate int _count; public int Count { get => _count; private set => _count = value; }\n// ABSTRACTION    -> code depends on the interface, never the concrete type\nIPrintable thing = new Invoice();\n// INHERITANCE    -> ': base' and reuse of inherited members\npublic class Report : Document { public override string Render() => Title; }\n// POLYMORPHISM   -> one base-typed list holding many concrete types\nList<Document> all = new() { new Invoice(), new Report() };\nforeach (var d in all) Console.WriteLine(d.Render());   // runtime picks each override"
    }
  ],
  "oop-encapsulation": [
    {
      "title": "A Counter that protects its own invariant",
      "lang": "csharp",
      "code": "public class Counter\n{\n    private int _value;                       // nobody outside can poke this directly\n    public int Value => _value;               // read-only view from outside\n\n    public void Increment() => _value++;      // mutation only through methods\n    public void Reset()     => _value = 0;\n    // No public setter -> Value can never go negative or skip steps.\n}\n\nCounter c = new();\nc.Increment(); c.Increment();\nConsole.WriteLine(c.Value);   // => 2\n// c.Value = 99;             // COMPILE ERROR: there is no setter to abuse"
    },
    {
      "title": "Access modifiers, demonstrated",
      "lang": "csharp",
      "code": "public class Account\n{\n    public    string Owner = \"\";      // visible everywhere\n    internal  string Bank  = \"\";      // visible anywhere in THIS project\n    protected int    Pin;             // visible only to subclasses + this class\n    private   decimal _balance;       // visible only inside Account\n\n    public decimal Balance => _balance;\n    public void Deposit(decimal amount) { if (amount > 0) _balance += amount; }\n}\n// Outside code can touch Owner, can call Deposit/Balance,\n// but cannot read _balance or set Pin -> internals stay hidden."
    }
  ],
  "oop-properties": [
    {
      "title": "Computed + validating properties on a Recipe",
      "lang": "csharp",
      "code": "public class Recipe\n{\n    public string Name { get; init; } = \"\";          // set once at creation\n    public int Servings { get; private set; } = 1;   // changed only inside the class\n    public List<string> Ingredients { get; } = new();// read-only ref, list still fillable\n    public int IngredientCount => Ingredients.Count;  // expression-bodied, computed\n    public bool IsBatch => Servings >= 8;             // derived flag, no backing field\n    public void ScaleTo(int servings)\n        => Servings = servings < 1 ? 1 : servings;    // validation on the setter path\n}\n\nvar r = new Recipe { Name = \"Chili\" };               // init-only set here\nr.Ingredients.Add(\"Beans\");\nr.ScaleTo(10);\nConsole.WriteLine($\"{r.IngredientCount} ingr, batch={r.IsBatch}\");  // => 1 ingr, batch=True"
    },
    {
      "title": "Auto-property vs full property: same outside, different inside",
      "lang": "csharp",
      "code": "// Auto-property: compiler writes the hidden backing field for you\npublic string Title { get; set; } = \"\";\n\n// Full property: you own the backing field, so you can add logic\nprivate string _email = \"\";\npublic string Email\n{\n    get => _email;\n    set => _email = value.ToLower();   // normalise on the way in; 'value' is the assigned RHS\n}\n// p.Email = \"BO@X.COM\";  =>  stored as \"bo@x.com\""
    }
  ],
  "oop-constructors": [
    {
      "title": "Constructor chaining with this(...) to avoid duplication",
      "lang": "csharp",
      "code": "public class Contact\n{\n    public string Name  { get; }\n    public string Email { get; }\n\n    // The 'main' constructor does the real work\n    public Contact(string name, string email)\n    {\n        Name = name;\n        Email = email;\n    }\n\n    // Convenience overload delegates with ': this(...)' -> no copy-pasted init\n    public Contact(string name) : this(name, \"unknown@example.com\") { }\n}\n\nContact a = new Contact(\"Bo\", \"bo@x.com\");\nContact b = new Contact(\"Liv\");          // email defaults via the chained ctor"
    },
    {
      "title": "Primary constructor + object initializer together",
      "lang": "csharp",
      "code": "// Primary constructor: 'priority' is usable directly in the body\npublic class Task(int priority)\n{\n    public int Priority { get; } = priority;   // captured into a property\n    public string Label { get; set; } = \"\";    // settable -> usable in initializer\n}\n\n// Object initializer fills settable members AFTER the ctor runs\nTask t = new Task(1) { Label = \"Pay invoice\" };\nConsole.WriteLine($\"{t.Priority}: {t.Label}\");   // => 1: Pay invoice"
    }
  ],
  "oop-inheritance": [
    {
      "title": "Document base + derived in the DocumentManager domain",
      "lang": "csharp",
      "code": "public class Document(string title, string owner)   // primary ctor base\n{\n    protected string Owner { get; } = owner;          // subclasses see it, outsiders do not\n    public string Title { get; } = title;\n    public virtual string Describe() => $\"{Title} (by {Owner})\";\n}\n\npublic class Invoice : Document\n{\n    public decimal Amount { get; }\n    public Invoice(string title, string owner, decimal amount)\n        : base(title, owner)                          // chain the base ctor first\n        => Amount = amount;\n    public override string Describe() => base.Describe() + $\" - {Amount:C}\";\n}\n\nConsole.WriteLine(new Invoice(\"Q1\", \"Acme\", 500).Describe());  // Q1 (by Acme) - kr 500.00"
    },
    {
      "title": "Derived gains everything; 'base.' reuses parent code",
      "lang": "csharp",
      "code": "public class Report : Document\n{\n    public int Pages { get; }\n    public Report(string title, string owner, int pages) : base(title, owner)\n        => Pages = pages;\n    // No Describe() override -> it INHERITS Document.Describe unchanged.\n}\n\nReport r = new Report(\"Sales\", \"Bo\", 12);\nConsole.WriteLine(r.Title);       // inherited property\nConsole.WriteLine(r.Describe());  // inherited method -> Sales (by Bo)"
    }
  ],
  "oop-override-vs-new": [
    {
      "title": "Same call, different result: override vs new",
      "lang": "csharp",
      "code": "public class Animal { public virtual string Speak() => \"...\"; }\n\npublic class Dog : Animal              // OVERRIDE: replaces, runtime dispatch\n{\n    public override string Speak() => \"Woof\";\n}\npublic class Cat : Animal              // NEW: hides, compile-time dispatch\n{\n    public new string Speak() => \"Meow\";\n}\n\nAnimal d = new Dog();\nAnimal c = new Cat();\nConsole.WriteLine(d.Speak());        // => Woof  (Dog wins: virtual/override)\nConsole.WriteLine(c.Speak());        // => ...   (Animal wins: variable is typed Animal)\nConsole.WriteLine(((Cat)c).Speak()); // => Meow (now the variable type is Cat)"
    },
    {
      "title": "ToString is virtual, so override (not new) wins through a base ref",
      "lang": "csharp",
      "code": "public class Money\n{\n    public decimal Amount { get; init; }\n    public override string ToString() => $\"{Amount:0.00} kr\";  // overrides object.ToString\n}\n\nobject boxed = new Money { Amount = 12.5M };\nConsole.WriteLine(boxed);          // => 12.50 kr (override reached even via 'object')\nConsole.WriteLine(boxed.ToString());\n// If ToString had used 'new' instead, 'object' would print the type name."
    }
  ],
  "oop-abstract": [
    {
      "title": "Abstract DietaryRule with a shared template + an abstract hook",
      "lang": "csharp",
      "code": "public abstract class DietaryRule(string name)\n{\n    public string Name { get; } = name;\n    public abstract bool Allows(string ingredient);   // each rule MUST define this\n    // Concrete shared behaviour reusing the abstract member:\n    public string Check(string ingredient)\n        => Allows(ingredient) ? $\"{Name}: OK\" : $\"{Name}: forbidden ({ingredient})\";\n}\n\npublic class Vegan() : DietaryRule(\"Vegan\")\n{\n    public override bool Allows(string ingredient)\n        => ingredient is not (\"Cheese\" or \"Beef\" or \"Egg\");\n}\n\nConsole.WriteLine(new Vegan().Check(\"Beef\"));   // => Vegan: forbidden (Beef)\n// var r = new DietaryRule(\"x\");  // COMPILE ERROR: cannot instantiate abstract class"
    },
    {
      "title": "Abstract member forces every subclass to fill the gap",
      "lang": "csharp",
      "code": "public abstract class Validator\n{\n    public abstract string? Validate(string input);   // no body -> subclass must override\n}\n\npublic class NotEmpty : Validator\n{\n    public override string? Validate(string input)\n        => string.IsNullOrWhiteSpace(input) ? \"required\" : null;\n}\n// Forgetting to override Validate in NotEmpty would NOT compile."
    }
  ],
  "oop-interfaces": [
    {
      "title": "ISummarizable contract, two unrelated classes honour it",
      "lang": "csharp",
      "code": "public interface ISummarizable { string GenerateSummary(); }\n\npublic class Invoice : ISummarizable\n{\n    public decimal Total { get; init; }\n    public string GenerateSummary() => $\"Invoice for {Total:C}\";\n}\n\npublic class Report : ISummarizable\n{\n    public int Pages { get; init; }\n    public string GenerateSummary() => $\"Report, {Pages} pages\";\n}\n\n// Code depends on the CONTRACT, not the concrete type:\nList<ISummarizable> items = new() { new Invoice { Total = 50 }, new Report { Pages = 3 } };\nforeach (var i in items) Console.WriteLine(i.GenerateSummary());"
    },
    {
      "title": "One class, several can-do contracts",
      "lang": "csharp",
      "code": "public interface ISaveable { void Save(); }\npublic interface IPrintable { void Print(); }\n\npublic class Invoice : ISaveable, IPrintable   // any number of interfaces\n{\n    public void Save()  => Console.WriteLine(\"saved\");\n    public void Print() => Console.WriteLine(\"printed\");\n}\n\nISaveable s = new Invoice();   // reference by interface (can't 'new' the interface)\ns.Save();\n// ((IPrintable)s).Print();    // same object, viewed through a different contract"
    }
  ],
  "oop-polymorphism-casting": [
    {
      "title": "is / as / switch on a mixed shape list (Canvas domain)",
      "lang": "csharp",
      "code": "abstract class Shape { public abstract double Area(); }\nclass Rect      : Shape { public double W, H; public override double Area() => W * H; }\nclass Jellyfish : Shape { public double R;    public override double Area() => Math.PI * R * R; }\n\nList<Shape> shapes = new() { new Rect { W = 2, H = 3 }, new Jellyfish { R = 1 } };\nforeach (Shape s in shapes)            // each item is UPCAST to Shape (implicit, safe)\n{\n    if (s is Rect r)                   // 'is' pattern: downcast + null-test in one\n        Console.WriteLine($\"rect {r.W}x{r.H}\");\n    string label = s switch            // 'switch' pattern reads cleaner for many types\n    {\n        Rect      => \"rectangle\",\n        Jellyfish => \"jellyfish\",\n        _         => \"shape\"\n    };\n    Console.WriteLine($\"{label}: {s.Area():0.00}\");\n}"
    },
    {
      "title": "as vs hard cast: failure modes differ",
      "lang": "csharp",
      "code": "Shape s = new Rect { W = 1, H = 1 };\n\nJellyfish? j = s as Jellyfish;   // 'as' => null on failure, never throws\nConsole.WriteLine(j is null);    // => True\n\n// Jellyfish bad = (Jellyfish)s;  // hard cast => throws InvalidCastException\n\nif (s is Rect)                   // 'is' (no variable) => just a bool test\n    Console.WriteLine(\"it's a rect\");"
    }
  ],
  "oop-object-tostring-icomparable": [
    {
      "title": "Generic IComparable<T>: no casting, no ArgumentException",
      "lang": "csharp",
      "code": "public class Recipe : IComparable<Recipe>\n{\n    public string Name { get; init; } = \"\";\n    public int Minutes { get; init; }\n\n    public override string ToString() => $\"{Name} ({Minutes} min)\";\n\n    public int CompareTo(Recipe? other)\n    {\n        if (other is null) return 1;            // null sorts first\n        return Minutes.CompareTo(other.Minutes); // delegate to int's CompareTo\n    }\n}\n\nList<Recipe> rs = new() { new() { Name = \"Stew\", Minutes = 90 },\n                          new() { Name = \"Toast\", Minutes = 3 } };\nrs.Sort();                                       // uses CompareTo\nConsole.WriteLine(string.Join(\", \", rs));        // => Toast (3 min), Stew (90 min)"
    },
    {
      "title": "Override Equals + GetHashCode as a pair",
      "lang": "csharp",
      "code": "public class Sku\n{\n    public string Code { get; init; } = \"\";\n\n    public override bool Equals(object? obj)\n        => obj is Sku other && other.Code == Code;     // value equality, not reference\n\n    public override int GetHashCode() => Code.GetHashCode();  // MUST match Equals\n}\n\nvar a = new Sku { Code = \"A1\" };\nvar b = new Sku { Code = \"A1\" };\nConsole.WriteLine(a.Equals(b));              // => True (same Code)\nConsole.WriteLine(new HashSet<Sku> { a, b }.Count);  // => 1 (dedup uses both members)"
    }
  ],
  "oop-composition-aggregation": [
    {
      "title": "Aggregation: ContactList holds Contacts that outlive it",
      "lang": "csharp",
      "code": "// AGGREGATION (has-a): contacts are created outside and passed in; they can be shared\npublic class ContactList\n{\n    public List<Contact> Contacts { get; } = new();      // public list of external parts\n    public void Add(Contact c) => Contacts.Add(c);\n}\n\nContact bo = new Contact(\"Bo\");          // exists on its own\nContactList work = new(); work.Add(bo);\nContactList home = new(); home.Add(bo);  // SAME Contact shared by two lists\n// Delete either list and 'bo' still exists."
    },
    {
      "title": "Composition: a MealPlan owns the Days it creates",
      "lang": "csharp",
      "code": "// COMPOSITION (part-of): the whole builds its parts in a PRIVATE list\npublic class MealPlan\n{\n    private readonly List<DayPlan> _days = new();        // private -> outsiders can't share them\n\n    public MealPlan(int days)\n    {\n        for (int i = 1; i <= days; i++)\n            _days.Add(new DayPlan(i));                   // whole constructs its own parts\n    }\n    public int DayCount => _days.Count;\n}\n\nMealPlan week = new MealPlan(7);\n// When 'week' is gone, its 7 DayPlan objects go with it; nothing else holds them."
    }
  ],
  "cs-delegates": [
    {
      "title": "Inspecting & invoking a multicast delegate",
      "lang": "csharp",
      "code": "Action steps = () => Console.Write(\"A\");\nsteps += () => Console.Write(\"B\");\nsteps += () => Console.Write(\"C\");\n\nsteps();                              // prints \"ABC\" (added order)\n\n// GetInvocationList() => the methods currently attached\nDelegate[] subs = steps.GetInvocationList();\nsubs.Length;                          // => 3\n\nsteps -= subs[1] as Action;           // detach the middle one\nsteps();                              // prints \"AC\""
    },
    {
      "title": "Func-returning multicast keeps only the LAST result",
      "lang": "csharp",
      "code": "Func<int> roll = () => 1;\nroll += () => 2;\nroll += () => 3;\n\nint r = roll();                       // => 3  (all run, last return wins)\n\n// So multicast is normally used with void delegates (Action) for notifications.\nAction? empty = null;\nempty?.Invoke();                      // safe no-op: ?. skips when null"
    }
  ],
  "cs-action-func": [
    {
      "title": "The built-in delegate family in one glance",
      "lang": "csharp",
      "code": "Action greet = () => Console.WriteLine(\"hi\");      // 0 args, void\nAction<string> say = msg => Console.WriteLine(msg); // 1 arg, void\nFunc<int> get = () => 42;                          // 0 args, returns int\nFunc<int,int,int> add = (a, b) => a + b;           // 2 args -> int\nPredicate<int> isEven = n => n % 2 == 0;           // arg -> bool\n\nadd(3, 4);                            // => 7\nisEven(10);                           // => True\nget();                                // => 42"
    },
    {
      "title": "Lambdas with bodies, captured variables & defaults",
      "lang": "csharp",
      "code": "int factor = 10;\nFunc<int,int> scale = x => x * factor;   // captures 'factor' (closure)\nscale(5);                                // => 50\nfactor = 100;\nscale(5);                                // => 500 (sees the new value)\n\n// Statement-body lambda (braces + return):\nFunc<int,string> grade = score =>\n{\n    if (score >= 50) return \"Pass\";\n    return \"Fail\";\n};\ngrade(72);                               // => \"Pass\"\n\n// C# 9+ static lambda + default param:\nFunc<int,int,int> pow = static (b, e) => (int)Math.Pow(b, e);\npow(2, 3);                               // => 8"
    }
  ],
  "cs-events": [
    {
      "title": "Subscribe with a named handler, then unsubscribe",
      "lang": "csharp",
      "code": "public class Clock\n{\n    public event EventHandler? Tick;\n    public void Beat() => Tick?.Invoke(this, EventArgs.Empty);\n}\n\nvar clock = new Clock();\nvoid OnTick(object? sender, EventArgs e) => Console.WriteLine(\"tick\");\n\nclock.Tick += OnTick;     // subscribe\nclock.Beat();             // prints \"tick\"\nclock.Tick -= OnTick;     // unsubscribe (need a NAMED method to remove)\nclock.Beat();             // prints nothing"
    },
    {
      "title": "EventArgs.Empty and the non-generic EventHandler",
      "lang": "csharp",
      "code": "// EventHandler  == delegate void (object? sender, EventArgs e)\n// EventHandler<T> == delegate void (object? sender, T e)\n\npublic event EventHandler? Saved;\n\n// Raising with no payload: reuse the shared empty instance\nSaved?.Invoke(this, EventArgs.Empty);\n\n// Anonymous + discard params when you ignore sender/args (common in GUI):\nSaved += (_, _) => Console.WriteLine(\"document saved\");"
    }
  ],
  "cs-generics": [
    {
      "title": "Generic method with type inference",
      "lang": "csharp",
      "code": "T First<T>(IEnumerable<T> items)\n{\n    foreach (var x in items) return x;\n    throw new InvalidOperationException(\"empty\");\n}\n\nFirst(new[] { 10, 20, 30 });          // => 10   (T inferred as int)\nFirst(new[] { \"a\", \"b\" });            // => \"a\"  (T inferred as string)\n\n// default(T): 0 for numbers, null for reference types\nint dn = default;                     // => 0\nstring? ds = default;                 // => null"
    },
    {
      "title": "Common where-constraints in action",
      "lang": "csharp",
      "code": "// new()  -> T must have a parameterless constructor\nT Make<T>() where T : new() => new T();\n\n// IComparable<T> -> can call CompareTo, so we can sort/compare\nT Max<T>(T a, T b) where T : IComparable<T>\n    => a.CompareTo(b) >= 0 ? a : b;\nMax(3, 9);                            // => 9\nMax(\"apple\", \"pear\");                 // => \"pear\"\n\n// struct / class constrain to value or reference types:\nvoid OnlyStructs<T>(T v) where T : struct { }"
    }
  ],
  "cs-switch-patterns": [
    {
      "title": "Relational, 'and'/'or', and 'when' patterns",
      "lang": "csharp",
      "code": "string Rate(int score) => score switch\n{\n    < 0 or > 100 => \"invalid\",         // 'or' combines patterns\n    >= 90        => \"A\",               // relational pattern\n    >= 50 and < 90 => \"pass\",          // 'and' combines\n    _            => \"fail\"\n};\nRate(95);                              // => \"A\"\nRate(40);                              // => \"fail\"\n\n// 'when' adds a boolean guard to a case:\nstring Sign(int n) => n switch\n{\n    0 => \"zero\",\n    var x when x > 0 => \"positive\",\n    _ => \"negative\"\n};"
    },
    {
      "title": "Type switch + tuple & property patterns",
      "lang": "csharp",
      "code": "object o = 42;\nstring desc = o switch\n{\n    int i        => $\"int {i}\",        // type pattern, binds i\n    string s     => $\"text {s}\",\n    null         => \"null\",\n    _            => \"other\"\n};\ndesc;                                  // => \"int 42\"\n\n// Tuple pattern (switch on two values at once):\nstring Quadrant(int x, int y) => (x, y) switch\n{\n    (> 0, > 0) => \"NE\",\n    (< 0, > 0) => \"NW\",\n    _          => \"axis/other\"\n};\nQuadrant(3, 4);                        // => \"NE\""
    }
  ],
  "cs-null-operators": [
    {
      "title": "Chaining ?. and indexing safely",
      "lang": "csharp",
      "code": "string? name = null;\nint? len = name?.Length;               // => null (call skipped, no crash)\nint safeLen = name?.Length ?? 0;       // => 0   (?? supplies fallback)\n\n// ?[ ] = null-conditional index on a maybe-null collection:\nList<int>? nums = null;\nint? first = nums?[0];                 // => null  (no exception)\n\n// Whole chain short-circuits on the FIRST null:\nstring? city = person?.Address?.City;  // null if person OR Address is null"
    },
    {
      "title": "??= and nullable value-type bridging",
      "lang": "csharp",
      "code": "Dictionary<string,int> counts = new();\nstring key = \"apples\";\n// GetValueOrDefault avoids KeyNotFoundException:\nint c = counts.GetValueOrDefault(key); // => 0\n\nint? maybe = null;\nmaybe ??= 5;                           // assign because it was null => 5\nmaybe ??= 9;                           // no-op now (already non-null) => 5\n\nbool? flag = null;                     // tri-state bool (true/false/null)\nbool yes = flag == true;               // => False (null != true)\nbool no  = flag.GetValueOrDefault();   // => False"
    }
  ],
  "cs-exceptions": [
    {
      "title": "Filters, rethrow, and custom exceptions",
      "lang": "csharp",
      "code": "try\n{\n    int[] a = { 1, 2, 3 };\n    Console.WriteLine(a[5]);           // throws IndexOutOfRangeException\n}\ncatch (Exception ex) when (ex is IndexOutOfRangeException) // filter\n{\n    Console.WriteLine(\"bad index\");\n}\n\n// Rethrow WITHOUT losing the stack trace: bare 'throw;' (not 'throw ex;')\ntry { Risky(); }\ncatch (IOException) { Cleanup(); throw; }\n\n// Define your own:\npublic class OutOfStockException : Exception\n{\n    public OutOfStockException(string item) : base($\"No {item} left\") { }\n}"
    },
    {
      "title": "TryParse instead of catching, and using for cleanup",
      "lang": "csharp",
      "code": "// Prefer Try* over try/catch for expected bad input:\nif (int.TryParse(\"42\", out int n))    // n = 42, returns true\n    Console.WriteLine(n);\nbool ok = int.TryParse(\"x\", out int z);// ok => false, z => 0\n\n// 'using' guarantees Dispose() even if the body throws (like finally):\nusing (var sw = new StreamWriter(\"log.txt\"))\n{\n    sw.WriteLine(\"entry\");\n}                                      // sw.Dispose() called here\n\n// argument guards (clean throwing):\nvoid SetAge(int age) => ArgumentOutOfRangeException.ThrowIfNegative(age);"
    }
  ],
  "cs-strings-formatting": [
    {
      "title": "Number, percent & alignment format specifiers",
      "lang": "csharp",
      "code": "double pi = 3.14159;\n$\"{pi:F2}\";                            // => \"3.14\"  (fixed 2 decimals)\n$\"{1234.5:N0}\";                        // => \"1,235\" (thousands, 0 dec)\n$\"{0.25:P0}\";                          // => \"25 %\"  (percent)\n$\"{255:X}\";                            // => \"FF\"    (hex)\n$\"{42:D5}\";                            // => \"00042\" (pad int to 5)\n\n// Alignment: {value,width} (negative = left-align)\n$\"{\"a\",-5}|{\"b\",5}|\";                  // => \"a    |    b|\"\nstring.Format(\"{0} of {1}\", 3, 10);    // => \"3 of 10\""
    },
    {
      "title": "Splitting, joining, checking & building",
      "lang": "csharp",
      "code": "\"a, b ,c\".Split(',', StringSplitOptions.TrimEntries); // => [\"a\",\"b\",\"c\"]\nstring.Join(\"-\", new[] { 2026, 6, 13 });              // => \"2026-6-13\"\n\"hello\".StartsWith(\"he\");              // => True\n\"hello\".Contains(\"ell\");               // => True\n\"hello\".Substring(1, 3);               // => \"ell\"\n\"hello\".IndexOf('l');                  // => 2\n\"  hi \".Trim();                        // => \"hi\"\n\nvar sb = new System.Text.StringBuilder(); // efficient loop concatenation\nsb.Append(\"a\").Append(\"b\").AppendLine();\nsb.ToString();                         // => \"ab\\r\\n\""
    }
  ],
  "cs-records-structs": [
    {
      "title": "Record extras: deconstruction & ToString",
      "lang": "csharp",
      "code": "public record Person(string Name, int Age);\n\nvar p = new Person(\"Mia\", 30);\np.ToString();                          // => \"Person { Name = Mia, Age = 30 }\"\n\nvar (name, age) = p;                   // deconstruct into variables\nname;                                  // => \"Mia\"\n\nvar older = p with { Age = 31 };       // copy + change one field\np == older;                            // => False (value equality)\np == new Person(\"Mia\", 30);            // => True"
    },
    {
      "title": "Enums: flags, parsing & all values",
      "lang": "csharp",
      "code": "public enum Day { Mon, Tue, Wed, Thu, Fri }\n(int)Day.Wed;                          // => 2  (underlying value)\nDay.Tue.ToString();                    // => \"Tue\"\n\nEnum.Parse<Day>(\"Fri\");                // => Day.Fri\nEnum.TryParse(\"Sun\", out Day d);       // => false (no such name)\nEnum.GetValues<Day>().Length;          // => 5\n\n// [Flags] enum: combine with | , test with HasFlag\n[Flags] public enum Access { None=0, Read=1, Write=2 }\nvar a = Access.Read | Access.Write;\na.HasFlag(Access.Write);               // => True"
    }
  ],
  "solid-overview": [
    {
      "title": "One annotated class, all five lenses",
      "lang": "csharp",
      "code": "public class OrderService            // SRP: does it do ONE job? (here: no, it also saves + emails)\n{\n    private FileStore _store = new();  // DIP: concretion built inside -> should be injected interface\n\n    public void Place(Order o)\n    {\n        if (o is RushOrder)            // OCP: a type-switch that grows -> closed-for-mod is broken\n            { /* special path */ }\n        _store.Save(o);                // SRP: persistence leaking into business logic\n    }\n}\n// Reading exam code: run each letter as a question over the SAME class.\n// S=how many reasons to change?  O=must I edit to extend?  L=any downcasts?\n// I=fat interface forcing empties?  D=does it 'new' its own collaborators?"
    },
    {
      "title": "The five as a checklist you can recite",
      "lang": "csharp",
      "code": "// S - split classes until each has ONE reason to change\n// O - add behaviour via new types, not by editing old ones\n// L - any subtype must honour the base type's promises (no surprises)\n// I - prefer several small interfaces over one big one\n// D - high-level code depends on interfaces; concretes wired at the root\n// Mnemonic: S.O.L.I.D = Split, Open, Liskov, Interfaces-small, Depend-on-abstractions"
    }
  ],
  "solid-srp": [
    {
      "title": "Recognise it: a method list with mixed verbs",
      "lang": "csharp",
      "code": "// SMELL: the verbs span three unrelated concerns in one class\npublic class UserAccount\n{\n    public void Register(string email) { }   // domain rule\n    public void RenderHtml() { }              // presentation\n    public void WriteToDatabase() { }         // persistence\n}\n// Heuristic: read the method names aloud. If you need the word 'and'\n// to describe the class ('registers users AND renders AND stores'),\n// that 'and' is each extra reason to change -> split per concern."
    },
    {
      "title": "Minimal split (different domain: invoices)",
      "lang": "csharp",
      "code": "// One reason to change apiece\npublic class InvoiceCalculator { public decimal Total(Invoice i) => i.Lines.Sum(l => l.Amount); }\npublic class InvoiceFormatter  { public string AsText(Invoice i) => $\"Total: {i.Total:C}\"; }\npublic class InvoiceRepository { public void Save(Invoice i) { /* persistence only */ } }\n// Tax rules change -> only Calculator changes.\n// Layout changes  -> only Formatter changes.\n// Storage changes -> only Repository changes."
    }
  ],
  "solid-ocp": [
    {
      "title": "Recognise it: the growing switch",
      "lang": "csharp",
      "code": "// VIOLATION pattern to spot: a switch/if-chain on a 'kind' field.\n// Every new shipping method forces an edit here -> not closed for modification.\npublic decimal Fee(Shipment s) => s.Kind switch\n{\n    \"Standard\" => 5m,\n    \"Express\"  => 12m,\n    _          => throw new ArgumentException(\"unknown\")\n};\n// Tell: adding a feature means re-opening THIS method instead of adding a class."
    },
    {
      "title": "Before/after with a discount policy",
      "lang": "csharp",
      "code": "// AFTER: open for extension (add IDiscount classes), closed for modification\npublic interface IDiscount { decimal Apply(decimal price); }\npublic class SeasonalDiscount : IDiscount { public decimal Apply(decimal p) => p * 0.9m; }\npublic class LoyaltyDiscount  : IDiscount { public decimal Apply(decimal p) => p - 5m; }\n\npublic decimal Checkout(decimal price, IEnumerable<IDiscount> discounts)\n    => discounts.Aggregate(price, (acc, d) => d.Apply(acc));\n// New discount next quarter? Add a class. Checkout never reopens."
    }
  ],
  "solid-lsp": [
    {
      "title": "Recognise it: a subtype that refuses the contract",
      "lang": "csharp",
      "code": "// SMELL: a subclass that throws where the base promised it works.\npublic class ReadOnlyList<T> : List<T>\n{\n    public new void Add(T item) => throw new NotSupportedException(); // breaks the promise\n}\n// Substituting ReadOnlyList where List is expected explodes -> not substitutable.\n// Tell: 'throw NotSupported/NotImplemented' inside an override, or callers that\n// must 'if (x is SpecificType)' before trusting the object = LSP broken."
    },
    {
      "title": "Honour the contract instead (notifier example)",
      "lang": "csharp",
      "code": "public interface INotifier { void Notify(string message); }\n\n// Every implementation keeps the same promise: 'after Notify, the message was delivered'.\npublic class ConsoleNotifier : INotifier { public void Notify(string m) => Console.WriteLine(m); }\npublic class SilentNotifier  : INotifier { public void Notify(string m) { } } // still valid: no-op honours 'best-effort deliver'\n\n// Caller never type-checks; any INotifier slots in safely:\nvoid Run(INotifier n) => n.Notify(\"done\");"
    }
  ],
  "solid-isp": [
    {
      "title": "Recognise it: the NotImplemented tell",
      "lang": "csharp",
      "code": "// SMELL: implementing an interface but stubbing methods you don't need.\npublic interface IMultiFunctionDevice { void Print(); void Scan(); void Fax(); }\n\npublic class BudgetPrinter : IMultiFunctionDevice\n{\n    public void Print() { /* real */ }\n    public void Scan() => throw new NotImplementedException();  // forced junk\n    public void Fax()  => throw new NotImplementedException();  // forced junk\n}\n// Tell: empty bodies or NotImplemented in an implementation =\n// the interface is too fat for this client. Split it."
    },
    {
      "title": "Split into role interfaces (different domain)",
      "lang": "csharp",
      "code": "public interface IPrinter { void Print(); }\npublic interface IScanner { void Scan(); }\npublic interface IFax     { void Fax(); }\n\npublic class BudgetPrinter : IPrinter { public void Print() { } }            // implements ONLY what it does\npublic class OfficeMachine : IPrinter, IScanner, IFax\n{\n    public void Print() { } public void Scan() { } public void Fax() { }\n}\n// A consumer needing only print accepts IPrinter -> minimal coupling."
    }
  ],
  "solid-dip": [
    {
      "title": "Recognise it: 'new' of a concrete in the body",
      "lang": "csharp",
      "code": "// SMELL: high-level policy hard-wired to a low-level detail.\npublic class CheckoutService\n{\n    public void Pay(decimal amount)\n    {\n        var gateway = new StripeSdk();   // <-- concretion built here = DIP violated\n        gateway.MakeCharge((int)(amount * 100), \"USD\");\n    }\n}\n// Tell: any 'new ConcreteThing()' inside business logic (not the composition root).\n// You cannot test Pay without hitting real Stripe."
    },
    {
      "title": "Invert with an injected abstraction",
      "lang": "csharp",
      "code": "public interface IPaymentService { void Pay(decimal amount); }\n\npublic class CheckoutService\n{\n    private readonly IPaymentService _payment;\n    public CheckoutService(IPaymentService payment) => _payment = payment; // depend on abstraction\n    public void Pay(decimal amount) => _payment.Pay(amount);\n}\n// Tests inject a fake IPaymentService; production injects StripeAdapter.\n// High-level CheckoutService no longer knows any concrete payment type."
    }
  ],
  "dp-overview": [
    {
      "title": "Name-the-pattern by shape (cheat sheet)",
      "lang": "csharp",
      "code": "// Singleton:  private ctor + static Instance/Lazy<T>            -> ShapeFacade.GetInstance\n// Facade:     one class with simple methods over many classes   -> ShapeFacade.GetShapeInfo\n// Adapter:    implements IClient, holds a field of foreign type -> StripeAdapter : IPaymentService\n// Strategy:   interface + interchangeable concretes injected    -> IDietaryRule rules\n// Command:    object with Execute + CanExecute                  -> [RelayCommand] / ICommand\n// Observer:   subject raises change, subscribers react          -> INotifyPropertyChanged / events\n// DI:         constructor takes interfaces, root news concretes  -> App.axaml.cs wiring"
    },
    {
      "title": "MVVM is three of them stacked",
      "lang": "csharp",
      "code": "public partial class CounterViewModel : ObservableObject\n{\n    [ObservableProperty] private int count;          // Observer: raises PropertyChanged\n\n    [RelayCommand(CanExecute = nameof(CanReset))]    // Command: Execute + CanExecute\n    private void Reset() => Count = 0;\n    private bool CanReset() => Count != 0;\n\n    private readonly IClock _clock;                  // DI: dependency injected, not newed\n    public CounterViewModel(IClock clock) => _clock = clock;\n}\n// One small ViewModel demonstrates Observer + Command + DI at once."
    }
  ],
  "dp-singleton": [
    {
      "title": "Recognise it vs a normal class",
      "lang": "csharp",
      "code": "// Three tells together = Singleton:\npublic sealed class AppConfig                 // 1) sealed (no subclassing)\n{\n    private static readonly AppConfig _instance = new();\n    public static AppConfig Instance => _instance;   // 2) static access point\n    private AppConfig() { }                    // 3) private ctor (cannot 'new' elsewhere)\n    public string Theme { get; set; } = \"Dark\";\n}\n// If any of the three is missing it is NOT a singleton -- e.g. a public ctor means\n// callers can make extra instances, defeating 'exactly one'."
    },
    {
      "title": "Why DI is usually the better critique",
      "lang": "csharp",
      "code": "// Singleton (global, hidden dependency, hard to fake in a test):\nvar theme = AppConfig.Instance.Theme;\n\n// Same single instance, but supplied via DI at the composition root instead:\nvar config = new AppConfig();                 // one instance, created once at the root\nvar vm = new SettingsViewModel(config);       // injected -> a test can pass a different config\n// Exam point: 'one instance' can be achieved by registering a single object in the\n// composition root, without the global static access that hurts testability."
    }
  ],
  "dp-facade": [
    {
      "title": "Recognise it: one method, many collaborators",
      "lang": "csharp",
      "code": "// A facade method orchestrates several subsystem classes behind a simple call.\npublic class DocumentWorkflowManager\n{\n    private readonly IValidator _validator;\n    private readonly IProcessor _processor;\n    private readonly ILogger _logger;\n\n    public bool RegisterAndProcess(Document d)   // ONE entry point\n    {\n        if (_validator.Validate(d).Any()) return false; // hidden step 1\n        _processor.Process(d);                          // hidden step 2\n        _logger.Log($\"processed {d.Id}\");               // hidden step 3\n        return true;\n    }\n}\n// Tell: caller writes one line; the manager hides the multi-step dance."
    },
    {
      "title": "Facade vs Adapter in one sentence of code",
      "lang": "csharp",
      "code": "// FACADE: simplifies a subsystem YOU own behind one easy method.\npublic class HomeTheaterFacade { public void WatchMovie() { /* dim, screen, amp, play */ } }\n\n// ADAPTER: makes a FOREIGN, fixed class fit an interface you already use.\npublic class StripeAdapter : IPaymentService\n{\n    private readonly StripeSdk _sdk;\n    public StripeAdapter(StripeSdk sdk) => _sdk = sdk;\n    public void Pay(decimal a) => _sdk.MakeCharge((int)(a * 100), \"USD\");\n}\n// Facade = simplify many; Adapter = translate one incompatible thing."
    }
  ],
  "dp-adapter": [
    {
      "title": "Recognise it: implements X, wraps a Y",
      "lang": "csharp",
      "code": "// The signature shape of every adapter:\n//   class SomethingAdapter : IExpectedByClient   <- implements the client's interface\n//   { private readonly ForeignType _adaptee;     <- holds the incompatible thing\n//     public void ClientMethod() => _adaptee.DifferentMethod(reshapedArgs); }\n//\n// Quick test: does the class implement an interface but mostly forward calls\n// to a field of an UNRELATED type after reshaping arguments? -> Adapter."
    },
    {
      "title": "Different domain: legacy logger to ILogger",
      "lang": "csharp",
      "code": "public interface ILogger { void Log(string message); }       // what the app expects\n\npublic class LegacyLogWriter                                  // adaptee: cannot edit\n{\n    public void WriteEntry(int severity, string text) { /* old API */ }\n}\n\npublic class LegacyLoggerAdapter : ILogger                    // the adapter\n{\n    private readonly LegacyLogWriter _legacy;\n    public LegacyLoggerAdapter(LegacyLogWriter legacy) => _legacy = legacy;\n    public void Log(string message) => _legacy.WriteEntry(0, message); // translate the call\n}\n// App depends on ILogger; the old writer slots in unchanged."
    }
  ],
  "dp-strategy": [
    {
      "title": "Recognise it: behaviour passed in, then called",
      "lang": "csharp",
      "code": "// Strategy tell: the context holds an interface field it did not construct,\n// and delegates the varying step to it.\npublic interface ISortStrategy { void Sort(int[] data); }\npublic class QuickSort  : ISortStrategy { public void Sort(int[] d) { /* quicksort */ } }\npublic class BubbleSort : ISortStrategy { public void Sort(int[] d) { /* bubble */ } }\n\npublic class Sorter\n{\n    private readonly ISortStrategy _strategy;\n    public Sorter(ISortStrategy strategy) => _strategy = strategy; // chosen from outside\n    public void Run(int[] data) => _strategy.Sort(data);          // delegated, swappable\n}"
    },
    {
      "title": "A delegate is a lightweight strategy",
      "lang": "csharp",
      "code": "// You do not always need an interface -- a Func is a one-method strategy.\npublic class PriceCalculator\n{\n    private readonly Func<decimal, decimal> _adjust;\n    public PriceCalculator(Func<decimal, decimal> adjust) => _adjust = adjust;\n    public decimal Final(decimal basePrice) => _adjust(basePrice);\n}\n\nvar holiday = new PriceCalculator(p => p * 0.8m);   // swap the algorithm by passing a lambda\nvar normal  = new PriceCalculator(p => p);\n// Same call site, interchangeable behaviour = Strategy."
    }
  ],
  "dp-command": [
    {
      "title": "Hand-rolled ICommand (when not using the toolkit)",
      "lang": "csharp",
      "code": "// If asked to implement ICommand by hand, this is the minimal shape:\npublic class RelayCommand : ICommand\n{\n    private readonly Action _execute;\n    private readonly Func<bool>? _canExecute;\n    public RelayCommand(Action execute, Func<bool>? canExecute = null)\n        { _execute = execute; _canExecute = canExecute; }\n\n    public bool CanExecute(object? p) => _canExecute?.Invoke() ?? true;\n    public void Execute(object? p) => _execute();\n    public event EventHandler? CanExecuteChanged;\n    public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);\n}"
    },
    {
      "title": "Invoker / receiver decoupling",
      "lang": "csharp",
      "code": "// The Button (invoker) only holds an ICommand; it never references the ViewModel.\nICommand save = new RelayCommand(() => Console.WriteLine(\"saved\"), () => true);\n\nif (save.CanExecute(null))   // 'may I?'\n    save.Execute(null);      // 'do it' -- invoker has no idea WHAT happens\n// That indirection is the whole pattern: requests become objects you can\n// pass around, enable/disable, queue, or rebind."
    }
  ],
  "dp-observer": [
    {
      "title": "Recognise it: subscribe then get pushed to",
      "lang": "csharp",
      "code": "// Observer tell: one object exposes a way to register reactions (+= / AddObserver),\n// and pushes updates when its state changes.\npublic class Thermostat\n{\n    private double _temp;\n    public event Action<double>? TemperatureChanged;   // subscription point\n    public double Temp\n    {\n        get => _temp;\n        set { _temp = value; TemperatureChanged?.Invoke(value); } // push on change\n    }\n}\n// Tell: a setter (or method) that fires an event/notifies a list = Subject."
    },
    {
      "title": "Two independent observers, one subject",
      "lang": "csharp",
      "code": "var thermostat = new Thermostat();\nthermostat.TemperatureChanged += t => Console.WriteLine($\"Display: {t} C\");   // observer 1\nthermostat.TemperatureChanged += t => { if (t > 25) Console.WriteLine(\"Fan ON\"); }; // observer 2\n\nthermostat.Temp = 27;   // both observers react, subject knows neither of them\n// Loose coupling: add/remove observers without touching the subject.\n// This is exactly what data binding does via INotifyPropertyChanged."
    }
  ],
  "dp-dependency-injection": [
    {
      "title": "Injecting a fake makes the unit test trivial",
      "lang": "csharp",
      "code": "public interface IClock { DateTime Now { get; } }\npublic class GreetingService\n{\n    private readonly IClock _clock;\n    public GreetingService(IClock clock) => _clock = clock;\n    public string Greet() => _clock.Now.Hour < 12 ? \"Good morning\" : \"Good afternoon\";\n}\n\n// Test: inject a stub clock instead of the real system time.\npublic class FixedClock : IClock { public DateTime Now => new(2026, 6, 13, 9, 0, 0); }\nvar svc = new GreetingService(new FixedClock());\n// svc.Greet() is deterministically \"Good morning\" -- DI made it testable."
    },
    {
      "title": "Composition root vs scattered 'new'",
      "lang": "csharp",
      "code": "// GOOD: every concrete is chosen in ONE place (the composition root).\nIClock clock = new SystemClock();\nINotifier notifier = new ConsoleNotifier();\nvar service = new GreetingService(clock);   // wired, not self-constructed\n\n// BAD: 'new SystemClock()' sprinkled inside GreetingService and OrderService.\n// Tell when reading code: count where concretes are 'new'-ed. If it is\n// only Program.cs / App.axaml.cs, DI is applied; if it is everywhere, it is not."
    }
  ],
  "av-project-structure": [
    {
      "title": "App.axaml.cs composition root (READ, never edit)",
      "lang": "csharp",
      "code": "public override void OnFrameworkInitializationCompleted()\n{\n    if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)\n    {\n        // build the VM here, then hand it to the window as DataContext\n        desktop.MainWindow = new MainWindow\n        {\n            DataContext = new MainWindowViewModel()\n        };\n    }\n    base.OnFrameworkInitializationCompleted();\n}"
    },
    {
      "title": "App.axaml — theme + ViewLocator wiring",
      "lang": "xml",
      "code": "<Application xmlns=\"https://github.com/avaloniaui\"\n             xmlns:x=\"http://schemas.microsoft.com/winfx/2006/xaml\"\n             xmlns:local=\"using:MyApp\"\n             x:Class=\"MyApp.App\">\n    <Application.DataTemplates>\n        <local:ViewLocator/>\n    </Application.DataTemplates>\n    <Application.Styles>\n        <FluentTheme/>\n    </Application.Styles>\n</Application>"
    }
  ],
  "av-xaml-basics": [
    {
      "title": "Attribute syntax vs property-element syntax",
      "lang": "xml",
      "code": "<!-- attribute syntax: a simple string value -->\n<TextBlock Text=\"Hello\" Foreground=\"Blue\"/>\n\n<!-- property-element syntax: when the value is too rich for a string -->\n<TextBlock Text=\"Gradient\">\n    <TextBlock.Foreground>\n        <LinearGradientBrush StartPoint=\"0,0\" EndPoint=\"1,0\">\n            <GradientStop Color=\"Red\"  Offset=\"0\"/>\n            <GradientStop Color=\"Blue\" Offset=\"1\"/>\n        </LinearGradientBrush>\n    </TextBlock.Foreground>\n</TextBlock>"
    },
    {
      "title": "x:Name lets other elements reference this one",
      "lang": "xml",
      "code": "<StackPanel>\n    <TextBox x:Name=\"NameBox\" Watermark=\"Type here\"/>\n    <!-- #NameBox.Text reads the live value of the box above -->\n    <TextBlock Text=\"{Binding #NameBox.Text}\"/>\n</StackPanel>"
    }
  ],
  "av-layout": [
    {
      "title": "WrapPanel: items flow and wrap at the edge",
      "lang": "xml",
      "code": "<WrapPanel Orientation=\"Horizontal\">\n    <Button Content=\"One\"   Width=\"100\" Margin=\"4\"/>\n    <Button Content=\"Two\"   Width=\"100\" Margin=\"4\"/>\n    <Button Content=\"Three\" Width=\"100\" Margin=\"4\"/>\n    <!-- when the row runs out of room, the next button drops down -->\n    <Button Content=\"Four\"  Width=\"100\" Margin=\"4\"/>\n</WrapPanel>"
    },
    {
      "title": "Alignment inside a stretching parent",
      "lang": "xml",
      "code": "<StackPanel>\n    <!-- without a Width, alignment decides how much room the button takes -->\n    <Button Content=\"Left\"    HorizontalAlignment=\"Left\"/>\n    <Button Content=\"Center\"  HorizontalAlignment=\"Center\"/>\n    <Button Content=\"Stretch\" HorizontalAlignment=\"Stretch\"/>\n</StackPanel>"
    }
  ],
  "av-grid": [
    {
      "title": "A login form: labels Auto, inputs star",
      "lang": "xml",
      "code": "<Grid RowDefinitions=\"Auto,Auto\" ColumnDefinitions=\"Auto,*\" Margin=\"12\">\n    <TextBlock Grid.Row=\"0\" Grid.Column=\"0\" Text=\"User:\" Margin=\"0,0,8,8\"/>\n    <TextBox   Grid.Row=\"0\" Grid.Column=\"1\" Text=\"{Binding User}\" Margin=\"0,0,0,8\"/>\n    <TextBlock Grid.Row=\"1\" Grid.Column=\"0\" Text=\"Pass:\" Margin=\"0,0,8,0\"/>\n    <TextBox   Grid.Row=\"1\" Grid.Column=\"1\" Text=\"{Binding Pass}\"/>\n</Grid>"
    },
    {
      "title": "Centering one control with a 3x3 star grid",
      "lang": "xml",
      "code": "<!-- the middle cell holds the content; the * rows/cols pad around it -->\n<Grid RowDefinitions=\"*,Auto,*\" ColumnDefinitions=\"*,Auto,*\">\n    <Button Grid.Row=\"1\" Grid.Column=\"1\" Content=\"Dead centre\"/>\n</Grid>"
    }
  ],
  "av-controls": [
    {
      "title": "Reading a CheckBox (bool?) safely in the VM",
      "lang": "csharp",
      "code": "[ObservableProperty]\nprivate bool? _isFancy;   // CheckBox.IsChecked is bool?, not bool\n\n[RelayCommand]\nprivate void Confirm()\n{\n    // collapse the third (null/indeterminate) state to false\n    bool fancy = IsFancy ?? false;\n    Result = fancy ? \"Fancy mode\" : \"Plain mode\";\n}"
    },
    {
      "title": "ComboBox with inline items + SelectedIndex",
      "lang": "xml",
      "code": "<ComboBox SelectedIndex=\"0\" SelectedItem=\"{Binding ChosenSize}\">\n    <ComboBoxItem Content=\"Small\"/>\n    <ComboBoxItem Content=\"Medium\"/>\n    <ComboBoxItem Content=\"Large\"/>\n</ComboBox>"
    }
  ],
  "av-events-codebehind": [
    {
      "title": "x:Name + typed handler args in the .axaml.cs",
      "lang": "csharp",
      "code": "// Views/MainWindow.axaml.cs\npublic partial class MainWindow : Window\n{\n    public MainWindow() => InitializeComponent();\n\n    // GreetButton was given x:Name=\"GreetButton\" in the AXAML\n    private void GreetButton_Click(object? sender, RoutedEventArgs e)\n    {\n        // GreetButton and OutputBlock are auto-generated fields\n        OutputBlock.Text = \"Hello, \" + InputBox.Text;\n    }\n}"
    },
    {
      "title": "The AXAML that pairs with it",
      "lang": "xml",
      "code": "<StackPanel Margin=\"10\" Spacing=\"6\">\n    <TextBox x:Name=\"InputBox\" Watermark=\"Your name\"/>\n    <Button  x:Name=\"GreetButton\" Content=\"Greet\" Click=\"GreetButton_Click\"/>\n    <TextBlock x:Name=\"OutputBlock\"/>\n</StackPanel>"
    }
  ],
  "av-styling": [
    {
      "title": "Toggle a class from C# to restyle at runtime",
      "lang": "csharp",
      "code": "// add/remove a style class on a named control (code-behind)\nprivate void Highlight_Click(object? sender, RoutedEventArgs e)\n{\n    if (Title.Classes.Contains(\"highlight\"))\n        Title.Classes.Remove(\"highlight\");\n    else\n        Title.Classes.Add(\"highlight\");\n}"
    },
    {
      "title": "Descendant vs direct-child selectors",
      "lang": "xml",
      "code": "<Window.Styles>\n    <!-- any Button anywhere inside a StackPanel (descendant) -->\n    <Style Selector=\"StackPanel Button\">\n        <Setter Property=\"Margin\" Value=\"4\"/>\n    </Style>\n    <!-- only Buttons that are DIRECT children of a Grid -->\n    <Style Selector=\"Grid > Button\">\n        <Setter Property=\"FontWeight\" Value=\"Bold\"/>\n    </Style>\n</Window.Styles>"
    }
  ],
  "av-animations": [
    {
      "title": "Hover-grow a button (the pointerover recipe)",
      "lang": "xml",
      "code": "<Style Selector=\"Button\">\n    <Setter Property=\"RenderTransform\" Value=\"scale(1)\"/>\n    <Setter Property=\"Transitions\">\n        <Transitions>\n            <TransformOperationsTransition Property=\"RenderTransform\" Duration=\"0:0:0.2\"/>\n        </Transitions>\n    </Setter>\n</Style>\n<!-- when hovered, grow; the transition animates the change -->\n<Style Selector=\"Button:pointerover\">\n    <Setter Property=\"RenderTransform\" Value=\"scale(1.1)\"/>\n</Style>"
    },
    {
      "title": "Animate a colour with BrushTransition",
      "lang": "xml",
      "code": "<Style Selector=\"Border.card\">\n    <Setter Property=\"Background\" Value=\"LightGray\"/>\n    <Setter Property=\"Transitions\">\n        <Transitions>\n            <BrushTransition Property=\"Background\" Duration=\"0:0:0.3\"/>\n        </Transitions>\n    </Setter>\n    <Style Selector=\"^:pointerover\">\n        <Setter Property=\"Background\" Value=\"LightSkyBlue\"/>\n    </Style>\n</Style>"
    }
  ],
  "av-itemscontrols": [
    {
      "title": "The ObservableCollection the list binds to",
      "lang": "csharp",
      "code": "// adding/removing items updates the UI automatically\npublic ObservableCollection<Contact> Contacts { get; } = new();\n\n[RelayCommand]\nprivate void AddContact()\n{\n    Contacts.Add(new Contact { Name = NewContactName });\n    NewContactName = \"\";   // clear the input box (TwoWay binding pushes it back)\n}"
    },
    {
      "title": "ItemsControl with a horizontal panel",
      "lang": "xml",
      "code": "<ItemsControl ItemsSource=\"{Binding Tags}\">\n    <ItemsControl.ItemsPanel>\n        <ItemsPanelTemplate>\n            <StackPanel Orientation=\"Horizontal\" Spacing=\"6\"/>\n        </ItemsPanelTemplate>\n    </ItemsControl.ItemsPanel>\n    <ItemsControl.ItemTemplate>\n        <DataTemplate>\n            <Border Background=\"LightGray\" CornerRadius=\"4\" Padding=\"6,2\">\n                <TextBlock Text=\"{Binding}\"/>\n            </Border>\n        </DataTemplate>\n    </ItemsControl.ItemTemplate>\n</ItemsControl>"
    }
  ],
  "av-file-dialogs": [
    {
      "title": "Filter the picker to one file type",
      "lang": "csharp",
      "code": "var files = await topLevel.StorageProvider.OpenFilePickerAsync(new FilePickerOpenOptions\n{\n    Title = \"Open Text File\",\n    AllowMultiple = false,\n    FileTypeFilter = new[]\n    {\n        new FilePickerFileType(\"Text files\") { Patterns = new[] { \"*.txt\" } }\n    }\n});"
    },
    {
      "title": "Suggest a name + extension when saving",
      "lang": "csharp",
      "code": "var file = await topLevel.StorageProvider.SaveFilePickerAsync(new FilePickerSaveOptions\n{\n    Title = \"Save Text File\",\n    SuggestedFileName = \"notes\",\n    DefaultExtension = \"txt\"\n});\nif (file is not null)\n{\n    await using var stream = await file.OpenWriteAsync();\n    using var writer = new StreamWriter(stream);\n    await writer.WriteAsync(Content);\n}"
    }
  ],
  "av-multiview": [
    {
      "title": "DataTemplates that pick a View per ViewModel (no ViewLocator)",
      "lang": "xml",
      "code": "<!-- MainWindow.axaml: explicit alternative to the ViewLocator -->\n<ContentControl Content=\"{Binding CurrentView}\">\n    <ContentControl.DataTemplates>\n        <DataTemplate DataType=\"vm:FirstViewModel\">\n            <views:FirstView/>\n        </DataTemplate>\n        <DataTemplate DataType=\"vm:SecondViewModel\">\n            <views:SecondView/>\n        </DataTemplate>\n    </ContentControl.DataTemplates>\n</ContentControl>"
    },
    {
      "title": "A reusable UserControl with its own VM",
      "lang": "csharp",
      "code": "public partial class FirstViewModel : ViewModelBase\n{\n    [ObservableProperty]\n    private string _text = \"I am the first page\";\n}\n// the matching FirstView.axaml has x:DataType=\"vm:FirstViewModel\";\n// ViewLocator (FooViewModel -> FooView) instantiates the View for you."
    }
  ],
  "mv-mvc-vs-mvvm": [
    {
      "title": "Same feature, MVC-style code-behind (the anti-pattern)",
      "lang": "csharp",
      "code": "// Controller/code-behind talks to controls directly -- this is what MVVM removes.\nprivate int _count;\n\nprivate void OnPlusClick(object? sender, RoutedEventArgs e)\n{\n    _count++;\n    CountTextBlock.Text = _count.ToString();   // View knows the data; data knows the View\n    MinusButton.IsEnabled = _count > 0;         // logic lives in the View layer\n}"
    },
    {
      "title": "Same feature, MVVM-style (View has no logic)",
      "lang": "csharp",
      "code": "// The ViewModel holds the state; the View only binds. No control names, no events.\npublic partial class CounterViewModel : ObservableObject\n{\n    [ObservableProperty]\n    private int _count;            // generates Count + PropertyChanged\n\n    [RelayCommand]\n    private void Increment() => Count++;   // View binds IncrementCommand\n}"
    }
  ],
  "mv-inotify": [
    {
      "title": "Wiring a manual-INPC object so the View actually updates",
      "lang": "csharp",
      "code": "// The class above must be the DataContext (or reachable from it) so the\n// binding system can subscribe to PropertyChanged.\nvar stock = new Stock { Price = 10.0 };\ndesktop.MainWindow = new MainWindow { DataContext = stock };\n\n// Later, anywhere in code:\nstock.Price = 12.5;   // setter raises PropertyChanged -> bound TextBlock refreshes"
    },
    {
      "title": "AXAML that consumes the manual-INPC property",
      "lang": "xml",
      "code": "<!-- Identical binding syntax whether INPC is manual or toolkit-generated. -->\n<StackPanel>\n  <TextBlock Text=\"{Binding Price}\"/>\n  <TextBox   Text=\"{Binding Price, Mode=TwoWay}\"/>\n</StackPanel>"
    },
    {
      "title": "Notify several properties from one setter",
      "lang": "csharp",
      "code": "private double _price;\npublic double Price\n{\n    get => _price;\n    set\n    {\n        if (_price == value) return;\n        _price = value;\n        OnPropertyChanged(nameof(Price));\n        OnPropertyChanged(nameof(PriceWithVat));   // derived value also refreshes\n    }\n}\npublic double PriceWithVat => _price * 1.25;"
    }
  ],
  "mv-toolkit-observableproperty": [
    {
      "title": "Use the generated property, never the field",
      "lang": "csharp",
      "code": "[ObservableProperty]\nprivate int _count;\n\n[RelayCommand]\nprivate void Add()\n{\n    Count = Count + 1;   // CORRECT: assigning the property raises PropertyChanged\n    // _count = _count + 1;   WRONG: writes the field, UI never updates\n}"
    },
    {
      "title": "Read a generated property in the matching AXAML",
      "lang": "xml",
      "code": "<!-- field _count -> generated property Count -> bind to \"Count\" -->\n<StackPanel Spacing=\"6\">\n  <TextBlock Text=\"{Binding Count}\"/>\n  <!-- a derived property kept fresh via NotifyPropertyChangedFor -->\n  <TextBlock Text=\"{Binding FullName}\"/>\n  <!-- two-way edit of the same backing property -->\n  <TextBox Text=\"{Binding Count, Mode=TwoWay}\"/>\n</StackPanel>"
    },
    {
      "title": "OnXxxChanging vs OnXxxChanged hooks",
      "lang": "csharp",
      "code": "[ObservableProperty]\nprivate int _count;\n\n// runs BEFORE the field is written (oldValue still in place):\npartial void OnCountChanging(int value) { /* validate / veto-prep here */ }\n\n// runs AFTER the field is written and PropertyChanged fired:\npartial void OnCountChanged(int value) { /* react: refresh commands, etc. */ }"
    }
  ],
  "mv-relaycommand": [
    {
      "title": "Command with a parameter (Delete the clicked item)",
      "lang": "csharp",
      "code": "[RelayCommand]\nprivate void Remove(Contact contact)   // generates RemoveCommand\n{\n    Contacts.Remove(contact);\n}"
    },
    {
      "title": "Pass the parameter from AXAML",
      "lang": "xml",
      "code": "<!-- CommandParameter feeds the method's argument -->\n<Button Content=\"Delete\"\n        Command=\"{Binding RemoveCommand}\"\n        CommandParameter=\"{Binding SelectedContact}\"/>\n\n<!-- inside an item template, pass the item itself -->\n<Button Content=\"X\"\n        Command=\"{Binding $parent[ListBox].DataContext.RemoveCommand}\"\n        CommandParameter=\"{Binding}\"/>"
    },
    {
      "title": "CanExecute driven by a field attribute (one-liner)",
      "lang": "csharp",
      "code": "[ObservableProperty]\n[NotifyCanExecuteChangedFor(nameof(SaveCommand))]   // re-checks CanSave when Name changes\nprivate string? _name;\n\n[RelayCommand(CanExecute = nameof(CanSave))]\nprivate void Save() { /* ... */ }\n\nprivate bool CanSave() => !string.IsNullOrWhiteSpace(Name);"
    }
  ],
  "mv-binding-cookbook": [
    {
      "title": "Fallback, string format, and converters",
      "lang": "xml",
      "code": "<!-- shown when the binding source is null -->\n<TextBlock Text=\"{Binding SelectedContact.Name, FallbackValue=No selection}\"/>\n\n<!-- format a number/date inline (StringFormat) -->\n<TextBlock Text=\"{Binding Price, StringFormat='Price: {0:C}'}\"/>\n\n<!-- built-in bool inverter from Avalonia -->\n<ProgressBar IsVisible=\"{Binding !IsLoaded}\"/>"
    },
    {
      "title": "TwoWay binding round-trip in the ViewModel",
      "lang": "csharp",
      "code": "// TextBox Text=\"{Binding NewName, Mode=TwoWay}\" pushes keystrokes into the VM.\n[ObservableProperty]\nprivate string? _newName;\n\n// React the moment the user types (after each accepted change):\npartial void OnNewNameChanged(string? value)\n{\n    AddCommand.NotifyCanExecuteChanged();   // e.g. enable Add once non-empty\n}"
    }
  ],
  "mv-observablecollection": [
    {
      "title": "Add / remove visibly updates the bound ListBox",
      "lang": "csharp",
      "code": "public ObservableCollection<string> Items { get; } = new();\n\n[RelayCommand]\nprivate void AddItem() => Items.Add(\"Item \" + (Items.Count + 1));\n\n[RelayCommand]\nprivate void RemoveLast()\n{\n    if (Items.Count > 0) Items.RemoveAt(Items.Count - 1);\n}"
    },
    {
      "title": "AXAML bound to the collection",
      "lang": "xml",
      "code": "<StackPanel Spacing=\"6\">\n  <ListBox ItemsSource=\"{Binding Items}\"\n           SelectedItem=\"{Binding Selected}\"/>\n  <Button Content=\"Add\"  Command=\"{Binding AddItemCommand}\"/>\n  <Button Content=\"Drop\" Command=\"{Binding RemoveLastCommand}\"/>\n</StackPanel>"
    },
    {
      "title": "Seed initial items in the constructor",
      "lang": "csharp",
      "code": "public ObservableCollection<string> Items { get; }\n\npublic MainWindowViewModel()\n{\n    // collection initializer fills the get-only property\n    Items = new ObservableCollection<string> { \"Apple\", \"Pear\" };\n}"
    }
  ],
  "mv-datacontext": [
    {
      "title": "Setting DataContext in the View's code-behind",
      "lang": "csharp",
      "code": "// Views/MainWindow.axaml.cs -- valid alternative to wiring it in App.axaml.cs.\npublic partial class MainWindow : Window\n{\n    public MainWindow()\n    {\n        InitializeComponent();\n        DataContext = new MainWindowViewModel();   // bindings now resolve here\n    }\n}"
    },
    {
      "title": "Declaring the type so compiled bindings work",
      "lang": "xml",
      "code": "<!-- x:DataType tells the binding compiler what DataContext is. -->\n<Window xmlns=\"https://github.com/avaloniaui\"\n        xmlns:x=\"http://schemas.microsoft.com/winfx/2006/xaml\"\n        xmlns:vm=\"using:MyApp.ViewModels\"\n        x:Class=\"MyApp.Views.MainWindow\"\n        x:DataType=\"vm:MainWindowViewModel\">\n    <TextBlock Text=\"{Binding Greeting}\"/>\n</Window>"
    }
  ],
  "mv-contactlist-full": [
    {
      "title": "Headless unit test against the ViewModel (no window)",
      "lang": "csharp",
      "code": "// Logic is testable because it lives in the VM, not the View.\nvar repo = new JSONContactRepository();\nvar vm = new MainWindowViewModel(repo);\n\nvm.NewContactName = \"Ada\";\nvm.NewContactEmail = \"ada@dev.com\";\nvm.AddContact();\n\nAssert.Equal(1, vm.Contacts.Count);\nAssert.Equal(\"Ada\", vm.Contacts[0].Name);"
    },
    {
      "title": "Same VM, by-the-book [RelayCommand] variant",
      "lang": "csharp",
      "code": "// Swap plain methods for commands; bind AddContactCommand instead of AddContact.\nusing CommunityToolkit.Mvvm.Input;\n\n[RelayCommand]\nprivate void AddContact()\n{\n    if (string.IsNullOrWhiteSpace(NewContactName)) return;\n    Contacts.Add(new Contact { Name = NewContactName!, Email = NewContactEmail! });\n    NewContactName = NewContactEmail = null;\n}\n\n[RelayCommand]\nprivate void DeleteContact()\n{\n    if (SelectedContact is not null) Contacts.Remove(SelectedContact);\n}"
    }
  ],
  "mv-mvvm-rules": [
    {
      "title": "Violation vs fix: reacting to a button",
      "lang": "csharp",
      "code": "// VIOLATION -- logic in code-behind, touches controls:\nprivate void Save_Click(object? s, RoutedEventArgs e)\n{\n    StatusText.Text = \"Saved\";   // ViewModel responsibility leaked into the View\n}\n\n// FIX -- command on the ViewModel; View only binds Command=\"{Binding SaveCommand}\":\n[RelayCommand]\nprivate void Save() => Status = \"Saved\";"
    },
    {
      "title": "Model stays a POCO (no framework using-directives)",
      "lang": "csharp",
      "code": "namespace MyApp.Models;\n\n// No Avalonia, no CommunityToolkit -- plain .NET so it is reusable and testable.\npublic class Contact\n{\n    public string Name { get; set; } = string.Empty;\n    public string Email { get; set; } = string.Empty;\n}"
    }
  ],
  "col-overview": [
    {
      "title": "Pick by access pattern (one line each)",
      "lang": "csharp",
      "code": "var byIndex = new List<int> { 10, 20, 30 };   // need numbers[i]? List\nvar byKey   = new Dictionary<string,int>();     // need lookup by name? Dictionary\nvar unique  = new HashSet<string>();            // need 'seen it already?' fast? HashSet\nvar fifo    = new Queue<string>();              // process oldest first? Queue\nvar lifo    = new Stack<string>();              // process newest first? Stack\n\nbyIndex.Add(40);\nbyKey[\"Alice\"] = 25;\nbool isNew = unique.Add(\"a\");   // => true\nfifo.Enqueue(\"job1\");\nlifo.Push(\"page1\");\nConsole.WriteLine(byIndex[3]);  // => 40"
    },
    {
      "title": "Common members they all share",
      "lang": "csharp",
      "code": "// Every generic collection has Count and is foreach-able:\nvar nums = new List<int> { 3, 1, 2 };\nConsole.WriteLine(nums.Count);          // => 3\nforeach (int n in nums) Console.Write(n + \" \");   // => 3 1 2\n\n// Most expose Contains and Clear:\nConsole.WriteLine(nums.Contains(2));    // => true\nnums.Clear();\nConsole.WriteLine(nums.Count);          // => 0"
    }
  ],
  "col-list-array": [
    {
      "title": "List<T> method results, step by step",
      "lang": "csharp",
      "code": "var list = new List<int> { 5, 3, 9, 1 };\nlist.Add(7);                 // => [5, 3, 9, 1, 7]\nlist.Insert(0, 8);           // => [8, 5, 3, 9, 1, 7]\nlist.Remove(9);              // remove first 9 => [8, 5, 3, 1, 7]\nlist.RemoveAt(0);            // remove index 0 => [5, 3, 1, 7]\nConsole.WriteLine(list.Count);          // => 4\nConsole.WriteLine(list.Contains(3));    // => true\nConsole.WriteLine(list.IndexOf(1));     // => 2\nint odd = list.Find(x => x > 4);        // => 5  (first match)\nlist.Sort();                 // => [1, 3, 5, 7]\nlist.Reverse();              // => [7, 5, 3, 1]\nforeach (int x in list) Console.Write(x + \" \");   // => 7 5 3 1"
    },
    {
      "title": "Array: fixed size, useful members",
      "lang": "csharp",
      "code": "int[] arr = { 5, 3, 9, 1 };\nConsole.WriteLine(arr.Length);          // => 4  (Length, not Count)\nArray.Sort(arr);                        // arr => [1, 3, 5, 9]\nArray.Reverse(arr);                     // arr => [9, 5, 3, 1]\nint i = Array.IndexOf(arr, 5);          // => 2\n// arr[4] = 7;  // throws IndexOutOfRangeException -- size is fixed\nList<int> grow = arr.ToList();          // switch to List when size must change\ngrow.Add(7);                            // now resizable => [9, 5, 3, 1, 7]"
    }
  ],
  "col-dictionary": [
    {
      "title": "Keys, Values and the safe-add helpers",
      "lang": "csharp",
      "code": "var stock = new Dictionary<string,int> { [\"pen\"] = 3, [\"ink\"] = 5 };\nforeach (string k in stock.Keys)   Console.Write(k + \" \");    // => pen ink\nforeach (int v in stock.Values)    Console.Write(v + \" \");    // => 3 5\n\nbool added = stock.TryAdd(\"pen\", 99);   // => false (key exists, value untouched)\nConsole.WriteLine(stock[\"pen\"]);        // => 3\nstock.TryAdd(\"pad\", 2);                 // => true (new key added)\nConsole.WriteLine(stock.Count);         // => 3"
    },
    {
      "title": "TryGetValue vs indexer (avoid the throw)",
      "lang": "csharp",
      "code": "var ages = new Dictionary<string,int> { [\"Bob\"] = 30 };\n\n// indexer on a missing key THROWS:\n// int x = ages[\"Ann\"];   // KeyNotFoundException\n\n// TryGetValue never throws -- returns bool, sets out param:\nif (ages.TryGetValue(\"Ann\", out int age))\n    Console.WriteLine(age);\nelse\n    Console.WriteLine(\"missing\");       // => missing\n\nbool here = ages.ContainsKey(\"Bob\");    // => true\nages.Remove(\"Bob\");                     // => true (was present)"
    }
  ],
  "col-hashset": [
    {
      "title": "Add returns bool; the dedup signal",
      "lang": "csharp",
      "code": "var seen = new HashSet<string>();\nConsole.WriteLine(seen.Add(\"apple\"));   // => true  (newly inserted)\nConsole.WriteLine(seen.Add(\"apple\"));   // => false (already present, ignored)\nConsole.WriteLine(seen.Count);          // => 1\nConsole.WriteLine(seen.Contains(\"apple\")); // => true\n\n// classic use: first-occurrence filter while looping\nvar firstTimes = new List<string>();\nforeach (var w in new[] { \"a\", \"b\", \"a\", \"c\", \"b\" })\n    if (seen.Add(w)) firstTimes.Add(w);\n// firstTimes => [b, c]   (a already seen above)"
    },
    {
      "title": "SortedSet keeps order; non-mutating set checks",
      "lang": "csharp",
      "code": "var sorted = new SortedSet<int> { 5, 1, 3, 1 };\nforeach (int n in sorted) Console.Write(n + \" \");   // => 1 3 5 (sorted, deduped)\nConsole.WriteLine(sorted.Min + \" \" + sorted.Max);    // => 1 5\n\nvar a = new HashSet<int> { 1, 2, 3 };\nvar b = new HashSet<int> { 2, 3, 4 };\n// these only TEST, they do not modify a:\nConsole.WriteLine(a.Overlaps(b));      // => true\nConsole.WriteLine(a.IsSubsetOf(b));    // => false"
    }
  ],
  "col-queue-stack": [
    {
      "title": "Peek does not remove; watch Count change",
      "lang": "csharp",
      "code": "var q = new Queue<string>();\nq.Enqueue(\"a\"); q.Enqueue(\"b\"); q.Enqueue(\"c\");\nConsole.WriteLine(q.Peek());   // => a  (front, NOT removed)\nConsole.WriteLine(q.Count);    // => 3\nConsole.WriteLine(q.Dequeue()); // => a  (removed)\nConsole.WriteLine(q.Dequeue()); // => b\nConsole.WriteLine(q.Count);    // => 1\n\nvar s = new Stack<int>();\ns.Push(1); s.Push(2); s.Push(3);\nConsole.WriteLine(s.Peek());   // => 3  (top, NOT removed)\nConsole.WriteLine(s.Pop());    // => 3\nConsole.WriteLine(s.Pop());    // => 2  (LIFO)"
    },
    {
      "title": "Safe TryDequeue / TryPop on empties",
      "lang": "csharp",
      "code": "var q = new Queue<int>();\nbool got = q.TryDequeue(out int front);  // => false, front = 0 (no throw)\n// q.Dequeue();  // would throw InvalidOperationException on empty\n\nvar list = new LinkedList<int>();\nlist.AddLast(2);\nlist.AddFirst(1);              // list => 1, 2\nlist.AddLast(3);               // list => 1, 2, 3\nConsole.WriteLine(list.First.Value);  // => 1\nConsole.WriteLine(list.Last.Value);   // => 3\nlist.RemoveFirst();            // list => 2, 3"
    }
  ],
  "col-interfaces-hierarchy": [
    {
      "title": "Same object, widening the static type",
      "lang": "csharp",
      "code": "List<int> concrete = new List<int> { 1, 2, 3 };\n\nIList<int>       asList = concrete;   // has indexer + Insert/RemoveAt\nICollection<int> asColl = concrete;   // has Add/Remove/Count/Contains\nIEnumerable<int> asEnum = concrete;   // foreach only\n\nasList.Insert(0, 0);                  // ok: IList exposes Insert\nasColl.Add(4);                        // ok: ICollection exposes Add\n// asEnum.Add(5);                     // compile error: IEnumerable has no Add\nConsole.WriteLine(asColl.Count);      // => 5"
    },
    {
      "title": "Accept the loosest interface a method needs",
      "lang": "csharp",
      "code": "// Takes ANY sequence -- List, array, HashSet, a yield method, a LINQ query:\nstatic int CountEvens(IEnumerable<int> items)\n{\n    int n = 0;\n    foreach (int x in items) if (x % 2 == 0) n++;\n    return n;\n}\n\nConsole.WriteLine(CountEvens(new[] { 1, 2, 3, 4 }));        // => 2\nConsole.WriteLine(CountEvens(new HashSet<int> { 2, 4, 6 })); // => 3"
    }
  ],
  "col-generics-2": [
    {
      "title": "A tiny generic stack you write yourself",
      "lang": "csharp",
      "code": "public class Box<T>\n{\n    private readonly List<T> _items = new();\n    public void Push(T item) => _items.Add(item);\n    public T Pop()\n    {\n        T last = _items[^1];     // index from end\n        _items.RemoveAt(_items.Count - 1);\n        return last;\n    }\n    public int Count => _items.Count;\n}\n\nvar box = new Box<string>();\nbox.Push(\"a\"); box.Push(\"b\");\nConsole.WriteLine(box.Pop());    // => b\nConsole.WriteLine(box.Count);    // => 1"
    },
    {
      "title": "Constrained generic method (reusable across types)",
      "lang": "csharp",
      "code": "// where T : IComparable<T> lets us compare any orderable type\nstatic T Max<T>(T a, T b) where T : IComparable<T> =>\n    a.CompareTo(b) >= 0 ? a : b;\n\nConsole.WriteLine(Max(3, 9));          // => 9     (int)\nConsole.WriteLine(Max(\"apple\", \"pear\")); // => pear  (string, alphabetical)\nConsole.WriteLine(Max(2.5, 1.1));      // => 2.5   (double)"
    }
  ],
  "lq-two-syntaxes": [
    {
      "title": "Same exam query in both syntaxes (currently travelling ships)",
      "lang": "csharp",
      "code": "// 'currently travelling' = ArrivalDate is null. Both forms compile to the same thing.\n\n// Method chaining (what the exams use):\nvar travellingM = ships.Where(s => s.ArrivalDate == null).ToList();\n\n// Query syntax (you must be able to read it):\nvar travellingQ = (from s in ships\n                   where s.ArrivalDate == null\n                   select s).ToList();\n\ntravellingM.Count == travellingQ.Count;   // => True (identical results)"
    },
    {
      "title": "Multi-clause query: where + orderby + select",
      "lang": "csharp",
      "code": "// Query syntax can chain where/orderby/select and project at the end:\nvar names = from r in recipes\n            where r.Ingredients.Count > 3\n            orderby r.Ingredients.Count descending\n            select r.Name;\n\n// The exact method-chain equivalent:\nvar namesM = recipes\n    .Where(r => r.Ingredients.Count > 3)\n    .OrderByDescending(r => r.Ingredients.Count)\n    .Select(r => r.Name);"
    }
  ],
  "lq-filtering-projection": [
    {
      "title": "Where with a compound predicate, then Select a field",
      "lang": "csharp",
      "code": "var nums = new List<int> { 1, 2, 3, 4, 5, 6 };\nnums.Where(n => n > 2 && n % 2 == 0).ToList();   // => [4, 6]\n\n// Filter ships, then project just the names out:\nvar bigCrewNames = ships\n    .Where(s => s.Crew >= 5)\n    .Select(s => s.Name)\n    .ToList();                                   // => list of string"
    },
    {
      "title": "Where over a nested list + Select into an anonymous type",
      "lang": "csharp",
      "code": "// Recipes that have NO dietary tags (empty-list filter):\nvar plain = recipes.Where(r => r.DietaryTags.Count == 0).ToList();\n\n// Project two fields + a computed one into an anonymous type:\nvar overview = recipes.Select(r => new\n{\n    r.Name,\n    IngredientCount = r.Ingredients.Count,\n    IsVegetarian    = r.DietaryTags.Contains(\"Vegetarian\")\n});\n// each item: { Name, IngredientCount, IsVegetarian }"
    }
  ],
  "lq-sorting": [
    {
      "title": "OrderByDescending then ThenBy as a tie-breaker",
      "lang": "csharp",
      "code": "// Most trips first; ships with equal trip counts fall back to name A->Z:\nvar ranked = ships\n    .OrderByDescending(s => s.TravelHistory?.Count ?? 0)\n    .ThenBy(s => s.Name)\n    .ToList();\n\nnew[] { 3, 1, 2 }.OrderBy(n => n).ToList();              // => [1, 2, 3]\nnew[] { 3, 1, 2 }.OrderByDescending(n => n).ToList();   // => [3, 2, 1]"
    },
    {
      "title": "OrderBy does NOT mutate; List.Sort() does",
      "lang": "csharp",
      "code": "var nums = new List<int> { 3, 1, 2 };\n\nvar sorted = nums.OrderBy(n => n).ToList();   // => [1, 2, 3] (new sequence)\nnums;                                         // => [3, 1, 2] (source untouched)\n\nnums.Sort();                                  // in-place, needs IComparable\nnums;                                         // => [1, 2, 3] (source now changed)"
    }
  ],
  "lq-grouping-aggregation": [
    {
      "title": "GroupBy a field, then Count per group (most common first)",
      "lang": "csharp",
      "code": "// How many ships of each Type, biggest group first:\nvar byType = ships\n    .GroupBy(s => s.Type)\n    .Select(g => new { Type = g.Key, Count = g.Count() })\n    .OrderByDescending(x => x.Count)\n    .ToList();\n// e.g. { Type = \"Frigate\", Count = 4 }, { Type = \"Hauler\", Count = 2 }"
    },
    {
      "title": "Average per group + Sum/Min/Max in one projection",
      "lang": "csharp",
      "code": "// Average trip count per ship type (nulls excluded via ?? 0):\nvar avgTrips = ships\n    .GroupBy(s => s.Type)\n    .Select(g => new\n    {\n        Type = g.Key,\n        Avg  = g.Average(s => s.TravelHistory?.Count ?? 0),\n        Min  = g.Min(s => s.Crew),\n        Max  = g.Max(s => s.Crew),\n        Total = g.Sum(s => s.Crew)\n    });\n// one row per Type with Avg / Min / Max / Total"
    },
    {
      "title": "Above-average filter (compute the average FIRST)",
      "lang": "csharp",
      "code": "// Recipes with more ingredients than the average recipe:\nvar avg = recipes.Average(r => r.Ingredients.Count);   // a single double\nvar aboveAvg = recipes\n    .Where(r => r.Ingredients.Count > avg)\n    .ToList();\n// Do NOT call Average inside Where -- compute it once, then compare."
    }
  ],
  "lq-join": [
    {
      "title": "Join keepers (lighthouses) to their keepers' visits",
      "lang": "csharp",
      "code": "// outer.Join(inner, outerKey, innerKey, resultSelector)\nvar report = lighthouses.Join(visits,\n    lh    => lh.Id,                 // key from OUTER (lighthouses)\n    visit => visit.LighthouseId,    // key from INNER (visits)\n    (lh, visit) => new              // combine both sides\n    {\n        lh.Name,\n        visit.Date,\n        visit.Inspector\n    });\nforeach (var row in report)\n    Console.WriteLine($\"{row.Name}: {row.Inspector} on {row.Date:d}\");"
    },
    {
      "title": "GroupJoin for a one-to-many roll-up (count children per parent)",
      "lang": "csharp",
      "code": "// Each lighthouse with the number of visits it received (0 if none):\nvar withCounts = lighthouses.GroupJoin(visits,\n    lh    => lh.Id,\n    visit => visit.LighthouseId,\n    (lh, group) => new { lh.Name, Visits = group.Count() });\n// { Name = \"North Point\", Visits = 3 }, { Name = \"East Rock\", Visits = 0 }"
    }
  ],
  "lq-first-single-take": [
    {
      "title": "First vs FirstOrDefault vs Single (matching by name)",
      "lang": "csharp",
      "code": "var nums = new List<int> { 1, 2, 3, 4 };\nnums.First();                              // => 1\nnums.First(n => n > 2);                    // => 3\nnums.FirstOrDefault(n => n > 99);          // => 0   (no match, no throw)\n\nships.Single(s => s.Name == \"Nostromo\");   // exactly one, else throws\nships.SingleOrDefault(s => s.Name == \"\");  // => null if zero matches"
    },
    {
      "title": "Any / All / Contains as boolean exam answers",
      "lang": "csharp",
      "code": "ships.Any();                                   // => True  (non-empty?)\nships.Any(s => s.ArrivalDate == null);         // => True  (any travelling?)\nrecipes.All(r => r.Ingredients.Count > 0);     // => do ALL have ingredients?\nrecipe.DietaryTags.Contains(\"Vegetarian\");     // => membership test\n\n// 'departed port X in year Y' uses Any over the nested trip list:\nships.Where(s => (s.TravelHistory ?? new()).Any(\n    t => t.DeparturePort == \"Mars\" && t.Date?.Year == 2245));"
    },
    {
      "title": "Take / Skip / Distinct for slicing and de-duping",
      "lang": "csharp",
      "code": "var nums = new List<int> { 5, 5, 3, 1, 1, 2 };\nnums.Take(3).ToList();                 // => [5, 5, 3]\nnums.Skip(2).ToList();                 // => [3, 1, 1, 2]\nnums.Distinct().ToList();              // => [5, 3, 1, 2]\n\n// Top 3 busiest ships:\nships.OrderByDescending(s => s.TravelHistory?.Count ?? 0)\n     .Take(3).ToList();"
    }
  ],
  "lq-lazy-evaluation": [
    {
      "title": "Deferred query re-runs every time you iterate it",
      "lang": "csharp",
      "code": "var nums = new List<int> { 1, 2, 3 };\nvar evens = nums.Where(n => n % 2 == 0);   // nothing has run yet\n\nnums.Add(4);                               // mutate the SOURCE after defining\n\nevens.ToList();                            // => [2, 4]  (sees the new 4!)\n// The query re-reads 'nums' on each enumeration -- it is not a snapshot."
    },
    {
      "title": "ToList() snapshots once; Count() forces execution",
      "lang": "csharp",
      "code": "var nums = new List<int> { 1, 2, 3 };\nvar snapshot = nums.Where(n => n > 1).ToList();   // executed NOW => [2, 3]\nnums.Add(99);\nsnapshot;                                         // => [2, 3] (frozen)\n\n// Aggregations execute immediately too:\nnums.Where(n => n > 1).Count();                   // => 3 (runs the pipeline)"
    }
  ],
  "lq-cookbook": [
    {
      "title": "Currently travelling + sorted-by-count + binary search by name",
      "lang": "csharp",
      "code": "// 'currently travelling' = arrival not yet recorded:\nvar travelling = ships.Where(s => s.ArrivalDate == null).ToList();\n\n// sorted by trip count, most first:\nvar busiest = ships.OrderByDescending(s => s.TravelHistory?.Count ?? 0).ToList();\n\n// binary search by name (list MUST be sorted by the same key first):\nvar byName = ships.OrderBy(s => s.Name).Select(s => s.Name).ToList();\nint idx = byName.BinarySearch(\"Rocinante\");   // >= 0 = found at index, < 0 = absent"
    },
    {
      "title": "Departed-port-in-year + average-per-group + above-average",
      "lang": "csharp",
      "code": "// departed a given port in a given year (nested Any with null-safe year):\nvar fromMars2245 = ships.Where(s =>\n    (s.TravelHistory ?? new()).Any(t => t.DeparturePort == \"Mars\"\n                                     && t.Date?.Year == 2245)).ToList();\n\n// average ingredient count per cuisine:\nvar avgPerCuisine = recipes\n    .GroupBy(r => r.Cuisine)\n    .Select(g => new { g.Key, Avg = g.Average(r => r.Ingredients.Count) });\n\n// above-average ingredients (average computed once, excludes nothing extra):\nvar avg = recipes.Average(r => r.Ingredients.Count);\nvar rich = recipes.Where(r => r.Ingredients.Count > avg).ToList();"
    },
    {
      "title": "Bundle results into one object and save (August-style 4.2)",
      "lang": "csharp",
      "code": "var results = new\n{\n    currentlyTravelling = ships.Where(s => s.ArrivalDate == null).ToList(),\n    busiestFirst        = ships.OrderByDescending(s => s.TravelHistory?.Count ?? 0).ToList(),\n    countByType         = ships.GroupBy(s => s.Type)\n                               .Select(g => new { g.Key, Count = g.Count() })\n};\nFile.WriteAllText(\"Problem_4_Query_Results.json\",\n    JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true }));"
    }
  ],
  "df-file-handling": [
    {
      "title": "Exists / append / read-back round trip",
      "lang": "csharp",
      "code": "using System.IO;\n\nstring path = \"notes.txt\";\nif (!File.Exists(path))                       // => true the first run\n    File.WriteAllText(path, \"line one\\n\");\n\nFile.AppendAllText(path, \"line two\\n\");       // adds without overwriting\n\nstring[] lines = File.ReadAllLines(path);\nConsole.WriteLine(lines.Length);              // => 2\nConsole.WriteLine(lines[0]);                  // => line one\n\nstring whole = File.ReadAllText(path);\nConsole.WriteLine(whole.Length > 0);          // => true"
    },
    {
      "title": "Guard reads so a missing file never throws",
      "lang": "csharp",
      "code": "using System.IO;\n\nstatic string[] LoadOrEmpty(string path) =>\n    File.Exists(path) ? File.ReadAllLines(path) : Array.Empty<string>();\n\nstring[] data = LoadOrEmpty(\"maybe-missing.csv\");\nConsole.WriteLine(data.Length);   // => 0 when absent, no exception\n\n// writing a list of lines back out:\nFile.WriteAllLines(\"out.txt\", new[] { \"a\", \"b\", \"c\" });"
    }
  ],
  "df-json": [
    {
      "title": "Read tolerant, write readable",
      "lang": "csharp",
      "code": "using System.Text.Json;\n\nstring text = File.ReadAllText(\"contacts.json\");\nvar opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };\nList<Contact> people = JsonSerializer.Deserialize<List<Contact>>(text, opts)!;\nConsole.WriteLine(people.Count);   // => however many were in the file\n\n// write back pretty-printed:\nstring outJson = JsonSerializer.Serialize(people,\n    new JsonSerializerOptions { WriteIndented = true });\nFile.WriteAllText(\"contacts.json\", outJson);   // human-readable, indented"
    },
    {
      "title": "Nullable props absorb missing fields",
      "lang": "csharp",
      "code": "// JSON: [ { \"Name\": \"Ann\", \"Age\": 30 }, { \"Name\": \"Bo\" } ]\npublic class Person\n{\n    public string? Name { get; set; }   // nullable => missing stays null, no throw\n    public int? Age { get; set; }        // second record has no Age => null\n}\n\nvar list = JsonSerializer.Deserialize<List<Person>>(json,\n    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;\nConsole.WriteLine(list[1].Name);          // => Bo\nConsole.WriteLine(list[1].Age is null);   // => true\nint avg = (int)list.Where(p => p.Age is not null).Average(p => p.Age!.Value); // => 30"
    }
  ],
  "df-csv": [
    {
      "title": "Manual parse without CSVHelper (exam-safe)",
      "lang": "csharp",
      "code": "// data.csv:\n// Name,Age\n// Ann,30\n// Bo,25\nstring[] lines = File.ReadAllLines(\"data.csv\");\nvar people = new List<(string Name, int Age)>();\nforeach (string line in lines.Skip(1))   // skip header\n{\n    string[] cols = line.Split(',');\n    int age = int.TryParse(cols[1], out int a) ? a : 0;\n    people.Add((cols[0].Trim(), age));\n}\nConsole.WriteLine(people.Count);          // => 2\nConsole.WriteLine(people[0].Name);        // => Ann\n// NOTE: plain Split(',') breaks on values that contain a comma -- see exam-legal topic"
    },
    {
      "title": "Build CSV text back out with string.Join",
      "lang": "csharp",
      "code": "var rows = new List<string> { \"Name,Age\" };       // header first\nrows.Add(string.Join(\",\", \"Ann\", 30));            // => \"Ann,30\"\nrows.Add(string.Join(\",\", \"Bo\", 25));             // => \"Bo,25\"\nFile.WriteAllLines(\"out.csv\", rows);\n\nConsole.WriteLine(rows.Count);                    // => 3 (header + 2 rows)"
    }
  ],
  "df-csv-exam-legal": [
    {
      "title": "Why plain Split fails on a quoted comma",
      "lang": "csharp",
      "code": "string line = \"\\\"Serenity, II\\\",Transport,5\";\n\nstring[] naive = line.Split(',');\nConsole.WriteLine(naive.Length);   // => 4  WRONG: the name got torn in two\n\n// quote-aware splitter keeps the quoted field whole:\nList<string> cells = SplitCsvLine(line);\nConsole.WriteLine(cells.Count);    // => 3  correct\nConsole.WriteLine(cells[0]);       // => Serenity, II"
    },
    {
      "title": "Index-safe getter so missing cells stay null",
      "lang": "csharp",
      "code": "// a short row missing its trailing columns must not crash\nstatic string? Get(List<string> cells, int i) =>\n    i < cells.Count && cells[i].Trim().Length > 0 ? cells[i].Trim() : null;\n\nvar c = new List<string> { \"Rocinante\", \"Frigate\" };   // only 2 cells\nConsole.WriteLine(Get(c, 0));            // => Rocinante\nConsole.WriteLine(Get(c, 3) is null);    // => true (no IndexOutOfRange)\nint? crew = int.TryParse(Get(c, 2), out int n) ? n : (int?)null;\nConsole.WriteLine(crew is null);         // => true (empty/missing -> null)"
    }
  ],
  "lq-lambda": [
    {
      "title": "Lambda shapes each LINQ operator expects",
      "lang": "csharp",
      "code": "// predicate: T -> bool (Where, Any, All, First)\nships.Where(s => s.Crew > 4);\n\n// key selector: T -> key (OrderBy, GroupBy)\nships.OrderBy(s => s.Name);\nships.GroupBy(s => s.Type);\n\n// projection: T -> result (Select)\nships.Select(s => s.Name.ToUpper());\n\n// selector for aggregates: T -> number (Sum, Average, Max)\nships.Average(s => s.TravelHistory?.Count ?? 0);"
    },
    {
      "title": "Statement-body lambda + captured variable (closure)",
      "lang": "csharp",
      "code": "int minTrips = 2;                          // captured by the lambda below\nvar busy = ships.Where(s =>\n{\n    int trips = s.TravelHistory?.Count ?? 0;\n    return trips >= minTrips;              // braces + return for multi-line body\n}).ToList();\n\nminTrips = 5;                              // changing it affects later runs\nbusy = ships.Where(s => (s.TravelHistory?.Count ?? 0) >= minTrips).ToList();"
    }
  ],
  "th-thread-basics": [
    {
      "title": "IsBackground: foreground keeps the app alive",
      "lang": "csharp",
      "code": "using System.Threading;\n\nThread worker = new Thread(() =>\n{\n    Thread.Sleep(2000);\n    Console.WriteLine(\"worker finished\");\n});\nworker.IsBackground = true;   // killed the moment Main returns\nworker.Start();\n// Main exits now -> with IsBackground=true the \"worker finished\" line\n// likely NEVER prints. Set false (the default) and the process waits for it."
    },
    {
      "title": "Join with a timeout, and current thread info",
      "lang": "csharp",
      "code": "Thread t = new Thread(() => Thread.Sleep(5000));\nt.Start();\n\nbool finished = t.Join(1000);          // wait at most 1s\nConsole.WriteLine(finished);           // => False (still sleeping)\n\nConsole.WriteLine(Thread.CurrentThread.ManagedThreadId); // who am I?\nThread.Sleep(TimeSpan.FromMilliseconds(100));            // overload also takes a TimeSpan"
    }
  ],
  "th-tasks": [
    {
      "title": "Task<T>.Result blocks; await does not",
      "lang": "csharp",
      "code": "Task<int> work = Task.Run(() =>\n{\n    Thread.Sleep(500);\n    return 21 * 2;\n});\n\nint blocked = work.Result;   // BLOCKS this thread until the task is done => 42\nConsole.WriteLine(work.IsCompletedSuccessfully); // => True\nConsole.WriteLine(work.Status);                  // => RanToCompletion"
    },
    {
      "title": "ContinueWith only on failure",
      "lang": "csharp",
      "code": "Task<int> risky = Task.Run<int>(() => throw new InvalidOperationException(\"boom\"));\n\nrisky.ContinueWith(t =>\n{\n    // t.Exception is an AggregateException wrapping the original\n    Console.WriteLine(\"failed: \" + t.Exception!.InnerException!.Message);\n}, TaskContinuationOptions.OnlyOnFaulted);\n\n// await alone rethrows the ORIGINAL exception (not the AggregateException):\ntry { await risky; } catch (InvalidOperationException ex) { Console.WriteLine(ex.Message); }"
    }
  ],
  "th-async-await": [
    {
      "title": "The task starts at the CALL, not at the await",
      "lang": "csharp",
      "code": "async Task DemoAsync()\n{\n    Console.WriteLine(\"A\");\n    Task<int> t = SlowAddAsync(2, 3); // STARTS running here, A already printed\n    Console.WriteLine(\"B\");           // prints while SlowAddAsync runs concurrently\n    int sum = await t;                // suspend until t finishes, then resume\n    Console.WriteLine(\"C \" + sum);    // => C 5\n}\n\nasync Task<int> SlowAddAsync(int a, int b)\n{\n    await Task.Delay(200);            // simulate IO; yields without blocking\n    return a + b;\n}\n// Observed order: A, B, C 5"
    },
    {
      "title": "await an already-completed task runs synchronously",
      "lang": "csharp",
      "code": "async Task<string> GetAsync()\n{\n    // Task.FromResult is already complete: no suspension, no yield\n    return await Task.FromResult(\"cached\");  // => \"cached\", continues inline\n}\n// await only suspends when the awaited task is NOT yet finished."
    }
  ],
  "th-race-conditions": [
    {
      "title": "Two threads, one field, lost writes",
      "lang": "csharp",
      "code": "int balance = 1000;\nobject _gate = new object();\n\nvoid Withdraw(int amount)\n{\n    lock (_gate)                 // critical section: read-check-write is now atomic\n    {\n        if (balance >= amount)\n            balance -= amount;   // without the lock, two threads both pass the check\n    }\n}\n\nawait Task.WhenAll(\n    Task.Run(() => Withdraw(800)),\n    Task.Run(() => Withdraw(800)));\nConsole.WriteLine(balance);      // with lock: 200 (only one withdrawal succeeds)"
    },
    {
      "title": "Interlocked: lock-free atomic increment",
      "lang": "csharp",
      "code": "using System.Threading;\n\nint counter = 0;\nawait Task.WhenAll(Enumerable.Range(0, 8).Select(_ =>\n    Task.Run(() =>\n    {\n        for (int j = 0; j < 1000; j++)\n            Interlocked.Increment(ref counter); // atomic; no lock needed\n    })));\nConsole.WriteLine(counter);  // exactly 8000, every run"
    }
  ],
  "th-deadlocks": [
    {
      "title": "Fix: take locks in the SAME order everywhere",
      "lang": "csharp",
      "code": "object _lockA = new object();\nobject _lockB = new object();\n\n// Both methods now acquire A BEFORE B -> no circular wait -> no deadlock.\nvoid First()  { lock (_lockA) { lock (_lockB) { /* work */ } } }\nvoid Second() { lock (_lockA) { lock (_lockB) { /* work */ } } }\n\nawait Task.WhenAll(Task.Run(First), Task.Run(Second)); // completes fine"
    },
    {
      "title": "Self-inflicted deadlock: .Result on the UI thread",
      "lang": "csharp",
      "code": "// On the UI thread, the continuation needs the UI thread back...\n// ...but .Result is blocking it. Classic single-thread deadlock.\nint bad = LoadAsync().Result;      // FREEZES forever in a UI context\n\nasync Task<int> LoadAsync()\n{\n    await Task.Delay(100);         // wants to resume on the UI thread\n    return 1;\n}\n// Fix: 'await LoadAsync()' instead of '.Result' -- never block on async in UI code."
    }
  ],
  "th-locking-collections": [
    {
      "title": "Enumerating a List while it mutates throws",
      "lang": "csharp",
      "code": "List<int> items = Enumerable.Range(0, 5).ToList();\nobject gate = new object();\n\n// One thread iterating + another Add() = InvalidOperationException.\n// Safe pattern: snapshot under the lock, iterate the copy outside it.\nList<int> snapshot;\nlock (gate) { snapshot = items.ToList(); }\nforeach (int x in snapshot) Console.WriteLine(x); // never throws"
    },
    {
      "title": "ConcurrentQueue: lock-free producer/consumer",
      "lang": "csharp",
      "code": "using System.Collections.Concurrent;\n\nConcurrentQueue<int> q = new ConcurrentQueue<int>();\nParallel.For(0, 1000, i => q.Enqueue(i)); // many threads, no manual lock\n\nint total = 0;\nwhile (q.TryDequeue(out int v)) total += v; // TryDequeue is thread-safe\nConsole.WriteLine(q.Count);  // => 0 (all drained)"
    }
  ],
  "th-semaphore": [
    {
      "title": "SemaphoreSlim as an async mutex (limit 1)",
      "lang": "csharp",
      "code": "SemaphoreSlim _mutex = new SemaphoreSlim(1, 1); // 1 slot = one-at-a-time\n\nasync Task UpdateAsync()\n{\n    await _mutex.WaitAsync();   // async lock: does NOT block the thread\n    try\n    {\n        await Task.Delay(50);   // safe: only one caller is ever in here\n    }\n    finally\n    {\n        _mutex.Release();       // always release, even on exception\n    }\n}"
    },
    {
      "title": "CurrentCount and a non-blocking try-acquire",
      "lang": "csharp",
      "code": "SemaphoreSlim pool = new SemaphoreSlim(2, 2);\nConsole.WriteLine(pool.CurrentCount); // => 2 free slots\n\nif (await pool.WaitAsync(0))          // timeout 0 = try without waiting\n{\n    try { /* got a slot */ }\n    finally { pool.Release(); }\n}\nelse Console.WriteLine(\"no slot free right now\");"
    }
  ],
  "th-cancellation": [
    {
      "title": "ThrowIfCancellationRequested in a CPU loop",
      "lang": "csharp",
      "code": "void Crunch(CancellationToken token)\n{\n    for (long i = 0; ; i++)\n    {\n        token.ThrowIfCancellationRequested(); // throws OperationCanceledException\n        // ... pure CPU work, no awaits to carry the token ...\n    }\n}\n\nvar cts = new CancellationTokenSource();\nTask t = Task.Run(() => Crunch(cts.Token));\ncts.Cancel();\ntry { await t; } catch (OperationCanceledException) { Console.WriteLine(\"cancelled\"); }"
    },
    {
      "title": "CancelAfter and linking tokens",
      "lang": "csharp",
      "code": "using var timeout = new CancellationTokenSource();\ntimeout.CancelAfter(TimeSpan.FromSeconds(2)); // auto-cancel after 2s\n\nusing var user = new CancellationTokenSource();\n// fires when EITHER source cancels:\nusing var linked = CancellationTokenSource.CreateLinkedTokenSource(timeout.Token, user.Token);\n\nawait Task.Delay(Timeout.Infinite, linked.Token); // throws after ~2s\n"
    }
  ],
  "th-whenall-whenany": [
    {
      "title": "WhenAll aggregates results; preserves order",
      "lang": "csharp",
      "code": "async Task<int> SquareAsync(int n) { await Task.Delay(50); return n * n; }\n\nint[] squares = await Task.WhenAll(\n    SquareAsync(2), SquareAsync(3), SquareAsync(4));\n// results map 1:1 to call order even though they ran concurrently:\nConsole.WriteLine(string.Join(\",\", squares)); // => 4,9,16"
    },
    {
      "title": "WhenAll surfaces the FIRST exception via await",
      "lang": "csharp",
      "code": "Task ok   = Task.Delay(100);\nTask fail = Task.Run(() => throw new InvalidOperationException(\"x\"));\n\ntry\n{\n    await Task.WhenAll(ok, fail); // await rethrows ONE inner exception\n}\ncatch (InvalidOperationException ex)\n{\n    Console.WriteLine(ex.Message); // => x  (inspect whenAllTask.Exception for all)\n}"
    }
  ],
  "th-periodictimer": [
    {
      "title": "PeriodicTimer driving a counter (no overlap)",
      "lang": "csharp",
      "code": "using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(100));\nint count = 0;\nvar cts = new CancellationTokenSource();\ncts.CancelAfter(500);\n\ntry\n{\n    // each tick waits for the PREVIOUS body to finish -> no re-entrancy\n    while (await timer.WaitForNextTickAsync(cts.Token))\n        Console.WriteLine(++count);\n}\ncatch (OperationCanceledException) { }\n// prints roughly 1..5 then stops"
    },
    {
      "title": "BlockingCollection with bounded capacity",
      "lang": "csharp",
      "code": "using System.Collections.Concurrent;\n\nvar queue = new BlockingCollection<int>(boundedCapacity: 2); // Add blocks when full\n\nTask producer = Task.Run(() =>\n{\n    for (int i = 0; i < 5; i++) queue.Add(i); // waits while consumer drains\n    queue.CompleteAdding();\n});\n\nforeach (int item in queue.GetConsumingEnumerable()) // blocks while empty\n    Console.WriteLine(item);                          // ends after CompleteAdding\nawait producer;"
    }
  ],
  "th-ui-thread": [
    {
      "title": "Counter ticking on the UI thread (DispatcherTimer)",
      "lang": "csharp",
      "code": "using Avalonia.Threading;\nusing CommunityToolkit.Mvvm.ComponentModel;\n\npublic partial class CounterViewModel : ObservableObject\n{\n    [ObservableProperty] private int _count;\n    private readonly DispatcherTimer _timer = new()\n        { Interval = TimeSpan.FromMilliseconds(100) };\n\n    public CounterViewModel() => _timer.Tick += (_, _) => Count++; // already on UI thread\n\n    public void Start() => _timer.Start();\n    public void Pause() => _timer.Stop();\n    public void Reset() { _timer.Stop(); Count = 0; }\n}"
    },
    {
      "title": "Background loop marshals each update via Dispatcher.Post",
      "lang": "csharp",
      "code": "using Avalonia.Threading;\n\n// A worker thread must NOT touch bound properties directly.\nawait Task.Run(async () =>\n{\n    for (int i = 0; i < 10; i++)\n    {\n        await Task.Delay(100);\n        Dispatcher.UIThread.Post(() => Count++); // hop to the UI thread to mutate\n    }\n});"
    }
  ],
  "th-io-vs-cpu": [
    {
      "title": "IO-bound: await the async API, no thread burned",
      "lang": "csharp",
      "code": "// Waiting on disk/network: the thread is freed during the wait, so just await.\nstring text = await File.ReadAllTextAsync(\"data.txt\");\nawait Task.Delay(TimeSpan.FromSeconds(1)); // pure waiting, no Task.Run needed\nConsole.WriteLine(text.Length);"
    },
    {
      "title": "CPU-bound: Task.Run to keep the UI responsive",
      "lang": "csharp",
      "code": "// Heavy calculation would freeze the UI thread, so push it to the pool.\nlong sum = await Task.Run(() =>\n{\n    long acc = 0;\n    for (int i = 0; i < 100_000_000; i++) acc += i; // CPU busy\n    return acc;\n});\n// await keeps the UI thread free; result arrives back on the UI thread."
    }
  ],
  "ut-intro": [
    {
      "title": "AAA skeleton with the Method_Scenario_Expected name",
      "lang": "csharp",
      "code": "using Xunit;\n\npublic class CounterViewModelTests\n{\n    [Fact]\n    public void Increment_FromZero_CountIsOne()\n    {\n        // Arrange\n        var vm = new CounterViewModel();\n\n        // Act\n        vm.IncrementCommand.Execute(null);\n\n        // Assert\n        Assert.Equal(1, vm.Count);\n    }\n}"
    },
    {
      "title": "What makes it a UNIT test (one behaviour, no UI)",
      "lang": "csharp",
      "code": "// A good unit test:\n//  - tests ONE logical behaviour (one Act, asserts on its outcome)\n//  - is deterministic: same input -> same result every run\n//  - is fast and isolated: no window, no disk, no network\n//  - names the behaviour, not the implementation\n//\n// [Fact]  Increment_FromZero_CountIsOne     <- behaviour is obvious\n// [Fact]  Test1                             <- BAD: tells you nothing\n//\n// Test the ViewModel + Model (logic), never pixels -> that is the MVVM payoff."
    }
  ],
  "ut-setup": [
    {
      "title": "Verify the offline cache restores before exam day",
      "lang": "bash",
      "code": "# warm the NuGet cache ONCE while online (packages land in ~/.nuget/packages)\ndotnet new xunit -o Counter.Tests\ndotnet add Counter.Tests package Avalonia.Headless.XUnit --version 11.2.1\n\n# then prove it works with NO network:\ndotnet restore Counter.Tests --no-cache --source ~/.nuget/packages\ndotnet test --no-restore        # offline run = exam conditions"
    },
    {
      "title": "Pin the cache as a source with nuget.config (offline-safe)",
      "lang": "xml",
      "code": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<configuration>\n  <packageSources>\n    <clear />\n    <!-- restore ONLY from the local cache, never hit nuget.org -->\n    <add key=\"local\" value=\"%USERPROFILE%\\.nuget\\packages\" />\n  </packageSources>\n</configuration>\n<!-- drop next to the .sln so dotnet test never needs the internet -->"
    }
  ],
  "ut-asserts": [
    {
      "title": "Theory + InlineData drives one body with many rows",
      "lang": "csharp",
      "code": "[Theory]\n[InlineData(0, 1)]   // start 0, one increment -> 1\n[InlineData(0, 3)]   // start 0, three increments -> 3\n[InlineData(5, 2)]   // start 5, two increments -> 7\npublic void Increment_NTimes_AddsN(int start, int times)\n{\n    var vm = new CounterViewModel { Count = start };\n    for (int i = 0; i < times; i++)\n        vm.IncrementCommand.Execute(null);\n    Assert.Equal(start + times, vm.Count);\n}"
    },
    {
      "title": "The asserts that come up most in the exam",
      "lang": "csharp",
      "code": "Assert.Equal(0, vm.Count);                 // expected FIRST, actual second\nAssert.NotEqual(0, vm.Count);              // after an increment\nAssert.True(vm.IncrementCommand.CanExecute(null));\nAssert.False(vm.DecrementCommand.CanExecute(null)); // guard active at 0\nAssert.NotNull(window.FindControl<Button>(\"AddButton\"));\nAssert.Equal(\"100\", text!.Text);           // string comparison\n\n// exceptions: assert the EXACT type is thrown\nvar ex = Assert.Throws<InvalidOperationException>(() => vm.Pop());\nAssert.Contains(\"empty\", ex.Message);"
    }
  ],
  "ut-testing-viewmodels": [
    {
      "title": "The exam's DiveTank VM: init 0, increment, decrement",
      "lang": "csharp",
      "code": "[Fact]\npublic void NewTank_StartsEmpty()\n{\n    var vm = new DiveTankViewModel();\n    Assert.Equal(0, vm.Pressure);          // init state is 0\n}\n\n[Fact]\npublic void Fill_ThenRelease_ReturnsToZero()\n{\n    var vm = new DiveTankViewModel();\n    vm.FillCommand.Execute(null);          // 0 -> 1\n    vm.ReleaseCommand.Execute(null);       // 1 -> 0\n    Assert.Equal(0, vm.Pressure);\n}"
    },
    {
      "title": "CanExecute guard flips as state changes",
      "lang": "csharp",
      "code": "[Fact]\npublic void Release_Disabled_WhenEmpty_EnabledAfterFill()\n{\n    var vm = new DiveTankViewModel();\n\n    // guard blocks release while empty\n    Assert.False(vm.ReleaseCommand.CanExecute(null));\n\n    vm.FillCommand.Execute(null);          // setter fires NotifyCanExecuteChangedFor\n\n    // guard now allows release\n    Assert.True(vm.ReleaseCommand.CanExecute(null));\n}"
    }
  ],
  "ut-headless": [
    {
      "title": "Click the real button 100x, assert the bound text",
      "lang": "csharp",
      "code": "[AvaloniaFact]                              // NOT [Fact] for UI tests\npublic void Clicking100Times_ShowsHundred()\n{\n    var window = new MainWindow { DataContext = new MainWindowViewModel() };\n    window.Show();                          // mandatory, even though nothing renders\n\n    var button = window.FindControl<Button>(\"IncrementButton\");\n    var label  = window.FindControl<TextBlock>(\"CountText\");\n    Assert.NotNull(button);\n    Assert.NotNull(label);\n\n    for (int i = 0; i < 100; i++)\n        button!.Command?.Execute(button.CommandParameter);\n\n    Assert.Equal(\"100\", label!.Text);\n}"
    },
    {
      "title": "Required one-time AvaloniaTestApplication hook",
      "lang": "csharp",
      "code": "using Avalonia;\nusing Avalonia.Headless;\nusing Counter;                              // the app project's namespace\n\n// one [assembly:] line per test project, or every [AvaloniaFact] fails to start\n[assembly: AvaloniaTestApplication(typeof(TestAppBuilder))]\n\npublic class TestAppBuilder\n{\n    public static AppBuilder BuildAvaloniaApp() =>\n        AppBuilder.Configure<App>()\n            .UseHeadless(new AvaloniaHeadlessPlatformOptions());\n}"
    }
  ],
  "ut-functional": [
    {
      "title": "One test case = steps then expected then result",
      "lang": "bash",
      "code": "## TC-05  Increment guard (DiveTank)\n# Steps:    open app -> click Fill until Pressure = max\n# Expected: Fill button greys out (disabled) at the cap\n# Result:   PASS (2026-06-13)\n\n## TC-06  Persistence after restart\n# Steps:    set Pressure = 4, close app, reopen\n# Expected: Pressure still 4 (reloaded from JSON)\n# Result:   PASS"
    }
  ],
  "al-bigo": [
    {
      "title": "Annotating the cost of each piece of code",
      "lang": "csharp",
      "code": "int n = a.Length;\n\nint x = a[0];                       // O(1)   constant: index access\n\nfor (int i = 0; i < n; i++)         // O(n)   one pass\n    sum += a[i];\n\nfor (int i = 0; i < n; i++)         // O(n^2) loop inside a loop\n    for (int j = 0; j < n; j++)\n        grid[i, j] = 0;\n\n// rules: drop constants (2n -> n); keep only the dominant term\n// (n^2 + n -> n^2); sequential blocks add, nested blocks multiply."
    }
  ],
  "al-collection-complexity": [
    {
      "title": "Pick the collection by the cost of its hot operation",
      "lang": "csharp",
      "code": "var list = new List<int> { 5, 2, 9 };\nint third = list[2];                 // O(1)   index access\nbool has  = list.Contains(9);        // O(n)   linear scan\nlist.Insert(0, 1);                   // O(n)   shifts everything right\n\nvar map = new Dictionary<string,int>();\nmap[\"a\"] = 1;                        // O(1)   hashed insert\nbool keyed = map.ContainsKey(\"a\");   // O(1)   hashed lookup\n\nvar set = new HashSet<int> { 1, 2 };\nbool member = set.Contains(2);       // O(1)   hashed membership\n// Need fast lookup by key/value? Dictionary/HashSet, not List."
    }
  ],
  "al-search": [
    {
      "title": "Iterative binary search returning the index",
      "lang": "csharp",
      "code": "int BinarySearch(int[] sorted, int target)   // PRE: sorted ascending\n{\n    int lo = 0, hi = sorted.Length - 1;\n    while (lo <= hi)                          // O(log n): halve each step\n    {\n        int mid = lo + (hi - lo) / 2;         // avoids int overflow\n        if (sorted[mid] == target) return mid;\n        if (sorted[mid] < target) lo = mid + 1;\n        else hi = mid - 1;\n    }\n    return -1;                                // not found\n}"
    },
    {
      "title": "Binary search with an IComparer<T> over objects",
      "lang": "csharp",
      "code": "class ByName : IComparer<Ship>\n{\n    public int Compare(Ship? a, Ship? b) =>\n        string.Compare(a?.Name, b?.Name, StringComparison.Ordinal);\n}\n\nvar cmp = new ByName();\nships.Sort(cmp);                              // MUST sort by the search key first\nint i = ships.BinarySearch(new Ship { Name = \"Rocinante\" }, cmp);\n// i >= 0 -> found at that index; i < 0 -> not present"
    }
  ],
  "al-sorting-simple": [
    {
      "title": "The three O(n^2) sorts as minimal loops",
      "lang": "csharp",
      "code": "// Bubble: swap adjacent out-of-order pairs, largest bubbles to the end\nfor (int i = 0; i < a.Length - 1; i++)              // O(n^2)\n    for (int j = 0; j < a.Length - 1 - i; j++)\n        if (a[j] > a[j + 1]) (a[j], a[j + 1]) = (a[j + 1], a[j]);\n\n// Insertion: shift bigger elements right, drop current into the gap\nfor (int i = 1; i < a.Length; i++)                  // O(n^2)\n{\n    int cur = a[i], j = i - 1;\n    while (j >= 0 && a[j] > cur) { a[j + 1] = a[j]; j--; }\n    a[j + 1] = cur;\n}"
    }
  ],
  "al-sorting-divide": [
    {
      "title": "Why merge/quick beat the simple sorts",
      "lang": "csharp",
      "code": "// Divide and conquer: split, recurse, combine.\n//\n//   Merge sort:  always O(n log n)        (log n split levels, O(n) merge each)\n//   Quick sort:  O(n log n) average,\n//                O(n^2) worst             (sorted input + bad pivot choice)\n//\n// Both recurse, so both need a BASE CASE (a 0/1-element range):\nif (a.Length <= 1) return a;            // merge sort base case\nif (lo >= hi) return;                   // quick sort base case\n// Forget the base case -> infinite recursion -> StackOverflowException."
    }
  ],
  "al-recursion": [
    {
      "title": "Recursive Fibonacci and its hidden cost",
      "lang": "csharp",
      "code": "long Fib(int n)\n{\n    if (n < 2) return n;            // base cases: Fib(0)=0, Fib(1)=1\n    return Fib(n - 1) + Fib(n - 2); // two calls per level -> O(2^n)!\n}\n// O(2^n): naive recursion recomputes the same values exponentially.\n\nlong FibFast(int n)                 // iterative: O(n), no recomputation\n{\n    long a = 0, b = 1;\n    for (int i = 0; i < n; i++) (a, b) = (b, a + b);\n    return a;\n}"
    }
  ],
  "proc-prototyping": [
    {
      "title": "The two axes as a code-shaped 2x2 (in comments)",
      "lang": "csharp",
      "code": "// FIDELITY = how it LOOKS  |  RESOLUTION = how much WORKS  (independent axes)\n//\n//                    | LOW resolution        | HIGH resolution\n//   ----------------- + --------------------- + ----------------------\n//   LOW fidelity      | sketch / wireframe    | paper prototype\n//                     | (boxes, broad)        | (run a flow by hand)\n//   HIGH fidelity     | mockup                | functional prototype\n//                     | (real look, static)   | (looks real AND works)\n//\n// Resolution split:  horizontal = wide & shallow (a base view per menu item),\n//                     vertical   = narrow & deep  (one item built end-to-end)."
    }
  ],
  "proc-context": [
    {
      "title": "Throwaway vs evolutionary, and prototype vs MVP",
      "lang": "csharp",
      "code": "// What happens to the prototype after it has served its purpose:\n//   Throwaway (rapid) : built to learn, then discarded; rebuild for real\n//   Evolutionary      : the same prototype is refined into production\n//\n// Prototype vs MVP (not the same thing):\n//   vertical prototype -> proves ONE flow INTERNALLY (team feedback)\n//   MVP                -> a real, shippable product, smallest useful slice,\n//                         goes to ACTUAL customers to learn from them\n//\n// NOTE: background only -- NOT defined in the Lecture 7 GUI-design slides."
    }
  ]
};

global.TOPIC_EXAMPLES = TOPIC_EXAMPLES;
if (typeof module !== "undefined" && module.exports) module.exports = TOPIC_EXAMPLES;

})(typeof window !== "undefined" ? window : globalThis);
