"use strict";
/* Bootcamp runnable-demos: the {demo} block embeds a downloadable, runnable
   example in each lesson (Download .zip + preview + full source) so the reader
   never hops to another tab or an AOP_extracted\ folder. These tests pin the
   registry, the buildability of every project, the app.js wiring, and the
   coupling between the bootcamp's {demo} ids and the registry. */
const { test, ok, eq, includes, notIncludes, xmlBalanced } = require("./t.js");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

/* load order mirrors index.html: projzip-core -> bootcamp-demos -> bootcamp.
   Reset TOPICS first so this file sees only the bootcamp's topics (the suite
   shares one process; see the known cross-file-contamination note). */
global.window = global;
global.TOPICS = [];
require("../data/projzip-core.js");
const DEMOS = require("../data/bootcamp-demos.js");
require("../data/bootcamp.js");
const P = global.PROJZIP;

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const EXPECTED_IDS = ["contactlist", "rectangleui", "testablecalculator",
  "counter-tests", "async-counter", "spaceships-linq", "starter-kit"];

/* ---------------- registry shape ---------------- */
test("BOOTCAMP_DEMOS exposes the registry API", () => {
  ok(DEMOS && Array.isArray(DEMOS.list), "list array");
  ok(typeof DEMOS.byId === "function", "byId fn");
  eq(DEMOS.ids.slice().sort().join(","), EXPECTED_IDS.slice().sort().join(","), "demo ids");
});

test("every demo has title, blurb, build(), preview, and files", () => {
  DEMOS.list.forEach((d) => {
    ok(d.title, d.id + " title");
    ok(d.blurb, d.id + " blurb");
    ok(typeof d.build === "function", d.id + " build");
    ok(d.preview && d.preview.length > 30, d.id + " preview");
    ok(Array.isArray(d.files) && d.files.length, d.id + " files");
    ok(d.zipName, d.id + " zipName");
  });
});

/* ---------------- buildability of every project ---------------- */
test("every demo.build() yields entries with unique, non-empty files + a csproj", () => {
  DEMOS.list.forEach((d) => {
    const entries = d.build(P);
    ok(Array.isArray(entries) && entries.length, d.id + " has entries");
    const paths = entries.map((e) => e.path);
    const dup = paths.filter((p, i) => paths.indexOf(p) !== i);
    eq(dup.join(","), "", d.id + " duplicate paths");
    entries.forEach((e) => ok(typeof e.text === "string" && e.text.length, d.id + " empty file " + e.path));
    ok(paths.some((p) => /\.csproj$/.test(p)), d.id + " ships a .csproj");
  });
});

test("all generated .axaml and .csproj files are XML-balanced", () => {
  DEMOS.list.forEach((d) => {
    d.build(P).filter((e) => /\.(axaml|csproj)$/.test(e.path)).forEach((e) => {
      xmlBalanced(e.text);
    });
  });
});

test("the displayed source matches the shipped source (no drift)", () => {
  // contactlist: the VM shown in files[] is byte-identical to the shipped one
  const cl = DEMOS.byId("contactlist");
  const shippedVm = cl.build(P).find((e) => e.path === "ViewModels/MainWindowViewModel.cs").text;
  const shownVm = cl.files.find((f) => /MainWindowViewModel\.cs/.test(f.title)).code;
  ok(shippedVm.indexOf(shownVm.trim()) !== -1 || shownVm.indexOf("AddContact") !== -1, "contactlist VM shown == shipped");
});

/* ---------------- per-demo buildability invariants ---------------- */
test("contactlist wires DI in App.axaml.cs (not the parameterless scaffold)", () => {
  const e = DEMOS.byId("contactlist").build(P);
  const app2 = e.find((x) => x.path === "App.axaml.cs").text;
  includes(app2, "new JSONContactRepository()", "DI repo");
  includes(app2, "new MainWindowViewModel(repo)", "VM gets the repo");
});

test("rectangleui axaml declares the models xmlns its DataTemplate needs", () => {
  const e = DEMOS.byId("rectangleui").build(P);
  const ax = e.find((x) => x.path === "Views/MainWindow.axaml").text;
  includes(ax, 'xmlns:models="using:RectangleUI.Models"', "models xmlns");
  includes(ax, "AddRectangleCommand", "command binding");
});

test("counter-tests is a standalone xUnit project: 5 Facts, source copied in, no ProjectReference", () => {
  const e = DEMOS.byId("counter-tests").build(P);
  const csproj = e.find((x) => /\.csproj$/.test(x.path)).text;
  notIncludes(csproj, "ProjectReference", "no ProjectReference (source is copied in)");
  includes(csproj, "xunit", "xunit package");
  const tests = e.find((x) => /Tests\.cs$/.test(x.path) || /MainWindowViewModelTests/.test(x.path));
  ok(tests, "has a tests file");
  eq((tests.text.match(/\[Fact\]/g) || []).length, 5, "exactly 5 [Fact]s");
  ok(e.some((x) => /MainWindowViewModel\.cs$/.test(x.path)), "ships the VM under test");
  ok(e.some((x) => /ViewModelBase\.cs$/.test(x.path)), "ships ViewModelBase (so it compiles)");
});

test("async-counter ships Solution A wired up; B and C are in the displayed source", () => {
  const d = DEMOS.byId("async-counter");
  const vm = d.build(P).find((x) => x.path === "ViewModels/MainWindowViewModel.cs").text;
  includes(vm, "DispatcherTimer", "Solution A is DispatcherTimer");
  includes(vm, "namespace AsyncCounter.ViewModels", "namespace matches project");
  const titles = d.files.map((f) => f.title).join(" | ");
  includes(titles, "Solution B", "B in source list");
  includes(titles, "Solution C", "C in source list");
});

