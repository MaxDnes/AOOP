"use strict";
const { test, eq, ok } = require("./t.js");
global.window = global;            // quiz.js attaches to window; no DOM calls at load time
require("../data/quiz-bank.js");   // populates window.QUIZ_BANK
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../data/quiz.js", "utf8");

test("quiz.js never touches document/localStorage at load time", () => {
  // Strongest proof: the module already required cleanly above in a Node process
  // that has no document / localStorage / sessionStorage. Any load-time access
  // would have thrown a ReferenceError. We additionally confirm statically that
  // every such reference lives on a line that is indented inside a function body
  // (the file wraps everything in an IIFE; top-level statements are not indented
  // past the 2-space function-body level for these APIs).
  // drop block + line comments so section headers don't trip the scan
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const lines = code.split("\n");
  ["document.", "localStorage", "sessionStorage"].forEach((api) => {
    lines.forEach((ln) => {
      const i = ln.indexOf(api);
      if (i === -1) return;
      // must be inside a function body => indented (leading whitespace present)
      ok(/^\s/.test(ln), api + " used on a non-indented (top-level) line: " + ln.trim());
    });
  });
});

test("quiz UI module loads under Node and exposes render/init + pure helpers", () => {
  require("../data/quiz.js");
  const Q = global.QUIZ;
  ok(typeof Q.render === "function", "QUIZ.render missing");
  ok(typeof Q.init === "function", "QUIZ.init missing");
  ok(global.QZ && typeof global.QZ.start === "function", "handlers must live on window.QZ");
  ["recordGradeInto", "decayFactor", "weakKey", "weakOrder", "drillQueue", "examSample", "retryWrongQueue"]
    .forEach((fn) => ok(typeof Q[fn] === "function", "pure helper QUIZ." + fn + " missing"));
});

const QUIZ = require("../data/quiz.js");
const BANK = global.QUIZ_BANK;
const T0 = 1_000_000_000_000;      // fixed clock for deterministic tests
const DAY = QUIZ.DAY_MS;

/* small synthetic pool so counts are predictable */
function poolBy(cat) { return BANK.filter((q) => q.cat === cat); }

test("recordGradeInto accumulates r/w and stamps the clock", () => {
  const stats = {};
  QUIZ.recordGradeInto(stats, "oop-01", true, T0);
  eq(stats["oop-01"].r, 1, "r after one right");
  eq(stats["oop-01"].w, 0, "w after one right");
  eq(stats["oop-01"].t, T0, "timestamp stamped");
  QUIZ.recordGradeInto(stats, "oop-01", false, T0 + 5000);
  eq(stats["oop-01"].r, 1, "r unchanged on a wrong");
  eq(stats["oop-01"].w, 1, "w incremented");
  eq(stats["oop-01"].t, T0 + 5000, "timestamp updated to latest attempt");
});

test("decayFactor: recent net-correct = 0.3, recent net-wrong = 1, stale = 1, unseen = 1", () => {
  eq(QUIZ.decayFactor(null, T0), 1, "no entry -> 1");
  eq(QUIZ.decayFactor({ r: 0, w: 0, t: 0 }, T0), 1, "no timestamp -> 1");
  // answered correctly more than wrong, within the last 24h -> decayed
  eq(QUIZ.decayFactor({ r: 3, w: 1, t: T0 - 1000 }, T0), QUIZ.DECAY_FACTOR, "recent net-correct decays");
  // mostly wrong, recent -> no decay (still want to drill it)
  eq(QUIZ.decayFactor({ r: 1, w: 3, t: T0 - 1000 }, T0), 1, "recent net-wrong does not decay");
  // correct but stale (older than a day) -> no decay
  eq(QUIZ.decayFactor({ r: 3, w: 1, t: T0 - DAY - 1000 }, T0), 1, "stale correct does not decay");
});

test("weakKey: unseen lands at 0.4; wrong-rate scales; decay sinks a recently-correct one", () => {
  const q = { id: "x" };
  eq(QUIZ.weakKey({}, q, T0), 0.4, "unseen question keys at 0.4");
  // 100% wrong, not recent -> key 1.0
  eq(QUIZ.weakKey({ x: { r: 0, w: 4, t: T0 - DAY - 1 } }, q, T0), 1, "all-wrong stale keys at 1");
  // mostly right and recent -> wrong-rate 0.25 * 0.3 decay = 0.075
  const k = QUIZ.weakKey({ x: { r: 3, w: 1, t: T0 - 1000 } }, q, T0);
  ok(Math.abs(k - 0.075) < 1e-9, "recent net-correct weakKey decayed, got " + k);
});

