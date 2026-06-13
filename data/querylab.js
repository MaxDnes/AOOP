/* ============================================================
   QUERY LAB · UI for the JSON -> model -> LINQ -> Program.cs solver
   window.QUERYLAB = { render, init }
   All event handlers live on window.QL.
   Pure string rendering; DOM access happens only inside functions
   so the module loads under Node for tests. Logic lives in
   data/querylab-core.js (window.QUERYLAB_CORE).
   ============================================================ */

(function (global) {
"use strict";

const STORE_KEY = "aop-querylab-state";
const STORE_VERSION = 1;   /* version-stamped payloads ({v:1, ...}) with graceful fallback */

/* ---------------- shape catalogue (UI-facing labels + field needs) ---------------- */
/* Each shape declares which controls its row needs so the row renderer can
   build only the relevant dropdowns/inputs. Kept in the UI layer; the core
   owns the actual code generation. */
const SHAPE_UI = [
  { key: "filter-equals",          icon: "=",  label: "filter · equals",            needs: ["field", "eqMatch", "value", "ci"] },
  { key: "filter-contains",        icon: "∋",  label: "filter · contains",          needs: ["field", "value", "ci"] },
  { key: "filter-empty-collection",icon: "∅",  label: "filter · empty collection",  needs: ["collectionField"] },
  { key: "filter-nested-any",      icon: "⊆",  label: "filter · nested Any",        needs: ["collectionField", "subField", "match", "value", "andWhere"] },
  { key: "sort-by",                icon: "↕",  label: "sort by",                    needs: ["field", "byCount", "nullValue", "direction", "thenBy"] },
  { key: "group-aggregate",        icon: "Σ",  label: "group + aggregate",          needs: ["field", "aggregate", "subField", "subCount"] },
  { key: "above-average",          icon: "x̄",  label: "above average",              needs: ["field", "byCount", "excludeNull"] },
  { key: "top-n",                  icon: "▲",  label: "top N",                      needs: ["field", "byCount", "direction", "n"] },
  { key: "select-fields",          icon: "{}", label: "select fields",              needs: ["multiField"] },
  { key: "binary-search",          icon: "🔎", label: "binary search",              needs: ["field", "value"] },
];
const SHAPE_BY_KEY = {};
SHAPE_UI.forEach(function (s) { SHAPE_BY_KEY[s.key] = s; });

/* shapes that operate on a child collection: meaningless on a flat CSV, so they
   are disabled with a hint when CSV mode is active (the exam cannot ask
   trips-per-ship of a flat file). */
const CSV_DISABLED_SHAPES = {
  "filter-empty-collection": true,
  "filter-nested-any": true,
};

const MATCH_MODES = [
  { key: "equals", label: "== value" },
  { key: "null",   label: "== null" },
  { key: "year",   label: "year-of-date == N" },
];
/* filter-equals match modes: a plain value compare, or a null/missing test that
   emits `field == null` (the only correct "is empty" check; a CSV empty cell
   deserializes to null, so `== ""` is wrong). */
const EQ_MATCH_MODES = [
  { key: "equals", label: "== value" },
  { key: "null",   label: "== null (empty/missing)" },
];
const AGGREGATES = ["Count", "Average", "Max", "Min"];

/* ---------------- module state ---------------- */
let state = null;     // { json, inputFile, outputFile, namespace, rows:[...], overrides:{} }
let model = null;     // last inferred model (or null)
let parseError = null;
let lastCode = "";
let saveTimer = null;
let genTimer = null;
let rowSeq = 1;

/* ---------------- helpers ---------------- */
function core() { return global.QUERYLAB_CORE; }

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
/* escape for use inside an inline onclick="QL.x('...')" JS string */
function jsq(s) {
  return esc(String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
}
function hiCS(code) {
  if (typeof global.highlight === "function") return global.highlight(code, "csharp");
  return esc(code);
}
function byId(id) { return typeof document !== "undefined" ? document.getElementById(id) : null; }
function paint(id, html) { const el = byId(id); if (el) el.innerHTML = html; }
function setStatus(msg) { const el = byId("ql-status"); if (el) el.textContent = msg; }

/* ---------------- persistence ---------------- */
function defaultState() {
  return {
    json: "",
    inputFile: "data.json",
    outputFile: "Problem_4_Query_Results.json",
    namespace: "Problem4",
    projectName: "QueryConsole",
    rows: [],
    overrides: {},
  };
}

/* migrate a persisted payload (any shape, any/no version) into the current
   defaultState() shape. Unknown / legacy shapes degrade gracefully: every
   field is copied only when it is the right type, otherwise the default wins,
   so a future/garbage payload can never crash the lab on load. */
function migrateState(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== "object") return d;
  /* a v1 payload nests the real state under .state; an unstamped legacy payload
     IS the state. Accept both so the round-trip survives the version bump. */
  const src = (raw.v && raw.state && typeof raw.state === "object") ? raw.state : raw;
  if (typeof src.json === "string") d.json = src.json;
  if (typeof src.inputFile === "string") d.inputFile = src.inputFile;
  if (typeof src.outputFile === "string") d.outputFile = src.outputFile;
  if (typeof src.namespace === "string") d.namespace = src.namespace;
  if (typeof src.projectName === "string" && src.projectName.trim()) d.projectName = src.projectName;
  if (Array.isArray(src.rows)) d.rows = src.rows.filter(function (r) { return r && typeof r === "object"; });
  if (src.overrides && typeof src.overrides === "object") d.overrides = src.overrides;
  return d;
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    return migrateState(raw);
  } catch (e) { return defaultState(); }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ v: STORE_VERSION, state: state }));
  } catch (e) {}
}
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 300); }
function ensureState() { if (!state) state = loadState(); }

