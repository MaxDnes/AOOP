/* ============ COLLECTIONS & GENERICS ============ */

window.TOPICS.push(

{
id: "col-overview",
title: "Collections: which one when",
cat: "Collections & Generics",
tags: ["collections", "overview", "list", "dictionary", "hashset", "queue", "stack", "complexity"],
related: ["col-list-array", "col-dictionary", "col-queue-stack", "al-collection-complexity"],
blocks: [
  { p: "Everything lives in `System.Collections.Generic`. Picker table first, details per type after:" },
  { table: { head: ["Type", "Shape", "Pick it for", "Lookup speed"], rows: [
    ["`List<T>`", "dynamic array", "default ordered collection, index access", "O(1) by index, O(n) by value"],
    ["`Dictionary<K,V>`", "hashed key→value", "lookup tables, caching, counting by key", "O(1) by key"],
    ["`HashSet<T>`", "hashed unique set", "dedup + fast Contains + set ops", "O(1) Contains"],
    ["`Queue<T>`", "FIFO", "task scheduling, printing jobs", "O(1) ends only"],
    ["`Stack<T>`", "LIFO", "undo/redo, navigation history", "O(1) top only"],
    ["`LinkedList<T>`", "doubly linked nodes", "many inserts/removals mid-sequence", "O(1) insert at node, O(n) find"],
    ["`ObservableCollection<T>`", "List + change events", "anything bound to UI", "as List"],
    ["`T[]` array", "fixed size", "size known and constant", "O(1) by index"],
  ]}},
  { code: String.raw`using System.Collections.Generic;

List<int> numbers = new List<int> { 1, 2, 3 };
numbers.Add(4);
Console.WriteLine(numbers[0]);   // 1`, lang: "csharp", title: "Slide intro example" },
]},

{
id: "col-list-array",
title: "List<T> vs Array",
cat: "Collections & Generics",
tags: ["list", "array", "add", "remove", "insert", "convertall", "fixed size", "dynamic"],
related: ["col-overview", "lq-filtering-projection"],
blocks: [
  { list: [
    "**Array**: fixed-size, same-type elements; size cannot change after initialization; uses less memory.",
    "**List**: dynamic resizing; rich built-in methods; the default choice when the count changes at runtime.",
  ]},
  { code: String.raw`// Growing an array manually -- the slide's motivation for List<T>:
int[] numbersArray = new int[] { 1, 2, 3, 4 };
int newNumber = 5;
int[] newArray = new int[numbersArray.Length + 1];
for (int i = 0; i < numbersArray.Length; i++)
    newArray[i] = numbersArray[i];
newArray[newArray.Length - 1] = newNumber;   // ...List<T>.Add does all of this`, lang: "csharp", title: "Why List exists" },
  { code: String.raw`var words = new List<string>();

words.Add("melon");
words.AddRange(["banana", "plum"]);

words.Insert(0, "lemon");                  // insert at index
words.InsertRange(0, ["peach", "nashi"]);

words.Remove("melon");                     // by value (first match)
words.RemoveAt(3);                         // by index
words.RemoveAll(s => s.StartsWith("n"));   // by predicate

bool has = words.Contains("plum");
int where = words.IndexOf("plum");
words.Sort();                              // uses IComparable
words.Reverse();

List<string> upper  = words.ConvertAll(s => s.ToUpper());
List<int> lengths   = words.ConvertAll(s => s.Length);
Spaceship? found    = ships.Find(s => s.Name == "Rocinante");   // first match or null`, lang: "csharp", title: "List<T> API tour (slide examples + exam extras)" },
]},

{
id: "col-dictionary",
title: "Dictionary<TKey,TValue>",
cat: "Collections & Generics",
tags: ["dictionary", "key value", "trygetvalue", "keyvaluepair", "hashed", "lookup"],
related: ["col-hashset", "th-locking-collections"],
blocks: [
  { list: [
    "Stores key-value pairs; **each key is unique**; keys are hashed for very fast lookup.",
    "Use cases from the slides: mapping related data, lookup tables, caching, counting occurrences.",
  ]},
  { code: String.raw`Dictionary<string, int> ages = new Dictionary<string, int>
{
    { "Alice", 25 }, { "Bob", 30 }
};

Console.WriteLine(ages["Alice"]);      // 25  (throws KeyNotFoundException if missing!)

ages["David"] = 40;                    // add OR overwrite
ages.Remove("Bob");
bool there = ages.ContainsKey("Alice");

// SAFE lookup -- the slide's TryGetValue pattern:
int val = 0;
if (!ages.TryGetValue("Olice", out val))
    Console.WriteLine("No val");       // misspelled key handled gracefully

// iteration is over KeyValuePair:
foreach (KeyValuePair<string, int> kv in ages)
    Console.WriteLine($"{kv.Key} = {kv.Value}");`, lang: "csharp", title: "Dictionary essentials (slide example)" },
  { code: String.raw`// Counting occurrences -- classic exam-style usage:
var counts = new Dictionary<string, int>();
foreach (var word in words)
{
    if (counts.ContainsKey(word)) counts[word]++;
    else counts[word] = 1;
}`, lang: "csharp", title: "Count-by-key idiom" },
]},

{
id: "col-hashset",
title: "HashSet<T> & SortedSet<T>",
cat: "Collections & Generics",
tags: ["hashset", "sortedset", "contains", "duplicates", "union", "intersect", "set"],
related: ["col-dictionary", "lq-first-single-take"],
blocks: [
  { list: [
    "`Contains` executes quickly via hash-based lookup.",
    "Only the element itself is stored once; duplicate adds are silently ignored (no count, no duplicates kept).",
    "No positional access (no indexer).",
    "Iteration order is NOT guaranteed — never rely on a HashSet preserving insertion or any particular order. Use `SortedSet<T>` if you need ordered iteration.",
    "Fast set operations: Union, Intersection, Difference. `SortedSet<T>` keeps elements ordered.",
    "Slide trivia: the key set of a Dictionary is essentially a HashSet.",
  ]},
  { code: String.raw`var letters = new HashSet<char>("the quick brown fox");

Console.WriteLine(letters.Contains('t'));   // true
Console.WriteLine(letters.Contains('j'));   // false

foreach (char c in letters) Console.Write(c);
// duplicates dropped; iteration order is NOT guaranteed (do not rely on it)`, lang: "csharp", title: "The slide's dedup demo" },
  { code: String.raw`var a = new HashSet<int> { 1, 2, 3, 4 };
var b = new HashSet<int> { 3, 4, 5 };

a.UnionWith(b);        // a = {1,2,3,4,5}
a.IntersectWith(b);    // a = {3,4,5}
a.ExceptWith(b);       // difference

// dedup a list while keeping a List result:
var unique = myList.Distinct().ToList();   // LINQ sibling`, lang: "csharp", title: "Set operations" },
]},

{
id: "col-queue-stack",
title: "Queue, Stack & LinkedList",
cat: "Collections & Generics",
tags: ["queue", "stack", "fifo", "lifo", "enqueue", "dequeue", "push", "pop", "peek", "linkedlist"],
related: ["col-overview"],
blocks: [
  { table: { head: ["", "Queue<T> (FIFO)", "Stack<T> (LIFO)"], rows: [
    ["Mental model", "supermarket queue", "stack of plates"],
    ["Add", "`Enqueue(item)`", "`Push(item)`"],
    ["Remove + return", "`Dequeue()` (front)", "`Pop()` (top)"],
    ["Look without removing", "`Peek()`", "`Peek()`"],
    ["Use cases (slides)", "task scheduling, print jobs", "undo/redo, navigation"],
  ]}},
  { code: String.raw`Queue<string> queue = new Queue<string>();
queue.Enqueue("Task1");
queue.Enqueue("Task2");
Console.WriteLine(queue.Dequeue());   // Task1  (first in, first out)

Stack<int> stack = new Stack<int>();
stack.Push(10);
stack.Push(20);
Console.WriteLine(stack.Pop());       // 20     (last in, first out)`, lang: "csharp", title: "Slide examples with outputs" },
  { def: "A doubly linked list is a chain of nodes, each referencing the node before, the node after, and the element. Very fast for inserting and removing a node, slow at lookup.", term: "LinkedList<T>" },
  { code: String.raw`var list = new LinkedList<string>();
list.AddLast("b");
list.AddFirst("a");                       // a <-> b
LinkedListNode<string>? node = list.Find("a");
if (node != null) list.AddAfter(node, "a2");   // O(1) once you HAVE the node
// list.First / list.Last; node.Previous / node.Next / node.Value`, lang: "csharp" },
]},

{
id: "col-interfaces-hierarchy",
title: "IEnumerable / ICollection / IList hierarchy",
cat: "Collections & Generics",
tags: ["ienumerable", "icollection", "ilist", "ienumerator", "movenext", "yield", "foreach", "hierarchy"],
related: ["lq-lazy-evaluation", "col-overview"],
blocks: [
  { p: "The capability ladder from the Collections lecture (both non-generic and generic sides):" },
  { table: { head: ["Interface", "Adds", "Course annotation"], rows: [
    ["`IEnumerator<T>`", "`MoveNext()`, `Current` (returned by GetEnumerator)", "the iteration engine"],
    ["`IEnumerable<T>`", "`GetEnumerator()`", "\"Enumeration only\" — anything foreach-able / LINQ-able"],
    ["`ICollection<T>`", "`Add`, `Remove`, `Count`, `Contains`", "\"Countable\""],
    ["`IList<T>` / `IDictionary<K,V>`", "indexer access etc.", "\"Rich functionality\""],
  ]}},
  { code: String.raw`// What foreach actually does -- manual enumerator use (slide verbatim):
IEnumerable<int> numbers = new List<int> { 1, 2, 3, 4, 5 };

IEnumerator<int> enumerator = numbers.GetEnumerator();
while (enumerator.MoveNext())
{
    Console.WriteLine(enumerator.Current);
}`, lang: "csharp", title: "Under the hood of foreach" },
  { code: String.raw`ICollection<int> nums = new List<int> { 1, 2, 3, 4 };
nums.Add(5);
nums.Remove(3);
int count = nums.Count;   // 4  <- slide arithmetic: 4 +1 -1`, lang: "csharp", title: "ICollection slide example (Count ends at 4)" },
  { code: String.raw`// yield return: write your own lazy IEnumerable
public static IEnumerable<int> Evens(int max)
{
    for (int i = 0; i <= max; i += 2)
        yield return i;          // produced one at a time, on demand
}

foreach (int n in Evens(10)) Console.Write(n + " ");   // 0 2 4 6 8 10`, lang: "csharp", title: "Iterator methods (yield)" },
  { tip: "Why exam method signatures use IEnumerable<Recipe> instead of List<Recipe>: callers can pass ANY collection, and implementations can stay lazy. Accept the loosest interface you need; return what you actually have." },
]},

{
id: "col-generics-2",
title: "Generic collections you build yourself",
cat: "Collections & Generics",
tags: ["generics", "collector", "pair", "generic class"],
related: ["cs-generics", "col-overview"],
blocks: [
  { code: String.raw`// One class, any element type (slide example):
class Collector<T>
{
    public T[] items { get; set; }
}
Collector<int> intList = new Collector<int>();

// Two type parameters:
public class Pair<T, U>
{
    public T First { get; set; }
    public U Second { get; set; }
}
var pair = new Pair<int, string> { First = 1, Second = "One" };`, lang: "csharp", title: "Custom generic types" },
  { list: [
    "Generics advantages triple (slide, repeat verbatim if asked): **type safety** (compile-time checks), **performance** (no boxing/conversions), **reusability** (one implementation, many types).",
  ]},
]}

);
