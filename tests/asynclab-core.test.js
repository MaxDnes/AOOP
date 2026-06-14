"use strict";
const { test, eq, ok, includes, notIncludes, xmlBalanced } = require("./t.js");
const C = require("../data/asynclab-core.js");

/* ---------- helpers ---------- */

/* strip C# string/char literals + comments so braces inside them don't
   throw off the balance check (mirrors the analyzer/testlab stripForScan,
   re-implemented locally so we don't import another core). */
function strip(text) {
  const src = String(text == null ? "" : text);
  const out = src.split("");
  const n = src.length;
  function blank(i) { if (out[i] !== "\n" && out[i] !== "\r") out[i] = " "; }
  let i = 0;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") { blank(i); i++; } continue; }
    if (c === "/" && d === "*") {
      blank(i); blank(i + 1); i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { blank(i); i++; }
      if (i < n) { blank(i); blank(i + 1); i += 2; }
      continue;
    }
    if (c === '"' || ((c === "@" || c === "$") && (d === '"' || ((d === "@" || d === "$") && src[i + 2] === '"')))) {
      let j = i, verbatim = false;
      while (src[j] === "@" || src[j] === "$") { if (src[j] === "@") verbatim = true; blank(j); j++; }
      blank(j); j++;
      while (j < n) {
        if (verbatim) {
          if (src[j] === '"' && src[j + 1] === '"') { blank(j); blank(j + 1); j += 2; continue; }
          if (src[j] === '"') { blank(j); j++; break; }
        } else {
          if (src[j] === "\\") { blank(j); if (j + 1 < n) blank(j + 1); j += 2; continue; }
          if (src[j] === '"') { blank(j); j++; break; }
          if (src[j] === "\n") break;
        }
        blank(j); j++;
      }
      i = j; continue;
    }
    if (c === "'") {
      let j = i; blank(j); j++; let steps = 0;
      while (j < n && src[j] !== "'" && src[j] !== "\n" && steps < 12) {
        if (src[j] === "\\") { blank(j); j++; steps++; }
        if (j < n) { blank(j); j++; steps++; }
      }
      if (j < n && src[j] === "'") { blank(j); j++; }
      i = j; continue;
    }
    i++;
  }
  return out.join("");
}

function braceBalanced(code) {
  const s = strip(code);
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") d++;
    else if (s[i] === "}") { d--; if (d < 0) throw new Error("braceBalanced: extra } at " + i); }
  }
  if (d !== 0) throw new Error("braceBalanced: unbalanced, depth " + d);
  return true;
}
function parenBalanced(code) {
  const s = strip(code);
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") d++;
    else if (s[i] === ")") { d--; if (d < 0) throw new Error("parenBalanced: extra ) at " + i); }
  }
  if (d !== 0) throw new Error("parenBalanced: unbalanced, depth " + d);
  return true;
}

function vmCode(cfg) { return C.generateViewModel(cfg).code; }

/* collect the namespace from every `using X.Y.Z;` directive in a C# file (skips the
   `using (...)` statement form by requiring a dotted/bare namespace then a semicolon). */
function usingNamespaces(code) {
  const out = [];
  const re = /^\s*using\s+(static\s+)?([A-Za-z_][\w.]*)\s*;/gm;
  let m;
  while ((m = re.exec(code))) out.push(m[2]);
  return out;
}

/* the submission allow-list: only System.*, Avalonia*, CommunityToolkit.Mvvm.* (spec 16 rule 4) */
function isAllowedSubmissionUsing(ns) {
  return ns === "System" || ns.indexOf("System.") === 0 ||
    ns === "Avalonia" || ns.indexOf("Avalonia.") === 0 ||
    ns === "CommunityToolkit.Mvvm" || ns.indexOf("CommunityToolkit.Mvvm.") === 0;
}

/* ============ default config = ReExam P3 calibration target ============ */
test("default config: DispatcherTimer counter, +1 / 100ms, idiomatic & balanced", () => {
  const code = vmCode({});
  /* mechanism + interval */
  includes(code, "private readonly DispatcherTimer _timer;");
  includes(code, "TimeSpan.FromMilliseconds(100)");
  includes(code, "_timer.Tick += OnTick;");
  /* +1 per tick */
  includes(code, "Count++;");
  /* it's a partial ObservableObject-style VM with the observed field */
  includes(code, "public partial class MainWindowViewModel : ViewModelBase");
  includes(code, "[ObservableProperty]");
  includes(code, "private int _count = 0;");
  /* commands */
  includes(code, "[RelayCommand]");
  includes(code, "private void Start()");
  includes(code, "private void Stop()");
  includes(code, "private void Reset()");
  /* thread-safety point comment present on the timer mechanism */
  includes(code, "earns the thread-safety points");
  braceBalanced(code);
  parenBalanced(code);
});

test("default config: Start guards, Stop preserves (no zero), Reset zeroes", () => {
  const code = vmCode({});
  /* Start is idempotent while running */
  includes(code, "_timer.IsEnabled) return;");
  includes(code, "_timer.Start();");
  /* Stop pauses but does NOT zero -> there must be no `Count = 0` inside Stop.
     Easiest robust check: the only zeroing is in Reset. Count Count=0 occurrences = 1. */
  const zeroCount = (code.match(/Count = 0;/g) || []).length;
  eq(zeroCount, 1, "exactly one Count = 0 (Reset only, Stop must preserve)");
  /* Reset stops then zeroes */
  includes(code, "_timer.Stop();");
  /* Stop body keeps the value (comment marks intent) */
  includes(code, "pause: keep the current value");
});

