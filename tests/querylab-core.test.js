"use strict";
const { test, eq, ok, includes, notIncludes } = require("./t.js");
const C = require("../data/querylab-core.js");

/* ---------- helpers ---------- */

/* brace-balance over generated C# (no string/comment stripping needed here:
   the generated code has no braces inside string literals except the interpolation
   holes "{x}", which are balanced, so a raw count is correct). */
function braceBalanced(code) {
  let d = 0;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === "{") d++;
    else if (code[i] === "}") { d--; if (d < 0) throw new Error("braceBalanced: extra } at " + i); }
  }
  if (d !== 0) throw new Error("braceBalanced: unbalanced, depth " + d);
  return true;
}
function parenBalanced(code) {
  let d = 0;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === "(") d++;
    else if (code[i] === ")") { d--; if (d < 0) throw new Error("parenBalanced: extra ) at " + i); }
  }
  if (d !== 0) throw new Error("parenBalanced: unbalanced, depth " + d);
  return true;
}

/* a spaceships-like sample exercising the exam traps:
   - nested trips (object array -> nested class)
   - one null arrivalDate (nullable)
   - one element missing "name" (nullable string)
   - camelCase keys (force [JsonPropertyName]) */
const SHIP_SAMPLE = JSON.stringify([
  {
    "shipId": "S1", "name": "Rocinante", "type": "Military",
    "travelHistory": [
      { "tripId": "T1", "departureDate": "2245-01-01", "arrivalDate": "2245-02-01" },
      { "tripId": "T2", "departureDate": "2245-03-01", "arrivalDate": null }
    ]
  },
  { "shipId": "S2", "type": "Cargo", "travelHistory": [] }
]);

/* default to the UI/preset posture (allNullable: true) so the null-safe idioms
   the exam expects show up; pass an explicit opts to test faithful inference. */
function modelOf(text, opts) {
  const r = C.parseSample(text, opts === undefined ? { allNullable: true } : opts);
  ok(r.ok, "parse should succeed: " + (r.error || ""));
  return r.model;
}

/* ============ inference: nullability, nesting, attributes ============ */
test("inference: missing field -> nullable string; nested object array -> nested class", () => {
  const m = modelOf(SHIP_SAMPLE, {});   /* faithful inference: nullability driven by the sample */
  const root = m.byName[m.rootClass];
  ok(root, "root class inferred");
  /* name is missing from S2 -> nullable */
  const name = root.fields.find((f) => f.key === "name");
  ok(name, "name field present");
  ok(name.nullable, "name must be nullable (missing in one element)");
  eq(name.baseType, "string");
  /* travelHistory -> collection of a nested class */
  const th = root.fields.find((f) => f.key === "travelHistory");
  ok(th.isCollection, "travelHistory is a collection");
  ok(th.nestedClass, "travelHistory has a nested element class");
  /* the nested class exists in the model with the trip fields */
  const trip = m.byName[th.nestedClass];
  ok(trip, "nested Trip class present");
  ok(trip.fields.some((f) => f.key === "arrivalDate" && f.nullable), "arrivalDate null in one element -> nullable");
});

test("inference: [JsonPropertyName] emitted for camelCase keys, omitted when property == key", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = C.emitModelClasses(m);
  /* camelCase key shipId -> property ShipId with the attribute */
  includes(code, '[JsonPropertyName("shipId")]');
  includes(code, "public string? ShipId { get; set; }");
  includes(code, '[JsonPropertyName("travelHistory")]');
});

test("inference: List default convention (= new()) for non-null collection, nullable when seen empty/missing", () => {
  /* a sample where the list is always present & non-empty -> non-null List with = new() */
  const sample = JSON.stringify([
    { "name": "A", "ingredients": ["x", "y"] },
    { "name": "B", "ingredients": ["z"] },
  ]);
  const m = modelOf(sample, {});   /* faithful inference: present everywhere -> non-null collection */
  const code = C.emitModelClasses(m);
  includes(code, "public List<string> Ingredients { get; set; } = new();");
});

test("inference: object-wrapped JSON (one array property) is unwrapped", () => {
  const sample = JSON.stringify({ "recipes": [{ "name": "A", "tags": [] }] });
  const m = modelOf(sample);
  eq(m.rootKey, "recipes");
  ok(m.byName[m.rootClass], "root element class inferred from wrapped array");
});

test("inference: ISO date strings flagged for the string/DateTime toggle", () => {
  ok(C.looksLikeDate("2245-03-01"), "yyyy-MM-dd is a date");
  ok(C.looksLikeDate("2245-03-01T10:00:00"), "with time is a date");
  ok(!C.looksLikeDate("hello"), "plain text is not a date");
  const m = modelOf(SHIP_SAMPLE);
  const trip = m.byName[m.byName[m.rootClass].fields.find((f) => f.key === "travelHistory").nestedClass];
  ok(trip.fields.find((f) => f.key === "arrivalDate").isDateString, "arrivalDate is a date string");
});

/* ============ per-shape LINQ fragments ============ */
function genRow(model, row, opts) {
  return C.generateProgram(model, [row], opts || {});
}

test("shape filter-equals: case-insensitive uses string.Equals + Ordinal", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = genRow(m, { shape: "filter-equals", field: "type", value: "Military", name: "q1", caseInsensitive: true });
  includes(code, "string.Equals(s.Type, \"Military\", StringComparison.OrdinalIgnoreCase)");
});

test("shape filter-equals: plain equality", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = genRow(m, { shape: "filter-equals", field: "type", value: "Military", name: "q1" });
  includes(code, "s.Type == \"Military\"");
  includes(code, ".Where(");
  includes(code, ".ToList()");
});

