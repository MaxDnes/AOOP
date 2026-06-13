"use strict";
/* Pins the per-topic "Examples" coverage: every reference-documentation topic
   must carry at least one well-formed example in data/examples.js, so a future
   edit cannot silently drop the collapsible Examples sections from a tab. */
const { test, ok, eq } = require("./t.js");
const path = require("path");

global.window = global;
global.TOPICS = [];
["oop", "csharp", "solid", "design", "avalonia", "mvvm", "collections", "linq",
 "threading", "testing", "algorithms", "process"].forEach((m) => {
  try { require(path.join(__dirname, "..", "data", m + ".js")); } catch (e) {}
});
const EX = require("../data/examples.js");

const REF = new Set(["OOP Fundamentals", "C# Language", "SOLID", "Design Patterns",
  "Avalonia UI", "MVVM & Binding", "Collections & Generics", "LINQ", "Data & Files",
  "Threading & Async", "Unit Testing", "Algorithms & Big-O", "Design Process"]);
const refTopics = global.TOPICS.filter((t) => REF.has(t.cat));
const refIds = refTopics.map((t) => t.id);
const allIds = new Set(global.TOPICS.map((t) => t.id));
const ALLOWED_LANG = new Set(["csharp", "xml", "bash", "json"]);

test("every reference-doc topic has at least one example (all tabs covered)", () => {
  const missing = refIds.filter((id) => !Array.isArray(EX[id]) || EX[id].length === 0);
  eq(missing.join(", "), "", "topics with no examples: " + missing.join(", "));
});

test("at least 12 reference categories are represented", () => {
  const cats = new Set(refTopics.filter((t) => Array.isArray(EX[t.id]) && EX[t.id].length).map((t) => t.cat));
  ok(cats.size >= 12, "covered categories: " + cats.size);
});

test("every example key maps to a real topic id (no orphans)", () => {
  const orphans = Object.keys(EX).filter((id) => !allIds.has(id));
  eq(orphans.join(", "), "", "orphan example ids: " + orphans.join(", "));
});

test("every example item is well-formed { title, lang, code }", () => {
  let n = 0;
  Object.keys(EX).forEach((id) => {
    ok(Array.isArray(EX[id]), id + " is not an array");
    EX[id].forEach((it, i) => {
      n++;
      ok(it && typeof it.title === "string" && it.title.length > 0, id + "[" + i + "] bad title");
      ok(ALLOWED_LANG.has(it.lang), id + "[" + i + "] bad lang: " + it.lang);
      ok(typeof it.code === "string" && it.code.trim().length >= 5, id + "[" + i + "] bad/empty code");
      ok(it.code.indexOf("```") === -1, id + "[" + i + "] code must not contain markdown fences");
    });
  });
  ok(n >= 150, "expected a substantial example set, got " + n);
});

test("code-bearing langs are renderable by the highlighter set", () => {
  // app.js highlight() handles csharp/xml/bash/json; anything else would render raw.
  Object.keys(EX).forEach((id) => EX[id].forEach((it) =>
    ok(ALLOWED_LANG.has(it.lang), id + " uses unrenderable lang " + it.lang)));
});

/* leave the shared global.TOPICS empty so later test files (integration.test.js)
   start from a clean slate and do not see every topic twice (mirrors the cleanup
   exam-coverage.test.js does for the same reason). */
global.TOPICS = [];
