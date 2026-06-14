# AOP Mock Exam Pack 2026

A full dress-rehearsal built to match the real F26 format and the three exams in
`exams/` (June 2025, August 2025 ReExam, May 2026 practice). It has two parts:

1. **MCQ section** (Problem 1) - two 20-question papers, takeable inside the app.
2. **Coding section** (Problems 2-4 + extra drills) - one exam-style task per study
   tool, with the input files already prepared in this folder.

Everything here can be solved using only the companion app. The last section is an
honest tool-by-tool coverage verdict.

---

## How to take the MCQ papers in the app

The 40 questions live in the app's Quiz bank as two categories: **Mock Exam 1** and
**Mock Exam 2**. To sit one as a real timed paper:

1. Open the **Quiz** tab.
2. Click the category chips so that only **Mock Exam 1** (or **Mock Exam 2**) is lit.
3. Pick mode **Exam sim (20 + timer)**.
4. Press **Start**. You get all 20 questions, shuffled, with a countdown, auto-graded.

The full questions, correct answers, and explanations are also written out in
`MCQ_Answer_Key.md` for paper self-checking. (In the app the four choices are
shuffled each attempt, so the A/B/C/D letters in that file are only for the static
version.)

Real exam weighting: Problem 1 is 20 MCQs. Each mock paper here is 20 questions
spanning the same topics the May 2026 practice paper sampled: OOP principles,
polymorphism, design patterns (Strategy/Observer/Adapter/Factory), MVC vs MVVM,
delegates vs events, the five SOLID principles, prototyping (fidelity vs
resolution), reading a LINQ query, and tracing a Stack/Queue/Dictionary/HashSet.

---

## The exam at a glance (2026 format)

| Problem | Topic | Points | Solve it with | Deliverables |
|---|---|---|---|---|
| 1 | 20 MCQs | 20 | **Quiz** tab (Mock Exam 1 / 2) | answered in ItsLearning |
| 2 | UI / MVVM conversion | ~20-30 | **MVVM Converter** + **Visual Designer** | `Problem_2_MainWindowViewModel.cs`, `Problem_2_MainWindow.axaml` |
| 3 | Async UI (and/or unit testing) | ~15-20 | **Async Composer** + **Test Lab** | `Problem_3_MainWindowViewModel.cs` (+ `.axaml`) |
| 4 | JSON + LINQ | ~25-35 | **Query Lab** | `Problem_4_Program.cs`, `Problem_4_Models.cs` (+ results JSON) |

Allowed usings only: `System*`, `Avalonia*`, `CommunityToolkit.Mvvm*`. Flat submission
folder, no `bin`/`obj`, exact professor file names. Match the names on the day's paper.

---

# Problem 2 - MVVM Converter

**Tool:** MVVM Converter tab. **Modeled on:** May 2026 practice Problem 2 (CircleCodeBehind),
August 2025 ReExam Problem 2.

### Task

In `Problem_2_MVVM/` you will find a small Avalonia app, **BoxCodeBehind**, written
entirely in the code-behind pattern (`MainWindow.axaml` + `MainWindow.axaml.cs`). It
shows a rectangle the user can resize and recolor:

- Two sliders set the rectangle's **Width** and **Height** (live).
- A combo box sets its **fill color** from a fixed list.
- A **Reset** button restores width 120, height 80, and the first color.
- A text block shows the current size as `W x H`.

Convert this project to **strict MVVM** so the UI looks and behaves identically.
Hand in exactly two files:

- `Problem_2_MainWindowViewModel.cs`
- `Problem_2_MainWindow.axaml`

### How to solve it in the app

1. Open the **MVVM Converter** tab.
2. Paste `Problem_2_MVVM/MainWindow.axaml` into the AXAML pane and
   `Problem_2_MVVM/MainWindow.axaml.cs` into the code-behind pane.
