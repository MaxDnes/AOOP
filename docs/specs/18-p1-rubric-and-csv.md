# Spec 18: June-style P1 rubric draft + Query Lab CSV mode

Read docs/specs/00-master-plan.md first. v3 through v7 are merged and green
(423/0). NEVER regress; extend. This spec closes the two point-risk gaps the
2026-06-12 exam research found.

## Why this spec exists

The June 2025 paper's P1 (20 pts) has five scored parts: 1.1 describe what
the code models (2), 1.2 purpose of the interfaces (2), 1.3 the four OOP
pillars, presence plus how/where with a code example each, honest about
absences (8), 1.4 two SOLID principles (4), 1.5 one design pattern (4).
The Analysis Lab detects pillars and patterns but its Full-answer Draft only
follows the August all-SOLID rubric, and it cannot detect Singleton or
Command, two of the six patterns the repetition lecture names.

Lecture 12 also lists CSV parsing next to JSON. Both 2025 P4s used JSON, so
a CSV data file is the likeliest F26 curveball, and Query Lab currently
rejects non-JSON input. CSVHelper is NOT an allowed library; any CSV code
must be System-only (File.ReadAllLines + Split).

## Agent A: analyzer (P1 rubric draft + two pattern rules)

File ownership (complete list, never touch anything else):
data/analyzer-core.js, data/analyzer.js, tests/analyzer-core.test.js,
tests/analyzer-ui.test.js.

1. Two new detection rules in analyzer-core.js, same shape as the existing
   pattern rules (facade/strategy/observer):
   - singleton: private constructor plus a static Instance property or
     Lazy<T> field returning the type; presence card names the variant
     (lazy vs eager). No false positive on plain static helper classes.
   - command-pattern: ICommand/IRelayCommand/RelayCommand/AsyncRelayCommand
     members or [RelayCommand] attributes; presence card explains Command
     as the course frames it (encapsulating an action as an object the UI
     binds to). Must not fire on a class merely USING someone else's
     commands from AXAML bindings (that is binding, not implementing).
2. A new draft mode "June P1 rubric" beside the existing modes in
   analyzer.js (mode chip label: "June rubric"). It assembles the draft in
   the June order with these exact section headings:
   1.1 General analysis: a guided paragraph built from the scan: the
   top-level types found, which class orchestrates (most outgoing calls /
   workflow-named), what the verbs suggest the system does. Where the scan
   cannot know, emit a bracketed [fill in: ...] cue rather than inventing.
   1.2 Interfaces: purpose paragraph from the interface findings (capability
   interfaces, marker interfaces, who implements what, ISP framing).
   1.3 OOP principles: one block per pillar (Encapsulation, Inheritance,
   Abstraction, Polymorphism): present or not, where (file plus member),
   what purpose it serves here. When inheritance is interface-only, say
   plainly there is no class-to-class inheritance, mirroring the model
   answer's honesty (that statement scores the point).
   1.4 SOLID: the two strongest principle candidates by evidence count,
   each with general purpose plus specific benefit here.
   1.5 Design pattern: the single strongest pattern finding with its role
   in this code; if several, pick by evidence strength and mention the
   runner-up in one clause.
3. A "Copy as Problem_1_Submission.txt" button on the draft pane that
   copies the draft with the 1.1-1.5 headings as plain text.
4. Calibration: against the in-app Summer DocumentManager fixture
   (data/exam-fixtures.js), the June-rubric draft must reproduce the
   substance of the known model answer: capability interfaces named, no
   class-to-class inheritance stated, ISP and DIP as the two SOLID picks,
   Strategy (with DI) or Facade as the pattern. Tests assert these.
5. Existing modes, cards, and the August-style draft are untouched.

## Agent B: querylab (CSV input mode)

File ownership (complete list, never touch anything else):
data/querylab-core.js, data/querylab.js, querylab.css,
tests/querylab-core.test.js.

1. Input detection: if the pasted text is not JSON but parses as CSV
   (first line of comma-separated headers, 1+ data rows, consistent column
   counts; handle quoted fields with commas), enter CSV mode. JSON
   behavior is unchanged.