function newRow(shape) {
  return {
    id: "r" + (rowSeq++),
    shape: shape || "filter-equals",
    field: "", value: "", caseInsensitive: false,
    collection: "", subField: "", match: "equals",
    byCount: false, direction: "desc", thenBy: "", thenDirection: "asc",
    aggregate: "Count", subCount: false,
    nullValue: "",            /* sort-by: optional `?? n` coalesce on a nullable key */
    excludeNull: false,       /* above-average: average known values only */
    andWhere: null,           /* filter-nested-any: optional root-level AND predicate { field, value } */
    n: 5, fields: [],
    name: "q" + (state.rows.length + 1),
    label: "",
    print: true, output: true, outputKey: "",
  };
}

/* ---------------- inference (recompute model from pasted json) ---------------- */
function recompute() {
  const C = core();
  if (!C) { parseError = "query-lab core not loaded"; model = null; return; }
  if (!state.json || !state.json.trim()) { model = null; parseError = null; return; }
  const r = C.parseSample(state.json, { allNullable: true });
  if (!r.ok) { model = null; parseError = r.error; return; }
  /* CSV mode: give the inferred class a sensible singular name from the input
     file (products.csv -> Product), only when the user has named a .csv input
     file. JSON inference is left exactly as-is so its behaviour stays byte-stable. */
  if (r.model && r.model.csvMode) {
    const stem = csvClassFromInput(state.inputFile);
    if (stem && stem !== r.model.rootClass) {
      const r2 = C.parseSample(state.json, { allNullable: true, classNames: { Row: stem } });
      if (r2.ok && r2.model.csvMode) { model = r2.model; parseError = null; return; }
    }
  }
  model = r.model; parseError = null;
}

/* derive a singular PascalCase class name from a *.csv input file name, e.g.
   "products.csv" -> "Product", "order_lines.csv" -> "OrderLine". Returns null
   when the input file is not a usable .csv name (so the default "Row" stays). */
function csvClassFromInput(inputFile) {
  const C = core();
  const name = String(inputFile == null ? "" : inputFile).trim();
  if (!/\.csv$/i.test(name)) return null;
  const stem = name.replace(/\.csv$/i, "").split(/[\\/]/).pop();
  if (!stem) return null;
  const singular = C && typeof C.singular === "function" ? C.singular(stem) : stem;
  return /^[A-Za-z_]\w*$/.test(singular) ? singular : null;
}

/* available field keys for dropdowns (root scalar/collection fields) */
function rootFields() {
  if (!model) return [];
  const root = model.byName[model.rootClass];
  return root ? root.fields : [];
}
function collectionFields() {
  return rootFields().filter(function (f) { return f.isCollection; });
}
function scalarFields() {
  return rootFields().filter(function (f) { return !f.isCollection && !f.isObject; });
}
function nestedFieldsOf(collectionKey) {
  const f = rootFields().filter(function (x) { return x.key === collectionKey; })[0];
  if (!f || !f.nestedClass || !model.byName[f.nestedClass]) return [];
  return model.byName[f.nestedClass].fields;
}