3. Run the conversion. Read the generated ViewModel and View.
4. Check the points that earn marks:
   - Every named control becomes a binding: `WidthSlider` -> `[ObservableProperty] Width`,
     `HeightSlider` -> `Height`, `ColorSelector` -> a `Colors` list + `SelectedColor`,
     `ResetButton` -> a `[RelayCommand] Reset`.
   - The `Output` text becomes a computed/bound property like `SizeText` that updates
     when Width or Height changes.
   - No control references in the ViewModel; no logic left in the code-behind.
   - The rectangle binds `Width`, `Height`, and `Fill` to the ViewModel.
5. Read any `// TODO` markers the converter leaves and wire them by hand. The combo
   box color -> `IBrush` is the usual one to finish (`Brush.Parse(SelectedColor)`).
6. Rename the two output files to the deliverable names above.

### What to check yourself

- Move both sliders: the rectangle resizes and `SizeText` tracks it.
- Pick a color: the fill changes. Press Reset: back to 120 x 80 and the first color.
- The ViewModel inherits `ObservableObject`, is `partial`, and has zero `using Avalonia.Controls`
  references to named controls.

---

# Problem 2 (alternative) - Visual Designer

**Tool:** Visual Designer tab. **Modeled on:** June 2025 Problem 2 (RectangleUI layout),
August 2025 ReExam Problem 2.1 (sketch-to-layout).

Some Problem 2 variants give you a **sketch** and ask you to build the layout first.
Practice that path here.

### Task - build this layout

Reproduce a "Unit Converter" window. Sketch:

```
+--------------------------------------------------+
|  Temperature Converter            (Title, H1)    |
|                                                  |
|  Celsius:      [ __________ ]   (label + TextBox)|
|  Fahrenheit:   [ __________ ]   (label + TextBox)|
|                                                  |
|            [   Convert   ]      (Button)         |
|                                                  |
|  Result: 0 C = 32 F             (TextBlock)      |
+--------------------------------------------------+
```

Requirements:
- A title `TextBlock` at the top.
- Two labelled `TextBox` rows (use a `Grid` or stacked `StackPanel`s).
- A `Convert` `Button`, centered.
- A result `TextBlock` at the bottom.
- The window should keep this layout when run (size-lock on).

### How to solve it in the app

1. Open the **Visual Designer** tab.
2. Drop a root `StackPanel` (or `Grid`), then add the `TextBlock`, two `TextBox`es with
   label `TextBlock`s, the `Button`, and the result `TextBlock`.
3. Set text, spacing, width, and alignment on each via the properties panel.
4. Use **Generate** to get `MainWindow.axaml` + a `MainWindowViewModel`. The layout is
   the graded part here; bindings/logic are the follow-up subtask.
5. Export and rename to `Problem_2_MainWindow.axaml`.

### What to check yourself

- The generated AXAML is balanced and the preview matches the sketch.
- Controls are named so a ViewModel could bind them (`CelsiusBox`, `ConvertButton`, etc.).

---

# Problem 3 - Async Composer

**Tool:** Async Composer tab. **Modeled on:** August 2025 ReExam Problem 3 (Start/Pause/Reset
counter), June 2025 Problem 2.3 (timer-driven updates on the UI thread).

### Task

Build the ViewModel for a **download progress simulator**:

- A `Progress` value shown in the UI, starting at 0.
- **Start**: every 200 ms, increase `Progress` by 5. Stop automatically at 100.
- **Pause**: stops increasing but keeps the current value. Start resumes from there.
- **Reset**: sets `Progress` back to 0 (and stops it).
- **Thread safety:** all UI updates must happen on the UI thread.

Deliverable: `Problem_3_MainWindowViewModel.cs` (and the `.axaml` if the paper asks for it).

### How to solve it in the app

1. Open the **Async Composer** tab.
2. Configure: pattern **progress**, mechanism **timer** (DispatcherTimer), interval
   **200**, step **5**, commands **Start / Pause / Reset**, stop-at-max **100**.
3. Generate the ViewModel. Read why each piece is there:
   - `DispatcherTimer` raises `Tick` on the UI thread, so updates are already thread-safe.
   - `Start` starts/resumes the timer; `Pause` (Stop) keeps the value; `Reset` stops + zeros.
   - The stop-at-100 check lives in the tick handler.
