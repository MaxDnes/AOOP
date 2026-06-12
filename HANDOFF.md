# HANDOFF: AOP Exam Companion build state + exact next steps

For the next agent. Written 2026-06-12 by the session that built v3 and half
of v4. Max's exam is ~2026-06-14. He hit usage limits; your job is to finish
the remaining builds EXACTLY as specced, without re-planning.

## Standing instructions from Max (do not deviate)
- Planning is done; specs are authoritative: `docs/specs/00` through `15`.
- Build agents must run on OPUS (`model: 'opus'` in Workflow agent() calls).
- Ultracode mode: use the Workflow tool for the builds, with verify-fix loops.
- No git repo here: STRICT file ownership per spec; parallel agents must never
  share files. Integration agent (app.js/index.html/README/styles.css) always
  runs alone, last, before verification.
- The app must stay 100% offline (file://, vanilla JS, no modules/fetch).
- Full gate after each workflow: `cd "C:\Users\Max\Desktop\AOP Exam Companion"
  && node tests/run-tests.js` fully green (149 passing before v4; more after).
- Watch workflows for stalls (if transcripts go >10 min without file changes,
  kill and resume); tell Max immediately if one hangs.

## State right now
- v3 (specs 01-06) COMPLETE and verified: 149/0 tests, model solutions for
  both 2025 exams build green in `C:\Users\Max\Desktop\AOP Model Solutions`,
  scripts in `scripts/` pass, README-EXAM-DAY.md exists. 8 tools wired:
  lab, builder, designer, analyzer, testlab, quiz (+ Model Solutions topics).
- v4 (specs 07-11 + 12) was MID-FLIGHT when stopped on Max's request.
  Run id: wf_42ab1a65-163. Script:
  `C:\Users\Max\.claude\projects\C--Users-Max-Desktop-Advanced-Object-Oriented-Programming---F26-\c39faed7-ccd6-48f0-8fd0-932716609930\workflows\scripts\aop-companion-v4-universal-solvers-wf_42ab1a65-163.js`
  Known agent state at stop (from task list): testlab-pne agent finished its
  tasks; designer-logic agent finished core codegen (recipes + timer) but was
  mid-UI work; analyzer-modes / querylab / asynclab final state unknown.
  Files may be partially edited; resumed/re-run agents must read current file
  state first (the specs already mandate this).
- v5 (specs 13-14, project export + polish) NOT started; spec 15 (analyzer
  attribution fixes from Max's real-world test) NOT started.

## Step 1: resume and finish v4
Resume so completed agents come back from cache:
Workflow({ scriptPath: "<v4 script path above>", resumeFromRunId:
"wf_42ab1a65-163" })
It runs: 5 opus builders (07 designer recipes, 08 analyzer modes, 09 testlab
P/N/E, 10 querylab, 11 asynclab) -> integration (12) -> verify loop (suite,
static integrity, registry of 8 tools incl. querylab + asynclab, desk-check
of generated code, equivalence of async output vs the verified ReExam P3
solution). Wait for fully green before step 2.

## Step 2: launch v5 (one new workflow, author it from this recipe)
Phases:
1. "ZipCore": ONE opus agent alone, spec 13 Agent Z section ONLY (new files
   data/projzip-core.js + tests/projzip-core.test.js; e2e: Node-generate a
   sample Avalonia project zip + console zip, Expand-Archive, dotnet build,
   must be green on this machine).
2. "Tools" (parallel, opus, after ZipCore): five agents:
   - designer: specs 13 (its export button) + 14 (its polish section);
     owns designer files only.
   - testlab: specs 13 + 14 for testlab files.
   - querylab: specs 13 + 14 for querylab files.
   - asynclab: specs 13 + 14 for asynclab files.
   - analyzer: spec 15 ONLY (attribution fixes); owns analyzer files.
   Each must e2e-verify its own export (Node zip -> expand -> dotnet build).
3. "Integrate": one opus agent: add projzip-core script tag to index.html
   (before the tool scripts), README update (Export project buttons, polish,
   analyzer attribution fix), extend tests/integration.test.js for the new
   file; full suite green.
4. "Verify" loop (same pattern as the v4 script: VERIFY_SCHEMA, up to 3 fix
   rounds): full suite; static integrity; e2e: designer Summer preset ->
   project zip -> dotnet build green; querylab Summer preset -> console zip
   -> build + run against its sample JSON; asynclab default -> build;
   testlab example -> standalone test project -> dotnet test green; spec 15
   calibration fixture asserts (downcast = DIP primary, presence caveat,
   context-aware fix text).
Copy the v4 script's structure (preamble, REPORT schema, fix loop); change
the builders/phases per the above.

## Step 3: close out
- Run the suite + spot-check yourself; open the app once via
  `Invoke-Item index.html` for Max.
- Update memory: `C:\Users\Max\.claude\projects\C--Users-Max-Desktop-
  Advanced-Object-Oriented-Programming---F26-\memory\` (MEMORY.md index +
  the aop-v3-task-solvers.md file or a successor) with final state.
- Tell Max what to click through (each agent's manual_checks).

## Context for judgment calls
- Everything exists to let Max solve the 4 exam problem types by clicking:
  P1 Analysis Lab, P2 Visual Designer, P3 Test Lab + Async Composer, P4
  Query Lab. When in doubt, choose what scores points in those problems.
- Ground-truth artifacts for codegen calibration: `C:\Users\Max\Desktop\AOP
  Exam Starter Kit` (csproj versions, headless boilerplate) and the verified
  model solutions in `C:\Users\Max\Desktop\AOP Model Solutions` + their
  in-app topics (data/solutions-*.js).
- Max's prose style rules for anything user-facing: no em dashes, no bold,
  plain casual prose.
