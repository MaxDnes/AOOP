# Mock Exams 2026 - MCQ Answer Key

These are the same 40 questions wired into the app Quiz tab as the categories **Mock Exam 1** and **Mock Exam 2**. In the app the four choices are shuffled per attempt, so the letters below (fixed order) are for paper self-checking only.

To sit a set as a timed exam in the app: open the **Quiz** tab, deselect every category chip except one Mock Exam set, choose mode **Exam sim (20 + timer)**, then **Start**.

---

## Mock Exam 1 (20 MCQs)

**1. A class keeps its fields private and exposes a validating property with a private setter. Which OO principle is this?**

- A) Encapsulation
- B) Polymorphism
- C) Inheritance
- D) Abstraction

**2. What is printed?**

```csharp
public class Animal { public virtual string Speak() => "..."; }
public class Dog : Animal { public override string Speak() => "Woof"; }

Animal a = new Dog();
Console.WriteLine(a.Speak());
```

- A) Woof, because override makes the runtime type decide
- B) ..., because the variable type Animal decides
- C) Compile error, because Animal is not abstract
- D) Woof... , because both versions run

**3. An app swaps sorting algorithms at runtime by holding an ISortStrategy field and calling strategy.Sort(). Which design pattern is this?**

- A) Strategy
- B) Observer
- C) Adapter
- D) Singleton

**4. What does the source generator create from this, and what must the View bind to?**

```csharp
public partial class VM : ObservableObject
{
    [ObservableProperty] private string _name;
}
```

- A) A public Name property that raises PropertyChanged; the View binds Name
- B) A private name property; the View binds _name
- C) Nothing until you write the property by hand
- D) A NameCommand; the View binds NameCommand

**5. What is the practical difference between a public delegate field and an event in C#?**

- A) An event can only be raised inside the declaring class; a plain delegate field can be invoked by any outside code
- B) They are identical; event is just a keyword with no effect
- C) An event supports multiple subscribers but a delegate cannot
- D) A delegate is type-safe but an event is not

**6. Which SOLID principle does this class most clearly violate?**

```csharp
class Report
{
    public string Render() { /* ... */ }
    public void SaveToDisk(string path) { /* ... */ }
    public void Email(string to) { /* ... */ }
}
```

- A) Single Responsibility, because it renders, persists, and emails
- B) Liskov Substitution
- C) Interface Segregation
- D) Dependency Inversion

**7. You must use a third-party logger whose interface does not match your ILogger. You write a class implementing ILogger that forwards calls to the third-party type. Which pattern is this?**

- A) Adapter
- B) Decorator
- C) Facade
- D) Strategy

**8. A prototype shows the full breadth of the UI (every screen and menu) but none of the buttons actually do anything. What kind of prototype is this?**

- A) Horizontal prototype
- B) Vertical prototype
- C) High-fidelity prototype
- D) Throwaway prototype

**9. What does r contain?**

```csharp
var r = books
    .GroupBy(b => b.Author)
    .Select(g => new { Author = g.Key, Count = g.Count() })
    .OrderByDescending(x => x.Count)
    .ToList();
```

- A) Each author with how many books they wrote, most-prolific first
- B) The single author with the most books
- C) Every book sorted by author name
- D) The total number of authors

**10. What is printed?**

```csharp
var q = new Queue<int>();
q.Enqueue(1); q.Enqueue(2); q.Enqueue(3);
Console.Write(q.Dequeue());
Console.Write(q.Dequeue());
```

- A) 12
- B) 32
- C) 21
- D) 23

**11. A background timer computes a new value. Why must the ViewModel update a bound property on the UI thread (e.g. via Dispatcher.UIThread.Post)?**

- A) UI state may only be touched on the UI thread; updating from another thread can crash or corrupt the UI
- B) Dispatcher makes the code run faster
- C) It is only needed for animations
- D) Background threads cannot do arithmetic

**12. What does this test assert?**