4. If you prefer the `Task`/`async` mechanism, regenerate with mechanism **task** and
   compare: now you must marshal updates with `Dispatcher.UIThread.Post`. Knowing both
   is worth marks on the written part.
5. Optionally enable the AXAML snippet and the headless test outputs.

### What to check yourself

- Start raises Progress to 100 in steps of 5, then halts on its own.
- Pause then Start resumes from the paused value, not from 0.
- Reset zeros it. No update touches the UI off the UI thread.

---

# Problem 3 (alternative) - Test Lab

**Tool:** Test Lab tab. **Modeled on:** June 2025 Problem 3 (unit-test the Counter ViewModel
+ a headless Avalonia click test).

### Task

`Problem_3_Testing/QuantityViewModel.cs` is a cart line-item ViewModel:
`Quantity` starts at 1, `IncrementCommand` adds one, `DecrementCommand` subtracts one
but only while `Quantity > 1` (a `CanExecute` guard).

Write an xUnit test class with five tests proving:

1. `Quantity` initializes to 1.
2. `DecrementCommand` cannot execute right after construction (quantity is 1).
3. `IncrementCommand` increases `Quantity` by one.
4. After one increment, `DecrementCommand` can execute.
5. `DecrementCommand` decreases `Quantity` by one.

Then add a **headless Avalonia** test that clicks the increment button 100 times and
asserts the displayed value, checking the button and output actually exist.

### How to solve it in the app

1. Open the **Test Lab** tab.
2. Paste the contents of `Problem_3_Testing/QuantityViewModel.cs`.
3. Let it propose the xUnit test class, the command/CanExecute tests, the headless
   Avalonia scaffold, and the exact-version `.csproj` (net9.0, xUnit 2.9.3,
   Avalonia.Headless.XUnit 11.2.1).
4. Map the five required tests onto the proposed ones; fill any gap by hand.
5. Use the offline runbook to know how it would run with `dotnet test`.

### What to check yourself

- The five ViewModel tests use AAA (arrange/act/assert) and call commands via
  `IncrementCommand.Execute(null)` and `DecrementCommand.CanExecute(null)`.
- The headless test resolves the real button and TextBlock before asserting.

---

# Problem 4 - Query Lab

**Tool:** Query Lab tab. **Modeled on:** May 2026 practice Problem 3 (comics), August 2025
ReExam Problem 4 (recipes), June 2025 Problem 4 (spaceships).

### Task

`Problem_4_LINQ/data/movies.json` holds 28 movies. Each has `title`, `director`,
`genre`, `releaseYear`, `runtimeMinutes`, `rating`, and an **optional** `boxOfficeMillions`
(missing on some - handle it null-safely). Keys are camelCase, so your model needs
`[JsonPropertyName]`.

Build a console app that deserializes the file into a `List<Movie>` and runs these
queries, printing each:

1. All movies released **before 2000**.
2. The **number of movies by each director**, sorted by most movies first.
3. For **each genre, the highest-rated movie**, ordered by genre.
4. All movies with a **runtime above the average** runtime of the whole list.
5. All movies that have **no box office figure** (the null-tolerance query).

Then save the results to one JSON file with keys
`{ "before2000": [...], "moviesPerDirector": [...], "topRatedPerGenre": [...], "aboveAverageRuntime": [...], "missingBoxOffice": [...] }`.

Deliverables: `Problem_4_Program.cs`, `Problem_4_Models.cs` (the `Movie` class), and the
results JSON if the paper asks for it.

### How to solve it in the app

1. Open the **Query Lab** tab.
2. Paste the contents of `data/movies.json` into the JSON box. It infers the `Movie`
   model: nullable `boxOfficeMillions`, `[JsonPropertyName]` on the camelCase keys.
3. Add each query by shape (filter, group-by-count, per-group-max, above-average,
   null-filter). Pick the output keys above.
4. Generate `Program.cs` + the model class, plus the populated results JSON.
5. Rename to `Problem_4_Program.cs` and `Problem_4_Models.cs`.

