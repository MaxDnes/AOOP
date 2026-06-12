# Spec 08: Analyzer explicit modes (violations / implementations / full answer)

Read docs/specs/00-master-plan.md first. You own ONLY: data/analyzer-core.js,
data/analyzer.js, analyzer.css, tests/analyzer-core.test.js,
tests/analyzer-ui.test.js. The analyzer already detects violations AND
presence; this round adds an explicit MODE switch per Max: "I give the code,
it spots SOLID issue or implementation based on the mode I choose."

## 1. Mode selector
Three chips above the results pane (persisted in aop-analyzer-state):
- Violations: only violation findings listed; coverage strip counts violations.
- Implementations: only presence findings; copy reframed ("how each principle
  is implemented here"); coverage strip counts presence.
- Full exam answer (default): both, as today.
Mode filters the findings list, the select-all behavior, the coverage strip,
and assembleAnswer:
- Violations mode draft: per principle only violation paragraphs + fixes
  (principles without findings get one line: "No clear violation of X found;
  state its purpose and check manually.").
- Implementations mode draft: per principle the presence paragraphs (rubric
  shape: present yes/no, how/where + example, purpose + application), exactly
  what ReExam P1 asked.
- Full mode: current rubric draft (presence then violations per principle).

## 2. Per-principle deep dive
Clicking a principle chip in the coverage strip scrolls to / filters that
principle's findings (toggle), so Max can work principle by principle like the
rubric demands.

## 3. Quality pass
Re-read every answer paragraph template with fresh eyes for prose quality and
correctness (they go into a graded exam answer verbatim); fix clunky or
generic phrasing; ensure each violation paragraph names file:line, evidence,
principle, consequence, fix, and each presence paragraph names evidence,
purpose, application.

## Looks
Mode chips styled like the existing theory chips, active state amber. No other
visual changes.

## Tests
- Mode filtering of findings + draft content per mode (three asserts on
  assembleAnswer output given a fixed findings set: violations-only text has
  no presence paragraphs, implementations-only has no violation paragraphs,
  full has both).
- "No clear violation" filler line appears for principles with zero findings
  in violations mode.
- Existing tests stay green (mode default = full keeps old behavior).

## Definition of done
Own tests green; full suite green at session end; loading the ReExam fixture
in Implementations mode and pressing Build Draft yields a complete 5-principle
"how it is implemented" answer with zero violation language.

## Return (final message, raw JSON)
{"done": bool, "modes": [..], "tests": "X passed", "manual_checks": [..],
 "skipped": [..], "notes": ".."}
