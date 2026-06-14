"use strict";
const { test, eq, ok } = require("./t.js");
const fs = require("fs");
global.window = global;
const BANK = require("../data/quiz-bank.js");
const CATS = ["Exam Theory", "OOP", "SOLID", "Avalonia & MVVM", "Testing", "Threading & Async", "LINQ & JSON", "Collections & Generics", "Design Process", "Mock Exam 1", "Mock Exam 2"];
test("bank has at least 120 questions", () => ok(BANK.length >= 120, "got " + BANK.length));
test("Exam Theory category has exactly the 20 Problem-1-style MCQs", () => {
  const et = BANK.filter((q) => q.cat === "Exam Theory");
  ok(et.length === 20, "expected 20 Exam Theory questions, got " + et.length);
  ok(et.filter((q) => q.type === "code-mc").length >= 12, "most Exam Theory questions should carry a code snippet");
  ok(et.every((q) => q.type !== "short"), "Exam Theory questions are all multiple choice");
});
test("every category has at least 10 questions", () => {
  CATS.forEach((c) => ok(BANK.filter((q) => q.cat === c).length >= 10, c));
});
test("ids unique, schema valid", () => {
  const seen = new Set();
  BANK.forEach((q) => {
    ok(q.id && !seen.has(q.id), "dup/missing id " + q.id); seen.add(q.id);
    ok(CATS.includes(q.cat), q.id + " bad cat " + q.cat);
    ok(["mc", "code-mc", "short"].includes(q.type), q.id + " bad type");
    ok(q.q && q.explain, q.id + " missing q/explain");
    if (q.type !== "short") {
      ok(Array.isArray(q.choices) && q.choices.length >= 3, q.id + " needs >=3 choices");
      ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length, q.id + " bad answer idx");
    } else ok(typeof q.answer === "string" && q.answer.length > 0, q.id + " short needs model answer");
    if (q.type === "code-mc") ok(q.code, q.id + " code-mc needs code");
  });
});
test("at least 20 spot-the-violation / code questions (code-mc)", () => {
  ok(BANK.filter((q) => q.type === "code-mc").length >= 20, "got " + BANK.filter((q) => q.type === "code-mc").length);
});
test("at least 12 short 'write the code' questions", () => {
  ok(BANK.filter((q) => q.type === "short").length >= 12, "got " + BANK.filter((q) => q.type === "short").length);
});
test("explanations are exam-tactic length (250-460 chars)", () => {
  BANK.forEach((q) => {
    const n = q.explain.length;
    ok(n >= 250 && n <= 460, q.id + " explain length " + n + " out of 250-460");
  });
});

test("lnq-18s model answer uses a neutral filename, not the stale Problem_4_Query_Results.json", () => {
  const q = BANK.find((x) => x.id === "lnq-18s");
  ok(q, "lnq-18s question exists");
  ok(q.answer.indexOf("Problem_4_Query_Results.json") === -1, "stale filename must be gone from the model code");
  ok(/WriteAllText\("results\.json"/.test(q.answer), "model code writes the neutral results.json name");
});

test("each Mock Exam set is a takeable 20-question MCQ paper (2026 format)", () => {
  ["Mock Exam 1", "Mock Exam 2"].forEach((set) => {
    const qs = BANK.filter((q) => q.cat === set);
    ok(qs.length === 20, set + " must have exactly 20 questions, got " + qs.length);
    // the real Problem-1 paper is pure multiple choice: no short-answer items
    ok(qs.every((q) => q.type === "mc" || q.type === "code-mc"), set + " must be all mc/code-mc");
    // a faithful mix carries some read-the-code questions like the real paper
    ok(qs.filter((q) => q.type === "code-mc").length >= 8, set + " needs >= 8 code questions");
    // every answer index is in range and every code-mc carries code (also covered by
    // the global schema test, asserted here so a bad mock-exam edit fails loudly)
    qs.forEach((q) => {
      ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length, q.id + " bad answer idx");
      if (q.type === "code-mc") ok(q.code, q.id + " code-mc needs code");
    });
  });
});

test("Mock Exam ids are unique and namespaced (me1-/me2-)", () => {
  const me1 = BANK.filter((q) => q.cat === "Mock Exam 1");
  const me2 = BANK.filter((q) => q.cat === "Mock Exam 2");
  ok(me1.every((q) => /^me1-\d\d$/.test(q.id)), "Mock Exam 1 ids must look like me1-NN");
  ok(me2.every((q) => /^me2-\d\d$/.test(q.id)), "Mock Exam 2 ids must look like me2-NN");
});

test("HashSet collections topic does not claim a guaranteed iteration order", () => {
  const src = fs.readFileSync(__dirname + "/../data/collections.js", "utf8");
  // the old demo comment claimed "first-seen order kept" — must be gone
  ok(src.indexOf("first-seen order kept") === -1, "must not imply HashSet keeps insertion order");
  // and must state explicitly that order is not guaranteed
  ok(/iteration order is not guaranteed/i.test(src), "HashSet doc must say iteration order is NOT guaranteed");
});
