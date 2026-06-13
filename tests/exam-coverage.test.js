"use strict";
/* Regression: the 10-question practice exam (OOP modeling, polymorphism,
   Observer, MVC vs MVVM, delegate vs event, OCP, Adapter, prototyping, a LINQ
   read, a Stack trace) must be answerable from the companion. Each concept maps
   to a quiz question and/or a reference topic; this test pins that coverage so a
   future edit cannot silently drop one. */
const { test, ok, eq } = require("./t.js");

global.window = global;
global.TOPICS = [];
const BANK = require("../data/quiz-bank.js");   // sets window.QUIZ_BANK + returns BANK
require("../data/solid.js");                    // pushes Design Patterns topics (incl. dp-adapter)
require("../data/process.js");                  // pushes Design Process topics (prototyping)

const byId = (id) => BANK.find((q) => q.id === id);
const topic = (id) => global.TOPICS.find((t) => t.id === id);

/* ---- quiz questions that answer each exam item ---- */
const QUIZ_FOR_EXAM = {
  "Q1 aggregation vs composition": "oop-07",
  "Q2 polymorphism": "oop-20",
  "Q3 observer": "sol-18",
  "Q4 mvc vs mvvm": "av-23",
  "Q5 delegate vs event": "oop-21",
  "Q6 OCP switch": "sol-05",
  "Q7 adapter": "sol-19",
  "Q8 vertical prototype": "proc-01",
  "Q9 linq returns": "lnq-19",
  "Q10 stack output": "col-13",
};

test("every exam concept maps to a quiz question (correct answer present)", () => {
  Object.keys(QUIZ_FOR_EXAM).forEach((label) => {
    const q = byId(QUIZ_FOR_EXAM[label]);
    ok(q, label + " -> missing quiz id " + QUIZ_FOR_EXAM[label]);
    if (q.type !== "short") ok(Number.isInteger(q.answer) && q.answer >= 0, label + " has no answer index");
  });
});

test("Q8 vertical prototype question is correct and discriminates from horizontal", () => {
  const q = byId("proc-01");
  eq(q.choices[q.answer], "Vertical prototype", "proc-01 correct answer");
  ok(q.choices.some((c) => /Horizontal/i.test(c)), "proc-01 offers Horizontal as a distractor");
});

test("Q7 adapter question's right answer is the wrap-the-service phrasing", () => {
  const q = byId("sol-19");
  ok(/wraps the service/i.test(q.choices[q.answer]), "sol-19 answer wraps the service");
});

test("Q10 stack trace question prints 32 (LIFO)", () => {
  const q = byId("col-13");
  eq(q.choices[q.answer], "32", "col-13 LIFO output");
  ok(/Push/.test(q.code) && /Pop/.test(q.code), "col-13 shows Push/Pop code");
});

test("Q9 LINQ question is a read-the-query (code-mc) with the average-of-subset answer", () => {
  const q = byId("lnq-19");
  eq(q.type, "code-mc", "lnq-19 is code-mc");
  ok(/DefaultIfEmpty/.test(q.code), "lnq-19 includes the DefaultIfEmpty trap");
  ok(/average/i.test(q.choices[q.answer]), "lnq-19 answer is about the average");
});

test("Design Process is a real quiz category with >= 10 questions", () => {
  ok(BANK.filter((q) => q.cat === "Design Process").length >= 10, "Design Process quiz count");
});

/* ---- reference topics for the two genuine content gaps ---- */
test("Adapter pattern reference topic exists under Design Patterns", () => {
  const t = topic("dp-adapter");
  ok(t, "dp-adapter topic missing");
  eq(t.cat, "Design Patterns", "dp-adapter category");
});

test("Prototyping reference topic exists under Design Process and names both dimensions", () => {
  const t = topic("proc-prototyping");
  ok(t, "proc-prototyping topic missing");
  eq(t.cat, "Design Process", "proc-prototyping category");
  const blob = JSON.stringify(t.blocks);
  ok(/Vertical/.test(blob) && /Horizontal/.test(blob), "covers vertical + horizontal");
  ok(/fidelity/i.test(blob), "covers fidelity");
});

/* leave the shared global.TOPICS empty so later test files (integration.test.js
   appends to it via loadAll) start from a clean slate and do not see duplicates */
global.TOPICS = [];
