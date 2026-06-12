AOP EXAM COMPANION  (Avalonia · SOLID · Testing · F26)
======================================================

How to run: double-click index.html. It opens in any browser, 100% offline -
no server, no internet, no install, no AI. Everything is plain HTML/CSS/JS.


THE NINE TOOLS  (top of the sidebar, "Exam Day" group; also on the home screen)
-------------------------------------------------------------------------------

EXAM GUIDE      The 4-hour plan, tool by tool. The orientation tab: it maps each
                exam problem to the tool that solves it (P1 -> Analysis Lab, P2 ->
                Visual Designer, P3 -> Async Composer with Test Lab as the
                self-check, P4 -> Query Lab), with the minute-zero env check, how
                to spot the exam family, a per-problem click path and time budget,
                and the flat 6-file submission ritual. Clickable cards jump
                straight into each tool. Start here on exam day.

CODE LAB        The 9 exam-critical files, annotated LINE BY LINE. Open one,
                then click any marked line - or press j / k - and the side panel
                explains exactly that line. Left / Right arrows jump between the
                nine files.

UI BUILDER      Tick the features your task needs (list, add button, selection,
                slider, canvas shapes, 2-second recolor timer, async counter,
                JSON load, status bar) and a complete, coherent ViewModel + AXAML
                is generated live - dependencies select themselves, copy buttons
                ready. One-click presets: ContactList-style, RectangleUI,
                MealPlanner-style, Async worker.

VISUAL DESIGNER Build the window VISUALLY: drag containers, controls and shapes
                onto the canvas, drag to move and resize, drop colors from the
                swatch tray, set bindings in the inspector. Pixel-accurate Canvas
                placement, Shift for an 8px grid. Add LOGIC RECIPES (a 2-second
                recolor timer, random-rectangle generator, add/remove, selection
                highlight) and they flow straight into the generated ViewModel.
                Drop in a REFERENCE IMAGE to trace an exam screenshot behind the
                canvas. It generates the matching MainWindow.axaml + ViewModel,
                ready to copy. Save named designs; the Export button downloads
                them as JSON to carry between machines. The green "Export project
                (.zip)" button downloads a COMPLETE runnable Avalonia project
                (csproj with the exact 11.2.1 + Mvvm 8.2.1 versions, Program.cs,
                App.axaml, Views, ViewModels, Models) - unzip, dotnet build,
                dotnet run, no assembling. Both exam presets export green.

ANALYSIS LAB    Paste the Problem 1 console project. It scans for OOP/SOLID
                violations (downcasts, new-in-constructor, NotImplemented stubs,
                type-check chains, public fields, console-in-domain, fat
                interfaces, unused injected dependencies...), shows each finding
                with the code location and the principle, lets you tick the ones
                you'll use, and assembles a full written-answer DRAFT - presence,
                where/how with a code example, and the general purpose - matching
                the exam rubric. Three result MODES: "full" (everything),
                "violations" (only what's broken), and "implementations" (only
                the principles already honored) so you can answer presence first.
                Attribution is calibrated to how graders mark: a downcast of an
                injected abstraction (like "_gateway as StripeGateway") leads with
                DIP, not LSP; when a class injects abstractions but then breaks
                that inside a method, the presence note carries a caveat instead of
                falsely claiming it is clean; an unguarded "as" cast that is then
                used flags the latent NullReferenceException; and the fix text is
                context-matched (it only says "split the fat interface" when the
                interface really has 3+ members, and never mentions a null-check
                branch that is not in the code). A fourth "June rubric" mode lays
                the draft out as the June paper's 1.1 to 1.5 sections (general
                analysis, interfaces, four OOP pillars, two SOLID principles, one
                design pattern) and adds a "Copy as Problem_1_Submission.txt" button,
                and the scan now also detects Singleton and Command patterns.
                "Download project (.zip)" packages the pasted P1 code as a runnable
                net9.0 console project.

TEST LAB        Paste the Problem 3 class or ViewModel, choose the test kinds,
                and generate ready-to-paste xUnit files: plain unit tests,
                ViewModel command tests, a headless Avalonia scaffold
                (AvaloniaTestApplication + [AvaloniaFact]), timing-tolerant async
                patterns, plus the EXACT-version .csproj and an offline runbook.
                For each public method it proposes a Positive / Negative / Edge
                (P/N/E) trio so you cover the happy path, the guard, and the
                boundary. Real asserts are filled in where derivable; everything
                else is a clearly marked TODO. Multiple files via tabs; "copy all"
                bundles them. The green "Export project (.zip)" button downloads a
                STANDALONE xUnit project: your pasted code under Source/, the
                generated tests under Tests/, the exact-version .csproj (and the
                headless TestAppBuilder when you pick the headless mode) - unzip
                and dotnet test, no project reference to wire up.