test("default config: no catch-all, no TODO, no Console", () => {
  const code = vmCode({});
  notIncludes(code, "TODO");
  notIncludes(code, "catch (Exception", "no catch-all allowed");
  notIncludes(code, "catch {", "no bare catch-all allowed");
  notIncludes(code, "catch (", "DispatcherTimer variant needs no try/catch at all");
  notIncludes(code, "Console.");
});

/* ============ Task.Delay + CTS mechanism ============ */
test("task mechanism: CancellationTokenSource, catch (OperationCanceledException), UIThread.Post/Invoke", () => {
  const code = vmCode({ mechanism: "task" });
  includes(code, "private CancellationTokenSource? _cts;");
  includes(code, "_cts = new CancellationTokenSource();");
  includes(code, "if (_cts is not null) return;");
  includes(code, "_ = RunAsync(_cts.Token);");
  includes(code, "await Task.Delay(100, token);");
  /* the thread-safety marshal + point comment */
  includes(code, "Dispatcher.UIThread.InvokeAsync");
  includes(code, "earns the thread-safety points");
  /* ONLY OperationCanceledException, never a catch-all */
  includes(code, "catch (OperationCanceledException)");
  notIncludes(code, "catch (Exception");
  notIncludes(code, "catch {");
  /* correct usings */
  includes(code, "using System.Threading;");
  includes(code, "using System.Threading.Tasks;");
  includes(code, "using Avalonia.Threading;");
  notIncludes(code, "TODO");
  braceBalanced(code);
  parenBalanced(code);
});

test("task mechanism: Stop disposes + nulls the CTS (pause), Reset zeroes", () => {
  const code = vmCode({ mechanism: "task" });
  includes(code, "_cts?.Cancel();");
  includes(code, "_cts?.Dispose();");
  includes(code, "_cts = null;");
  const zeroCount = (code.match(/Count = 0;/g) || []).length;
  eq(zeroCount, 1, "Reset zeroes exactly once; Stop preserves");
});

/* ============ both: primary + alternate region ============ */
test("both mechanism: emits primary DispatcherTimer live + alternate Task region, single compilable file", () => {
  const code = vmCode({ mechanism: "both" });
  includes(code, "PRIMARY: DispatcherTimer");
  includes(code, "ALTERNATE: Task.Delay");
  includes(code, "private readonly DispatcherTimer _timer;");
  /* the alternate lives in // line comments (not a block comment) so nested
     inline comments in the task body cannot close it early; file still compiles */
  includes(code, "// ===== ALTERNATE: Task.Delay");
  includes(code, "CancellationTokenSource");
  /* the alternate must be fully commented out so the primary timer is the only
     live mechanism -> no duplicate Start()/Stop()/Reset() method definitions. */
  notIncludes(code, "    private CancellationTokenSource? _cts;", "alt CTS field must be commented out, not live");
  braceBalanced(code);   /* alternate is commented out -> braces still balance */
  parenBalanced(code);
});

/* ============ CanExecute wiring ============ */
test("canExecute option: [RelayCommand(CanExecute=...)] + [NotifyCanExecuteChangedFor] on IsRunning", () => {
  const code = vmCode({ canExecute: true });
  includes(code, "[RelayCommand(CanExecute = nameof(CanStart))]");
  includes(code, "[RelayCommand(CanExecute = nameof(CanStop))]");
  includes(code, "[NotifyCanExecuteChangedFor(nameof(StartCommand))]");
  includes(code, "[NotifyCanExecuteChangedFor(nameof(StopCommand))]");
  includes(code, "private bool isRunning;");
  includes(code, "private bool CanStart() => !IsRunning;");
  includes(code, "private bool CanStop() => IsRunning;");
  braceBalanced(code);
  parenBalanced(code);
});

test("no canExecute: plain [RelayCommand] with no CanExecute / NotifyCanExecuteChangedFor", () => {
  const code = vmCode({});
  notIncludes(code, "CanExecute = nameof");
  notIncludes(code, "NotifyCanExecuteChangedFor");
});

/* ============ progress pattern ============ */
test("progress pattern: 0..100, IsRunning flag, completes and stops at 100", () => {
  const code = vmCode({ pattern: "progress" });
  includes(code, "private int _progress = 0;");
  includes(code, "private bool isRunning;");        /* IsRunning flag present */
  includes(code, "Progress += 1;");
  includes(code, "if (Progress >= 100)");
  includes(code, "Progress = 100;");
  includes(code, "Stop();");                         /* completes and stops */
  braceBalanced(code);
  parenBalanced(code);
});

/* regression (asynclab-2): the progress worker self-Stops at 100, which clears
   IsRunning. Without a completion guard a Start after that would re-arm the worker
   and add one more tick before re-clamping to 100. Start() must bail out when
   already complete, on both the timer and the task mechanism. */
test("progress pattern: Start guards against restarting past 100 (timer + task)", () => {
  ["timer", "task"].forEach((mech) => {
    const code = vmCode({ pattern: "progress", mechanism: mech });
    /* the completion guard is present... */
    includes(code, "if (Progress >= 100) return;", mech + ": Start must bail when already complete");
    /* ...and it sits INSIDE Start() (before the worker is re-armed). Slice the Start
       body and assert the guard appears there, ahead of the start/resume line. */
    const start = code.indexOf("private void Start()");
    ok(start !== -1, mech + ": Start() method present");
    const body = code.slice(start, code.indexOf("private void Stop()", start));
    includes(body, "if (Progress >= 100) return;", mech + ": guard lives in Start()");
    const armLine = mech === "timer" ? "_timer.Start();" : "_ = RunAsync(";
    ok(body.indexOf("if (Progress >= 100) return;") < body.indexOf(armLine),
      mech + ": completion guard must precede re-arming the worker");
    braceBalanced(code);
    parenBalanced(code);
  });
  /* the counter/list patterns must NOT pick up the progress-only guard */
  notIncludes(vmCode({ pattern: "counter" }), "if (Progress >= 100) return;");
  notIncludes(vmCode({ pattern: "list" }), "if (Progress >= 100) return;");
});

