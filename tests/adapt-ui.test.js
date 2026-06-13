"use strict";
const { test, ok, includes } = require("./t.js");
global.window = global;                 // adapt.js attaches to window; no DOM at load time
require("../data/adapt-core.js");        // populates window.ADAPT_CORE
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../data/adapt.js", "utf8");

test("adapt.js never touches document/localStorage at load time (top-level)", () => {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  code.split("\n").forEach((ln) => {
    if (ln.trim().indexOf("function") === 0) return;  // a function declaration's body is not run at load
    ["document.", "localStorage", "sessionStorage"].forEach((api) => {
      if (ln.indexOf(api) !== -1) ok(/^\s/.test(ln), api + " on a top-level line: " + ln.trim());
    });
  });
});

test("adapt UI module loads under Node and exposes render/init + handlers on window.AD", () => {
  require("../data/adapt.js");
  const A = global.ADAPT;
  ok(typeof A.render === "function", "ADAPT.render missing");
  ok(typeof A.init === "function", "ADAPT.init missing");
  ok(global.AD && typeof global.AD.setName === "function", "handlers must live on window.AD");
  ["setStarter", "setGenerated", "addRename", "setRename", "removeRename", "loadExample", "clearAll"]
    .forEach((fn) => ok(typeof global.AD[fn] === "function", "handler AD." + fn + " missing"));
});

test("render() returns the page without throwing, including the example output", () => {
  const A = require("../data/adapt.js");
  const html = A.render();
  ok(typeof html === "string" && html.length > 200, "render produced HTML");
  includes(html, "ADAPT LAB", "has the heading");
  includes(html, "RectangleUI", "example target shown");
  // the OUTPUT pane (not the input textarea) is the adapted code: it must be fully
  // renamed. The input textarea legitimately still shows the original ExamApp source.
  const out = A.outHTML();
  includes(out, "RectangleUI.ViewModels", "output namespace adapted");
  // the output may legitimately say "Source name detected: ExamApp"; the adapted
  // CODE must carry no qualified ExamApp.* namespace.
  ok(out.indexOf("ExamApp.") === -1, "no un-adapted ExamApp.* namespace left in the output code");
});
