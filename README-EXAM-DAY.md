# AOP Exam Day Runbook (F26)

The minute-zero checklist. Everything here is offline. No internet, no AI, no panic.
Stack: .NET 9, Avalonia 11.2.1, CommunityToolkit.Mvvm 8.2.1, xUnit + Avalonia.Headless.XUnit.
Allowed libraries: **System, Avalonia, CommunityToolkit.Mvvm only.**

---

## 0. Before you leave home: copy the whole aid set onto the exam machine

Copy these five Desktop folders (a USB stick or the machine's local disk - NOT a cloud
drive that needs internet). They are independent and all offline:

| Folder | What it is |
| --- | --- |
| `AOP Exam Companion\` | the offline app (double-click `index.html`) + these scripts |
| `AOP Model Solutions\` | compile-tested full solutions for both 2025 exams |
| `AOP_extracted\` | every course example project as runnable code |
| `AOP Exam Starter Kit\` | a clean Avalonia + xUnit + console starter to copy from |
| `Advanced Object-Oriented Programming, (F26)\` | the original 2025 exam PDFs + starters for timed dry runs (keep PRISTINE) |

The single most important offline asset is the **NuGet package cache** at
`%USERPROFILE%\.nuget\packages`. If the exam machine is YOUR machine, it is already
there. If it is a lab machine, the offline feed below is your safety net - bring
`AOP Exam Companion\scripts\offline-feed\` too.

---

## 1. Minute zero: verify the environment (2 minutes)

Open **PowerShell 7** and run:

```powershell
& "C:\Users\Max\Desktop\AOP Exam Companion\scripts\verify-exam-env.ps1"
```

This must end with **ALL CHECKS PASSED** (green). It checks the .NET 9 SDK, the offline
feed, the package cache, and then does a REAL offline restore + `dotnet test` of a tiny
Avalonia headless xUnit project. If that passes, your whole Problem 3 toolchain works
with the network off.

If it **FAILS on the offline feed** (e.g. fresh lab machine, empty feed), rebuild it:

```powershell
& "C:\Users\Max\Desktop\AOP Exam Companion\scripts\make-offline-feed.ps1"
```

That harvests ~48 `.nupkg` files from your local NuGet cache into
`scripts\offline-feed\` and writes `scripts\nuget.offline.config`. Then re-run
`verify-exam-env.ps1`.

### Using the offline feed inside an exam project

If a `dotnet restore` ever fails with "unable to load the service index" / network
errors, force it offline by pointing at the feed:

```powershell
dotnet restore --configfile "C:\Users\Max\Desktop\AOP Exam Companion\scripts\nuget.offline.config"
```

or copy `scripts\nuget.offline.config` next to the `.sln` and rename it `nuget.config`.

---

## 2. Open your aids (1 minute)

1. Double-click `AOP Exam Companion\index.html` - the companion app (search with `/`).
   This same 4-hour plan lives in the app as the **Exam Guide** tab (top of the
   sidebar): the per-problem click paths, time budgets, and submission ritual in one place.
2. Open `AOP Model Solutions\` in your file explorer / IDE - the two worked exams:
   - `Summer2025\` = the **RectangleUI / DocumentManager / spaceships** exam.
   - `ReExam2025\` = the **FamilyMealPlanner / Counter / recipes** exam.
3. Keep `AOP Exam Starter Kit\` handy - it is the fastest way to spin up a fresh
   Avalonia app, console app, or xUnit test project with the correct package versions.
4. Even faster than the starter kit: every solver tool in the companion app (Visual
   Designer, Test Lab, Query Lab, Async Composer) now has a green "Export project
   (.zip)" button next to its copy buttons. It downloads a complete runnable project
   built from whatever the tool currently shows, with the exact allowed package
   versions baked in. Unzip, `cd` into the folder, then `dotnet build`, `dotnet run`
   or `dotnet test`. For Query Lab exports run from inside the unzipped folder so the
   data file resolves. Details per tool are in `README.txt`, section "ONE-CLICK
   RUNNABLE PROJECTS".

> The F26 exam will likely be a *variation* of one of these two. Identify which family
> it belongs to within the first 2 minutes (Canvas + rectangles + sliders -> Summer
> family; two ListBoxes + Generate + meal plan -> ReExam family), then adapt the
> matching model solution.

---

## ⚠️ KNOWN FILENAME-MISMATCH TRAP (read before Problem 3)

The **ReExam** PDF (Problem 3, Async) is internally inconsistent about the Problem 3
filename, and this WILL cost you points if you trust the wrong one:

- The **prose** in Problem 3 says to submit
  `Problem_3_Async/Counter/ViewModels/AutoCounterViewModel.cs`.
- But the PDF's **submission manifest** (front page) and the actual **starter file** on
  disk are both named `Problem_3_MainWindowViewModel.cs`.

**Rule: name your submitted Problem 3 file to match the SUBMISSION MANIFEST, i.e.**
**`Problem_3_MainWindowViewModel.cs`** (that is also what the starter ships). Do not
rename it to `AutoCounterViewModel.cs` just because the prose says so. The class inside
keeps whatever name the starter uses - only the *file you submit* must match the manifest.

If the F26 manifest differs, follow the F26 manifest verbatim and verify with
`verify-submission.ps1 -Variant custom` (see section 4).

---

## 3. Per-problem time budget (4 hours / 100 points)

Roughly one minute per point, with slack reserved for packaging. Adjust to the actual
point split printed on YOUR exam.

| Problem | Points | Budget | Notes |
| --- | --- | --- | --- |
| **P1 - OOP / SOLID written analysis** | 20-25 | **45 min** | Pure writing, no compiler. Do it FIRST while fresh OR last if you build faster than you write. For each principle: present? + where (code line) + general purpose + how it applies here. Use the model `Problem_1_Submission.txt` in the matching Model Solution as a template. |
| **P2 - Avalonia MVVM UI** | 30 | **75 min** | DO NOT touch code-behind (`*.axaml.cs`). Only the files the PDF names. Copy the structure straight from the matching model solution's ViewModel + AXAML. Watch: `ObservableCollection`, `[ObservableProperty]`, `[RelayCommand]`, Canvas `ItemsPanelTemplate`, `Canvas.Left/Top` bindings, `DispatcherTimer` on the UI thread. |
| **P3 - Unit tests OR async counter** | 15-20 | **45 min** | If tests: copy the xUnit + headless test project from the Starter Kit / model solution; run `dotnet test` early so a green bar is banked. If async counter: `DispatcherTimer` primary; `Task.Delay` + `CancellationTokenSource` alternative is in the model topic. Start/Pause(resume)/Reset, +1 per 100 ms, UI-thread updates. |
| **P4 - JSON + LINQ console** | 25-35 | **60 min** | `System.Text.Json` with nullable / defaulted model props for the planted missing fields. Run the exact queries, serialize with the EXACT key names from the PDF. Binary search (Summer): sort by Name first, null-safe comparer. INSPECT the output file yourself. |
| **Packaging + verify** | - | **15 min** | Section 4. Do not skip. |

Bank a green build/test as early as possible per problem. A compiling 80% beats a
beautiful non-compiling 100%.

---

## 4. Before you submit: verify the submission folder (5 minutes)

Assemble a **single flat folder** containing ONLY the required files - no `bin/`, no
`obj/`, no subfolders, no extras. Then let the script check it for you.

### The flat 6-file deliverable (professor's format, confirmed 2026-06-12)

The final submission is NOT a project and NOT a zip. It is one flat folder with
exactly six files and these exact names, nothing else:

```
/AOP_Exam_Submission/
|- Problem_2_MainWindowViewModel.cs
|- Problem_2_MainWindow.axaml
|- Problem_3_MainWindowViewModel.cs
|- Problem_3_MainWindow.axaml
|- Problem_4_Program.cs
|- Problem_4_Models.cs
```

No `bin/`, no `obj/`, no per-problem subfolders. Allowed libraries for every file:
the .NET System library, Avalonia, and CommunityToolkit.Mvvm, nothing else. Problem 1
(the SOLID analysis) has no file in this set; its answer goes through whatever channel
the exam paper names, and the Analysis Lab draft is copy-paste for that.

Each solver tool in the companion now has a green "Download submission files" button
that emits its part of this set with the professor's exact names, one click, plain
file downloads (no zip, works on `file://`). The mapping:

| Button (tool) | Files it downloads |
| --- | --- |
| Visual Designer (Problem 2) | `Problem_2_MainWindow.axaml` + `Problem_2_MainWindowViewModel.cs` |
| Async Composer (Problem 3) | `Problem_3_MainWindowViewModel.cs` + `Problem_3_MainWindow.axaml` |
| Query Lab (Problem 4) | `Problem_4_Program.cs` + `Problem_4_Models.cs` |

The submission files use the Starter Kit namespaces (`ExamApp`, `ExamApp.ViewModels`,
`ExamApp.Views`) and each pair is internally consistent (the AXAML `x:Class` and
`xmlns:vm` match the ViewModel namespace), so a grader can drop a pair into a standard
Avalonia project and build. The Visual Designer inlines any typed model class into the
ViewModel file, since the flat set allows no third file per problem. The hint under
each button says it plainly: submit flat, 6 files, no bin/obj, no subfolders.

These submission buttons are separate from the "Export project (.zip)" buttons. The
zip export is for verifying your code BUILDS during the exam; the submission button is
what you actually hand in. Build with the zip, submit with the flat files.

Verify the assembled folder against this exact 6-file manifest with the `f26` profile
(this is THE command for the F26 exam):

```powershell
& "C:\Users\Max\Desktop\AOP Exam Companion\scripts\verify-submission.ps1" `
    -Folder "C:\path\to\your\submission" -Variant f26