/* ============ list pattern ============ */
test("list pattern: ObservableCollection mutated each tick + ObjectModel using", () => {
  const code = vmCode({ pattern: "list" });
  includes(code, "using System.Collections.ObjectModel;");
  includes(code, "public ObservableCollection<string> Items { get; } = new();");
  includes(code, "Items.Add(");
  includes(code, "Items.Clear();");                  /* reset clears the collection */
  braceBalanced(code);
  parenBalanced(code);
});

/* ============ toggle single-button variant ============ */
test("toggle command: single Toggle method that starts when stopped, stops when running", () => {
  const code = vmCode({ commands: { start: true, stop: true, reset: true, toggle: true } });
  includes(code, "private void Toggle()");
  includes(code, "Stop();");
  includes(code, "Start();");
  braceBalanced(code);
  parenBalanced(code);
});

/* regression: Toggle delegates to Start()/Stop(), so those method BODIES must be
   emitted even when their separate buttons are unchecked — otherwise Toggle calls
   undefined methods and the file does not compile. */
test("toggle without separate Start/Stop still defines Start()/Stop() so Toggle compiles", () => {
  const code = vmCode({ commands: { start: false, stop: false, reset: true, toggle: true } });
  includes(code, "private void Toggle()");
  includes(code, "private void Start()", "Start() body must exist for Toggle to call");
  includes(code, "private void Stop()", "Stop() body must exist for Toggle to call");
  braceBalanced(code);
  parenBalanced(code);
  /* the AXAML shows ONLY the single toggle button (not Start AND Stop AND Toggle) */
  const x = C.generateAxaml({ commands: { start: false, stop: false, reset: true, toggle: true } }).code;
  includes(x, 'Command="{Binding ToggleCommand}"');
  notIncludes(x, 'Command="{Binding StartCommand}"', "toggle replaces the separate Start button");
  notIncludes(x, 'Command="{Binding StopCommand}"', "toggle replaces the separate Stop button");
  xmlBalanced(x);
});

/* ============ interval + step customisation ============ */
test("custom interval + step flow through to timer + tick body", () => {
  const code = vmCode({ intervalMs: 250, step: 5 });
  includes(code, "TimeSpan.FromMilliseconds(250)");
  includes(code, "Count += 5;");
  notIncludes(code, "Count++;");    /* step != 1 uses += form */
});

/* ============ AXAML snippet ============ */
test("AXAML snippet: xml-balanced, bound value + command buttons", () => {
  const file = C.generateAxaml({});
  const x = file.code;
  includes(x, '<TextBlock Text="{Binding Count}"');
  includes(x, 'Command="{Binding StartCommand}"');
  includes(x, 'Command="{Binding StopCommand}"');
  includes(x, 'Command="{Binding ResetCommand}"');
  xmlBalanced(x);
});

test("AXAML snippet: progress -> ProgressBar, list -> ListBox", () => {
  xmlBalanced(C.generateAxaml({ pattern: "progress" }).code);
  includes(C.generateAxaml({ pattern: "progress" }).code, "<ProgressBar");
  xmlBalanced(C.generateAxaml({ pattern: "list" }).code);
  includes(C.generateAxaml({ pattern: "list" }).code, '<ListBox ItemsSource="{Binding Items}"');
});

/* ============ G11: pauseLabel sets the stop button Content, command unchanged ============ */
test("pauseLabel: default is 'Stop' and the snippet output is byte-for-byte unchanged", () => {
  /* the default config must reproduce the historic Stop button line exactly,
     including the two-space alignment before Command= */
  eq(C.normalize({}).pauseLabel, "Stop", "default pauseLabel is Stop");
  const x = C.generateAxaml({}).code;
  includes(x, '        <Button Content="Stop"  Command="{Binding StopCommand}"/>');
  /* and the same default holds for the submission AXAML pair */
  const sub = C.generateSubmission({})[1].code;
  includes(sub, '<Button Content="Stop"  Command="{Binding StopCommand}"/>');
});

test("pauseLabel: 'Pause' sets Content=\"Pause\" on the stop button, binding unchanged", () => {
  const x = C.generateAxaml({ pauseLabel: "Pause" }).code;
  /* the Content changes... */
  includes(x, 'Content="Pause"');
  notIncludes(x, 'Content="Stop"', "the old Stop label must be gone when overridden");
  /* ...but the command binding stays StopCommand (command name unchanged) */
  includes(x, 'Content="Pause" Command="{Binding StopCommand}"/>');
  /* the Start and Reset buttons are untouched */
  includes(x, 'Content="Start" Command="{Binding StartCommand}"/>');
  includes(x, 'Content="Reset" Command="{Binding ResetCommand}"/>');
  xmlBalanced(x);

  /* the submission AXAML honours pauseLabel the same way */
  const sub = C.generateSubmission({ pauseLabel: "Pause" })[1].code;
  includes(sub, 'Content="Pause" Command="{Binding StopCommand}"/>');
  notIncludes(sub, 'Content="Stop"', "submission stop button respects pauseLabel");
  xmlBalanced(sub);
});

