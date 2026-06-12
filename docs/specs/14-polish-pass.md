# Spec 14: Reliability + visual polish pass over the solver tools

Read docs/specs/00-master-plan.md first (tokens, constraints). Max: "improve
them so I can rely on them, fully functional and visual wise as well." This
spec is executed by the SAME per-tool agents as spec 13 (one agent per tool
does both specs for its tool). v4 features exist; never regress them.

## Ownership
- designer agent: data/designer-core.js, data/designer.js, designer.css,
  tests/designer-core.test.js, tests/designer-ui.test.js
- testlab agent: data/testlab-core.js, data/testlab.js, testlab.css,
  tests/testlab-core.test.js
- querylab agent: data/querylab-core.js, data/querylab.js, querylab.css,
  tests/querylab-core.test.js
- asynclab agent: data/asynclab-core.js, data/asynclab.js, asynclab.css,
  tests/asynclab-core.test.js
- integration agent (after, spec 12 owner set): app.js, index.html,
  README.txt, styles.css

## Shared consistency checklist (every tool agent applies to its tool)
1. Header: title + one-line subtitle + toolbar laid out like the Visual
   Designer's (see screenshot feedback: that layout reads well).
2. Empty state: a short "start here" hint with the 1-2-3 of using the tool
   (e.g. querylab: "1. paste your JSON  2. add query rows  3. copy or export
   the project"), plus preset/load-example buttons front and center.
3. Copy buttons: identical look + "copied" feedback everywhere; "Copy all"
   visually primary; Export project button styled as the success action
   (green tint).
4. Error states: parse errors / invalid input render a styled panel (red
   tint, mono excerpt), never a blank pane, never a thrown exception (verify
   with garbage input).
5. Code output: consistent syntax highlighting using the app's existing
   highlighter conventions; collapsible cards when more than 2 files.
6. No layout breakage at 1280px wide and at 1920px; panes scroll
   independently; no horizontal bleed.
7. Every interactive control reachable with visible focus styles.

## Designer-specific polish (from Max's screenshot)
- Preview fidelity: typed-model ItemsControl/ListBox previews render 3 sample
  rows from the model fields (e.g. "Monday: Spaghetti" style from string
  fields, colored swatch for IBrush) instead of empty gray strips.
- The root breadcrumb chip ("Window") floats detached bottom-left: anchor the
  breadcrumb row directly under the stage header, never overlapping content.
- Stage scale-to-fit: when the configured Window size exceeds the viewport,
  scale the stage (CSS transform, pointer math already divides scale per
  spec 01; verify) with a zoom % indicator and 100% toggle.
- Drop affordance: while dragging, valid containers get the existing drop-ok
  highlight plus an insertion line for sibling drops (the silent insert-
  before behavior confused testers).
- Binding chips (amber {Binding X}) can crowd small controls: truncate with
  ellipsis + title tooltip.
- Toolbar: group [Undo Redo Duplicate] | [slots dropdown Load Save-as Delete
  New Re-seed] | [Export Import Export-project] with separators; icon + label
  on all buttons, consistent casing.
- Inspector: sections ordered Layout / Appearance / Attached / Binding /
  Items, collapsed state persisted per section.

## Functional hardening (each tool, where applicable)
- Designer: rapid drag/drop/undo storms keep tree + localStorage consistent
  (no orphan ids; add a tree-invariant assert in tests after a scripted storm
  of 30 random ops).
- Test Lab / Query Lab / Async Composer: regenerate is debounced, never
  loses unsaved option state on rerender; localStorage round-trips the full
  state (test: set state, reload module fresh in Node where feasible).
- All: version-stamp localStorage payloads ({v:1, ...}) with graceful
  migration/fallback on unknown shapes.

## Tests
Each agent extends its test files for: error-state rendering (garbage input
-> error panel string, not throw), state round-trip with version stamp,
designer storm invariant + scale math, preview sample-row generation. UI
files stay Node-loadable.

## Definition of done
Own tests green; full suite green at session end; the shared checklist
applied and each item either done or listed in skipped with a reason.

## Return (final message, raw JSON)
{"done": bool, "checklist": {"1..7": "ok|skipped"}, "tool_specific": [..],
 "tests": "X passed", "manual_checks": [..], "skipped": [..], "notes": ".."}