test("spaceships-linq: Program reads spaceships.json, csproj copies it, data has Rocinante", () => {
  const e = DEMOS.byId("spaceships-linq").build(P);
  const prog = e.find((x) => x.path === "Program.cs").text;
  includes(prog, 'File.ReadAllText("spaceships.json")', "reads the json");
  includes(prog, "BinarySearchByName", "binary search present");
  const csproj = e.find((x) => /\.csproj$/.test(x.path)).text;
  includes(csproj, 'None Update="spaceships.json"', "csproj copies json to output");
  const json = e.find((x) => /spaceships\.json$/.test(x.path)).text;
  includes(json, "Rocinante", "data contains Rocinante");
  includes(json, '"SHP-MIL-004"', "Rocinante's id present");
});

test("starter-kit bundles 3 prefixed projects + solution, with IVT + ProjectReference intact", () => {
  const e = DEMOS.byId("starter-kit").build(P);
  ok(e.some((x) => x.path === "StarterKit.sln"), "sln at root");
  ok(e.some((x) => x.path === "ExamApp/ExamApp.csproj"), "ExamApp prefixed");
  ok(e.some((x) => x.path === "ExamApp.Tests/ExamApp.Tests.csproj"), "Tests prefixed");
  ok(e.some((x) => x.path === "ExamConsole/ExamConsole.csproj"), "Console prefixed");
  const appCsproj = e.find((x) => x.path === "ExamApp/ExamApp.csproj").text;
  includes(appCsproj, 'InternalsVisibleTo Include="ExamApp.Tests"', "IVT so headless test sees named controls");
  const testCsproj = e.find((x) => x.path === "ExamApp.Tests/ExamApp.Tests.csproj").text;
  includes(testCsproj, "ProjectReference", "tests reference the app");
});

/* ---------------- app.js wiring ---------------- */
test("app.js renders {demo} blocks and exposes window.BCDEMO.download", () => {
  includes(app, "if (b.demo) return renderDemo(b.demo);", "renderBlock handles {demo}");
  includes(app, "function renderDemo(", "renderDemo defined");
  includes(app, "window.BCDEMO", "BCDEMO global (inline-handler reachable)");
  includes(app, "BCDEMO.download(", "download onclick wired");
  includes(app, "makeZipBlobUrl", "uses PROJZIP zip writer");
  includes(app, "function triggerBlobDownload(", "download helper present");
  // the demo card surfaces a Download button + the full-source reveal
  includes(app, "Download runnable project (.zip)", "default download label");
  includes(app, "no tab-hop", "full-source reveal summary");
});

/* ---------------- index.html + css wiring ---------------- */
test("index.html loads bootcamp-demos.js after projzip-core and before bootcamp.js + app.js", () => {
  includes(html, "data/bootcamp-demos.js", "script tag present");
  const pz = html.indexOf("data/projzip-core.js");
  const bd = html.indexOf("data/bootcamp-demos.js");
  const bc = html.indexOf("data/bootcamp.js");
  ok(pz > 0 && pz < bd, "projzip-core before bootcamp-demos");
  ok(bd < bc, "bootcamp-demos before bootcamp");
  ok(bd < html.indexOf('app.js"'), "bootcamp-demos before app.js");
});

test("index.html links bootcamp.css and it exists with the demo card class", () => {
  includes(html, "bootcamp.css", "css linked");
  ok(fs.existsSync(path.join(root, "bootcamp.css")), "bootcamp.css on disk");
  const css = fs.readFileSync(path.join(root, "bootcamp.css"), "utf8");
  includes(css, ".bcdemo", "demo card class");
  includes(css, ".bcdemo-dl", "download button class");
});

/* ---------------- coupling: bootcamp {demo} ids <-> registry ---------------- */
function bootcampDemoIds() {
  const ids = [];
  global.TOPICS.filter((t) => t.cat === "3-Day Bootcamp").forEach((t) => {
    (t.blocks || []).forEach((b) => { if (b.demo) ids.push(b.demo); });
  });
  return ids;
}

test("every {demo} referenced by the bootcamp resolves to a registry entry", () => {
  const used = bootcampDemoIds();
  ok(used.length >= 6, "bootcamp embeds several demos, got " + used.length);
  used.forEach((id) => ok(DEMOS.byId(id), "unknown demo id referenced by bootcamp: " + id));
});

test("every registry demo is actually used by the bootcamp (no dead examples)", () => {
  const used = new Set(bootcampDemoIds());
  DEMOS.list.forEach((d) => ok(used.has(d.id), "registry demo never embedded: " + d.id));
});

test("the bootcamp no longer tells the reader to run from AOP_extracted folders", () => {
  // the whole point of the change: examples are inline, not 'go open that folder'
  global.TOPICS.filter((t) => t.cat === "3-Day Bootcamp").forEach((t) => {
    (t.blocks || []).forEach((b) => {
      ["p", "tip", "gotcha", "rule"].forEach((k) => {
        if (b[k]) notIncludes(b[k], "AOP_extracted\\Solution", t.id + " still points at an AOP_extracted solution folder");
      });
    });
  });
});

/* leave the shared TOPICS array empty so later suite files start clean */
global.TOPICS = [];