test("pauseLabel: blank/garbage falls back to Stop; XML-special chars are escaped", () => {
  /* empty / whitespace-only -> default Stop */
  eq(C.normalize({ pauseLabel: "   " }).pauseLabel, "Stop");
  eq(C.normalize({ pauseLabel: "" }).pauseLabel, "Stop");
  eq(C.normalize({ pauseLabel: null }).pauseLabel, "Stop");
  /* a label with XML-special chars is escaped so the attribute stays valid */
  const x = C.generateAxaml({ pauseLabel: 'P&use "<x>"' }).code;
  notIncludes(x, '<Button Content="P&use', "raw & must be escaped");
  includes(x, "&amp;");
  includes(x, "&lt;");
  includes(x, "&gt;");
  includes(x, "&quot;");
  xmlBalanced(x);
});

/* ============ headless test file ============ */
test("headless test: [AvaloniaFact], TestApplication, timing-tolerant InRange, reset assert", () => {
  const file = C.generateTest({});
  const t = file.code;
  includes(t, "[AvaloniaFact]");
  includes(t, "[assembly: AvaloniaTestApplication(typeof(MainWindowViewModelTests))]");
  includes(t, ".UseHeadless(new AvaloniaHeadlessPlatformOptions());");
  includes(t, "vm.StartCommand.Execute(null);");
  includes(t, "Assert.InRange(vm.Count, 2, 5);");
  includes(t, "Assert.Equal(0, vm.Count);");
  /* never an exact-tick Assert.Equal on a running counter */
  notIncludes(t, "Assert.Equal(3, vm.Count)");
  braceBalanced(t);
  parenBalanced(t);
});

/* ============ top-level generate + options ============ */
test("generate: ViewModel only by default; AXAML + test added when flagged", () => {
  const vmOnly = C.generate({});
  eq(vmOnly.length, 1);
  eq(vmOnly[0].fileName, "MainWindowViewModel.cs");

  const all = C.generate({ emitAxaml: true, emitTest: true });
  const names = all.map((f) => f.fileName);
  includes(names.join(","), "MainWindowViewModel.cs");
  includes(names.join(","), "MainWindow.axaml");
  includes(names.join(","), "MainWindowViewModelTests.cs");
  eq(all.length, 3);
});

test("every generated C# file across all pattern/mechanism combos is brace+paren balanced and TODO-free", () => {
  const patterns = C.PATTERNS;
  const mechanisms = C.MECHANISMS;
  /* command surfaces to sweep: full Start/Stop/Reset, toggle alongside, and the
     toggle-only single-button surface (start/stop buttons unchecked) — the last
     one regresses the "Toggle calls undefined Start()/Stop()" bug. */
  const cmdSurfaces = [
    { start: true,  stop: true,  reset: true, toggle: false },
    { start: true,  stop: true,  reset: true, toggle: true },
    { start: false, stop: false, reset: true, toggle: true },
  ];
  patterns.forEach((p) => mechanisms.forEach((mech) => {
    [false, true].forEach((ce) => cmdSurfaces.forEach((cmds) => {
      const cfg = {
        pattern: p, mechanism: mech, canExecute: ce,
        commands: cmds,
        emitAxaml: true, emitTest: true,
      };
      C.generate(cfg).forEach((file) => {
        if (file.lang === "xml") xmlBalanced(file.code);
        else { braceBalanced(file.code); parenBalanced(file.code); }
        notIncludes(file.code, "TODO", p + "/" + mech + " must have no TODO");
      });
    }));
  }));
});

/* ============ robustness + normalisation ============ */
test("normalize: garbage config falls back to safe defaults", () => {
  const n = C.normalize({ pattern: "xyz", mechanism: "nope", intervalMs: -4, step: 0, commands: "bad" });
  eq(n.pattern, "counter");
  eq(n.mechanism, "timer");
  eq(n.intervalMs, 100);
  eq(n.step, 1);
  ok(n.commands.start, "Start guaranteed when nothing enables a way to start");
});

test("normalize: a config with neither Start nor Toggle still gets a Start command", () => {
  const n = C.normalize({ commands: { start: false, stop: true, reset: true, toggle: false } });
  ok(n.commands.start, "must force Start so the worker is reachable");
});

test("generate never throws on weird input and always returns a ViewModel", () => {
  [null, undefined, 42, "x", { commands: null }, { pattern: 5 }].forEach((bad) => {
    const out = C.generate(bad);
    ok(Array.isArray(out) && out.length >= 1, "always at least the ViewModel");
    eq(out[0].fileName, "MainWindowViewModel.cs");
    braceBalanced(out[0].code);
  });
});

/* ============ escaping / namespace safety ============ */
test("namespace + baseType are sanitised against injection", () => {
  const code = vmCode({ namespace: "Evil { } class X", baseType: "Bad Type;" });
  /* invalid identifiers fall back to defaults, never injected verbatim */
  includes(code, "namespace Counter.ViewModels;");
  includes(code, ": ViewModelBase");
  braceBalanced(code);
  /* a valid custom namespace IS honoured */
  includes(vmCode({ namespace: "MyApp.ViewModels" }), "namespace MyApp.ViewModels;");
});

/* ============ spec 16: exam submission pair (Problem 3) ============ */

test("generateSubmission: returns exactly the Problem_3 VM + AXAML pair, in that order", () => {
  const files = C.generateSubmission({});
  ok(Array.isArray(files), "submission is an array");
  eq(files.length, 2, "exactly two graded files (no xUnit test in the pair)");
  eq(files[0].fileName, "Problem_3_MainWindowViewModel.cs");
  eq(files[1].fileName, "Problem_3_MainWindow.axaml");
  eq(files[0].lang, "csharp");
  eq(files[1].lang, "xml");
  /* exposed file-name constants line up with what the UI/grader expect */
  eq(C.SUBMISSION_VM_FILE, "Problem_3_MainWindowViewModel.cs");
  eq(C.SUBMISSION_AXAML_FILE, "Problem_3_MainWindow.axaml");
});