```csharp
Assert.Throws<InvalidOperationException>(() => account.Withdraw(999));
```

- A) That calling Withdraw(999) throws an InvalidOperationException
- B) That Withdraw returns 999
- C) That no exception is thrown
- D) That the test is skipped

**13. In this course, which statement about interfaces versus abstract classes is correct?**

- A) A class can implement many interfaces but inherit only one base class
- B) A class can inherit many base classes but implement one interface
- C) Interfaces can hold fields and constructors
- D) Abstract classes cannot have any implemented methods

**14. When does the filtering actually run?**

```csharp
var q = list.Where(x => x > 0);
```

- A) When q is enumerated (e.g. ToList or foreach), not at the line shown
- B) Immediately on the Where line
- C) Never, unless you call .Run()
- D) Once per item as you build the query

**15. What does the View bind its Button.Command to?**

```csharp
[RelayCommand]
private void AddItem() { /* ... */ }
```

- A) AddItemCommand
- B) AddItem
- C) AddItemRelayCommand
- D) Command_AddItem

**16. Why is the attribute here?**

```csharp
public class Comic
{
    [JsonPropertyName("release_year")]
    public int ReleaseYear { get; set; }
}
```

- A) It maps the JSON key release_year onto the C# property ReleaseYear
- B) It renames the property at runtime
- C) It makes the property read-only
- D) It is required for every property

**17. Which SOLID principle does taking IEmailSender in the constructor demonstrate?**

```csharp
class OrderService
{
    private readonly IEmailSender _sender;
    public OrderService(IEmailSender sender) => _sender = sender;
}
```

- A) Dependency Inversion: depend on an abstraction, injected from outside
- B) Single Responsibility
- C) Liskov Substitution
- D) Open/Closed

**18. What is the value of d?**

```csharp
object o = "hello";
Dog d = o as Dog;
```

- A) null, because as returns null when the cast fails instead of throwing
- B) A new empty Dog
- C) It throws InvalidCastException
- D) It does not compile

**19. What is printed?**

```csharp
var ages = new Dictionary<string, int>();
ages["Ann"] = 30;
ages["Ann"] = 31;
Console.Write(ages.Count);
```

- A) 1
- B) 2
- C) 0
- D) It throws an exception

**20. What is the effect of await Task.Delay(100) inside this loop?**

```csharp
async Task CountAsync()
{
    for (int i = 1; i <= 3; i++)
    {
        Count = i;
        await Task.Delay(100);
    }
}
```

- A) It pauses 100ms between updates without blocking the UI thread
- B) It blocks the UI thread for 100ms each loop
- C) It runs the whole loop on a background thread
- D) It makes the loop run three times instantly

### Mock Exam 1 - Answer key

**1. A)** Encapsulation  
Encapsulation is information hiding: private fields plus a validating property and a private setter keep a class's internals out of reach so its invariants stay intact. Abstraction is the related but distinct idea of exposing what a type does while hiding how, usually via an interface. On exam code, point at private fields and private or init setters as your encapsulation evidence.

**2. A)** Woof, because override makes the runtime type decide  
With override, method resolution is dynamic: the runtime type (Dog) wins regardless of the variable's declared type (Animal), so it prints Woof. That is runtime polymorphism, exactly what the Problem 1 MCQs love to probe. Contrast with new, which hides instead of overrides and would resolve from the variable's compile-time type and print the base version instead.

**3. A)** Strategy  
Strategy captures a family of interchangeable algorithms behind one interface so the caller can swap behaviour at runtime without changing its own code. Holding an ISortStrategy and delegating to strategy.Sort() is the textbook shape. Observer notifies subscribers of state changes; Adapter converts one interface into another; Singleton restricts a type to a single instance.

**4. A)** A public Name property that raises PropertyChanged; the View binds Name  
[ObservableProperty] on the field _name generates a public PascalCase property Name whose setter raises PropertyChanged, which is what data binding listens for. The View binds the generated property (Name), never the backing field. The class must be partial so the generator can add the member, and inherit ObservableObject for the change-notification plumbing.

