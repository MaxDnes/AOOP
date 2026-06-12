# Spec 04: Compile-tested model solutions for both 2025 exams + exam-day scripts

Read docs/specs/00-master-plan.md first. Three agents share this spec; each reads
only its own section's ownership. NEVER modify the original starter folders
("...\Advanced Object-Oriented Programming, (F26)\AOP_2025_Exam_One" and
"...\AOP_2025_ReExam"); they stay pristine for timed dry runs.

Common rules for 4a/4b:
- Copy the starter (excluding bin/obj/.vs) into your target folder first.
- Read the exam PDF for your exam fully (Read tool handles PDFs).
- Solve every problem EXACTLY per the problem statement, respecting "no code-behind
  edits" for UI problems and the allowed-libraries rule (System, Avalonia,
  CommunityToolkit.Mvvm only).
- Everything must build (`dotnet build`) and run; tests must pass (`dotnet test`).
  Console problems must produce their output files; inspect the output yourself.
- Code style: clear, exam-appropriate, comments only where a grader awards points
  for understanding (e.g. "// UI thread: required for ObservableCollection update").
- Then write your data/solutions-*.js: window.TOPICS.push(...) entries (cat:
  "Model Solutions", follow the exact topic shape used in data/exams.js; read it
  first). One topic per problem: the FULL final code in code blocks, annotated with
  point values per rubric, key idioms called out, and a short "how to adapt if F26
  changes the domain" note. Also one topic for Problem 1: a complete model written
  answer (rubric-shaped). The integration agent adds your file to index.html later;
  data file must be Node-parseable (node --check) and follow the existing
  window.TOPICS pattern guarded for Node like other data files (check how
  data/exams.js guards; replicate).

## 4a Summer 2025 (owner: "C:\Users\Max\Desktop\AOP Model Solutions\Summer2025\**"
and data/solutions-summer.js)
PDF: "...\Advanced Object-Oriented Programming, (F26)\SummerExamAOP_2025.pdf".
Starter: AOP_2025_Exam_One. Solve:
- P2 RectangleUI: typed rect model (X/Y/Width/Height/Brush), ObservableCollection,
  Add command with Random + bounds clamping (max = canvas size - rect size), sliders
  bound two-way, the ItemsControl + Canvas ItemsPanelTemplate + ContentPresenter
  style with Canvas.Left/Top bindings, and the 2-second recolor/reposition timer on
  the UI thread (DispatcherTimer).
- P3 tests: the required plain xUnit tests + the headless test per the PDF (create
  the test project the offline way; versions matching the Starter Kit).
- P4 spaceships console: all queries from the PDF (trips sorted desc, average trip
  count by ship type, departed Ganymede in 2245, etc.) + the binary search for
  'Rocinante' (sort by Name first, null-safe comparer) + JSON output exactly as
  specified. Handle the planted missing fields (nullable/defaulted model props).
- P1: write the model written answer as a topic (read the starter's Problem 1 code
  yourself; cover presence AND violations honestly per what is in the code).

## 4b ReExam 2025 (owner: "C:\Users\Max\Desktop\AOP Model Solutions\ReExam2025\**"
and data/solutions-reexam.js)
PDF: "...\Advanced Object-Oriented Programming, (F26)\ReExamAOP_2025.pdf".
Starter: AOP_2025_ReExam. Solve:
- P2 FamilyMealPlannerUI: only MainWindowViewModel.cs + MainWindow.axaml editable.
  Layout per sketch (left ListBox meal plan, right ListBox shopping list, Generate
  button), startup population via injected MealPlanner, CreateWeeklyPlan regenerates
  both, and 2.3: selecting a meal multi-select-highlights its ingredients in the
  right ListBox via the OnSelectedRecipeChanged partial (SelectionMode=Multiple,
  drive SelectedItems).
- P3 async counter: implement Start/Stop/Reset; +1 per 100ms, stop preserves value
  and resume continues, reset zeroes, UI-thread safe. Ship BOTH variants: the
  DispatcherTimer one (primary, in the solution project) and a Task.Delay +
  CancellationTokenSource alternative (as a fully-written alternate file in the
  topic and a commented region or sibling file in the project).
- P4 recipes console: the 4 queries (vegetarian; empty DietaryTags; sorted by
  ingredient count desc; more ingredients than average) and ONE output JSON with
  exact keys vegetarianRecipes, noDietaryRestrictions, sortedByIngredientCount,
  aboveAverageIngredients.
- P1: model written answer topic per the 5x(1+2+2) rubric, covering the planted
  `as InMemoryRecipeRepository` downcast and the never-used _rules list, plus the
  honestly-present principles (SRP split, ISP small interfaces, partial DIP, OCP
  intent via IDietaryRule strategies).

## 4c Scripts + runbook (owner: "C:\Users\Max\Desktop\AOP Exam Companion\scripts\**"
and "C:\Users\Max\Desktop\AOP Exam Companion\README-EXAM-DAY.md")
PowerShell 7, every script tested by actually running it here:
1. make-offline-feed.ps1: copy the .nupkg files for xunit, xunit.runner.visualstudio,
   Microsoft.NET.Test.Sdk, Avalonia.Headless.XUnit, Avalonia (+ transitive deps
   present locally), CommunityToolkit.Mvvm from $env:USERPROFILE\.nuget\packages
   into scripts\offline-feed\, and write a nuget.offline.config pointing at it.
   Run it; report the package count.
2. verify-exam-env.ps1: checks dotnet SDK exists, required packages in the cache,
   then a REAL offline dry run: create a temp xunit project in $env:TEMP, pin the
   known versions, `dotnet restore --source <offline-feed>`, `dotnet test`; print
   PASS/FAIL per step with colors. Run it; it must PASS on this machine.
3. verify-submission.ps1 -Folder <path> -Variant summer|reexam|custom: verifies the
   exact required filenames exist (summer + reexam profiles built in; the ReExam
   set: Problem_1_Submission.txt, Problem_2_MainWindowViewModel.cs,
   Problem_2_MainWindow.axaml, Problem_3_MainWindowViewModel.cs,
   Problem_4_Program.cs, Problem_4_Query_Results.json; pull the summer list from
   the Summer PDF), nothing extra, no bin/obj/subfolders, files non-empty; then
   offers -Zip to produce the submission zip. Test with a synthetic folder both
   passing and failing.
4. README-EXAM-DAY.md: the minute-zero runbook: run verify-exam-env, open the
   companion app + Model Solutions, per-problem time budget, the ReExam PDF/starter
   filename-mismatch warning (AutoCounterViewModel.cs vs
   Problem_3_MainWindowViewModel.cs), submission checklist via verify-submission,
   and a pointer to copy the whole Desktop aid set onto the exam machine.

## Definition of done
4a/4b: dotnet build green, dotnet test green, console outputs verified, solutions-*.js
parses (node --check) and follows the TOPICS shape; original starters untouched.
4c: all three scripts executed successfully on this machine (verify-exam-env must
PASS end-to-end offline-style), README written.

## Return (final message, raw JSON)
{"done": bool, "problems_solved": [..], "build": "ok|errors", "tests": "X passed",
 "outputs_verified": [..], "topics_written": [..], "manual_checks": [..],
 "skipped": [..], "notes": ".."}
