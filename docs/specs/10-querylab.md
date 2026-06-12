# Spec 10: Query Lab (NEW tool): paste JSON, click queries, get full Program.cs

Read docs/specs/00-master-plan.md first (constraints: vanilla JS, file://, no
modules/fetch, Node-loadable data files, t.js test helpers, looks tokens).
You own ONLY these NEW files: data/querylab-core.js, data/querylab.js,
querylab.css, tests/querylab-core.test.js. DO NOT touch index.html or app.js
(integration agent wires it; expose window.QUERYLAB = {render, init} matching
the contract in data/analyzer.js, and follow analyzer-core's guarded
module.exports pattern). Read data/testlab-core.js + data/testlab.js first as
the architectural template (parser core + UI), and read the model solutions
topics in data/solutions-summer.js / data/solutions-reexam.js to match the
exact code style the exam expects.

Purpose: exam Problem 4 (25 pts): deserialize a JSON file with planted
missing/null fields, run LINQ queries, print results, serialize selected
results into one output JSON with exact key names. Max should solve it by
clicking, not coding. Both 2025 exams' P4 shapes are the calibration corpus:
Summer (spaceships: trips sorted desc, average trip count grouped by ship
type, departed <port> in year X with nested trip dates, binary search by name
with null-safe comparer) and ReExam (recipes: tag filter, empty-collection
filter, sort by collection count desc, above-list-average filter, combined
exact-key JSON output).

## 1. Model inference (core, pure)
Input: pasted sample JSON (array or object with one array property; handle
both). Infer C# model classes:
- PascalCase class + property names, [JsonPropertyName] attributes whenever
  the JSON key differs from the property name (incl. camelCase keys).
- Types: long/int vs double, bool, string, nested object -> nested class,
  array -> List<T>.
- Null tolerance is THE exam trap: any field that is null or missing in ANY
  sample element becomes nullable (string?, DateTime?, List<T>? or a
  `= new()` default for collections; pick the convention used in the model
  solutions files and stay consistent).
- Date-looking strings (ISO yyyy-MM-dd...) offer a per-field toggle:
  string (default, safest) or DateTime?; when string, year filters use
  StartsWith/substring parsing in generated queries.
- UI shows the inferred model with per-field type dropdowns to override.

## 2. Query builder (core + UI)
A list of query rows; each row: pick a shape, fill its blanks via dropdowns
populated from the inferred schema (fields incl. nested paths like
TravelHistory[].ArrivalDate) plus small text/number inputs:
shapes (cover BOTH 2025 exams; name them plainly):
- filter-equals / filter-contains (string field == / Contains value;
  case-insensitive toggle)
- filter-empty-collection (collection field is null or Count == 0)
- filter-nested-any (nested collection Any(x => x.Field == value / == null /
  year-of-date == N))
- sort-by (field or collection Count, asc/desc, ThenBy optional)
- group-aggregate (GroupBy field -> Count() / Average(sub expr) / Max / Min,
  output anonymous {Key, Value} list)
- above-average (elements whose numeric expr > list-wide Average of same)
- top-n (OrderBy + Take)
- select-fields (projection to chosen fields)
- binary-search (sort List by string field with Comparer<T>.Create handling
  nulls, then List.BinarySearch for a value; emits the full idiom + result
  index handling)
Each row gets: a result variable name (auto: q1, q2... editable), an "include
in output JSON" checkbox + exact output key text input, and a "print to
console" checkbox (foreach with readable interpolation, collection counts).

## 3. Code generation (core, pure)
One complete Program.cs: usings, models (from #1), Main with:
File.ReadAllText("<filename input>"), JsonSerializer.Deserialize with
JsonSerializerOptions(PropertyNameCaseInsensitive = true), null guard, each
query in order with a // Query N: <label> comment, console printing for
checked rows, and when any row is marked for output: a single anonymous
object { key1 = q1, ... } serialized WriteIndented to the output file name
(text input, default Problem_4_Query_Results.json). Generated code must
desk-check compile: correct null-conditional operators on nullable paths
(s.TravelHistory?.Count ?? 0 style), no LINQ on possibly-null collections
without ?? guard. Style: match the model solutions (clear variable names,
no var abuse, comments only where they earn understanding points).

## 4. Presets
Two one-click presets that reproduce the full 2025 P4 solutions: "Summer
2025 spaceships" and "ReExam 2025 recipes" (sample JSON snippet + the exact
query rows + output keys). Calibrate generated code against the model
solutions topics; the structure must match what was verified to compile.

## 5. UI layout
Left pane: JSON paste area (with Load preset buttons + a models card below
showing inferred classes + type overrides). Right pane: query rows (add /
remove / reorder up-down), then output options (output file name), then the
generated Program.cs in a code card with copy button. Live regenerate
(debounced). Persist everything to localStorage key aop-querylab-state.
XSS-escape all rendered user input. Garbage JSON -> friendly parse error
panel, never throws.

## Looks
Master-plan tokens. Query rows: ink-2 cards with shape icon + dropdowns
inline, green accent for this tool (constructive/codegen like testlab's
cyan; pick green to differentiate). Code output card identical chrome to
testlab's.

## Tests (tests/querylab-core.test.js, Node, t.js helpers)
- Inference: spaceships-like sample (nested trips, one null ArrivalDate, one
  missing Name) -> nullable string Name, nested class, List defaults,
  [JsonPropertyName] for camelCase keys.
- Each query shape generates its expected LINQ fragment (string asserts:
  "OrderByDescending", "GroupBy", "Average", "BinarySearch",
  "Comparer<", null-safe "?." / "?? 0" where applicable).
- Exact-key output: generated code contains the anonymous object with the
  user's keys and WriteIndented.
- Both presets generate code containing the calibration idioms; brace-
  balanced; no "TODO" in preset output.
- Robustness: garbage input safe; UI file Node-loadable; escaping test.

## Definition of done
Own tests green; full suite green at session end; desk-check the Summer
preset's generated Program.cs line by line against the verified model
solution in data/solutions-summer.js for behavioral equivalence.

## Return (final message, raw JSON)
{"done": bool, "shapes": [..], "inference_features": [..], "tests": "X
passed", "manual_checks": [..], "skipped": [..], "notes": ".."}