/* ---------------- code generation (debounced) ---------------- */
function regenerate() {
  const C = core();
  recompute();
  if (!model) { lastCode = ""; paintModels(); paintOutput(); return; }
  try {
    lastCode = C.generateProgram(model, state.rows, {
      inputFile: state.inputFile,
      outputFile: state.outputFile,
      namespace: state.namespace,
      overrides: state.overrides,
    });
  } catch (e) {
    lastCode = "// generation error: " + (e && e.message);
  }
  paintModels();
  paintRows();
  paintOutput();
}
function scheduleRegen() { clearTimeout(genTimer); genTimer = setTimeout(regenerate, 350); }

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  ensureState();
  recompute();
  let h = '<div class="content-inner content-wide">';

  /* ---- header: title + one-line subtitle + toolbar (Designer layout) ---- */
  h += '<div class="ql-head">';
  h += '<div class="ql-head-text">';
  h += '<div class="crumb"><b>QUERY LAB</b></div>';
  h += '<h1 class="topic-title">Query Lab</h1>';
  h += '<p class="ql-sub">Paste the Problem 4 JSON, click to build LINQ queries, then copy one complete null-safe <b>Program.cs</b> or export the whole runnable console project as a .zip, and finally <b>Download submission files</b> for the two hand-in files.</p>';
  h += "</div>";
  h += toolbarHTML();
  h += "</div>";

  h += '<div class="ql">';

  /* LEFT pane: JSON + inferred model */
  h += '<div class="ql-left">';
  h += '<textarea class="ql-json" id="ql-json" spellcheck="false" placeholder="// paste the exam JSON (an array, or an object wrapping one array) — or paste a CSV (a header line + data rows); Query Lab auto-detects which and switches to CSV mode" oninput="QL.setJson(this.value)">' + esc(state.json) + "</textarea>";
  h += '<div class="ql-models" id="ql-models">' + modelsHTML() + "</div>";
  h += "</div>";

  /* RIGHT pane: query rows + output options + generated code */
  h += '<div class="ql-right">';
  h += '<div class="ql-rows-head"><span>Queries</span><button class="ql-add" onclick="QL.addQuery()">+ add query</button></div>';
  h += '<div class="ql-rows" id="ql-rows">' + rowsHTML() + "</div>";
  h += '<div class="ql-opts" id="ql-opts">' + optionsHTML() + "</div>";
  h += '<div class="ql-out" id="ql-output">' + outputHTML() + "</div>";
  h += "</div>";

  h += "</div>";
  h += "</div>";
  return h;
}

/* ---- toolbar: grouped [presets] | [clear] + status, Designer-styled ---- */
function toolbarHTML() {
  let h = '<div class="ql-toolbar">';
  h += '<button class="ql-btn" title="load the verified Summer 2025 spaceships solution" onclick="QL.loadPreset(\'summer\')">▣ Summer spaceships</button>';
  h += '<button class="ql-btn" title="load the verified ReExam 2025 recipes solution" onclick="QL.loadPreset(\'reexam\')">▣ ReExam recipes</button>';
  h += '<span class="ql-tb-sep"></span>';
  h += '<button class="ql-btn" title="clear the JSON and all query rows" onclick="QL.clearAll()">✕ Clear</button>';
  h += '<span class="ql-msg" id="ql-status"></span>';
  h += "</div>";
  return h;
}

function init() {
  ensureState();
  regenerate();
}

