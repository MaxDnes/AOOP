# Spec 02: Analysis Lab -> full Problem 1 solver (theory + written part)

Read docs/specs/00-master-plan.md first. You own ONLY: data/analyzer-core.js,
data/analyzer.js, analyzer.css, data/exam-fixtures.js (NEW),
tests/analyzer-core.test.js, tests/analyzer-ui.test.js. Read the existing core and UI
fully first; extend the rule engine, do not rewrite. The fixtures in tests/fixtures/
{summer2025,reexam2025} are the REAL 2025 exam Problem 1 codebases; calibrate
against them.

Problem 1 scoring reality (ReExam rubric): for EACH of the 5 SOLID principles:
presence yes/no (1 pt), how/where with a code example (2 pts), general purpose +
application here (2 pts). The Summer exam awarded ~18/20 points for identifying
PRESENT principles, benefits, and patterns, not violation hunting. The current tool
is violation-only; that is the biggest gap.

## Features

### 1. New violation rules (each: id, principle tags, severity, theory text, prose
fix, before/after C# mini-snippet 5-10 lines each side, answer-paragraph template)
- pattern-switch-dispatch: `case TypeName x:` or `TypeName x =>` arms over project
  types (OCP, high when 2+, medium single). Closes the switch-pattern blind spot.
- single-is-downcast: a single `is ProjectType ident` (class OR interface) where the
  casted ident's members are then used; medium, LSP/OCP. Today only `as` and C-style
  casts and 2+ chains are caught.
- unused-injected-dependency: ctor parameter assigned to a private field that is
  never read anywhere else in the class (DIP / dead abstraction, high). This is the
  ReExam's planted `List<IDietaryRule> _rules`; your test MUST catch it in the
  reexam2025 fixture.
- object-collection: fields/props of List<object>, object[], Dictionary<,object>
  (OCP/type-safety, medium), often paired with OfType<T> dispatch; mention OfType in
  the theory.
- file-io-in-domain: File. / Directory. / StreamWriter / StreamReader usage inside
  classes NOT named *Program/*Repository/*Storage/*Persistence (SRP, medium).
- marker-interface: interface with zero members (info severity; theory note: can be
  a legitimate ISP talking point, decide from context).

### 2. Presence detection (new finding kind "presence")
Positive findings, rendered green, feeding the written answer's presence half:
- DIP present: ctor params typed as project interfaces stored in fields.
- ISP present: project interfaces with 1-3 members, especially several of them.
- SRP present: multiple small focused classes (heuristic: classes whose names encode
  one role: *Repository, *Generator, *Notifier, *Rule, *Service) named individually.
- OCP/Strategy present: interface with 2+ implementations used through a collection
  or injected reference (name the implementations).
- Repository pattern: *Repository class implementing an interface.
- Observer: event/delegate declarations or classic Subscribe/Notify naming.
- Encapsulation present: private fields + public properties dominate.
Each presence finding carries a citation (file:line of the strongest evidence) and a
ready paragraph: "X is present: <evidence> at <cite>. Purpose: <general>. Here it
<application>."

### 3. Written-answer composer v2
Right pane becomes three tabs: Findings | Templates | Draft.
- Findings: as today, but presence findings included with their own checkboxes and a
  green style; violations unchanged.
- Templates: fill-in-the-blank paragraph cards: each of the 5 SOLID principles in
  BOTH variants (present-because / violated-because), the 4 OOP pillars, an MVVM
  roles paragraph, and short blurbs for Strategy, Dependency Injection, Repository,
  Facade, Observer, marker interface. Blanks shown as ___ ; an Insert button appends
  the card text into the Draft.
- Draft: assembleAnswer() now structures by principle S,O,L,I,D (matching the
  rubric): for each principle, presence paragraphs first, then violations with fixes,
  then a one-line "purpose" sentence from the theory bank if neither exists, ending
  with the summary. Keep the editable textarea + copy. Add a dismissible banner:
  "Reword in your own voice; examiners compare answers." Introduce 2-3 alternate
  sentence skeletons per rule so two findings from one rule do not read identically
  (pick deterministically by finding index).

### 4. Real exam fixtures in-app (data/exam-fixtures.js, NEW)
Generate from tests/fixtures: window.EXAM_FIXTURES = { summer2025: {label, files:
[{name, text}], answerKey: [{principle, verdict, paragraph}]}, reexam2025: {...} }.
File contents verbatim. Answer keys: write model answers per the rubric for every
principle (presence verdicts AND the planted violations: ReExam = the
`as InMemoryRecipeRepository` downcast + the never-used _rules list; Summer =
whatever your scan + reading of the fixture actually shows; read the fixture code
yourself and write honest model paragraphs). UI: "Load Summer 2025" and "Load
Re-exam 2025" buttons beside "Load example"; loading fills the tabs. Answer key
renders behind a <details> reveal with a "scan and try first" warning.

### 5. Coverage strip + manual-hunt checklist
After each scan show a strip of 6 chips (SRP OCP LSP ISP DIP ENC): green = has
findings (any kind), dim = zero, with hint "exams usually plant about one per
principle; dim chips deserve a manual pass". Empty state and a collapsible section
above results get the manual-hunt token checklist: per principle the exact tokens to
Ctrl+F for (`as `, `(Type)`, `is `, `switch`, `throw new Not`, `new ` of a project
class, `Console.`, `File.`, `static`, `public` fields) and what each implies.

### 6. Small fixes
- POLY: add to THEORY_CHIPS (or fold its text into LSP chip; pick one, make theory
  reachable).
- Paste-splitter: if a pasted blob contains 2+ top-level class/interface/namespace
  declarations or `// File: X.cs` markers, offer (toast/button) to split into tabs
  automatically, preserving names from markers when present.

## Looks
Presence cards: --green accents (green-soft background tint, green left border),
violation cards keep red/amber. Coverage strip chips reuse the theory-chip styling.
Tabs styled like the existing file tabs. Templates tab cards: ink-2 background,
mono ___ blanks, small Insert button bottom-right.

## Tests (extend both test files)
- Every new rule: positive + negative case.
- reexam2025 fixture: unused-injected-dependency fires on _rules; downcast still
  fires; presence detection finds DIP + ISP + at least one pattern.
- summer2025 fixture: at least one new-rule or presence finding beyond the old set;
  assert whatever you verified by reading the fixture (no aspirational asserts).
- assembleAnswer: draft contains all five principle sections in order, mixes
  presence + violation paragraphs, alternate skeletons differ for two findings of
  the same rule.
- exam-fixtures.js: Node-loadable, both sets present, summer >= 6 files,
  reexam >= 5 files, every answerKey entry has principle/verdict/paragraph.
- XSS: fixture code and answer-key text rendered escaped (reuse existing escape
  tests pattern).

## Definition of done
- Own tests green; full suite green at session end (ignore mid-session failures from
  files you do not own).
- Scanning the loaded ReExam fixture in the UI yields BOTH planted smells plus
  presence findings, and Build Draft produces a rubric-shaped 5-principle answer.
- No file outside ownership touched.

## Return (final message, raw JSON)
{"done": bool, "new_rules": [..], "presence_rules": [..], "tests": "X passed",
 "fixture_scan_summary": {"summer": [..], "reexam": [..]},
 "manual_checks": [..], "skipped": [..], "notes": ".."}
