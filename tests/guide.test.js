"use strict";
const { test, eq, ok, includes, notIncludes } = require("./t.js");

/* The guide module is UI-only (no core file). It must load under Node without a
   real DOM: render() only builds a string, document access lives inside copy
   handlers. We provide window/globalThis via the module's own IIFE fallback. */
const GUIDE = require("../data/guide.js");

/* The six exact submission file names from spec 16, in folder order. */
const SUBMISSION_FILES = [
  "Problem_2_MainWindowViewModel.cs",
  "Problem_2_MainWindow.axaml",
  "Problem_3_MainWindowViewModel.cs",
  "Problem_3_MainWindow.axaml",
  "Problem_4_Program.cs",
  "Problem_4_Models.cs",
];

/* the go() tool links the spec requires to be present */
const REQUIRED_GO_TOOLS = ["analyzer", "designer", "asynclab", "testlab", "querylab"];

/* count non-overlapping occurrences of needle in haystack */
function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let n = 0, i = 0;
  while (true) {
    const at = haystack.indexOf(needle, i);
    if (at === -1) break;
    n++; i = at + needle.length;
  }
  return n;
}

/* simplified div-tag balance, mirroring the xmlBalanced-style helpers the other
   suites use: walk <div...> and </div> tags, push/pop, assert a clean stack.
   Self-closing divs are not used in this HTML, so any <div...> opens one level. */
function divBalanced(html) {
  let depth = 0;
  const re = /<(\/?)div\b[^>]*?(\/?)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const closing = m[1] === "/";
    const selfClose = m[2] === "/";
    if (closing) { depth--; if (depth < 0) throw new Error("divBalanced: extra </div>"); }
    else if (!selfClose) depth++;
  }
  if (depth !== 0) throw new Error("divBalanced: unbalanced div depth " + depth);
  return true;
}

/* ============ module shape ============ */
test("GUIDE global exists with render() returning a meaningful string", () => {
  ok(GUIDE && typeof GUIDE.render === "function", "GUIDE.render must be a function");
  ok(typeof GUIDE.init === "function", "GUIDE.init must be a function");
  const html = GUIDE.render();
  ok(typeof html === "string", "render() returns a string");
  ok(html.length > 1500, "render() returns a string of meaningful length, got " + html.length);
});

/* extract the submission folder manifest block (the canonical six-file listing) */
function folderBlock(html) {
  const start = html.indexOf('<div class="gd-folder">');
  ok(start !== -1, "submission folder block must exist");
  const end = html.indexOf("</ul></div>", start);
  ok(end !== -1, "submission folder block must close");
  return html.slice(start, end);
}

/* ============ submission file names: verbatim, exactly once each, in the section ============
   Spec: all six names appear verbatim, exactly once each, in the submission section
   (the manifest list). The P3 name legitimately recurs in the filename-trap prose,
   so the once-each assertion is scoped to the manifest block. */
test("all six submission file names appear verbatim exactly once each in the manifest", () => {
  const block = folderBlock(GUIDE.render());
  SUBMISSION_FILES.forEach((name) => {
    const n = countOccurrences(block, name);
    eq(n, 1, "submission file " + name + " must appear exactly once in the manifest");
  });
});

/* every name also appears somewhere in the full output (sanity) */
test("every submission file name appears in the rendered output", () => {
  const html = GUIDE.render();
  SUBMISSION_FILES.forEach((name) => includes(html, name, name + " missing from output"));
});

/* the names live in the submission section (the gd-folder list) */
test("submission file names render inside the submission folder block", () => {
  const html = GUIDE.render();
  includes(html, '<div class="gd-folder">', "submission folder block present");
  includes(html, "AOP_Exam_Submission/", "the flat folder name is shown");
  SUBMISSION_FILES.forEach((name) => {
    includes(html, '<li class="gd-folder-file">' + name + "</li>",
      name + " shown as a folder file item");
  });
});

/* ============ go() links for the five tools ============ */
test("go() links exist for analyzer, designer, asynclab, testlab, querylab", () => {
  const html = GUIDE.render();
  REQUIRED_GO_TOOLS.forEach((tool) => {
    includes(html, "go('" + tool + "')", "go() link for " + tool + " missing");
  });
});