/* ---------------- left: inferred model card ---------------- */
function modelsHTML() {
  if (parseError) {
    return '<div class="ql-parse-err"><b>JSON parse error</b><br>' + esc(parseError) + "</div>";
  }
  if (!model) {
    let e = '<div class="ql-empty ql-start">';
    e += '<div class="ql-start-title">Start here</div>';
    e += '<ol class="ql-start-steps">';
    e += '<li><b>Paste</b> the Problem 4 data above: JSON (an array, or an object wrapping one array) or CSV (header line + rows). CSV switches to a System-only ParseCsv generator automatically.</li>';
    e += '<li><b>Add query rows</b> on the right and pick fields from the inferred model.</li>';
    e += '<li><b>Copy</b> the Program.cs or <b>Export project (.zip)</b> to run it, then <b>Download submission files</b> for the two hand-in files Problem_4_Program.cs + Problem_4_Models.cs.</li>';
    e += '</ol>';
    e += '<div class="ql-start-or">or load a verified 2025 solution:</div>';
    e += '<div class="ql-start-presets">';
    e += '<button class="ql-btn" onclick="QL.loadPreset(\'summer\')">▣ Summer spaceships</button>';
    e += '<button class="ql-btn" onclick="QL.loadPreset(\'reexam\')">▣ ReExam recipes</button>';
    e += '</div>';
    e += '<div class="ql-start-note">Missing / null fields become nullable automatically (the exam trap).</div>';
    e += '</div>';
    return e;
  }
  let h = '<div class="ql-models-head">Inferred model · ' + esc(model.sampleCount) + " sample " + (model.csvMode ? "row" : "element") + (model.sampleCount === 1 ? "" : "s");
  if (model.csvMode) {
    /* CSV mode badge near the model card (the input was detected as CSV, not JSON) */
    h += '<span class="ql-csv-badge" title="input detected as CSV; System-only ParseCsv is generated (CSVHelper is not an allowed library)">CSV mode</span>';
  }
  h += "</div>";
  model.classes.forEach(function (cls) {
    h += '<div class="ql-class">';
    h += '<div class="ql-class-name">class ' + esc(cls.name) + "</div>";
    cls.fields.forEach(function (f) {
      const ov = state.overrides[cls.name + "." + f.key];
      const declared = core().declaredType(f, ov);
      h += '<div class="ql-field">';
      h += '<span class="ql-f-name">' + esc(f.property) + "</span>";
      h += '<span class="ql-f-type">' + esc(declared) + "</span>";
      /* show the original JSON key when it differs (a [JsonPropertyName] is
         emitted). esc() so a hostile key can never inject markup. */
      if (f.jsonName) {
        h += '<span class="ql-f-json" title="emits [JsonPropertyName]">json: &quot;' + esc(f.jsonName) + "&quot;</span>";
      }
      /* date toggle for date-string fields */
      if (f.isDateString) {
        const cur = ov === "DateTime" ? "DateTime" : "string";
        h += '<select class="ql-f-ovr" onchange="QL.setOverride(\'' + jsq(cls.name + "." + f.key) + '\', this.value)">';
        ["string", "DateTime"].forEach(function (t) {
          h += '<option value="' + t + '"' + (cur === t ? " selected" : "") + ">" + t + (f.nullable ? "?" : "") + "</option>";
        });
        h += "</select>";
      }
      if (f.nullable) h += '<span class="ql-f-null" title="nullable: missing/null in a sample">nullable</span>';
      h += "</div>";
    });
    h += "</div>";
  });
  return h;
}

/* ---------------- right: query rows ---------------- */
function rowsHTML() {
  if (!state.rows.length) {
    return '<div class="ql-empty">No queries yet. Click <b>+ add query</b> or load a preset.</div>';
  }
  let h = "";
  state.rows.forEach(function (row, i) {
    h += rowHTML(row, i);
  });
  return h;
}

function fieldSelect(row, prop, fields, current) {
  let h = '<select class="ql-sel" onchange="QL.setRow(' + rowIndexAttr(row) + ', \'' + prop + '\', this.value)">';
  h += '<option value="">— field —</option>';
  fields.forEach(function (f) {
    h += '<option value="' + esc(f.key) + '"' + (current === f.key ? " selected" : "") + ">" + esc(f.property) + "</option>";
  });
  h += "</select>";
  return h;
}
function rowIndexAttr(row) { return state.rows.indexOf(row); }