QUERY LAB       Paste the Problem 4 JSON and it infers the C# model (missing /
                null fields become nullable automatically - the exam trap). Click
                to build LINQ queries - equals / contains filters, empty-collection
                checks, nested Any, sort, group + aggregate, above-average, top N,
                select fields, binary search - reorder them, and copy ONE complete
                Program.cs: null-safe deserialize, every query in order, console
                printing, and a results JSON with the EXACT key names. If the exam
                ships a CSV file instead of JSON, paste it anyway and Query Lab
                auto-detects it, shows a "CSV mode" badge, and generates a System-only
                ParseCsv helper (File.ReadAllLines plus a quote-aware split, no
                CSVHelper) feeding the same query pipeline. Load a 2025
                preset (Summer spaceships, ReExam recipes) for the full solution.
                The green "Export project (.zip)" button downloads a runnable
                net9.0 console project: the generated Program.cs plus your pasted
                JSON saved as the data file the code reads (CopyToOutputDirectory),
                so unzip and dotnet run prints the results straight away.

ASYNC COMPOSER  Configure the Problem 3 async worker - pattern (counter / progress
                / list), mechanism (DispatcherTimer or Task.Delay + CTS), interval,
                step, and which commands (Start / Stop / Reset / Toggle) - and get
                the complete MainWindowViewModel with no coding: guarded Start,
                value-preserving Stop, resume-after-stop, Reset, and all UI updates
                on the UI thread. Optionally emit the matching AXAML and a headless
                xUnit test. Defaults are the verified Re-exam counter (+1 / 100ms).
                The green "Export project (.zip)" button wraps the generated VM and
                its AXAML in the scaffold's MainWindow and downloads a complete
                runnable Avalonia project - unzip, dotnet build, dotnet run.

QUIZ            100+ hand-written questions across every exam topic. Modes: all
                shuffled, weak-topics-first, a 10-question sprint, a weak sprint,
                "drill my wrongs", and a full exam simulation. It tracks what you
                miss; the Export stats button saves your progress as JSON.


CONTENT  (the searchable curriculum, in the sidebar categories)
---------------------------------------------------------------

145 topics across 17 categories, built from all 12 lectures, the course example
projects, and both 2025 exams (June + August) with complete worked solutions.

"3-Day Bootcamp" (top of the sidebar) is the guided study plan: per day a lesson
dissection, an exam task broken down decision by decision, and practice tasks
with checkboxes (progress saves automatically) and click-to-reveal solutions.

"Exam Playbooks" - one step-by-step recipe per exam problem type. Start here.

"Model Solutions" (right under the Playbooks) - the COMPILE-TESTED full solutions
for both 2025 exams, one topic per problem: written Problem 1 analyses, complete
Problem 2 ViewModels + AXAML, Problem 3 tests / async counter, and Problem 4
JSON-deserialize + LINQ + serialize programs, with verified output.

"Design Gallery" shows VISUAL previews of every control, shape, color, tab and
layout next to the exact AXAML that produces it - including ready page skeletons
and a complete bundle window you can paste and adapt.

Plus the reference categories: OOP Fundamentals, C# Language, SOLID, Design
Patterns, Avalonia UI, MVVM & Binding, Collections & Generics, LINQ, Data &
Files, Threading & Async, Unit Testing, Algorithms & Big-O, and the Past Exams.


KEYBOARD
--------
  /  or Ctrl+K   focus search
  Enter          open top search result (Up/Down arrows pick another)
  Esc            clear search / back to current topic
  H              home
  Left / Right   prev / next topic within a category;
                 prev / next FILE inside the Code Lab
  j / k          next / previous note inside a Code Lab file
  Star button    pin a topic (pinned topics appear on the home screen)

  In the Visual Designer:
  Ctrl+Z         undo            Ctrl+Shift+Z or Ctrl+Y   redo
  Ctrl+D         duplicate       Delete                   remove selected
  Shift (drag)   snap moves to an 8px grid

  In the Quiz:
  1 - 9          pick that answer        s        reveal a short-answer model
  Enter          grade / next question


