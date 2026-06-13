"use strict";
const { test, ok, eq, includes } = require("./t.js");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

/* ---------------- original checks (kept) ---------------- */
test("index.html loads new modules before app.js", () => {
  ["designer-core.js", "designer.js", "analyzer-core.js", "analyzer.js", "quiz-bank.js", "quiz.js"]
    .forEach((f) => includes(html, "data/" + f));
  ok(html.indexOf("data/designer-core.js") < html.indexOf("app.js\""), "order");
  ["designer.css", "analyzer.css", "quiz.css"].forEach((f) => includes(html, f));
});
test("app.js routes tools via the registry (module globals named)", () => {
  ["designer", "analyzer", "quiz"].forEach((r) => includes(app, '"' + r + '"'));
  // registry drives the router now: module names live in TOOLS, render via mod.render()
  ["DESIGNER", "ANALYZER", "TESTLAB", "QUIZ"].forEach((g) => includes(app, '"' + g + '"'));
  includes(app, "mod.render()"); includes(app, "mod.init()");
});
test("nav has Exam Day group", () => includes(app, "Exam Day"));

/* ---------------- integration: script tags exist on disk ---------------- */
function scriptSrcs() {
  const re = /<script src="([^"]+)"><\/script>/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}
function cssHrefs() {
  const re = /<link rel="stylesheet" href="([^"]+)">/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

test("every <script src> in index.html exists on disk", () => {
  scriptSrcs().forEach((src) => {
    ok(fs.existsSync(path.join(root, src)), "missing script file: " + src);
  });
});
test("every <link> stylesheet in index.html exists on disk", () => {
  cssHrefs().forEach((href) => {
    ok(fs.existsSync(path.join(root, href)), "missing css file: " + href);
  });
});

/* ---------------- integration: new wiring present ---------------- */
test("index.html wires testlab + fixtures + both solutions, css linked", () => {
  ["data/testlab-core.js", "data/testlab.js", "data/exam-fixtures.js",
   "data/solutions-summer.js", "data/solutions-reexam.js"].forEach((f) => includes(html, f));
  includes(html, "testlab.css");
  // exam-fixtures right after analyzer scripts; testlab pair before quiz
  ok(html.indexOf("data/analyzer.js") < html.indexOf("data/exam-fixtures.js"), "fixtures after analyzer");
  ok(html.indexOf("data/testlab.js") < html.indexOf("data/quiz-bank.js"), "testlab before quiz");
});
test("app.js has a single TOOLS registry with all nine tools", () => {
  includes(app, "const TOOLS = [");
  ["guide", "lab", "builder", "designer", "analyzer", "testlab", "querylab", "asynclab", "quiz"].forEach((id) => {
    includes(app, '"' + id + '"', "registry id " + id);
  });
  includes(app, "GUIDE"); includes(app, "Exam Guide");
  includes(app, "TESTLAB"); includes(app, "Test Lab");
  includes(app, "QUERYLAB"); includes(app, "Query Lab");
  includes(app, "ASYNCLAB"); includes(app, "Async Composer");
});

test("sidebar order: guide first, then lab..testlab, querylab, asynclab, quiz", () => {
  // the registry array is the single source of truth for sidebar order;
  // guide is the orientation tab and is registered first.
  const order = ["guide", "lab", "builder", "designer", "analyzer", "testlab", "querylab", "asynclab", "quiz"];
  const positions = order.map((id) => app.indexOf('id: "' + id + '"'));
  positions.forEach((p, i) => ok(p > 0, "registry entry present: " + order[i]));
  for (let i = 1; i < positions.length; i++) {
    ok(positions[i - 1] < positions[i], "registry order: " + order[i - 1] + " before " + order[i]);
  }
});