test("shape filter-contains: string collection -> null-safe ?.Contains(...) ?? false", () => {
  const sample = JSON.stringify([{ "name": "A", "dietaryTags": ["Vegetarian"] }, { "name": "B" }]);
  const m = modelOf(sample);
  const code = genRow(m, { shape: "filter-contains", field: "dietaryTags", value: "Vegetarian", name: "q1" });
  includes(code, "?.Contains(\"Vegetarian\") ?? false");
});

test("shape filter-empty-collection: (X?.Count ?? 0) == 0", () => {
  const sample = JSON.stringify([{ "name": "A", "dietaryTags": ["Vegetarian"] }, { "name": "B", "dietaryTags": [] }]);
  const m = modelOf(sample);
  const code = genRow(m, { shape: "filter-empty-collection", field: "dietaryTags", name: "q1" });
  includes(code, "?.Count ?? 0) == 0");
});

test("shape filter-nested-any: Any with null match + null-safe enumerable", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = genRow(m, { shape: "filter-nested-any", collection: "travelHistory", subField: "arrivalDate", match: "null", name: "q1" });
  includes(code, ".Any(t => t.ArrivalDate == null)");
  /* enumerable guarded against null collection */
  includes(code, "?? new())");
});

test("shape filter-nested-any year: DateTime override -> ?.Year == N, string -> StartsWith", () => {
  const m = modelOf(SHIP_SAMPLE);
  /* the override key uses the inferred nested class name (TravelHistory here) */
  const nestedName = m.byName[m.rootClass].fields.find((f) => f.key === "travelHistory").nestedClass;
  const dt = genRow(m, { shape: "filter-nested-any", collection: "travelHistory", subField: "departureDate", match: "year", value: "2245", name: "q1" },
    { overrides: { [nestedName + ".departureDate"]: "DateTime" } });
  includes(dt, "?.Year == 2245");
  const str = genRow(m, { shape: "filter-nested-any", collection: "travelHistory", subField: "departureDate", match: "year", value: "2245", name: "q1" });
  includes(str, "StartsWith(\"2245\")");
});

test("shape sort-by: collection count desc -> OrderByDescending with ?.Count ?? 0; ThenBy optional", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = genRow(m, { shape: "sort-by", field: "travelHistory", byCount: true, direction: "desc", thenBy: "name", thenDirection: "asc", name: "q1" });
  includes(code, "OrderByDescending(s => s.TravelHistory?.Count ?? 0)");
  includes(code, "ThenBy(s => s.Name)");
});

test("shape group-aggregate: GroupBy + Average over collection count, anonymous {Key, Value}", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = genRow(m, { shape: "group-aggregate", field: "type", aggregate: "Average", subField: "travelHistory", subCount: true, name: "q1" });
  includes(code, "GroupBy(s => s.Type ?? \"Unknown\")");
  includes(code, "Average(x => x.TravelHistory?.Count ?? 0)");
  includes(code, "new { Key = g.Key, Value =");
});

test("shape above-average: average computed once, strictly-greater compare", () => {
  const sample = JSON.stringify([{ "name": "A", "ingredients": ["x", "y"] }, { "name": "B", "ingredients": ["z"] }]);
  const m = modelOf(sample);
  const code = genRow(m, { shape: "above-average", field: "ingredients", byCount: true, name: "q1" });
  includes(code, "double q1Average = source.Any() ? source.Average(");
  includes(code, "> q1Average)");
  notIncludes(code, ">= q1Average", "above-average must be strictly greater");
});

test("shape top-n: OrderBy + Take", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = genRow(m, { shape: "top-n", field: "travelHistory", byCount: true, direction: "desc", n: 3, name: "q1" });
  includes(code, ".Take(3)");
  includes(code, "OrderByDescending(");
});

test("shape select-fields: projection to chosen fields", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = genRow(m, { shape: "select-fields", fields: ["name", "type"], name: "q1" });
  includes(code, ".Select(s => new { Name = s.Name, Type = s.Type })");
});

test("shape binary-search: Comparer<T>.Create null-safe + BinarySearch idiom", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = genRow(m, { shape: "binary-search", field: "name", value: "Rocinante", name: "q1", print: true });
  includes(code, "Comparer<");
  includes(code, ".Create(");
  includes(code, "string.Compare(a.Name ?? \"\", b.Name ?? \"\", StringComparison.Ordinal)");
  includes(code, ".BinarySearch(");
  includes(code, "OrderBy(s => s.Name, StringComparer.Ordinal)");
});

/* ============ exact-key output JSON ============ */
test("exact-key output: anonymous object with user keys + WriteIndented", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = C.generateProgram(m, [
    { shape: "filter-equals", field: "type", value: "Military", name: "mil", output: true, outputKey: "militaryShips" },
  ], { outputFile: "Problem_4_Query_Results.json" });
  includes(code, "var results = new");
  includes(code, "militaryShips = mil");
  includes(code, "WriteIndented = true");
  includes(code, "File.WriteAllText(\"Problem_4_Query_Results.json\"");
});

test("output key equal to var name collapses to shorthand member", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = C.generateProgram(m, [
    { shape: "filter-equals", field: "type", value: "Military", name: "vegetarianRecipes", output: true, outputKey: "vegetarianRecipes" },
  ], {});
  /* anonymous shorthand: just the name, no "= name" */
  includes(code, "            vegetarianRecipes\n");
  notIncludes(code, "vegetarianRecipes = vegetarianRecipes");
});

test("input/output file names are threaded into the generated code", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = C.generateProgram(m, [], { inputFile: "spaceships.json", outputFile: "out.json" });
  includes(code, 'File.ReadAllText("spaceships.json")');
  includes(code, "PropertyNameCaseInsensitive = true");
});