test("submission VM: pinned to ExamApp.ViewModels, type stays MainWindowViewModel, balanced", () => {
  const vm = C.generateSubmission({})[0].code;
  includes(vm, "// Problem_3_MainWindowViewModel.cs");
  includes(vm, "namespace ExamApp.ViewModels;");
  includes(vm, "public partial class MainWindowViewModel : ViewModelBase");
  /* default body is still the verified ReExam counter */
  includes(vm, "private readonly DispatcherTimer _timer;");
  includes(vm, "Count++;");
  includes(vm, "private void Start()");
  includes(vm, "private void Stop()");
  includes(vm, "private void Reset()");
  notIncludes(vm, "TODO");
  /* the in-app banner is gone, replaced by the submission banner */
  notIncludes(vm, "generated by Async Composer");
  notIncludes(vm, "// ViewModels/MainWindowViewModel.cs");
  braceBalanced(vm);
  parenBalanced(vm);
});

test("submission AXAML: COMPLETE Window, x:Class ExamApp.Views.MainWindow, xmlns:vm + Design.DataContext", () => {
  const ax = C.generateSubmission({})[1].code;
  /* a complete Window root (not the drop-inside-a-panel snippet) */
  includes(ax, "<Window ");
  includes(ax, 'x:Class="ExamApp.Views.MainWindow"');
  includes(ax, 'xmlns:vm="using:ExamApp.ViewModels"');
  includes(ax, 'x:DataType="vm:MainWindowViewModel"');
  includes(ax, "<Design.DataContext>");
  includes(ax, "<vm:MainWindowViewModel/>");
  /* the composer's controls are inside */
  includes(ax, '<TextBlock Text="{Binding Count}"');
  includes(ax, 'Command="{Binding StartCommand}"');
  includes(ax, 'Command="{Binding StopCommand}"');
  includes(ax, 'Command="{Binding ResetCommand}"');
  includes(ax, "</Window>");
  /* the x:Class root + the VM namespace agree so a grader can drop the pair in */
  includes(C.generateSubmission({})[0].code, "namespace ExamApp.ViewModels;");
  xmlBalanced(ax);
});

test("submission AXAML: progress -> ProgressBar, list -> ListBox, all complete Windows", () => {
  const prog = C.generateSubmission({ pattern: "progress" })[1].code;
  includes(prog, "<Window ");
  includes(prog, "<ProgressBar");
  includes(prog, 'x:Class="ExamApp.Views.MainWindow"');
  xmlBalanced(prog);

  const list = C.generateSubmission({ pattern: "list" })[1].code;
  includes(list, "<Window ");
  includes(list, '<ListBox ItemsSource="{Binding Items}"');
  xmlBalanced(list);
});

test("submission AXAML: toggle shows ONLY the single Start/Stop button, no separate Start+Stop", () => {
  const ax = C.generateSubmission({ commands: { start: false, stop: false, reset: true, toggle: true } })[1].code;
  includes(ax, 'Command="{Binding ToggleCommand}"');
  notIncludes(ax, 'Command="{Binding StartCommand}"', "toggle replaces the separate Start button");
  notIncludes(ax, 'Command="{Binding StopCommand}"', "toggle replaces the separate Stop button");
  xmlBalanced(ax);
});

/* spec 16 rule 4: the submission VM must only `using` System.*, Avalonia*, CommunityToolkit.Mvvm.* */
test("submission VM: no foreign using directives across every pattern/mechanism/command surface", () => {
  const cmdSurfaces = [
    { start: true,  stop: true,  reset: true, toggle: false },
    { start: true,  stop: true,  reset: true, toggle: true },
    { start: false, stop: false, reset: true, toggle: true },
  ];
  C.PATTERNS.forEach((p) => C.MECHANISMS.forEach((mech) => {
    [false, true].forEach((ce) => cmdSurfaces.forEach((cmds) => {
      const vm = C.generateSubmission({
        pattern: p, mechanism: mech, canExecute: ce, commands: cmds,
      })[0].code;
      const nss = usingNamespaces(vm);
      ok(nss.length > 0, p + "/" + mech + ": VM has at least one using");
      nss.forEach((ns) => {
        ok(isAllowedSubmissionUsing(ns),
          p + "/" + mech + ": forbidden using " + JSON.stringify(ns) + " (only System/Avalonia/CommunityToolkit.Mvvm allowed)");
      });
    }));
  }));
});

test("submission pair: brace/paren/xml balanced + TODO-free across all combos", () => {
  C.PATTERNS.forEach((p) => C.MECHANISMS.forEach((mech) => {
    [false, true].forEach((ce) => {
      const files = C.generateSubmission({ pattern: p, mechanism: mech, canExecute: ce });
      eq(files.length, 2, p + "/" + mech + " emits the pair");
      files.forEach((f) => {
        if (f.lang === "xml") xmlBalanced(f.code);
        else { braceBalanced(f.code); parenBalanced(f.code); }
        notIncludes(f.code, "TODO", p + "/" + mech + " submission must have no TODO");
      });
    });
  }));
});

test("submission export does not depend on PROJZIP (plain core, no zip)", () => {
  /* generateSubmission must work with window.PROJZIP entirely absent */
  const hadPZ = global.PROJZIP;
  delete global.PROJZIP;
  try {
    const files = C.generateSubmission({});
    eq(files.length, 2, "submission pair builds with no PROJZIP loaded");
  } finally {
    if (hadPZ) global.PROJZIP = hadPZ;
  }
});

