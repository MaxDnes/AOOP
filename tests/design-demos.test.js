"use strict";
/* Design Gallery runnable projects (data/design-demos.js): every gallery topic
   ships ONE complete, instantly-runnable Avalonia project whose ViewModel backs
   every binding in the view. This pins that contract so a future edit can't ship
   a demo that won't build or whose bindings dangle. */
const { test, eq, ok, includes } = require("./t.js");
const fs = require("fs");

global.window = global;
const P = require("../data/projzip-core.js");      // window.PROJZIP
const D = require("../data/design-demos.js");       // window.DESIGN_DEMOS

/* gallery topic ids come from the content module; reset TOPICS around the load
   so the shared global stays clean for other test files (integration.test.js). */
global.TOPICS = [];
require("../data/design.js");
const GALLERY_IDS = global.TOPICS.filter((t) => t.cat === "Design Gallery").map((t) => t.id);
global.TOPICS = [];

/* --- the binding/member resolver: every {Binding root} must exist on the VM --- */
function vmMembers(vm) {
  const set = new Set();
  let m;
  const op = /\[ObservableProperty\][\s\S]*?(?:private|protected|public)\s+[\w<>?\[\],\s]+?\s+(\w+)\s*[;=]/g;
  while ((m = op.exec(vm))) { const f = m[1].replace(/^_/, ""); set.add(f.charAt(0).toUpperCase() + f.slice(1)); }
  const rc = /\[RelayCommand\][\s\S]*?(?:private|public|protected)\s+(?:async\s+)?[\w<>?\[\],\s]+?\s+(\w+)\s*\(/g;
  while ((m = rc.exec(vm))) set.add(m[1] + "Command");
  const pp = /public\s+[\w<>?\[\],\s]+?\s+(\w+)\s*(?:\{|=>)/g;
  while ((m = pp.exec(vm))) set.add(m[1]);
  return set;
}
function bindingRoots(axaml) {
  return [...new Set([...axaml.matchAll(/\{Binding\s+([^},]+)/g)]
    .map((x) => x[1].trim().split(".")[0].trim())
    .filter(Boolean))];
}

test("every Design Gallery topic has a runnable demo", () => {
  ok(GALLERY_IDS.length >= 12, "found the gallery topics: " + GALLERY_IDS.length);
  GALLERY_IDS.forEach((id) => ok(D.byId[id], "missing demo for gallery topic " + id));
});

test("every demo builds a complete, runnable Avalonia project (.zip)", () => {
  D.demos.forEach((d) => {
    const entries = D.buildProject(P, d.id);
    ok(entries && entries.length >= 8, d.id + " produced a full project");
    const paths = entries.map((e) => e.path);
    ["Program.cs", "App.axaml", "Views/MainWindow.axaml", "ViewModels/MainWindowViewModel.cs"]
      .forEach((p) => ok(paths.indexOf(p) !== -1, d.id + " has " + p));
    ok(P.makeZip(entries).length > 200, d.id + " zips");
  });
});

test("every binding in every demo view resolves to a ViewModel member", () => {
  D.demos.forEach((d) => {
    const members = vmMembers(d.viewModel);
    const missing = bindingRoots(d.axaml).filter((b) => !members.has(b));
    eq(missing.length, 0, d.id + " has unbound members: " + missing.join(", "));
  });
});

test("every demo view is a complete Window and uses only allowed usings", () => {
  D.demos.forEach((d) => {
    ok(/^\s*<Window[\s>]/.test(d.axaml), d.id + " axaml is a full Window");
    includes(d.axaml, 'x:DataType="vm:MainWindowViewModel"', d.id + " sets x:DataType for compiled bindings");
    [...d.viewModel.matchAll(/using\s+([\w.]+);/g)].forEach((u) => {
      ok(/^(System|Avalonia|CommunityToolkit\.Mvvm)/.test(u[1]), d.id + " disallowed using: " + u[1]);
    });
  });
});

test("buildProject is null-safe when PROJZIP is absent", () => {
  eq(D.buildProject(null, "dg-window"), null, "no PROJZIP -> null, not a throw");
  eq(D.buildProject(P, "does-not-exist"), null, "unknown id -> null");
});

/* --- app.js wires the gallery download button --- */
const APP = fs.readFileSync(__dirname + "/../app.js", "utf8");
test("app.js renders the gallery demo download and wires DGDEMO.download", () => {
  includes(APP, "function renderDesignDemo", "renderDesignDemo defined");
  includes(APP, "h += renderDesignDemo(t);", "renderTopic appends the demo card");
  includes(APP, "window.DGDEMO", "DGDEMO handler defined");
  includes(APP, "reg.buildProject(P, id)", "download builds via DESIGN_DEMOS.buildProject");
});

global.TOPICS = [];
