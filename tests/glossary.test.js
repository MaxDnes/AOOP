"use strict";
/* Glossary / wiki module: a searchable base of every course term + notation,
   cross-linked to the deep topics, plus a link to the merged lecture-slides PDF.
   Loads every content module ONCE (require caches them, so a re-require would not
   re-push), captures the topics, then resets global.TOPICS so this file never
   contaminates integration.test.js (see the project memory note on TOPICS reset). */
const { test, eq, ok, includes } = require("./t.js");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const ALL = (function loadAllTopics() {
  global.window = global;
  global.TOPICS = [];
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const srcs = [...html.matchAll(/<script src="(data\/[^"]+\.js)"><\/script>/g)].map((m) => m[1]);
  srcs.forEach((s) => { try { require(path.join(root, s)); } catch (e) { /* tools may noop under Node */ } });
  const topics = global.TOPICS.slice();
  global.TOPICS = [];   /* leave the shared global clean for the next test file */
  return topics;
})();

/* every [[id|label]] / [[id]] cross-link target referenced inside a topic */
function crossLinks(topic) {
  const json = JSON.stringify(topic);
  const ids = [];
  let m;
  const re1 = /\[\[([\w/-]+)\|/g;
  while ((m = re1.exec(json))) ids.push(m[1]);
  const re2 = /\[\[([\w/-]+)\]\]/g;
  while ((m = re2.exec(json))) ids.push(m[1]);
  return ids;
}

test("glossary: module registers the expected sections, all under the Glossary category", () => {
  const glo = ALL.filter((t) => t.cat === "Glossary");
  ok(glo.length >= 9, "expected >= 9 glossary topics, got " + glo.length);
  glo.forEach((t) => ok(/^glo-/.test(t.id), "glossary topic id should start with glo-: " + t.id));
  ["glo-index", "glo-oop-cs", "glo-solid-patterns", "glo-avalonia-mvvm", "glo-collections-linq",
    "glo-threading", "glo-algorithms", "glo-process-testing", "glo-notation"]
    .forEach((id) => ok(glo.some((t) => t.id === id), "missing glossary section: " + id));
});

test("glossary: every cross-link and related id resolves to a real topic", () => {
  const ids = new Set(ALL.map((t) => t.id));
  const glo = ALL.filter((t) => t.cat === "Glossary");
  const broken = [];
  glo.forEach((t) => {
    (t.related || []).forEach((r) => { if (!ids.has(r)) broken.push(t.id + " related -> " + r); });
    crossLinks(t).forEach((id) => { if (id.indexOf("lab/") !== 0 && !ids.has(id)) broken.push(t.id + " [[" + id + "]]"); });
  });
  eq(broken.join(", "), "", "broken glossary cross-links");
});

test("glossary: links the merged slides PDF and the asset exists on disk", () => {
  const index = ALL.find((t) => t.id === "glo-index");
  ok(index, "glo-index present");
  includes(JSON.stringify(index), "assets/AOP-all-lectures.pdf", "glo-index links the merged PDF");
  ok(fs.existsSync(path.join(root, "assets", "AOP-all-lectures.pdf")), "merged PDF asset is committed");
});

test("glossary: app.js renders [label](url) external links (markdown-link support wired)", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  includes(app, 'target="_blank"', "inline() emits external links in a new tab");
  includes(app, "[label](url) external links", "inline() documents the markdown-link transform");
});

test("glossary: Glossary is a registered category in app.js", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const cats = app.slice(app.indexOf("const CATEGORIES = ["), app.indexOf("];", app.indexOf("const CATEGORIES = [")));
  includes(cats, '"Glossary"', "Glossary registered in CATEGORIES");
});