### Self-check (correct counts for this dataset)

- Before 2000: **8** movies.
- Movies per director: Nolan **5**, Spielberg **5**, Tarantino **4**, Villeneuve **4**,
  Miyazaki **4**, Gerwig **3**, Bong **3**.
- Average runtime ~ **133.9 min** -> **13** movies above it.
- Top-rated per genre: Sci-Fi = Inception (8.8), Action = The Dark Knight (9.0),
  Thriller = Parasite (8.5), Drama = Schindler's List (9.0), Crime = Pulp Fiction (8.9),
  Animation = Spirited Away (8.6), Comedy = Barbie (6.8).
- Missing box office: **5** movies (Memento, Reservoir Dogs, Prisoners,
  My Neighbor Totoro, Memories of Murder).

---

# Extra drills - Code Lab

**Tool:** Code Lab tab (the line-by-line annotated reference files).

Code Lab is your "read the canonical pattern, then reproduce it blank" trainer. After
reading each annotated file, close it and rewrite from memory:

1. The `MainWindowViewModel` core: an `ObservableCollection`, two `[ObservableProperty]`
   fields, an injected `IRepository`, and an `[RelayCommand]` that adds to the collection
   and clears the inputs. (This is the MVVM muscle behind Problem 2.)
2. A `[RelayCommand(CanExecute = nameof(...))]` with a guard plus the
   `[NotifyCanExecuteChangedFor]` attribute (the Problem 3 testing pattern).
3. A `DispatcherTimer` start/stop/reset block (the Problem 3 async pattern).

Grade yourself against the annotated original. The notes tell you which lines lose marks
when forgotten (`partial`, the `Command` suffix, writing the property not the field).

---

# Coverage verdict: can you sit the whole exam using only the app?

Tested tool by tool against the three real exams:

| Exam piece | Covered by | Verdict |
|---|---|---|
| Problem 1 (20 MCQs) | Quiz tab: 200 questions incl. the two Mock Exam papers + Exam-sim timer | **Yes.** Full topic coverage, timed simulation. |
| Problem 2 (code-behind -> MVVM) | MVVM Converter | **Yes**, with hand-finishing of `// TODO` markers (color -> brush). The tool does the structure; you wire the last bindings. |
| Problem 2 (sketch -> layout) | Visual Designer | **Yes.** Build the layout, generate balanced AXAML + VM, export with size-lock. |
| Problem 3 (async UI) | Async Composer | **Yes.** Counter and progress patterns, timer or task mechanism, thread-safe updates, optional AXAML + headless test. |
| Problem 3 (unit testing) | Test Lab | **Yes.** Paste the VM, get the xUnit class, command tests, headless scaffold, and exact-version csproj + offline runbook. |
| Problem 4 (JSON + LINQ) | Query Lab | **Yes.** Infers a null-tolerant model with `[JsonPropertyName]`, builds the queries by shape, emits Program.cs + model + results JSON. |
| Submission packaging | each tool's "Download submission files" | **Yes**, plain-text blobs (no zip dependency); rename to the day's exact file names. |

**Gaps to be aware of (do these by hand, the app guides but does not auto-do):**

- The **written sub-answers** (e.g. "explain MVVM / which SOLID principle and why").
  The app gives you the talking points (Quiz explanations, reference topics), but you
  write the prose. The 2026 format folds most theory into the MCQs, so this is smaller now.
- **Final hand-wiring** after a conversion: the converter flags leftovers as `// TODO`
  instead of guessing. Read them.
- **Exact deliverable file names** change per exam paper. The tools can emit every
  variant; match the names printed on the day, do not assume one layout.
- **Compiling/running** is not required for marks ("points awarded regardless of the code
  actually running"), and the app is offline, so there is no in-app compiler. Desk-check
  the generated code; the Test Lab runbook shows the `dotnet` commands if you have a machine.

Bottom line: for the 2026 format, the app covers **all four problems end to end** for
practice, plus a timed MCQ simulator. The only thing it cannot do for you is type the
short written justifications and pick the right professor file names.
