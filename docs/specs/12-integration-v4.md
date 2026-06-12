# Spec 12: Integration v4 (runs AFTER specs 07-11 build agents)

Read docs/specs/00-master-plan.md first. You own: app.js, index.html,
README.txt, tests/integration.test.js (extend, keep existing checks green).
The TOOLS registry from spec 06 already exists in app.js; this is a small,
careful pass.

## Work
1. Register two new tools in the TOOLS registry: querylab (label "Query Lab",
   sub like "paste JSON, click queries, get Program.cs", green, module
   window.QUERYLAB) and asynclab (label "Async Composer", sub like
   "configure a worker, get the ViewModel", violet, module window.ASYNCLAB).
   Verify the {render, init} contract against the actual files. Sidebar order:
   lab, builder, designer, analyzer, testlab, querylab, asynclab, quiz.
2. index.html: add querylab.css + asynclab.css links and the four new script
   tags (core before ui, before app.js).
3. Search: add TOOL_TOPICS entries with generated _txt for both new tools
   (capability keywords + their preset/shape names) following the spec-06
   deep-indexing pattern.
4. README.txt: add the two tools to the Tools section, mention the designer's
   new logic recipes + reference image, analyzer modes, testlab per-function
   P/N/E. Update topic/tool counts if changed.
5. tests/integration.test.js: extend the existing static checks to cover the
   new files (script/link existence, node --check, module globals defined,
   no duplicate topic ids). Run the FULL suite; everything green.

## Definition of done
Full `node tests/run-tests.js` green; all 8 tools reachable via registry
(grep app.js); every index.html resource exists; README accurate.

## Return (final message, raw JSON)
{"done": bool, "registry_entries": [..], "tests": "X passed",
 "missing_inputs": [..], "manual_checks": [..], "notes": ".."}
