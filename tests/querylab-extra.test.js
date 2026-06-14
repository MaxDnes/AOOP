"use strict";
/* Query Lab: the three exam presets, the free-text (plain-English) query engine,
   and the populated results-JSON export. Pure core-level tests (no DOM globals)
   so they don't contaminate the UI tests in querylab-core.test.js. */
const { test, eq, ok, includes } = require("./t.js");
const C = require("../data/querylab-core.js");

/* ---------- shared helpers ---------- */
function presetModel(p) {
  const parsed = C.parseSample(p.sample, { classNames: p.classNames, rootClass: p.rootClass, allNullable: true });
  ok(parsed.ok, p.name + ": sample parses");
  return parsed.model;
}
function runRow(p, model, row) {
  const ex = C.extractRows(p.sample);
  ok(ex.ok, p.name + ": extractRows ok");
  return C.runQuery(model, row, ex.rows, p.overrides || {});
}
function rowByKey(p, key) { return p.rows.filter((r) => (r.outputKey || r.name) === key)[0]; }
function rowByShape(p, shape) { return p.rows.filter((r) => r.shape === shape)[0]; }

/* ============================================================
   presets registered
   ============================================================ */
test("the three exam presets are registered + look-up by key", () => {
  const all = C.presets();
  ["workshops", "lighthouses", "comics"].forEach((k) => ok(all[k], "preset " + k + " present in presets()"));
  ok(C.presetByKey("workshops"), "presetByKey('workshops')");
  eq(C.presetByKey("does-not-exist"), null, "unknown key -> null");
});

/* ============================================================
   Workshops (CSV): parse-it-yourself, quoted fields, missing values
   ============================================================ */
test("workshops CSV preset: every query returns the exam-correct set", () => {
  const p = C.workshopsPreset();
  const m = presetModel(p);
  eq(m.csvMode, true, "CSV mode detected");
  eq(m.rootClass, "Workshop", "model class is named Workshop");
  eq(runRow(p, m, rowByKey(p, "woodworkingWorkshops")).data.length, 4, "4 Woodworking workshops");
  eq(runRow(p, m, rowByKey(p, "missingInstructor")).data.length, 3, "3 workshops with no instructor");
  const sorted = runRow(p, m, rowByKey(p, "sortedBySignups")).data;
  eq(sorted.length, 9, "sort returns every row");
  eq(sorted[0].Title, "Laser Cut Coasters", "highest signups (20) sorts first");
  eq(sorted[sorted.length - 1].Signups, null, "a missing-signups row sinks to the bottom");
  const above = runRow(p, m, rowByKey(p, "aboveAverageSignups"));
  eq(above.data.length, 3, "3 workshops above the known-value average");
  includes(above.note, "12.43", "average is over known values only (87/7)");
});

test("workshops quoted field with a comma parses as one cell", () => {
  const p = C.workshopsPreset();
  const ex = C.extractRows(p.sample);
  const soldering = ex.rows.filter((r) => r.Id === "1")[0];
  eq(soldering.Title, "Soldering Basics, Part 1", "quoted comma stays inside the title");
  eq(soldering.Tag, "Electronics", "the column after the quoted field is not shifted");
});

test("workshops results JSON: exact 4 keys, typed Signups, null for missing", () => {
  const r = C.resultsJsonFromPreset(C.workshopsPreset());
  ok(r.ok, "results JSON built");
  const obj = JSON.parse(r.json);
  eq(Object.keys(obj).join(","), "woodworkingWorkshops,missingInstructor,sortedBySignups,aboveAverageSignups", "exact exam keys, in order");
  eq(obj.sortedBySignups[0].Signups, 20, "Signups serializes as a number");
  eq(obj.sortedBySignups[obj.sortedBySignups.length - 1].Signups, null, "missing Signups serializes as null");
  ok(obj.missingInstructor.every((w) => w.Instructor === null), "missing Instructor serializes as null");
});

/* ============================================================
   Lighthouses (JSON): nested inspections, nullable keeper, binary search
   ============================================================ */