test("index.html wires querylab + asynclab (core before ui), css linked", () => {
  ["data/querylab-core.js", "data/querylab.js", "data/asynclab-core.js", "data/asynclab.js"]
    .forEach((f) => includes(html, f));
  ["querylab.css", "asynclab.css"].forEach((f) => includes(html, f));
  ok(html.indexOf("data/querylab-core.js") < html.indexOf("data/querylab.js"), "querylab core before ui");
  ok(html.indexOf("data/asynclab-core.js") < html.indexOf("data/asynclab.js"), "asynclab core before ui");
  // both ui modules load before app.js
  ok(html.indexOf("data/querylab.js") < html.indexOf("app.js\""), "querylab before app.js");
  ok(html.indexOf("data/asynclab.js") < html.indexOf("app.js\""), "asynclab before app.js");
});

test("index.html wires the guide tool (css linked, script after asynclab, before app.js)", () => {
  includes(html, "data/guide.js", "guide.js script tag present");
  includes(html, "guide.css", "guide.css linked");
  // guide has no core file; its UI script sits with the other tool UI scripts, after asynclab.js
  ok(html.indexOf("data/asynclab.js") < html.indexOf("data/guide.js"), "guide.js loads after asynclab.js");
  ok(html.indexOf("data/guide.js") < html.indexOf("app.js\""), "guide.js loads before app.js");
});
test("Model Solutions category added to CATEGORIES", () => {
  includes(app, '"Model Solutions"');
});

/* ---------------- integration: projzip-core wired before the tools (spec 13) ---- */
test("index.html loads data/projzip-core.js before every export-capable tool", () => {
  includes(html, "data/projzip-core.js");
  // projzip-core defines window.PROJZIP; every tool that exports a project reads
  // that global, so the core must load before all of them (and before app.js).
  const pz = html.indexOf("data/projzip-core.js");
  ok(pz > 0, "projzip-core script tag present");
  ["data/designer.js", "data/analyzer.js", "data/testlab.js",
   "data/querylab.js", "data/asynclab.js"].forEach((tool) => {
    ok(pz < html.indexOf(tool), "projzip-core must load before " + tool);
  });
  ok(pz < html.indexOf("app.js\""), "projzip-core before app.js");
});

test("projzip-core.js is Node-loadable and exposes window.PROJZIP with the scaffold API", () => {
  loadAll(); // mirrors index order; sets global.PROJZIP via the script's side effect
  const Z = global.PROJZIP;
  ok(Z, "window.PROJZIP global is defined");
  ["makeZip", "avaloniaProject", "xunitProject", "consoleProject"].forEach((fn) => {
    ok(typeof Z[fn] === "function", "PROJZIP." + fn + " is a function");
  });
  // a sample scaffold produces real entries (sanity that the global is the live core)
  const entries = Z.avaloniaProject("RectangleUI", {});
  ok(Array.isArray(entries) && entries.length > 0, "avaloniaProject returns entries");
  ok(entries.some((e) => e.path === "RectangleUI.csproj"), "scaffold names the csproj after the project");
});

/* ---------------- load all data modules in Node (mirror index order) ---- */
function loadAll() {
  global.window = global;
  if (!Array.isArray(global.TOPICS)) global.TOPICS = [];
  scriptSrcs().filter((s) => s.indexOf("data/") === 0).forEach((s) => {
    require(path.join(root, s));
  });
}

test("module globals are defined by their files (registry contract)", () => {
  loadAll();
  // tools that declare a module global in the registry must expose {render, init}
  const moduleByTool = {
    guide: "GUIDE", designer: "DESIGNER", analyzer: "ANALYZER", testlab: "TESTLAB",
    querylab: "QUERYLAB", asynclab: "ASYNCLAB", quiz: "QUIZ",
  };
  Object.keys(moduleByTool).forEach((toolId) => {
    const g = global[moduleByTool[toolId]];
    ok(g, toolId + " global " + moduleByTool[toolId] + " is defined");
    ok(typeof g.render === "function", moduleByTool[toolId] + ".render");
    ok(typeof g.init === "function", moduleByTool[toolId] + ".init");
  });
  // the two new cores must also expose their public API
  ok(global.QUERYLAB_CORE && typeof global.QUERYLAB_CORE.generateProgram === "function", "QUERYLAB_CORE.generateProgram");
  ok(global.ASYNCLAB_CORE && typeof global.ASYNCLAB_CORE.generate === "function", "ASYNCLAB_CORE.generate");
  // lab + builder back the inline renderers
  ok(Array.isArray(global.LAB_FILES), "LAB_FILES");
  ok(global.BUILDER && typeof global.BUILDER.generate === "function", "BUILDER.generate");
});

