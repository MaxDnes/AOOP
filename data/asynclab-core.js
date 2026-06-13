/* ============================================================
   ASYNC LAB CORE · pure config -> complete async ViewModel
   UMD module: attaches window.ASYNCLAB_CORE in the browser and
   module.exports under Node. NO DOM access anywhere in this file.
   Given a small config object (pattern / mechanism / interval / step /
   commands / options) it emits a COMPLETE, compilable
   MainWindowViewModel.cs implementing the exam Problem 3 async variant
   ("counter +1 every 100ms; start/stop preserves value; resume
   continues; reset zeroes; all UI updates on the UI thread"), plus an
   optional matching AXAML snippet and an optional headless xUnit test.

   Calibration target (default config): the VERIFIED ReExam P3 model
   solution in data/solutions-reexam.js (DispatcherTimer counter, +1 /
   100ms, Start=begin/resume, Stop=pause keep value, Reset=stop+zero).
   Default output is desk-check equivalent to that file.
   ============================================================ */

(function (global) {
  "use strict";

  /* ===================== defaults / normalisation ===================== */

  var PATTERNS = ["counter", "progress", "list"];
  var MECHANISMS = ["timer", "task", "both"];

  function defaultConfig() {
    return {
      pattern: "counter",      /* counter | progress | list */
      mechanism: "timer",      /* timer | task | both */
      intervalMs: 100,
      step: 1,
      commands: { start: true, stop: true, reset: true, toggle: false },
      pauseLabel: "Stop",      /* Content of the pause/stop button; command name unchanged */
      canExecute: false,       /* [RelayCommand(CanExecute=...)] + [NotifyCanExecuteChangedFor] */
      resetStops: true,        /* Reset stops the worker too (default keeps ReExam behaviour: stop+zero) */
      emitAxaml: false,
      emitTest: false,
      namespace: "Counter.ViewModels",
      baseType: "ViewModelBase",
    };
  }

  /* coerce arbitrary user input into a safe, complete config */
  function normalize(cfg) {
    var d = defaultConfig();
    cfg = (cfg && typeof cfg === "object") ? cfg : {};

    var pattern = PATTERNS.indexOf(cfg.pattern) !== -1 ? cfg.pattern : d.pattern;
    var mechanism = MECHANISMS.indexOf(cfg.mechanism) !== -1 ? cfg.mechanism : d.mechanism;

    var interval = parseInt(cfg.intervalMs, 10);
    if (!isFinite(interval) || interval <= 0) interval = d.intervalMs;

    var step = parseInt(cfg.step, 10);
    if (!isFinite(step) || step === 0) step = d.step;

    var cmdIn = (cfg.commands && typeof cfg.commands === "object") ? cfg.commands : {};
    var commands = {
      start: cmdIn.start !== false,            /* default on */
      stop: cmdIn.stop !== false,              /* default on */
      reset: cmdIn.reset !== false,            /* default on */
      toggle: cmdIn.toggle === true,           /* default off */
    };
    /* a worker with no way to start is useless; guarantee Start unless Toggle covers it */
    if (!commands.start && !commands.toggle) commands.start = true;
    /* the Toggle single-button variant DELEGATES to Start()/Stop(); those method
       bodies must exist for it to compile, so force them on whenever Toggle is on
       (the AXAML still shows only the single Start/Stop button). */
    if (commands.toggle) { commands.start = true; commands.stop = true; }
    /* the progress worker self-stops at 100 by calling Stop(); that method must
       exist, so the Stop command is mandatory for this pattern. */
    if (pattern === "progress") commands.stop = true;

    return {
      pattern: pattern,
      mechanism: mechanism,
      intervalMs: interval,
      step: step,
      commands: commands,
      pauseLabel: sanitizeLabel(cfg.pauseLabel) || d.pauseLabel,
      canExecute: cfg.canExecute === true,
      resetStops: cfg.resetStops !== false,    /* default true */
      emitAxaml: cfg.emitAxaml === true,
      emitTest: cfg.emitTest === true,
      namespace: sanitizeNs(cfg.namespace) || d.namespace,
      baseType: sanitizeIdent(cfg.baseType) || d.baseType,
    };
  }

  function sanitizeNs(s) {
    s = String(s == null ? "" : s).trim();
    return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(s) ? s : "";
  }
  function sanitizeIdent(s) {
    s = String(s == null ? "" : s).trim();
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : "";
  }
  /* drop ASCII control characters (0x00-0x1F and 0x7F) without putting any
     control bytes in this source file. */
  function stripControls(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code >= 32 && code !== 127) out += s.charAt(i);
    }
    return out;
  }
  /* the pause/stop button Content is free text the student picks (e.g. "Pause").
     Trim it, drop ASCII control chars, and XML-escape it so it drops safely into
     an AXAML Content="..." attribute. Empty input falls back to the default. */
  function sanitizeLabel(s) {
    s = stripControls(String(s == null ? "" : s)).trim();
    if (!s) return "";
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ===================== per-pattern descriptors ===================== */

  /* Each pattern decides: the observed property, its type, the worker's
     per-tick body, the reset body, completion handling, and any extra
     fields/usings it needs. Mechanism-specific code wraps these. */
  function patternInfo(cfg) {
    if (cfg.pattern === "progress") {
      return {
        name: "progress",
        prop: "Progress",
        field: "_progress",
        propType: "int",
        usings: [],
        /* fields beyond the observed property + IsRunning */
        extraFields: [],
        /* per-tick mutation; advances toward 100 then stops at completion */
        tickBody: [
          "Progress += " + cfg.step + ";",
          "if (Progress >= 100)",
          "{",
          "    Progress = 100;",
          "    Stop();                 // worker completes and stops at 100",
          "}",
        ],
        resetExtra: ["Progress = 0;"],
        zeroExpr: "Progress = 0;",
        comment: "// progress worker: advances " + cfg.step + " per tick, completes and stops at 100",
      };
    }
    if (cfg.pattern === "list") {
      return {
        name: "list",
        prop: "Items",
        field: null,                /* ObservableCollection, not an [ObservableProperty] */
        propType: "ObservableCollection<string>",
        usings: ["using System.Collections.ObjectModel;"],
        extraFields: [
          "// the collection mutated on every tick; bound to an ItemsControl/ListBox",
          "public ObservableCollection<string> Items { get; } = new();",
          "private int _next = 1;",
        ],
        tickBody: [
          "// periodic list mutator: add one item each tick",
          'Items.Add($"Item {_next++}");',
        ],
        resetExtra: ["Items.Clear();", "_next = 1;"],
        zeroExpr: "Items.Clear();",
        comment: "// periodic list mutator: acts on an ObservableCollection each tick",
      };
    }
    /* default: counter */
    return {
      name: "counter",
      prop: "Count",
      field: "_count",
      propType: "int",
      usings: [],
      extraFields: [],
      tickBody: cfg.step === 1
        ? ["Count++;"]
        : ["Count += " + cfg.step + ";"],
      resetExtra: [],
      zeroExpr: "Count = 0;",
      comment: "// counter: +" + cfg.step + " per tick",
    };
  }

  /* ===================== helpers ===================== */

  function dedup(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { if (x != null && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  function indent(lines, pad) {
    return lines.map(function (l) { return l === "" ? "" : pad + l; });
  }

  /* the property whose value Start/Stop gate on, for CanExecute wiring */
  var RUNNING_PROP = "IsRunning";

  /* ===================== usings ===================== */

  function buildUsings(cfg, info) {
    var u = [
      "using CommunityToolkit.Mvvm.ComponentModel;",
      "using CommunityToolkit.Mvvm.Input;",
    ];
    info.usings.forEach(function (x) { u.push(x); });

    if (cfg.mechanism === "timer" || cfg.mechanism === "both") {
      u.push("using System;");                 /* TimeSpan, EventArgs */
      u.push("using Avalonia.Threading;");      /* DispatcherTimer */
    }
    if (cfg.mechanism === "task" || cfg.mechanism === "both") {
      u.push("using System;");                   /* OperationCanceledException */
      u.push("using System.Threading;");        /* CancellationTokenSource */
      u.push("using System.Threading.Tasks;");  /* Task */
      u.push("using Avalonia.Threading;");       /* Dispatcher.UIThread */
    }
    return dedup(u);
  }

  /* ===================== field block ===================== */

  function buildFields(cfg, info) {
    var L = [];

    /* observed property (counter/progress are [ObservableProperty] fields;
       the list pattern owns an ObservableCollection in extraFields) */
    if (info.field) {
      L.push("    [ObservableProperty]");
      L.push("    private " + info.propType + " " + info.field + " = " +
        (info.propType === "int" ? "0" : "default!") + ";");
      L.push("");
    }

    /* IsRunning is needed when CanExecute wiring is on, or Toggle exists,
       or the progress pattern (to flag completion state). */
    var needRunning = cfg.canExecute || cfg.commands.toggle || cfg.pattern === "progress";
    if (needRunning) {
      if (cfg.canExecute) {
        /* the flag drives CanExecute on Start/Stop; notify those commands */
        L.push("    [ObservableProperty]");
        L.push("    [NotifyCanExecuteChangedFor(nameof(StartCommand))]");
        L.push("    [NotifyCanExecuteChangedFor(nameof(StopCommand))]");
        if (cfg.commands.toggle) L.push("    [NotifyCanExecuteChangedFor(nameof(ToggleCommand))]");
        L.push("    private bool " + lc(RUNNING_PROP) + ";");
      } else {
        L.push("    [ObservableProperty]");
        L.push("    private bool " + lc(RUNNING_PROP) + ";");
      }
      L.push("");
    }

    /* pattern-specific extra fields (e.g. list collection + counter) */
    if (info.extraFields.length) {
      info.extraFields.forEach(function (l) { L.push("    " + l); });
      L.push("");
    }

    return { lines: L, needRunning: needRunning };
  }

  function lc(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  /* ===================== DispatcherTimer mechanism ===================== */

  function timerMembers(cfg, info, needRunning) {
    var L = [];
    var setRun = function (v, pad) { return needRunning ? [pad + RUNNING_PROP + " = " + v + ";"] : []; };

    /* field + ctor */
    L.push("    // built once; Stop() does NOT reset the value, so Start() resumes from where it paused.");
    L.push("    private readonly DispatcherTimer _timer;");
    L.push("");
    L.push("    public " + ctorName(cfg) + "()");
    L.push("    {");
    L.push("        _timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(" + cfg.intervalMs + ") }; // " + tickLabel(cfg));
    L.push("        _timer.Tick += OnTick;");
    L.push("    }");
    L.push("");
    /* the tick handler — DispatcherTimer.Tick fires ON the UI thread */
    L.push("    // DispatcherTimer.Tick fires ON the UI thread -> the property write is thread-safe for free.");
    L.push("    private void OnTick(object? sender, EventArgs e) // earns the thread-safety points");
    L.push("    {");
    indent(info.tickBody, "        ").forEach(function (l) { L.push(l); });
    L.push("    }");
    L.push("");

    emitCommands(L, cfg, needRunning, {
      startBody: function (pad) {
        var b = [];
        if (cfg.canExecute || needRunning) b.push(pad + "if (" + RUNNING_PROP + ") return;   // Start is idempotent while running");
        else b.push(pad + "if (_timer.IsEnabled) return;   // Start is idempotent while running");
        b.push(pad + "_timer.Start();                 // begin / resume from the preserved value");
        setRun("true", pad).forEach(function (l) { b.push(l); });
        return b;
      },
      stopBody: function (pad) {
        var b = [pad + "_timer.Stop();                  // pause: keep the current value"];
        setRun("false", pad).forEach(function (l) { b.push(l); });
        return b;
      },
      resetBody: function (pad) {
        var b = [];
        if (cfg.resetStops) {
          b.push(pad + "_timer.Stop();");
          setRun("false", pad).forEach(function (l) { b.push(l); });
        }
        b.push(pad + info.zeroExpr + "                       // reset: back to zero");
        (info.resetExtra || []).forEach(function (l) {
          if (l !== info.zeroExpr) b.push(pad + l);
        });
        return b;
      },
      isRunningExpr: needRunning ? RUNNING_PROP : "_timer.IsEnabled",
    });

    return L;
  }

  /* ===================== Task.Delay + CTS mechanism ===================== */

  function taskMembers(cfg, info, needRunning) {
    var L = [];
    var setRun = function (v, pad) { return needRunning ? [pad + RUNNING_PROP + " = " + v + ";"] : []; };

    L.push("    // null when paused/stopped; non-null while the loop runs. Stop() does NOT zero the");
    L.push("    // value, so Start() spins up a fresh loop that resumes from the preserved value.");
    L.push("    private CancellationTokenSource? _cts;");
    L.push("");

    emitCommands(L, cfg, needRunning, {
      startBody: function (pad) {
        var b = [pad + "if (_cts is not null) return;    // already running -> Start is idempotent"];
        b.push(pad + "_cts = new CancellationTokenSource();");
        setRun("true", pad).forEach(function (l) { b.push(l); });
        b.push(pad + "_ = RunAsync(_cts.Token);        // fire-and-forget the periodic loop");
        return b;
      },
      stopBody: function (pad) {
        var b = [pad + "_cts?.Cancel();"];
        b.push(pad + "_cts?.Dispose();");
        b.push(pad + "_cts = null;                     // pause: keep the current value");
        setRun("false", pad).forEach(function (l) { b.push(l); });
        return b;
      },
      resetBody: function (pad) {
        var b = [];
        if (cfg.resetStops) {
          b.push(pad + "_cts?.Cancel();");
          b.push(pad + "_cts?.Dispose();");
          b.push(pad + "_cts = null;");
          setRun("false", pad).forEach(function (l) { b.push(l); });
        }
        b.push(pad + info.zeroExpr + "                       // reset: back to zero");
        (info.resetExtra || []).forEach(function (l) {
          if (l !== info.zeroExpr) b.push(pad + l);
        });
        return b;
      },
      isRunningExpr: needRunning ? RUNNING_PROP : "_cts is not null",
    });

    /* the async loop itself */
    L.push("");
    L.push("    private async Task RunAsync(CancellationToken token)");
    L.push("    {");
    L.push("        try");
    L.push("        {");
    L.push("            while (!token.IsCancellationRequested)");
    L.push("            {");
    L.push("                await Task.Delay(" + cfg.intervalMs + ", token); // " + tickLabel(cfg));
    L.push("                // off the UI thread here -> marshal the update back onto it.");
    L.push("                await Dispatcher.UIThread.InvokeAsync(() => // earns the thread-safety points");
    L.push("                {");
    indent(info.tickBody, "                    ").forEach(function (l) { L.push(l); });
    L.push("                });");
    L.push("            }");
    L.push("        }");
    L.push("        catch (OperationCanceledException) { /* expected when Stop/Reset cancels the token */ }");
    L.push("    }");

    return L;
  }

  /* ===================== command emitter (shared by both mechanisms) ===================== */

  /* Emits Start/Stop/Reset (and/or Toggle) RelayCommands with the supplied
     bodies. Honours CanExecute wiring + the toggle single-button variant. */
  function emitCommands(L, cfg, needRunning, bodies) {
    var c = cfg.commands;
    var pad = "        ";

    if (c.toggle) {
      /* single-button variant: Toggle starts if stopped, stops if running */
      L.push(relayAttr(cfg, null));
      L.push("    private void Toggle()");
      L.push("    {");
      L.push("        if (" + bodies.isRunningExpr + ")");
      L.push("            Stop();");
      L.push("        else");
      L.push("            Start();");
      L.push("    }");
      L.push("");
    }

    if (c.start) {
      L.push(relayAttr(cfg, "CanStart"));
      L.push("    private void Start()");
      L.push("    {");
      bodies.startBody(pad).forEach(function (l) { L.push(l); });
      L.push("    }");
      L.push("");
    }

    if (c.stop) {
      L.push(relayAttr(cfg, "CanStop"));
      L.push("    private void Stop()");
      L.push("    {");
      bodies.stopBody(pad).forEach(function (l) { L.push(l); });
      L.push("    }");
      L.push("");
    }

    if (c.reset) {
      L.push("    [RelayCommand]");
      L.push("    private void Reset()");
      L.push("    {");
      bodies.resetBody(pad).forEach(function (l) { L.push(l); });
      L.push("    }");
      L.push("");
    }

    /* CanExecute guard methods, when wired */
    if (cfg.canExecute) {
      if (c.start) {
        L.push("    // Start is allowed only while the worker is NOT running.");
        L.push("    private bool CanStart() => !" + RUNNING_PROP + ";");
        L.push("");
      }
      if (c.stop) {
        L.push("    // Stop is allowed only while the worker IS running.");
        L.push("    private bool CanStop() => " + RUNNING_PROP + ";");
        L.push("");
      }
    }
  }

  /* a [RelayCommand] attribute line, with CanExecute when the config asks
     for it AND a guard name was supplied. */
  function relayAttr(cfg, canExecuteName) {
    if (cfg.canExecute && canExecuteName) {
      return "    [RelayCommand(CanExecute = nameof(" + canExecuteName + "))]";
    }
    return "    [RelayCommand]";
  }

  function tickLabel(cfg) {
    return (cfg.step === 1 ? "+1" : "+" + cfg.step) + " every " + cfg.intervalMs + "ms";
  }

  /* the ctor must be named after the TYPE, which is always MainWindowViewModel
     (the exam's project type; do NOT rename it). */
  function ctorName(cfg) { return "MainWindowViewModel"; }

  /* ===================== ViewModel assembly ===================== */

  function generateViewModel(cfg) {
    cfg = normalize(cfg);
    var info = patternInfo(cfg);
    var usings = buildUsings(cfg, info);
    var fieldBlock = buildFields(cfg, info);

    var L = [];
    L.push("// ViewModels/MainWindowViewModel.cs  (generated by Async Composer)");
    L.push("// Submit under the name your profile requires (e.g. Problem_3_MainWindowViewModel.cs)");
    L.push("// but keep the TYPE name MainWindowViewModel — App.axaml.cs + the AXAML reference it.");
    usings.forEach(function (u) { L.push(u); });
    L.push("");
    L.push("namespace " + cfg.namespace + ";");
    L.push("");
    L.push(info.comment);
    L.push("public partial class MainWindowViewModel : " + cfg.baseType);
    L.push("{");

    /* fields */
    fieldBlock.lines.forEach(function (l) { L.push(l); });

    /* mechanism-specific region(s) */
    if (cfg.mechanism === "both") {
      L.push("    // ===== PRIMARY: DispatcherTimer (Tick is already on the UI thread) =====");
      timerMembers(cfg, info, fieldBlock.needRunning).forEach(function (l) { L.push(l); });
      L.push("");
      L.push("    // ===== ALTERNATE: Task.Delay + CancellationTokenSource =====");
      L.push("    // Identical behaviour via an async loop. Use this region INSTEAD of the");
      L.push("    // DispatcherTimer one (not alongside) when the exam explicitly demands");
      L.push("    // Task-based / cancellable async code. Remember the Dispatcher.UIThread marshal.");
      altRegionComment(cfg, info, fieldBlock.needRunning).forEach(function (l) { L.push(l); });
    } else if (cfg.mechanism === "task") {
      taskMembers(cfg, info, fieldBlock.needRunning).forEach(function (l) { L.push(l); });
    } else {
      timerMembers(cfg, info, fieldBlock.needRunning).forEach(function (l) { L.push(l); });
    }

    /* trim trailing blank lines inside the class body */
    while (L.length && L[L.length - 1] === "") L.pop();
    L.push("}");
    L.push("");

    return { fileName: "MainWindowViewModel.cs", lang: "csharp", code: L.join("\n") };
  }

  /* the alternate Task region rendered as // line comments (so "both" stays a
     single compilable file: primary live, alternate documented). Line comments
     are used deliberately instead of a block comment: the task body contains
     inline block comments, and C# forbids nested block comments (a wrapping
     block would close early). Prefixing each line with // sidesteps that. */
  function altRegionComment(cfg, info, needRunning) {
    var taskCfg = Object.assign({}, cfg, { mechanism: "task" });
    var lines = taskMembers(taskCfg, info, needRunning);
    var out = [];
    out.push("    //");
    out.push("    // extra usings for this variant:");
    out.push("    //   using System.Threading; using System.Threading.Tasks; using Avalonia.Threading;");
    out.push("    //");
    lines.forEach(function (l) {
      /* neutralise any inline block-comment markers so the commented-out code
         reads cleanly and never confuses an editor's comment folding. */
      var safe = l.replace(/\/\*/g, "(*").replace(/\*\//g, "*)");
      out.push(safe === "" ? "    //" : "    // " + safe.replace(/^    /, ""));
    });
    return out;
  }

  /* the pause/stop button line. Its Content is cfg.pauseLabel (default "Stop"),
     but the bound command stays StopCommand. The trailing pad aligns the Command=
     keyword with the Start button above it; with the default "Stop" label this
     reproduces the historic two-space form byte-for-byte. Longer labels keep a
     single separating space. */
  function stopButton(cfg) {
    var label = cfg.pauseLabel || "Stop";
    /* align to the "Start" button: Content="Start" is 5 chars + one space. */
    var pad = (5 - label.length) + 1;
    if (pad < 1) pad = 1;
    return '<Button Content="' + label + '"' + repeat(" ", pad) + 'Command="{Binding StopCommand}"/>';
  }

  function repeat(s, n) {
    var out = "";
    for (var i = 0; i < n; i++) out += s;
    return out;
  }

  /* ===================== AXAML snippet ===================== */

  function generateAxaml(cfg) {
    cfg = normalize(cfg);
    var info = patternInfo(cfg);
    var c = cfg.commands;

    var X = [];
    X.push("<!-- Views/MainWindow.axaml  (matching snippet — drop inside your root panel) -->");
    X.push('<StackPanel Margin="20" Spacing="12">');

    /* the bound value display */
    if (info.name === "list") {
      X.push('    <ListBox ItemsSource="{Binding Items}" Height="180"/>');
    } else if (info.name === "progress") {
      X.push('    <ProgressBar Minimum="0" Maximum="100" Value="{Binding Progress}"/>');
      X.push('    <TextBlock Text="{Binding Progress, StringFormat=Progress: {0}%}"');
      X.push('               FontSize="20" HorizontalAlignment="Center"/>');
    } else {
      X.push('    <TextBlock Text="{Binding Count}" FontSize="48"');
      X.push('               HorizontalAlignment="Center"/>');
    }

    /* the command buttons. Toggle is the single-button variant: when it is on
       it REPLACES the separate Start/Stop buttons (even though the VM still emits
       the underlying Start()/Stop() methods for Toggle to delegate to). */
    X.push('    <StackPanel Orientation="Horizontal" Spacing="8" HorizontalAlignment="Center">');
    if (c.toggle) {
      X.push('        <Button Content="Start / Stop" Command="{Binding ToggleCommand}"/>');
    } else {
      if (c.start) X.push('        <Button Content="Start" Command="{Binding StartCommand}"/>');
      if (c.stop)  X.push('        ' + stopButton(cfg));
    }
    if (c.reset) X.push('        <Button Content="Reset" Command="{Binding ResetCommand}"/>');
    X.push('    </StackPanel>');
    X.push('</StackPanel>');

    return { fileName: "MainWindow.axaml", lang: "xml", code: X.join("\n") + "\n" };
  }

  /* ===================== exam submission pair (spec 16) ===================== */

  /* The professor's final deliverable is a flat 6-file folder; Problem 3 owns
     Problem_3_MainWindowViewModel.cs + Problem_3_MainWindow.axaml. Both files must
     drop straight into a standard Avalonia project and build, so they use the Exam
     Starter Kit namespaces (ExamApp / ExamApp.ViewModels / ExamApp.Views) exactly
     like the model solutions, and the AXAML is a COMPLETE Window (not the in-app
     drop-inside-a-panel snippet). The VM is generated with its namespace pinned to
     ExamApp.ViewModels and the in-app file-name banner swapped for the submission
     name. No PROJZIP dependency: these are plain string builds (shared rule 5). */

  var SUBMISSION_NS_ROOT = "ExamApp";
  var SUBMISSION_VM_NS = "ExamApp.ViewModels";
  var SUBMISSION_VM_FILE = "Problem_3_MainWindowViewModel.cs";
  var SUBMISSION_AXAML_FILE = "Problem_3_MainWindow.axaml";

  /* the submission VM: same body as generateViewModel but namespace pinned to the
     Starter Kit's ExamApp.ViewModels and the header re-worded for the flat submit. */
  function submissionViewModel(cfg) {
    cfg = normalize(cfg);
    var pinned = normalize(Object.assign({}, cfg, { namespace: SUBMISSION_VM_NS }));
    var vm = generateViewModel(pinned);
    var lines = vm.code.split("\n");
    /* replace the in-app "ViewModels/MainWindowViewModel.cs (generated...)" banner
       with a submission-accurate one; the TYPE name stays MainWindowViewModel so the
       AXAML x:Class pair + a standard App.axaml.cs can resolve it. */
    var header = [
      "// " + SUBMISSION_VM_FILE + "  (Problem 3 submission file — flat folder, no subfolders)",
      "// The TYPE stays MainWindowViewModel so Problem_3_MainWindow.axaml (x:Class",
      "// ExamApp.Views.MainWindow) and a standard App.axaml.cs both resolve it.",
    ];
    var out = [];
    var swapped = false;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!swapped && l.indexOf("// ViewModels/MainWindowViewModel.cs") === 0) {
        header.forEach(function (h) { out.push(h); });
        /* skip the original 3-line banner block (this line + the two notes below it) */
        i += 2;
        swapped = true;
        continue;
      }
      out.push(l);
    }
    return { fileName: SUBMISSION_VM_FILE, lang: "csharp", code: out.join("\n") };
  }

  /* the submission AXAML: a COMPLETE MainWindow.axaml (Window root, x:Class
     ExamApp.Views.MainWindow, xmlns:vm using:ExamApp.ViewModels, Design.DataContext,
     the composer's controls inside) — same shape as the Starter Kit MainWindow and
     the projzip wrapper, but self-contained so the submission needs no PROJZIP. */
  function submissionAxaml(cfg) {
    cfg = normalize(cfg);
    var info = patternInfo(cfg);
    var c = cfg.commands;

    /* the bound value display + command buttons (same controls as the snippet) */
    var body = [];
    body.push('<StackPanel Margin="20" Spacing="12" VerticalAlignment="Center">');
    if (info.name === "list") {
      body.push('    <ListBox ItemsSource="{Binding Items}" Height="180"/>');
    } else if (info.name === "progress") {
      body.push('    <ProgressBar Minimum="0" Maximum="100" Value="{Binding Progress}"/>');
      body.push('    <TextBlock Text="{Binding Progress, StringFormat=Progress: {0}%}"');
      body.push('               FontSize="20" HorizontalAlignment="Center"/>');
    } else {
      body.push('    <TextBlock Text="{Binding Count}" FontSize="48"');
      body.push('               HorizontalAlignment="Center"/>');
    }
    body.push('    <StackPanel Orientation="Horizontal" Spacing="8" HorizontalAlignment="Center">');
    if (c.toggle) {
      body.push('        <Button Content="Start / Stop" Command="{Binding ToggleCommand}"/>');
    } else {
      if (c.start) body.push('        <Button Content="Start" Command="{Binding StartCommand}"/>');
      if (c.stop)  body.push('        ' + stopButton(cfg));
    }
    if (c.reset) body.push('        <Button Content="Reset" Command="{Binding ResetCommand}"/>');
    body.push('    </StackPanel>');
    body.push('</StackPanel>');

    /* NOTE: the file deliberately opens with the <Window> root and carries NO leading
       XML comment. A grader drops it straight in as Views/MainWindow.axaml, and the
       projzip avaloniaProject scaffold detects an already-complete Window by its root
       tag (a leading comment would defeat that and cause a double-wrap). The file name
       Problem_3_MainWindow.axaml already identifies the file; no banner is needed. */
    var X = [];
    X.push('<Window xmlns="https://github.com/avaloniaui"');
    X.push('        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"');
    X.push('        xmlns:vm="using:' + SUBMISSION_VM_NS + '"');
    X.push('        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"');
    X.push('        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"');
    X.push('        mc:Ignorable="d" d:DesignWidth="500" d:DesignHeight="400"');
    X.push('        x:Class="' + SUBMISSION_NS_ROOT + '.Views.MainWindow"');
    X.push('        x:DataType="vm:MainWindowViewModel"');
    X.push('        Title="' + SUBMISSION_NS_ROOT + '"');
    X.push('        Width="500" Height="420"');
    X.push('        WindowStartupLocation="CenterScreen">');
    X.push('');
    X.push('    <Design.DataContext>');
    X.push('        <!-- previewer only; the real DataContext is set in App.axaml.cs -->');
    X.push('        <vm:MainWindowViewModel/>');
    X.push('    </Design.DataContext>');
    X.push('');
    body.forEach(function (l) { X.push(l === "" ? "" : "    " + l); });
    X.push('</Window>');

    return { fileName: SUBMISSION_AXAML_FILE, lang: "xml", code: X.join("\n") + "\n" };
  }

  /* the Problem 3 submission pair: [VM file, AXAML file], in that order. The xUnit
     test is deliberately NOT part of the pair (it stays a copyable card only). */
  function generateSubmission(cfg) {
    return [submissionViewModel(cfg), submissionAxaml(cfg)];
  }

  /* ===================== headless xUnit test ===================== */

  /* Minimal headless test, replicating the boilerplate style from
     testlab-core.js (TestAppBuilder + [AvaloniaFact]) without importing it.
     Drives the worker for a few ticks, asserts a timing-tolerant range,
     then checks Stop preserves and Reset zeroes. */
  function generateTest(cfg) {
    cfg = normalize(cfg);
    var info = patternInfo(cfg);
    var prop = info.prop;
    var c = cfg.commands;

    /* how the test fires Start: prefer Start, else Toggle */
    var startCmd = c.start ? "StartCommand" : "ToggleCommand";
    var stopCmd = c.stop ? "StopCommand" : (c.toggle ? "ToggleCommand" : null);
    var resetCmd = c.reset ? "ResetCommand" : null;

    /* the value to read for the assert. For the list pattern, use Count of
       the collection; otherwise the scalar property. */
    var readExpr = info.name === "list" ? "vm.Items.Count" : "vm." + prop;

    var L = [];
    L.push("// MainWindowViewModelTests.cs  (headless Avalonia xUnit — generated by Async Composer)");
    L.push("using System.Threading.Tasks;");
    L.push("using Avalonia;");
    L.push("using Avalonia.Headless;");
    L.push("using Avalonia.Headless.XUnit;");
    L.push("using " + cfg.namespace + ";");
    L.push("using Xunit;");
    L.push("");
    L.push("// one assembly-level attribute registers the headless app for [AvaloniaFact].");
    L.push("[assembly: AvaloniaTestApplication(typeof(MainWindowViewModelTests))]");
    L.push("");
    L.push("public class MainWindowViewModelTests");
    L.push("{");
    L.push("    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<Application>()");
    L.push("        .UseHeadless(new AvaloniaHeadlessPlatformOptions());");
    L.push("");
    L.push("    [AvaloniaFact]");
    L.push("    public async Task Start_IncrementsOverTime_ThenStopPreservesAndResetZeroes()");
    L.push("    {");
    L.push("        // Arrange");
    L.push("        var vm = new MainWindowViewModel();");
    L.push("");
    L.push("        // Act: run for a few ticks (advances ~once per " + cfg.intervalMs + "ms)");
    L.push("        vm." + startCmd + ".Execute(null);");
    L.push("        await Task.Delay(" + (cfg.intervalMs * 3 + cfg.intervalMs / 2 | 0) + ");");
    if (stopCmd) {
      L.push("        vm." + stopCmd + ".Execute(null);");
    }
    L.push("");
    L.push("        // Assert: never assert an exact tick count — timing jitter makes that flaky.");
    L.push("        Assert.InRange(" + readExpr + ", 2, 5);");
    if (stopCmd) {
      L.push("        var afterStop = " + readExpr + ";");
      L.push("        await Task.Delay(" + (cfg.intervalMs * 2) + ");");
      L.push("        Assert.Equal(afterStop, " + readExpr + "); // Stop preserves the value");
    }
    if (resetCmd) {
      L.push("");
      L.push("        // Reset returns to zero");
      L.push("        vm." + resetCmd + ".Execute(null);");
      if (info.name === "list") {
        L.push("        Assert.Empty(vm.Items);");
      } else {
        L.push("        Assert.Equal(0, vm." + prop + ");");
      }
    }
    L.push("    }");
    L.push("}");
    L.push("");

    return { fileName: "MainWindowViewModelTests.cs", lang: "csharp", code: L.join("\n") };
  }

  /* ===================== top-level generate ===================== */

  /* returns an array of {fileName, lang, code}: ViewModel always; AXAML and
     test file when the config flags ask for them. */
  function generate(cfg) {
    cfg = normalize(cfg);
    var out = [generateViewModel(cfg)];
    if (cfg.emitAxaml) out.push(generateAxaml(cfg));
    if (cfg.emitTest) out.push(generateTest(cfg));
    return out;
  }

  /* "which mechanism when" note, surfaced by the UI as a card */
  function mechanismNote() {
    return [
      "DispatcherTimer — the default and simplest. Its Tick fires ON the UI",
      "(dispatcher) thread, so writing a bound property inside it is automatically",
      "thread-safe: no Dispatcher.UIThread.Post, no locks. Reach for this unless the",
      "task asks for something else.",
      "",
      "Task.Delay + CancellationTokenSource — use when the exam explicitly demands",
      "Task-based or cancellable async code. The loop runs OFF the UI thread, so every",
      "bound-property update must be marshalled back with Dispatcher.UIThread.InvokeAsync",
      "(or .Post). Catch ONLY OperationCanceledException — never a catch-all.",
      "",
      "Both score the thread-safety points as long as the UI-thread rule is respected.",
    ];
  }

  /* ===================== export ===================== */

  var CORE = {
    PATTERNS: PATTERNS,
    MECHANISMS: MECHANISMS,
    defaultConfig: defaultConfig,
    normalize: normalize,
    generate: generate,
    generateViewModel: generateViewModel,
    generateAxaml: generateAxaml,
    generateTest: generateTest,
    generateSubmission: generateSubmission,
    submissionViewModel: submissionViewModel,
    submissionAxaml: submissionAxaml,
    mechanismNote: mechanismNote,
    SUBMISSION_VM_FILE: SUBMISSION_VM_FILE,
    SUBMISSION_AXAML_FILE: SUBMISSION_AXAML_FILE,
  };

  global.ASYNCLAB_CORE = CORE;
  if (typeof module !== "undefined" && module.exports) module.exports = CORE;
})(typeof window !== "undefined" ? window : globalThis);