2. Model inference from CSV: headers become PascalCase properties (keep a
   mapping to the original header for parsing); column scalar kinds by
   voting like JSON inference; empty cells mean the property must be
   nullable. Singular class name from the input file name or a sensible
   default; the user can override names as with JSON.
3. Codegen (System-only, CSVHelper is NOT allowed): a static ParseCsv
   helper in Program.cs using File.ReadAllLines, skipping the header,
   splitting with a small quote-aware splitter (a 10-line state loop, not
   string.Split alone, so quoted commas survive), TryParse per typed
   column with null on failure or empty. The SAME query pipeline, console
   printing and Problem_4_Query_Results.json writing as JSON mode.
4. The nested-collection query shapes that need a child collection stay
   JSON-only: in CSV mode hide or disable those rows with a one-line hint
   (CSV is flat; the exam cannot ask trips-per-ship of a flat file).
5. Submission export and project zip export both work in CSV mode: the
   data file lands beside the csproj with CopyToOutputDirectory, Models.cs
   carries the inferred model, Program.cs the parser plus queries.
6. UI: the paste hint mentions both formats; on CSV detection show a small
   "CSV mode" badge near the model card.
7. E2e proof (mandatory): paste a representative CSV with a planted empty
   cell and a quoted comma field, export the console project zip, expand,
   dotnet build AND dotnet run in %TEMP%; the run must print the query
   results and write Problem_4_Query_Results.json. Clean up after.

## Agent C: content (CSV reference topic)

File ownership (complete list): data/linq.js only.

Add one topic to the Data & Files area: "CSV without CSVHelper (exam-legal
parsing)". Content: why CSVHelper is off-limits (allowed libraries rule),
the File.ReadAllLines + quote-aware split idiom matching what Query Lab
generates, TryParse with nullable fallbacks for planted missing values, a
gotcha block on quoted commas and empty trailing columns, and a pointer
that Query Lab automates this end to end. House style: same block shapes
as the surrounding topics, no em dashes, no bold.

## Integration agent (runs ALONE, last before verify)

File ownership: app.js, index.html, styles.css, README.txt,
README-EXAM-DAY.md, data/guide.js, tests/integration.test.js,
tests/guide.test.js.

1. data/guide.js: in the P4 play, one added sentence: if the data file is
   CSV instead of JSON, paste it anyway, Query Lab switches to CSV mode
   and generates exam-legal System-only parsing. In the P1 play, mention
   the June rubric mode and the Copy as Problem_1_Submission.txt button.
   Update tests/guide.test.js pins accordingly.
2. README.txt: extend the Query Lab and Analysis Lab paragraphs with the
   new capabilities, one sentence each.
3. No registry changes (no new tools). Full suite green:
   node tests/run-tests.js (baseline 423 plus the new agents' tests).

## Verify (loop, up to 3 fix rounds)

1. node tests/run-tests.js fully green.
2. node --check on app.js and every data/*.js; index.html refs exist.
3. P1 calibration in Node: June-rubric draft on the Summer DocumentManager
   fixture contains the 1.1-1.5 headings in order, names the capability
   interfaces, states there is no class-to-class inheritance, picks two
   SOLID principles with ISP and DIP among the candidates, names Strategy
   or Facade for 1.5; singleton and command-pattern rules fire on planted
   minimal fixtures and stay silent on a control without them.
4. CSV e2e (real dotnet): a CSV sample with an empty cell and a quoted
   comma -> Query Lab CSV mode -> console project zip -> Expand-Archive ->
   dotnet build green AND dotnet run prints query output and writes
   Problem_4_Query_Results.json. 5 minute timeout, hang is a failure.
5. JSON regression: the Summer spaceships preset still generates, exports,
   and its dotnet run output is unchanged (run the existing canary).
6. Guide: render() mentions CSV mode in the P4 play and the June rubric in
   the P1 play; style rules hold (no em dash, no bold).
