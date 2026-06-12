# Spec 16: Exam submission export (flat 6-file format from the professor)

Read docs/specs/00-master-plan.md first. v5 (specs 13-15) is merged before you
run: every tool has a project .zip export backed by data/projzip-core.js, the
polish pass is applied, the analyzer attribution fixes are in. NEVER regress
those; extend.

## Why this spec exists (professor's info, received 2026-06-12, authoritative)

The final submission is NOT a project and NOT a zip. It is a single flat
folder with exactly 6 files and these exact names:

    /AOP_Exam_Submission/
    |- Problem_2_MainWindowViewModel.cs
    |- Problem_2_MainWindow.axaml
    |- Problem_3_MainWindowViewModel.cs
    |- Problem_3_MainWindow.axaml
    |- Problem_4_Program.cs
    |- Problem_4_Models.cs

No bin/, obj/, no per-problem subfolders. Allowed libraries for ALL tasks:
the .NET System library, Avalonia, CommunityToolkit.MVVM, nothing else.
Problem 1 (analysis) has no file in the list; its answer is delivered through
whatever channel the exam paper says (the Analysis Lab draft is copy-paste).

The existing project .zip export stays exactly as is (it is how Max verifies
his code builds during the exam). This spec ADDS the final-deliverable path.

## Shared rules (all tool agents)

1. Each tool below gets a "Download submission files" action beside its
   Export project button, styled as a primary action with the same look in
   every tool. One click downloads that tool's files with the EXACT names
   above (two separate downloads via blob anchor + download attribute is
   fine; must work on file://).
2. File-name prefixes are submission-only: the C# type names stay
   MainWindowViewModel / MainWindow, and each pair stays internally
   consistent (the AXAML x:Class + xmlns:vm must match the VM namespace) so
   a grader can drop the pair into a standard Avalonia project and build.
   Use the Exam Starter Kit namespaces (ExamApp, ExamApp.ViewModels,
   ExamApp.Views) like the model solutions do.
3. A short hint line under the button: "submit flat: 6 files, no bin/obj,
   no subfolders" (plain casual prose, no em dashes, no bold).
4. Generated code in these files must only use System.*, Avalonia*, and
   CommunityToolkit.Mvvm namespaces. Add a test per tool asserting the
   generated submission files contain no other using directive.
5. Keep window.PROJZIP optional like spec 13 did: the submission download
   must not depend on projzip-core being loaded (plain blobs, no zip).

## Per-tool work and ownership (same ownership lists as spec 14)

### Designer agent (Problem 2)
Owns: data/designer-core.js, data/designer.js, designer.css,
tests/designer-core.test.js, tests/designer-ui.test.js.
- Submission pair: Problem_2_MainWindow.axaml + Problem_2_MainWindowViewModel.cs.
- The submission allows NO third file, so when the design has a typed model
  class (e.g. RectItem), the submission VM file must inline the model class
  in the same file, below the ViewModel class, same namespace, with the
  usings merged (Avalonia.Media for IBrush etc.). The in-app Models pane and
  the project .zip export keep their separate-file layout; only the
  submission export inlines.
- Both 2025 presets must produce submission pairs that compile (see
  Definition of done).

### Async Composer agent (Problem 3)
Owns: data/asynclab-core.js, data/asynclab.js, asynclab.css,
tests/asynclab-core.test.js.
- Submission pair: Problem_3_MainWindowViewModel.cs + Problem_3_MainWindow.axaml.
- The current AXAML output is a snippet meant to drop inside a root panel.
  The submission file must be a COMPLETE MainWindow.axaml (Window root with
  x:Class ExamApp.Views.MainWindow, xmlns:vm, Design.DataContext, the
  composer's controls inside), same shape as the Starter Kit / model
  solutions. Reuse or mirror the wrap logic the spec 13 export already uses;
  keep the in-app snippet card unchanged.
- The generated xUnit test file is NOT part of the submission; leave it as a
  copyable card only.

### Query Lab agent (Problem 4)
Owns: data/querylab-core.js, data/querylab.js, querylab.css,
tests/querylab-core.test.js.
- Submission pair: Problem_4_Program.cs + Problem_4_Models.cs.
- Today generateProgram emits one Program.cs with the model classes inline.
  Add a two-file mode for submission: Models.cs carries the model classes
  (and the wrapper class for object-rooted JSON) and Program.cs carries
  Program + the queries, both in the SAME namespace so they compile together
  as two flat files. The single-file output and the project .zip export stay
  as they are.
- The pair must build and run against the pasted sample JSON exactly like
  the single-file version (same output keys); prove behavioral equivalence
  in tests by comparing the assembled two-file code paths.

### Integration agent (runs alone, after the tool agents)
Owns: app.js, index.html, README-EXAM-DAY.md (or the README the app links),
styles.css, tests/integration.test.js.
- README: a new short "Submitting" section with the professor's exact folder
  listing, the flat-folder rules, the allowed-libraries line, and which tool
  button produces which file. Plain casual prose.
- Any shared styles for the submission button look (without restyling
  tool-owned css).
- Extend tests/integration.test.js: each of the three tool UI files defines
  its submission download wiring (grep for the exact file names).
- Full suite green.

## Definition of done (each tool agent, enforced)
Own tests green, including the no-foreign-usings test and (querylab) the
equivalence test. Plus a REAL compile proof of YOUR submission pair on this
machine, run from Node + pwsh + dotnet in %TEMP% and cleaned up after:
- designer: for BOTH 2025 presets, write the submission pair to a scaffold
  project (reuse data/projzip-core.js avaloniaProject with the pair as the
  axaml/viewModel and NO extra model file since it is inlined), dotnet build
  green.
- asynclab: same for the default composer state.
- querylab: console scaffold with Program.cs + Models.cs as two source
  files + the sample JSON, dotnet build AND dotnet run, output keys equal to
  the single-file version's output.
Report the build outputs in your summary.

## Return (final message, raw JSON)
{"done": bool, "submission_files": ["..exact names you emit.."],
 "e2e_builds": [{"project": "..", "result": "ok|fail"}], "tests": "X passed",
 "manual_checks": [..], "skipped": [..], "notes": ".."}
