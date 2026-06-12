/* ============ ALGORITHMS & BIG-O ============ */

window.TOPICS.push(

{
id: "al-bigo",
title: "Big-O: the rules of the game",
cat: "Algorithms & Big-O",
tags: ["big o", "complexity", "runtime", "growth", "worst case", "theta", "omega", "nested loops"],
related: ["al-collection-complexity", "al-search", "al-sorting-simple"],
blocks: [
  { rule: "THE BIG IDEA (highlighted in red on the slide): **Ignore machine-dependent constants. Look at the GROWTH of T(n) as n → ∞.**" },
  { table: { head: ["Analysis kind", "Measures", "Notation", "Course attitude"], rows: [
    ["Worst-case (usually)", "max time over any input of size n", "O — upper bound", "the default"],
    ["Average-case (sometimes)", "expected time over all inputs of size n", "Θ — tight bound", "needs an input distribution assumption"],
    ["Best-case (bogus)", "min time", "Ω — lower bound", "\"cheat with a slow algorithm that works fast on some input\""],
  ]}},
  { h: "Growth rates (slide table + chart zones)" },
  { table: { head: ["Function", "Name", "Chart zone"], rows: [
    ["c", "Constant", "green (fast)"],
    ["log N", "Logarithmic", "green"],
    ["log² N", "Log-squared", "green-ish"],
    ["N", "Linear", "orange"],
    ["N log N", "Linearithmic", "orange/red boundary"],
    ["N²", "Quadratic", "red"],
    ["N³", "Cubic", "red"],
    ["2^N", "Exponential", "deep red"],
    ["N!", "Factorial", "deepest red"],
  ]}},
  { h: "The summing example: same problem, three complexities" },
  { code: String.raw`// Sum 1 + 2 + ... + n, three ways (slide figure):

// Algorithm A -- O(n): one pass
sum = 0
for i = 1 to n
    sum = sum + i

// Algorithm B -- O(n^2): nested loop does 1+2+...+n inner steps
sum = 0
for i = 1 to n
{
    for j = 1 to i
        sum = sum + 1
}

// Algorithm C -- O(1): Gauss formula, no loop at all
sum = n * (n + 1) / 2`, lang: "text", title: "Algorithm choice, not hardware, decides scalability" },
  { h: "Reading loops" },
  { code: String.raw`// O(n): single loop
for i = 1 to n: sum += i

// O(n^2): full nested loop (n rows of n workers)
for i = 1 to n:
    for j = 1 to n: sum += 1

// STILL O(n^2): triangular nested loop (rows of 1,2,...,n workers)
for i = 1 to n:
    for j = 1 to i: sum += 1
// 1+2+...+n = n(n+1)/2 -> drop constants -> O(n^2). NOT "half = O(n)"!`, lang: "text", title: "The triangular-loop gotcha (two dedicated slides)" },
  { p: "Quote for written answers: \"Performance is the currency of computing\" — runtime complexity determines scalability and often draws the line between feasible and impossible." },
]},

{
id: "al-collection-complexity",
title: "Complexity of .NET collections (reference table)",
cat: "Algorithms & Big-O",
tags: ["complexity table", "list", "dictionary", "hashset", "operations", "o(1)", "o(n)"],
related: ["al-bigo", "col-overview"],
blocks: [
  { p: "The lectures state these qualitatively (Dictionary/HashSet \"very fast\" hashed lookup, LinkedList \"fast insert/remove, slow lookup\"). The standard table behind those statements:" },
  { table: { head: ["Operation", "List<T>", "Dictionary<K,V>", "HashSet<T>", "LinkedList<T>", "Array"], rows: [
    ["Access by index", "O(1)", "—", "—", "O(n)", "O(1)"],
    ["Lookup by key/value", "O(n) (Contains)", "O(1) by key", "O(1) Contains", "O(n) Find", "O(n)"],
    ["Add at end", "O(1) amortized", "O(1)", "O(1)", "O(1)", "— (fixed size)"],
    ["Insert at front/middle", "O(n) (shift)", "—", "—", "O(1) with node ref", "—"],
    ["Remove", "O(n)", "O(1) by key", "O(1)", "O(1) with node ref", "—"],
  ]}},
  { table: { head: ["Algorithm", "Complexity"], rows: [
    ["Sequential (linear) search", "O(n)"],
    ["Binary search (sorted data!)", "O(log n)"],
    ["Bubble / Insertion / Selection sort", "O(n²)"],
    ["Merge sort", "O(n log n)"],
    ["Quick sort", "O(n log n) average, O(n²) worst"],
  ]}},
]},

{
id: "al-search",
title: "Searching: linear vs binary (with code)",
cat: "Algorithms & Big-O",
tags: ["linear search", "sequential search", "binary search", "low mid high", "sorted", "icomparer"],
related: ["pb-linq-json", "al-bigo", "ex-june-p4-linq"],
blocks: [
  { table: { head: ["", "Sequential search", "Binary search"], rows: [
    ["Requirement", "none", "data MUST be sorted by the search key"],
    ["Idea", "check element by element from index 0", "compare middle, discard half, repeat"],
    ["Complexity", "O(n)", "O(log n)"],
  ]}},
  { code: String.raw`// Linear search
int LinearSearch(int[] arr, int target)
{
    for (int i = 0; i < arr.Length; i++)
        if (arr[i] == target) return i;
    return -1;
}`, lang: "csharp", title: "Sequential search" },
  { code: String.raw`// Binary search -- the low/mid/high dance from the slide
int BinarySearch(int[] sorted, int target)
{
    int lo = 0, hi = sorted.Length - 1;
    while (lo <= hi)
    {
        int mid = (lo + hi) / 2;
        if (sorted[mid] == target) return mid;
        else if (sorted[mid] < target) lo = mid + 1;   // search upper half
        else hi = mid - 1;                             // search lower half
    }
    return -1;
}
// slide example: [1,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59], target 37:
// lo=0 hi=16 mid=8(23) -> too small -> lo=9; mid=12(41) -> too big -> hi=11;
// mid=10(31) -> too small -> lo=11; mid=11(37) -> FOUND`, lang: "csharp", title: "Binary search + trace" },
  { code: String.raw`// On objects by a string key (the exam's Rocinante task):
var sorted = ships.OrderBy(s => s.Name, StringComparer.Ordinal).ToList();

int lo = 0, hi = sorted.Count - 1, found = -1;
while (lo <= hi)
{
    int mid = (lo + hi) / 2;
    int cmp = string.Compare(sorted[mid].Name, "Rocinante", StringComparison.Ordinal);
    if (cmp == 0) { found = mid; break; }
    else if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
}

// Built-in alternatives:
List<string> names = sorted.Select(s => s.Name).ToList();
int idx = names.BinarySearch("Rocinante");

// or with a custom comparer on the object list:
class ShipNameComparer : IComparer<Spaceship>
{
    public int Compare(Spaceship? a, Spaceship? b)
        => string.Compare(a?.Name, b?.Name, StringComparison.Ordinal);
}
int idx2 = sorted.BinarySearch(new Spaceship { Name = "Rocinante" }, new ShipNameComparer());`, lang: "csharp", title: "Binary search over objects, three ways" },
  { gotcha: "Forgetting to SORT FIRST is the classic zero-points mistake: binary search on unsorted data returns garbage without throwing. Sort by the SAME key you search on, with the SAME comparison rules." },
]},

{
id: "al-sorting-simple",
title: "Sorting I: bubble, insertion, selection",
cat: "Algorithms & Big-O",
tags: ["bubble sort", "insertion sort", "selection sort", "o(n2)", "swap"],
related: ["al-sorting-divide", "al-bigo"],
blocks: [
  { table: { head: ["Algorithm", "Idea (course framing)", "Complexity"], rows: [
    ["Bubble sort", "repeatedly compare adjacent pairs, swap if out of order; biggest values 'bubble' to the end", "O(n²)"],
    ["Insertion sort", "build the sorted part one element at a time, inserting each into its correct position (sorting a hand of cards)", "O(n²) — stated on the slide"],
    ["Selection sort", "find the minimum of the unsorted part, swap it to the front; repeat", "O(n²)"],
  ]}},
  { code: String.raw`void BubbleSort(int[] a)
{
    for (int i = 0; i < a.Length - 1; i++)
    {
        for (int j = 0; j < a.Length - 1 - i; j++)
        {
            if (a[j] > a[j + 1])
            {
                (a[j], a[j + 1]) = (a[j + 1], a[j]);   // tuple swap
            }
        }
    }
}`, lang: "csharp", title: "Bubble sort" },
  { code: String.raw`void InsertionSort(int[] a)
{
    for (int i = 1; i < a.Length; i++)
    {
        int current = a[i];
        int j = i - 1;
        while (j >= 0 && a[j] > current)   // shift bigger elements right
        {
            a[j + 1] = a[j];
            j--;
        }
        a[j + 1] = current;                // insert into the gap
    }
}`, lang: "csharp", title: "Insertion sort" },
  { code: String.raw`void SelectionSort(int[] a)
{
    for (int i = 0; i < a.Length - 1; i++)
    {
        int minIndex = i;
        for (int j = i + 1; j < a.Length; j++)
            if (a[j] < a[minIndex]) minIndex = j;

        (a[i], a[minIndex]) = (a[minIndex], a[i]);
    }
}
// slide trace on [67,33,21,84,49,50,75]:
// 21 33 67 84 49 50 75   (min 21 swapped to front)
// 21 33 67 84 49 50 75   (33 already correct)
// 21 33 49 84 67 50 75   (49 swapped into position 3)
// 21 33 49 50 67 84 75   (50 swapped into position 4)
// 21 33 49 50 67 84 75   (67 already correct)
// 21 33 49 50 67 75 84   (75 swapped -> done)`, lang: "csharp", title: "Selection sort + the slide's exact trace" },
]},

{
id: "al-sorting-divide",
title: "Sorting II: merge sort & quick sort",
cat: "Algorithms & Big-O",
tags: ["merge sort", "quick sort", "divide and conquer", "pivot", "recursion", "n log n"],
related: ["al-sorting-simple", "al-recursion"],
blocks: [
  { def: "Merge sort is a divide-and-conquer method: break the problem into subproblems recursively, stop when small enough to handle, solve each separately, then merge.", term: "Merge sort (slide wording)" },
  { code: String.raw`int[] MergeSort(int[] a)
{
    if (a.Length <= 1) return a;                  // base case

    int mid = a.Length / 2;
    int[] left  = MergeSort(a[..mid]);            // divide
    int[] right = MergeSort(a[mid..]);
    return Merge(left, right);                    // conquer
}

int[] Merge(int[] left, int[] right)
{
    int[] result = new int[left.Length + right.Length];
    int i = 0, j = 0, k = 0;

    while (i < left.Length && j < right.Length)
        result[k++] = (left[i] <= right[j]) ? left[i++] : right[j++];

    while (i < left.Length)  result[k++] = left[i++];
    while (j < right.Length) result[k++] = right[j++];
    return result;
}
// O(n log n): log n levels of splitting, O(n) merging per level`, lang: "csharp", title: "Merge sort" },
  { def: "Quick sort is also divide and conquer: use one (or multiple) pivot elements to split the data, then sort the parts.", term: "Quick sort (slide wording)" },
  { code: String.raw`void QuickSort(int[] a, int lo, int hi)
{
    if (lo >= hi) return;                 // base case

    int pivot = a[hi];                    // last element as pivot
    int i = lo - 1;
    for (int j = lo; j < hi; j++)
    {
        if (a[j] < pivot)
        {
            i++;
            (a[i], a[j]) = (a[j], a[i]);  // smaller values to the left
        }
    }
    (a[i + 1], a[hi]) = (a[hi], a[i + 1]);   // pivot into its final spot

    QuickSort(a, lo, i);                  // sort left of pivot
    QuickSort(a, i + 2, hi);              // sort right of pivot
}
// call: QuickSort(arr, 0, arr.Length - 1);
// average O(n log n); worst case O(n^2) (already-sorted input with bad pivot)`, lang: "csharp", title: "Quick sort (Lomuto partition)" },
  { tip: "Joke slide for flavor: Bogo sort (\"multiply and surrender\") shuffles randomly until sorted. If the lecturer references it, that's the punchline. In practice: `list.Sort()` / `OrderBy` use highly optimized introsort; hand-write sorts only when asked to demonstrate the algorithm." },
]},

{
id: "al-recursion",
title: "Recursion",
cat: "Algorithms & Big-O",
tags: ["recursion", "base case", "recursive step", "factorial", "stack", "iterative"],
related: ["al-sorting-divide"],
blocks: [
  { def: "Recursion is a programming technique where a function calls itself. While it can sometimes be more intuitive, it can use a lot of memory and there is ALWAYS an iterative solution.", term: "Recursion (slide wording, incl. the always-iterative claim)" },
  { code: String.raw`// Factorial: n! = n * (n-1) * (n-2) * ... * 1
public static long Factorial(int n)
{
    // 1. BASE CASE: the simplest input, stops the recursion
    if (n == 0)
    {
        return 1;
    }
    // 2. RECURSIVE STEP: call itself with a SMALLER problem
    else
    {
        return n * Factorial(n - 1);
    }
}

Console.WriteLine(Factorial(3));   // 6  (3 * 2 * 1 * 1)

// the always-existing iterative version:
public static long FactorialIterative(int n)
{
    long result = 1;
    for (int i = 2; i <= n; i++) result *= i;
    return result;
}`, lang: "csharp", title: "Factorial both ways (slide example)" },
  { rule: "Every recursion needs exactly two parts: a **base case** and a **recursive step on a smaller problem**. Missing/never-reached base case = StackOverflowException." },
  { p: "Recursion in this course's algorithms: merge sort and quick sort recurse on halves/partitions; their base case is a 0/1-element range." },
]}

);