test("no duplicate TOOL_TOPICS ids in app.js search index", () => {
  // pull every `id: "..."` inside the TOOL_TOPICS .concat([...]) literal
  const start = app.indexOf("const TOOL_TOPICS");
  const end = app.indexOf("let _deepSearchBuilt", start);
  const block = app.slice(start, end);
  const re = /id:\s*"([^"]+)"/g;
  const ids = [];
  let m;
  while ((m = re.exec(block))) ids.push(m[1]);
  const seen = {};
  const dups = [];
  ids.forEach((id) => { if (seen[id]) dups.push(id); seen[id] = 1; });
  eq(dups.join(", "), "", "duplicate TOOL_TOPICS ids");
  ["querylab", "asynclab"].forEach((id) => ok(ids.includes(id), "TOOL_TOPICS has " + id));
});

/* ---------------- categories / topics integrity ---------------- */
const CATEGORY_NAMES = (function () {
  // pull the CATEGORIES name strings straight out of app.js source
  const block = app.slice(app.indexOf("const CATEGORIES = ["), app.indexOf("];", app.indexOf("const CATEGORIES = [")));
  const re = /name:\s*"([^"]+)"/g;
  const out = [];
  let m;
  while ((m = re.exec(block))) out.push(m[1]);
  return out;
})();

test("CATEGORIES parsed from app.js (sanity)", () => {
  ok(CATEGORY_NAMES.length >= 16, "expected >=16 categories, got " + CATEGORY_NAMES.length);
  ok(CATEGORY_NAMES.includes("Model Solutions"), "Model Solutions in CATEGORIES");
});

test("every CATEGORIES name has >= 1 topic", () => {
  loadAll();
  CATEGORY_NAMES.forEach((name) => {
    const n = global.TOPICS.filter((t) => t.cat === name).length;
    ok(n >= 1, "category with no topics: " + name);
  });
});

test("no topic cat is missing from CATEGORIES", () => {
  loadAll();
  const set = new Set(CATEGORY_NAMES);
  const orphans = [...new Set(global.TOPICS.map((t) => t.cat))].filter((c) => !set.has(c));
  eq(orphans.join(", "), "", "topic cats absent from CATEGORIES");
});

test("no duplicate topic ids across ALL data files", () => {
  loadAll();
  const seen = {};
  const dups = [];
  global.TOPICS.forEach((t) => { if (seen[t.id]) dups.push(t.id); seen[t.id] = 1; });
  eq(dups.join(", "), "", "duplicate topic ids");
});

test("both 2025 solution files use cat 'Model Solutions'", () => {
  loadAll();
  const sols = global.TOPICS.filter((t) => /^sol-(summer|reexam)-p\d$/.test(t.id));
  ok(sols.length === 8, "expected 8 solution topics, got " + sols.length);
  sols.forEach((t) => eq(t.cat, "Model Solutions", "solution cat for " + t.id));
});