ONE-CLICK RUNNABLE PROJECTS  ("Export project (.zip)")
------------------------------------------------------
Every solver tool that generates code now has a green "Export project (.zip)"
button (with a project-name box) next to its copy buttons. Instead of copying
single files and assembling a project by hand, one click downloads a COMPLETE,
runnable .NET project: the right .csproj with the exact exam package versions
(Avalonia 11.2.1, CommunityToolkit.Mvvm 8.2.1, the xUnit + headless stack, or a
plain net9.0 console), all the source files in the right folders, and any data
file the code reads. Unzip it, then dotnet build / dotnet run / dotnet test - no
wiring. The buttons only appear when everything is loaded; if anything is
missing they hide instead of erroring, so the tools never crash.
  - Visual Designer -> a full Avalonia app from your current design (both exam
                       presets export to projects that build green)
  - Analysis Lab    -> a net9.0 console project from the pasted Problem 1 code. Its
                       button is labelled "Download project (.zip)" (plain style,
                       not the green "Export project (.zip)" of the other tools)
  - Test Lab        -> a standalone xUnit project (Source/ + Tests/, headless when
                       you pick it; no project reference needed)
  - Query Lab       -> a net9.0 console project (Program.cs + your pasted JSON)
  - Async Composer  -> a full Avalonia app from the generated counter VM + AXAML

Reliability + polish pass: the solver tools were hardened so you can lean on them
under exam pressure - consistent headers and copy buttons with "copied" feedback,
a styled red error panel (never a blank pane or a thrown error) when you paste
garbage, front-and-center load-example / preset buttons, version-stamped saved
state, and no layout breakage from 1280px to 1920px.


SUBMITTING  (the flat 6-file deliverable - "Download submission files")
-----------------------------------------------------------------------
The thing you actually HAND IN is not a project and not a zip. It is one flat
folder with exactly six files and these exact names, nothing else (no bin/, no
obj/, no subfolders):

    /AOP_Exam_Submission/
      Problem_2_MainWindowViewModel.cs
      Problem_2_MainWindow.axaml
      Problem_3_MainWindowViewModel.cs
      Problem_3_MainWindow.axaml
      Problem_4_Program.cs
      Problem_4_Models.cs

Allowed libraries for every file: System, Avalonia, CommunityToolkit.Mvvm only.
Problem 1 (the SOLID write-up) has no file here; it goes through the channel the
exam paper names (the Analysis Lab draft is copy-paste for that).

Next to each solver tool's green "Export project (.zip)" button there is now a
primary "Download submission files" button. One click downloads that tool's part
of the set with the professor's exact names - plain file downloads, no zip, works
on file://. Which button makes which file:
  - Visual Designer (Problem 2) -> Problem_2_MainWindow.axaml +
                                   Problem_2_MainWindowViewModel.cs (model class
                                   inlined into the VM file - the flat set allows
                                   no third file)
  - Async Composer  (Problem 3) -> Problem_3_MainWindowViewModel.cs +
                                   Problem_3_MainWindow.axaml (a complete Window)
  - Query Lab       (Problem 4) -> Problem_4_Program.cs + Problem_4_Models.cs
                                   (two flat files, one shared namespace)

The pairs use the Starter Kit namespaces (ExamApp, ExamApp.ViewModels,
ExamApp.Views) and stay internally consistent, so a grader can drop a pair into a
plain Avalonia project and build. The hint under each button says it: submit flat,
6 files, no bin/obj, no subfolders. Use the .zip export to prove your code builds;
use the submission button for what you turn in. Full runbook: README-EXAM-DAY.md
section 4, and verify the assembled folder with scripts\verify-submission.ps1.


SAVING & MOVING TO THE EXAM MACHINE
-----------------------------------
Everything you do is saved in the browser's localStorage and SURVIVES a browser
restart: pinned topics, recents, bootcamp checkboxes, quiz stats, builder/designer
selections, saved designs, and pasted Analysis/Test Lab code. State is per-browser
and per-machine, so to carry work to another computer use the in-app exports:
  - Visual Designer -> Export  (downloads your saved designs as JSON)
  - Quiz            -> Export stats  (downloads your progress as JSON)
Copy the whole "AOP Exam Companion" folder to the exam machine and they ride along.


EXAM-DAY SCRIPTS  (folder: scripts\,  guide: README-EXAM-DAY.md)
----------------------------------------------------------------
README-EXAM-DAY.md is the minute-zero runbook: what to copy, how to verify the
machine, and how to check your submission before you hand it in. The scripts\
folder backs it up:
  verify-exam-env.ps1     proves .NET 9 + offline restore + a headless xUnit
                          test all work with the network OFF.
  make-offline-feed.ps1   builds a local NuGet feed (offline-feed\) so restore
                          works on a lab machine with no package cache.
  nuget.offline.config    points NuGet at that local feed.
  verify-submission.ps1   checks your submission against the exam's manifest
                          (right files, non-empty, builds).

Tip: also keep these Desktop folders on the machine (all offline):
  AOP Model Solutions\    the compile-tested full solutions for both 2025 exams
  AOP_extracted\          every course example project as runnable code
  AOP Exam Starter Kit\   a clean Avalonia + xUnit + console starter to copy from
