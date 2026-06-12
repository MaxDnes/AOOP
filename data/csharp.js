/* ============ C# LANGUAGE ============ */

window.TOPICS.push(

{
id: "cs-delegates",
title: "Delegates & multicast delegates",
cat: "C# Language",
tags: ["delegate", "multicast", "function pointer", "invoke", "higher order"],
related: ["cs-action-func", "cs-events", "dp-observer"],
blocks: [
  { def: "A delegate is an object that knows how to call a method. In essence a function pointer: it defines a method signature (return type and parameters) so a variable can hold a reference to any method that matches.", term: "Delegate" },
  { code: String.raw`delegate int Transformer(int x);

int Square(int x) => x * x;
int Cube(int x) => x * x * x;

Transformer t = Square;            // == new Transformer(Square)
t(5);                              // == t.Invoke(5)  -> 25
t = Cube;
t(5);                              // -> 125

// Higher-order function: takes a function as argument (plugin behavior)
void Transform(int[] values, Transformer t)
{
    for (int i = 0; i < values.Length; i++)
        values[i] = t(values[i]);
}`, lang: "csharp", title: "Delegate basics" },
  { def: "A delegate can hold references to MULTIPLE methods. Invoking it executes all attached methods in the order added. Chain with += and remove with -=.", term: "Multicast delegate" },
  { code: String.raw`delegate void TaskHandler();

void Save() => Console.WriteLine("Saving...");
void Log()  => Console.WriteLine("Logging...");

TaskHandler tasks = Save;   // one method
tasks += Log;               // now two (multicast)
tasks();                    // runs Save THEN Log
tasks -= Save;              // unsubscribe`, lang: "csharp", title: "Multicast with += / -=" },
  { tip: "The course chain to remember for theory questions: delegate → multicast delegate → Action/Func → event → EventHandler pattern → \"events are a native built-in Observer pattern\" → INotifyPropertyChanged → data binding → MVVM." },
]},

{
id: "cs-action-func",
title: "Action, Func & lambda expressions",
cat: "C# Language",
tags: ["action", "func", "lambda", "anonymous method", "predicate", "=>"],
related: ["cs-delegates", "lq-lambda"],
blocks: [
  { def: "C# provides built-in generic delegates so you don't declare custom ones: Action for methods returning void, Func for methods returning a value (last type parameter = return type).", term: "Action / Func" },
  { code: String.raw`// Instead of 'delegate void MyDelegate(int x)':
Action<int> printNumber = (num) => Console.WriteLine(num);

// Instead of 'delegate int MathDelegate(int x)':
Func<int, int> square = (num) => num * num;

printNumber(square(5));   // 25

// Func<in1, in2, out>:
Func<int, int, int> add = (a, b) => a + b;
int result = add(3, 4);   // 7

// Generic higher-order method:
void Transform<T>(T[] values, Func<T, T> transformer)
{
    for (int i = 0; i < values.Length; i++)
        values[i] = transformer(values[i]);
}`, lang: "csharp", title: "Action / Func / lambdas" },
  { rule: "Lambda syntax: `(parameters) => expression` or `(parameters) => { statements; }`. Every LINQ call site (`Where(p => p.Price < 100)`) is a Func-typed lambda." },
  { p: "Lambdas as event handlers (used constantly in course GUI code): `button.Click += (sender, e) => { DoThing(); };` and discard-parameter form `timer.Tick += (_, _) => Count++;`." },
]},

{
id: "cs-events",
title: "Events & the EventHandler pattern",
cat: "C# Language",
tags: ["event", "eventhandler", "eventargs", "subscribe", "publish", "observer"],
related: ["cs-delegates", "dp-observer", "mv-inotify"],
blocks: [
  { def: "An event is a capsule around a delegate. External classes can only subscribe (+=) or unsubscribe (-=) but cannot trigger the event; only the declaring class decides when to broadcast.", term: "Event" },
  { code: String.raw`public class Button
{
    public event Action<string>? OnClick;     // event using the Action shortcut

    public void Press()
    {
        OnClick?.Invoke("Button was clicked!");   // ?. = only fire if subscribers exist
    }
}

Button myButton = new Button();
myButton.OnClick += (message) => Console.WriteLine($"[UI Notification]: {message}");
myButton.Press();`, lang: "csharp", title: "Minimal event" },
  { h: "The standard .NET pattern: EventHandler + EventArgs" },
  { code: String.raw`// 1. Custom event args carry the data
public class StockChangedEventArgs : EventArgs
{
    public string Symbol { get; set; } = "";
    public double NewPrice { get; set; }
}

public class StockTicker
{
    // 2. Built-in EventHandler<T> with your args type
    public event EventHandler<StockChangedEventArgs>? PriceChanged;

    // 3. Protected virtual "On" method = standard practice (safety + inheritance)
    protected virtual void OnPriceChanged(string symbol, double price)
    {
        PriceChanged?.Invoke(this, new StockChangedEventArgs
        {
            Symbol = symbol,
            NewPrice = price
        });
    }

    public void UpdateQuote(string symbol, double price)
    {
        // ... update logic ... then notify subscribers:
        OnPriceChanged(symbol, price);
    }
}

// Subscriber:
var ticker = new StockTicker();
ticker.PriceChanged += (sender, e) =>
    Console.WriteLine($"{e.Symbol} is now {e.NewPrice:C}");`, lang: "csharp", title: "EventHandler<TEventArgs> pattern (slide verbatim)" },
  { rule: "Slide quote worth repeating verbatim in answers: \"Events are essentially a native, built-in version of the Observer pattern!\"" },
]},

{
id: "cs-generics",
title: "Generics",
cat: "C# Language",
tags: ["generics", "type parameter", "T", "constraints", "where", "boxing"],
related: ["col-overview", "cs-action-func"],
blocks: [
  { p: "Generics define classes, methods, and interfaces with a placeholder for the data type. The course's three advantages to memorize:" },
  { list: [
    "**Type safety**: compile-time checking ensures type correctness.",
    "**Performance**: avoids runtime conversions/boxing.",
    "**Reusability**: write once, use with multiple types.",
  ]},
  { code: String.raw`// The duplication problem...
class StringCollector { public string[] items { get; set; } }
class IntCollector    { public int[] items { get; set; } }

// ...solved once:
class Collector<T>
{
    public T[] items { get; set; }
}
Collector<int> ints = new Collector<int>();

// Multiple type parameters:
public class Pair<T, U>
{
    public T First { get; set; }
    public U Second { get; set; }
}
var pair = new Pair<int, string> { First = 1, Second = "One" };

// Generic methods:
void Swap<T>(ref T a, ref T b) { (a, b) = (b, a); }

// Constraint example (used in DocumentManager exam code):
public List<T> GetAllDocumentsOfType<T>() where T : class
{
    return _allDocuments.OfType<T>().ToList();
}`, lang: "csharp", title: "Generic classes, methods, constraints" },
]},

{
id: "cs-switch-patterns",
title: "Switch expressions & pattern matching",
cat: "C# Language",
tags: ["switch", "switch expression", "pattern matching", "is", "discard", "_"],
related: ["oop-polymorphism-casting"],
blocks: [
  { code: String.raw`// Classic switch statement
int day = 3;
switch (day)
{
    case 1: Console.WriteLine("Monday"); break;
    case 2: Console.WriteLine("Tuesday"); break;
    case 3: Console.WriteLine("Wednesday"); break;
    default: Console.WriteLine("Invalid day"); break;
}

// Switch EXPRESSION (used in BirthdayParty.CalculateCost on the slides)
decimal cakeCost = CakeSize switch
{
    "Small"  => 112M,
    "Medium" => 210M,
    "Large"  => 350M,
    _        => 0          // discard = default case
};`, lang: "csharp", title: "switch statement vs switch expression" },
  { code: String.raw`// Type pattern matching with 'is' (exact pattern from DocumentManager exam code)
public void ProcessSingle(IProcessable document)
{
    if (document is IValidatable validatableDoc)     // test + cast in one step
    {
        var errors = validatableDoc.Validate();
        if (errors.Count > 0) return;
    }
    document.ProcessDocument();
}

// Property patterns & null checks
if (_timer is { IsEnabled: true }) return;
if (value is not null) { /* ... */ }`, lang: "csharp", title: "is-patterns" },
]},

{
id: "cs-null-operators",
title: "Null handling: ?. ?? bool? and friends",
cat: "C# Language",
tags: ["null", "nullable", "null conditional", "null coalescing", "?.", "??", "bool?"],
related: ["pb-linq-json", "df-json"],
blocks: [
  { table: { head: ["Operator", "Meaning", "Example"], rows: [
    ["`?.`", "null-conditional: call/skip if null", "`PropertyChanged?.Invoke(this, args)`"],
    ["`??`", "null-coalescing: fallback value", "`s.TravelHistory ?? new()`"],
    ["`??=`", "assign only if currently null", "`_timer ??= CreateTimer();`"],
    ["`?` on type", "nullable type", "`DateTime? ArrivalDate`, `Contact? selected`"],
    ["`!`", "null-forgiving (you promise it isn't null)", "`NewContactName!`"],
  ]}},
  { code: String.raw`// bool? from Avalonia CheckBox.IsChecked -- the recurring exam pattern:
dinnerParty.IsFancy = fancyCheckBox.IsChecked ?? false;
// or
party.SetHealthyOption(healthyCheckbox.IsChecked.Value);   // throws if null!

// Null-safe LINQ over optional JSON data:
int trips = ship.TravelHistory?.Count ?? 0;
bool traveling = ship.TravelHistory?.Any(t => t.ArrivalDate == null) == true;

// Nullable value access:
DateTime? d = trip.DepartureDate;
if (d.HasValue && d.Value.Year == 2245) { /* ... */ }
int year = trip.DepartureDate?.Year ?? 0;`, lang: "csharp", title: "Null patterns you will actually write" },
  { gotcha: "Exam projects have `<Nullable>enable</Nullable>`. Initialize string properties (`= string.Empty` or `= \"\"`) or make them nullable, otherwise you drown in warnings." },
]},

{
id: "cs-exceptions",
title: "Exception handling",
cat: "C# Language",
tags: ["exception", "try", "catch", "finally", "throw", "filenotfound"],
related: ["df-file-handling", "th-tasks"],
blocks: [
  { rule: "Course guidance verbatim: graceful error handling prevents crashes and improves UX. Stay **specific and minimal** with catch types, use **finally to clean up**, and **always log** your error messages somewhere." },
  { code: String.raw`try
{
    string readText = File.ReadAllText("falsefilename.txt");
    Console.WriteLine(readText);
}
catch (FileNotFoundException ex)        // catch the SPECIFIC exception
{
    Console.WriteLine("File does not exist");
}
catch (Exception ex)                    // optional general fallback LAST
{
    Console.WriteLine($"Unexpected: {ex.Message}");
}
finally
{
    Console.WriteLine("Cleanup");       // runs whether it threw or not
}`, lang: "csharp", title: "try / catch / finally (slide example)" },
  { code: String.raw`// Throwing your own
if (obj is not Party) throw new ArgumentException("Object is not a Party");

// Exceptions thrown INSIDE a Task surface as AggregateException on .Wait()/.Result:
Task task = Task.Run(() => { throw new NullReferenceException(); });
try { task.Wait(); }
catch (AggregateException aex)
{
    if (aex.InnerException is NullReferenceException) Console.WriteLine("Null!");
    else throw;
}
// ...but with 'await task' you catch the ORIGINAL exception type directly.

// Cancellation is signalled by OperationCanceledException -- expected, catch it:
catch (OperationCanceledException) { /* normal shutdown path */ }`, lang: "csharp", title: "Throwing, AggregateException, OperationCanceledException" },
  { table: { head: ["Exception", "Typical cause in exam code"], rows: [
    ["`FileNotFoundException`", "reading a missing file"],
    ["`InvalidOperationException`", "mutating a List while another thread enumerates it; `Single()` with 0 or 2+ matches"],
    ["`ArgumentException`", "CompareTo with a wrong type"],
    ["`NullReferenceException`", "member access on null"],
    ["`OperationCanceledException`", "awaited call observed a cancelled token"],
    ["`AggregateException`", "faulted Task observed via .Wait()/.Result"],
    ["`InvalidCastException`", "hard downcast `(Jet)plane` failing"],
    ["`JsonException`", "malformed JSON in Deserialize"],
  ]}},
]},

{
id: "cs-strings-formatting",
title: "String interpolation & formatting",
cat: "C# Language",
tags: ["string", "interpolation", "format", "currency", "culture", "tostring"],
related: ["oop-object-tostring-icomparable"],
blocks: [
  { code: String.raw`string name = "Monika";
int people = 10;

// Interpolation
Console.WriteLine($"{name} invited {people} people");

// Format specifiers inside interpolation
decimal cost = 4550.5M;
Console.WriteLine($"Cost: {cost:F2}");        // 4550.50  (2 decimals)
Console.WriteLine($"Cost: {cost:C}");         // currency, current culture
Console.WriteLine($"{DateTime.Now:HH:mm:ss}"); // 14:03:59
Console.WriteLine($"{DateTime.Now:d}");        // short date

// Danish currency (course example)
var danish = new CultureInfo("da-DK");        // using System.Globalization;
labelCost.Text = cost.ToString("c", danish);  // "4.550,50 kr."

// Useful string members
"hello".ToUpper();  "HELLO".ToLower();
"  x  ".Trim();
"a,b,c".Split(',');
string.Join(", ", list);
text.Replace(search, replacement);
string.IsNullOrWhiteSpace(input);             // exam-grade input validation
new string(text.Reverse().ToArray());         // reversed string (course MultiView)`, lang: "csharp", title: "Formatting + everyday string ops" },
]},

{
id: "cs-records-structs",
title: "Records, structs, enums (quick reference)",
cat: "C# Language",
tags: ["record", "struct", "enum", "value type", "reference type"],
related: ["oop-constructors"],
blocks: [
  { p: "Listed under \"things to keep studying\" rather than core exam topics, but cheap to know:" },
  { code: String.raw`// Record: reference type with value-based equality + concise syntax
public record Point(int X, int Y);
var a = new Point(1, 2);
var b = new Point(1, 2);
Console.WriteLine(a == b);          // True (records compare by value)
var c = a with { Y = 5 };           // non-destructive mutation

// Struct: VALUE type, copied on assignment, lives inline (no heap allocation)
public struct Vector2 { public double X, Y; }

// Enum: named constants (used as RadioButton content in the Polymorphism solution)
public enum Shapes { Ellipse, Rectangle, Circle, Square }
Shapes s = Shapes.Circle;
string n = s.ToString();            // "Circle"
Shapes parsed = (Shapes)1;          // Rectangle`, lang: "csharp", title: "Records / structs / enums" },
  { table: { head: ["", "class", "struct", "record"], rows: [
    ["Type kind", "reference", "value", "reference (record struct exists)"],
    ["Equality", "by reference", "by value", "by value"],
    ["Assignment", "copies reference", "copies whole value", "copies reference"],
    ["Use when", "identity + behavior", "small immutable data", "immutable data with equality"],
  ]}},
]}

);