**5. A)** An event can only be raised inside the declaring class; a plain delegate field can be invoked by any outside code  
The event keyword restricts access: outside code may only subscribe (+=) or unsubscribe (-=), while raising or invoking is allowed solely inside the declaring class. A bare public delegate field lets anyone invoke or overwrite it, breaking encapsulation. Both are multicast and type-safe; the real win of an event is that controlled invocation, which is why Observer relies on it.

**6. A)** Single Responsibility, because it renders, persists, and emails  
Single Responsibility says a class should have one reason to change. Report mixes three: formatting, file persistence, and email delivery, so a change to any one forces edits here and risks the others. Splitting it into a renderer, a repository, and a mailer gives each one reason to change. SRP is the most common Problem 1 finding, so practise naming the multiple jobs out loud.

**7. A)** Adapter  
Adapter wraps an incompatible type and exposes an interface the client already expects, translating each call across. Implementing ILogger and forwarding to the third-party logger is exactly that. Decorator adds behaviour while keeping the same interface; Facade simplifies a whole subsystem behind one entry point; Strategy swaps interchangeable algorithms. The exam phrasing to recognise is wraps the service.

**8. A)** Horizontal prototype  
Resolution describes how much functionality a prototype implements. A horizontal prototype spreads wide across many features but shallow, so the whole interface is visible while little works underneath. A vertical prototype is the opposite: one complete flow working end to end. Fidelity is a separate axis about how finished it looks, so do not confuse horizontal with low-fidelity.

**9. A)** Each author with how many books they wrote, most-prolific first  
GroupBy(b => b.Author) buckets books by author; Select projects each bucket to its key plus g.Count(); OrderByDescending sorts by that count. The result is one row per author with their book count, highest first. This is the exact shape of the practice exam's number-of-comics-per-author query, so recognise GroupBy then Count then OrderByDescending on sight.

**10. A)** 12  
A Queue is FIFO: first in, first out. Enqueue adds to the back and Dequeue removes from the front, so items leave in the order they arrived, 1 then 2, printing 12. Contrast with a Stack, which is LIFO (Push and Pop at the same end) and would serve the last items first. Knowing which end each structure touches is a recurring trace question.

**11. A)** UI state may only be touched on the UI thread; updating from another thread can crash or corrupt the UI  
Avalonia, like other UI frameworks, is single-threaded for the UI: controls and the bindings that feed them may only be touched on the UI thread. A background worker that writes a bound property directly can throw or leave the UI inconsistent. Dispatcher.UIThread.Post marshals the update back onto the UI thread. This is the thread-safety point Problem 3 explicitly awards marks for.

**12. A)** That calling Withdraw(999) throws an InvalidOperationException  
Assert.Throws<T> passes only if the delegate it runs throws exactly that exception type (or a subclass), and it returns the caught exception so you can inspect its message. Here it verifies that an over-limit withdrawal is rejected with InvalidOperationException. Testing the failure path like this matters as much as the happy path and shows up in the unit-testing problem.

**13. A)** A class can implement many interfaces but inherit only one base class  
C# allows single class inheritance but unlimited interface implementation, so Duck : Animal, IFlyable, ISwimmable is legal. Interfaces here are pure can-do contracts with no fields or constructors, which is why many unrelated types can share one. An abstract class can mix abstract members with fully implemented ones and shared state, but you only get to inherit one.

**14. A)** When q is enumerated (e.g. ToList or foreach), not at the line shown  
LINQ operators like Where are lazy: they build a pipeline but defer execution until you enumerate the result, via foreach, ToList, First, Count, and so on. Until then nothing is filtered, and the query re-runs against the current source each time you enumerate it. Calling ToList materialises a snapshot, which is why exam solutions often end a query with ToList.

