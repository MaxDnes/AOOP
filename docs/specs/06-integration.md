# Spec 06: Integration + shell hardening (runs AFTER all build agents)

Read docs/specs/00-master-plan.md first. You own: app.js, index.html, README.txt,
styles.css. You may READ everything. By the time you run, these exist: the upgraded
designer/analyzer/quiz, NEW data/testlab-core.js + data/testlab.js + testlab.css,
NEW data/exam-fixtures.js, NEW data/solutions-summer.js + data/solutions-reexam.js,
NEW scripts/ + README-EXAM-DAY.md. Verify each exists first; if one is missing,
integrate everything else and report it.

## Work

1. TOOLS registry: replace the five hardcoded tool lists in app.js (go() router
   branches, buildNav() nav-tools, renderHome() tool cards, updatePinBtn() exclusion,
   boot hash whitelist) with ONE registry array {id, label, sub, icon, color,
   module} consumed everywhere. Entries: lab, builder, designer, analyzer, testlab,
   quiz. Test Lab: icon a flask, label "Test Lab", sub like "paste code, get xUnit
   test proposals", cyan accent, module window.TESTLAB (contract {render, init},
   confirm against data/testlab.js).
2. index.html: add (order matters, before app.js): testlab.css link;
   data/testlab-core.js, data/testlab.js after the analyzer pair;
   data/exam-fixtures.js right after analyzer scripts; data/solutions-summer.js,
   data/solutions-reexam.js with the other topic data files.
3. CATEGORIES in app.js: add "Model Solutions" (green, placed directly after the
   Exam Playbooks category) so the two solutions files' topics render; confirm both
   data files use the exact cat string.
4. Search depth: extend TOOL_TOPICS _txt generation so quiz questions
   (window.QUIZ_BANK text: question + choices + explanation), analyzer rule prose
   (from analyzer-core's rule table), and testlab capability keywords are searchable.
   Lazy-build these strings at boot AFTER all scripts load; keep it under ~50ms
   (concatenate once, cache).
5. History: pushState on navigation + popstate/hashchange listener calling go()
   when hash differs from current; Back/Forward must work; file:// safe try/catch
   stays.
6. Unknown route: go() with unknown id renders a small "not found, did you mean"
   panel using the existing search scorer over the bad id.
7. tasks key collision fix: renderBlock keys checkboxes topicId + ':' + blockIndex
   + ':' + i (blockIndex = index of the block within t.blocks); one-time migration
   copies legacy 'topicId:i' values into the FIRST tasks block of that topic, then
   marks aop-task-state migrated (a version field).
8. Lab xrefs + keys: widen inline()'s xref regex so [[lab/<id>|label]] works (go()
   already handles those ids); extend ArrowLeft/Right to navigate within LAB_FILES
   when current is a lab route.
9. Polish: styles.css badge colors for .lang-json and .lang-text; hiBash comment
   stashing fix; remove the unused cat const in renderTopic.
10. README.txt rewrite: document all six tools (one paragraph each, including what
    the Designer/Analyzer/Quiz/Test Lab do now), the Model Solutions category, the
    scripts/ folder + README-EXAM-DAY.md, updated keyboard list (undo/redo, quiz
    keys, lab arrows), updated topic count (count them), and the localStorage
    persistence note (state survives browser restart, plus the designer/quiz
    export buttons for moving to the exam machine).

## Definition of done
- `node tests/run-tests.js` FULLY green (every module, all agents' tests).
- Boot smoke: `node -e` load of app.js is not possible (DOM), so instead verify by
  grepping that every script tag's file exists on disk, every TOOLS entry's module
  global is defined by its file, every CATEGORIES name has >= 1 topic, no topic cat
  is missing from CATEGORIES, no duplicate topic ids across ALL data files (write a
  small Node script under tests/ as integration.test.js additions, keeping its
  existing checks).
- Hash routes home/lab/lab/<id>/builder/designer/analyzer/testlab/quiz all present
  in the registry/whitelist.
- README accurate (topic counts, tools, keys).

## Return (final message, raw JSON)
{"done": bool, "registry_entries": [..], "tests": "X passed", "topics_total": N,
 "missing_inputs": [..], "manual_checks": [..], "notes": ".."}