```

If your F26 paper prints a DIFFERENT manifest than the professor's email (the 2025
papers each used a slightly different file list, see the family-specific lists below),
follow the paper verbatim and verify with `-Variant custom`.

**ReExam family** (FamilyMealPlanner) - the PDF gives an explicit 6-file manifest:

```powershell
& "C:\Users\Max\Desktop\AOP Exam Companion\scripts\verify-submission.ps1" `
    -Folder "C:\path\to\your\submission" -Variant reexam
```

Required files (reexam): `Problem_1_Submission.txt`, `Problem_2_MainWindowViewModel.cs`,
`Problem_2_MainWindow.axaml`, `Problem_3_MainWindowViewModel.cs`, `Problem_4_Program.cs`,
`Problem_4_Query_Results.json`.

**Summer family** (RectangleUI) - the PDF lists files per problem; this is the flattened set:

```powershell
& "C:\Users\Max\Desktop\AOP Exam Companion\scripts\verify-submission.ps1" `
    -Folder "C:\path\to\your\submission" -Variant summer
```

Required files (summer): `Problem_1_Submission.txt`, `Problem_2_Submission.txt`,
`Problem_2_MainWindowViewModel.cs`, `Problem_2_RectangleData.cs`,
`Problem_2_MainWindow.axaml`, `Problem_3_Tests.cs`, `Problem_4_Program.cs`.

**If F26 prints a different manifest**, pass it explicitly:

```powershell
& "...\verify-submission.ps1" -Folder "C:\path\to\submission" -Variant custom `
    -Required Problem_1_Submission.txt,Problem_2_MainWindow.axaml,Problem_4_Program.cs
```

The script fails (red, exit 1) if anything is missing, empty, extra, or if there is any
subfolder / `bin` / `obj`. When it prints **VERDICT: PASS**, optionally zip it (it
refuses to zip a failing folder):

```powershell
& "...\verify-submission.ps1" -Folder "C:\path\to\submission" -Variant reexam `
    -Zip "C:\path\to\AOP_Submission.zip"
```

Open the zip and confirm the required files sit at its ROOT (flat, no folder prefix)
before you upload it.

---

## 5. Last-30-seconds checklist

- [ ] `verify-submission.ps1` printed **VERDICT: PASS** for the right variant.
- [ ] Folder is FLAT: no `bin/`, no `obj/`, no subfolders, no stray files.
- [ ] Every required file is present and NON-empty (open each one once with your eyes).
- [ ] Problem 1 `.txt` actually contains your written analysis (not an empty template).
- [ ] P4 results JSON uses the EXACT key names from the PDF and is valid JSON.
- [ ] P3 file is named to match the SUBMISSION MANIFEST (see the trap above).
- [ ] Code only uses System / Avalonia / CommunityToolkit.Mvvm.
- [ ] You uploaded the ZIP (or the flat folder) that the verifier just approved.

Breathe. You prepared for this. Go.