/* ---------------- hash route whitelist ---------------- */
test("all required hash routes are recognized by routeExists logic", () => {
  loadAll();
  // mirror app.js: TOOL_IDS + lab/<id> + topics + home
  const TOOL_IDS = ["guide", "lab", "builder", "designer", "analyzer", "testlab", "querylab", "asynclab", "quiz"];
  const labOk = (id) => id.indexOf("lab/") === 0 && !!global.LAB_FILES.find((f) => "lab/" + f.id === id);
  const routeExists = (id) => !id || id === "home" || TOOL_IDS.includes(id) ||
    labOk(id) || !!global.TOPICS.find((t) => t.id === id);
  ["home", "guide", "lab", "builder", "designer", "analyzer", "testlab", "querylab", "asynclab", "quiz"].forEach((r) => {
    ok(routeExists(r), "route should exist: " + r);
  });
  // a real lab/<id> route
  ok(routeExists("lab/" + global.LAB_FILES[0].id), "lab/<id> route");
  // and these must all be present in the app.js TOOLS registry source
  TOOL_IDS.forEach((id) => includes(app, '"' + id + '"', "registry has " + id));
});

/* ================================================================
   spec 16: flat 6-file submission export wiring (integration agent)
   The professor's final deliverable is a flat folder of exactly 6 files
   with EXACT names. Three tool UI files each own one or two of those names
   and wire a "Download submission files" action. The integration check here
   asserts that wiring is present on disk (grep the exact file names), that
   the look + the flat-folder hint line are consistent across tools, and that
   the three cores actually emit those files with allowed-libraries-only
   usings (a cross-tool sanity beyond each tool's own core tests).
   ================================================================ */

/* the six file names the grader expects, mapped to the tool UI that emits them */
const SUBMISSION_FILES = {
  "data/designer.js":  ["Problem_2_MainWindow.axaml", "Problem_2_MainWindowViewModel.cs"],
  "data/asynclab.js":  ["Problem_3_MainWindowViewModel.cs", "Problem_3_MainWindow.axaml"],
  "data/querylab.js":  ["Problem_4_Program.cs", "Problem_4_Models.cs"],
};
const ALL_SIX = Object.keys(SUBMISSION_FILES).reduce((a, k) => a.concat(SUBMISSION_FILES[k]), []);
const toolUI = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

test("each tool UI file wires its exact submission file names (spec 16)", () => {
  Object.keys(SUBMISSION_FILES).forEach((rel) => {
    const src = toolUI(rel);
    SUBMISSION_FILES[rel].forEach((name) => {
      includes(src, name, rel + " must reference the exact submission file name " + name);
    });
  });
});

test("the six submission file names are exactly the professor's flat set", () => {
  const expected = [
    "Problem_2_MainWindow.axaml", "Problem_2_MainWindowViewModel.cs",
    "Problem_3_MainWindowViewModel.cs", "Problem_3_MainWindow.axaml",
    "Problem_4_Program.cs", "Problem_4_Models.cs",
  ];
  eq(ALL_SIX.slice().sort().join("|"), expected.slice().sort().join("|"), "exact 6-file set");
  // P1 (analysis) has NO file in the submission set — make sure no tool emits one
  Object.keys(SUBMISSION_FILES).forEach((rel) => {
    const src = toolUI(rel);
    ok(src.indexOf("Problem_1_") === -1, rel + " must not emit a Problem_1 submission file");
  });
});