/* ============ both verify scripts named ============ */
test("verify-exam-env.ps1 and verify-submission.ps1 both appear", () => {
  const html = GUIDE.render();
  includes(html, "verify-exam-env.ps1", "minute-zero env check script missing");
  includes(html, "verify-submission.ps1", "submission verifier script missing");
  /* the command must use the professor's F26 profile, not a 2025 one */
  includes(html, "-Variant f26", "submission verify must use the f26 profile");
});

/* ============ supporting cast section ============ */
test("supporting cast links builder, lab and quiz and names the LINQ topics", () => {
  const html = GUIDE.render();
  ["builder", "lab", "quiz"].forEach((id) => {
    includes(html, "go('" + id + "')", "supporting-cast go() link for " + id);
  });
  includes(html, "UI Builder", "UI Builder named");
  includes(html, "Code Lab", "Code Lab named");
  includes(html, "LINQ category", "LINQ reference topics named");
  /* the offline-feed fallback is mentioned too */
  includes(html, "make-offline-feed.ps1", "offline-feed builder missing");
  includes(html, "nuget.offline.config", "offline config path missing");
});

/* ============ the P3 filename trap ============ */
test("P3 trap names Problem_3_MainWindowViewModel.cs as the file to use", () => {
  const html = GUIDE.render();
  includes(html, '<div class="gd-trap">', "trap callout present");
  includes(html, "Problem_3_MainWindowViewModel.cs", "the manifest filename is named");
  /* it warns against trusting the prose's AutoCounterViewModel.cs */
  includes(html, "AutoCounterViewModel.cs", "the wrong (prose) name is shown as the trap");
  includes(html, "manifest", "the rule references the submission manifest");
});

/* ============ style rules: no em dash, no bold tags, no markdown bold ============ */
test("output has no em dash, no <b>/<strong> tags, no markdown ** bold", () => {
  const html = GUIDE.render();
  notIncludes(html, "—", "no em dash character allowed");
  notIncludes(html, "<b>", "no <b> tag allowed (style rule)");
  notIncludes(html, "</b>", "no closing </b> tag allowed");
  notIncludes(html, "<strong", "no <strong> tag allowed");
  notIncludes(html, "**", "no markdown ** bold markers allowed");
});

/* the crumb uses <b>EXAM GUIDE</b> only as the shell convention? No: spec forbids
   <b> in the guide output. Confirm the crumb is plain text, not a bold tag. */
test("crumb label is plain, not wrapped in a bold tag", () => {
  const html = GUIDE.render();
  includes(html, "EXAM GUIDE", "crumb label present");
  notIncludes(html, "<b>EXAM GUIDE", "crumb must not use a <b> tag");
});

/* ============ time budgets ============ */
test("time budgets 45/75/45/60/15 all present", () => {
  const html = GUIDE.render();
  ["45 min", "75 min", "45 min", "60 min", "15 min"].forEach((b) => {
    includes(html, b, "time budget " + b + " missing");
  });
});

/* ============ HTML sanity: div balance ============ */
test("HTML sanity: div tags are balanced", () => {
  divBalanced(GUIDE.render());
});

/* ============ content coverage the spec calls for ============ */
test("the four play tool cards and the two-button rule are present", () => {
  const html = GUIDE.render();
  /* the hero play cards link to all four problem tools */
  includes(html, "Analysis Lab", "P1 play");
  includes(html, "Visual Designer", "P2 play");
  includes(html, "Async Composer", "P3 play");
  includes(html, "Query Lab", "P4 play");
  /* the two-button rule, stated once */
  includes(html, "Export project (.zip)", "the build button rule");
  includes(html, "Download submission files", "the submission button rule");
});

test("hero maps each problem to its tool and Test Lab is the P3 self-check", () => {
  const html = GUIDE.render();
  includes(html, "go('testlab')", "Test Lab go() link present for the P3 self-check");
  includes(html, "self-check", "Test Lab framed as the self-check");
});

/* ============ Node-loadable + render is idempotent (no throw on repeat) ============ */
test("render() is pure and repeatable (no document access at render time)", () => {
  const a = GUIDE.render();
  const b = GUIDE.render();
  eq(a, b, "render() is deterministic");
});

/* run standalone: `node tests/guide.test.js` prints the summary and exits.
   Under the auto-discovering runner this require is a no-op (summary runs once
   at the end), so guarding on require.main keeps the shared accumulator intact. */
if (require.main === module) require("./t.js").summary();
