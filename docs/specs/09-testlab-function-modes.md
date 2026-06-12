# Spec 09: Test Lab per-function positive / negative / edge generation

Read docs/specs/00-master-plan.md first. You own ONLY: data/testlab-core.js,
data/testlab.js, testlab.css, tests/testlab-core.test.js. The Test Lab already
parses C# and generates Fact/Theory/VM/headless/async tests. Max's ask: "I
give the code, it returns positive, negative and edge case tests ON THE
FUNCTION I give."

## 1. Function picker
After parsing, the right pane lists every public method/command found
(grouped by class, checkbox each, all checked by default). Generation only
covers checked functions. Persist selection in aop-testlab-state keyed by
class.method.

## 2. Positive / negative / edge triplet per function
For each selected function generate a clearly labeled trio (region comments
in the output file: // --- Positive ---, // --- Negative ---, // --- Edge ---):
- Positive: happy-path [Fact] (current heuristics; valid representative args:
  non-empty strings, positive numbers, valid collection).
- Negative: invalid-input tests: null for reference params (expect
  ArgumentNullException via Assert.Throws OR a TODO choice comment when the
  contract is unknown: "// if X tolerates null, assert the fallback instead"),
  out-of-range numerics (-1, int.MaxValue where a range is plausible), wrong-
  state calls (e.g. Stop before Start for command pairs; remove on empty
  collection).
- Edge: boundary [Theory] with [InlineData] rows: 0, 1, -1, empty string,
  whitespace string, empty collection, single-element collection, as
  applicable per parameter/return types; plus equality boundaries when the
  method name implies comparison (Min/Max/Average/Between).
Type-aware: only emit rows that type-check (no empty-string rows for int
params). Async functions: await + timing-tolerant asserts as already done.

## 3. Output organization
Mode toggles stay; new default mode "Per-function P/N/E" producing one test
class per source class with the labeled trios, plus the existing "Copy all".
Per-function copy buttons (copy just that function's trio).

## Looks
Function picker: compact checkbox list, mono method signatures, class name as
group header (amber). Trio regions visible in the code preview via the
existing code styling.

## Tests
- Picker model: parse sample -> function list with stable keys; generation
  respects unchecked functions.
- Trio generation for a representative service (string param, int param,
  collection return): positive Fact present; negative Assert.Throws or TODO-
  choice comment present; edge Theory InlineData rows type-check (no string
  rows for ints); region labels present.
- Counter VM commands: wrong-state negative (Stop-before-Start) generated.
- Output stays brace-balanced; existing tests stay green.

## Definition of done
Own tests green; full suite green at session end; pasting the ReExam Counter
VM and selecting only Start yields a labeled P/N/E trio that desk-checks as
compilable.

## Return (final message, raw JSON)
{"done": bool, "trio_heuristics": [..], "tests": "X passed",
 "manual_checks": [..], "skipped": [..], "notes": ".."}