**15. A)** AddItemCommand  
[RelayCommand] on a method named AddItem generates a public IRelayCommand property called AddItemCommand: the method name plus a Command suffix. The Button binds Command to AddItemCommand, not to the method. If a command binding silently does nothing, the usual cause is binding the bare method name or forgetting the Command suffix the generator adds.

**16. A)** It maps the JSON key release_year onto the C# property ReleaseYear  
System.Text.Json matches JSON keys to property names case-insensitively but cannot bridge genuinely different names. When the JSON key is release_year and the property is ReleaseYear, [JsonPropertyName("release_year")] tells the serializer they are the same field. Without it the property stays at its default of 0. You only need it when the names actually differ, not on every property.

**17. A)** Dependency Inversion: depend on an abstraction, injected from outside  
Dependency Inversion says high-level code should depend on abstractions, not concrete classes. OrderService depending on IEmailSender (not SmtpEmailSender) and receiving it through the constructor is textbook DIP plus constructor injection. The payoff is testability: a test passes a fake IEmailSender. In exam ViewModels, an injected IRepository is the same pattern to name.

**18. A)** null, because as returns null when the cast fails instead of throwing  
The as operator attempts a reference conversion and yields null on failure rather than throwing, which is why it is always paired with a null check. A hard cast (Dog)o would instead throw InvalidCastException. The modern preferred form is pattern matching: if (o is Dog dog) { ... } both tests and binds in one step. Here o is a string, so d is null.

**19. A)** 1  
Dictionary keys are unique. Assigning ages["Ann"] a second time updates the existing entry rather than adding a new one, so Count stays 1 and the stored value becomes 31. Calling Add("Ann", ...) twice would instead throw because the key already exists; the indexer is the upsert-friendly form. Distinguishing indexer-assign from Add is a common trap.

**20. A)** It pauses 100ms between updates without blocking the UI thread  
await Task.Delay(100) waits asynchronously and returns control to the caller meanwhile, so the UI stays responsive and the loop resumes after each delay on the captured context. It does not freeze the thread the way Thread.Sleep would, and the method continues on the UI context unless told otherwise. This is the async counter shape behind Problem 3's Start button.

---

## Mock Exam 2 (20 MCQs)

**1. A University owns Departments and they vanish if it closes; a Library holds Books that can move to another library. Which describes the University-to-Department link?**

- A) Composition, because the part cannot exist without the whole
- B) Aggregation, because the part can exist independently
- C) Inheritance
- D) Polymorphism

**2. What happens when you compile this?**

```csharp
public abstract class Shape { public abstract double Area(); }
public class Circle : Shape { }
```

- A) Compile error, because Circle must override the abstract Area()
- B) It compiles and Area returns 0
- C) It compiles and Circle becomes abstract automatically
- D) It compiles but throws at runtime when Area is called

**3. Which statement best describes the Observer pattern?**

- A) The Subject keeps a list of observers and notifies them when its state changes
- B) Observers poll the Subject in a loop to detect changes
- C) The Subject and observers share a database they both read
- D) Each observer modifies the Subject directly

**4. What is the core difference between MVC and MVVM?**

- A) MVC uses a Controller to mediate View and Model; MVVM uses a ViewModel with data binding
- B) MVVM removes all business logic from the Model
- C) MVVM is just a newer name for MVC with the same structure
- D) MVC keeps state in the Controller while MVVM keeps it in the Model

**5. Where can Clicked be raised (invoked)?**

```csharp
class Button
{
    public event EventHandler Clicked;
}
```

- A) Only inside Button, the class that declares it
- B) Anywhere that can see the Button instance
- C) Only inside handlers subscribed to it
- D) Only on the UI thread

**6. Which principle does this most clearly violate, and what is the fix?**

```csharp
double Area(Shape s)
{
    switch (s.Type)
    {
        case "circle": return Math.PI * s.R * s.R;
        case "square": return s.Side * s.Side;
    }
    return 0;
}
```

- A) Open/Closed: make Shape abstract with an Area() each subclass overrides
- B) Liskov: replace inheritance with composition
- C) Single Responsibility: split Area into two methods
- D) Interface Segregation: add more interfaces