function rowHTML(row, i) {
  const sh = SHAPE_BY_KEY[row.shape] || SHAPE_UI[0];
  let h = '<div class="ql-row" data-i="' + i + '">';
  h += '<div class="ql-row-top">';
  h += '<span class="ql-row-icon">' + esc(sh.icon) + "</span>";
  /* shape picker */
  h += '<select class="ql-sel ql-shape" onchange="QL.setRow(' + i + ', \'shape\', this.value)">';
  SHAPE_UI.forEach(function (s) {
    h += '<option value="' + s.key + '"' + (s.key === row.shape ? " selected" : "") + ">" + esc(s.label) + "</option>";
  });
  h += "</select>";
  /* result var name */
  h += '<input class="ql-name" value="' + esc(row.name) + '" title="result variable name" onchange="QL.setRow(' + i + ', \'name\', this.value)">';
  /* reorder + remove */
  h += '<span class="ql-row-ctl">';
  h += '<button class="ql-mini" title="move up" onclick="QL.move(' + i + ', -1)">▲</button>';
  h += '<button class="ql-mini" title="move down" onclick="QL.move(' + i + ', 1)">▼</button>';
  h += '<button class="ql-mini ql-x" title="remove" onclick="QL.removeQuery(' + i + ')">✕</button>';
  h += "</span>";
  h += "</div>";

  /* shape-specific controls */
  h += '<div class="ql-row-body">';
  const needs = sh.needs;
  /* nested-collection shapes need a child collection, which a flat CSV cannot
     have. In CSV mode disable those rows with a one-line hint instead of the
     (empty) collection dropdowns. */
  if (model && model.csvMode && CSV_DISABLED_SHAPES[row.shape]) {
    h += '<span class="ql-csv-disabled">CSV is flat: this nested-collection query needs JSON. Pick a flat-field shape (equals, contains, sort, group, above-average, top N, select, binary search).</span>';
    h += "</div>";   /* close ql-row-body */
    /* still render the per-row footer so the row can be removed/reordered cleanly */
    h += '<div class="ql-row-foot">';
    h += '<button class="ql-mini ql-x" title="remove this CSV-incompatible query" onclick="QL.removeQuery(' + i + ')">✕ remove</button>';
    h += "</div>";
    h += "</div>";   /* close ql-row */
    return h;
  }
  if (needs.indexOf("field") !== -1) {
    h += fieldSelect(row, "field", rootFields(), row.field);
  }
  /* filter-equals match: == value | == null. In null mode the value box is
     suppressed (the comparison is to the C# null literal, no value needed). */
  if (needs.indexOf("eqMatch") !== -1) {
    h += '<select class="ql-sel" title="compare to a value, or test for null/missing" onchange="QL.setRow(' + i + ', \'match\', this.value)">';
    EQ_MATCH_MODES.forEach(function (m) {
      h += '<option value="' + m.key + '"' + (m.key === row.match ? " selected" : "") + ">" + esc(m.label) + "</option>";
    });
    h += "</select>";
  }
  if (needs.indexOf("collectionField") !== -1) {
    h += fieldSelect(row, "collection", collectionFields(), row.collection);
  }
  if (needs.indexOf("subField") !== -1) {
    h += fieldSelect(row, "subField", nestedFieldsOf(row.collection), row.subField);
  }
  if (needs.indexOf("match") !== -1) {
    h += '<select class="ql-sel" onchange="QL.setRow(' + i + ', \'match\', this.value)">';
    MATCH_MODES.forEach(function (m) {
      h += '<option value="' + m.key + '"' + (m.key === row.match ? " selected" : "") + ">" + esc(m.label) + "</option>";
    });
    h += "</select>";
  }
  if (needs.indexOf("aggregate") !== -1) {
    h += '<select class="ql-sel" onchange="QL.setRow(' + i + ', \'aggregate\', this.value)">';
    AGGREGATES.forEach(function (a) {
      h += '<option value="' + a + '"' + (a === row.aggregate ? " selected" : "") + ">" + a + "</option>";
    });
    h += "</select>";
    if (row.aggregate !== "Count") {
      h += fieldSelect(row, "subField", rootFields(), row.subField);
      h += checkbox(i, "subCount", row.subCount, "use Count");
    }
  }
  if (needs.indexOf("byCount") !== -1) {
    h += checkbox(i, "byCount", row.byCount, "by collection Count");
  }
  if (needs.indexOf("direction") !== -1) {
    h += '<select class="ql-sel" onchange="QL.setRow(' + i + ', \'direction\', this.value)">';
    [["desc", "descending"], ["asc", "ascending"]].forEach(function (d) {
      h += '<option value="' + d[0] + '"' + (d[0] === row.direction ? " selected" : "") + ">" + d[1] + "</option>";
    });
    h += "</select>";
  }
  if (needs.indexOf("thenBy") !== -1) {
    h += fieldSelect(row, "thenBy", scalarFields(), row.thenBy);
  }
  if (needs.indexOf("n") !== -1) {
    h += '<input class="ql-num" type="number" min="1" value="' + esc(row.n) + '" title="N" onchange="QL.setRow(' + i + ', \'n\', this.value)">';
  }
  if (needs.indexOf("multiField") !== -1) {
    h += '<span class="ql-multi">';
    scalarFields().forEach(function (f) {
      const on = (row.fields || []).indexOf(f.key) !== -1;
      h += '<label class="ql-chip-cb' + (on ? " on" : "") + '"><input type="checkbox"' + (on ? " checked" : "") +
        ' onchange="QL.toggleField(' + i + ', \'' + jsq(f.key) + '\', this.checked)">' + esc(f.property) + "</label>";
    });
    h += "</span>";
  }
  /* sort-by: optional `?? n` coalesce so a missing key sorts as n (e.g. Signups ?? 0) */
  if (needs.indexOf("nullValue") !== -1 && !row.byCount) {
    h += '<input class="ql-num ql-nullval" value="' + esc(row.nullValue || "") + '" placeholder="?? n" title="null-coalesce a missing sort key (e.g. 0); blank = leave nullable" onchange="QL.setRow(' + i + ', \'nullValue\', this.value)">';
  }
  /* above-average: average over known (non-null) values only, never count missing as 0 */
  if (needs.indexOf("excludeNull") !== -1 && !row.byCount) {
    h += checkbox(i, "excludeNull", row.excludeNull, "exclude nulls from avg");
  }
  if (needs.indexOf("value") !== -1) {
    /* hide the value box when a filter-equals row is in null mode (no value needed) */
    const hideValue = row.shape === "filter-equals" && row.match === "null";
    if (!hideValue) {
      h += '<input class="ql-val" value="' + esc(row.value) + '" placeholder="value" onchange="QL.setRow(' + i + ', \'value\', this.value)">';
    }
  }
  /* filter-nested-any: optional compound root-level AND (e.g. HomePort == "X" && Any(...)) */
  if (needs.indexOf("andWhere") !== -1) {
    const aw = (row.andWhere && typeof row.andWhere === "object") ? row.andWhere : {};
    h += '<span class="ql-andwhere" title="optional: also require a root field equals a value (AND)">';
    h += '<span class="ql-andwhere-lab">AND</span>';
    h += '<select class="ql-sel" onchange="QL.setAndWhere(' + i + ', \'field\', this.value)">';
    h += '<option value="">— none —</option>';
    scalarFields().forEach(function (f) {
      h += '<option value="' + esc(f.key) + '"' + (aw.field === f.key ? " selected" : "") + ">" + esc(f.property) + "</option>";
    });
    h += "</select>";
    if (aw.field) {
      h += '<span class="ql-andwhere-eq">==</span>';
      h += '<input class="ql-val ql-andwhere-val" value="' + esc(aw.value || "") + '" placeholder="value" onchange="QL.setAndWhere(' + i + ', \'value\', this.value)">';
    }
    h += "</span>";
  }
  if (needs.indexOf("ci") !== -1) {
    h += checkbox(i, "caseInsensitive", row.caseInsensitive, "ignore case");
  }
  h += "</div>";

  /* per-row output controls */
  h += '<div class="ql-row-foot">';
  h += checkbox(i, "print", row.print, "print");
  h += checkbox(i, "output", row.output, "in JSON");
  if (row.output) {
    h += '<input class="ql-key" value="' + esc(row.outputKey || row.name) + '" placeholder="output key" onchange="QL.setRow(' + i + ', \'outputKey\', this.value)">';
  }
  h += "</div>";

  h += "</div>";
  return h;
}