/* ============ presets ============ */
test("preset summer: calibration idioms present, brace-balanced, no TODO", () => {
  const r = C.generateFromPreset(C.summerPreset());
  ok(r.ok, "summer preset generates");
  const code = r.code;
  /* the model-solution idioms */
  includes(code, "OrderByDescending");
  includes(code, "GroupBy");
  includes(code, "Average");
  includes(code, "BinarySearch");
  includes(code, "Comparer<");
  includes(code, "?.Count ?? 0");
  includes(code, "?.Year == 2245");
  /* class names match the verified model solution */
  includes(code, "public class Spaceship");
  includes(code, "public class Trip");
  includes(code, "List<Spaceship>");
  /* exact output keys */
  includes(code, "militaryShips");
  includes(code, "averageTripsByType");
  notIncludes(code, "TODO", "preset output must have no TODO stubs");
  braceBalanced(code);
  parenBalanced(code);
});

test("preset reexam: recipes idioms, exact keys, brace-balanced, no TODO", () => {
  const r = C.generateFromPreset(C.reexamPreset());
  ok(r.ok, "reexam preset generates");
  const code = r.code;
  includes(code, "?.Contains(\"Vegetarian\") ?? false");
  includes(code, "?.Count ?? 0) == 0");
  includes(code, "OrderByDescending(s => s.Ingredients?.Count ?? 0)");
  includes(code, "source.Average(");
  /* exact output keys from the model solution */
  includes(code, "vegetarianRecipes");
  includes(code, "noDietaryRestrictions");
  includes(code, "sortedByIngredientCount");
  includes(code, "aboveAverageIngredients");
  includes(code, "public class Recipe");
  notIncludes(code, "TODO", "preset output must have no TODO stubs");
  braceBalanced(code);
  parenBalanced(code);
});

test("presets() returns both named presets with sample + rows", () => {
  const p = C.presets();
  ok(p.summer && p.reexam, "both presets present");
  ok(p.summer.rows.length >= 5, "summer has the full query set");
  ok(p.reexam.rows.length >= 4, "reexam has the four queries");
  ok(p.summer.sample.indexOf("travelHistory") !== -1, "summer sample has nested trips");
});

/* ============ robustness / safety ============ */
test("garbage input returns a friendly error, never throws", () => {
  const r = C.parseSample("}}}{ not json %%%");
  eq(r.ok, false);
  ok(typeof r.error === "string" && r.error.length > 0, "error message present");
});

test("empty input returns a friendly error", () => {
  const r = C.parseSample("   ");
  eq(r.ok, false);
});

test("non-array, non-wrapping object errors clearly", () => {
  const r = C.parseSample(JSON.stringify({ a: 1, b: 2 }));
  eq(r.ok, false);
  includes(r.error, "array");
});

test("generateProgram never throws on an empty model", () => {
  const m = modelOf(SHIP_SAMPLE);
  const code = C.generateProgram(m, [], {});
  ok(typeof code === "string" && code.length > 0, "code produced");
  braceBalanced(code);
});

/* ============ shape coverage ============ */
test("all spec shapes are registered", () => {
  const keys = C.shapeKeys();
  ["filter-equals", "filter-contains", "filter-empty-collection", "filter-nested-any",
   "sort-by", "group-aggregate", "above-average", "top-n", "select-fields", "binary-search"]
    .forEach((s) => ok(keys.indexOf(s) !== -1, "shape registered: " + s));
});

/* ============ UI module loads under Node + escapes HTML ============ */
test("querylab.js never touches document at load time (only inside functions)", () => {
  const fs = require("fs");
  const src = fs.readFileSync(__dirname + "/../data/querylab.js", "utf8");
  const topLevel = src.replace(/function[\s\S]*?\n\}/g, "");
  ok(topLevel.indexOf("document.") === -1, "document.* found at top level");
});

test("querylab UI module loads under Node and exposes render/init", () => {
  global.window = global;
  require("../data/querylab-core.js");
  require("../data/querylab.js");
  ok(typeof global.QUERYLAB.render === "function", "QUERYLAB.render missing");
  ok(typeof global.QUERYLAB.init === "function", "QUERYLAB.init missing");
  ok(global.QL && typeof global.QL.loadPreset === "function", "handlers must live on window.QL");
  ok(typeof global.QL.addQuery === "function", "QL.addQuery missing");
});

test("rendered output escapes HTML in pasted JSON (XSS-safe)", () => {
  const els = {};
  global.window = global;
  global.localStorage = {
    _d: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
  };
  global.document = {
    getElementById(id) { return els[id] || (els[id] = { innerHTML: "", textContent: "", value: "" }); },
  };
  require("../data/querylab-core.js");
  require("../data/querylab.js");
  const page = global.QUERYLAB.render();
  ok(page.indexOf("QUERY LAB") !== -1, "render produced page");
  /* paste JSON whose KEY carries an XSS payload (keys flow into property names,
     [JsonPropertyName(...)] and the model card), then regenerate. */
  global.QL.setJson('[{"na<script>alert(1)</script>me":"x","ok":1}]');
  const modelEl = els["ql-models"];
  ok(modelEl && modelEl.innerHTML.length > 0, "model card rendered");
  notIncludes(modelEl.innerHTML, "<script>", "raw <script> must never reach the model card innerHTML");
  includes(modelEl.innerHTML, "&lt;", "angle brackets must be escaped in the model card");
  /* and the generated code card must escape too */
  const codeEl = els["ql-output"];
  if (codeEl) notIncludes(codeEl.innerHTML, "<script>alert(1)</script>", "raw payload must never reach the code card innerHTML");
});

/* ============================================================
   spec 13/14: project export, version-stamped state, error states
   ============================================================ */

/* a fresh in-memory localStorage + minimal DOM, plus the (cached) UI module.
   Returns { els, store, UI, QL } reset to a clean state for the test. */