test("weakOrder puts higher weak weight first (wrong > unseen > recently-correct)", () => {
  const pool = [{ id: "wrong" }, { id: "unseen" }, { id: "good" }];
  const stats = {
    wrong: { r: 0, w: 5, t: T0 - DAY - 1 },     // key 1.0
    good:  { r: 9, w: 1, t: T0 - 1000 },        // key 0.1 * 0.3 = 0.03
    // unseen: no entry -> key 0.4
  };
  const ordered = QUIZ.weakOrder(stats, pool, T0).map((q) => q.id);
  eq(ordered[0], "wrong", "highest wrong-rate first");
  eq(ordered[1], "unseen", "unseen (0.4) above recently-correct");
  eq(ordered[2], "good", "recently-correct decayed to the bottom");
});

test("drillQueue contains exactly the questions with w > 0, sorted by wrong-rate desc", () => {
  const a = BANK[0].id, b = BANK[1].id, c = BANK[2].id;
  const stats = {
    [a]: { r: 1, w: 3, t: T0 },   // wrong-rate 0.75
    [b]: { r: 4, w: 0, t: T0 },   // never wrong -> excluded
    [c]: { r: 1, w: 9, t: T0 },   // wrong-rate 0.9
  };
  const dq = QUIZ.drillQueue(stats, BANK).map((q) => q.id);
  ok(dq.indexOf(b) === -1, "questions never missed are excluded");
  eq(dq.length, 2, "only the two missed questions are queued");
  eq(dq[0], c, "highest wrong-rate first");
  eq(dq[1], a, "lower wrong-rate second");
});

test("drillQueue is empty when nothing has been missed", () => {
  eq(QUIZ.drillQueue({}, BANK).length, 0, "empty stats -> empty drill queue");
  const allRight = {};
  BANK.slice(0, 5).forEach((q) => { allRight[q.id] = { r: 3, w: 0, t: T0 }; });
  eq(QUIZ.drillQueue(allRight, BANK).length, 0, "all-correct stats -> empty drill queue");
});

test("examSample returns the whole pool when pool <= target", () => {
  const small = BANK.slice(0, 10);
  eq(QUIZ.examSample(small, 25).length, 10, "pool smaller than target returns whole pool");
});

test("examSample is proportional: each category within +/-1 of its fair share", () => {
  const CATS = QUIZ.CATS.map((c) => c.name);
  const pool = BANK.filter((q) => CATS.includes(q.cat)); // full bank
  const n = QUIZ.EXAM_N;
  const sample = QUIZ.examSample(pool, n);
  eq(sample.length, n, "sample is exactly the target size");
  // no duplicates
  eq(new Set(sample.map((q) => q.id)).size, n, "sample has no duplicate questions");
  // category counts proportional within +/- 1
  CATS.forEach((c) => {
    const share = pool.filter((q) => q.cat === c).length / pool.length;
    const ideal = share * n;
    const got = sample.filter((q) => q.cat === c).length;
    ok(Math.abs(got - ideal) <= 1.0000001, c + ": got " + got + " expected ~" + ideal.toFixed(2));
  });
});

test("examSample is deterministic for a fixed input pool", () => {
  const pool = BANK.slice();
  const a = QUIZ.examSample(pool, 25).map((q) => q.id);
  const b = QUIZ.examSample(pool, 25).map((q) => q.id);
  eq(a.join(","), b.join(","), "same pool -> same sample");
});

test("retryWrongQueue returns only the missed questions from a run's results", () => {
  const results = [
    { q: BANK[0], right: true },
    { q: BANK[1], right: false },
    { q: BANK[2], right: false },
    { q: BANK[3], right: true },
  ];
  const rw = QUIZ.retryWrongQueue(results).map((q) => q.id);
  eq(rw.length, 2, "two wrong answers");
  eq(rw[0], BANK[1].id, "first wrong preserved");
  eq(rw[1], BANK[2].id, "second wrong preserved");
});