test("every tool exposes a 'Download submission files' action + the flat-folder hint", () => {
  Object.keys(SUBMISSION_FILES).forEach((rel) => {
    const src = toolUI(rel);
    includes(src, "Download submission files", rel + " has the submission button label");
    // the shared hint line is identical across tools (plain prose, professor's rule)
    includes(src, "submit flat: 6 files, no bin/obj, no subfolders", rel + " has the flat-folder hint");
    // each tool's button calls a handler named downloadSubmission/exportSubmission
    ok(/(downloadSubmission|exportSubmission)\s*\(/.test(src),
      rel + " wires an onclick to a submission handler");
  });
});

test("submission download must NOT depend on window.PROJZIP (plain blobs, spec 16 rule 5)", () => {
  // the three submission handlers download plain text blobs; the project .zip
  // export is the only PROJZIP consumer. Assert the submission code paths read
  // their cores, not PROJZIP, so the deliverable works with projzip absent.
  Object.keys(SUBMISSION_FILES).forEach((rel) => {
    const src = toolUI(rel);
    // pull the submission handler body and confirm it does not call PROJZIP.makeZip
    const idx = src.search(/(downloadSubmission|exportSubmission)\s*[:=]/);
    ok(idx > 0, rel + " defines a submission handler");
    const body = src.slice(idx, idx + 1500);
    ok(body.indexOf("PROJZIP") === -1 && body.indexOf("makeZip") === -1,
      rel + " submission handler must not use PROJZIP/makeZip");
  });
});

/* allowed-libraries gate, applied uniformly across all three cores: a using
   directive may only reference System*, Avalonia*, or CommunityToolkit.Mvvm*. */
function foreignUsingsIn(code) {
  const out = [];
  (String(code).match(/^\s*using\s+(?:static\s+)?([A-Za-z_][\w.]*)\s*;/gm) || []).forEach((line) => {
    const ns = line.replace(/^\s*using\s+(?:static\s+)?/, "").replace(/\s*;\s*$/, "");
    const allowed = /^System(\.|$)/.test(ns) || /^Avalonia(\.|$)/.test(ns) ||
                    /^CommunityToolkit\.Mvvm(\.|$)/.test(ns);
    if (!allowed) out.push(ns);
  });
  return out;
}

test("the three cores emit submission files with allowed-libraries-only usings", () => {
  loadAll();
  // Designer (Problem 2): build a small canvas tree, get the inlined VM + axaml
  const DC = global.DESIGNER_CORE;
  ok(DC && typeof DC.submission === "function", "DESIGNER_CORE.submission present");
  const tree = DC.createNode("Window");
  const canvas = DC.createNode("Canvas"); DC.addChild(tree, tree.id, canvas);
  const rect = DC.createNode("Rectangle"); rect.x = 10; rect.y = 10; DC.addChild(tree, canvas.id, rect);
  const dsub = DC.submission(tree);
  const dsubNames = dsub.files.map((f) => f.name);
  ok(dsubNames.indexOf("Problem_2_MainWindow.axaml") !== -1, "designer emits Problem_2_MainWindow.axaml");
  ok(dsubNames.indexOf("Problem_2_MainWindowViewModel.cs") !== -1, "designer emits Problem_2_MainWindowViewModel.cs");
  eq(foreignUsingsIn(dsub.viewModel).join(", "), "", "designer submission VM foreign usings");

  // Async Composer (Problem 3): default config pair
  const AC = global.ASYNCLAB_CORE;
  ok(AC && typeof AC.generateSubmission === "function", "ASYNCLAB_CORE.generateSubmission present");
  const apair = AC.generateSubmission(AC.defaultConfig());
  eq(apair.map((f) => f.fileName).sort().join("|"),
     ["Problem_3_MainWindow.axaml", "Problem_3_MainWindowViewModel.cs"].sort().join("|"),
     "asynclab emits the Problem_3 pair");
  apair.forEach((f) => eq(foreignUsingsIn(f.code).join(", "), "", "asynclab " + f.fileName + " foreign usings"));

  // Query Lab (Problem 4): two-file split from each 2025 preset
  const QC = global.QUERYLAB_CORE;
  ok(QC && typeof QC.generateSubmissionFromPreset === "function", "QUERYLAB_CORE.generateSubmissionFromPreset present");
  ["summer", "reexam"].forEach((key) => {
    const preset = QC.presets()[key];
    const r = QC.generateSubmissionFromPreset(preset);
    ok(r.ok, "querylab " + key + " submission ok");
    eq(foreignUsingsIn(r.program).join(", "), "", "querylab " + key + " Program.cs foreign usings");
    eq(foreignUsingsIn(r.models).join(", "), "", "querylab " + key + " Models.cs foreign usings");
    // both flat files share ONE namespace so they compile together (no third file)
    const pns = (r.program.match(/namespace\s+(\S+)\s*;/) || [])[1];
    const mns = (r.models.match(/namespace\s+(\S+)\s*;/) || [])[1];
    ok(pns && pns === mns, "querylab " + key + " Program/Models share a namespace (" + pns + " vs " + mns + ")");
  });
});

test("submission pairs stay internally consistent (axaml x:Class matches VM namespace)", () => {
  loadAll();
  // Async Composer is the clearest case: a complete Window axaml whose x:Class +
  // xmlns:vm must line up with the VM's ExamApp.* namespaces (Starter Kit shape).
  const AC = global.ASYNCLAB_CORE;
  const [vm, axaml] = AC.generateSubmission(AC.defaultConfig());
  includes(vm.code, "namespace ExamApp.ViewModels", "async VM uses ExamApp.ViewModels");
  includes(axaml.code, 'x:Class="ExamApp.Views.MainWindow"', "async axaml x:Class is ExamApp.Views.MainWindow");
  // xmlns:vm must point at the VM namespace; Avalonia accepts using: or clr-namespace:
  ok(/xmlns:vm="(using:ExamApp\.ViewModels|clr-namespace:ExamApp\.ViewModels)"/.test(axaml.code),
    "async axaml xmlns:vm points at the VM namespace");
});

/* the README the app links must teach the flat-folder submission rules */
test("README documents the professor's flat 6-file submission format", () => {
  const runbook = fs.readFileSync(path.join(root, "README-EXAM-DAY.md"), "utf8");
  // the exact 6 names appear in the runbook so Max can eyeball the folder
  ALL_SIX.forEach((name) => includes(runbook, name, "runbook lists " + name));
  // the flat-folder rules + allowed libraries line are spelled out
  includes(runbook, "no subfolders", "runbook states the no-subfolders rule");
  ["System", "Avalonia", "CommunityToolkit.Mvvm"].forEach((lib) =>
    includes(runbook, lib, "runbook names allowed library " + lib));
  // and the tool->file mapping is taught (which button makes which file)
  ["Visual Designer", "Async Composer", "Query Lab"].forEach((tool) =>
    includes(runbook, tool, "runbook maps tool " + tool + " to its submission files"));
});

/* ================================================================
   spec 19: the sim-gap fixes are surfaced lightly in README.txt. The
   integration agent adds one sentence to each of the Query Lab, Visual
   Designer, and Test Lab tool paragraphs describing the new native
   capability the fix agents shipped, so a reader of README.txt learns the
   tool now does it. Pin those sentences so the prose cannot drift back.
   ================================================================ */
test("README.txt surfaces the spec-19 Query Lab null/type-aware filters", () => {
  const readme = fs.readFileSync(path.join(root, "README.txt"), "utf8");
  includes(readme, "x.Field == null", "README names the is-empty/missing == null emit");
  includes(readme, "t.Year == 2245", "README names the bare int nested-Any literal");
  includes(readme, "compound AND", "README names the compound AND combinator");
  includes(readme, "above-average can exclude nulls", "README names the exclude-null average");
});

test("README.txt surfaces the spec-19 Designer item shapes + multi-select", () => {
  const readme = fs.readFileSync(path.join(root, "README.txt"), "utf8");
  includes(readme, "Ellipse or Rectangle template", "README names the item shape template");
  includes(readme, "SelectedItems for multi-select", "README names SelectedItems multi-select");
  includes(readme, "vm:Outer+Inner", "README names the nested-model qualified DataType");
});

test("README.txt surfaces the spec-19 Test Lab real-control headless test", () => {
  const readme = fs.readFileSync(path.join(root, "README.txt"), "utf8");
  includes(readme, "FindControl<Button>", "README names FindControl<Button>");
  includes(readme, "FindControl<TextBlock>", "README names FindControl<TextBlock>");
  // it explicitly contrasts with the old bare command call
  includes(readme, "no more calling vm.Command.Execute directly",
    "README contrasts with the old bare command call");
});