test("lighthouses preset: nested-collection queries + grouping + binary search", () => {
  const p = C.lighthousesPreset();
  const m = presetModel(p);
  eq(m.rootClass, "Lighthouse", "root class named Lighthouse");
  ok(m.byName["Inspection"], "nested class named Inspection");
  eq(runRow(p, m, rowByKey(p, "automated")).data.length, 3, "3 automated (flag == true)");
  eq(runRow(p, m, rowByKey(p, "unkept")).data.length, 3, "3 with no keeper (null or missing)");
  eq(runRow(p, m, rowByKey(p, "sortedByInspectionCount")).data[0].name, "Dawnreef Tower", "most-inspected (3) first");
  eq(runRow(p, m, rowByKey(p, "averageInspectionsPerRegion")).data.length, 3, "one average per region");
  eq(runRow(p, m, rowByKey(p, "gullhaven2245")).data.length, 2, "Gullhaven home port with a 2245 inspection");
  const bs = runRow(p, m, rowByShape(p, "binary-search"));
  eq(bs.data.length, 1, "binary search finds Gannet Stack Light");
  eq(bs.data[0].name, "Gannet Stack Light", "the found lighthouse is returned");
});

test("lighthouses results JSON: missing/explicit-null keeper both serialize as null", () => {
  const r = C.resultsJsonFromPreset(C.lighthousesPreset());
  ok(r.ok, "results JSON built");
  const obj = JSON.parse(r.json);
  ok(obj.unkept.every((l) => l.Keeper === null), "every unkept lighthouse has Keeper === null");
});

/* ============================================================
   Comics (JSON): before-2000, per-author count, most-active-per-year
   ============================================================ */
test("comics preset: filter + grouped count + most-frequent-per-group", () => {
  const p = C.comicsPreset();
  const m = presetModel(p);
  eq(m.rootClass, "Comic", "root class named Comic");
  eq(runRow(p, m, rowByKey(p, "releasedBefore2000")).data.length, 4, "4 comics before 2000");
  const perAuthor = runRow(p, m, rowByKey(p, "comicsPerAuthor")).data;
  eq(perAuthor[0].Key, "Mara Stone", "most-prolific author first");
  eq(perAuthor[0].Value, 4, "Mara Stone wrote 4");
  const perYear = runRow(p, m, rowByKey(p, "mostActiveAuthorPerYear")).data;
  eq(perYear.length, 5, "one winner per distinct year");
  /* ordered ascending by year; 2001 is a 3-way that Mara Stone wins (2 of 3) */
  const y2001 = perYear.filter((x) => String(x.ReleaseYear) === "2001")[0];
  eq(y2001.Author, "Mara Stone", "2001's most active author is Mara Stone");
});

/* ============================================================
   codegen: each preset emits compiling-shaped submission files
   ============================================================ */
test("each new preset generates the expected submission C#", () => {
  const ws = C.generateSubmissionFromPreset(C.workshopsPreset());
  ok(ws.ok, "workshops submission generated");
  includes(ws.models, "class Workshop", "Models.cs declares Workshop");
  includes(ws.program, "Split", "workshops Program.cs parses the CSV itself");
  includes(ws.program, "woodworkingWorkshops", "output key wired into the results JSON");

  const lh = C.generateSubmissionFromPreset(C.lighthousesPreset());
  ok(lh.ok, "lighthouses submission generated");
  includes(lh.models, "class Lighthouse", "Models.cs declares Lighthouse");
  includes(lh.models, "class Inspection", "Models.cs declares the nested Inspection");
  includes(lh.program, "BinarySearch", "lighthouses Program.cs uses BinarySearch");
  includes(lh.program, "GroupBy", "lighthouses Program.cs groups by region");

  const cm = C.generateSubmissionFromPreset(C.comicsPreset());
  ok(cm.ok, "comics submission generated");
  includes(cm.models, "class Comic", "Models.cs declares Comic");
  includes(cm.program, "GroupBy", "comics Program.cs groups");
});

/* ============================================================
   free-text (plain-English) query engine
   ============================================================ */