**7. A class needs to create objects but should not hard-code which concrete type, so it delegates creation to a method that returns the right type behind a shared interface. Which pattern is this?**

- A) Factory
- B) Observer
- C) Adapter
- D) Decorator

**8. In prototyping, what does fidelity refer to (as opposed to resolution)?**

- A) How finished and realistic the prototype looks
- B) How much functionality actually works
- C) How many users tested it
- D) How long it took to build

**9. What does top hold?**

```csharp
var top = players
    .Where(p => p.Active)
    .OrderByDescending(p => p.Score)
    .First();
```

- A) The active player with the highest score
- B) The first active player in list order
- C) All active players sorted by score
- D) The highest score value

**10. What is printed?**

```csharp
var s = new Stack<string>();
s.Push("a"); s.Push("b"); s.Push("c");
Console.Write(s.Pop());
Console.Write(s.Peek());
```

- A) cb
- B) ab
- C) ca
- D) cc

**11. Why does calling a long, synchronous Thread.Sleep(5000) inside a button handler freeze the whole UI?**

- A) It blocks the UI thread, so nothing renders or responds until it returns
- B) It uses too much memory
- C) It runs on a background thread that starves the UI
- D) Sleep is not allowed in Avalonia

**12. An exam test simulates clicking the increment button 100 times then checks the displayed number. What kind of test is this and what does it need?**

- A) A headless Avalonia UI test that drives real controls and asserts the output
- B) A plain unit test that needs no UI at all
- C) A performance benchmark
- D) A manual test that cannot be automated

**13. A base class has several subclasses; each overrides the same method and the correct version runs based on the actual object at runtime. Which principle enables this?**

- A) Polymorphism
- B) Encapsulation
- C) Composition
- D) Abstraction

**14. Why is DefaultIfEmpty(0) here?**

```csharp
var avg = items
    .Where(i => i.Price < 100)
    .Select(i => i.Price)
    .DefaultIfEmpty(0)
    .Average();
```

- A) To stop Average throwing when no item costs under 100, by averaging {0}
- B) To replace every price with 0
- C) To sort the prices
- D) It has no effect

**15. Why bind a ListBox to an ObservableCollection<T> rather than a List<T>?**

- A) ObservableCollection raises CollectionChanged so the UI updates as items are added or removed
- B) List is not generic
- C) ObservableCollection sorts itself
- D) List cannot store reference types

**16. A JSON dataset has some objects missing the optional arrivalDate field. How should the C# model handle this safely?**

- A) Make the property nullable (DateTime?) so a missing value deserializes to null
- B) Throw if any field is missing
- C) Use a non-nullable DateTime defaulted to today
- D) Skip those objects entirely

**17. Which principle is violated, and how is it fixed?**

```csharp
interface IMachine { void Print(); void Scan(); void Fax(); }
class SimplePrinter : IMachine
{
    // Scan and Fax throw NotImplementedException
}
```

- A) Interface Segregation: split IMachine into IPrinter, IScanner, IFax
- B) Liskov: SimplePrinter should not inherit at all
- C) Single Responsibility: merge the methods
- D) Dependency Inversion: inject IMachine

**18. What is this assignment called and is it safe?**

```csharp
Dog d = new Dog();
Animal a = d;
```

- A) Upcasting, which is implicit and always safe
- B) Downcasting, which needs an explicit cast and can fail
- C) Boxing, which wraps a value type
- D) Member hiding

**19. What is printed, and what about iteration order?**

```csharp
var set = new HashSet<int>();
set.Add(5); set.Add(5); set.Add(7);
Console.Write(set.Count);
```

- A) 2, and iteration order is not guaranteed
- B) 3, because duplicates are kept
- C) 2, and items always iterate in insertion order
- D) It throws on the second Add

**20. Problem 3 asks for a counter that increments every 100ms and can pause and resume. Why is a DispatcherTimer a natural fit?**

