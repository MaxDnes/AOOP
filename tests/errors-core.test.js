"use strict";
/* Error Decoder core: a static KB of the build/runtime errors that actually show
   up in the AOP stack, plus a matcher that ranks entries against pasted error
   text and a keyword search. The value is in matching the RIGHT entry fast. */
const { test, ok, eq } = require("./t.js");
const C = require("../data/errors-core.js");

test("KB is non-empty and every entry is well-formed", () => {
  ok(C.ENTRIES.length >= 25, "has a real knowledge base (" + C.ENTRIES.length + ")");
  const cats = C.CATEGORIES.map((c) => c.key);
  C.ENTRIES.forEach((e) => {
    ok(e.id && e.title && e.cause && e.fix && e.file, "entry fields: " + e.id);
    ok(cats.indexOf(e.cat) !== -1, "entry " + e.id + " has a known category: " + e.cat);
    ok(Array.isArray(e.tags) && e.tags.length >= 1, "entry " + e.id + " has tags");
  });
});

test("entry ids are unique", () => {
  const ids = C.ENTRIES.map((e) => e.id);
  eq(ids.length, new Set(ids).size, "duplicate id");
});

test("match: a CS0246 paste lands the missing-using entry first", () => {
  const r = C.match("Error CS0246: The type or namespace name 'ObservableObject' could not be found (are you missing a using directive?)");
  ok(r.length > 0, "got matches");
  eq(r[0].entry.id, "cs0246", "top match is cs0246");
  ok(r[0].why.indexOf("CS0246") !== -1, "explains it matched the code");
});

test("match: invalid-thread message lands the UI-thread entry", () => {
  const r = C.match("System.InvalidOperationException: Call from invalid thread");
  ok(r.length > 0 && r[0].entry.id === "invalid-thread", "top match is the UI-thread fix");
});

test("match: the offline nuget message lands the service-index entry", () => {
  const r = C.match("error: Unable to load the service index for source https://api.nuget.org/v3/index.json.");
  ok(r.length > 0 && r[0].entry.id === "service-index", "top match is offline restore");
});

test("match: 'does not contain a definition for' surfaces the generated-name trap", () => {
  const r = C.match("'MainWindowViewModel' does not contain a definition for 'Add'");
  ok(r.some((x) => x.entry.id === "cs1061"), "cs1061 is in the results");
});

test("match: CS1998 (async lacks await) lands the new compile entry", () => {
  const r = C.match("warning CS1998: This async method lacks 'await' operators and will run synchronously");
  ok(r.length > 0 && r[0].entry.id === "cs1998", "top match is cs1998");
  ok(r[0].entry.cat === "compile", "cs1998 is a compile-category entry");
  ok(r[0].why.indexOf("CS1998") !== -1, "explains it matched the code");
});

test("match: CS4014 (call not awaited) lands the new compile entry", () => {
  const r = C.match("warning CS4014: Because this call is not awaited, execution of the current method continues before the call is completed");
  ok(r.length > 0 && r[0].entry.id === "cs4014", "top match is cs4014");
  ok(r[0].entry.cat === "compile", "cs4014 is a compile-category entry");
  ok(r[0].why.indexOf("CS4014") !== -1, "explains it matched the code");
});

test("match: MVVMTK source-generator codes are tokenized and land the mvvm entry", () => {
  const r19 = C.match("error MVVMTK0019: The field MainWindowViewModel._count cannot be used to generate an observable property");
  ok(r19.length > 0 && r19[0].entry.id === "mvvmtk0019", "MVVMTK0019 top match is mvvmtk0019");
  ok(r19[0].why.indexOf("MVVMTK0019") !== -1, "MVVMTK0019 matched as an exact code, not fuzzy text");
  const r45 = C.match("error MVVMTK0045: Using [ObservableProperty] on a non-partial / non-ObservableObject class");
  ok(r45.some((x) => x.entry.id === "mvvmtk0019"), "MVVMTK0045 also surfaces the same fix");
});

test("match: AVLN0004 / AVLN:0004 match the compiled-binding entry by code", () => {
  const r1 = C.match("/MainWindow.axaml(5,9): error AVLN0004: A compiled binding was used without an x:DataType.");
  ok(r1.length > 0 && r1[0].entry.id === "compiled-binding", "AVLN0004 top match is compiled-binding");
  ok(r1[0].why.indexOf("AVLN0004") !== -1, "AVLN0004 matched as an exact code tag");
  const r2 = C.match("/MainWindow.axaml(5,9): error AVLN:0004: A compiled binding was used without an x:DataType.");
  ok(r2.length > 0 && r2[0].entry.id === "compiled-binding", "AVLN:0004 (colon form) still matches compiled-binding");
});

test("match: a NullReferenceException points at the JSON missing-field trap", () => {
  const r = C.match("Unhandled exception. System.NullReferenceException: Object reference not set to an instance of an object.");
  ok(r.length > 0 && r[0].entry.id === "nullref", "top match is the nullref/json entry");
});

test("match: empty input returns nothing (no false matches)", () => {
  eq(C.match("").length, 0);
  eq(C.match("   ").length, 0);
});

test("search: keyword and code filters work", () => {
  ok(C.search("nuget").length >= 2, "nuget entries found");
  ok(C.search("headless").some((e) => e.id === "headless"), "headless entry found");
  ok(C.search("CS8618").some((e) => e.id === "cs8618"), "code search works");
  ok(C.search("binary search").some((e) => e.id === "binarysearch"), "multi-term search works");
  ok(C.search("CS1998").some((e) => e.id === "cs1998"), "CS1998 code search works");
  ok(C.search("CS4014").some((e) => e.id === "cs4014"), "CS4014 code search works");
  ok(C.search("MVVMTK0019").some((e) => e.id === "mvvmtk0019"), "MVVMTK code search works");
});

test("search: empty query returns the whole KB", () => {
  eq(C.search("").length, C.ENTRIES.length);
});

test("byCategory groups entries", () => {
  ok(C.byCategory("async").length >= 2, "async group");
  ok(C.byCategory("nuget").length >= 3, "nuget group");
  ok(C.byCategory("compile").length >= 5, "compile group");
});

test("every category has at least one entry (no empty tabs)", () => {
  C.CATEGORIES.forEach((c) => ok(C.byCategory(c.key).length >= 1, "empty category: " + c.key));
});
