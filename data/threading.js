/* ============ THREADING & ASYNC ============ */

window.TOPICS.push(

{
id: "th-thread-basics",
title: "Thread basics: Start, Join, Sleep, background",
cat: "Threading & Async",
tags: ["thread", "start", "join", "sleep", "isbackground", "foreground", "interleaving"],
related: ["th-tasks", "th-race-conditions"],
blocks: [
  { code: String.raw`using System.Threading;

// Create from a method group, start, wait for completion:
Thread thread = new Thread(CountToTen);
thread.Start();
Console.WriteLine("Main thread is done!");   // may print BEFORE the count finishes
thread.Join();                               // block until the thread completes

void CountToTen()
{
    for (int i = 0; i < 10; i++) Console.WriteLine(i);
}

// Lambda body + Sleep:
Thread t2 = new Thread(() =>
{
    Thread.Sleep(1000);                      // pause THIS thread 1s
    Console.WriteLine("woke up");
});
t2.Start();
t2.Join();`, lang: "csharp", title: "Thread lifecycle (lecture examples 1–2)" },
  { code: String.raw`// Two threads interleave unpredictably:
Thread a = new Thread(() => { for (int i = 0; i < 200; i++) Console.Write("x"); });
Thread b = new Thread(() => { for (int i = 0; i < 200; i++) Console.Write("y"); });
a.Start(); b.Start();          // output: xxyyxyxyxxx... different every run
a.Join();  b.Join();

// Join right after each Start SERIALIZES them (all x then all y):
a.Start(); a.Join();
b.Start(); b.Join();`, lang: "csharp", title: "Interleaving vs serialized (examples 3–4)" },
  { rule: "Foreground threads keep the process alive until they finish; **background** threads (`thread.IsBackground = true`) are killed when the main thread exits. Lecture example 6 demos exactly this switch." },
]},

{
id: "th-tasks",
title: "Tasks: Run, Result, exceptions, ContinueWith",
cat: "Threading & Async",
tags: ["task", "task.run", "result", "wait", "aggregateexception", "continuewith", "longrunning"],
related: ["th-async-await", "th-whenall-whenany", "cs-exceptions"],
blocks: [
  { p: "A `Task` is a unit of work scheduled on the thread pool; the modern alternative to raw Threads. `Task<TResult>` carries a return value." },
  { code: String.raw`// Fire on the pool:
Task task = Task.Run(() => Console.WriteLine("working"));
task.Wait();                            // block until done (avoid in UI code!)

// Task WITH a result:
Task<int> calc = Task.Run(() => { Console.WriteLine("Foo"); return 3; });
int result = calc.Result;               // BLOCKS if not finished yet -> 3

// Dedicated thread for long work (bypass the pool):
Task longTask = Task.Factory.StartNew(() =>
{
    for (int i = 0; i < 20; i++) { Thread.Sleep(1000); }
}, TaskCreationOptions.LongRunning);`, lang: "csharp", title: "Creating tasks (lecture examples)" },
  { code: String.raw`// Exceptions: surfaced as AggregateException by Wait()/Result:
Task task = Task.Run(() => { Thread.Sleep(2000); throw null; });
try
{
    task.Wait();
}
catch (AggregateException aex)
{
    if (aex.InnerException is NullReferenceException)
        Console.WriteLine("Null!");
    else
        throw;
}
// NOTE: 'await task' would throw the ORIGINAL NullReferenceException instead.`, lang: "csharp", title: "Task exceptions (lecture example verbatim)" },
  { code: String.raw`// Continuations: run something when the antecedent finishes:
Task<int> primeCount = Task.Run(() =>
    Enumerable.Range(2, 3000000).Count(n =>
        Enumerable.Range(2, (int)Math.Sqrt(n) - 1).All(i => n % i > 0)));

Task continuation = primeCount.ContinueWith(antecedent =>
{
    Console.WriteLine(antecedent.Result);   // safe: antecedent has completed
});
continuation.Wait();`, lang: "csharp", title: "ContinueWith (prime-counting lecture example)" },
  { gotcha: "`.Result` / `.Wait()` BLOCK the calling thread. On the UI thread that means a frozen window (and potential deadlock). In UI code always `await` instead." },
]},

{
id: "th-async-await",
title: "async / await: mechanics & execution order",
cat: "Threading & Async",
tags: ["async", "await", "execution order", "async task", "async void", "control flow"],
related: ["th-tasks", "th-ui-thread", "th-io-vs-cpu"],
blocks: [
  { list: [
    "`async` marks a method that may contain `await`. Its return type should be `Task` / `Task<T>` (`async void` ONLY for event handlers).",
    "`await task` = if not finished, suspend THIS method (without blocking the thread) and resume after the task completes. Code after `await` is the continuation.",
    "Calling an async method runs it synchronously UP TO the first await of an incomplete task; the task starts when CALLED, not when awaited.",
  ]},
  { code: String.raw`// The course's execution-order puzzle (lecture example 6). Numbers = print statements.
public void Run()
{
    Console.WriteLine("1 Starting");
    DoSomethingAsync();                     // not awaited -> runs until its first real await
    Console.WriteLine("2 Continuing");
}

private async Task DoSomethingAsync()
{
    Console.WriteLine("3 Starting Task");
    Task task = TaskAsync();                // Task.Run STARTS NOW (prints 7s in background)
    Thread.Sleep(1000);
    Console.WriteLine("4 Doing Something Else");
    Thread.Sleep(1000);
    Console.WriteLine("5 Awaiting Task");
    await task;                             // suspends here; control returns to Run -> "2"
    Console.WriteLine("6 Task Done");       // continuation after task completes
}

private Task TaskAsync() => Task.Run(() =>
{
    for (int i = 0; i < 10; i++)
    {
        Console.WriteLine("7 Actually Doing Something");
        Thread.Sleep(1000);
    }
});

// Observed order: 1, 3, (7s start mixing in), 4, 5, then 2, more 7s..., finally 6.
// Key insights: work starts at the CALL; '2' prints when the async method first yields;
// '6' waits for all the 7s to finish.`, lang: "csharp", title: "Execution-order trace (classic exam question)" },
  { rule: "Two rules cover most questions: (1) a Task starts when created/called, not when awaited; (2) `await` yields control back to the caller instead of blocking, and the rest of the method resumes later." },
]},

{
id: "th-race-conditions",
title: "Race conditions & lock",
cat: "Threading & Async",
tags: ["race condition", "lock", "thread safe", "critical section", "shared state", "counter"],
related: ["th-deadlocks", "th-locking-collections"],
blocks: [
  { def: "Race conditions occur when multiple threads access shared data at the same time AND at least one thread changes something. The threads race through the program in unpredictable order → unpredictable, hard-to-debug outcomes; the code is not thread-safe.", term: "Race condition (both conditions required!)" },
  { code: String.raw`int sharedCounter = 0;

List<Task> tasks = new List<Task>();
for (int i = 0; i < 10; i++)
{
    tasks.Add(Task.Run(() =>
    {
        for (int j = 0; j < 1000; j++)
        {
            // sharedCounter++ is NOT atomic; it is three steps:
            // 1. read current value (e.g. 5)
            // 2. (thread switch) another thread reads 5, increments, writes 6
            // 3. this thread increments ITS old 5 to 6 and writes 6
            //    -> the other thread's increment is LOST
            sharedCounter++;
        }
    }));
}
await Task.WhenAll(tasks);
Console.WriteLine($"Final Counter (Unsafe): {sharedCounter}");
// Expected 10,000 -- actual: LESS (lost updates)`, lang: "csharp", title: "The canonical lost-update race (lecture verbatim)" },
  { code: String.raw`int sharedCounter = 0;
object _counterLock = new object();        // DEDICATED lock object = best practice

List<Task> tasks = new List<Task>();
for (int i = 0; i < 10; i++)
{
    tasks.Add(Task.Run(() =>
    {
        for (int j = 0; j < 1000; j++)
        {
            lock (_counterLock)            // only one thread inside at a time
            {
                sharedCounter++;
            }
        }
    }));
}
await Task.WhenAll(tasks);
Console.WriteLine($"Final Counter (Safe): {sharedCounter}");   // exactly 10,000`, lang: "csharp", title: "Fixed with lock" },
  { rule: "lock best practice (slide): use a dedicated `private readonly object _lock = new object();`, not some arbitrary shared object, and keep the critical section as small as possible." },
]},

{
id: "th-deadlocks",
title: "Deadlocks",
cat: "Threading & Async",
tags: ["deadlock", "lock ordering", "two locks", "waiting forever"],
related: ["th-race-conditions"],
blocks: [
  { def: "When two threads lock each other out of resources, they might wait for each other forever. This is called a Deadlock.", term: "Deadlock" },
  { code: String.raw`object _lockA = new object();
object _lockB = new object();

// Task 1: acquires A then B
void ProcessAB()
{
    lock (_lockA)
    {
        Thread.Sleep(100);          // holds A while "working"
        lock (_lockB)               // waits here if BA holds B...
        {
            // ... work ...
        }
    }
}

// Task 2: acquires B then A  -- INCONSISTENT ORDER = the bug
void ProcessBA()
{
    lock (_lockB)
    {
        Thread.Sleep(100);
        lock (_lockA)               // ...while AB waits for B. DEADLOCK.
        {
            // ... work ...
        }
    }
}

Task t1 = Task.Run(ProcessAB);
Task t2 = Task.Run(ProcessBA);
await Task.WhenAll(t1, t2);         // likely hangs forever`, lang: "csharp", title: "The AB/BA deadlock (lecture verbatim)" },
  { rule: "Cause as taught: acquiring multiple locks in inconsistent order. Fix: every code path takes locks in the SAME global order (always A before B)." },
]},

{
id: "th-locking-collections",
title: "Locking collections & concurrent collections",
cat: "Threading & Async",
tags: ["locking lists", "concurrent collections", "concurrentdictionary", "concurrentbag", "snapshot", "invalidoperationexception"],
related: ["th-race-conditions", "col-overview"],
blocks: [
  { rule: "Standard collections (List<T> etc.) are NOT thread-safe for writing or enumeration. Enumerating while another thread adds throws `InvalidOperationException`." },
  { code: String.raw`List<int> sharedList = new List<int>();
object listLock = new object();

// writer:
lock (listLock) { sharedList.Add(i); }

// READER OPTION 1: snapshot copy inside the lock, iterate outside (lock held briefly)
List<int> snapshot;
lock (listLock) { snapshot = sharedList.ToList(); }
long sum = 0;
foreach (int item in snapshot) sum += item;

// READER OPTION 2: iterate inside the lock (simpler, but lock held longer)
lock (listLock)
{
    foreach (int item in sharedList) sum += item;
}`, lang: "csharp", title: "Two safe iteration strategies (slide tradeoff)" },
  { h: "Concurrent collections (System.Collections.Concurrent)" },
  { list: [
    "`ConcurrentBag<T>` (unordered), `ConcurrentQueue<T>`, `ConcurrentStack<T>`, `ConcurrentDictionary<K,V>`.",
    "Slide nuance (asked easily): they only perform better **under high contention**; otherwise locking normal collections may be preferable.",
  ]},
  { code: String.raw`using System.Collections.Concurrent;

// Thread-safe adding without manual locks (order not guaranteed):
ConcurrentBag<string> sharedBag = new ConcurrentBag<string>();
await Task.WhenAll(
    Task.Run(() => sharedBag.Add("Item Added by Task 1")),
    Task.Run(() => sharedBag.Add("Item Added by Task 2"))
);

// Thread-safe counting -- AddOrUpdate is the signature API:
ConcurrentDictionary<string, int> wordCounts = new ConcurrentDictionary<string, int>();
wordCounts.AddOrUpdate(
    "example",                          // key
    1,                                  // value if the key is NEW
    (key, currentCount) => currentCount + 1);   // update if it EXISTS

if (wordCounts.TryGetValue("example", out int count)) { /* reading is thread-safe */ }`, lang: "csharp", title: "ConcurrentBag + ConcurrentDictionary (lecture verbatim)" },
]},

{
id: "th-semaphore",
title: "SemaphoreSlim: throttling concurrency",
cat: "Threading & Async",
tags: ["semaphore", "semaphoreslim", "throttle", "waitasync", "release", "bouncer"],
related: ["th-cancellation", "th-whenall-whenany"],
blocks: [
  { def: "A semaphore limits the number of threads that can concurrently access a resource, unlike locking which allows only a single thread. Like a bouncer at a nightclub.", term: "Semaphore" },
  { code: String.raw`// Allow max 3 concurrent operations:
SemaphoreSlim _throttler = new SemaphoreSlim(3, 3);

async Task DownloadFileAsync(int fileNum, CancellationToken token)
{
    Console.WriteLine($"[{fileNum}] Waiting for slot...");
    await _throttler.WaitAsync(token);          // take a slot (pass the token!)
    try
    {
        Console.WriteLine($"[{fileNum}] Entered slot. Downloading...");
        await Task.Delay(TimeSpan.FromSeconds(2), token);
        Console.WriteLine($"[{fileNum}] Finished download.");
    }
    finally
    {
        _throttler.Release();                   // CRITICAL: always release in finally
        Console.WriteLine($"[{fileNum}] Slot released.");
    }
}

// usage: start 20, only 3 ever run at once:
List<Task> downloadTasks = new List<Task>();
var cts = new CancellationTokenSource();
for (int i = 1; i <= 20; i++) downloadTasks.Add(DownloadFileAsync(i, cts.Token));
await Task.WhenAll(downloadTasks);`, lang: "csharp", title: "The throttled-downloads pattern (lecture verbatim)" },
  { rule: "Pattern: `await WaitAsync()` → `try { work } finally { Release(); }`. The finally guarantees the slot returns even on exceptions/cancellation." },
]},

{
id: "th-cancellation",
title: "Task cancellation (CancellationToken)",
cat: "Threading & Async",
tags: ["cancellation", "cancellationtoken", "cancellationtokensource", "operationcanceledexception", "stop a task"],
related: ["pb-async", "th-periodictimer"],
blocks: [
  { rule: "Slide emphasis: cancellation tokens \"should always be used to stop a task from outside, instead of some bool flag.\"" },
  { code: String.raw`async Task StoppableProcessingLoop(CancellationToken token)
{
    int itemsProcessed = 0;
    try
    {
        while (true)
        {
            // PATH 1: cooperative polling
            if (token.IsCancellationRequested)
            {
                Console.WriteLine("Exiting.");
                break;                            // exit cleanly
            }

            itemsProcessed++;

            // PATH 2: pass the token to awaitable calls --
            // they throw OperationCanceledException when cancelled
            await Task.Delay(500, token);
        }
    }
    catch (OperationCanceledException)
    {
        // EXPECTED when cancelled mid-await; not an error
        Console.WriteLine("Loop cancelled via OperationCanceledException.");
    }
    finally
    {
        Console.WriteLine($"Finished after {itemsProcessed} items.");
    }
}

// driving it:
var cts = new CancellationTokenSource();
Task loopTask = StoppableProcessingLoop(cts.Token);

await Task.Delay(3000);
cts.Cancel();              // request cancellation
await loopTask;            // wait for the clean shutdown
cts.Dispose();`, lang: "csharp", title: "Both cancellation paths in one loop (lecture verbatim)" },
  { list: [
    "`CancellationTokenSource` = the remote control (owner calls `.Cancel()`).",
    "`CancellationToken` = the read-only view passed into tasks.",
    "Two reaction styles: poll `token.IsCancellationRequested`, or let token-aware calls (`Task.Delay`, `WaitAsync`, `WaitForNextTickAsync`) throw `OperationCanceledException`. Catch it; it is the normal shutdown signal.",
  ]},
]},

{
id: "th-whenall-whenany",
title: "Task.WhenAll & Task.WhenAny",
cat: "Threading & Async",
tags: ["whenall", "whenany", "concurrent tasks", "timeout", "parallel fetch"],
related: ["th-tasks", "th-semaphore"],
blocks: [
  { rule: "`Task.WhenAll` = start several tasks, await until ALL finish. `Task.WhenAny` = await until AT LEAST ONE finishes (returns the winner)." },
  { code: String.raw`async Task<string> FetchUrlContentAsync(string url)
{
    Console.WriteLine($"Starting fetch: {url}");
    await Task.Delay(TimeSpan.FromSeconds(new Random().Next(1, 4)));   // fake network
    Console.WriteLine($"Finished fetch: {url}");
    return $"Content from {url}";
}

// start ALL first (they run concurrently from the moment of the call)...
Task<string> task1 = FetchUrlContentAsync("https://example.com/page1");
Task<string> task2 = FetchUrlContentAsync("https://example.com/page2");
Task<string> task3 = FetchUrlContentAsync("https://example.com/page3");

// ...then await them together; results array preserves argument order:
string[] results = await Task.WhenAll(task1, task2, task3);`, lang: "csharp", title: "Concurrent fetches with WhenAll (lecture verbatim)" },
  { code: String.raw`// WhenAny as a TIMEOUT race:
var cts = new CancellationTokenSource();
Task<string> operationTask = LongRunningOperation(cts.Token);     // ~5s
Task timeoutTask = Task.Delay(TimeSpan.FromSeconds(3), cts.Token); // 3s limit

Task completedTask = await Task.WhenAny(operationTask, timeoutTask);

if (completedTask == operationTask)
{
    string result = await operationTask;   // await again to get result / propagate errors
    Console.WriteLine($"Result: {result}");
}
else
{
    Console.WriteLine("Operation timed out!");
    cts.Cancel();                           // IMPORTANT: cancel the loser
}
cts.Dispose();`, lang: "csharp", title: "Timeout pattern with WhenAny (lecture verbatim)" },
  { gotcha: "Common trap: writing `await FetchA(); await FetchB();` runs them SEQUENTIALLY. To run concurrently: create both tasks first, then `await Task.WhenAll(a, b)`." },
]},

{
id: "th-periodictimer",
title: "PeriodicTimer, signaling & BlockingCollection",
cat: "Threading & Async",
tags: ["periodictimer", "waitfornexttick", "manualreseteventslim", "signaling", "blockingcollection", "producer consumer"],
related: ["pb-async", "th-cancellation"],
blocks: [
  { h: "PeriodicTimer: work at regular intervals" },
  { code: String.raw`async Task RunPeriodicWork(CancellationToken token)
{
    using var timer = new PeriodicTimer(TimeSpan.FromSeconds(2));
    try
    {
        while (await timer.WaitForNextTickAsync(token))   // pass the token!
        {
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Doing periodic work...");
        }
    }
    catch (OperationCanceledException)
    {
        Console.WriteLine("Periodic work cancelled.");
    }
}

var cts = new CancellationTokenSource();
Task workTask = RunPeriodicWork(cts.Token);
// stop later: cts.Cancel();`, lang: "csharp", title: "PeriodicTimer loop (lecture verbatim)" },
  { h: "Signaling: one thread waits for another" },
  { def: "Signaling lets one thread wait until another performs an action or reaches a state. ManualResetEventSlim is the best for manually broadcasting a signal.", term: "Signaling (slide wording)" },
  { code: String.raw`ManualResetEventSlim dataReadySignal = new ManualResetEventSlim(false); // non-signaled
string sharedData = null;

Task consumer = Task.Run(() =>
{
    Console.WriteLine("Consumer: Waiting for data...");
    dataReadySignal.Wait();                  // blocks until Set()
    Console.WriteLine($"Consumer: Data is '{sharedData}'");
});

Task producer = Task.Run(async () =>
{
    await Task.Delay(2000);                  // produce...
    sharedData = "Hello from Producer!";
    dataReadySignal.Set();                   // wake all waiters
});

await Task.WhenAll(producer, consumer);
dataReadySignal.Dispose();`, lang: "csharp", title: "Producer/consumer handshake (lecture verbatim)" },
  { h: "BlockingCollection: built-in producer/consumer queue" },
  { list: [
    "Bounded capacity: `Add` blocks when full (producers can't outrun consumers).",
    "`Take` / `GetConsumingEnumerable()` blocks while empty: consumers wait automatically.",
    "Producer calls `CompleteAdding()` when done: the consuming foreach then ends by itself.",
  ]},
  { code: String.raw`BlockingCollection<string> messageQueue = new BlockingCollection<string>();

Task producer = Task.Run(async () =>
{
    try
    {
        for (int i = 0; i < 5; i++)
        {
            messageQueue.Add($"Message {i}");
            await Task.Delay(1000);
        }
    }
    finally
    {
        messageQueue.CompleteAdding();      // CRITICAL: signal "no more items"
    }
});

Task consumer = Task.Run(() =>
{
    foreach (string message in messageQueue.GetConsumingEnumerable()) // blocks when empty
    {
        Console.WriteLine($"Consumer processed: {message}");
    }
    // loop exits automatically once completed AND empty
});

await Task.WhenAll(producer, consumer);`, lang: "csharp", title: "BlockingCollection pipeline (lecture verbatim)" },
]},

{
id: "th-ui-thread",
title: "The Avalonia UI thread: freezes & Dispatcher",
cat: "Threading & Async",
tags: ["ui thread", "dispatcher", "uithread", "freeze", "responsive", "dispatchertimer", "post", "invokeasync"],
related: ["pb-async", "th-async-await", "mv-relaycommand"],
blocks: [
  { rule: "All UI reads/writes must happen on the UI thread. Long synchronous work on the UI thread freezes the window AND no binding update can repaint until it ends." },
  { h: "The course's before/after pair (Sync vs Async UI examples)" },
  { code: String.raw`// BEFORE (SyncUIExample): UI freezes; intermediate Results never visible
[RelayCommand]
private void DoSomething()
{
    Result = string.Empty;
    foreach (char c in "Something")
    {
        Result += c;                 // bindings can't repaint: we're hogging the UI thread
    }
    Result = "Nothing";
}`, lang: "csharp", title: "Frozen UI version" },
  { code: String.raw`// AFTER (AsyncUIExample): async command + Task.Run -> UI stays responsive,
// letters appear one by one
[RelayCommand]
private async Task DoSomething()
{
    await Task.Run(() =>
    {
        Result = string.Empty;
        foreach (char c in "Something")
        {
            Thread.Sleep(500);
            Result += c;             // ObservableProperty change flows to the binding
        }
        Thread.Sleep(500);
    });

    Result = "Nothing";              // after await: back on the UI thread
}`, lang: "csharp", title: "Responsive version (lecture verbatim)" },
  { h: "Dispatcher: explicitly running code on the UI thread" },
  { code: String.raw`using Avalonia.Threading;

// fire-and-forget marshal (most common):
Dispatcher.UIThread.Post(() => Count++);

// awaitable marshal:
await Dispatcher.UIThread.InvokeAsync(() => Count++);

// check where you are:
bool onUi = Dispatcher.UIThread.CheckAccess();

// timer that ticks ON the UI thread (no marshalling needed at all):
var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
timer.Tick += (_, _) => Count++;
timer.Start();`, lang: "csharp", title: "Dispatcher toolbox" },
  { tip: "Exam rubric translator: \"Make sure the UI is responsive\" = don't block the UI thread (async command / Task.Run / timers). \"Changes to the UI happen only on the UI thread\" = DispatcherTimer, or Dispatcher.UIThread.Post around every bound-property write from a background thread." },
]},

{
id: "th-io-vs-cpu",
title: "IO-bound vs CPU-bound (when to use what)",
cat: "Threading & Async",
tags: ["io bound", "cpu bound", "async await", "task.run", "decision", "when to use"],
related: ["th-async-await", "th-tasks"],
blocks: [
  { p: "The lecture's summary slide — a very likely direct exam question:" },
  { table: { head: ["", "IO-bound work", "CPU-bound work"], rows: [
    ["What's happening", "waiting for input/output; CPU is idle", "calculating; CPU is busy"],
    ["Examples", "network requests, database queries, disk read/write", "complex math, image processing, intensive LINQ"],
    ["Use", "**async / await** (no extra thread needed while waiting)", "**concurrent Tasks** (`Task.Run` to move work off the current thread)"],
  ]}},
  { code: String.raw`// IO-bound: just await the naturally-async API; no Task.Run
string json = await File.ReadAllTextAsync("big.json");
await Task.Delay(1000);

// CPU-bound: push the computation onto a pool thread
int primes = await Task.Run(() => CountPrimes(3_000_000));`, lang: "csharp" },
]}

);
