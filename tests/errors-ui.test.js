"use strict";
const { test, ok, includes } = require("./t.js");
global.window = global;                  // errors.js attaches to window; no DOM at load time
require("../data/errors-core.js");        // populates window.ERRORS_CORE
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../data/errors.js", "utf8");

test("errors.js never touches document/localStorage at load time (top-level)", () => {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  code.split("\n").forEach((ln) => {
    if (ln.trim().indexOf("function") === 0) return;  // a function declaration's body is not run at load
    ["document.", "localStorage", "sessionStorage"].forEach((api) => {
      if (ln.indexOf(api) !== -1) ok(/^\s/.test(ln), api + " on a top-level line: " + ln.trim());
    });
  });
});

test("errors UI module loads under Node and exposes render/init + handlers on window.ED", () => {
  require("../data/errors.js");
  const E = global.ERRORS;
  ok(typeof E.render === "function", "ERRORS.render missing");
  ok(typeof E.init === "function", "ERRORS.init missing");
  ok(global.ED && typeof global.ED.setPaste === "function", "handlers must live on window.ED");
  ["clearPaste", "setQuery", "setCat"].forEach((fn) =>
    ok(typeof global.ED[fn] === "function", "handler ED." + fn + " missing"));
});

test("render() returns the page and lists the whole KB by default", () => {
  const E = require("../data/errors.js");
  const html = E.render();
  ok(typeof html === "string" && html.length > 200, "render produced HTML");
  includes(html, "ERROR DECODER", "has the heading");
  includes(html, "CS0246", "a known error code is listed");
  includes(html, "Fix", "cards show a Fix row");
});

test("listHTML reflects a pasted error (match mode)", () => {
  require("../data/errors-core.js");
  const E = require("../data/errors.js");
  global.ED.setPaste("error CS0246: The type or namespace name 'ObservableObject' could not be found");
  const html = E.listHTML();
  includes(html, "Best matches", "switched to match mode");
  includes(html, "CS0246", "matched the right code");
  global.ED.clearPaste();
});