/* ============ mechanism note ============ */
test("mechanismNote explains DispatcherTimer vs Task and the thread rule", () => {
  const note = C.mechanismNote().join("\n");
  includes(note, "DispatcherTimer");
  includes(note, "UI");
  includes(note, "CancellationTokenSource");
  includes(note, "OperationCanceledException");
});

/* ============ v7 rename: tool is "Async Composer", not "Async Lab" ============
   the registry, tab title and Exam Guide all say "Async Composer"; the generated
   banners and the rendered tab must match so nothing still calls itself "Async Lab". */
test("generated banners say 'Async Composer' and never 'Async Lab'", () => {
  /* the ViewModel header banner */
  const vm = vmCode({});
  includes(vm, "generated by Async Composer");
  notIncludes(vm, "Async Lab", "ViewModel banner must not say the old name");
  /* the headless test file header banner */
  const t = C.generateTest({}).code;
  includes(t, "generated by Async Composer");
  notIncludes(t, "Async Lab", "test banner must not say the old name");
  /* the rename is cosmetic-only: the default VM still compiles to the same shape */
  includes(vm, "TimeSpan.FromMilliseconds(100)");
  includes(vm, "Count++;");
  braceBalanced(vm);
  parenBalanced(vm);
});

test("rendered tab brands as 'Async Composer' (crumb + title), not 'Async Lab'", () => {
  const els = {};
  global.window = global;
  global.localStorage = {
    _d: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
  };
  global.document = {
    getElementById(id) { return els[id] || (els[id] = { innerHTML: "", textContent: "" }); },
    querySelector() { return null; },
  };
  delete require.cache[require.resolve("../data/asynclab.js")];
  require("../data/asynclab-core.js");
  require("../data/asynclab.js");
  const page = global.ASYNCLAB.render();
  includes(page, "ASYNC COMPOSER", "crumb shows the new name");
  includes(page, ">Async Composer</h1>", "h1 shows the new name");
  notIncludes(page, "ASYNC LAB", "old crumb text must be gone");
  notIncludes(page, ">Async Lab</h1>", "old h1 text must be gone");
});

/* tickLabel keeps the same human string after the dead-ternary cleanup: always "ms". */
test("tickLabel renders '+step every Nms' with a plain ms suffix", () => {
  includes(vmCode({}), "+1 every 100ms");
  includes(vmCode({ intervalMs: 1 }), "+1 every 1ms");
  includes(vmCode({ intervalMs: 250, step: 5 }), "+5 every 250ms");
});

/* ============ Node-loadable ============ */
test("core module loads under Node and exposes the public API", () => {
  ok(typeof C.generate === "function");
  ok(typeof C.generateViewModel === "function");
  ok(typeof C.generateAxaml === "function");
  ok(typeof C.generateTest === "function");
  ok(typeof C.normalize === "function");
  ok(Array.isArray(C.PATTERNS) && Array.isArray(C.MECHANISMS));
});

/* ============ UI module: load-safe + render + escape ============ */
test("asynclab.js never touches document at load time (only inside functions)", () => {
  const fs = require("fs");
  const src = fs.readFileSync(__dirname + "/../data/asynclab.js", "utf8");
  /* drop function bodies, then assert no top-level document.* access */
  const topLevel = src.replace(/function[\s\S]*?\n\}/g, "");
  ok(topLevel.indexOf("document.") === -1, "document.* found at top level");
});

test("asynclab UI module loads under Node and exposes render/init on window.ASYNCLAB", () => {
  global.window = global;
  require("../data/asynclab-core.js");
  require("../data/asynclab.js");
  ok(typeof global.ASYNCLAB.render === "function", "ASYNCLAB.render missing");
  ok(typeof global.ASYNCLAB.init === "function", "ASYNCLAB.init missing");
  ok(global.AL && typeof global.AL.regenerate === "function", "handlers must live on window.AL");
  ok(typeof global.AL.setPattern === "function", "AL.setPattern missing");
  ok(typeof global.AL.copyAll === "function", "AL.copyAll missing");
});

test("rendered output escapes HTML and renders the file cards (XSS-safe namespace)", () => {
  const els = {};
  global.window = global;
  global.localStorage = {
    _d: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
  };
  global.document = {
    getElementById(id) { return els[id] || (els[id] = { innerHTML: "", textContent: "" }); },
    querySelector() { return null; },
  };
  require("../data/asynclab-core.js");
  require("../data/asynclab.js");
  /* render builds the page + registers containers */
  const page = global.ASYNCLAB.render();
  ok(page.indexOf("ASYNC COMPOSER") !== -1, "render produced page");
  /* feed an XSS payload through a config field, regenerate, inspect output */
  global.AL.setEmitAxaml(true);
  global.AL.regenerate();
  const out = els["al-files"].innerHTML;
  ok(out.length > 0, "files rendered");
  ok(out.indexOf("MainWindowViewModel.cs") !== -1, "ViewModel card present");
  /* the generated C# contains generic <string> etc.; angle brackets must be escaped */
  includes(out, "&lt;", "angle brackets in generated code must be escaped");
  notIncludes(out, "<script>", "raw <script> must never reach innerHTML");
});

/* ============ spec 13/14: project export + reliability/polish ============ */

/* a reusable browser-ish environment for the UI module; optionally with the
   Blob/URL/anchor machinery the .zip download path needs. Returns {els, store}.
   Deleting the UI module from require.cache first guarantees fresh module state. */