const GPUS = JSON.stringify([
  { name: "RTX 4090", releaseYear: 2022, vram: 24 },
  { name: "RTX 4080", releaseYear: 2023, vram: 16 },
  { name: "RTX 5090", releaseYear: 2025, vram: 32 },
  { name: "GTX 1660", releaseYear: 2019, vram: 6 },
  { name: "RX 7900", releaseYear: 2022, vram: 20 },
]);
function gpuModel() { return C.parseSample(GPUS, { allNullable: true }).model; }
function gpuRows() { return C.extractRows(GPUS).rows; }
function names(data) { return data.map((x) => x.name).sort().join(","); }

test("free-text example 1: 'released after 2023 and whose name start with rtx'", () => {
  const r = C.freeQuery(gpuModel(), "gpus released after 2023 and whose name start with rtx", gpuRows(), {});
  ok(r.ok, r.error);
  includes(r.predicate, "s.ReleaseYear > 2023", "after 2023 -> > 2023 on ReleaseYear (synonym resolved)");
  includes(r.predicate, 'StartsWith("rtx", StringComparison.OrdinalIgnoreCase)', "name starts with rtx");
  includes(r.predicate, "&&", "joined with AND");
  eq(names(r.data), "RTX 5090", "only the 2025 RTX matches");
});

test("free-text example 2: 'released before 2022 or named gtx 1660'", () => {
  const r = C.freeQuery(gpuModel(), "released before 2022 or named gtx 1660", gpuRows(), {});
  ok(r.ok, r.error);
  includes(r.predicate, "s.ReleaseYear < 2022", "before 2022 -> < 2022");
  includes(r.predicate, 'string.Equals(s.Name, "gtx 1660"', "named -> equals on the name field");
  includes(r.predicate, "||", "joined with OR");
  eq(names(r.data), "GTX 1660", "the 2019 GTX matches both branches");
});

test("free-text: parentheses + precedence + 'at least' + symbols", () => {
  const r = C.freeQuery(gpuModel(), "released >= 2022 and (name contains 90 or vram at least 30)", gpuRows(), {});
  ok(r.ok, r.error);
  includes(r.predicate, "s.ReleaseYear >= 2022");
  includes(r.predicate, "s.Vram >= 30");
  /* 4090(2022,name90), 5090(2025,name90), 7900(2022,name90); 4080 excluded (no 90, vram16) */
  eq(names(r.data), "RTX 4090,RTX 5090,RX 7900");
});

test("free-text: 'ends with' and case-insensitive matching", () => {
  const r = C.freeQuery(gpuModel(), "name ends with 90", gpuRows(), {});
  ok(r.ok, r.error);
  includes(r.predicate, 'EndsWith("90"');
  /* RX 7900 ends with "00", not "90" — only the two *90 cards match */
  eq(names(r.data), "RTX 4090,RTX 5090");
});

test("free-text: is null / is not null over a nested collection (lighthouses)", () => {
  const p = C.lighthousesPreset();
  const m = presetModel(p);
  const rows = C.extractRows(p.sample).rows;
  const unkept = C.freeQuery(m, "keeper is null", rows, {});
  ok(unkept.ok, unkept.error);
  eq(unkept.data.length, 3, "3 lighthouses with no keeper");
  const inspected = C.freeQuery(m, "homeport is gullhaven and inspections is not empty", rows, {});
  ok(inspected.ok, inspected.error);
  eq(inspected.data.map((l) => l.name).sort().join(","), "Gannet Stack Light,Saltmarsh Beacon", "Lowtide (empty inspections) is excluded");
});

test("free-text: a friendly error for an unknown field", () => {
  const r = C.freeQuery(gpuModel(), "frobnicator > 3", gpuRows(), {});
  ok(!r.ok, "unknown field is rejected");
  includes(r.error, "unknown field", "error names the problem");
});

test("free-text: empty / whitespace query is rejected, never throws", () => {
  const r = C.freeQuery(gpuModel(), "   ", gpuRows(), {});
  ok(!r.ok, "empty query rejected");
});

test("free-text: code is emitted even when no data rows are supplied", () => {
  const r = C.freeQuery(gpuModel(), "name starts with rtx", null, {});
  ok(r.ok, r.error);
  includes(r.csharp, ".Where(s =>", "generates a Where lambda");
  eq(r.data, null, "no data array when rows omitted");
});