function checkbox(i, prop, on, label) {
  return '<label class="ql-cb"><input type="checkbox"' + (on ? " checked" : "") +
    ' onchange="QL.setRow(' + i + ', \'' + prop + '\', this.checked)">' + esc(label) + "</label>";
}

/* ---------------- right: output file options ---------------- */
function optionsHTML() {
  let h = '<div class="ql-opt-row">';
  h += '<label>input file <input class="ql-tin" value="' + esc(state.inputFile) + '" onchange="QL.setOpt(\'inputFile\', this.value)"></label>';
  h += '<label>output file <input class="ql-tin" value="' + esc(state.outputFile) + '" onchange="QL.setOpt(\'outputFile\', this.value)"></label>';
  h += '<label>namespace <input class="ql-tin" value="' + esc(state.namespace) + '" onchange="QL.setOpt(\'namespace\', this.value)"></label>';
  h += "</div>";
  return h;
}

/* ---------------- right: generated code card ---------------- */
function outputHTML() {
  if (!model) {
    return '<div class="ql-empty">The generated <b>Program.cs</b> appears here once JSON is inferred.</div>';
  }
  let h = '<div class="ql-card">';
  h += '<div class="ql-card-head">';
  h += '<span class="ql-file">Program.cs</span>';
  h += '<div class="ql-card-actions">';
  /* "Copy all" is the visually primary copy action */
  h += '<button class="ql-copybtn ql-copy-primary" onclick="QL.copyCode(this)">⧉ Copy all</button>';
  /* Export project (.zip): the success action (green). Hidden gracefully when
     the zip core failed to load so the lab never crashes on load-order changes. */
  if (hasProjzip()) {
    h += '<input class="ql-proj-name" id="ql-proj-name" value="' + esc(state.projectName || "QueryConsole") +
      '" title="project / folder name" onchange="QL.setOpt(\'projectName\', this.value)">';
    h += '<button class="ql-copybtn ql-export" id="ql-export-btn" onclick="QL.exportProject(this)">⭳ Export project (.zip)</button>';
  }
  /* Download submission files: the final-deliverable action (spec 16). Two plain
     blob downloads (Problem_4_Program.cs + Problem_4_Models.cs), no zip, so it
     works on file:// and never depends on the projzip core being loaded. */
  h += '<button class="ql-copybtn ql-submit" id="ql-submit-btn" title="download the two flat submission files: Problem_4_Program.cs + Problem_4_Models.cs" onclick="QL.downloadSubmission(this)">⭳ Download submission files</button>';
  h += '</div>';
  h += "</div>";
  h += '<pre class="ql-code" id="ql-code">' + hiCS(lastCode) + "</pre>";
  /* hint line under the actions: the professor's flat-folder rule, plain prose */
  h += '<div class="ql-submit-hint">submit flat: 6 files, no bin/obj, no subfolders</div>';
  h += "</div>";
  return h;
}

