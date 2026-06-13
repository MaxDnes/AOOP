"use strict";
const { test, eq, ok, includes } = require("./t.js");
const C = require("../data/testlab-core.js");
const EX = require("../data/testlab-examples.js");

/* brace-balance over generated C# (literals/comments stripped). */
function braceBalanced(code) {
  const s = C.stripForScan(code);
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") d++;
    else if (s[i] === "}") { d--; if (d < 0) throw new Error("extra } at " + i); }
  }
  if (d !== 0) throw new Error("unbalanced, depth " + d);
  return true;
}

/* default Test Lab options (mirrors data/testlab.js defaultOptions) */
const OPTS = { perFunction: true, plain: false, viewModel: false, headless: true, async: true, csproj: true, selection: {} };

function gen(ex) {
  const model = C.parse([{ name: ex.name, text: ex.source }]);
  return { model: model, files: C.generate(model, OPTS) };
}
function byId(id) { return EX.filter((e) => e.id === id)[0]; }
function trioFile(files) { return files.filter((f) => f.perFunction && /Tests\.cs$/.test(f.fileName))[0]; }

/* ---------- module shape ---------- */
test("gallery is a non-empty array", () => {
  ok(Array.isArray(EX) && EX.length >= 5, "expected >= 5 worked examples");
});

test("every example has the required fields", () => {
  const seen = {};
  EX.forEach((ex) => {
    ok(ex && typeof ex.id === "string" && ex.id, "id missing");
    ok(!seen[ex.id], "duplicate id: " + ex.id); seen[ex.id] = true;
    ok(typeof ex.name === "string" && /\.cs$/.test(ex.name), ex.id + ": name must be a .cs file");
    ok(typeof ex.title === "string" && ex.title, ex.id + ": title missing");
    ok(typeof ex.summary === "string" && ex.summary, ex.id + ": summary missing");
    ok(typeof ex.source === "string" && ex.source.trim(), ex.id + ": source missing");
    ok(Array.isArray(ex.notes) && ex.notes.length >= 2, ex.id + ": needs >= 2 notes");
    ex.notes.forEach((n) => ok(typeof n === "string" && n.trim(), ex.id + ": empty note"));
  });
});

/* ---------- every example parses, generates, and is well-formed ---------- */
test("every example generates a balanced per-function trio", () => {
  EX.forEach((ex) => {
    const { files } = gen(ex);
    ok(files.length > 0, ex.id + ": generated nothing");
    const trio = trioFile(files);
    ok(trio, ex.id + ": no per-function Tests.cs file");
    braceBalanced(trio.code);
    /* the labeled Positive / Negative / Edge trio the notes describe */
    includes(trio.code, "--- Positive ---", ex.id);
    includes(trio.code, "--- Negative ---", ex.id);
    includes(trio.code, "--- Edge ---", ex.id);
    /* Arrange / Act / Assert scaffold */
    includes(trio.code, "// Arrange", ex.id);
    includes(trio.code, "// Assert", ex.id);
  });
});

/* ---------- per-example claims that pin the teaching notes to reality ----------
   If the generator changes shape, these fail loudly so the notes get updated
   instead of silently lying to the reader. */
test("calculator: return-value assert + numeric Edge [Theory]", () => {
  const trio = trioFile(gen(byId("calculator")).files);
  includes(trio.code, "Assert.Equal(0 /* TODO: expected */, result)", "positive assert");
  includes(trio.code, "[Theory]", "edge theory");
  includes(trio.code, "[InlineData(0, 0)]", "edge rows");
});

test("password-policy: bool positive + null-guard negative + string Edge", () => {
  const trio = trioFile(gen(byId("password-policy")).files);
  includes(trio.code, "Assert.True(result)", "bool positive");
  includes(trio.code, "Assert.Throws<ArgumentNullException>(() => sut.IsStrong(null!))", "null guard");
  includes(trio.code, '[InlineData("")]', "string edge");
});

test("bank-account: void method asserts state via Balance", () => {
  const trio = trioFile(gen(byId("bank-account")).files);
  includes(trio.code, "sut.Balance", "state assert target");
  includes(trio.code, "Deposit_WithNegativeAmount_HandledOrThrows", "numeric negative");
  includes(trio.code, "[InlineData(-1)]", "numeric edge");
});

test("counter-vm: command names + a separate async file", () => {
  const { files } = gen(byId("counter-vm"));
  ok(files.some((f) => f.fileName === "CounterViewModelAsyncTests.cs"), "async file generated");
  const trio = trioFile(files);
  includes(trio.code, "StartCommand", "RelayCommand member");
  includes(trio.code, "vm.Count", "ObservableProperty member");
});

test("weather-service: a generated fake + async throws", () => {
  const trio = trioFile(gen(byId("weather-service")).files);
  includes(trio.code, "new FakeHttpClient()", "fake injected");
  includes(trio.code, "class FakeHttpClient", "fake declared");
  includes(trio.code, "async Task", "async test method");
  includes(trio.code, "Assert.ThrowsAsync<ArgumentNullException>", "async null guard");
});
