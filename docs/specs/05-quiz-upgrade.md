# Spec 05: Quiz upgrade (exam sim, wrong-drill, keyboard, content holes)

Read docs/specs/00-master-plan.md first. You own ONLY: data/quiz.js,
data/quiz-bank.js, quiz.css, tests/quiz.test.js, tests/quiz-ui.test.js (NEW).
Read data/quiz.js and the bank structure fully first; extend, do not rewrite.

## Features

1. Exam sim mode: ~25 questions sampled proportionally across the 7 categories
   (round-robin by category share, deterministic given the sample), visible countdown
   (30s per question budget shown as one total mm:ss timer, amber, red under 60s),
   auto-finish at zero, end screen reuses the per-category breakdown. NOTE: app code
   runs in the browser; Date.now is fine there, just never in the Node tests'
   asserted paths (inject a clock param where needed for testability).
2. Drill-my-wrongs mode: queue = all questions with lifetime w > 0 from stats,
   sorted by wrong-rate desc; friendly empty state when none.
3. Weak sprint mode: top 10 of the weak-sorted pool (the existing weak ordering),
   replacing nothing; a 4th/5th mode chip alongside the existing three.
4. Keyboard: while a run is active: 1-4 select choice, Enter advance (and submit
   short-answer self-grade focus), S reveal short answer; guarded document keydown
   that checks the current route/view exactly like designer.js does (no listener
   stacking; check its keysBound pattern).
5. Bank additions (~20 mc/code-mc + 6 short "write the code"): JsonPropertyName /
   JsonIgnore (3), records vs classes (2), extension methods (2), Func vs Action (2),
   Interlocked vs lock (2), async void vs async Task (2), x:DataType + compiled
   bindings (2), DispatcherTimer vs Task.Delay loop (1), ListBox SelectionMode /
   SelectedItems (2), plus 6 shorts in the sol-16/lnq-15 style: write a DIP fix,
   write a GroupBy+Average query, write JsonSerializer.Serialize with WriteIndented
   + camelCase, write a [RelayCommand(CanExecute=...)], write an [AvaloniaFact] test
   skeleton, write the 100ms counter loop. Keep the existing bank object shape and
   answer-index convention (check it; display order is shuffled at runtime anyway).
   Explanations: 250-450 chars, tied to exam tactics like the existing ones.
6. Light spaced repetition: recordGrade stamps e.t = Date.now(); weak ordering
   decays: a correct answer in the last 24h multiplies the weak weight by 0.3 (still
   listed, much lower). Document the formula in a comment.
7. Run persistence: active run (mode, queue ids, position, per-question results) to
   sessionStorage on every answer; offer Resume on the start screen if one exists.
8. Stats management on start screen: Reset stats (confirm), Export stats (JSON
   download via Blob, file:// safe), Import stats (file input).

## Looks
Countdown pill top-right of the quiz header (mono font). New mode chips match the
existing mode selector. Keep everything else visually unchanged.

## Tests
tests/quiz.test.js: bump thresholds (total >= 120, every category >= 10, code-mc
>= 20, short >= 12) and keep all shape checks passing for new entries.
tests/quiz-ui.test.js (NEW, Node, t.js helpers): load data/quiz.js the way
analyzer-ui tests load their UI file; test the pure logic: weak-mode ordering (with
injected stats + clock), drill-wrongs queue contents, exam-sim proportional sampling
(category counts within +/-1 of proportional share for a fixed bank), recordGrade
accumulation + timestamp, retryWrong queue, decay factor application. Refactor
quiz.js only as far as needed to expose pure functions for these (e.g. attach them
to the QUIZ object).

## Definition of done
Own tests green; full suite green at session end (ignore mid-session failures in
files you do not own); question count and thresholds consistent; no files outside
ownership touched.

## Return (final message, raw JSON)
{"done": bool, "modes_added": [..], "questions_added": N, "tests": "X passed",
 "manual_checks": [..], "skipped": [..], "notes": ".."}