function freshUI() {
  const els = {};
  global.window = global;
  const store = {
    _d: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
  };
  global.localStorage = store;
  global.document = {
    body: { appendChild() {}, removeChild() {} },
    createElement() { return { click() {}, setAttribute() {}, style: {} }; },
    getElementById(id) { return els[id] || (els[id] = { innerHTML: "", textContent: "", value: "", getAttribute() { return null; }, setAttribute() {}, classList: { add() {}, remove() {} } }); },
  };
  /* re-evaluate the UI module so its private `state` starts null (Node caches
     modules; without this the previous test's state would leak in). */
  require("../data/querylab-core.js");
  delete require.cache[require.resolve("../data/querylab.js")];
  const UI = require("../data/querylab.js");
  return { els, store, UI, QL: global.QL };
}

test("state is version-stamped {v:1, state} on save and round-trips on reload", () => {
  const f = freshUI();
  f.QL.loadPreset("summer");
  /* the persisted payload must carry the version stamp */
  const rawTxt = f.store.getItem("aop-querylab-state");
  ok(rawTxt, "state persisted to localStorage");
  const raw = JSON.parse(rawTxt);
  eq(raw.v, 1, "payload carries v:1 version stamp");
  ok(raw.state && typeof raw.state === "object", "real state nested under .state");
  ok(raw.state.json.indexOf("travelHistory") !== -1, "summer sample round-tripped");
  ok(Array.isArray(raw.state.rows) && raw.state.rows.length >= 5, "rows round-tripped");
  ok(typeof raw.state.projectName === "string", "projectName persisted");
});

test("loading a legacy (unstamped) payload still hydrates the lab", () => {
  const f = freshUI();
  /* simulate a v4 payload written before the version stamp existed (flat shape) */
  f.store.setItem("aop-querylab-state", JSON.stringify({
    json: '[{"name":"A","tags":["x"]}]',
    inputFile: "legacy.json", outputFile: "out.json", namespace: "Legacy", rows: [],
  }));
  /* re-render reads through loadState/migrateState; must not throw and must keep data */
  let page;
  try { page = global.QUERYLAB.render(); } catch (e) { ok(false, "render threw on legacy payload: " + e.message); return; }
  ok(page.indexOf("QUERY LAB") !== -1, "rendered from legacy payload");
  /* the json textarea must carry the migrated legacy value */
  includes(page, "legacy.json");
});

test("an unknown / future payload shape degrades to defaults, never throws", () => {
  const f = freshUI();
  f.store.setItem("aop-querylab-state", JSON.stringify({ v: 999, weird: true, state: 42 }));
  let page;
  try { page = global.QUERYLAB.render(); } catch (e) { ok(false, "render threw on unknown payload: " + e.message); return; }
  ok(page.indexOf("Query Lab") !== -1, "render survived an unknown payload shape");
});

test("export project button renders when PROJZIP is loaded, hidden when absent", () => {
  const f = freshUI();
  /* without PROJZIP: no export button, no crash */
  delete global.PROJZIP;
  f.QL.loadPreset("summer");
  let outNo = f.els["ql-output"].innerHTML;
  notIncludes(outNo, "Export project", "export button must be hidden when PROJZIP missing");
  ok(outNo.indexOf("Copy all") !== -1, "Copy all still present without PROJZIP");
  /* with PROJZIP loaded: the export button + project-name input appear */
  require("../data/projzip-core.js");   /* sets global.PROJZIP */
  global.QUERYLAB.render();             /* re-render output through the model */
  f.QL.loadPreset("summer");
  let outYes = f.els["ql-output"].innerHTML;
  includes(outYes, "Export project", "export button shows when PROJZIP present");
  includes(outYes, "QueryConsole", "default project name in the input");
});

test("exportProject builds a console project zip from generated code + pasted JSON", () => {
  const f = freshUI();
  const Z = require("../data/projzip-core.js");
  global.PROJZIP = Z;
  f.QL.loadPreset("summer");
  /* capture the entries the UI would zip by stubbing makeZipBlobUrl */
  let captured = null;
  const realConsole = Z.consoleProject;
  const realBlob = Z.makeZipBlobUrl;
  Z.makeZipBlobUrl = function (entries) { captured = entries; return "blob:fake"; };
  try {
    f.QL.exportProject(f.els["ql-export-btn"]);
  } finally {
    Z.makeZipBlobUrl = realBlob;
  }
  ok(captured, "export produced zip entries");
  const paths = captured.map((e) => e.path);
  includes(paths.join(","), "QueryConsole.csproj");
  includes(paths.join(","), "Program.cs");
  /* the pasted sample JSON is saved under the configured input-file name */
  includes(paths.join(","), "spaceships.json");
  /* the data file content is the pasted sample, the Program.cs is the generated code */
  const dataEntry = captured.find((e) => e.path === "spaceships.json");
  ok(dataEntry && dataEntry.text.indexOf("travelHistory") !== -1, "data file carries the pasted sample");
  const progEntry = captured.find((e) => e.path === "Program.cs");
  ok(progEntry && progEntry.text.indexOf("BinarySearch") !== -1, "Program.cs is the generated query code");
  /* csproj copies the data file to the output dir so dotnet run finds it */
  const csproj = captured.find((e) => e.path === "QueryConsole.csproj");
  includes(csproj.text, "CopyToOutputDirectory");
  includes(csproj.text, "spaceships.json");
});

test("garbage JSON renders the styled error panel, never throws", () => {
  const f = freshUI();
  let threw = false;
  try {
    f.QL.setJson("}}}{ not json at all %%%");
  } catch (e) { threw = true; }
  eq(threw, false, "setJson must not throw on garbage");
  const modelEl = f.els["ql-models"];
  includes(modelEl.innerHTML, "parse error", "garbage renders the parse-error panel");
  includes(modelEl.innerHTML, "ql-parse-err", "error uses the styled red panel class");
});

