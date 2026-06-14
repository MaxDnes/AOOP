"use strict";
/* Test Lab: the per-mode testing guide (data/testlab-guide.js) and the coverage
   panel + guide rendering in data/testlab.js. */
const { test, eq, ok, includes } = require("./t.js");

/* the six Test Lab modes the guide must cover, in lock-step with MODE_DEFS */
const MODE_KEYS = ["perFunction", "plain", "viewModel", "headless", "async", "csproj"];

/* ---------- guide data ---------- */
const GUIDE = require("../data/testlab-guide.js");

test("guide has one entry per Test Lab mode, no extras", () => {
  ok(Array.isArray(GUIDE), "guide is an array");
  const keys = GUIDE.map((g) => g.key).sort();
  eq(keys.join(","), MODE_KEYS.slice().sort().join(","), "guide keys match the mode keys exactly");
});

test("every guide entry is complete (what / when / steps / snippet / gotcha)", () => {
  GUIDE.forEach((g) => {
    ok(typeof g.label === "string" && g.label, g.key + ": label");
    ok(typeof g.what === "string" && g.what.length > 10, g.key + ": what");
    ok(typeof g.when === "string" && g.when.length > 10, g.key + ": when");
    ok(Array.isArray(g.steps) && g.steps.length >= 2, g.key + ": >=2 steps");
    g.steps.forEach((s) => ok(typeof s === "string" && s.trim(), g.key + ": step text"));
    ok(typeof g.snippet === "string" && g.snippet.indexOf("\n") !== -1, g.key + ": multi-line snippet");
    ok(typeof g.gotcha === "string" && g.gotcha.length > 10, g.key + ": gotcha");
  });
});

test("the guidance names the right idiom for each kind", () => {
  const by = {};
  GUIDE.forEach((g) => { by[g.key] = g; });
  includes(by.headless.snippet, "[AvaloniaFact]", "headless uses [AvaloniaFact]");
  includes(by.headless.gotcha, "thread", "headless warns about the UI thread");
  includes(by.async.steps.join(" "), "ExecuteAsync", "async fires the command without awaiting");
  includes(by.async.gotcha, "exact", "async warns against asserting an exact count");
  includes(by.viewModel.steps.join(" "), "Command", "viewModel calls the generated command member");
  includes(by.plain.gotcha, "InlineData", "plain warns about InlineData constants");
});

/* ---------- rendering: guide panel + coverage in the live module ---------- */
/* a fresh Test Lab UI module over a minimal localStorage + DOM stub */
function freshUI() {
  const els = {};
  global.window = global;
  global.localStorage = {
    _d: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
  };
  global.document = {
    getElementById(id) {
      if (!els[id]) els[id] = { innerHTML: "", textContent: "", value: "", getAttribute() { return null; }, setAttribute() {}, classList: { add() {}, remove() {} }, focus() {} };
      return els[id];
    },
  };
  require("../data/testlab-core.js");
  require("../data/testlab-examples.js");
  require("../data/testlab-guide.js");
  delete require.cache[require.resolve("../data/testlab.js")];
  const UI = require("../data/testlab.js");
  return { els, UI, TL: global.TL };
}

test("the guide toggle is closed by default and opens on demand", () => {
  const f = freshUI();
  let page = f.UI.render();
  includes(page, "how to write each kind", "guide toggle present");
  ok(page.indexOf("tl-guide-card") === -1, "guide cards hidden until opened");
  f.TL.toggleGuide();
  page = f.UI.render();
  includes(page, "tl-guide-card", "guide cards shown after toggle");
  includes(page, "[AvaloniaFact]", "a guide snippet is rendered");
});

test("loading a worked example shows a coverage panel with assert + TODO counts", () => {
  const f = freshUI();
  f.TL.loadGallery("calculator");           /* loads C#, parses, generates */
  const page = f.UI.render();
  includes(page, "tl-cov", "coverage panel rendered");
  includes(page, "functions tested", "function coverage shown");
  includes(page, "assert", "auto-filled assert count shown");
  includes(page, "TODO to finish", "remaining-TODO count shown");
});

test("coverage panel nudges to switch on a test kind that is off", () => {
  const f = freshUI();
  f.TL.loadGallery("calculator");
  /* the calculator example turns viewModel OFF by default, so its coverage chip
     offers to add it */
  f.TL.setMode("viewModel", false);
  const page = f.UI.render();
  includes(page, "tl-cov-mode off", "an off mode is marked in the coverage panel");
  includes(page, "TL.setMode(", "the panel wires an add-this-kind button");
});