/* is the project-zip core available? (graceful fallback if it failed to load) */
function hasProjzip() {
  return !!(global.PROJZIP && typeof global.PROJZIP.consoleProject === "function" &&
            typeof global.PROJZIP.makeZipBlobUrl === "function");
}

/* ---------------- repaint helpers ---------------- */
function paintModels() { paint("ql-models", modelsHTML()); }
function paintRows() { paint("ql-rows", rowsHTML()); }
function paintOptions() { paint("ql-opts", optionsHTML()); }
function paintOutput() { paint("ql-output", outputHTML()); }

/* ============================================================
   ACTIONS (window.QL)
   ============================================================ */
function setJson(value) {
  ensureState();
  state.json = value;
  scheduleSave();
  recompute();
  paintModels();
  scheduleRegen();
}

function loadPreset(which) {
  ensureState();
  const C = core();
  const preset = which === "reexam" ? C.reexamPreset() : C.summerPreset();
  state.json = preset.sample;
  state.inputFile = preset.inputFile;
  state.outputFile = preset.outputFile;
  state.namespace = preset.namespace;
  state.overrides = Object.assign({}, preset.overrides || {});
  /* deep-copy rows + ensure ids/names */
  rowSeq = 1;
  state.rows = (preset.rows || []).map(function (r) {
    return Object.assign(newRow(r.shape), r, { id: "r" + (rowSeq++) });
  });
  saveState();
  /* repaint json textarea too */
  const ta = byId("ql-json");
  if (ta) ta.value = state.json;
  paintOptions();
  regenerate();
  setStatus("loaded preset: " + preset.name);
}

function clearAll() {
  ensureState();
  state = defaultState();
  saveState();
  const ta = byId("ql-json");
  if (ta) ta.value = "";
  paintOptions();
  regenerate();
  setStatus("cleared");
}

function addQuery() {
  ensureState();
  state.rows.push(newRow("filter-equals"));
  saveState();
  paintRows();
  regenerate();
}

function removeQuery(i) {
  ensureState();
  if (i < 0 || i >= state.rows.length) return;
  state.rows.splice(i, 1);
  saveState();
  paintRows();
  regenerate();
}

function move(i, delta) {
  ensureState();
  const j = i + delta;
  if (i < 0 || j < 0 || i >= state.rows.length || j >= state.rows.length) return;
  const tmp = state.rows[i];
  state.rows[i] = state.rows[j];
  state.rows[j] = tmp;
  saveState();
  paintRows();
  regenerate();
}

function setRow(i, prop, value) {
  ensureState();
  const row = state.rows[i];
  if (!row) return;
  if (prop === "n") value = parseInt(value, 10) || 1;
  row[prop] = value;
  /* changing shape may invalidate field-specific picks; keep them, the row
     renderer only shows what the new shape needs. */
  saveState();
  paintRows();
  regenerate();
}

/* set a sub-field of a row's compound AND predicate (filter-nested-any). Clears
   the whole andWhere when the field is blanked so the query reverts to the plain
   single-predicate Any. */
function setAndWhere(i, prop, value) {
  ensureState();
  const row = state.rows[i];
  if (!row) return;
  if (prop === "field" && !value) { row.andWhere = null; }
  else {
    if (!row.andWhere || typeof row.andWhere !== "object") row.andWhere = { field: "", value: "" };
    row.andWhere[prop] = value;
  }
  saveState();
  paintRows();
  regenerate();
}

function toggleField(i, key, on) {
  ensureState();
  const row = state.rows[i];
  if (!row) return;
  row.fields = row.fields || [];
  const idx = row.fields.indexOf(key);
  if (on && idx === -1) row.fields.push(key);
  else if (!on && idx !== -1) row.fields.splice(idx, 1);
  saveState();
  paintRows();
  regenerate();
}

function setOpt(prop, value) {
  ensureState();
  state[prop] = value;
  saveState();
  /* projectName only affects the export file name, not the generated code:
     skip the (debounced) regenerate so typing in it stays snappy. */
  if (prop !== "projectName") regenerate();
}

/* ---------------- export full runnable console project (.zip) ---------------- */
/* Build a complete net9.0 console project from the generated Program.cs plus the
   pasted sample JSON saved under the configured input-file name, then download
   the .zip. Mirrors the verified Problem 4 layout: unzip, dotnet build, dotnet
   run reproduces the exact-key results JSON. */