test("toolbar header renders title, subtitle and grouped controls", () => {
  const f = freshUI();
  const page = global.QUERYLAB.render();
  includes(page, "ql-toolbar");
  includes(page, "Summer spaceships");
  includes(page, "ReExam recipes");
  includes(page, "ql-sub");                 /* one-line subtitle */
  includes(page, "Start here");             /* 1-2-3 empty-state hint */
});

test("empty-state step 3 ends the click path at Download submission files with the two exact P4 file names", () => {
  const f = freshUI();                      /* fresh state has no JSON -> empty-state hint renders */
  const page = global.QUERYLAB.render();
  includes(page, "Start here", "empty-state 1-2-3 hint present");
  /* step 3 must finish the click path at the actual P4 deliverable button */
  includes(page, "Download submission files", "step 3 names the Download submission files button");
  /* and it must spell out the two exact hand-in file names */
  includes(page, "Problem_4_Program.cs", "step 3 names the Program submission file");
  includes(page, "Problem_4_Models.cs", "step 3 names the Models submission file");
  /* the header subtitle also routes the user to the submission button */
  includes(page, "ql-sub", "subtitle present");
  const subStart = page.indexOf('class="ql-sub"');
  const subEnd = page.indexOf("</p>", subStart);
  const subtitle = page.slice(subStart, subEnd);
  includes(subtitle, "Download submission files", "subtitle ends the click path at Download submission files");
});

/* ============================================================
   spec 16: two-file SUBMISSION export (Problem_4_Program.cs + Problem_4_Models.cs)
   ============================================================ */

/* every `using X;` directive in a chunk of C#, as the bare namespace string */
function usingsOf(code) {
  const out = [];
  String(code).split("\n").forEach((ln) => {
    const m = /^\s*using\s+([A-Za-z0-9_.]+)\s*;/.exec(ln);
    if (m) out.push(m[1]);
  });
  return out;
}
/* the meaningful code of a file: drop blank lines, `using`s and the
   `namespace ...;` line so we can compare what actually declares types/members
   across the single-file vs two-file paths. */
function meaningful(code) {
  return String(code).split("\n")
    .filter((ln) => ln.trim().length > 0)
    .filter((ln) => !/^\s*using\s+[A-Za-z0-9_.]+\s*;/.test(ln))
    .filter((ln) => !/^\s*namespace\s+[A-Za-z0-9_.]+\s*;/.test(ln))
    .map((ln) => ln.replace(/\s+$/, ""))
    .join("\n").trim();
}

test("submission split: Program.cs has Program + queries, Models.cs has the model classes", () => {
  const r = C.generateSubmissionFromPreset(C.summerPreset());
  ok(r.ok, "summer submission generates");
  /* Program.cs: the runnable side */
  includes(r.program, "namespace Spaceships;");
  includes(r.program, "internal class Program");
  includes(r.program, "private static void Main()");
  includes(r.program, "JsonSerializer.Deserialize<List<Spaceship>>");
  includes(r.program, "BinarySearch");
  /* the model classes must NOT be duplicated into Program.cs */
  notIncludes(r.program, "public class Spaceship", "model class must live only in Models.cs");
  notIncludes(r.program, "public class Trip", "nested model class must live only in Models.cs");
  /* Models.cs: the types side, same namespace */
  includes(r.models, "namespace Spaceships;");
  includes(r.models, "public class Spaceship");
  includes(r.models, "public class Trip");
  /* Models.cs must not carry Program/Main */
  notIncludes(r.models, "class Program", "Program must live only in Program.cs");
  notIncludes(r.models, "static void Main", "Main must live only in Program.cs");
  /* both brace/paren balanced on their own */
  braceBalanced(r.program); parenBalanced(r.program);
  braceBalanced(r.models); parenBalanced(r.models);
  notIncludes(r.program, "TODO", "no TODO stubs in submission Program.cs");
  notIncludes(r.models, "TODO", "no TODO stubs in submission Models.cs");
});

test("submission no-foreign-usings: only System.* / Avalonia* / CommunityToolkit.Mvvm directives", () => {
  ["summer", "reexam"].forEach((which) => {
    const preset = which === "summer" ? C.summerPreset() : C.reexamPreset();
    const r = C.generateSubmissionFromPreset(preset);
    ok(r.ok, which + " submission generates");
    usingsOf(r.program).concat(usingsOf(r.models)).forEach((u) => {
      const allowed = u === "System" || u.indexOf("System.") === 0 ||
        u === "Avalonia" || u.indexOf("Avalonia.") === 0 ||
        u.indexOf("CommunityToolkit.Mvvm") === 0;
      ok(allowed, which + ": foreign using directive not allowed: " + u);
    });
  });
});

test("submission models carry [JsonPropertyName] for camelCase keys + nullable fields", () => {
  const r = C.generateSubmissionFromPreset(C.summerPreset());
  /* camelCase shipId -> ShipId with the attribute, in Models.cs */
  includes(r.models, '[JsonPropertyName("shipId")]');
  includes(r.models, "public string? ShipId { get; set; }");
  /* Models.cs needs the serialization using for the attribute and Generic for List<T> */
  includes(r.models, "using System.Text.Json.Serialization;");
  includes(r.models, "using System.Collections.Generic;");
});

test("submission models add `using System;` only when a DateTime field is present", () => {
  /* summer has DateTime? trip dates -> Models.cs must reference System for DateTime
     so the pair compiles even with ImplicitUsings disabled. */
  const summer = C.generateSubmissionFromPreset(C.summerPreset());
  ok(/^using System;$/m.test(summer.models), "summer Models.cs declares using System; (has DateTime)");
  /* reexam has no date fields -> no spurious System using */
  const reexam = C.generateSubmissionFromPreset(C.reexamPreset());
  ok(!/^using System;$/m.test(reexam.models), "reexam Models.cs omits using System; (no DateTime)");
});

