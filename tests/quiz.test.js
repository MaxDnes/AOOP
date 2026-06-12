"use strict";
const { test, eq, ok } = require("./t.js");
global.window = global;
const BANK = require("../data/quiz-bank.js");
const CATS = ["OOP", "SOLID", "Avalonia & MVVM", "Testing", "Threading & Async", "LINQ & JSON", "Collections & Generics"];
test("bank has at least 120 questions", () => ok(BANK.length >= 120, "got " + BANK.length));
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