- A) Its Tick fires on the UI thread at the interval, so updates are thread-safe and Start/Stop pause and resume it
- B) It runs on a background thread for speed
- C) It guarantees exactly 100ms with no drift
- D) It avoids needing any ViewModel state

### Mock Exam 2 - Answer key

**1. A)** Composition, because the part cannot exist without the whole  
Composition is a strong has-a where the part's lifetime is bound to the whole: close the University and its Departments are gone. Aggregation is a weaker has-a where the part can outlive or move between wholes, like Books between libraries. Both are has-a, not is-a, so neither is inheritance. The lifetime test, does the part survive the whole, tells them apart.

**2. A)** Compile error, because Circle must override the abstract Area()  
An abstract method has no body and forms a contract every concrete subclass must fulfil. Circle is declared concrete yet does not implement Area(), so the compiler rejects it. Either implement Area() in Circle with override, or mark Circle abstract too and push the obligation further down. This compile-time enforcement is the entire point of abstract members.

**3. A)** The Subject keeps a list of observers and notifies them when its state changes  
In Observer, the Subject maintains a list of subscribers and pushes a notification to each when its state changes, so observers react without polling. In C# this is typically built on events: subscribers += a handler and the Subject raises the event. It underpins MVVM change notification, where the View observes the ViewModel through PropertyChanged. Push, not poll, is the key idea.

**4. A)** MVC uses a Controller to mediate View and Model; MVVM uses a ViewModel with data binding  
Both separate presentation from data, but the mediator differs. MVC routes user input through a Controller that updates the Model and picks a View. MVVM places a ViewModel between View and Model and connects them with two-way data binding, so the View binds directly to ViewModel properties and commands instead of calling controller actions. The binding layer is what distinguishes MVVM.

**5. A)** Only inside Button, the class that declares it  
An event may be invoked only within the type that declares it; external code can solely subscribe with += or unsubscribe with -=. So Clicked can be raised inside Button, typically via an OnClicked helper, but not by callers holding a Button. That asymmetry is exactly what the delegate-versus-event distinction protects, and it keeps the Observer Subject in charge of when notifications fire.

**6. A)** Open/Closed: make Shape abstract with an Area() each subclass overrides  
Open/Closed says code should be open to extension but closed to modification. This switch must be edited every time a new shape appears, so each addition risks the existing cases. The polymorphic fix makes Shape declare an abstract Area() that Circle and Square each override; adding a Triangle is then a new class with no edits to existing code. Type-tag switches are the classic OCP smell.

**7. A)** Factory  
A Factory centralises object creation behind a method or type that returns instances through a common interface, so callers ask for what they need without naming concrete classes or using new directly. That decouples client code from specific implementations and keeps creation logic in one place. Observer is about notifications, Adapter about interface translation, Decorator about layering behaviour.

**8. A)** How finished and realistic the prototype looks  
Prototypes vary on two independent axes. Fidelity is about appearance: how close the look and feel are to the finished product, from rough sketches (low) to pixel-perfect mockups (high). Resolution is the separate axis of how much actually functions, which is where horizontal versus vertical lives. A prototype can be high-fidelity yet low-resolution: it looks real but nothing works.

**9. A)** The active player with the highest score  
The pipeline filters to active players, sorts them by score from high to low, then First takes the top of that ordering, so top is the highest-scoring active player object, not the score itself. Note First throws if no player is active; FirstOrDefault would return null instead. Reading a Where then OrderByDescending then First chain as get the best matching record is a frequent MCQ.

**10. A)** cb  
A Stack is LIFO. Push adds to the top, so after pushing a, b, c the top is c. Pop removes and returns the top (c). Peek then reads the new top without removing it (b). So the output is cb. The distinction matters: Pop mutates the stack while Peek only looks, a detail trace questions exploit. A Queue, by contrast, would serve a first.