function freshUI(opts) {
  opts = opts || {};
  const els = {};
  const created = [];
  const store = {
    _d: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
  };
  if (opts.seed != null) store._d["aop-asynclab-state"] = opts.seed;

  global.window = global;
  global.localStorage = store;
  global.document = {
    getElementById(id) { return els[id] || (els[id] = { innerHTML: "", textContent: "" }); },
    querySelector() { return null; },
    createElement(tag) {
      const node = { tagName: tag, style: {}, _clicked: 0,
        setAttribute() {}, click() { this._clicked++; }, select() {} };
      created.push(node);
      return node;
    },
    body: { appendChild() {}, removeChild() {} },
  };
  global._created = created;

  /* the zip download path: provide Blob + URL only when asked */
  if (opts.browserDownload) {
    global.Blob = function (parts, o) { this.parts = parts; this.type = o && o.type; };
    global.URL = { _n: 0, createObjectURL() { return "blob:fake/" + (++this._n); }, revokeObjectURL() {} };
    global.PROJZIP = require("../data/projzip-core.js");
  } else if (opts.withProjzip) {
    global.PROJZIP = require("../data/projzip-core.js");
  } else {
    delete global.PROJZIP;
  }

  /* fresh UI module instance so module-level `state` starts clean */
  delete require.cache[require.resolve("../data/asynclab.js")];
  require("../data/asynclab-core.js");
  require("../data/asynclab.js");
  return { els, store, created };
}

test("localStorage payload is version-stamped {v:1, config, projectName}", () => {
  const { els, store } = freshUI({ withProjzip: true });
  global.ASYNCLAB.render();
  global.AL.setInterval(250);   // any mutation triggers a save
  const saved = JSON.parse(store.getItem("aop-asynclab-state"));
  eq(saved.v, 1, "payload carries the version stamp");
  ok(saved.config && typeof saved.config === "object", "config persisted");
  eq(saved.projectName, "AsyncApp", "default project name persisted");
});

test("migration: a v4 un-stamped {config} blob loads without throwing and keeps the config", () => {
  /* v4 wrote { config: {...} } with no version field and no projectName */
  const legacy = JSON.stringify({ config: { pattern: "progress", mechanism: "task", intervalMs: 250 } });
  const { els } = freshUI({ withProjzip: true, seed: legacy });
  const page = global.ASYNCLAB.render();
  ok(page.indexOf("ASYNC COMPOSER") !== -1, "render survived the legacy blob");
  /* config came through normalised; projectName defaulted */
  global.AL.regenerate();
  const out = els["al-files"].innerHTML;
  ok(out.indexOf("MainWindowViewModel.cs") !== -1, "generated from migrated config");
  ok(out.indexOf('value="AsyncApp"') !== -1, "missing projectName defaults to AsyncApp");
});

test("migration: tampered / unknown-shape blob falls back to defaults, never throws", () => {
  ["{}", "null", '"a string"', "[1,2,3]", '{"v":99,"config":42}', "not json at all"].forEach((bad) => {
    const { els } = freshUI({ withProjzip: true, seed: bad });
    const page = global.ASYNCLAB.render();   // must not throw
    ok(page.indexOf("ASYNC COMPOSER") !== -1, "render produced page for blob: " + bad);
  });
});

test("export bar: present when window.PROJZIP loaded, gracefully hidden when absent", () => {
  /* with projzip: once files exist (init generates the default VM) the export controls render */
  let ui = freshUI({ withProjzip: true });
  global.ASYNCLAB.render();
  global.ASYNCLAB.init();
  let out = ui.els["al-files"].innerHTML;
  includes(out, "Export project (.zip)", "export button present when PROJZIP loaded");
  includes(out, 'id="al-proj-name"', "project-name input present");

  /* without projzip: the bar still renders copy-all but NO export button -> no crash */
  ui = freshUI({ withProjzip: false });
  global.ASYNCLAB.render();
  global.ASYNCLAB.init();
  out = ui.els["al-files"].innerHTML;
  notIncludes(out, "Export project (.zip)", "export button hidden when PROJZIP missing");
  includes(out, "copy all", "copy-all stays available without PROJZIP");
});

test("error state: a core that returns nothing renders a styled panel, never a blank pane or throw", () => {
  const { els } = freshUI({ withProjzip: true });
  global.ASYNCLAB.render();
  /* monkeypatch the core to simulate a generation failure */
  const realGen = global.ASYNCLAB_CORE.generate;
  global.ASYNCLAB_CORE.generate = function () { throw new Error("boom from core"); };
  try {
    global.AL.regenerate();   // must not throw
    const out = els["al-files"].innerHTML;
    includes(out, "al-error", "styled error panel rendered");
    includes(out, "boom from core", "the failure message is surfaced");
    notIncludes(out, "al-card", "no half-rendered file cards on error");
  } finally {
    global.ASYNCLAB_CORE.generate = realGen;
  }
});

