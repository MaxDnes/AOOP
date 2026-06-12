/* ============ LINQ + DATA & FILES ============ */

window.TOPICS.push(

{
id: "lq-two-syntaxes",
title: "LINQ: method chaining vs query syntax",
cat: "LINQ",
tags: ["linq", "method syntax", "query syntax", "where", "select", "from"],
related: ["lq-filtering-projection", "lq-lazy-evaluation", "cs-action-func"],
blocks: [
  { p: "LINQ (Language Integrated Query) simplifies querying collections. Two equivalent syntaxes; the course (and the exams) lean on **method chaining**, but you must read both." },
  { code: String.raw`var numbers = new List<int> { 1, 2, 3, 4, 5 };

// Method chaining
var evensMethod = numbers.Where(n => n % 2 == 0).ToList();

// Query syntax
var evensQuery = from n in numbers
                 where n % 2 == 0
                 select n;`, lang: "csharp", title: "Same query twice (slide example)" },
  { table: { head: ["Operation", "Method syntax", "Query keyword"], rows: [
    ["Filter (Selection)", "`.Where(p => ...)`", "`where`"],
    ["Project (Projection)", "`.Select(p => ...)`", "`select`"],
    ["Sort", "`.OrderBy/.OrderByDescending/.ThenBy`", "`orderby ... [descending]`"],
    ["Group", "`.GroupBy(p => key)`", "`group p by key into g`"],
    ["Join", "`.Join(inner, ok, ik, result)`", "`join ... on ... equals ...`"],
    ["First/Single/Take", "`.First() / .Single(p) / .Take(n)`", "no query equivalent (slide!)"],
  ]}},
  { p: "The standard course dataset (used in every LINQ slide), for context of the examples in this category:" },
  { code: String.raw`public class Product
{
    public int Id { get; set; }
    public string Name { get; set; }
    public decimal Price { get; set; }
    public string Category { get; set; }
}

List<Product> products =
[
    new Product { Id = 1, Name = "Laptop",     Price = 899.99m, Category = "Electronics" },
    new Product { Id = 2, Name = "Smartphone", Price = 599.99m, Category = "Electronics" },
    new Product { Id = 3, Name = "Tablet",     Price = 499.99m, Category = "Electronics" },
    new Product { Id = 4, Name = "Shoes",      Price = 59.99m,  Category = "Apparel" }
];`, lang: "csharp", title: "The products dataset" },
]},

{
id: "lq-filtering-projection",
title: "Where & Select (filtering + projection)",
cat: "LINQ",
tags: ["where", "select", "filter", "projection", "anonymous type"],
related: ["lq-two-syntaxes", "lq-sorting"],
blocks: [
  { code: String.raw`// SELECTION/FILTERING: rows satisfying a Boolean condition
var cheap = products.Where(p => p.Price < 100).ToList();
// -> Shoes - 59.99

// PROJECTION: pick out fields
var names = products.Select(p => p.Name);
// -> Laptop, Smartphone, Tablet, Shoes

// Project into an ANONYMOUS TYPE (multiple fields):
var nameAndPrice = products.Select(p => new { p.Name, p.Price });

// Combined pipeline (slide example incl. double Select):
var result = products.Where(p => p.Price > 500)
                     .Select(p => new { p.Name, p.Price })
                     .OrderBy(p => p.Price)
                     .Select(p => p.Name)
                     .ToList();
// -> Smartphone, Laptop`, lang: "csharp", title: "Where / Select / chains" },
  { rule: "`Where` keeps whole items that pass the predicate. `Select` transforms each item into something else. Chained operations read left to right like a pipeline." },
]},

{
id: "lq-sorting",
title: "OrderBy, OrderByDescending, ThenBy",
cat: "LINQ",
tags: ["orderby", "orderbydescending", "thenby", "sort", "descending"],
related: ["lq-filtering-projection", "al-sorting-simple"],
blocks: [
  { code: String.raw`// ascending by price
var byPrice = products.OrderBy(p => p.Price).ToList();
// Shoes 59.99, Tablet 499.99, Smartphone 599.99, Laptop 899.99

// descending -- the exams ALWAYS want "most at the top":
var byTripsDesc = ships.OrderByDescending(s => s.TravelHistory?.Count ?? 0).ToList();
var byIngredients = recipes.OrderByDescending(r => r.Ingredients.Count).ToList();

// secondary key:
var sorted = products.OrderBy(p => p.Category)
                     .ThenByDescending(p => p.Price)
                     .ToList();

// query syntax:
var q = from p in products
        orderby p.Price descending
        select p;`, lang: "csharp", title: "Sorting recipes (incl. both exam queries)" },
  { gotcha: "OrderBy returns a NEW sorted sequence; the source list is untouched. `list.Sort()` (List method, needs IComparable) sorts in place. Know both." },
]},

{
id: "lq-grouping-aggregation",
title: "GroupBy + aggregation (Sum/Avg/Min/Max/Count)",
cat: "LINQ",
tags: ["groupby", "sum", "average", "min", "max", "count", "aggregate", "group key"],
related: ["lq-join", "lq-cookbook"],
blocks: [
  { code: String.raw`// Plain aggregation over the whole set (slide outputs included):
decimal totalPrice = products.Sum(p => p.Price);       // 2059.96
decimal avgPrice   = products.Average(p => p.Price);   // 514.99
decimal maxPrice   = products.Max(p => p.Price);       // 899.99
decimal minPrice   = products.Min(p => p.Price);       // 59.99
int productCount   = products.Count();                 // 4`, lang: "csharp", title: "Aggregates" },
  { code: String.raw`// GROUPING: split into groups by key
var groups = products.GroupBy(p => p.Category).ToList();

foreach (var group in groups)
{
    Console.WriteLine(group.Key);                 // the grouping key
    foreach (var product in group)                // the group is itself iterable
        Console.WriteLine($"  {product.Name} - {product.Price}");
}
// Electronics: Laptop, Smartphone, Tablet / Apparel: Shoes

// query syntax:
var q = from p in products
        group p by p.Category into g
        select g;`, lang: "csharp", title: "GroupBy basics" },
  { code: String.raw`// GROUP + AGGREGATE PER GROUP -- the single most exam-relevant LINQ shape:
var summary = products
    .GroupBy(p => p.Category)
    .Select(g => new
    {
        Category   = g.Key,
        TotalPrice = g.Sum(p => p.Price),
        AvgPrice   = g.Average(p => p.Price),
        Count      = g.Count()
    });
// Electronics: Total 1999.97, Avg 666.66, Count 3
// Apparel:     Total 59.99,   Avg 59.99,  Count 1

// June exam variant: average number of trips per ship type:
var avgTripsPerType = ships
    .GroupBy(s => s.Type)
    .Select(g => new { Type = g.Key, Avg = g.Average(s => s.TravelHistory?.Count ?? 0) });`, lang: "csharp", title: "GroupBy + Select aggregate (memorize this shape)" },
]},

{
id: "lq-join",
title: "Join: combining two datasets",
cat: "LINQ",
tags: ["join", "inner join", "key selector", "merge", "two collections"],
related: ["lq-grouping-aggregation", "lq-cookbook"],
blocks: [
  { rule: "Argument order to memorize: `outer.Join(inner, outerKeySelector, innerKeySelector, resultSelector)`." },
  { code: String.raw`public class Sale
{
    public int ProductId { get; set; }
    public int QuantitySold { get; set; }
    public DateTime Date { get; set; }
    public Sale(int productId, int quantitySold, DateTime date)
    {
        ProductId = productId; QuantitySold = quantitySold; Date = date;
    }
}

List<Sale> sales =
[
    new Sale(1, 5,  new DateTime(2024, 3, 1)),
    new Sale(2, 10, new DateTime(2024, 3, 2)),
    new Sale(3, 7,  new DateTime(2024, 3, 3)),
    new Sale(1, 3,  new DateTime(2024, 3, 4)),
    new Sale(4, 20, new DateTime(2024, 3, 5))
];

// The slide's join, verbatim:
var salesReport = sales.Join(products,
    sale => sale.ProductId,            // key from the OUTER (sales)
    product => product.Id,             // key from the INNER (products)
    (sale, product) => new             // result combining both
    {
        product.Name,
        product.Category,
        product.Price,
        sale.QuantitySold,
        TotalRevenue = product.Price * sale.QuantitySold,   // computed property!
        sale.Date
    });

foreach (var row in salesReport)
    Console.WriteLine($"{row.Date:d} - {row.Name} ({row.Category}): " +
        $"{row.QuantitySold} units at {row.Price} for {row.TotalRevenue}");`, lang: "csharp", title: "Join with computed revenue (slide example)" },
  { code: String.raw`// Query syntax equivalent:
var report = from sale in sales
             join product in products on sale.ProductId equals product.Id
             select new { product.Name, sale.QuantitySold };`, lang: "csharp" },
]},

{
id: "lq-first-single-take",
title: "First, Single, Take, Any, All, Contains, Distinct",
cat: "LINQ",
tags: ["first", "single", "take", "any", "all", "contains", "distinct", "firstordefault", "oftype"],
related: ["lq-lazy-evaluation", "col-hashset"],
blocks: [
  { p: "Slide statement: if you only need a subset of your result, use First, Single or Take. **There is no query-syntax equivalent** (a stated exam fact)." },
  { code: String.raw`var firstProduct = products.First();                       // first element (throws if empty)
var firstCheap   = products.First(p => p.Price < 100);     // first matching
var maybe        = products.FirstOrDefault(p => p.Id == 99); // null instead of throwing

var single = products.Single(p => p.Name == "Laptop");
// Single = EXACTLY ONE match; throws if zero OR more than one

var firstThree = products.Take(3).ToList();                // first 3
var afterTwo   = products.Skip(2).ToList();                // everything after the first 2`, lang: "csharp", title: "Element + subset operators" },
  { code: String.raw`bool anyCheap   = products.Any(p => p.Price < 100);       // does at least one match?
bool nonEmpty   = sales.Any();                             // any elements at all?
bool allCheap   = products.All(p => p.Price < 1000);       // do ALL match?
bool hasTag     = recipe.DietaryTags.Contains("Vegetarian");

var uniqueIngredients = mealPlan
    .SelectMany(r => r.Ingredients)    // flatten lists-of-lists
    .Distinct()                        // remove duplicates
    .OrderBy(i => i)
    .ToList();                         // = the ShoppingListGenerator logic!

var summarizables = mixedList.OfType<ISummarizable>();     // filter by runtime type`, lang: "csharp", title: "Any / All / Contains / Distinct / SelectMany / OfType" },
  { gotcha: "`First` vs `Single`: First grabs the first match and ignores the rest; Single ASSERTS uniqueness and throws `InvalidOperationException` on 0 or 2+ matches. The exams used Single for \"the single matching product\"." },
]},

{
id: "lq-lazy-evaluation",
title: "Lazy evaluation (deferred execution)",
cat: "LINQ",
tags: ["lazy evaluation", "deferred execution", "tolist", "immediate", "when does it run"],
related: ["lq-two-syntaxes", "col-interfaces-hierarchy"],
blocks: [
  { def: "LINQ uses lazy evaluation: queries are not executed when they are defined. Execution is delayed until the results are actually needed.", term: "Lazy evaluation (the course's term for deferred execution)" },
  { table: { head: ["Deferred (just builds the query)", "Immediate (forces execution)"], rows: [
    ["`.Where()`", "`.ToList()` / `.ToArray()`"],
    ["`.Select()`", "`.First()` / `.Single()`"],
    ["`.OrderBy()`", "aggregations: `.Count()`, `.Sum()`, `.Average()`, `.Max()`, `.Min()`"],
    ["`.GroupBy()`, `.Join()`, `.Take()`", "iterating with `foreach`"],
  ]}},
  { code: String.raw`List<int> numbers = new List<int> { 1, 2, 3, 4, 5 };

var query = numbers.Where(n =>
{
    Console.WriteLine($"Filtering: {n}");
    return n % 2 == 0;
});

Console.WriteLine("Query defined but not executed.");
var resultList = query.ToList();        // execution happens HERE

// Output order:
// Query defined but not executed.
// Filtering: 1 ... Filtering: 5`, lang: "csharp", title: "Deferred: the marker line prints FIRST" },
  { code: String.raw`var resultList = numbers.Where(n =>
{
    Console.WriteLine($"Filtering: {n}");
    return n % 2 == 0;
}).ToList();                            // .ToList() right away = immediate

Console.WriteLine("Query was executed.");

// Output order:
// Filtering: 1 ... Filtering: 5
// Query was executed.`, lang: "csharp", title: "Immediate: filtering prints FIRST" },
  { tip: "Predicting that output order is a likely exam question: the ONLY difference between the two snippets is where `.ToList()` sits. Bonus gotcha: a deferred query re-executes every time you iterate it; ToList() once if you need the results twice." },
]},

{
id: "lq-cookbook",
title: "LINQ cookbook: every past exam query solved",
cat: "LINQ",
tags: ["cookbook", "exam queries", "practice", "solutions", "linq exercises"],
related: ["pb-linq-json", "ex-june-p4-linq", "ex-reexam-p4-linq"],
blocks: [
  { p: "All queries the course has ever asked, with solutions: 6 practice (LINQ_Query_Examples.cs) + 5 June exam + 4 August exam." },
  { h: "Practice file queries (products/sales dataset)" },
  { code: String.raw`// Query 1 - Find all Electronics
var electronics = products.Where(p => p.Category == "Electronics").ToList();

// Query 2 - Names of products priced 50..100
var names = products
    .Where(p => p.Price >= 50 && p.Price <= 100)
    .Select(p => p.Name)
    .ToList();

// Query 3 - The cheapest product
var cheapest = products.OrderBy(p => p.Price).First();
// (or: products.MinBy(p => p.Price) in .NET 6+)

// Query 4 - Total quantity of all items sold
int totalSold = sales.Sum(s => s.QuantitySold);

// Query 5 - Best-selling product (by quantity)
var bestSeller = sales
    .GroupBy(s => s.ProductId)
    .Select(g => new { ProductId = g.Key, Total = g.Sum(s => s.QuantitySold) })
    .OrderByDescending(x => x.Total)
    .Join(products, x => x.ProductId, p => p.Id,
          (x, p) => new { p.Name, x.Total })
    .First();

// Query 6 - Average revenue per year
var avgRevenuePerYear = sales
    .Join(products, s => s.ProductId, p => p.Id,
          (s, p) => new { s.Date.Year, Revenue = p.Price * s.QuantitySold })
    .GroupBy(x => x.Year)
    .Select(g => new { Year = g.Key, AvgRevenue = g.Average(x => x.Revenue) });`, lang: "csharp", title: "Practice queries 1–6 solved" },
  { h: "June 2025 (spaceships) & August 2025 (recipes)" },
  { p: "Solved in full inside the playbook: [[pb-linq-json|Problem 4 playbook]]. Patterns they drilled:" },
  { table: { head: ["Asked", "Shape"], rows: [
    ["all X of a kind", "`Where(x => x.Prop == value)`"],
    ["items where a nested list has a null field", "`Where(x => (x.List ?? new()).Any(t => t.Field == null))`"],
    ["sorted by count, most first", "`OrderByDescending(x => x.List?.Count ?? 0)`"],
    ["average of a count per group", "`GroupBy(key).Select(g => new { g.Key, Avg = g.Average(...) })`"],
    ["nested condition + year", "`Any(t => t.Port == \"...\" && t.Date?.Year == 2245)`"],
    ["items with empty tag list", "`Where(r => r.DietaryTags.Count == 0)` or `!r.DietaryTags.Any()`"],
    ["above-average comparison", "compute `var avg = list.Average(...)` FIRST, then `Where(x => x.N > avg)`"],
  ]}},
]},

/* ============ DATA & FILES ============ */

{
id: "df-file-handling",
title: "File handling (System.IO)",
cat: "Data & Files",
tags: ["file", "read", "write", "append", "exists", "relative path", "streamreader"],
related: ["df-json", "cs-exceptions", "av-file-dialogs"],
blocks: [
  { code: String.raw`using System.IO;

// Whole-file operations -- 95% of exam needs:
File.WriteAllText("filename.txt", "Hello World!");      // create/overwrite
string readText = File.ReadAllText("filename.txt");     // read everything
File.AppendAllText("log.txt", line + Environment.NewLine);

string[] lines = File.ReadAllLines("data.txt");          // line array
File.WriteAllLines("data.txt", lines);

bool exists = File.Exists("contacts.json");              // ALWAYS check before reading`, lang: "csharp", title: "File one-liners" },
  { rule: "Slide rule: \"(almost) never use absolute paths. Instead, use relative file paths.\" Relative paths resolve against the working directory: with `dotnet run` that's the project folder; running the built exe it's bin/Debug/... Keep data files next to where you run from, or set CopyToOutputDirectory." },
  { code: String.raw`// Stream-based variant (used with Avalonia file dialogs):
await using var stream = await file.OpenReadAsync();
using var reader = new StreamReader(stream);
string content = await reader.ReadToEndAsync();`, lang: "csharp", title: "Streams (dialog flavor)" },
  { code: String.raw`// Defensive load pattern (repository style):
public ObservableCollection<Contact> Load(string filename)
{
    if (!File.Exists(filename))
        return new ObservableCollection<Contact>();
    return JsonSerializer.Deserialize<ObservableCollection<Contact>>(
        File.ReadAllText(filename))!;
}`, lang: "csharp", title: "Load-or-empty pattern (course solution)" },
]},

{
id: "df-json",
title: "JSON: System.Text.Json end to end",
cat: "Data & Files",
tags: ["json", "serialize", "deserialize", "jsonserializer", "writeindented", "camelcase", "missing values"],
related: ["pb-linq-json", "df-file-handling", "mv-contactlist-full"],
blocks: [
  { def: "JSON (JavaScript Object Notation) is an open standard data exchange format; in this course it adds persistence to C# applications. Alternatives: XML and CSV.", term: "JSON" },
  { code: String.raw`using System.Text.Json;

// SERIALIZE (no type argument needed):
var john = new Contact { Name = "John Doe", Email = "john@doe.com" };
File.WriteAllText("john.json", JsonSerializer.Serialize(john));
// {"Name":"John Doe","Email":"john@doe.com"}

List<Contact> contacts = [john, new Contact { Name = "Jane Doe", Email = "jane@doe.com" }];
File.WriteAllText("contacts.json", JsonSerializer.Serialize(contacts));

// DESERIALIZE (explicit type REQUIRED):
Contact? c = JsonSerializer.Deserialize<Contact>(File.ReadAllText("john.json"));
List<Contact> all = JsonSerializer.Deserialize<List<Contact>>(File.ReadAllText("contacts.json"))!;`, lang: "csharp", title: "Round trip (slide example)" },
  { code: String.raw`// Useful options:
var options = new JsonSerializerOptions
{
    WriteIndented = true,                        // pretty output (exam asked for readable files)
    PropertyNameCaseInsensitive = true,          // tolerate name-case mismatches when reading
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase   // write camelCase names
};
File.WriteAllText("out.json", JsonSerializer.Serialize(data, options));`, lang: "csharp", title: "JsonSerializerOptions" },
  { rule: "Missing values in the data (June exam!): model them as nullable (`List<Trip>? TravelHistory`, `DateTime? ArrivalDate`). Deserialization then leaves them null instead of throwing, and your queries handle null with `?.` and `??`." },
  { code: String.raw`// Saving multiple query results as ONE object (August exam 4.2):
var results = new
{
    vegetarianRecipes       = vegetarian,
    noDietaryRestrictions   = noRestrictions,
    sortedByIngredientCount = sortedByCount,
    aboveAverageIngredients = aboveAverage
};
File.WriteAllText("Problem_4_Query_Results.json",
    JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true }));
// anonymous-type property names become the JSON keys exactly as written`, lang: "csharp", title: "Combined results file" },
]},

{
id: "df-csv",
title: "CSV parsing (manual + CSVHelper)",
cat: "Data & Files",
tags: ["csv", "csvhelper", "split", "parse", "delimiter"],
related: ["df-file-handling", "df-json"],
blocks: [
  { p: "The repetition list names \"Parsing JSON and CSV (CSVHelper)\". CSVHelper is a NuGet package; at the exam only System libraries are guaranteed, so know the manual way first." },
  { code: String.raw`// data.csv:
// Name,Email,Age
// John Doe,john@doe.com,42
// Jane Doe,jane@doe.com,40

var people = new List<Person>();
string[] lines = File.ReadAllLines("data.csv");

foreach (string line in lines.Skip(1))          // Skip(1) = skip the header row
{
    string[] parts = line.Split(',');
    if (parts.Length < 3) continue;             // defensive: skip malformed rows

    people.Add(new Person
    {
        Name  = parts[0].Trim(),
        Email = parts[1].Trim(),
        Age   = int.TryParse(parts[2], out int a) ? a : 0
    });
}

// writing CSV:
var outLines = new List<string> { "Name,Email,Age" };
outLines.AddRange(people.Select(p => $"{p.Name},{p.Email},{p.Age}"));
File.WriteAllLines("out.csv", outLines);`, lang: "csharp", title: "Manual CSV (always available)" },
  { code: String.raw`// CSVHelper (if the package is available): dotnet add package CsvHelper
using CsvHelper;
using System.Globalization;

using var reader = new StreamReader("data.csv");
using var csv = new CsvReader(reader, CultureInfo.InvariantCulture);
List<Person> people = csv.GetRecords<Person>().ToList();   // maps header -> properties`, lang: "csharp", title: "CSVHelper version" },
]},

{
id: "df-csv-exam-legal",
title: "CSV without CSVHelper (exam-legal parsing)",
cat: "Data & Files",
tags: ["csv", "exam-legal", "no csvhelper", "quote-aware", "quoted comma", "tryparse", "nullable", "split"],
related: ["df-csv", "df-file-handling", "df-json", "pb-linq-json"],
blocks: [
  { p: "If P4 hands you a CSV instead of JSON, you still cannot reach for CSVHelper. The exam allows only System, Avalonia and CommunityToolkit.Mvvm, and CSVHelper is none of those, so a using for it does not compile against the allowed-libraries rule. The whole job is doable with System.IO and a tiny hand-written splitter. This is the same shape Query Lab emits when it detects CSV, so you can read its output and trust it." },
  { p: "A plain string.Split(',') is not enough: any value that itself contains a comma is written quoted in CSV, and Split tears it into two columns. The fix is a small state loop that flips an inQuotes flag on every quote and only treats a comma as a separator while you are outside quotes." },
  { code: String.raw`using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

// Quote-aware splitter: a small state loop, NOT string.Split, so a comma
// inside a quoted field does not end the column.
static List<string> SplitCsvLine(string line)
{
    var fields = new List<string>();
    var current = new StringBuilder();
    bool inQuotes = false;
    for (int i = 0; i < line.Length; i++)
    {
        char ch = line[i];
        if (ch == '"')
        {
            if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
            { current.Append('"'); i++; }      // "" inside quotes = one literal quote
            else
                inQuotes = !inQuotes;            // toggle in/out of a quoted field
        }
        else if (ch == ',' && !inQuotes)
        { fields.Add(current.ToString()); current.Clear(); }
        else
            current.Append(ch);
    }
    fields.Add(current.ToString());             // last field, no trailing comma
    return fields;
}`, lang: "csharp", title: "Quote-aware splitter (the 10-line state loop)" },
  { code: String.raw`// data.csv (note the planted gaps):
// Name,Type,Crew,FuelLevel
// Nostromo,Hauler,7,88.5
// "Serenity, II",Transport,,55      <- quoted comma in Name + empty Crew cell
// Rocinante,Frigate,4               <- missing trailing FuelLevel column

public class Ship
{
    public string? Name { get; set; }       // every column nullable: cells can be empty
    public string? Type { get; set; }
    public int? Crew { get; set; }
    public double? FuelLevel { get; set; }
}

static List<Ship> ParseCsv(string path)
{
    var ships = new List<Ship>();
    string[] lines = File.ReadAllLines(path);
    foreach (string line in lines.Skip(1))     // Skip(1) drops the header row
    {
        if (string.IsNullOrWhiteSpace(line)) continue;   // ignore blank lines
        var c = SplitCsvLine(line);
        ships.Add(new Ship
        {
            Name      = Get(c, 0),
            Type      = Get(c, 1),
            Crew      = int.TryParse(Get(c, 2), out int cr) ? cr : (int?)null,
            FuelLevel = double.TryParse(Get(c, 3), out double f) ? f : (double?)null,
        });
    }
    return ships;
}

// index-safe getter: a missing trailing column reads as null, never an
// IndexOutOfRangeException, and an empty cell also reads as null.
static string? Get(List<string> cells, int i) =>
    i < cells.Count && cells[i].Trim().Length > 0 ? cells[i].Trim() : null;`, lang: "csharp", title: "ParseCsv with TryParse + nullable fallbacks" },
  { rule: "Planted missing values are the whole point of the P4 data, same as the JSON nulls. Model every column as nullable, use TryParse so a bad or empty cell lands as null instead of throwing, then let your LINQ handle it with ?. and ??. After ParseCsv the rest is identical to JSON mode: the same Where/GroupBy/OrderBy queries and the same Problem_4_Query_Results.json write with WriteIndented." },
  { gotcha: "Two traps the naive Split hits: a quoted comma like \"Serenity, II\" must stay one field (the inQuotes flag handles it), and a row with an empty trailing column, or a whole column dropped off the end, must not crash. Reading cells through the index-safe Get above makes both the empty cell and the missing column resolve to null. Doubled quotes \"\" inside a quoted field mean one literal quote character." },
  { p: "Query Lab automates all of this end to end: paste the CSV, it infers the model, generates this exact ParseCsv plus the splitter, wires your queries, and exports the console project that builds and writes Problem_4_Query_Results.json. See [[pb-linq-json|the Problem 4 playbook]] for the query side." },
]},

{
id: "lq-lambda",
title: "Lambda expressions (LINQ's fuel)",
cat: "LINQ",
tags: ["lambda", "expression", "anonymous function", "func", "predicate"],
related: ["cs-action-func", "lq-two-syntaxes"],
blocks: [
  { def: "Lambda expressions provide a concise way to define anonymous methods. Syntax: (parameters) => expression.", term: "Lambda" },
  { code: String.raw`Func<int, int, int> addNumbers = (a, b) => a + b;
int result = addNumbers(3, 4);    // 7

// In LINQ, every operator takes a lambda:
products.Where(p => p.Price < 100)        // Func<Product, bool>  (a predicate)
products.Select(p => p.Name)              // Func<Product, string>
products.OrderBy(p => p.Price)            // Func<Product, decimal> (key selector)
products.Sum(p => p.Price)                // Func<Product, decimal>

// Multi-statement body needs braces + return:
var query = numbers.Where(n =>
{
    Console.WriteLine($"Filtering: {n}");
    return n % 2 == 0;
});`, lang: "csharp", title: "Lambdas in context" },
]}

);