test("submission wrapper class for object-rooted JSON lands in Models.cs, same namespace", () => {
  const wrapped = JSON.stringify({ "recipes": [{ "name": "A", "dietaryTags": ["Vegetarian"] }, { "name": "B" }] });
  const m = modelOf(wrapped);
  const files = C.generateSubmissionFiles(m, [
    { shape: "filter-contains", field: "dietaryTags", value: "Vegetarian", name: "veg", output: true, outputKey: "veg" },
  ], { namespace: "RecipeQueries", inputFile: "recipes.json" });
  /* the wrapper deserialization happens in Program.cs */
  includes(files.program, "JsonRoot wrapper");
  /* the JsonRoot wrapper TYPE is declared in Models.cs (not Program.cs) */
  includes(files.models, "public class JsonRoot");
  includes(files.models, '[JsonPropertyName("recipes")]');
  notIncludes(files.program, "public class JsonRoot", "wrapper type must live in Models.cs only");
  braceBalanced(files.program); braceBalanced(files.models);
});

test("equivalence: single-file == Program.cs + Models.cs (same meaningful code, same output keys)", () => {
  /* For each preset, the single-file generateProgram and the two-file split must
     carry IDENTICAL meaningful code (Program class + model classes), so running
     either produces the same console output and the same exact output-key JSON. */
  [C.summerPreset(), C.reexamPreset()].forEach((preset) => {
    const single = C.generateFromPreset(preset);
    const split = C.generateSubmissionFromPreset(preset);
    ok(single.ok && split.ok, preset.name + " both paths generate");
    /* assemble the two files (drop the per-file usings/namespace) and compare to
       the single file with the same stripping. The remaining declarations are
       the behavioral surface: same Main body, same queries, same model types. */
    const combined = meaningful(split.program) + "\n" + meaningful(split.models);
    const singleM = meaningful(single.code);
    eq(combined, singleM, preset.name + ": two-file split must equal the single-file body");
    /* and the namespaces must match between the two submission files */
    const pns = /namespace\s+([A-Za-z0-9_.]+)\s*;/.exec(split.program)[1];
    const mns = /namespace\s+([A-Za-z0-9_.]+)\s*;/.exec(split.models)[1];
    eq(pns, mns, preset.name + ": Program.cs and Models.cs share one namespace");
  });
});

/* ---- UI: the Download submission files button + wiring ---- */
test("output card renders the Download submission files button + flat-folder hint", () => {
  const f = freshUI();
  f.QL.loadPreset("summer");
  const out = f.els["ql-output"].innerHTML;
  includes(out, "Download submission files", "submission button present");
  includes(out, "ql-submit-btn", "submission button id present");
  includes(out, "submit flat: 6 files, no bin/obj, no subfolders", "flat-folder hint present");
});

test("downloadSubmission emits exactly Problem_4_Program.cs and Problem_4_Models.cs as plain blobs", () => {
  const f = freshUI();
  /* capture every blob anchor download the UI triggers */
  const downloads = [];
  global.URL = { createObjectURL() { return "blob:fake"; }, revokeObjectURL() {} };
  global.Blob = function (parts) { this.parts = parts; };
  /* the anchor records its download name + href when clicked */
  global.document.createElement = function () {
    const a = { setAttribute() {}, style: {}, click() { downloads.push({ name: a.download, href: a.href }); } };
    return a;
  };
  f.QL.loadPreset("summer");
  f.QL.downloadSubmission(f.els["ql-submit-btn"]);
  const names = downloads.map((d) => d.name).sort();
  eq(names.length, 2, "exactly two files downloaded");
  eq(names[0], "Problem_4_Models.cs");
  eq(names[1], "Problem_4_Program.cs");
  /* every download is a blob URL (no zip dependency) */
  downloads.forEach((d) => includes(d.href, "blob:", "submission download is a blob URL"));
});

test("submission download does NOT depend on PROJZIP being loaded", () => {
  const f = freshUI();
  delete global.PROJZIP;            /* no zip core at all */
  const downloads = [];
  global.URL = { createObjectURL() { return "blob:fake"; }, revokeObjectURL() {} };
  global.Blob = function (parts) { this.parts = parts; };
  global.document.createElement = function () {
    const a = { setAttribute() {}, style: {}, click() { downloads.push(a.download); } };
    return a;
  };
  f.QL.loadPreset("reexam");
  /* the submission button is rendered even without PROJZIP (unlike Export project) */
  includes(f.els["ql-output"].innerHTML, "Download submission files", "submission button shows without PROJZIP");
  f.QL.downloadSubmission(f.els["ql-submit-btn"]);
  eq(downloads.sort().join(","), "Problem_4_Models.cs,Problem_4_Program.cs", "both files download with no zip core present");
});

/* ============================================================
   spec 18: Query Lab CSV input mode (System-only, CSVHelper not allowed)
   ============================================================ */

/* a representative CSV with the two exam curveballs:
   - a quoted field that contains commas ("Widget, deluxe" / "a, b, c")
   - a planted EMPTY cell (price missing on row 2 -> nullable double) */
const CSV_SAMPLE = [
  "name,price,inStock,addedOn,notes",
  '"Widget, deluxe",12.50,true,2024-01-15,handle with care',
  "Gadget,,false,2024-02-01,spare",
  'Gizmo,3,true,2024-03-10,"a, b, c"',
].join("\n");

/* JSON must still win when the text IS valid JSON, even if it also has commas. */
test("csv: valid JSON is still parsed as JSON, never as CSV", () => {
  const m = modelOf(SHIP_SAMPLE, {});
  ok(!m.csvMode, "JSON array must NOT enter CSV mode");
  const wrapped = modelOf(JSON.stringify({ recipes: [{ name: "A", tags: [] }] }), {});
  ok(!wrapped.csvMode, "object-wrapped JSON must NOT enter CSV mode");
});