**11. A)** It blocks the UI thread, so nothing renders or responds until it returns  
The UI thread runs a single message loop that processes input, layout, and rendering. A synchronous Thread.Sleep on that thread blocks the loop entirely, so nothing redraws or responds until it returns, which the user sees as a frozen window. The fix is to await an asynchronous wait like Task.Delay, which yields the thread back to the loop while waiting. Never block the UI thread.

**12. A)** A headless Avalonia UI test that drives real controls and asserts the output  
Driving actual buttons and reading a TextBlock requires the controls to exist, so this is a headless Avalonia UI test using Avalonia.Headless.XUnit, which spins up the app without a visible window. Plain ViewModel unit tests skip the UI and call commands directly; they are faster but cannot prove a button is wired. Problem 3 asks for both kinds, so know when each applies.

**13. A)** Polymorphism  
Runtime polymorphism lets one call dispatch to the overriding implementation of whatever concrete type the object actually is, decided at runtime through virtual and override. It is what lets you treat a list of Shape as one type yet get each subclass's own Area(). Encapsulation hides state, abstraction hides how behind an interface, composition is has-a; none of those is the dispatch mechanism.

**14. A)** To stop Average throwing when no item costs under 100, by averaging {0}  
Average throws InvalidOperationException on an empty sequence. If no item is under 100 the filtered sequence is empty, so DefaultIfEmpty(0) injects a single 0 to average instead of crashing, yielding 0. It only kicks in when the sequence is otherwise empty; with data present it changes nothing. This guard is the trap the practice exam's category-average LINQ question hinges on.

**15. A)** ObservableCollection raises CollectionChanged so the UI updates as items are added or removed  
An ObservableCollection implements INotifyCollectionChanged, so adding or removing an item raises CollectionChanged and the bound ListBox updates itself with no extra code. A plain List sends no notifications, so the UI never reflects later changes. Note that replacing the whole collection instance can still break a binding, which is why exam ViewModels expose a get-only ObservableCollection and mutate it in place.

**16. A)** Make the property nullable (DateTime?) so a missing value deserializes to null  
When a JSON key may be absent, the matching C# property should be nullable (DateTime?, string?, or a nullable list) so a missing value deserializes to null instead of a surprising default or an error. The query side then guards with ?. and ?? as needed. The spaceship exam explicitly warns of missing values, and currently-travelling ships are found exactly by arrivalDate == null.

**17. A)** Interface Segregation: split IMachine into IPrinter, IScanner, IFax  
Interface Segregation says no client should be forced to depend on methods it does not use. A fat IMachine makes SimplePrinter implement Scan and Fax it cannot honour, so it throws, which also breaks Liskov downstream. Splitting into focused interfaces (IPrinter, IScanner, IFax) lets each type implement only what it truly supports. Throwing NotImplemented from an interface method is the classic ISP smell.

**18. A)** Upcasting, which is implicit and always safe  
Assigning a derived instance to a base-typed variable is an upcast: implicit and always safe, because a Dog has every member an Animal does. The reverse, treating an Animal variable as a Dog, is a downcast that needs an explicit cast and can throw if the object is not really a Dog. Boxing is the unrelated value-to-object conversion. Passing a Jet where Airplane is expected is the same safe upcast.

**19. A)** 2, and iteration order is not guaranteed  
A HashSet stores only distinct values, so the second Add(5) is a no-op and Count is 2; Add returns false rather than throwing on a duplicate. Crucially its iteration order is not guaranteed and should not be relied on; if you need order, use a List or sort on the way out. Fast membership tests (O(1) Contains) are its strength, which is why it suits dedup and lookup tasks.

**20. A)** Its Tick fires on the UI thread at the interval, so updates are thread-safe and Start/Stop pause and resume it  
A DispatcherTimer raises Tick on the UI thread at the set Interval, so incrementing a bound property in the handler is already on the right thread with no manual marshalling. Stop pauses it while keeping the current count, and Start resumes from there, which matches the Start, Pause, Reset spec exactly. An async Task loop also works, but then you must marshal updates back to the UI thread yourself.

