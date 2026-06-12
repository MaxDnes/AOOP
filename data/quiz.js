/* ============ QUIZ · self-test UI ============
   window.QUIZ = { render, init, ...pure helpers } — page module used by the app router.
   All DOM handlers live on window.QZ. No DOM access at load time.
   Stats persisted in localStorage "aop-quiz-stats": { [qid]: { r, w, t } }
     r = lifetime right, w = lifetime wrong, t = epoch ms of the LAST recordGrade.
   Active run persisted in sessionStorage "aop-quiz-run" for Resume.

   Pure logic (queue building, sampling, weak ordering, decay, recordGrade) is
   attached to the QUIZ object and takes injected stats + clock so the Node tests
   never touch Date.now / localStorage. The browser handlers feed real values in.
*/
(function (global) {
"use strict";

var CATS = [
  { name: "OOP",                    color: "#39bae6" },
  { name: "SOLID",                  color: "#d2a6ff" },
  { name: "Avalonia & MVVM",        color: "#e6b450" },
  { name: "Testing",                color: "#39bae6" },
  { name: "Threading & Async",      color: "#f07178" },
  { name: "LINQ & JSON",            color: "#7fd962" },
  { name: "Collections & Generics", color: "#7fd962" },
];

var MODES = [
  { key: "all",    label: "All shuffled",       desc: "every selected question, random order" },
  { key: "weak",   label: "Weak topics first",  desc: "highest wrong-rate first, then unseen" },
  { key: "sprint", label: "10-question sprint",  desc: "quick random sample of 10" },
  { key: "weak10", label: "Weak sprint",         desc: "the 10 weakest questions only" },
  { key: "drill",  label: "Drill my wrongs",     desc: "every question you've ever missed" },
  { key: "exam",   label: "Exam sim (25 + timer)", desc: "proportional sample, countdown, auto-finish" },
];

var EXAM_N = 25;          // exam-sim target question count
var EXAM_PER_Q_MS = 30000; // 30s per question budget
var DAY_MS = 24 * 60 * 60 * 1000;
var DECAY_FACTOR = 0.3;   // weak weight multiplier for a correct answer in the last 24h

/* ---------------- state ---------------- */
var view = "start";        // start | quiz | end
var selCats = null;        // Set of selected category names (null = not initialized yet)
var mode = "all";
var queue = [];            // questions in the current run
var pos = 0;
var stage = "ask";         // ask | revealed (short only) | graded
var chosen = -1;           // original index of the picked choice (mc)
var lastRight = false;
var order = [];            // display permutation of choice indices for current question
var results = [];          // { q, right } for the current run
var startMsg = "";
var keysBound = false;     // document keydown registered once (designer.js pattern)

/* exam-sim timer state (browser only; never asserted in Node) */
var examDeadline = 0;      // epoch ms when the run auto-finishes
var examTotalMs = 0;
var timerHandle = null;

function bank() { return global.QUIZ_BANK || []; }

/* ---------------- helpers ---------------- */
function qesc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hiCode(code) {
  return (typeof global.highlight === "function") ? global.highlight(code, "csharp") : qesc(code);
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function catColor(name) {
  var c = CATS.find(function (x) { return x.name === name; });
  return c ? c.color : "#e6b450";
}

function now() { return Date.now(); }

function fmtTime(ms) {
  if (ms < 0) ms = 0;
  var s = Math.ceil(ms / 1000);
  var m = Math.floor(s / 60);
  var ss = s % 60;
  return m + ":" + (ss < 10 ? "0" : "") + ss;
}

/* ---------------- stats (localStorage, try/catch like the app store) ---------------- */
function getStats() {
  try { return JSON.parse(localStorage.getItem("aop-quiz-stats") || "{}"); } catch (e) { return {}; }
}
function setStats(s) {
  try { localStorage.setItem("aop-quiz-stats", JSON.stringify(s)); } catch (e) {}
}

/* ---- PURE: write one grade into a stats object (clock injected) ----
   r/w accumulate over the question's lifetime; t stamps the last attempt so the
   weak ordering can decay recently-correct questions. Returns the mutated stats. */
function recordGradeInto(stats, qid, right, clockNow) {
  var e = stats[qid] || { r: 0, w: 0, t: 0 };
  if (right) e.r++; else e.w++;
  e.t = clockNow;
  stats[qid] = e;
  return stats;
}

function recordGrade(qid, right) {
  var s = getStats();
  recordGradeInto(s, qid, right, now());
  setStats(s);
}

/* ---- PURE: spaced-repetition decay ----
   weak weight = wrong-rate, but a question answered CORRECTLY within the last 24h
   is multiplied by 0.3 so it still shows up (you may have forgotten it) yet sinks
   well below questions you are actively getting wrong. A wrong answer never decays.
   Formula:  decay = (last attempt was a NET-correct streak within 24h) ? 0.3 : 1. */
function decayFactor(entry, clockNow) {
  if (!entry || !entry.t) return 1;
  if ((clockNow - entry.t) > DAY_MS) return 1;     // older than a day: no decay
  // only decay when the most recent activity reflects success: r > w means the
  // user is mostly getting it right, and it was touched recently -> de-prioritize.
  if (entry.r > entry.w) return DECAY_FACTOR;
  return 1;
}

/* weak mode sort key: attempted -> wrong-rate (1..0) * decay; unseen -> 0.4 so they
   land after anything the user has gotten wrong but before well-known questions. */
function weakKey(stats, q, clockNow) {
  var e = stats[q.id];
  var n = e ? (e.r + e.w) : 0;
  if (!n) return 0.4;
  return (e.w / n) * decayFactor(e, clockNow);
}

/* ---------------- queue building (PURE where possible) ---------------- */
function pool() {
  return bank().filter(function (q) { return selCats.has(q.cat); });
}

/* ---- PURE: weak ordering of a pool (highest weak weight first; stable on ties) ----
   The caller passes an already-shuffled pool so equal keys keep random order. */
function weakOrder(stats, poolArr, clockNow) {
  var p = poolArr.slice();
  p.sort(function (a, b) { return weakKey(stats, b, clockNow) - weakKey(stats, a, clockNow); });
  return p;
}

/* ---- PURE: drill-my-wrongs queue ----
   every question with lifetime w > 0, sorted by wrong-rate descending. */
function drillQueue(stats, bankArr) {
  var hit = bankArr.filter(function (q) {
    var e = stats[q.id];
    return e && e.w > 0;
  });
  hit.sort(function (a, b) {
    var ea = stats[a.id], eb = stats[b.id];
    var ra = ea.w / (ea.r + ea.w);
    var rb = eb.w / (eb.r + eb.w);
    return rb - ra;
  });
  return hit;
}

/* ---- PURE: exam-sim proportional sample ----
   Round-robin pick across categories weighted by each category's SHARE of the
   selected pool, so a category with twice the questions contributes ~twice as many.
   Deterministic for a given (already-shuffled) pool: walks each category's list in
   order and takes from the category whose "ideal so far" most exceeds what it's been
   given. Result length = min(n, pool size). */
function examSample(poolArr, n) {
  if (poolArr.length <= n) return poolArr.slice();
  // bucket by category, preserving incoming order within each bucket
  var buckets = {};
  var catOrder = [];
  poolArr.forEach(function (q) {
    if (!buckets[q.cat]) { buckets[q.cat] = []; catOrder.push(q.cat); }
    buckets[q.cat].push(q);
  });
  var total = poolArr.length;
  var taken = {};        // count taken per category
  var idx = {};          // next index per category
  catOrder.forEach(function (c) { taken[c] = 0; idx[c] = 0; });

  var out = [];
  while (out.length < n) {
    // pick the category with the largest deficit (ideal - taken) that still has stock
    var best = null, bestDeficit = -Infinity;
    for (var i = 0; i < catOrder.length; i++) {
      var c = catOrder[i];
      if (idx[c] >= buckets[c].length) continue; // exhausted
      var ideal = (buckets[c].length / total) * n;
      var deficit = ideal - taken[c];
      if (deficit > bestDeficit + 1e-9) { bestDeficit = deficit; best = c; }
    }
    if (best === null) break; // nothing left anywhere
    out.push(buckets[best][idx[best]++]);
    taken[best]++;
  }
  return out;
}

/* ---- PURE: retry-wrong queue from a finished run's results ---- */
function retryWrongQueue(runResults) {
  return runResults.filter(function (r) { return !r.right; }).map(function (r) { return r.q; });
}

function buildQueue() {
  var st = getStats();
  if (mode === "drill") {
    return drillQueue(st, shuffle(pool()));
  }
  var p = shuffle(pool());
  if (mode === "weak") {
    return weakOrder(st, p, now());
  } else if (mode === "sprint") {
    return p.slice(0, 10);
  } else if (mode === "weak10") {
    return weakOrder(st, p, now()).slice(0, 10);
  } else if (mode === "exam") {
    return examSample(p, EXAM_N);
  }
  return p;
}

/* ---------------- run persistence (sessionStorage) ---------------- */
function saveRun() {
  if (view !== "quiz") { clearRun(); return; }
  try {
    var rec = {
      mode: mode,
      cats: Array.from(selCats),
      ids: queue.map(function (q) { return q.id; }),
      pos: pos,
      results: results.map(function (r) { return { id: r.q.id, right: r.right }; }),
      examDeadline: (mode === "exam") ? examDeadline : 0,
      examTotalMs: (mode === "exam") ? examTotalMs : 0,
    };
    sessionStorage.setItem("aop-quiz-run", JSON.stringify(rec));
  } catch (e) {}
}
function loadRun() {
  try { return JSON.parse(sessionStorage.getItem("aop-quiz-run") || "null"); } catch (e) { return null; }
}
function clearRun() {
  try { sessionStorage.removeItem("aop-quiz-run"); } catch (e) {}
}
function byId(id) {
  return bank().find(function (q) { return q.id === id; });
}

/* ---------------- screens ---------------- */
function startScreen() {
  var st = getStats();
  var h = "";
  if (startMsg) { h += '<div class="qz-msg">' + qesc(startMsg) + "</div>"; }

  /* resume banner if a run is parked in sessionStorage */
  var parked = loadRun();
  if (parked && parked.ids && parked.ids.length && parked.pos < parked.ids.length) {
    var md = MODES.find(function (m) { return m.key === parked.mode; });
    h += '<div class="qz-resume">' +
      '<span class="qz-resume-txt">Unfinished run &mdash; <b>' +
      qesc(md ? md.label : parked.mode) + '</b>, question ' + (parked.pos + 1) + " / " + parked.ids.length + "</span>" +
      '<span class="qz-resume-acts">' +
      '<button class="qz-btn primary" onclick="QZ.resume()">Resume</button>' +
      '<button class="qz-btn" onclick="QZ.discardRun()">Discard</button></span></div>';
  }

  h += '<div class="qz-label">Categories</div><div class="qz-chips">';
  CATS.forEach(function (c, i) {
    var n = bank().filter(function (q) { return q.cat === c.name; }).length;
    var on = selCats.has(c.name);
    h += '<button class="qz-chip' + (on ? " on" : "") + '" style="--cat-color:' + c.color + '" onclick="QZ.toggleCat(' + i + ')">' +
      qesc(c.name) + ' <span class="qz-chip-n">' + n + "</span></button>";
  });
  h += "</div>";

  h += '<div class="qz-label">Mode</div><div class="qz-modes">';
  MODES.forEach(function (m) {
    h += '<button class="qz-mode' + (mode === m.key ? " on" : "") + '" onclick="QZ.setMode(\'' + m.key + '\')">' +
      "<b>" + qesc(m.label) + "</b><i>" + qesc(m.desc) + "</i></button>";
  });
  h += "</div>";

  var count = startCount(st);
  h += '<button class="qz-start" onclick="QZ.start()">Start &mdash; ' + count.label + "</button>";
  if (count.note) h += '<div class="qz-start-note">' + qesc(count.note) + "</div>";

  /* per-category stats bars */
  h += '<div class="qz-label">Your stats</div><div class="qz-statbars">';
  CATS.forEach(function (c) {
    var qs = bank().filter(function (q) { return q.cat === c.name; });
    var r = 0, w = 0, seen = 0;
    qs.forEach(function (q) {
      var e = st[q.id];
      if (e && (e.r + e.w) > 0) { seen++; r += e.r; w += e.w; }
    });
    var total = r + w;
    var pct = total ? Math.round((r / total) * 100) : 0;
    h += '<div class="qz-statbar" style="--cat-color:' + c.color + '">' +
      '<span class="qz-sb-name">' + qesc(c.name) + "</span>" +
      '<span class="qz-sb-bar">' +
      (total
        ? '<span class="qz-sb-r" style="width:' + pct + '%"></span><span class="qz-sb-w" style="width:' + (100 - pct) + '%"></span>'
        : '<span class="qz-sb-empty"></span>') +
      "</span>" +
      '<span class="qz-sb-txt">' +
      (total
        ? r + " &#10003; &middot; " + w + " &#10007; &middot; " + (qs.length - seen) + " unseen"
        : "not attempted yet") +
      "</span></div>";
  });
  h += "</div>";

  /* stats management */
  h += '<div class="qz-label">Stats data</div><div class="qz-actions qz-stats-mgmt">' +
    '<button class="qz-btn" onclick="QZ.exportStats()">Export stats</button>' +
    '<button class="qz-btn" onclick="QZ.importStats()">Import stats</button>' +
    '<button class="qz-btn bad" onclick="QZ.resetStats()">Reset stats</button>' +
    '<input id="qz-import-file" type="file" accept="application/json,.json" style="display:none" onchange="QZ.importFile(event)"></div>';

  return h;
}

/* compute the Start button label + a note for the special modes */
function startCount(st) {
  var c = pool().length;
  if (mode === "sprint")  return { label: Math.min(10, c) + " questions" };
  if (mode === "weak10")  return { label: Math.min(10, c) + " questions" };
  if (mode === "exam")    return { label: Math.min(EXAM_N, c) + " questions + timer" };
  if (mode === "drill") {
    var dq = drillQueue(st, pool());
    return dq.length
      ? { label: dq.length + " missed question" + (dq.length === 1 ? "" : "s") }
      : { label: "nothing to drill", note: "No wrong answers recorded yet — take a quiz first, then come back to drill what you missed." };
  }
  return { label: c + " questions" };
}

function timerPill() {
  if (mode !== "exam" || view !== "quiz") return "";
  var left = examDeadline - now();
  var cls = "qz-timer";
  if (left <= 60000) cls += " danger";
  return '<span class="' + cls + '" id="qz-timer">' + fmtTime(left) + "</span>";
}

function choiceRows(q) {
  var h = '<div class="qz-choices">';
  order.forEach(function (orig, di) {
    var letter = String.fromCharCode(65 + di);
    if (stage === "ask") {
      h += '<button class="qz-choice" onclick="QZ.choose(' + orig + ')">' +
        '<span class="qz-letter">' + letter + "</span>" + qesc(q.choices[orig]) + "</button>";
    } else {
      var cls = "qz-choice done";
      if (orig === q.answer) cls += " right";
      else if (orig === chosen) cls += " wrong";
      else cls += " dim";
      h += '<div class="' + cls + '"><span class="qz-letter">' + letter + "</span>" + qesc(q.choices[orig]) + "</div>";
    }
  });
  h += "</div>";
  return h;
}

function explainPanel(q) {
  return '<div class="qz-explain' + (lastRight ? " right" : " wrong") + '">' +
    '<div class="qz-verdict">' + (lastRight ? "&#10003; Right" : "&#10007; Wrong") + "</div>" +
    '<div class="qz-explain-txt">' + qesc(q.explain) + "</div></div>";
}

function quizScreen() {
  var q = queue[pos];
  if (!q) return "";
  var h = '<div class="qz-head">' +
    '<span class="qz-progress">' + (pos + 1) + " / " + queue.length + "</span>" +
    '<span class="qz-cat" style="--cat-color:' + catColor(q.cat) + '">' + qesc(q.cat) + "</span>" +
    '<span class="qz-type">' + (q.type === "short" ? "short answer" : (q.type === "code-mc" ? "code" : "multiple choice")) + "</span>" +
    timerPill() +
    "</div>" +
    '<div class="qz-pbar"><span style="width:' + Math.round((pos / queue.length) * 100) + '%"></span></div>';

  h += '<div class="qz-card">';
  h += '<div class="qz-q">' + qesc(q.q) + "</div>";
  if (q.code) {
    h += '<div class="codeblock qz-codeblock"><pre class="code">' + hiCode(q.code) + "</pre></div>";
  }

  if (q.type === "short") {
    if (stage === "ask") {
      h += '<div class="qz-actions"><button class="qz-btn primary" onclick="QZ.reveal()">Show answer <span class="qz-key">S</span></button></div>';
    } else {
      h += '<div class="qz-model"><div class="qz-model-label">Model answer</div>' + qesc(q.answer) + "</div>";
      if (stage === "revealed") {
        h += '<div class="qz-explain neutral"><div class="qz-explain-txt">' + qesc(q.explain) + "</div></div>";
        h += '<div class="qz-actions">' +
          '<button class="qz-btn good" onclick="QZ.self(1)">&#10003; I had it right</button>' +
          '<button class="qz-btn bad" onclick="QZ.self(0)">&#10007; I had it wrong</button></div>';
      } else { /* graded */
        h += explainPanel(q);
        h += '<div class="qz-actions"><button class="qz-btn primary" onclick="QZ.next()">' +
          (pos + 1 >= queue.length ? "Finish" : "Next &rarr;") + ' <span class="qz-key">↵</span></button></div>';
      }
    }
  } else {
    h += choiceRows(q);
    if (stage === "graded") {
      h += explainPanel(q);
      h += '<div class="qz-actions"><button class="qz-btn primary" onclick="QZ.next()">' +
        (pos + 1 >= queue.length ? "Finish" : "Next &rarr;") + ' <span class="qz-key">↵</span></button></div>';
    }
  }
  h += "</div>";
  h += '<div class="qz-quit"><a onclick="QZ.restart()">&larr; quit to start</a>' +
    '<span class="qz-hint">keys: <b>1-4</b> pick &middot; <b>Enter</b> next &middot; <b>S</b> show answer</span></div>';
  return h;
}

function endScreen() {
  var right = results.filter(function (r) { return r.right; }).length;
  var total = results.length;
  var pct = total ? Math.round((right / total) * 100) : 0;
  var h = '<div class="qz-end">';
  if (endMsg) h += '<div class="qz-msg">' + qesc(endMsg) + "</div>";
  h += '<div class="qz-score">' + right + ' <span class="qz-score-of">/ ' + total + "</span></div>";
  h += '<div class="qz-score-pct">' + pct + "% right</div>";

  /* per-category breakdown of this run (reused by exam sim) */
  h += '<div class="qz-label">This run by category</div><div class="qz-statbars">';
  CATS.forEach(function (c) {
    var rs = results.filter(function (r) { return r.q.cat === c.name; });
    if (!rs.length) return;
    var cr = rs.filter(function (r) { return r.right; }).length;
    var cp = Math.round((cr / rs.length) * 100);
    h += '<div class="qz-statbar" style="--cat-color:' + c.color + '">' +
      '<span class="qz-sb-name">' + qesc(c.name) + "</span>" +
      '<span class="qz-sb-bar"><span class="qz-sb-r" style="width:' + cp + '%"></span>' +
      '<span class="qz-sb-w" style="width:' + (100 - cp) + '%"></span></span>' +
      '<span class="qz-sb-txt">' + cr + " / " + rs.length + "</span></div>";
  });
  h += "</div>";

  var wrong = results.filter(function (r) { return !r.right; }).length;
  h += '<div class="qz-actions center">';
  if (wrong) h += '<button class="qz-btn bad" onclick="QZ.retryWrong()">Retry wrong ones (' + wrong + ")</button>";
  h += '<button class="qz-btn primary" onclick="QZ.restart()">New quiz</button></div>';
  h += "</div>";
  return h;
}

var endMsg = "";

function screen() {
  if (view === "quiz") return quizScreen();
  if (view === "end") return endScreen();
  return startScreen();
}

function paint() {
  var el = document.getElementById("qz-root");
  if (el) {
    el.innerHTML = screen();
    var card = el.querySelector(".qz-card");
    if (card && view === "quiz") card.scrollIntoView({ block: "nearest" });
  }
}

function startQuestion() {
  stage = "ask";
  chosen = -1;
  var q = queue[pos];
  order = (q && q.choices) ? shuffle(q.choices.map(function (_, i) { return i; })) : [];
}

/* ---------------- exam-sim timer (browser only) ---------------- */
function startTimer() {
  stopTimer();
  timerHandle = setInterval(tick, 1000);
}
function stopTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
}
function tick() {
  if (view !== "quiz" || mode !== "exam") { stopTimer(); return; }
  var el = document.getElementById("qz-timer");
  var left = examDeadline - now();
  if (el) {
    el.textContent = fmtTime(left);
    if (left <= 60000) el.classList.add("danger");
  }
  if (left <= 0) {
    stopTimer();
    finishByTimeout();
  }
}
function finishByTimeout() {
  /* auto-finish: anything not yet answered counts as skipped/wrong */
  endMsg = "Time! The run auto-finished — unanswered questions count as missed.";
  while (pos < queue.length) {
    var q = queue[pos];
    var already = results.some(function (r) { return r.q === q; });
    if (!already) {
      recordGrade(q.id, false);
      results.push({ q: q, right: false });
    }
    pos++;
  }
  view = "end";
  clearRun();
  paint();
}

/* ---------------- page module ---------------- */
var QUIZ = {
  render: function () {
    if (!selCats) selCats = new Set(CATS.map(function (c) { return c.name; }));
    view = "start";
    startMsg = "";
    endMsg = "";
    stopTimer();
    return '<div class="content-inner">' +
      '<div class="crumb"><b>QUIZ</b></div>' +
      '<h1 class="topic-title">Quiz</h1>' +
      '<p class="bp">' + bank().length + " hand-written questions across the whole curriculum. " +
      "Multiple choice grades instantly; short answers reveal a model answer for self-grading. " +
      'Wrong answers are remembered &mdash; pick <b>Weak topics first</b> or <b>Drill my wrongs</b> to grind them, ' +
      'or run the <b>Exam sim</b> for a timed dress rehearsal.</p>' +
      '<div id="qz-root" class="qz">' + screen() + "</div></div>";
  },
  init: function () {
    /* most interactivity is inline onclick; only the keyboard listener needs wiring,
       and it self-guards to the quiz route + active run (designer.js keysBound pattern). */
    if (!keysBound) {
      keysBound = true;
      document.addEventListener("keydown", onKey);
    }
  },

  /* ----- pure logic exposed for tests (no DOM, no Date.now, clock injected) ----- */
  recordGradeInto: recordGradeInto,
  decayFactor: decayFactor,
  weakKey: weakKey,
  weakOrder: weakOrder,
  drillQueue: drillQueue,
  examSample: examSample,
  retryWrongQueue: retryWrongQueue,
  CATS: CATS,
  MODES: MODES,
  EXAM_N: EXAM_N,
  DECAY_FACTOR: DECAY_FACTOR,
  DAY_MS: DAY_MS,
};

/* ---------------- keyboard (guarded to the quiz route + active run) ---------------- */
function onKey(e) {
  /* mirror designer.js: bail unless the app is on the quiz route */
  if (typeof current !== "undefined" && current !== "quiz") return;
  if (view !== "quiz") return;
  var t = e.target || {};
  var tag = (t.tagName || "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
  var q = queue[pos];
  if (!q) return;

  /* 1-4 pick a choice (mc / code-mc, only while asking) */
  if (stage === "ask" && q.type !== "short" && e.key >= "1" && e.key <= "9") {
    var di = parseInt(e.key, 10) - 1;
    if (di >= 0 && di < order.length) { e.preventDefault(); QZ.choose(order[di]); }
    return;
  }
  /* S reveals a short answer */
  if (stage === "ask" && q.type === "short" && (e.key === "s" || e.key === "S")) {
    e.preventDefault();
    QZ.reveal();
    return;
  }
  /* Enter advances when graded; on a revealed short it focuses the self-grade choice */
  if (e.key === "Enter") {
    if (stage === "graded") { e.preventDefault(); QZ.next(); }
    else if (stage === "revealed") {
      e.preventDefault();
      var btn = document.querySelector("#qz-root .qz-btn.good");
      if (btn && btn.focus) btn.focus();
    }
  }
}

/* ---------------- handlers (window.QZ) ---------------- */
var QZ = {
  toggleCat: function (i) {
    var name = CATS[i].name;
    if (selCats.has(name)) selCats.delete(name); else selCats.add(name);
    startMsg = "";
    paint();
  },
  setMode: function (m) {
    mode = m;
    startMsg = "";
    paint();
  },
  start: function () {
    if (!selCats.size) { startMsg = "Select at least one category first."; paint(); return; }
    queue = buildQueue();
    if (!queue.length) {
      startMsg = (mode === "drill")
        ? "Nothing to drill yet — take a quiz, then come back to grind what you missed."
        : "Select at least one category first.";
      paint();
      return;
    }
    pos = 0;
    results = [];
    endMsg = "";
    view = "quiz";
    if (mode === "exam") {
      examTotalMs = queue.length * EXAM_PER_Q_MS;
      examDeadline = now() + examTotalMs;
      startTimer();
    } else {
      stopTimer();
    }
    startQuestion();
    saveRun();
    paint();
  },
  resume: function () {
    var rec = loadRun();
    if (!rec || !rec.ids || !rec.ids.length) { paint(); return; }
    var q = rec.ids.map(byId).filter(Boolean);
    if (q.length !== rec.ids.length) { clearRun(); startMsg = "Saved run could not be restored."; paint(); return; }
    queue = q;
    mode = rec.mode;
    selCats = new Set(rec.cats && rec.cats.length ? rec.cats : CATS.map(function (c) { return c.name; }));
    pos = Math.min(rec.pos, queue.length - 1);
    results = (rec.results || []).map(function (r) { return { q: byId(r.id), right: r.right }; })
      .filter(function (r) { return r.q; });
    endMsg = "";
    view = "quiz";
    if (mode === "exam" && rec.examDeadline) {
      examDeadline = rec.examDeadline;
      examTotalMs = rec.examTotalMs || 0;
      if (examDeadline - now() <= 0) { finishByTimeout(); return; }
      startTimer();
    } else {
      stopTimer();
    }
    startQuestion();
    paint();
  },
  discardRun: function () {
    clearRun();
    startMsg = "Saved run discarded.";
    paint();
  },
  choose: function (origIdx) {
    if (stage !== "ask" || view !== "quiz") return;
    var q = queue[pos];
    chosen = origIdx;
    lastRight = (origIdx === q.answer);
    recordGrade(q.id, lastRight);
    results.push({ q: q, right: lastRight });
    stage = "graded";
    saveRun();
    paint();
  },
  reveal: function () {
    if (stage !== "ask") return;
    stage = "revealed";
    paint();
  },
  self: function (right) {
    if (stage !== "revealed") return;
    var q = queue[pos];
    lastRight = !!right;
    recordGrade(q.id, lastRight);
    results.push({ q: q, right: lastRight });
    stage = "graded";
    saveRun();
    paint();
  },
  next: function () {
    pos++;
    if (pos >= queue.length) {
      view = "end";
      stopTimer();
      clearRun();
    } else {
      startQuestion();
      saveRun();
    }
    paint();
  },
  retryWrong: function () {
    var wrong = retryWrongQueue(results);
    if (!wrong.length) return;
    queue = shuffle(wrong);
    mode = "all";          // retry runs are untimed
    pos = 0;
    results = [];
    endMsg = "";
    view = "quiz";
    stopTimer();
    startQuestion();
    saveRun();
    paint();
  },
  restart: function () {
    view = "start";
    startMsg = "";
    endMsg = "";
    stopTimer();
    clearRun();
    paint();
  },

  /* ----- stats management ----- */
  resetStats: function () {
    if (typeof confirm === "function" && !confirm("Reset ALL quiz stats? This wipes every right/wrong record and cannot be undone.")) return;
    setStats({});
    startMsg = "Stats reset.";
    paint();
  },
  exportStats: function () {
    var data = JSON.stringify(getStats(), null, 2);
    try {
      var blob = new Blob([data], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "aop-quiz-stats.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      startMsg = "Stats exported to aop-quiz-stats.json.";
    } catch (e) {
      startMsg = "Export failed in this browser.";
    }
    paint();
  },
  importStats: function () {
    var inp = document.getElementById("qz-import-file");
    if (inp) inp.click();
  },
  importFile: function (ev) {
    var f = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var incoming = JSON.parse(reader.result);
        if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw new Error("bad shape");
        var merged = getStats();
        Object.keys(incoming).forEach(function (id) {
          var src = incoming[id];
          if (!src || typeof src !== "object") return;
          var e = merged[id] || { r: 0, w: 0, t: 0 };
          e.r = (e.r || 0) + (src.r || 0);
          e.w = (e.w || 0) + (src.w || 0);
          e.t = Math.max(e.t || 0, src.t || 0);
          merged[id] = e;
        });
        setStats(merged);
        startMsg = "Stats imported and merged.";
      } catch (e) {
        startMsg = "Import failed: file is not valid quiz-stats JSON.";
      }
      var inp = document.getElementById("qz-import-file");
      if (inp) inp.value = "";
      paint();
    };
    reader.readAsText(f);
  },
};

global.QUIZ = QUIZ;
global.QZ = QZ;
if (typeof module !== "undefined" && module.exports) module.exports = QUIZ;

})(typeof window !== "undefined" ? window : globalThis);
