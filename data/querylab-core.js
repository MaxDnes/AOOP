/* ============================================================
   QUERY LAB CORE · pure JSON -> C# model + LINQ -> Program.cs
   UMD module: attaches window.QUERYLAB_CORE in the browser and
   module.exports under Node. NO DOM access anywhere in this file.

   Solves exam Problem 4: paste a sample JSON file, infer the C#
   model classes (null-tolerant, [JsonPropertyName] for camelCase),
   pick LINQ query rows by shape, and emit one complete, desk-check
   compilable Program.cs that deserializes, queries, prints, and
   serializes selected results to one output JSON with EXACT keys.

   Calibrated line-by-line against the verified model solutions in
   data/solutions-summer.js (spaceships) and data/solutions-reexam.js
   (recipes): nullable everything that can be missing, null-safe
   `?.Count ?? 0` / `?.Contains(...) ?? false`, anonymous-object
   exact-key output with WriteIndented, OrderBy with a null-safe
   StringComparer, BinarySearch idiom with low/high loop.
   ============================================================ */

(function (global) {
  "use strict";

  /* ===================== small helpers ===================== */

  function pascal(name) {
    var s = String(name == null ? "" : name).replace(/^[_@]+/, "");
    if (!s) return "Field";
    /* split on non-identifier chars (camelCase keys keep their humps) */
    var parts = s.split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (!parts.length) return "Field";
    return parts.map(function (p) {
      return p.charAt(0).toUpperCase() + p.slice(1);
    }).join("");
  }

  /* singularise a collection key so List<T> gets a sensible element type:
     "trips" -> "Trip", "travelHistory" -> "TravelHistory" (no naive -y rule
     that would mangle "History"); only strips a trailing plural -s/-es. */
  function singular(name) {
    var p = pascal(name);
    if (/(ses|xes|zes|ches|shes)$/.test(p)) return p.slice(0, -2);
    if (/ies$/.test(p)) return p.slice(0, -3) + "y";
    if (/ss$/.test(p)) return p;                  /* "Address" stays */
    if (/s$/.test(p) && p.length > 1) return p.slice(0, -1);
    return p;
  }

  function isIdentifier(s) {
    return /^[A-Za-z_]\w*$/.test(String(s || ""));
  }

  /* an ISO date-ish string: yyyy-MM-dd optionally with time. */
  function looksLikeDate(value) {
    return typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(value);
  }

  /* whole-number doubles still came in without a decimal point in JSON;
     JS gives us a Number either way. Treat integer values as long-capable
     int; any fractional value forces double. */
  function numberKind(value) {
    return Number.isInteger(value) ? "int" : "double";
  }

  function uniquePush(arr, x) { if (arr.indexOf(x) === -1) arr.push(x); }

  /* ===================== model inference ===================== */

  /* Pull the array of sample elements out of pasted JSON. Accepts either a
     top-level array, or an object that wraps exactly one array property
     (e.g. { "recipes": [...] }). Returns { items, rootKey } or throws a
     friendly Error that the UI shows in its parse-error panel. */
  function extractArray(parsed) {
    if (Array.isArray(parsed)) return { items: parsed, rootKey: null };
    if (parsed && typeof parsed === "object") {
      var arrKeys = Object.keys(parsed).filter(function (k) { return Array.isArray(parsed[k]); });
      if (arrKeys.length === 1) return { items: parsed[arrKeys[0]], rootKey: arrKeys[0] };
      if (arrKeys.length > 1) {
        /* pick the longest array, but remember the key so codegen can read it */
        var best = arrKeys[0];
        arrKeys.forEach(function (k) { if (parsed[k].length > parsed[best].length) best = k; });
        return { items: parsed[best], rootKey: best };
      }
    }
    throw new Error("Expected a JSON array, or an object with one array property.");
  }

  /* Infer a field's type by scanning its value across ALL sample elements.
     Null/missing in ANY element marks it nullable (the exam trap). Nested
     objects recurse into their own class; arrays become List<T>. Returns a
     field descriptor used by both the model card and the query field picker. */
  function inferField(key, values, classRegistry, ownerName) {
    var present = 0;
    var sawNull = false;        /* explicit null in some element */
    var missing = false;        /* key absent from some element */
    var kinds = {};             /* observed primitive kinds */
    var sampleObjects = [];
    var sampleArrays = [];
    var sawDate = false, sawNonDateString = false;

    values.forEach(function (entry) {
      if (!entry.has) { missing = true; return; }
      var v = entry.value;
      present++;
      if (v === null) { sawNull = true; return; }
      if (Array.isArray(v)) { kinds["array"] = true; sampleArrays.push(v); return; }
      var t = typeof v;
      if (t === "object") { kinds["object"] = true; sampleObjects.push(v); return; }
      if (t === "boolean") { kinds["bool"] = true; return; }
      if (t === "number") { kinds[numberKind(v)] = true; return; }
      if (t === "string") {
        kinds["string"] = true;
        if (looksLikeDate(v)) sawDate = true; else sawNonDateString = true;
      }
    });

    var nullable = sawNull || missing || present < values.length;
    var prop = pascal(key);
    var jsonAttr = (prop !== key) ? key : null;   /* camelCase / kebab keys need the attribute */

    var field = {
      key: key,
      property: prop,
      jsonName: jsonAttr,
      nullable: nullable,
      isCollection: false,
      isObject: false,
      isDateString: false,
      elementType: null,        /* for collections: the C# element type */
      nestedClass: null,        /* class name for object / collection-of-object */
      baseType: "string",       /* the non-nullable C# scalar base */
    };

    if (kinds["array"]) {
      field.isCollection = true;
      var elemName = singular(key);
      var elemType = inferArrayElementType(sampleArrays, elemName, classRegistry);
      field.elementType = elemType.type;
      field.nestedClass = elemType.nestedClass;
      field.baseType = "List<" + field.elementType + ">";
    } else if (kinds["object"]) {
      field.isObject = true;
      var nestedName = pascal(key);
      buildClass(nestedName, sampleObjects, classRegistry);
      field.nestedClass = nestedName;
      field.baseType = nestedName;
    } else if (kinds["bool"]) {
      field.baseType = "bool";
    } else if (kinds["double"]) {
      field.baseType = "double";
    } else if (kinds["int"]) {
      field.baseType = kinds["double"] ? "double" : "int";
    } else if (kinds["string"]) {
      field.baseType = "string";
      /* offer a date toggle when every observed string looks like a date */
      if (sawDate && !sawNonDateString) field.isDateString = true;
    } else {
      /* only nulls / no data seen: safest is nullable string */
      field.baseType = "string";
    }

    return field;
  }

  function inferArrayElementType(sampleArrays, elemName, classRegistry) {
    var allObjects = true, anyValue = false;
    var objectSamples = [];
    var scalarKinds = {};
    sampleArrays.forEach(function (arr) {
      arr.forEach(function (v) {
        anyValue = true;
        if (v === null) return;
        if (v && typeof v === "object" && !Array.isArray(v)) { objectSamples.push(v); return; }
        allObjects = false;
        if (Array.isArray(v)) { scalarKinds["object"] = true; return; }
        var t = typeof v;
        if (t === "boolean") scalarKinds["bool"] = true;
        else if (t === "number") scalarKinds[numberKind(v)] = true;
        else if (t === "string") scalarKinds["string"] = true;
      });
    });
    if (!anyValue) return { type: "string", nestedClass: null };
    if (allObjects && objectSamples.length) {
      buildClass(elemName, objectSamples, classRegistry);
      return { type: elemName, nestedClass: elemName };
    }
    if (scalarKinds["double"]) return { type: "double", nestedClass: null };
    if (scalarKinds["int"]) return { type: "int", nestedClass: null };
    if (scalarKinds["bool"]) return { type: "bool", nestedClass: null };
    return { type: "string", nestedClass: null };
  }

  /* Build (or merge into) a class from a set of object samples. Registry maps
     className -> { name, fields:[...] }. Fields are unioned across samples;
     element order follows first appearance for stable codegen. */
  function buildClass(name, samples, classRegistry) {
    if (!classRegistry.order) classRegistry.order = [];
    var cls = classRegistry[name];
    if (!cls) {
      cls = classRegistry[name] = { name: name, fieldOrder: [], fieldMap: {} };
      classRegistry.order.push(name);
    }
    /* collect the union of keys, first-seen order */
    var keys = [];
    samples.forEach(function (obj) {
      Object.keys(obj).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); });
    });
    keys.forEach(function (k) {
      /* one value-entry per sample: { has, value } so missing != null */
      var values = samples.map(function (obj) {
        var has = Object.prototype.hasOwnProperty.call(obj, k);
        return { has: has, value: has ? obj[k] : undefined };
      });
      var field = inferField(k, values, classRegistry, name);
      if (cls.fieldMap[k]) {
        /* merge: widen nullability / numeric type across repeated builds */
        var prev = cls.fieldMap[k];
        prev.nullable = prev.nullable || field.nullable;
        if (prev.baseType === "int" && field.baseType === "double") prev.baseType = "double";
      } else {
        cls.fieldMap[k] = field;
        cls.fieldOrder.push(k);
      }
    });
    return cls;
  }

  /* Top-level inference entry. Returns a model:
     { rootClass, rootKey, classes:[{name, fields:[...]}], byName } */
  function inferModel(parsed, opts) {
    opts = opts || {};
    var picked = extractArray(parsed);
    var items = (picked.items || []).filter(function (x) {
      return x && typeof x === "object" && !Array.isArray(x);
    });
    var rootName = opts.rootClass || (picked.rootKey ? singular(picked.rootKey) : "Item");
    if (!isIdentifier(rootName)) rootName = "Item";

    var registry = {};
    if (items.length) buildClass(rootName, items, registry);
    else { registry[rootName] = { name: rootName, fieldOrder: [], fieldMap: {} }; registry.order = [rootName]; }

    var classes = (registry.order || []).map(function (n) {
      var c = registry[n];
      return {
        name: c.name,
        fields: c.fieldOrder.map(function (k) { return c.fieldMap[k]; }),
      };
    });

    /* defensive nullability: the exam's planted trap is missing/null fields, and
       the verified model solutions make EVERY field nullable so deserialize never
       throws. allNullable (on for the presets, and offered as a UI toggle) widens
       every field to nullable regardless of what the small sample happened to show. */
    if (opts.allNullable) {
      classes.forEach(function (c) {
        c.fields.forEach(function (f) { f.nullable = true; });
      });
    }

    /* optional rename pass: presets map auto-inferred names (Item / TravelHistory)
       to the exam's verified names (Spaceship / Trip). Renames cascade into every
       nestedClass reference and List<T> element type so the model stays coherent. */
    var rename = opts.classNames || {};
    if (rename[rootName]) rootName = rename[rootName];
    classes.forEach(function (c) {
      if (rename[c.name]) c.name = rename[c.name];
      c.fields.forEach(function (f) {
        if (f.nestedClass && rename[f.nestedClass]) f.nestedClass = rename[f.nestedClass];
        if (f.isObject && rename[f.baseType]) f.baseType = rename[f.baseType];
        if (f.isCollection && f.elementType && rename[f.elementType]) {
          f.elementType = rename[f.elementType];
          f.baseType = "List<" + f.elementType + ">";
        }
      });
    });

    var byName = {};
    classes.forEach(function (c) { byName[c.name] = c; });

    return {
      rootClass: rootName,
      rootKey: picked.rootKey,
      sampleCount: items.length,
      classes: classes,
      byName: byName,
    };
  }

  /* ===================== CSV parsing + inference ===================== */

  /* A quote-aware CSV line/record reader. Lecture 12 lists CSV next to JSON, and
     CSVHelper is NOT an allowed library, so this is the System-only idiom Query
     Lab both PARSES with here and GENERATES into the C# (see emitCsvParser). It
     walks the whole text once, honouring RFC-4180-style double quotes:
       - a field may be wrapped in "..."; a literal " inside is doubled ("")
       - commas and newlines inside quotes are part of the field
       - rows are separated by \n (a trailing \r is trimmed)
     Returns an array of rows, each row an array of string cells. */
  function parseCsvRecords(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i = 0;
    var n = text.length;
    var fieldStarted = false;   /* any char seen for the current field (incl. "") */
    function pushField() { row.push(field); field = ""; fieldStarted = false; }
    function pushRow() { pushField(); rows.push(row); row = []; }
    while (i < n) {
      var ch = text.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; fieldStarted = true; i++; continue; }
      if (ch === ",") { pushField(); fieldStarted = true; i++; continue; }
      if (ch === "\r") { i++; continue; }
      if (ch === "\n") {
        /* a wholly blank physical line becomes an empty row we drop below */
        pushRow(); i++; continue;
      }
      field += ch; fieldStarted = true; i++;
    }
    /* flush the last field/row if the text did not end with a newline, or if the
       final field was a started-but-empty cell */
    if (fieldStarted || field.length || row.length) pushRow();
    /* drop fully empty rows (a single empty cell from a blank trailing line) */
    return rows.filter(function (r) {
      return !(r.length === 1 && r[0] === "");
    });
  }

  /* Decide whether pasted text looks like CSV: a header line of comma-separated
     names plus 1+ data rows, all with the same column count as the header, and
     at least two columns (a single column is ambiguous prose, not a table).
     Returns { ok, headers, dataRows } or { ok:false, error }. */
  function looksLikeCsv(text) {
    var raw = String(text == null ? "" : text).replace(/^﻿/, "");
    if (!raw.trim()) return { ok: false, error: "Empty input." };
    var records = parseCsvRecords(raw);
    if (records.length < 2) {
      return { ok: false, error: "CSV needs a header line and at least one data row." };
    }
    var headers = records[0].map(function (h) { return String(h == null ? "" : h).trim(); });
    if (headers.length < 2) {
      return { ok: false, error: "CSV needs at least two comma-separated columns." };
    }
    if (headers.some(function (h) { return h === ""; })) {
      return { ok: false, error: "CSV header has an empty column name." };
    }
    var dataRows = records.slice(1);
    /* every data row must have exactly the header's column count (quote-aware,
       so a quoted comma does not inflate the count) */
    var bad = dataRows.filter(function (r) { return r.length !== headers.length; });
    if (bad.length) {
      return {
        ok: false,
        error: "CSV column counts are inconsistent: header has " + headers.length +
          " columns but " + bad.length + " row(s) differ.",
      };
    }
    return { ok: true, headers: headers, dataRows: dataRows };
  }

  /* Vote a CSV column's scalar C# kind from its cell strings, mirroring the JSON
     inference: a column is int if every non-empty cell is a whole number, double
     if numeric with any fractional value, bool for true/false, DateTime-ish when
     every non-empty cell looks like a date, else string. Empty cells force the
     property nullable (the exam's planted-missing trap). */
  function csvColumnKind(cells) {
    var present = 0, sawEmpty = false;
    var allInt = true, allNum = true, allBool = true, allDate = true, anyValue = false;
    cells.forEach(function (cell) {
      var v = String(cell == null ? "" : cell).trim();
      if (v === "") { sawEmpty = true; return; }
      present++; anyValue = true;
      if (!/^-?\d+$/.test(v)) allInt = false;
      if (!/^-?\d+(\.\d+)?$/.test(v) && !/^-?\.\d+$/.test(v)) allNum = false;
      if (!/^(true|false)$/i.test(v)) allBool = false;
      if (!looksLikeDate(v)) allDate = false;
    });
    var base = "string", isDate = false;
    if (anyValue) {
      if (allBool) base = "bool";
      else if (allInt) base = "int";
      else if (allNum) base = "double";
      else if (allDate) { base = "string"; isDate = true; }
      else base = "string";
    }
    return { baseType: base, isDateString: isDate, nullable: sawEmpty || present === 0 };
  }

  /* Build a flat one-class model from CSV headers + data rows. CSV is flat by
     definition, so there are no nested classes or collections: every property is
     a scalar (string/int/double/bool, optionally a DateTime via the same toggle
     JSON mode offers for date-looking strings). The model carries csvMode plus a
     csvColumns list (original header text -> property/baseType) so codegen can
     emit a header-driven ParseCsv helper and the model card can show the badge. */
  function inferCsvModel(parsed, opts) {
    opts = opts || {};
    var headers = parsed.headers;
    var dataRows = parsed.dataRows;
    var rootName = opts.rootClass || "Row";
    if (!isIdentifier(rootName)) rootName = "Row";

    /* a property name per header, de-duplicated so two headers never collide */
    var used = {};
    var columns = headers.map(function (h, ci) {
      var prop = pascal(h);
      if (!prop) prop = "Field" + (ci + 1);
      var bareDup = prop;
      var k = 2;
      while (used[prop]) { prop = bareDup + k; k++; }
      used[prop] = true;
      var cells = dataRows.map(function (r) { return r[ci]; });
      var kind = csvColumnKind(cells);
      return {
        header: h,              /* exact original header text (for split-by-index) */
        index: ci,              /* 0-based column position in each record */
        property: prop,
        baseType: kind.baseType,
        isDateString: kind.isDateString,
        nullable: kind.nullable,
      };
    });

    var fields = columns.map(function (c) {
      return {
        key: c.header,
        property: c.property,
        jsonName: null,         /* CSV mode has no [JsonPropertyName] */
        nullable: c.nullable,
        isCollection: false,
        isObject: false,
        isDateString: c.isDateString,
        elementType: null,
        nestedClass: null,
        baseType: c.baseType,
        csvIndex: c.index,
      };
    });

    if (opts.allNullable) fields.forEach(function (f) { f.nullable = true; });

    /* optional rename pass (parallels JSON mode), only the root class can rename */
    var rename = opts.classNames || {};
    if (rename[rootName]) rootName = rename[rootName];

    var rootClass = { name: rootName, fields: fields };
    var byName = {};
    byName[rootName] = rootClass;

    return {
      csvMode: true,
      rootClass: rootName,
      rootKey: null,
      sampleCount: dataRows.length,
      classes: [rootClass],
      byName: byName,
      csvColumns: columns,
    };
  }

  /* Parse pasted text into a model, never throwing: returns
     { ok:true, model } or { ok:false, error }. Tries JSON first (unchanged
     byte-for-byte); only when JSON fails does it fall back to CSV detection, so
     existing JSON behaviour and every JSON test stay identical. */
  function parseSample(text, opts) {
    var raw = String(text == null ? "" : text).trim();
    if (!raw) return { ok: false, error: "Paste a JSON or CSV sample to infer the model." };
    var parsed;
    var jsonErr = null;
    try { parsed = JSON.parse(raw); }
    catch (e) { jsonErr = e; }
    if (jsonErr === null) {
      try { return { ok: true, model: inferModel(parsed, opts) }; }
      catch (e2) { return { ok: false, error: e2.message }; }
    }
    /* not JSON: try CSV before surfacing the JSON error */
    var csv = looksLikeCsv(raw);
    if (csv.ok) {
      try { return { ok: true, model: inferCsvModel(csv, opts) }; }
      catch (e3) { return { ok: false, error: e3.message }; }
    }
    /* neither JSON nor CSV: report the JSON error (the common case) plus a CSV
       hint when the input at least had commas, so the user knows both are tried. */
    var msg = "Invalid JSON: " + jsonErr.message;
    if (raw.indexOf(",") !== -1 && csv.error) msg += "  (also tried CSV: " + csv.error + ")";
    return { ok: false, error: msg };
  }

  /* ===================== C# type rendering ===================== */

  /* Resolve a field's *effective* C# type given the user's per-field type
     override (overrides keyed by "ClassName.key"). Returns the declared C#
     type string including nullability + the convention for collections. */
  function effectiveBaseType(field, override) {
    if (field.isCollection) return field.baseType;     /* List<T> */
    if (field.isObject) return field.baseType;          /* nested class */
    if (override === "DateTime" && field.isDateString) return "DateTime";
    if (override === "string" && field.isDateString) return "string";
    return field.baseType;
  }

  /* The declared property type, applying nullability. Collections use the
     `= new()` convention (never null) UNLESS the field was seen null/missing,
     in which case we keep them nullable so deserialize is honest AND queries
     use the `?.Count ?? 0` guard. This matches the recipes model solution. */
  function declaredType(field, override) {
    var base = effectiveBaseType(field, override);
    if (field.isCollection) {
      return field.nullable ? base + "?" : base;
    }
    if (field.isObject) {
      return field.nullable ? base + "?" : base;
    }
    /* scalars: nullable value types and reference types both take ? */
    if (override === "DateTime" && field.isDateString) {
      return field.nullable ? "DateTime?" : "DateTime";
    }
    return field.nullable ? base + "?" : base;
  }

  /* Does a collection property need a null-conditional access in queries?
     true when it is declared nullable. */
  function collectionIsNullable(field, override) {
    return field.isCollection && field.nullable;
  }

  /* ===================== model code emission ===================== */

  function emitModelClasses(model, overrides) {
    overrides = overrides || {};
    var L = [];
    model.classes.forEach(function (cls, ci) {
      if (ci > 0) L.push("");
      L.push("public class " + cls.name);
      L.push("{");
      cls.fields.forEach(function (f) {
        var ov = overrides[cls.name + "." + f.key];
        if (f.jsonName) L.push('    [JsonPropertyName("' + f.jsonName + '")]');
        var type = declaredType(f, ov);
        if (f.isCollection && !f.nullable) {
          /* non-null collection convention: initialise so LINQ is always safe */
          L.push("    public " + type + " " + f.property + " { get; set; } = new();");
        } else if (model.csvMode && !f.nullable && f.baseType === "string" &&
                   !(ov === "DateTime" && f.isDateString)) {
          /* CSV non-null string: initialise to "" so Nullable-enabled builds emit
             no CS8618 (the parser fills it from a cell, never leaving it null). */
          L.push("    public " + type + " " + f.property + ' { get; set; } = "";');
        } else {
          L.push("    public " + type + " " + f.property + " { get; set; }");
        }
      });
      L.push("}");
    });
    return L.join("\n");
  }

  /* ===================== query field access expressions ===================== */

  /* Build the C# accessor for a field on the element variable (default "s"),
     honouring nullability so generated code desk-checks. For collections this
     returns the count expression building block. */
  function fieldRef(model, fieldKey, overrides, elem) {
    elem = elem || "s";
    var f = findRootField(model, fieldKey);
    if (!f) return elem + "." + pascal(fieldKey);
    return elem + "." + f.property;
  }

  function findRootField(model, fieldKey) {
    var root = model.byName[model.rootClass];
    if (!root) return null;
    return root.fields.filter(function (f) { return f.key === fieldKey || f.property === fieldKey; })[0] || null;
  }

  /* nested field on the element type of a collection: "TravelHistory[].ArrivalDate"
     splits into { collection: "TravelHistory", sub: "ArrivalDate" }. */
  function parseNestedPath(path) {
    var m = /^(.+?)\[\]\.(.+)$/.exec(String(path || ""));
    if (!m) return null;
    return { collectionKey: m[1], subKey: m[2] };
  }

  /* count expression for a collection field, null-safe when nullable:
     nullable -> "s.TravelHistory?.Count ?? 0"; non-null -> "s.Items.Count" */
  function countExpr(model, fieldKey, overrides, elem) {
    elem = elem || "s";
    var f = findRootField(model, fieldKey);
    if (!f) return elem + "." + pascal(fieldKey) + ".Count";
    var access = elem + "." + f.property;
    if (collectionIsNullable(f, overrides)) return access + "?.Count ?? 0";
    return access + ".Count";
  }

  /* a non-null enumerable expression for a collection field, for .Any()/.Average()
     etc.: nullable -> "(s.X ?? new())"; non-null -> "s.X" */
  function enumerableExpr(model, fieldKey, overrides, elem) {
    elem = elem || "s";
    var f = findRootField(model, fieldKey);
    if (!f) return elem + "." + pascal(fieldKey);
    var access = elem + "." + f.property;
    if (collectionIsNullable(f, overrides)) return "(" + access + " ?? new())";
    return access;
  }

  /* element type of a collection field (for nested-any lambdas) */
  function collectionElementType(model, fieldKey) {
    var f = findRootField(model, fieldKey);
    return (f && f.elementType) || "object";
  }

  /* find a field on a NESTED class by collection key + sub key */
  function nestedField(model, collectionKey, subKey) {
    var f = findRootField(model, collectionKey);
    if (!f || !f.nestedClass) return null;
    var nc = model.byName[f.nestedClass];
    if (!nc) return null;
    return nc.fields.filter(function (x) { return x.key === subKey || x.property === subKey; })[0] || null;
  }

  /* ===================== per-shape LINQ generation ===================== */

  /* Each generator returns { expr } — the full right-hand-side LINQ chain
     (without the leading "var name = " and trailing ";", which buildQueryLine
     adds) — plus optional flags. row carries the user's field/value picks. */

  function esc(v) { return String(v == null ? "" : v); }
  function csString(v) { return '"' + esc(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }

  /* The effective non-nullable C# scalar base of a root field, honouring the
     user's per-field override (e.g. a date-looking string promoted to DateTime).
     Returns "string" for anything not a known scalar so callers stay string-safe. */
  function rootEffectiveBase(model, field, overrides) {
    if (!field || field.isCollection || field.isObject) return "string";
    var ov = (overrides || {})[model.rootClass + "." + field.key];
    return effectiveBaseType(field, ov);
  }

  /* Render the comparison value for a `field == value` filter as a C# literal of
     the field's type, so a bool/numeric column never gets compared to a string
     literal (which would not compile, CS0019). bool -> true/false, int/double ->
     the numeric token verbatim, everything else (string, DateTime, unparseable
     numbers) -> a quoted string literal. Returns null when the requested value
     cannot be rendered as the typed literal (caller falls back to string). */
  function equalsLiteral(base, value) {
    var v = esc(value).trim();
    if (base === "bool") {
      if (/^true$/i.test(v)) return "true";
      if (/^false$/i.test(v)) return "false";
      return null;
    }
    if (base === "int") {
      return /^-?\d+$/.test(v) ? v : null;
    }
    if (base === "double") {
      if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(v)) return null;
      return v.indexOf(".") === -1 ? v : v;   /* a valid C# double literal as-is */
    }
    return null;   /* string / DateTime / anything else: caller uses csString */
  }

  function genFilterEquals(model, row, overrides) {
    var f = findRootField(model, row.field);
    var ref = fieldRef(model, row.field, overrides);
    var base = rootEffectiveBase(model, f, overrides);
    var typedLit = (base === "string" || base === "DateTime") ? null : equalsLiteral(base, row.value);
    var cmp;
    if (typedLit !== null) {
      /* bool / numeric column: a typed `==` literal. Case-insensitive is a
         string-only notion (string.Equals(...)) and does not apply here. */
      cmp = ref + " == " + typedLit;
    } else {
      var val = csString(row.value);
      if (row.caseInsensitive) {
        cmp = "string.Equals(" + ref + ", " + val + ", StringComparison.OrdinalIgnoreCase)";
      } else {
        cmp = ref + " == " + val;
      }
    }
    return { expr: "source\n    .Where(s => " + cmp + ")\n    .ToList()" };
  }

  function genFilterContains(model, row, overrides) {
    var f = findRootField(model, row.field);
    var val = csString(row.value);
    var ref = fieldRef(model, row.field, overrides);
    var cmp;
    if (f && f.isCollection) {
      /* a string collection: null-safe Contains, matching the recipes solution
         `r.DietaryTags?.Contains("Vegetarian") ?? false` */
      cmp = ref + "?.Contains(" + val + ") ?? false";
      if (row.caseInsensitive) {
        cmp = enumerableExpr(model, row.field, overrides) +
          ".Any(x => string.Equals(x, " + val + ", StringComparison.OrdinalIgnoreCase))";
      }
    } else {
      if (row.caseInsensitive) {
        cmp = "(" + ref + " ?? \"\").Contains(" + val + ", StringComparison.OrdinalIgnoreCase)";
      } else {
        cmp = "(" + ref + " ?? \"\").Contains(" + val + ")";
      }
    }
    return { expr: "source\n    .Where(s => " + cmp + ")\n    .ToList()" };
  }

  function genFilterEmptyCollection(model, row, overrides) {
    /* "empty or missing": null or Count == 0, matching
       `(r.DietaryTags?.Count ?? 0) == 0` */
    var cnt = countExpr(model, row.field, overrides);
    return { expr: "source\n    .Where(s => (" + cnt + ") == 0)\n    .ToList()" };
  }

  function genFilterNestedAny(model, row, overrides) {
    var enumExpr = enumerableExpr(model, row.collection, overrides);
    var elemType = collectionElementType(model, row.collection);
    var nf = nestedField(model, row.collection, row.subField);
    var subProp = nf ? nf.property : pascal(row.subField || "Field");
    var predicate;
    var mode = row.match || "equals";
    var ov = nf ? overrides[model.byName[findRootField(model, row.collection).nestedClass].name + "." + nf.key] : null;
    if (mode === "null") {
      predicate = "t." + subProp + " == null";
    } else if (mode === "year") {
      /* date-typed sub field: year compare via DateTime?.Year; string-typed: StartsWith */
      if (nf && nf.isDateString && ov !== "DateTime") {
        predicate = "(t." + subProp + " ?? \"\").StartsWith(" + csString(row.value) + ")";
      } else if (nf && nf.isDateString && ov === "DateTime") {
        predicate = "t." + subProp + "?.Year == " + (parseInt(row.value, 10) || 0);
      } else {
        predicate = "t." + subProp + "?.Year == " + (parseInt(row.value, 10) || 0);
      }
    } else {
      predicate = "t." + subProp + " == " + csString(row.value);
    }
    return { expr: "source\n    .Where(s => " + enumExpr + ".Any(t => " + predicate + "))\n    .ToList()" };
  }

  function genSortBy(model, row, overrides) {
    var dir = row.direction === "asc" ? "OrderBy" : "OrderByDescending";
    var keySel;
    var f = findRootField(model, row.field);
    if (row.byCount && f && f.isCollection) {
      keySel = "s => " + (collectionIsNullable(f, overrides)
        ? "s." + f.property + "?.Count ?? 0"
        : "s." + f.property + ".Count");
    } else {
      keySel = "s => " + fieldRef(model, row.field, overrides);
    }
    var chain = "source\n    ." + dir + "(" + keySel + ")";
    if (row.thenBy) {
      var tdir = row.thenDirection === "desc" ? "ThenByDescending" : "ThenBy";
      chain += "\n    ." + tdir + "(s => " + fieldRef(model, row.thenBy, overrides) + ")";
    }
    chain += "\n    .ToList()";
    return { expr: chain };
  }

  function genGroupAggregate(model, row, overrides) {
    var groupKey = fieldRef(model, row.field, overrides);
    var f = findRootField(model, row.field);
    /* null-coalesce the group key so a null type doesn't crash GroupBy, matching
       the spaceships solution `GroupBy(s => s.Type ?? "Unknown")` */
    if (f && !f.isCollection && /string/.test(f.baseType)) groupKey = groupKey + " ?? \"Unknown\"";
    var agg = row.aggregate || "Count";
    var valueExpr;
    if (agg === "Count") {
      valueExpr = "g.Count()";
    } else {
      /* Average/Max/Min over a sub expression: a collection Count or a numeric field */
      var subExpr;
      if (row.subCount) {
        var cf = findRootField(model, row.subField);
        subExpr = cf && collectionIsNullable(cf, overrides)
          ? "x." + (cf ? cf.property : pascal(row.subField)) + "?.Count ?? 0"
          : "x." + (cf ? cf.property : pascal(row.subField)) + ".Count";
      } else {
        var nfld = findRootField(model, row.subField);
        subExpr = "x." + (nfld ? nfld.property : pascal(row.subField)) +
          (nfld && nfld.nullable ? " ?? 0" : "");
      }
      valueExpr = "g." + agg + "(x => " + subExpr + ")";
    }
    var expr = "source\n    .GroupBy(s => " + groupKey + ")\n" +
      "    .Select(g => new { Key = g.Key, Value = " + valueExpr + " })\n    .ToList()";
    return { expr: expr };
  }

  function genAboveAverage(model, row, overrides) {
    var f = findRootField(model, row.field);
    var perElem, avgSel;
    if (row.byCount && f && f.isCollection) {
      perElem = collectionIsNullable(f, overrides) ? "s." + f.property + "?.Count ?? 0" : "s." + f.property + ".Count";
      avgSel = "r => " + (collectionIsNullable(f, overrides) ? "r." + f.property + "?.Count ?? 0" : "r." + f.property + ".Count");
    } else {
      perElem = "s." + (f ? f.property : pascal(row.field)) + (f && f.nullable ? " ?? 0" : "");
      avgSel = "r => r." + (f ? f.property : pascal(row.field)) + (f && f.nullable ? " ?? 0" : "");
    }
    /* compute the list-wide average ONCE (a > comparison, strictly greater),
       matching the recipes solution. The average pre-statement is emitted by
       buildQueryLine via the .pre field. */
    var avgVar = (row.name || "q") + "Average";
    var pre = "double " + avgVar + " = source.Any() ? source.Average(" + avgSel + ") : 0;";
    var expr = "source\n    .Where(s => (" + perElem + ") > " + avgVar + ")\n    .ToList()";
    return { expr: expr, pre: pre };
  }

  function genTopN(model, row, overrides) {
    var dir = row.direction === "asc" ? "OrderBy" : "OrderByDescending";
    var f = findRootField(model, row.field);
    var keySel;
    if (row.byCount && f && f.isCollection) {
      keySel = collectionIsNullable(f, overrides) ? "s." + f.property + "?.Count ?? 0" : "s." + f.property + ".Count";
    } else {
      keySel = fieldRef(model, row.field, overrides);
    }
    var n = parseInt(row.n, 10) || 5;
    return { expr: "source\n    ." + dir + "(s => " + keySel + ")\n    .Take(" + n + ")\n    .ToList()" };
  }

  function genSelectFields(model, row, overrides) {
    var fields = (row.fields || []).filter(Boolean);
    if (!fields.length) {
      var root = model.byName[model.rootClass];
      fields = root ? root.fields.slice(0, 2).map(function (f) { return f.key; }) : [];
    }
    var props = fields.map(function (k) {
      var f = findRootField(model, k);
      return f ? f.property + " = s." + f.property : pascal(k) + " = s." + pascal(k);
    });
    return { expr: "source\n    .Select(s => new { " + props.join(", ") + " })\n    .ToList()" };
  }

  function genBinarySearch(model, row, overrides) {
    /* Sort the list by a string field with a null-safe Ordinal comparer, then
       BinarySearch for the target using the SAME comparer. Emits the full idiom
       used by the spaceships solution but via List.BinarySearch + Comparer<T>. */
    var f = findRootField(model, row.field);
    var prop = f ? f.property : pascal(row.field);
    var target = csString(row.value);
    var sortedVar = (row.name || "q") + "Sorted";
    var cmpVar = (row.name || "q") + "Comparer";
    var idxVar = (row.name || "q") + "Index";
    var elemType = model.rootClass;
    var probe = "new " + elemType + " { " + prop + " = " + target + " }";
    var lines = [];
    lines.push("// sort by " + prop + " with a null-safe Ordinal comparer (some values may be null)");
    lines.push("Comparer<" + elemType + "> " + cmpVar + " = Comparer<" + elemType + ">.Create(");
    lines.push("    (a, b) => string.Compare(a." + prop + " ?? \"\", b." + prop + " ?? \"\", StringComparison.Ordinal));");
    lines.push("List<" + elemType + "> " + sortedVar + " = source.OrderBy(s => s." + prop + ", StringComparer.Ordinal).ToList();");
    lines.push("int " + idxVar + " = " + sortedVar + ".BinarySearch(" + probe + ", " + cmpVar + ");");
    return {
      raw: lines.join("\n"),
      /* binary search doesn't fit the "var name = expr" mould; expose the
         result index variable so printing/output can reference it. */
      resultVar: idxVar,
      sortedVar: sortedVar,
      isBinarySearch: true,
    };
  }

  var SHAPES = {
    "filter-equals": { gen: genFilterEquals, label: "filter (field equals value)" },
    "filter-contains": { gen: genFilterContains, label: "filter (field/collection contains value)" },
    "filter-empty-collection": { gen: genFilterEmptyCollection, label: "filter (collection empty or missing)" },
    "filter-nested-any": { gen: genFilterNestedAny, label: "filter (nested collection Any)" },
    "sort-by": { gen: genSortBy, label: "sort by field or collection count" },
    "group-aggregate": { gen: genGroupAggregate, label: "group + aggregate (Count/Average/Max/Min)" },
    "above-average": { gen: genAboveAverage, label: "above list-wide average" },
    "top-n": { gen: genTopN, label: "top N (OrderBy + Take)" },
    "select-fields": { gen: genSelectFields, label: "select / project fields" },
    "binary-search": { gen: genBinarySearch, label: "binary search by string field" },
  };

  function shapeKeys() { return Object.keys(SHAPES); }

  /* ===================== query line assembly ===================== */

  /* Produce the code for one query row:
     { decl, pre, printBlock, outputMember, name, label } */
  /* nested-collection shapes a flat CSV cannot satisfy: codegen emits a harmless
     comment for them in CSV mode (the UI also disables the row), so a stale row
     never produces broken C#. */
  var CSV_INCOMPATIBLE = { "filter-empty-collection": true, "filter-nested-any": true };

  function buildQuery(model, row, overrides) {
    var def = SHAPES[row.shape];
    var name = isIdentifier(row.name) ? row.name : "q";
    var label = row.label || (def ? def.label : row.shape);
    if (!def) {
      return { decl: "// (unknown query shape: " + esc(row.shape) + ")", name: name, label: label };
    }
    if (model.csvMode && CSV_INCOMPATIBLE[row.shape]) {
      return {
        decl: "// (skipped: '" + esc(row.shape) + "' needs a nested collection; CSV is flat)",
        name: name, label: label, shape: row.shape,
      };
    }
    var result = def.gen(model, Object.assign({}, row, { name: name }), overrides);

    var out = { name: name, label: label, shape: row.shape };

    if (result.isBinarySearch) {
      out.decl = result.raw;
      out.resultVar = result.resultVar;
      out.sortedVar = result.sortedVar;
      out.isBinarySearch = true;
      if (row.print) {
        out.printBlock = [
          "Console.WriteLine(" + result.resultVar + " >= 0",
          "    ? $\"Found " + esc(row.value) + " at index {" + result.resultVar + "}\"",
          "    : \"" + esc(row.value) + " not found\");",
        ].join("\n");
      }
      /* binary search result is an index; the "result" exported to JSON is the
         found element (or null), which the caller may include if requested. */
      if (row.output && isIdentifier(row.outputKey || name)) {
        out.outputKey = row.outputKey || name;
        out.outputExpr = result.resultVar + " >= 0 ? " + result.sortedVar + "[" + result.resultVar + "] : null";
      }
      return out;
    }

    if (result.pre) out.pre = result.pre;
    out.decl = "var " + name + " = " + result.expr + ";";

    if (row.print) {
      out.printBlock = buildPrint(model, row, name, result);
    }
    if (row.output && isIdentifier(row.outputKey || name)) {
      out.outputKey = row.outputKey || name;
      out.outputExpr = name;
    }
    return out;
  }

  /* readable console print for a list result */
  function buildPrint(model, row, name, result) {
    var lines = [];
    lines.push('Console.WriteLine($"--- {' + name + '.Count} result(s): ' + esc(row.label || row.shape) + ' ---");');
    if (row.shape === "group-aggregate") {
      lines.push("foreach (var g in " + name + ")");
      lines.push("{");
      lines.push("    Console.WriteLine($\"{g.Key}: {g.Value}\");");
      lines.push("}");
    } else if (row.shape === "select-fields") {
      lines.push("foreach (var item in " + name + ")");
      lines.push("{");
      lines.push("    Console.WriteLine(item);");
      lines.push("}");
    } else {
      var labelField = pickDisplayField(model);
      lines.push("foreach (var item in " + name + ")");
      lines.push("{");
      if (labelField) {
        lines.push("    Console.WriteLine(item." + labelField + ");");
      } else {
        lines.push("    Console.WriteLine(item);");
      }
      lines.push("}");
    }
    return lines.join("\n");
  }

  /* choose a human-readable field to print (Name-like string field, else first) */
  function pickDisplayField(model) {
    var root = model.byName[model.rootClass];
    if (!root) return null;
    var named = root.fields.filter(function (f) {
      return !f.isCollection && !f.isObject && /name|title|id/i.test(f.property) && /string/.test(f.baseType);
    })[0];
    if (named) return named.property;
    var firstStr = root.fields.filter(function (f) {
      return !f.isCollection && !f.isObject && /string/.test(f.baseType);
    })[0];
    return firstStr ? firstStr.property : null;
  }

  /* ===================== full Program.cs generation ===================== */

  /* Emit the Program class body (the `internal class Program { ... }` block,
     WITHOUT usings/namespace/model classes). Returned as an array of lines so
     the single-file path and the two-file submission path share one source of
     truth for the deserialize + query + print + output logic. */
  function emitProgramClass(model, rows, opts) {
    opts = opts || {};
    var overrides = opts.overrides || {};
    rows = Array.isArray(rows) ? rows : [];
    var inputFile = opts.inputFile || "data.json";
    var outputFile = opts.outputFile || "Problem_4_Query_Results.json";
    var ns = opts.namespace || "Problem4";

    var queries = rows.map(function (r) { return buildQuery(model, r, overrides); });
    var hasOutput = queries.some(function (q) { return q.outputKey; });

    var L = [];
    L.push("internal class Program");
    L.push("{");
    L.push("    private static void Main()");
    L.push("    {");
    if (model.csvMode) {
      /* CSV mode: System-only parse via the ParseCsv helper (CSVHelper is NOT an
         allowed library). The helper reads + splits + TryParses each row below. */
      var csvInput = opts.inputFile || "data.csv";
      L.push("        // ---- Parse the CSV (System-only, null-safe per column) ----");
      L.push("        List<" + model.rootClass + "> source = ParseCsv(\"" + esc(csvInput) + "\");");
    } else {
      L.push("        // ---- Deserialize the JSON (case-insensitive, null-safe) ----");
      L.push("        JsonSerializerOptions options = new() { PropertyNameCaseInsensitive = true };");
      L.push('        string json = File.ReadAllText("' + esc(inputFile) + '");');
      if (model.rootKey) {
        /* object wrapper: deserialize the wrapper, then take its array property */
        var wrapperProp = pascal(model.rootKey);
        L.push("        " + wrapperName(ns) + " wrapper =");
        L.push("            JsonSerializer.Deserialize<" + wrapperName(ns) + ">(json, options) ?? new " + wrapperName(ns) + "();");
        L.push("        List<" + model.rootClass + "> source = wrapper." + wrapperProp + " ?? new List<" + model.rootClass + ">();");
      } else {
        L.push("        List<" + model.rootClass + "> source =");
        L.push("            JsonSerializer.Deserialize<List<" + model.rootClass + ">>(json, options)");
        L.push("            ?? new List<" + model.rootClass + ">();");
      }
    }
    L.push("");

    /* each query in order */
    queries.forEach(function (q, qi) {
      L.push("        // Query " + (qi + 1) + ": " + q.label);
      if (q.pre) L.push("        " + q.pre);
      L.push(indent(q.decl, "        "));
      L.push("");
    });

    /* printing */
    var anyPrint = queries.some(function (q) { return q.printBlock; });
    if (anyPrint) {
      L.push("        // ---- Print results ----");
      queries.forEach(function (q) {
        if (q.printBlock) {
          L.push(indent(q.printBlock, "        "));
          L.push("");
        }
      });
    }

    /* exact-key output JSON */
    if (hasOutput) {
      L.push("        // ---- Serialize selected results to one JSON file (EXACT keys) ----");
      L.push("        var results = new");
      L.push("        {");
      var outRows = queries.filter(function (q) { return q.outputKey; });
      outRows.forEach(function (q, oi) {
        var comma = oi < outRows.length - 1 ? "," : "";
        if (q.outputKey === q.outputExpr) {
          L.push("            " + q.outputKey + comma);
        } else {
          L.push("            " + q.outputKey + " = " + q.outputExpr + comma);
        }
      });
      L.push("        };");
      L.push("");
      L.push('        File.WriteAllText("' + esc(outputFile) + '",');
      L.push("            JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true }));");
      L.push('        Console.WriteLine("Wrote ' + esc(outputFile) + '");');
    }

    /* trim trailing blank lines inside Main */
    while (L.length && L[L.length - 1] === "") L.pop();
    L.push("    }");

    /* CSV mode emits the ParseCsv helper + a quote-aware SplitCsvLine inside the
       same Program class (System-only, no CSVHelper). */
    if (model.csvMode) {
      L.push("");
      emitCsvParser(model, opts).forEach(function (ln) { L.push(ln); });
    }

    L.push("}");
    return L;
  }

  /* Emit the static ParseCsv + SplitCsvLine helpers (System-only). ParseCsv reads
     all lines, skips the header, splits each data line with the quote-aware
     SplitCsvLine, then TryParses each typed column, leaving the property null on
     an empty cell or a parse failure (the exam's planted-missing trap). The
     splitter is a small state loop so a quoted comma survives, exactly the idiom
     the lecture frames as the legal CSVHelper-free alternative. Returned as lines
     indented to sit inside the Program class. */
  function emitCsvParser(model, opts) {
    opts = opts || {};
    var inputFile = opts.inputFile || "data.csv";
    var root = model.byName[model.rootClass];
    var fields = (root && root.fields) || [];
    var overrides = opts.overrides || {};
    var L = [];

    L.push("    // Read the CSV with System types only (no external CSV library is allowed).");
    L.push("    // Skips the header line, then maps each row's cells to a typed " + model.rootClass + ".");
    L.push("    private static List<" + model.rootClass + "> ParseCsv(string path)");
    L.push("    {");
    L.push("        var rows = new List<" + model.rootClass + ">();");
    L.push("        string[] lines = File.ReadAllLines(path);");
    L.push("        // line 0 is the header; data starts at line 1.");
    L.push("        for (int i = 1; i < lines.Length; i++)");
    L.push("        {");
    L.push("            if (string.IsNullOrWhiteSpace(lines[i])) continue;");
    L.push("            string[] cells = SplitCsvLine(lines[i]);");
    L.push("            var row = new " + model.rootClass + "();");
    fields.forEach(function (f) {
      var idx = f.csvIndex;
      var ov = overrides[model.rootClass + "." + f.key];
      L.push("            // column " + idx + ": " + f.property);
      L.push("            if (" + idx + " < cells.Length)");
      L.push("            {");
      L.push(indentN(csvAssignLines(f, ov, idx), 16));
      L.push("            }");
    });
    L.push("            rows.Add(row);");
    L.push("        }");
    L.push("        return rows;");
    L.push("    }");
    L.push("");
    /* the quote-aware splitter: a 10-line state loop so quoted commas survive */
    L.push("    // Quote-aware single-line splitter: a comma inside \"...\" stays in the field,");
    L.push("    // and a doubled \"\" inside a quoted field is one literal quote.");
    L.push("    private static string[] SplitCsvLine(string line)");
    L.push("    {");
    L.push("        var cells = new List<string>();");
    L.push("        var sb = new System.Text.StringBuilder();");
    L.push("        bool inQuotes = false;");
    L.push("        for (int i = 0; i < line.Length; i++)");
    L.push("        {");
    L.push("            char c = line[i];");
    L.push("            if (inQuotes)");
    L.push("            {");
    L.push("                if (c == '\"' && i + 1 < line.Length && line[i + 1] == '\"') { sb.Append('\"'); i++; }");
    L.push("                else if (c == '\"') { inQuotes = false; }");
    L.push("                else { sb.Append(c); }");
    L.push("            }");
    L.push("            else if (c == '\"') { inQuotes = true; }");
    L.push("            else if (c == ',') { cells.Add(sb.ToString()); sb.Clear(); }");
    L.push("            else { sb.Append(c); }");
    L.push("        }");
    L.push("        cells.Add(sb.ToString());");
    L.push("        return cells.ToArray();");
    L.push("    }");
    return L;
  }

  /* the per-column assignment for ParseCsv: trim the cell, leave the property null
     when empty, otherwise TryParse into the typed (nullable) property. Strings are
     assigned directly (null when empty); DateTime via DateTime.TryParse. Returns
     a multi-line string (no leading indent; the caller indents the whole block). */
  function csvAssignLines(field, override, idx) {
    var prop = field.property;
    var cell = "cells[" + idx + "].Trim()";
    var lines = [];
    lines.push("string v" + idx + " = " + cell + ";");
    var isDate = field.isDateString && override === "DateTime";
    var base = field.baseType;
    if (override === "DateTime" && field.isDateString) base = "DateTime";

    if (base === "string") {
      if (field.nullable) {
        /* empty string -> null so a planted missing value reads as null */
        lines.push("row." + prop + " = v" + idx + ".Length == 0 ? null : v" + idx + ";");
      } else {
        /* non-nullable string column: assign verbatim (empty stays "") */
        lines.push("row." + prop + " = v" + idx + ";");
      }
    } else if (base === "int") {
      lines.push("if (int.TryParse(v" + idx + ", out int p" + idx + ")) row." + prop + " = p" + idx + ";");
    } else if (base === "double") {
      lines.push("if (double.TryParse(v" + idx + ", System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double p" + idx + ")) row." + prop + " = p" + idx + ";");
    } else if (base === "bool") {
      lines.push("if (bool.TryParse(v" + idx + ", out bool p" + idx + ")) row." + prop + " = p" + idx + ";");
    } else if (base === "DateTime") {
      lines.push("if (DateTime.TryParse(v" + idx + ", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out DateTime p" + idx + ")) row." + prop + " = p" + idx + ";");
    } else {
      lines.push("row." + prop + " = v" + idx + ".Length == 0 ? null : v" + idx + ";");
    }
    return lines.join("\n");
  }

  /* indent every line of a block by n spaces (blank lines stay blank). */
  function indentN(block, n) {
    var pad = new Array(n + 1).join(" ");
    return String(block).split("\n").map(function (ln) {
      return ln.length ? pad + ln : ln;
    }).join("\n");
  }

  /* Emit the wrapper class (for object-rooted JSON) followed by the model
     classes, as an array of lines. Shared by both code paths so the inferred
     model is identical whether it lands in one file or the submission's
     Models.cs. Returns [] only when there are no classes at all. */
  function emitModelSection(model, overrides) {
    var L = [];
    if (model.rootKey) {
      var ns = "JsonRoot";
      L.push("public class " + wrapperName(ns));
      L.push("{");
      var wp = pascal(model.rootKey);
      if (wp !== model.rootKey) L.push('    [JsonPropertyName("' + model.rootKey + '")]');
      L.push("    public List<" + model.rootClass + ">? " + wp + " { get; set; }");
      L.push("}");
      L.push("");
    }
    L.push(emitModelClasses(model, overrides));
    return L;
  }

  function generateProgram(model, rows, opts) {
    opts = opts || {};
    var overrides = opts.overrides || {};
    var ns = opts.namespace || "Problem4";

    var L = [];
    L.push("using System;");
    L.push("using System.Collections.Generic;");
    L.push("using System.IO;");
    L.push("using System.Linq;");
    L.push("using System.Text.Json;");
    L.push("using System.Text.Json.Serialization;");
    L.push("");
    L.push("namespace " + ns + ";");
    L.push("");
    /* Program class, then the wrapper + model classes, in one file (unchanged). */
    emitProgramClass(model, rows, opts).forEach(function (ln) { L.push(ln); });
    L.push("");
    emitModelSection(model, overrides).forEach(function (ln) { L.push(ln); });
    L.push("");

    return L.join("\n");
  }

  /* Two-file SUBMISSION mode (spec 16): Problem_4_Program.cs + Problem_4_Models.cs.
     Program.cs carries Program + the queries; Models.cs carries the wrapper class
     (object-rooted JSON) and the model classes. BOTH files share the SAME namespace
     so the two flat files compile together exactly like the single-file version,
     with no third file. Only System.*, System.Text.Json.* usings are emitted. */
  function generateSubmissionFiles(model, rows, opts) {
    opts = opts || {};
    var overrides = opts.overrides || {};
    var ns = opts.namespace || "Problem4";

    /* ---- Problem_4_Program.cs : usings + namespace + Program class ---- */
    var P = [];
    P.push("using System;");
    P.push("using System.Collections.Generic;");
    P.push("using System.IO;");
    P.push("using System.Linq;");
    P.push("using System.Text.Json;");
    P.push("");
    P.push("namespace " + ns + ";");
    P.push("");
    emitProgramClass(model, rows, opts).forEach(function (ln) { P.push(ln); });
    P.push("");

    /* ---- Problem_4_Models.cs : usings + namespace + (wrapper +) model classes ---- */
    var modelLines = emitModelSection(model, overrides);
    var modelBody = modelLines.join("\n");
    var M = [];
    M.push("using System.Collections.Generic;");
    M.push("using System.Text.Json.Serialization;");
    /* a DateTime?-typed field (from a date override) needs System for DateTime,
       so the pair compiles even in a project with ImplicitUsings disabled. */
    if (/\bDateTime\b/.test(modelBody)) M.unshift("using System;");
    M.push("");
    M.push("namespace " + ns + ";");
    M.push("");
    modelLines.forEach(function (ln) { M.push(ln); });
    M.push("");

    return { program: P.join("\n"), models: M.join("\n") };
  }

  function wrapperName(ns) { return "JsonRoot"; }

  function indent(block, prefix) {
    return String(block).split("\n").map(function (ln) {
      return ln.length ? prefix + ln : ln;
    }).join("\n");
  }

  /* ===================== presets ===================== */

  /* Sample JSON snippets deliberately include the planted exam traps so the
     inference exercises nullability: a missing Name, a null ArrivalDate, ships
     with no TravelHistory. Query rows + output keys reproduce the verified
     model solutions. */

  var SUMMER_SAMPLE = JSON.stringify([
    {
      "shipId": "SHP-CAR-001",
      "name": "Belt Hauler",
      "type": "Cargo",
      "travelHistory": [
        { "tripId": "T1", "departurePort": "Ceres Station", "arrivalPort": "Ganymede Port", "departureDate": "2244-01-10", "arrivalDate": "2244-02-01" },
        { "tripId": "T2", "departurePort": "Ganymede Port", "arrivalPort": "Titan Base", "departureDate": "2245-03-05", "arrivalDate": null }
      ]
    },
    {
      "shipId": "SHP-MIL-004",
      "name": "Rocinante",
      "type": "Military",
      "travelHistory": [
        { "tripId": "T9", "departurePort": "Tycho Station", "arrivalPort": "Ceres Station", "arrivalDate": "2245-06-04" }
      ]
    },
    {
      "shipId": "SHP-MIL-005",
      "type": "Military"
    }
  ], null, 2);

  var REEXAM_SAMPLE = JSON.stringify([
    { "name": "Vegetable Curry", "ingredients": ["Onion", "Curry Paste", "Coconut Milk", "Mixed Vegetables"], "dietaryTags": ["Vegetarian", "Vegan"] },
    { "name": "Tagiatelle Carbonara", "ingredients": ["Pasta", "Eggs", "Pancetta", "Parmesan"], "dietaryTags": [] },
    { "name": "Lentil Soup", "ingredients": ["Lentils", "Carrot", "Stock"], "dietaryTags": ["Vegetarian"] }
  ], null, 2);

  function summerPreset() {
    return {
      name: "Summer 2025 spaceships",
      sample: SUMMER_SAMPLE,
      inputFile: "spaceships.json",
      outputFile: "Problem_4_Query_Results.json",
      namespace: "Spaceships",
      classNames: { "Item": "Spaceship", "TravelHistory": "Trip" },
      overrides: { "Trip.departureDate": "DateTime", "Trip.arrivalDate": "DateTime" },
      rows: [
        { shape: "filter-equals", field: "type", value: "Military", name: "military", label: "all military ships", print: true, output: true, outputKey: "militaryShips" },
        { shape: "filter-nested-any", collection: "travelHistory", subField: "arrivalDate", match: "null", name: "traveling", label: "currently travelling (a trip with no arrival date)", print: true, output: true, outputKey: "currentlyTravelling" },
        { shape: "sort-by", field: "travelHistory", byCount: true, direction: "desc", name: "byTrips", label: "sorted by number of trips, most first", print: true, output: true, outputKey: "sortedByTripCount" },
        { shape: "group-aggregate", field: "type", aggregate: "Average", subField: "travelHistory", subCount: true, name: "avgPerType", label: "average number of trips per ship type", print: true, output: true, outputKey: "averageTripsByType" },
        { shape: "filter-nested-any", collection: "travelHistory", subField: "departureDate", match: "year", value: "2245", name: "departed2245", label: "departed in the year 2245", print: true, output: true, outputKey: "departedIn2245" },
        { shape: "binary-search", field: "name", value: "Rocinante", name: "search", label: "binary search by name for Rocinante", print: true, output: false },
      ],
    };
  }

  function reexamPreset() {
    return {
      name: "ReExam 2025 recipes",
      sample: REEXAM_SAMPLE,
      inputFile: "recipes.json",
      outputFile: "Problem_4_Query_Results.json",
      namespace: "RecipeQueries",
      classNames: { "Item": "Recipe" },
      overrides: {},
      rows: [
        { shape: "filter-contains", field: "dietaryTags", value: "Vegetarian", name: "vegetarianRecipes", label: "vegetarian recipes", print: true, output: true, outputKey: "vegetarianRecipes" },
        { shape: "filter-empty-collection", field: "dietaryTags", name: "noDietaryRestrictions", label: "no dietary restrictions (empty tags)", print: true, output: true, outputKey: "noDietaryRestrictions" },
        { shape: "sort-by", field: "ingredients", byCount: true, direction: "desc", name: "sortedByIngredientCount", label: "sorted by ingredient count, most first", print: true, output: true, outputKey: "sortedByIngredientCount" },
        { shape: "above-average", field: "ingredients", byCount: true, name: "aboveAverageIngredients", label: "more ingredients than the list average", print: true, output: true, outputKey: "aboveAverageIngredients" },
      ],
    };
  }

  function presets() {
    return { summer: summerPreset(), reexam: reexamPreset() };
  }

  /* Build a complete generated program directly from a preset (sample ->
     model -> rows -> code), the one-click path used by the UI + tests. */
  function generateFromPreset(preset) {
    var parsed = parseSample(preset.sample, {
      classNames: preset.classNames,
      rootClass: preset.rootClass,
      allNullable: preset.allNullable !== false,   /* presets default to defensive nullability */
    });
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return {
      ok: true,
      model: parsed.model,
      code: generateProgram(parsed.model, preset.rows, {
        inputFile: preset.inputFile,
        outputFile: preset.outputFile,
        namespace: preset.namespace,
        overrides: preset.overrides,
      }),
    };
  }

  /* Same one-click path but emitting the two-file submission pair
     (Problem_4_Program.cs + Problem_4_Models.cs) for a preset. Used by the
     submission download + the equivalence/compile tests. */
  function generateSubmissionFromPreset(preset) {
    var parsed = parseSample(preset.sample, {
      classNames: preset.classNames,
      rootClass: preset.rootClass,
      allNullable: preset.allNullable !== false,
    });
    if (!parsed.ok) return { ok: false, error: parsed.error };
    var files = generateSubmissionFiles(parsed.model, preset.rows, {
      inputFile: preset.inputFile,
      outputFile: preset.outputFile,
      namespace: preset.namespace,
      overrides: preset.overrides,
    });
    return { ok: true, model: parsed.model, program: files.program, models: files.models };
  }

  /* ===================== export ===================== */

  var CORE = {
    /* inference */
    parseSample: parseSample,
    inferModel: inferModel,
    extractArray: extractArray,
    emitModelClasses: emitModelClasses,
    /* CSV mode */
    looksLikeCsv: looksLikeCsv,
    parseCsvRecords: parseCsvRecords,
    inferCsvModel: inferCsvModel,
    /* codegen */
    generateProgram: generateProgram,
    generateSubmissionFiles: generateSubmissionFiles,
    buildQuery: buildQuery,
    /* shapes */
    SHAPES: SHAPES,
    shapeKeys: shapeKeys,
    /* presets */
    presets: presets,
    summerPreset: summerPreset,
    reexamPreset: reexamPreset,
    generateFromPreset: generateFromPreset,
    generateSubmissionFromPreset: generateSubmissionFromPreset,
    /* small helpers exposed for the UI + tests */
    pascal: pascal,
    singular: singular,
    looksLikeDate: looksLikeDate,
    declaredType: declaredType,
    findRootField: findRootField,
    parseNestedPath: parseNestedPath,
  };

  global.QUERYLAB_CORE = CORE;
  if (typeof module !== "undefined" && module.exports) module.exports = CORE;
})(typeof window !== "undefined" ? window : globalThis);