test("export click: builds a real .zip, fires a download, and the project namespace is pinned to <name>.ViewModels", () => {
  const { els, created } = freshUI({ browserDownload: true });
  global.ASYNCLAB.render();
  global.AL.setProjectName("My Exam App!");   // junk chars -> sanitised on export
  const btn = { textContent: "Export project (.zip)", getAttribute() { return null; },
    setAttribute() {}, classList: { add() {}, remove() {} } };
  global.AL.exportProject(btn);               // must not throw
  /* a download anchor was created + clicked */
  const anchor = created.filter((n) => n.tagName === "a").pop();
  ok(anchor && anchor._clicked > 0, "a download anchor was clicked");

  /* independently rebuild the same entries via the public cores and assert the
     exported project is structurally sound + namespaced to the sanitised name. */
  const PZ = require("../data/projzip-core.js");
  const safe = PZ.sanitizeName("My Exam App!", "AsyncApp");          // -> My_Exam_App
  const cfg = C.normalize({ namespace: safe + ".ViewModels", emitAxaml: true });
  const vm = C.generateViewModel(cfg).code;
  const ax = C.generateAxaml(cfg).code;
  const entries = PZ.avaloniaProject("My Exam App!", { axaml: ax, viewModel: vm });
  const byPath = {};
  entries.forEach((e) => { byPath[e.path] = e.text; });
  ok(byPath["My_Exam_App.csproj"], "csproj named after the sanitised project");
  xmlBalanced(byPath["My_Exam_App.csproj"]);
  includes(byPath["ViewModels/MainWindowViewModel.cs"], "namespace My_Exam_App.ViewModels;");
  includes(byPath["App.axaml.cs"], "using My_Exam_App.ViewModels;");
  /* the wrapped MainWindow carries the counter snippet + matching x:DataType */
  xmlBalanced(byPath["Views/MainWindow.axaml"]);
  includes(byPath["Views/MainWindow.axaml"], 'x:DataType="vm:MainWindowViewModel"');
  includes(byPath["Views/MainWindow.axaml"], 'Command="{Binding StartCommand}"');
});

/* ============ spec 16: submission download UI wiring ============ */

test("submission bar: the Download submission files button + flat-submit hint always render", () => {
  /* present WITH projzip... */
  let ui = freshUI({ withProjzip: true });
  global.ASYNCLAB.render();
  global.ASYNCLAB.init();
  let out = ui.els["al-files"].innerHTML;
  includes(out, "Download submission files", "submission button present with PROJZIP");
  includes(out, "submit flat: 6 files, no bin/obj, no subfolders", "flat-submit hint present");
  includes(out, "AL.downloadSubmission", "button wired to AL.downloadSubmission");

  /* ...and present WITHOUT projzip (submission download must not depend on the zip core) */
  ui = freshUI({ withProjzip: false });
  global.ASYNCLAB.render();
  global.ASYNCLAB.init();
  out = ui.els["al-files"].innerHTML;
  includes(out, "Download submission files", "submission button present even without PROJZIP");
  includes(out, "submit flat: 6 files, no bin/obj, no subfolders", "hint present without PROJZIP");
  notIncludes(out, "Export project (.zip)", "zip export still hidden without PROJZIP");
});

test("AL.downloadSubmission exists and is wired on window.AL", () => {
  freshUI({ withProjzip: false });
  ok(global.AL && typeof global.AL.downloadSubmission === "function", "AL.downloadSubmission missing");
});

test("download click: fires two plain-text downloads with the exact Problem_3 file names", () => {
  const { els, created } = freshUI({ browserDownload: true });
  global.ASYNCLAB.render();
  global.ASYNCLAB.init();
  const btn = { textContent: "Download submission files", getAttribute() { return null; },
    setAttribute() {}, classList: { add() {}, remove() {} } };
  global.AL.downloadSubmission(btn);   // must not throw
  /* two anchors were created + clicked, named after the two graded files */
  const anchors = created.filter((n) => n.tagName === "a" && n._clicked > 0);
  const names = anchors.map((a) => a.download);
  ok(names.indexOf("Problem_3_MainWindowViewModel.cs") !== -1, "VM file downloaded");
  ok(names.indexOf("Problem_3_MainWindow.axaml") !== -1, "AXAML file downloaded");
});

test("download path works without PROJZIP loaded (plain blobs, no zip)", () => {
  /* browserDownload gives Blob+URL+PROJZIP; rebuild it WITHOUT projzip to prove independence */
  const { created } = freshUI({ browserDownload: true });
  delete global.PROJZIP;               // strip the zip core entirely
  global.ASYNCLAB.render();
  global.ASYNCLAB.init();
  const btn = { textContent: "x", getAttribute() { return null; }, setAttribute() {},
    classList: { add() {}, remove() {} } };
  global.AL.downloadSubmission(btn);   // must not throw with PROJZIP absent
  const anchors = created.filter((n) => n.tagName === "a" && n._clicked > 0);
  ok(anchors.length >= 2, "both submission files downloaded with no PROJZIP");
});

test("export entries: every pattern/mechanism produces a brace+xml balanced, namespace-consistent project", () => {
  const PZ = require("../data/projzip-core.js");
  C.PATTERNS.forEach((p) => C.MECHANISMS.forEach((mech) => {
    const safe = "ExamApp";
    const cfg = C.normalize({ pattern: p, mechanism: mech, namespace: safe + ".ViewModels", emitAxaml: true });
    const vm = C.generateViewModel(cfg).code;
    const ax = C.generateAxaml(cfg).code;
    const entries = PZ.avaloniaProject(safe, { axaml: ax, viewModel: vm });
    const byPath = {};
    entries.forEach((e) => { byPath[e.path] = e.text; });
    /* VM + App wiring agree on the namespace -> compiles */
    includes(byPath["ViewModels/MainWindowViewModel.cs"], "namespace ExamApp.ViewModels;", p + "/" + mech + " VM ns");
    includes(byPath["App.axaml.cs"], "new MainWindowViewModel()", p + "/" + mech + " App ctor wiring");
    braceBalanced(byPath["ViewModels/MainWindowViewModel.cs"]);
    xmlBalanced(byPath["Views/MainWindow.axaml"]);
    xmlBalanced(byPath[safe + ".csproj"]);
  }));
});