function exportProject(btn) {
  ensureState();
  if (!hasProjzip()) { setStatus("project export unavailable (zip core not loaded)"); return; }
  if (!model) { setStatus("paste JSON or load a preset before exporting"); return; }
  const Z = global.PROJZIP;
  const projName = (state.projectName && state.projectName.trim()) || "QueryConsole";
  const dataName = (state.inputFile && state.inputFile.trim()) || "data.json";
  /* the sample JSON the user pasted is the data file the generated code reads */
  const sample = state.json != null ? state.json : "";
  let entries, url;
  try {
    entries = Z.consoleProject(projName, {
      programCs: lastCode,
      dataFiles: [{ path: dataName, text: sample }],
    });
    url = Z.makeZipBlobUrl(entries);
  } catch (e) {
    setStatus("export failed: " + (e && e.message));
    return;
  }
  const fileName = Z.sanitizeName(projName, "QueryConsole") + ".zip";
  triggerDownload(url, fileName);
  flashButton(btn, "exported ✓");
  setStatus("exported " + fileName + ". Unzip, cd into the folder, then: dotnet run (reads " + dataName + ")");
}

/* ---------------- download the two-file submission pair (spec 16) ---------------- */
/* The professor's final deliverable is a flat folder of 6 files; Query Lab owns
   Problem_4_Program.cs + Problem_4_Models.cs. We emit the two-file split from the
   core (same namespace, model classes in Models.cs, Program + queries in
   Program.cs) and download each as a plain text blob with its EXACT name. No zip,
   so this works on file:// and does not depend on the projzip core being loaded. */
function downloadSubmission(btn) {
  ensureState();
  const C = core();
  if (!C || typeof C.generateSubmissionFiles !== "function") { setStatus("query-lab core not loaded"); return; }
  if (!model) { setStatus("paste JSON or load a preset before downloading the submission"); return; }
  let files;
  try {
    files = C.generateSubmissionFiles(model, state.rows, {
      inputFile: state.inputFile,
      outputFile: state.outputFile,
      namespace: state.namespace,
      overrides: state.overrides,
    });
  } catch (e) {
    setStatus("submission build failed: " + (e && e.message));
    return;
  }
  downloadText("Problem_4_Program.cs", files.program);
  downloadText("Problem_4_Models.cs", files.models);
  flashButton(btn, "downloaded ✓");
  setStatus("downloaded Problem_4_Program.cs + Problem_4_Models.cs. Drop both into the flat submission folder");
}

/* file:// safe plain-text download via a blob anchor (no zip dependency). */
function downloadText(fileName, text) {
  try {
    const blob = new Blob([String(text == null ? "" : text)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, fileName);
  } catch (e) {
    setStatus("download failed: " + (e && e.message));
  }
}

/* file:// safe download: anchor + click + revoke, like the Designer's export */
function triggerDownload(url, fileName) {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1500);
  } catch (e) {
    setStatus("download failed: " + (e && e.message));
  }
}

function setOverride(key, value) {
  ensureState();
  state.overrides[key] = value;
  saveState();
  paintModels();
  regenerate();
}

/* ---------------- copy + shared button feedback ---------------- */
/* flash a button label (the identical "copied/exported ✓" feedback used by every
   action button), restoring the original label afterwards. */
function flashButton(btn, label) {
  if (!btn) return;
  const orig = btn.getAttribute("data-orig") || btn.textContent;
  btn.setAttribute("data-orig", orig);
  btn.textContent = label;
  btn.classList.add("done");
  setTimeout(function () { btn.textContent = orig; btn.classList.remove("done"); }, 1800);
}

function copyCode(btn) {
  copyText(lastCode, btn);
}
function copyText(text, btn) {
  const done = function () { flashButton(btn, "copied ✓"); };
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
  done();
}

/* ---------------- export ---------------- */
const QL = {
  setJson: setJson,
  loadPreset: loadPreset,
  clearAll: clearAll,
  addQuery: addQuery,
  removeQuery: removeQuery,
  move: move,
  setRow: setRow,
  setAndWhere: setAndWhere,
  toggleField: toggleField,
  setOpt: setOpt,
  setOverride: setOverride,
  copyCode: copyCode,
  exportProject: exportProject,
  downloadSubmission: downloadSubmission,
};

const QUERYLAB = { render: render, init: init, outputHTML: outputHTML };

global.QUERYLAB = QUERYLAB;
global.QL = QL;
if (typeof module !== "undefined" && module.exports) module.exports = QUERYLAB;
})(typeof window !== "undefined" ? window : globalThis);