test("csv: detection requires a header + a data row + consistent column counts", () => {
  ok(C.looksLikeCsv(CSV_SAMPLE).ok, "well-formed CSV is detected");
  ok(!C.looksLikeCsv("name,price").ok, "header alone (no data row) is not CSV");
  ok(!C.looksLikeCsv("just one column\nvalue").ok, "a single column is not a table");
  /* a row with the wrong column count is rejected (not silently truncated) */
  const ragged = "a,b,c\n1,2,3\n4,5";
  ok(!C.looksLikeCsv(ragged).ok, "inconsistent column counts rejected");
});

test("csv: quote-aware splitter keeps commas inside quoted fields", () => {
  const recs = C.parseCsvRecords(CSV_SAMPLE);
  /* header + 3 data rows */
  eq(recs.length, 4);
  /* row 1 field 0 is the quoted "Widget, deluxe" as ONE cell */
  eq(recs[1][0], "Widget, deluxe");
  eq(recs[1].length, 5, "the quoted comma did not inflate the column count");
  /* row 3 last field is the quoted "a, b, c" */
  eq(recs[3][4], "a, b, c");
});

test("csv: model inference votes column kinds, empty cell -> nullable", () => {
  const m = modelOf(CSV_SAMPLE, {});   /* faithful inference */
  ok(m.csvMode, "CSV input enters CSV mode");
  eq(m.sampleCount, 3, "three data rows");
  const root = m.byName[m.rootClass];
  const by = {};
  root.fields.forEach((f) => (by[f.property] = f));
  eq(by.Name.baseType, "string");
  /* price has a planted empty cell -> nullable double */
  eq(by.Price.baseType, "double");
  ok(by.Price.nullable, "empty price cell makes Price nullable");
  eq(by.InStock.baseType, "bool");
  /* notes present in every row here -> non-nullable string */
  ok(!by.Notes.nullable, "notes present in every row -> non-nullable");
});

test("csv: PascalCase property mapping keeps the original header for parsing", () => {
  const csv = "first_name,total amount\nAda,10\nGrace,20";
  const m = modelOf(csv, {});
  const root = m.byName[m.rootClass];
  const props = root.fields.map((f) => f.property);
  includes(props.join(","), "FirstName");
  includes(props.join(","), "TotalAmount");
  /* the original header text is retained as the key + csvIndex for split-by-index */
  const fn = root.fields.find((f) => f.property === "FirstName");
  eq(fn.key, "first_name");
  eq(fn.csvIndex, 0);
});

test("csv codegen: System-only ParseCsv + quote-aware SplitCsvLine, no CSVHelper, no JSON deserialize", () => {
  const m = modelOf(CSV_SAMPLE);   /* UI posture: allNullable */
  const code = C.generateProgram(m, [
    { shape: "filter-equals", field: "name", value: "Gadget", name: "gadgets", output: true, outputKey: "gadgets", print: true },
  ], { inputFile: "products.csv", outputFile: "Problem_4_Query_Results.json", namespace: "Products" });
  includes(code, "private static List<");
  includes(code, "ParseCsv(");
  includes(code, "File.ReadAllLines(");
  includes(code, "SplitCsvLine(");
  includes(code, "bool inQuotes");
  /* the planted-missing trap: TryParse with null fallback (no throw) */
  includes(code, "double.TryParse(");
  /* still writes the EXACT-key results JSON via System.Text.Json */
  includes(code, "JsonSerializer.Serialize");
  includes(code, "WriteIndented = true");
  notIncludes(code, "CSVHelper", "CSVHelper must never appear (not an allowed library)");
  notIncludes(code, "JsonSerializer.Deserialize", "CSV mode does not deserialize JSON");
  notIncludes(code, "TODO", "no TODO stubs in CSV codegen");
  braceBalanced(code);
  parenBalanced(code);
});

test("csv codegen: only System.* usings, no foreign libraries", () => {
  const m = modelOf(CSV_SAMPLE);
  const code = C.generateProgram(m, [
    { shape: "filter-equals", field: "name", value: "Gadget", name: "gadgets" },
  ], { inputFile: "products.csv", namespace: "Products" });
  usingsOf(code).forEach((u) => {
    const allowed = u === "System" || u.indexOf("System.") === 0;
    ok(allowed, "CSV codegen using not allowed: " + u);
  });
});

test("csv codegen: nested-collection shapes are skipped with a comment, never broken code", () => {
  const m = modelOf(CSV_SAMPLE);
  const code = C.generateProgram(m, [
    { shape: "filter-nested-any", collection: "missing", subField: "x", name: "bad" },
    { shape: "filter-empty-collection", field: "missing", name: "bad2" },
    { shape: "filter-equals", field: "name", value: "Gadget", name: "good", output: true, outputKey: "good" },
  ], { inputFile: "products.csv", namespace: "Products" });
  includes(code, "skipped");
  includes(code, "CSV is flat");
  /* the flat query still generates correctly */
  includes(code, "s.Name == \"Gadget\"");
  braceBalanced(code);
  parenBalanced(code);
});

test("csv codegen: filter-equals on a bool/numeric column emits a typed literal, not a string (CS0019 guard)", () => {
  const m = modelOf(CSV_SAMPLE);   /* inStock -> bool, price -> double, name -> string */
  const code = C.generateProgram(m, [
    { shape: "filter-equals", field: "inStock", value: "true", name: "inStockRows", output: true, outputKey: "inStockRows" },
    { shape: "filter-equals", field: "price", value: "3", name: "byPrice", output: true, outputKey: "byPrice" },
    { shape: "filter-equals", field: "name", value: "Gadget", name: "named", output: true, outputKey: "named" },
  ], { inputFile: "products.csv", outputFile: "Problem_4_Query_Results.json", namespace: "Products" });
  /* bool: bare true literal, never the string "true" */
  includes(code, "s.InStock == true");
  notIncludes(code, 's.InStock == "true"', "bool column must not be compared to a string literal (CS0019)");
  /* numeric: bare token, never a quoted number */
  includes(code, "s.Price == 3");
  notIncludes(code, 's.Price == "3"', "numeric column must not be compared to a string literal (CS0019)");
  /* string: still a quoted literal (no regression) */
  includes(code, 's.Name == "Gadget"');
  braceBalanced(code);
  parenBalanced(code);
});

test("csv codegen: case-insensitive flag is ignored for a bool column (string.Equals would not compile)", () => {
  const m = modelOf(CSV_SAMPLE);
  const code = C.generateProgram(m, [
    { shape: "filter-equals", field: "inStock", value: "false", caseInsensitive: true, name: "out", output: true, outputKey: "out" },
  ], { inputFile: "products.csv", namespace: "Products" });
  includes(code, "s.InStock == false");
  notIncludes(code, "string.Equals(s.InStock", "string.Equals must not be applied to a bool field");
});

test("filter-equals: an unparseable value for a bool column falls back to a string literal (no broken token)", () => {
  const m = modelOf(CSV_SAMPLE);
  const code = C.generateProgram(m, [
    { shape: "filter-equals", field: "inStock", value: "maybe", name: "out", output: true, outputKey: "out" },
  ], { inputFile: "products.csv", namespace: "Products" });
  /* not a valid bool token -> keep the quoted form so the file still parses;
     desk-check / build would flag the user's value, but we never emit a bare `maybe`. */
  includes(code, 's.InStock == "maybe"');
});

test("csv submission split: Program.cs carries ParseCsv, Models.cs the POCO, same namespace", () => {
  const m = modelOf(CSV_SAMPLE);
  const files = C.generateSubmissionFiles(m, [
    { shape: "filter-equals", field: "name", value: "Gadget", name: "gadgets", output: true, outputKey: "gadgets" },
  ], { inputFile: "products.csv", namespace: "Products" });
  includes(files.program, "namespace Products;");
  includes(files.program, "ParseCsv(");
  includes(files.program, "SplitCsvLine(");
  includes(files.models, "namespace Products;");
  includes(files.models, "public class Row");
  /* the model class lives only in Models.cs, the parser only in Program.cs */
  notIncludes(files.models, "ParseCsv(", "the CSV parser must live only in Program.cs");
  notIncludes(files.program, "public class Row", "the model class must live only in Models.cs");
  braceBalanced(files.program); parenBalanced(files.program);
  braceBalanced(files.models); parenBalanced(files.models);
  notIncludes(files.program, "TODO");
  notIncludes(files.models, "TODO");
});

test("csv model emission: non-null string column initialised to \"\" (no CS8618), nullable stays nullable", () => {
  const m = modelOf(CSV_SAMPLE, {});   /* faithful: Notes non-null, Price nullable */
  const code = C.emitModelClasses(m);
  includes(code, 'public string Name { get; set; } = "";');
  includes(code, "public double? Price { get; set; }");
});

/* ---- UI: CSV mode badge + paste hint + disabled nested rows ---- */
test("csv UI: pasting CSV shows the CSV mode badge and a flat row count", () => {
  const f = freshUI();
  f.QL.setJson(CSV_SAMPLE);
  const modelEl = f.els["ql-models"].innerHTML;
  includes(modelEl, "CSV mode", "CSV badge shown near the model card");
  includes(modelEl, "sample row", "CSV samples are counted as rows, not elements");
});

test("csv UI: the paste hint and empty-state mention both JSON and CSV", () => {
  const f = freshUI();
  const page = global.QUERYLAB.render();
  includes(page, "CSV", "paste hint/empty-state mentions CSV");
  includes(page, "CSV mode", "empty-state explains CSV switches to a CSV generator");
});

test("csv UI: a nested-collection query row is disabled with a hint in CSV mode", () => {
  const f = freshUI();
  f.QL.setJson(CSV_SAMPLE);
  /* add a nested-any row, then switch it to the collection-only shape */
  f.QL.addQuery();
  f.QL.setRow(0, "shape", "filter-nested-any");
  const rowsHtml = f.els["ql-rows"].innerHTML;
  includes(rowsHtml, "ql-csv-disabled", "nested-collection row disabled in CSV mode");
  includes(rowsHtml, "CSV is flat", "disabled row explains why");
});

test("csv UI: pasting CSV then JSON leaves CSV mode (no sticky badge)", () => {
  const f = freshUI();
  f.QL.setJson(CSV_SAMPLE);
  includes(f.els["ql-models"].innerHTML, "CSV mode", "CSV badge after CSV paste");
  f.QL.setJson(SHIP_SAMPLE);
  notIncludes(f.els["ql-models"].innerHTML, "CSV mode", "CSV badge gone after switching back to JSON");
});

test("csv UI: a .csv input file name renames the class to a singular (products.csv -> Product)", () => {
  const f = freshUI();
  f.QL.setJson(CSV_SAMPLE);
  /* default input file is data.json -> class stays the default Row */
  includes(f.els["ql-models"].innerHTML, "class Row", "default CSV class name is Row");
  /* naming a .csv input file derives a singular class name */
  f.QL.setOpt("inputFile", "products.csv");
  const modelEl = f.els["ql-models"].innerHTML;
  includes(modelEl, "class Product", "products.csv derives class Product");
  /* and the generated code uses that class name in ParseCsv */
  includes(f.els["ql-output"].innerHTML, "Product", "generated code references the derived class");
});
