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

  function emitModelClasses(model, overrides, emitToString) {
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
      /* task 3.1.3: override ToString() on the root class to print every field.
         Collections print their item count to stay valid across C# versions. */
      if (emitToString && cls.name === model.rootClass && cls.fields.length) {
        L.push("");
        L.push("    public override string ToString()");
        L.push("    {");
        var parts = cls.fields.map(function (f) {
          if (f.isCollection) {
            var ovc = overrides[cls.name + "." + f.key];
            var cnt = collectionIsNullable(f, ovc) ? f.property + "?.Count ?? 0" : f.property + ".Count";
            return f.property + "={" + cnt + "} items";
          }
          return f.property + "={" + f.property + "}";
        });
        L.push('        return $"' + cls.name + ' {{ ' + parts.join(", ") + ' }}";');
        L.push("    }");
      }
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
    var exact = root.fields.filter(function (f) { return f.key === fieldKey || f.property === fieldKey; })[0];
    if (exact) return exact;
    /* case-insensitive fallback: a preset row (camelCase, e.g. "releaseYear") referencing
       real data with PascalCase keys (e.g. "ReleaseYear") would otherwise resolve to null,
       degrade the typed-literal path to "string", and emit string.Compare on an int field
       (CS0019). Match by key or property ignoring case so stale/cross-cased references still
       resolve to the correct TYPED field. */
    var lk = String(fieldKey == null ? "" : fieldKey).toLowerCase();
    if (!lk) return null;
    return root.fields.filter(function (f) {
      return String(f.key).toLowerCase() === lk || String(f.property).toLowerCase() === lk;
    })[0] || null;
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

  /* Does this row ask for a null/empty (missing) comparison rather than a value
     comparison? True when the row's match mode is "null"/"empty", or when the
     row carries the JS null literal as its value. Used by filter-equals so the
     "is empty/missing" query emits `field == null` (the CSV-empty-is-null trap)
     instead of `== ""` or `== "null"`. */
  function isNullMatch(row) {
    var m = row && row.match;
    if (m === "null" || m === "empty") return true;
    return row && Object.prototype.hasOwnProperty.call(row, "value") && row.value === null;
  }

  /* Render a nested sub-field comparison value as a C# literal of the sub-field's
     inferred type, so an int/long/double/bool sub-field gets a bare token (== 2245)
     and a string stays quoted (== "x"). `nf` is the nested field descriptor and
     `ov` its per-field override (e.g. DateTime). Returns the literal string. */
  function nestedEqualsLiteral(nf, ov, value) {
    var base = nf ? effectiveBaseType(nf, ov) : "string";
    if (base === "int" || base === "long" || base === "double" || base === "bool") {
      var lit = equalsLiteral(base === "long" ? "int" : base, value);
      if (lit !== null) return lit;
    }
    return csString(value);
  }

  /* Supabase-style comparison operators for the scalar filter row.
     Keys mirror PostgREST: eq, neq, gt, gte, lt, lte, like (contains), ilike
     (case-insensitive contains), in (value in a set), is (== null), isNot
     (!= null). Legacy rows carried only match:"null"/"equals"; they migrate to
     op "is"/"eq" so old saved queries keep working byte-for-byte. */
  var FILTER_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is", "isNot"];
  var CMP_SYMBOL = { eq: "==", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=" };
  function filterOp(row) {
    if (row && row.op && CMP_SYMBOL[row.op] !== undefined) return row.op;
    if (row && (row.op === "like" || row.op === "ilike" || row.op === "in" || row.op === "is" || row.op === "isNot")) return row.op;
    /* legacy / unset: a null-match becomes "is", everything else "eq" */
    return isNullMatch(row) ? "is" : "eq";
  }
  /* the C# comparison value for an order operator (gt/gte/lt/lte) or eq/neq,
     typed by the field base so a numeric/date column never gets a string literal. */
  function compareLiteral(base, value) {
    if (base === "DateTime") return "DateTime.Parse(" + csString(value) + ")";
    var num = equalsLiteral(base === "double" ? "double" : "int", value);
    if (num !== null) return num;
    return null;   /* not a clean numeric/date literal */
  }

  /* a bare numeric C# literal for a value, or null when it is not a clean number
     (used by HAVING thresholds and the pick-a-group key literal). */
  function numLit(v) {
    var s = String(v == null ? "" : v).trim();
    return /^-?(\d+(\.\d+)?|\.\d+)$/.test(s) ? s : null;
  }

  /* optional terminal that reduces a filtered list to a scalar/element instead of a
     List<T>: count -> .Count() (int), any -> .Any() (bool), first -> .FirstOrDefault()
     (the first matching element, or null). Unset -> .ToList() (byte-unchanged). The
     scalar/element flags ride back through buildQuery's existing print + output paths
     (the same ones list-method Count/First already use). */
  function reduceTail(row) {
    var rd = row && row.reduce;
    if (rd === "count") return { tail: "\n    .Count()", scalar: true };
    if (rd === "any")   return { tail: "\n    .Any()", scalar: true };
    if (rd === "first") return { tail: "\n    .FirstOrDefault()", element: true };
    return { tail: "\n    .ToList()" };
  }

  function genFilterEquals(model, row, overrides) {
    var rt = reduceTail(row);
    return { expr: "source\n    .Where(s => " + filterCmp(model, row, overrides) + ")" + rt.tail, scalar: rt.scalar, element: rt.element };
  }

  /* The bare boolean comparison string for a scalar filter row (no Where/ToList
     wrapper), e.g. `s.Tag == "Woodworking"` or `s.Signups > 10`. Factored out of
     genFilterEquals so the free-text query engine reuses the exact same
     typed-literal + null-safety rules. */
  function filterCmp(model, row, overrides) {
    var f = findRootField(model, row.field);
    var ref = fieldRef(model, row.field, overrides);
    var base = rootEffectiveBase(model, f, overrides);
    var op = filterOp(row);
    var isString = (base === "string");
    var cmp;

    if (op === "is") {
      /* null/empty: a CSV empty cell deserializes to null, so the only correct
         "is empty/missing" test is `== null`, never `== ""`. */
      cmp = ref + " == null";
    } else if (op === "isNot") {
      cmp = ref + " != null";
    } else if (op === "like" || op === "ilike") {
      var lv = csString(row.value);
      cmp = (op === "ilike" || row.caseInsensitive)
        ? "(" + ref + " ?? \"\").Contains(" + lv + ", StringComparison.OrdinalIgnoreCase)"
        : "(" + ref + " ?? \"\").Contains(" + lv + ")";
    } else if (op === "in") {
      /* value-in-a-set as an OR chain — compiles for any type and nullability,
         unlike `new[]{...}.Contains(nullable)`. */
      var parts = String(row.value == null ? "" : row.value).split(",")
        .map(function (s) { return s.trim(); }).filter(function (s) { return s.length; });
      if (!parts.length) { cmp = "false"; }
      else {
        cmp = "(" + parts.map(function (p) {
          var lit = (isString || base === "DateTime") ? null : equalsLiteral(base, p);
          return ref + " == " + (lit !== null ? lit : csString(p));
        }).join(" || ") + ")";
      }
    } else if (op === "eq" || op === "neq") {
      var symbol = (op === "neq") ? "!=" : "==";
      if (isNullMatch(row)) { cmp = ref + " " + symbol + " null"; }
      else {
        /* bool/int/double get a typed literal (true / 7 / 3.5); string + DateTime
           fall to the quoted/string path, matching the original equals behaviour
           so a bool column never becomes `== "true"` (CS0019). */
        var typedLit = (isString) ? null : equalsLiteral(base, row.value);
        if (typedLit !== null) { cmp = ref + " " + symbol + " " + typedLit; }
        else {
          var val = csString(row.value);
          if (row.caseInsensitive) {
            cmp = (op === "neq" ? "!" : "") + "string.Equals(" + ref + ", " + val + ", StringComparison.OrdinalIgnoreCase)";
          } else { cmp = ref + " " + symbol + " " + val; }
        }
      }
    } else {
      /* gt / gte / lt / lte */
      var sym = CMP_SYMBOL[op] || ">";
      if (isString) {
        cmp = "string.Compare(" + ref + " ?? \"\", " + csString(row.value) + ", StringComparison.Ordinal) " + sym + " 0";
      } else {
        var lit2 = compareLiteral(base, row.value);
        cmp = ref + " " + sym + " " + (lit2 !== null ? lit2 : csString(row.value));
      }
    }
    return cmp;
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
    var rt = reduceTail(row);
    return { expr: "source\n    .Where(s => " + cmp + ")" + rt.tail, scalar: rt.scalar, element: rt.element };
  }

  function genFilterEmptyCollection(model, row, overrides) {
    /* "empty or missing": null or Count == 0, matching
       `(r.DietaryTags?.Count ?? 0) == 0` */
    var cnt = countExpr(model, row.field, overrides);
    var rt = reduceTail(row);
    return { expr: "source\n    .Where(s => (" + cnt + ") == 0)" + rt.tail, scalar: rt.scalar, element: rt.element };
  }

  function genFilterNestedAny(model, row, overrides) {
    var enumExpr = enumerableExpr(model, row.collection, overrides);
    var elemType = collectionElementType(model, row.collection);
    var nf = nestedField(model, row.collection, row.subField);
    var subProp = nf ? nf.property : pascal(row.subField || "Field");
    var predicate;
    var mode = row.match || "equals";
    var rootF = findRootField(model, row.collection);
    var ov = (nf && rootF && rootF.nestedClass && model.byName[rootF.nestedClass])
      ? overrides[model.byName[rootF.nestedClass].name + "." + nf.key]
      : null;
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
      /* type-aware equals: an int/double/bool sub-field gets a bare literal
         (t.Year == 2245), a string stays quoted (t.Name == "x"). Wrapping every
         value through csString() produced `t.Year == "2245"`, which is CS0019 on
         an int? sub-field and would not compile. */
      predicate = "t." + subProp + " == " + nestedEqualsLiteral(nf, ov, row.value);
    }
    /* optional compound AND: a root-level predicate combined with the nested
       Any in one query, e.g. `s.HomePort == "Gullhaven" && (s.X ?? new()).Any(...)`.
       Pure addition: omitting andWhere leaves the single-predicate output
       byte-unchanged. */
    var anyExpr = enumExpr + ".Any(t => " + predicate + ")";
    var whereBody = anyExpr;
    var rootPred = rootPredicate(model, row.andWhere, overrides);
    if (rootPred) whereBody = rootPred + " && " + anyExpr;
    var rt = reduceTail(row);
    return { expr: "source\n    .Where(s => " + whereBody + ")" + rt.tail, scalar: rt.scalar, element: rt.element };
  }

  /* Build a root-level predicate string for a compound AND clause from an
     `andWhere` spec { field, value, op? }. op defaults to "equals"; "null" emits
     `s.Field == null`, "notEquals" emits `!=`. Typed like filter-equals so a
     numeric/bool root field gets a bare literal and a string stays quoted.
     Returns null when there is no usable andWhere (caller emits the plain Any). */
  function rootPredicate(model, spec, overrides) {
    if (!spec || typeof spec !== "object" || !spec.field) return null;
    var f = findRootField(model, spec.field);
    var ref = fieldRef(model, spec.field, overrides);
    var op = spec.op || "equals";
    if (op === "null") return ref + " == null";
    if (op === "notNull") return ref + " != null";
    var base = rootEffectiveBase(model, f, overrides);
    var typedLit = (base === "string" || base === "DateTime") ? null : equalsLiteral(base, spec.value);
    var lit = typedLit !== null ? typedLit : csString(spec.value);
    var cmp = (op === "notEquals" || op === "!=") ? " != " : " == ";
    return ref + cmp + lit;
  }

  /* Optional `?? n` coalesce on a nullable sort key so a missing scalar sorts as
     n instead of bubbling to one end unpredictably, e.g.
     `OrderByDescending(s => s.Signups ?? 0)`. Emits nothing when nullValue is
     unset (the bare key, byte-unchanged). A blank-but-present nullValue (e.g. "0")
     is honoured; a non-numeric nullValue is quoted so a string key still compiles. */
  function sortCoalesce(row) {
    if (!row || row.nullValue === undefined || row.nullValue === null || row.nullValue === "") return "";
    var v = esc(row.nullValue).trim();
    if (v === "") return "";
    var lit = /^-?(\d+(\.\d+)?|\.\d+)$/.test(v) ? v : csString(v);
    return " ?? " + lit;
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
      keySel = "s => " + fieldRef(model, row.field, overrides) + sortCoalesce(row);
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
    var keyIsString = !!(f && !f.isCollection && /string/.test(f.baseType));
    /* null-coalesce the group key so a null type doesn't crash GroupBy, matching
       the spaceships solution `GroupBy(s => s.Type ?? "Unknown")` */
    if (keyIsString) groupKey = groupKey + " ?? \"Unknown\"";
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
    /* optional sort of the grouped result (the exam's "sorted by most …"):
       valueDesc / valueAsc on the aggregate, keyAsc / keyDesc on the group key.
       Unset = no OrderBy (byte-unchanged). */
    var order = "";
    if (row.sort === "valueDesc") order = "\n    .OrderByDescending(x => x.Value)";
    else if (row.sort === "valueAsc") order = "\n    .OrderBy(x => x.Value)";
    else if (row.sort === "keyAsc") order = "\n    .OrderBy(x => x.Key)";
    else if (row.sort === "keyDesc") order = "\n    .OrderByDescending(x => x.Key)";
    /* optional HAVING + pick-a-group: keep only the group whose Key equals onlyKey,
       and/or groups whose aggregate Value passes a comparison (count/value > N …).
       Emitted as a `.Where(x => …)` between Select and the order, like SQL HAVING.
       Both unset -> no Where (byte-unchanged). */
    var conds = [];
    if (row.onlyKey !== undefined && row.onlyKey !== null && String(row.onlyKey).trim() !== "") {
      var kv = String(row.onlyKey).trim();
      var keyLit = keyIsString ? csString(kv) : (numLit(kv) !== null ? numLit(kv) : csString(kv));
      conds.push("x.Key == " + keyLit);
    }
    if (row.having && CMP_SYMBOL[row.having] && numLit(row.havingValue) !== null) {
      conds.push("x.Value " + CMP_SYMBOL[row.having] + " " + numLit(row.havingValue));
    }
    var having = conds.length ? "\n    .Where(x => " + conds.join(" && ") + ")" : "";
    var expr = "source\n    .GroupBy(s => " + groupKey + ")\n" +
      "    .Select(g => new { Key = g.Key, Value = " + valueExpr + " })" + having + order + "\n    .ToList()";
    return { expr: expr };
  }

  function genAboveAverage(model, row, overrides) {
    var f = findRootField(model, row.field);
    var prop = f ? f.property : pascal(row.field);
    var avgVar = (row.name || "q") + "Average";
    var isCount = row.byCount && f && f.isCollection;
    var scalarNullable = !isCount && f && f.nullable;

    /* excludeNull (scalar nullable only): average the KNOWN values, not the full
       source coalesced to 0. Counting missing values as 0 skews the average and
       wrongly admits/excludes rows; the exam asks "above the average of the
       present values, and a missing value can never be above average". Builds a
       knownX list, averages its non-null .Value, and guards the outer Where with
       `!= null`. Off by default (byte-unchanged ?? 0 behaviour). */
    if (row.excludeNull && scalarNullable) {
      var knownVar = "known" + capitalize(prop);
      var pre = "var " + knownVar + " = source.Where(r => r." + prop + " != null).ToList();\n" +
        "double " + avgVar + " = " + knownVar + ".Any() ? " + knownVar + ".Average(r => r." + prop + "!.Value) : 0;";
      var expr = "source\n    .Where(s => s." + prop + " != null && s." + prop + ".Value > " + avgVar + ")\n    .ToList()";
      return { expr: expr, pre: pre };
    }

    var perElem, avgSel;
    if (isCount) {
      perElem = collectionIsNullable(f, overrides) ? "s." + f.property + "?.Count ?? 0" : "s." + f.property + ".Count";
      avgSel = "r => " + (collectionIsNullable(f, overrides) ? "r." + f.property + "?.Count ?? 0" : "r." + f.property + ".Count");
    } else {
      perElem = "s." + prop + (scalarNullable ? " ?? 0" : "");
      avgSel = "r => r." + prop + (scalarNullable ? " ?? 0" : "");
    }
    /* compute the list-wide average ONCE (a > comparison, strictly greater),
       matching the recipes solution. The average pre-statement is emitted by
       buildQueryLine via the .pre field. */
    var preDefault = "double " + avgVar + " = source.Any() ? source.Average(" + avgSel + ") : 0;";
    var exprDefault = "source\n    .Where(s => (" + perElem + ") > " + avgVar + ")\n    .ToList()";
    return { expr: exprDefault, pre: preDefault };
  }

  function capitalize(s) {
    s = String(s == null ? "" : s);
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
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

  /* For each group of field A, the most (or least) frequent value of field B,
     ordered by A. Covers "per year, the author who wrote the most comics":
     GroupBy(year) -> within each year GroupBy(author), take the biggest by count.
     direction "desc" (default) = most frequent; "asc" = least frequent. */
  function genMostFrequentPerGroup(model, row, overrides) {
    var fA = findRootField(model, row.field);
    var fB = findRootField(model, row.subField);
    var baseA = rootEffectiveBase(model, fA, overrides);
    var baseB = rootEffectiveBase(model, fB, overrides);
    var aName = fA ? fA.property : pascal(row.field);
    var bName = fB ? fB.property : pascal(row.subField);
    var keyA = "s." + aName + (baseA === "string" ? " ?? \"Unknown\"" : (fA && fA.nullable ? " ?? 0" : ""));
    var keyB = "c." + bName + (baseB === "string" ? " ?? \"Unknown\"" : (fB && fB.nullable ? " ?? 0" : ""));
    var pick = row.direction === "asc" ? "OrderBy" : "OrderByDescending";
    var countAgg = row.direction === "asc" ? "Min" : "Max";
    var expr =
      "source\n" +
      "    .GroupBy(s => " + keyA + ")\n" +
      "    .OrderBy(g => g.Key)\n" +
      "    .Select(g => new\n" +
      "    {\n" +
      "        " + aName + " = g.Key,\n" +
      "        " + bName + " = g.GroupBy(c => " + keyB + ")\n" +
      "            ." + pick + "(grp => grp.Count())\n" +
      "            .ThenBy(grp => grp.Key)\n" +
      "            .First().Key,\n" +
      "        Count = g.GroupBy(c => " + keyB + ")." + countAgg + "(grp => grp.Count())\n" +
      "    })\n" +
      "    .ToList()";
    return { expr: expr };
  }

  /* first scalar (non-collection, non-object) field accessor on element "s", used
     as a sensible default when a list-method needs a field and none is chosen. */
  function firstScalarFieldRef(model) {
    var root = model.byName[model.rootClass];
    if (!root) return "s";
    var f = root.fields.filter(function (x) { return !x.isCollection && !x.isObject; })[0];
    return f ? "s." + f.property : "s";
  }

  /* "apply a method to the deserialised list" (task 3.1.3 and friends): ToString to
     print every item, or a terminal LINQ method. Supported:
       ToString  -> print every item
       ToList    -> materialise the list
       Count / Sum / Average / Min / Max  -> a scalar over items / a field
       Any / All -> a bool (All = "every item has the chosen field set")
       Contains  -> a bool (does the chosen field's values contain a typed value)
       MinBy / MaxBy -> the item with the smallest / largest chosen field
       FirstOrDefault / LastOrDefault -> a single element (or null)
       Distinct  -> the distinct values of a field
       ToHashSet -> the distinct field values as a set
       ToDictionary -> the items keyed by a field
     ToString / First / Last / MaxBy / MinBy / ToDictionary also flag that the model
     needs a ToString() override (see rowNeedsToString). */
  function genListMethod(model, row, overrides) {
    var method = row.method || "toString";
    var fieldRefS = row.field ? fieldRef(model, row.field, overrides, "s") : firstScalarFieldRef(model);
    if (method === "toString") return { isPrintAll: true };
    if (method === "toList")   return { expr: "source.ToList()" };
    if (method === "count")    return { expr: "source.Count", scalar: true };
    if (method === "any")      return { expr: "source.Any()", scalar: true };
    if (method === "all")      return { expr: "source.All(s => " + fieldRefS + " != null)", scalar: true };
    if (method === "first")    return { expr: "source.FirstOrDefault()", element: true };
    if (method === "last")     return { expr: "source.LastOrDefault()", element: true };
    if (method === "minBy")    return { expr: "source.MinBy(s => " + fieldRefS + ")", element: true };
    if (method === "maxBy")    return { expr: "source.MaxBy(s => " + fieldRefS + ")", element: true };
    if (method === "distinct") return { expr: "source.Select(s => " + fieldRefS + ").Distinct().ToList()", valueList: true };
    if (method === "toHashSet") return { expr: "source.Select(s => " + fieldRefS + ").ToHashSet()", valueList: true };
    if (method === "toDictionary") return { expr: "source.ToDictionary(s => " + fieldRefS + ")", valueList: true };
    if (method === "contains") {
      var cf = row.field ? findRootField(model, row.field) : null;
      var cbase = cf ? rootEffectiveBase(model, cf, overrides) : "string";
      var clit = (cbase === "string") ? csString(row.value) : equalsLiteral(cbase, row.value);
      if (clit === null) clit = csString(row.value);   /* long/unparseable: fall back to a quoted literal */
      return { expr: "source.Select(s => " + fieldRefS + ").Contains(" + clit + ")", scalar: true };
    }
    if (method === "sum" || method === "average" || method === "min" || method === "max") {
      var M = method.charAt(0).toUpperCase() + method.slice(1);
      return { expr: "source." + M + "(s => " + fieldRefS + ")", scalar: true };
    }
    return { isPrintAll: true };
  }

  /* a row whose model needs a ToString() override: printing each item (ToString) or
     printing a single element (First/Last) reads best with all fields overridden. */
  function rowNeedsToString(row) {
    if (!row) return false;
    /* a filter reduced to its first match prints that element via ToString */
    if (row.reduce === "first") return true;
    if (row.shape !== "list-method") return false;
    var m = row.method || "toString";
    return m === "toString" || m === "first" || m === "last" ||
      m === "maxBy" || m === "minBy" || m === "toDictionary";
  }

  var SHAPES = {
    "list-method": { gen: genListMethod, label: "apply a method to the list (ToString, Count, …)" },
    "filter-equals": { gen: genFilterEquals, label: "filter (compare a field)" },
    "most-frequent-per-group": { gen: genMostFrequentPerGroup, label: "per group: most/least frequent value" },
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

    /* list-method "ToString / print all": no result variable, just walk the list
       and Console.WriteLine each item (which calls the model's ToString override). */
    if (result.isPrintAll) {
      out.decl = "";
      out.printBlock = [
        'Console.WriteLine($"--- {source.Count} item(s): ' + esc(label) + ' ---");',
        "foreach (var item in source)",
        "{",
        "    Console.WriteLine(item);",
        "}",
      ].join("\n");
      out.needsToString = true;
      return out;
    }

    if (result.pre) out.pre = result.pre;
    out.decl = "var " + name + " = " + result.expr + ";";
    if (result.element) out.needsToString = true;

    if (row.print) {
      if (result.scalar) {
        /* a single value (count / sum / average / min / max / bool) */
        out.printBlock = 'Console.WriteLine($"' + esc(label) + ': {' + name + '}");';
      } else if (result.element) {
        /* a single element printed via its ToString override */
        out.printBlock = 'Console.WriteLine("' + esc(label) + ': " + ' + name + ');';
      } else if (result.valueList) {
        /* a flat list of field values (Distinct) — print each value directly */
        out.printBlock = [
          'Console.WriteLine($"--- {' + name + '.Count} ' + esc(label) + ' ---");',
          "foreach (var item in " + name + ")",
          "{",
          "    Console.WriteLine(item);",
          "}",
        ].join("\n");
      } else {
        out.printBlock = buildPrint(model, row, name, result);
      }
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
    } else if (row.shape === "select-fields" || row.shape === "most-frequent-per-group") {
      /* the result element is an anonymous projection (select-fields: the picked
         fields; most-frequent-per-group: { <group>, <top>, Count }), so it has no
         root display field. Print the row directly; the anonymous type's ToString
         renders every member, which compiles and reads fine. */
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
    /* Default name kept for the older exam families that DO submit a results file.
       In the 2026 (F26) format the JSON is a non-submitted artifact (P4 submits a
       Models.cs instead), so this filename is a runtime side-output, not a deliverable. */
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
      /* pre may be multi-line (e.g. the excludeNull above-average pre-filter +
         average): indent() handles one or many lines identically. A print-only
         step (ToString print-all) has no declaration; its code is in the print
         section below, so skip the empty decl line here. */
      if (q.pre) L.push(indent(q.pre, "        "));
      if (q.decl) L.push(indent(q.decl, "        "));
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
  function emitModelSection(model, overrides, emitToString) {
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
    L.push(emitModelClasses(model, overrides, emitToString));
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
    var emitTS = Array.isArray(rows) && rows.some(rowNeedsToString);
    /* Program class, then the wrapper + model classes, in one file (unchanged). */
    emitProgramClass(model, rows, opts).forEach(function (ln) { L.push(ln); });
    L.push("");
    emitModelSection(model, overrides, emitTS).forEach(function (ln) { L.push(ln); });
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
    var emitTS = Array.isArray(rows) && rows.some(rowNeedsToString);
    var modelLines = emitModelSection(model, overrides, emitTS);
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
    return {
      summer: summerPreset(), reexam: reexamPreset(),
      workshops: workshopsPreset(), lighthouses: lighthousesPreset(), comics: comicsPreset(),
    };
  }
  /* look a preset up by its key (used by the UI's preset buttons) */
  function presetByKey(key) {
    var all = presets();
    return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : null;
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

  /* ===================== runner (execute queries in JS over the data) =====================
     The codegen emits C#; this evaluates the SAME query shapes directly on the
     pasted data so the user can run a query and see results without .NET. Each
     evaluator mirrors its gen* counterpart. Returns a normalized result:
       { ok:true, columns:[{key,label}], data:[obj], note?, scalar? } | { ok:false, error } */

  function rqVal(item, field) {
    if (!field || !item) return null;
    var v = item[field.key];
    return (v === undefined) ? null : v;
  }
  function rqNum(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }
  function rqStr(v) { return (v === null || v === undefined) ? "" : String(v); }
  function rqIsEmpty(v) { return v === null || v === undefined || v === ""; }

  /* the grouping key for a field, mirroring the codegen null-coalesce
     (string -> "Unknown", other nullable -> 0) */
  function rqGroupKey(model, field, item, overrides) {
    var base = rootEffectiveBase(model, field, overrides);
    var v = rqVal(item, field);
    if (base === "string") return rqIsEmpty(v) ? "Unknown" : String(v);
    if (rqIsEmpty(v)) return (field && field.nullable) ? 0 : v;
    return v;
  }
  function rqColumnsForRoot(model) {
    var root = model.byName[model.rootClass];
    if (!root) return [];
    return root.fields.map(function (f) { return { key: f.key, label: f.property }; });
  }

  /* evaluate a single scalar-filter predicate (the Supabase operators) on one item */
  function rqEvalFilter(model, row, item, overrides) {
    var f = findRootField(model, row.field);
    var base = rootEffectiveBase(model, f, overrides);
    var v = rqVal(item, f);
    var op = filterOp(row);
    var numeric = (base === "int" || base === "double" || base === "long");

    if (op === "is") return rqIsEmpty(v);
    if (op === "isNot") return !rqIsEmpty(v);
    if (op === "like" || op === "ilike") {
      var hay = rqStr(v), needle = rqStr(row.value);
      if (op === "ilike" || row.caseInsensitive) { hay = hay.toLowerCase(); needle = needle.toLowerCase(); }
      return needle === "" ? true : hay.indexOf(needle) !== -1;
    }
    if (op === "in") {
      var parts = rqStr(row.value).split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s.length; });
      if (!parts.length) return false;
      if (base === "string" || base === "DateTime") return parts.indexOf(rqStr(v)) !== -1;
      var nv = rqNum(v);
      return nv !== null && parts.some(function (p) { return rqNum(p) === nv; });
    }
    if (op === "eq" || op === "neq") {
      var eq;
      if (isNullMatch(row)) eq = rqIsEmpty(v);
      else if (numeric) { var a = rqNum(v), b = rqNum(row.value); eq = (a !== null && b !== null && a === b); }
      else if (base === "bool") eq = (rqStr(v).toLowerCase() === rqStr(row.value).toLowerCase());
      else { var sa = rqStr(v), sb = rqStr(row.value); if (row.caseInsensitive) { sa = sa.toLowerCase(); sb = sb.toLowerCase(); } eq = (sa === sb); }
      return op === "eq" ? eq : !eq;
    }
    /* gt / gte / lt / lte */
    var c;
    if (numeric || base === "DateTime") {
      var x = base === "DateTime" ? Date.parse(rqStr(v)) : rqNum(v);
      var y = base === "DateTime" ? Date.parse(rqStr(row.value)) : rqNum(row.value);
      if (x === null || y === null || (typeof x === "number" && isNaN(x)) || (typeof y === "number" && isNaN(y))) return false;
      c = x < y ? -1 : (x > y ? 1 : 0);
    } else {
      var s1 = rqStr(v), s2 = rqStr(row.value);
      c = s1 < s2 ? -1 : (s1 > s2 ? 1 : 0);
    }
    return op === "gt" ? c > 0 : op === "gte" ? c >= 0 : op === "lt" ? c < 0 : c <= 0;
  }

  /* root-level predicate for a compound andWhere spec, mirroring rootPredicate() */
  function rqEvalRootPred(model, spec, item, overrides) {
    if (!spec || !spec.field) return true;
    var f = findRootField(model, spec.field);
    var v = rqVal(item, f);
    var op = spec.op || "equals";
    if (op === "null") return rqIsEmpty(v);
    if (op === "notNull") return !rqIsEmpty(v);
    var base = rootEffectiveBase(model, f, overrides);
    var eq = (base === "int" || base === "double" || base === "long")
      ? (rqNum(v) !== null && rqNum(v) === rqNum(spec.value))
      : (rqStr(v) === rqStr(spec.value));
    return (op === "notEquals" || op === "!=") ? !eq : eq;
  }

  function rqCompareKeys(a, b) {
    if (a === null || a === undefined) a = "";
    if (b === null || b === undefined) b = "";
    if (typeof a === "number" && typeof b === "number") return a - b;
    var sa = String(a), sb = String(b);
    return sa < sb ? -1 : (sa > sb ? 1 : 0);
  }

  /* sort key for sort-by / top-n (byCount on a collection -> its length) */
  function rqSortKey(model, row, item, overrides) {
    var f = findRootField(model, row.field);
    if (row.byCount && f && f.isCollection) {
      var arr = rqVal(item, f);
      return Array.isArray(arr) ? arr.length : 0;
    }
    var v = rqVal(item, f);
    var base = rootEffectiveBase(model, f, overrides);
    if (base === "int" || base === "double" || base === "long") { var n = rqNum(v); return n === null ? -Infinity : n; }
    return rqStr(v);
  }

  /* mirror reduceTail() in the runner: turn a filtered list result into the scalar
     (count/any) or single element (first) the generated C# would produce, so the
     "Run on data" panel and the populated results JSON match the code. */
  function applyRunReduce(row, res) {
    if (!res || !res.ok || !row || !row.reduce) return res;
    var data = res.data || [];
    if (row.reduce === "count") return { ok: true, scalar: true, value: data.length, columns: [], data: [], note: "Count = " + data.length };
    if (row.reduce === "any")   return { ok: true, scalar: true, value: data.length > 0, columns: [], data: [], note: "Any = " + (data.length > 0) };
    if (row.reduce === "first") return { ok: true, element: true, columns: res.columns, data: data.slice(0, 1), note: data.length ? ("first of " + data.length + " match(es)") : "no match" };
    return res;
  }

  function runQuery(model, row, rows, overrides) {
    overrides = overrides || {};
    rows = Array.isArray(rows) ? rows : [];
    var shape = row.shape;
    try {
      if (shape === "filter-equals") {
        var out = rows.filter(function (it) { return rqEvalFilter(model, row, it, overrides); });
        return applyRunReduce(row, { ok: true, columns: rqColumnsForRoot(model), data: out });
      }
      if (shape === "filter-contains") {
        var f = findRootField(model, row.field);
        var needle = rqStr(row.value), ci = !!row.caseInsensitive;
        var match = function (cell) {
          var h = rqStr(cell), nd = needle;
          if (ci) { h = h.toLowerCase(); nd = nd.toLowerCase(); }
          return nd === "" ? true : h.indexOf(nd) !== -1;
        };
        var res = rows.filter(function (it) {
          var v = rqVal(it, f);
          if (f && f.isCollection) return Array.isArray(v) && v.some(match);
          return match(v);
        });
        return applyRunReduce(row, { ok: true, columns: rqColumnsForRoot(model), data: res });
      }
      if (shape === "filter-empty-collection") {
        var cf = findRootField(model, row.field);
        var r2 = rows.filter(function (it) { var v = rqVal(it, cf); return !Array.isArray(v) || v.length === 0; });
        return applyRunReduce(row, { ok: true, columns: rqColumnsForRoot(model), data: r2 });
      }
      if (shape === "filter-nested-any") {
        var coll = findRootField(model, row.collection);
        var nf = nestedField(model, row.collection, row.subField);
        var mode = row.match || "equals";
        var r3 = rows.filter(function (it) {
          if (!rqEvalRootPred(model, row.andWhere, it, overrides)) return false;
          var arr = rqVal(it, coll);
          if (!Array.isArray(arr)) return false;
          return arr.some(function (el) {
            var sv = nf && el ? el[nf.key] : (el && el[row.subField]);
            if (mode === "null") return rqIsEmpty(sv);
            if (mode === "year") { var y = parseInt(rqStr(sv).slice(0, 4), 10); return y === (parseInt(row.value, 10) || 0); }
            return rqStr(sv) === rqStr(row.value);
          });
        });
        return applyRunReduce(row, { ok: true, columns: rqColumnsForRoot(model), data: r3 });
      }
      if (shape === "sort-by" || shape === "top-n") {
        var dir = row.direction === "asc" ? 1 : -1;
        var sorted = rows.slice().sort(function (a, b) {
          var c = rqCompareKeys(rqSortKey(model, row, a, overrides), rqSortKey(model, row, b, overrides)) * dir;
          if (c === 0 && row.thenBy) {
            var tf = findRootField(model, row.thenBy);
            c = rqCompareKeys(rqVal(a, tf), rqVal(b, tf)) * (row.thenDirection === "desc" ? -1 : 1);
          }
          return c;
        });
        if (shape === "top-n") sorted = sorted.slice(0, parseInt(row.n, 10) || 5);
        return { ok: true, columns: rqColumnsForRoot(model), data: sorted };
      }
      if (shape === "group-aggregate") {
        var gf = findRootField(model, row.field);
        var agg = row.aggregate || "Count";
        var groups = {};
        var order = [];
        rows.forEach(function (it) {
          var k = rqGroupKey(model, gf, it, overrides);
          var kk = String(k);
          if (!groups[kk]) { groups[kk] = { key: k, items: [] }; order.push(kk); }
          groups[kk].items.push(it);
        });
        var sf = row.subField ? findRootField(model, row.subField) : null;
        var subVal = function (it) {
          if (row.subCount && sf) { var arr = rqVal(it, sf); return Array.isArray(arr) ? arr.length : 0; }
          var n = rqNum(rqVal(it, sf)); return n === null ? 0 : n;
        };
        var data = order.map(function (kk) {
          var g = groups[kk], value;
          if (agg === "Count") value = g.items.length;
          else {
            var nums = g.items.map(subVal);
            if (agg === "Average") value = nums.length ? nums.reduce(function (s, n) { return s + n; }, 0) / nums.length : 0;
            else if (agg === "Max") value = nums.length ? Math.max.apply(null, nums) : 0;
            else value = nums.length ? Math.min.apply(null, nums) : 0;
          }
          return { Key: g.key, Value: value };
        });
        /* HAVING + pick-a-group: filter the grouped rows (before sorting) to match
           the generated `.Where(x => …)`. onlyKey keeps one group; having compares
           the aggregate value to a threshold. */
        if (row.onlyKey !== undefined && row.onlyKey !== null && String(row.onlyKey).trim() !== "") {
          var ok2 = String(row.onlyKey).trim();
          data = data.filter(function (d) { return String(d.Key) === ok2; });
        }
        if (row.having && CMP_SYMBOL[row.having] && String(row.havingValue == null ? "" : row.havingValue).trim() !== "") {
          var thr = Number(row.havingValue);
          if (!isNaN(thr)) {
            var hop = row.having;
            data = data.filter(function (d) {
              var v = d.Value;
              return hop === "gt" ? v > thr : hop === "gte" ? v >= thr : hop === "lt" ? v < thr :
                     hop === "lte" ? v <= thr : hop === "eq" ? v === thr : hop === "neq" ? v !== thr : true;
            });
          }
        }
        if (row.sort === "valueDesc") data.sort(function (a, b) { return b.Value - a.Value; });
        else if (row.sort === "valueAsc") data.sort(function (a, b) { return a.Value - b.Value; });
        else if (row.sort === "keyAsc") data.sort(function (a, b) { return rqCompareKeys(a.Key, b.Key); });
        else if (row.sort === "keyDesc") data.sort(function (a, b) { return rqCompareKeys(b.Key, a.Key); });
        return { ok: true, columns: [{ key: "Key", label: (gf ? gf.property : "Key") }, { key: "Value", label: agg }], data: data };
      }
      if (shape === "most-frequent-per-group") {
        var fA = findRootField(model, row.field), fB = findRootField(model, row.subField);
        var aName = fA ? fA.property : pascal(row.field), bName = fB ? fB.property : pascal(row.subField);
        var groupsA = {}, orderA = [];
        rows.forEach(function (it) {
          var k = rqGroupKey(model, fA, it, overrides), kk = String(k);
          if (!groupsA[kk]) { groupsA[kk] = { key: k, items: [] }; orderA.push(kk); }
          groupsA[kk].items.push(it);
        });
        var least = row.direction === "asc";
        var dataA = orderA.map(function (kk) {
          var g = groupsA[kk], counts = {}, ord = [];
          g.items.forEach(function (it) {
            var bk = String(rqGroupKey(model, fB, it, overrides));
            if (counts[bk] === undefined) { counts[bk] = 0; ord.push(bk); }
            counts[bk]++;
          });
          ord.sort(function (x, y) { return least ? (counts[x] - counts[y] || (x < y ? -1 : 1)) : (counts[y] - counts[x] || (x < y ? -1 : 1)); });
          var top = ord[0];
          var rec = {};
          rec[aName] = g.key; rec[bName] = top; rec.Count = top === undefined ? 0 : counts[top];
          return rec;
        }).sort(function (a, b) { return rqCompareKeys(a[aName], b[aName]); });
        return { ok: true, columns: [{ key: aName, label: aName }, { key: bName, label: bName }, { key: "Count", label: "Count" }], data: dataA };
      }
      if (shape === "above-average") {
        var af = findRootField(model, row.field);
        var byCount = row.byCount && af && af.isCollection;
        var per = function (it) {
          if (byCount) { var arr = rqVal(it, af); return Array.isArray(arr) ? arr.length : 0; }
          var n = rqNum(rqVal(it, af)); return n;
        };
        var present = rows.map(per).filter(function (n) { return n !== null && n !== undefined; });
        if (!byCount && !row.excludeNull) present = rows.map(function (it) { var n = per(it); return n === null ? 0 : n; });
        var avg = present.length ? present.reduce(function (s, n) { return s + n; }, 0) / present.length : 0;
        var above = rows.filter(function (it) { var n = per(it); return n !== null && n > avg; });
        return { ok: true, columns: rqColumnsForRoot(model), data: above, note: "list average = " + (Math.round(avg * 100) / 100) };
      }
      if (shape === "select-fields") {
        var fields = (row.fields || []).filter(Boolean);
        if (!fields.length) { var root = model.byName[model.rootClass]; fields = root ? root.fields.slice(0, 2).map(function (f) { return f.key; }) : []; }
        var cols = fields.map(function (k) { var ff = findRootField(model, k); return { key: k, label: ff ? ff.property : pascal(k) }; });
        var proj = rows.map(function (it) { var o = {}; cols.forEach(function (c) { o[c.key] = rqVal(it, findRootField(model, c.key)); }); return o; });
        return { ok: true, columns: cols, data: proj };
      }
      if (shape === "binary-search") {
        var bf = findRootField(model, row.field);
        var sortedB = rows.slice().sort(function (a, b) { return rqCompareKeys(rqStr(rqVal(a, bf)), rqStr(rqVal(b, bf))); });
        var idx = -1;
        for (var i = 0; i < sortedB.length; i++) { if (rqStr(rqVal(sortedB[i], bf)) === rqStr(row.value)) { idx = i; break; } }
        return {
          ok: true, scalar: true, columns: rqColumnsForRoot(model),
          data: idx >= 0 ? [sortedB[idx]] : [],
          note: idx >= 0 ? ("found at sorted index " + idx) : ("\"" + rqStr(row.value) + "\" not found"),
        };
      }
      return { ok: false, error: "This query shape can't be run yet: " + esc(shape) };
    } catch (e) {
      return { ok: false, error: "Run error: " + (e && e.message ? e.message : String(e)) };
    }
  }

  /* parse pasted text into the raw data rows (objects) the runner consumes */
  function extractRows(text) {
    var raw = String(text == null ? "" : text).trim();
    if (!raw) return { ok: false, error: "Paste JSON or CSV first." };
    var firstChar = raw.charAt(0);
    if (firstChar === "[" || firstChar === "{") {
      try {
        var parsed = JSON.parse(raw);
        var ex = extractArray(parsed);
        return { ok: true, rows: (ex.items || []).filter(function (x) { return x && typeof x === "object"; }) };
      } catch (e) { /* fall through to CSV */ }
    }
    if (looksLikeCsv(raw)) {
      var records = parseCsvRecords(raw);
      if (records && records.length >= 2) {
        var headers = records[0].map(function (h) { return String(h == null ? "" : h).trim(); });
        var objs = records.slice(1).map(function (r) {
          var o = {};
          headers.forEach(function (h, i) {
            var c = r[i];
            o[h] = (c === undefined || c === null || String(c).length === 0) ? null : c;
          });
          return o;
        });
        return { ok: true, rows: objs };
      }
    }
    return { ok: false, error: "Could not read data rows (invalid JSON / CSV)." };
  }

  /* ===================== free-text (plain-English) query ===================== */
  /* Turn a sentence like "released after 2023 and name starts with rtx" into a
     boolean predicate tree over the root fields, then (a) run it on the data and
     (b) emit the equivalent C# .Where(...). Supports and/or (and binds tighter
     than or) with parentheses, the comparison operators (= != > < >= <=, plus
     after/before/over/under/at least/at most), starts with / ends with /
     contains, and is null / is not null / no <field>. Field names resolve
     loosely so "released" finds ReleaseYear and "port" finds HomePort. */

  function splitCamel(s) {
    return String(s == null ? "" : s).replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[\s_]+/).filter(Boolean);
  }
  /* a token plus a couple of cheap morphological stems so "released" matches the
     field word "release", "signups" matches "signup", etc. */
  function freeStems(t) {
    var out = [t];
    [/ing$/, /ed$/, /es$/, /s$/, /d$/].forEach(function (re) {
      if (re.test(t)) { var s = t.replace(re, ""); if (s.length >= 3 && out.indexOf(s) === -1) out.push(s); }
    });
    return out;
  }
  /* Resolve a typed-by-the-user word to a root field, or null. Exact property/key
     wins; otherwise the best word-stem overlap (score >= 2) is taken. */
  function resolveFreeField(model, token) {
    var root = model && model.byName ? model.byName[model.rootClass] : null;
    if (!root) return null;
    var t = String(token == null ? "" : token).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!t) return null;
    var fields = root.fields, i;
    for (i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.property.toLowerCase() === t) return f;
      if (String(f.key).toLowerCase().replace(/[^a-z0-9]/g, "") === t) return f;
    }
    var tStems = freeStems(t), best = null, bestScore = 0;
    for (i = 0; i < fields.length; i++) {
      var f2 = fields[i];
      var words = splitCamel(f2.property).map(function (x) { return x.toLowerCase(); });
      words.push(f2.property.toLowerCase());
      var sc = 0;
      words.forEach(function (w) {
        tStems.forEach(function (ts) {
          if (w === ts) sc = Math.max(sc, 3);
          else if (ts.length >= 3 && (w.indexOf(ts) === 0 || ts.indexOf(w) === 0)) sc = Math.max(sc, 2);
        });
      });
      if (sc > bestScore) { bestScore = sc; best = f2; }
    }
    return bestScore >= 2 ? best : null;
  }

  function freeTokens(text) {
    var s = String(text == null ? "" : text), toks = [], i = 0, n = s.length;
    function isWord(c) { return /[A-Za-z0-9_]/.test(c); }
    while (i < n) {
      var c = s[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
      if (c === "(") { toks.push({ t: "lp" }); i++; continue; }
      if (c === ")") { toks.push({ t: "rp" }); i++; continue; }
      if (c === ",") { toks.push({ t: "and" }); i++; continue; }
      if (c === '"' || c === "'") { var q = c; i++; var b = ""; while (i < n && s[i] !== q) { b += s[i]; i++; } i++; toks.push({ t: "str", v: b }); continue; }
      var two = s.substr(i, 2);
      if (two === ">=" || two === "<=" || two === "!=" || two === "<>" || two === "==") { toks.push({ t: "op", v: two === "<>" ? "!=" : (two === "==" ? "=" : two) }); i += 2; continue; }
      if (c === "&" && s[i + 1] === "&") { toks.push({ t: "and" }); i += 2; continue; }
      if (c === "|" && s[i + 1] === "|") { toks.push({ t: "or" }); i += 2; continue; }
      if (c === ">" || c === "<" || c === "=") { toks.push({ t: "op", v: c }); i++; continue; }
      if (/[0-9]/.test(c) || (c === "-" && /[0-9]/.test(s[i + 1] || ""))) {
        var num = c; i++; while (i < n && /[0-9.]/.test(s[i])) { num += s[i]; i++; } toks.push({ t: "num", v: num }); continue;
      }
      if (isWord(c)) {
        var w = ""; while (i < n && isWord(s[i])) { w += s[i]; i++; }
        var lw = w.toLowerCase();
        if (lw === "and") toks.push({ t: "and" });
        else if (lw === "or") toks.push({ t: "or" });
        else toks.push({ t: "word", v: w });
        continue;
      }
      i++; /* skip any other punctuation */
    }
    return toks;
  }

  /* Parse the token stream into a predicate node, throwing a friendly Error on a
     malformed clause (caught by freeQuery). */
  function freeParse(text, model) {
    var toks = freeTokens(text);
    if (!toks.length) throw new Error('Type a query, e.g. "released after 2023 and name starts with rtx".');
    var pos = 0;
    function peek() { return toks[pos]; }
    function next() { return toks[pos++]; }
    function wl(tok) { return tok && tok.t === "word" ? tok.v.toLowerCase() : null; }
    function fail(m) { throw new Error(m); }
    var SPECIAL_LEAD = { "no": 1, "without": 1, "missing": 1, "named": 1, "called": 1 };

    function readValue() {
      var parts = [];
      while (peek() && (peek().t === "str" || peek().t === "num" || peek().t === "word")) {
        parts.push(peek().v); next();
      }
      return parts.join(" ");
    }

    function parseOperator() {
      var p = peek();
      if (p && p.t === "op") { next(); var M = { ">": "gt", "<": "lt", ">=": "gte", "<=": "lte", "=": "eq", "!=": "neq" }; return { op: M[p.v] || "eq", needsValue: true, ci: true, raw: p.v }; }
      var lw = wl(p);
      if (!lw) fail("expected an operator after the field");
      if (lw === "is") {
        next(); var q = wl(peek());
        if (q === "null" || q === "empty" || q === "missing" || q === "none" || q === "blank") { next(); return { op: "isnull", needsValue: false }; }
        if (q === "not") { next(); var r = wl(peek()); if (r === "null" || r === "empty" || r === "missing" || r === "none") { next(); return { op: "isnotnull", needsValue: false }; } return { op: "neq", needsValue: true, ci: true }; }
        return { op: "eq", needsValue: true, ci: true };
      }
      if (lw === "equals" || lw === "equal" || lw === "eq") { next(); if (wl(peek()) === "to") next(); return { op: "eq", needsValue: true, ci: true }; }
      if (lw === "isnt" || lw === "isn") { next(); return { op: "neq", needsValue: true, ci: true }; }
      if (lw === "not") { next(); if (wl(peek()) === "equal") { next(); if (wl(peek()) === "to") next(); } return { op: "neq", needsValue: true, ci: true }; }
      if (lw === "after" || lw === "over" || lw === "above" || lw === "exceeds" || lw === "exceeding" || lw === "past") { next(); return { op: "gt", needsValue: true }; }
      if (lw === "before" || lw === "under" || lw === "below") { next(); return { op: "lt", needsValue: true }; }
      if (lw === "greater" || lw === "more" || lw === "larger" || lw === "bigger" || lw === "newer") { next(); if (wl(peek()) === "than") next(); return { op: "gt", needsValue: true }; }
      if (lw === "less" || lw === "fewer" || lw === "smaller" || lw === "lower" || lw === "older") { next(); if (wl(peek()) === "than") next(); return { op: "lt", needsValue: true }; }
      if (lw === "at") { next(); var a = wl(peek()); if (a === "least") { next(); return { op: "gte", needsValue: true }; } if (a === "most") { next(); return { op: "lte", needsValue: true }; } fail("expected 'least' or 'most' after 'at'"); }
      if (lw === "starts" || lw === "start" || lw === "begins" || lw === "begin" || lw === "startswith" || lw === "beginning") { next(); if (wl(peek()) === "with") next(); return { op: "starts", needsValue: true, ci: true }; }
      if (lw === "ends" || lw === "end" || lw === "endswith" || lw === "ending") { next(); if (wl(peek()) === "with") next(); return { op: "ends", needsValue: true, ci: true }; }
      if (lw === "contains" || lw === "contain" || lw === "containing" || lw === "includes" || lw === "include" || lw === "including" || lw === "like" || lw === "has" || lw === "matching" || lw === "matches") { next(); return { op: "contains", needsValue: true, ci: true }; }
      if (lw === "named" || lw === "called") { next(); return { op: "eq", needsValue: true, ci: true }; }
      fail("don't understand the operator near '" + (p.v || lw) + "'");
    }

    function expectField() {
      var p = peek();
      if (!p || p.t !== "word") fail("expected a field name" + (p ? " near '" + (p.v || p.t) + "'" : ""));
      var f = resolveFreeField(model, p.v);
      if (!f) fail("unknown field: '" + p.v + "'");
      next();
      return f;
    }

    function parseCmp() {
      /* skip leading filler/dataset words ("show", "all", "gpus", "whose") that
         resolve to neither a field nor a special keyword — but ONLY when another
         word follows (the sentence continues). A lone unknown word sitting right
         before an operator/value is the user's (mistyped) field, so we let it fall
         through to expectField() and report a precise "unknown field". */
      var skipped = 0;
      while (peek() && peek().t === "word" && skipped < 4) {
        var w0 = peek().v.toLowerCase();
        if (SPECIAL_LEAD[w0]) break;
        if (resolveFreeField(model, peek().v)) break;
        var nxt = toks[pos + 1];
        if (!nxt || nxt.t !== "word") break;
        skipped++; next();
      }
      var p = peek();
      if (!p) fail("incomplete clause");
      var lw = wl(p);
      if (lw === "no" || lw === "without" || lw === "missing") { next(); var fn = expectField(); return { field: fn.key, op: "isnull" }; }
      if (lw === "named" || lw === "called") {
        next();
        var disp = pickDisplayField(model);
        var df = disp ? resolveFreeField(model, disp) : null;
        if (!df) fail("no name/title field to match 'named'");
        var v0 = readValue(); if (v0 === "") fail("expected a value after 'named'");
        return { field: df.key, op: "eq", value: v0, ci: true };
      }
      var fld = expectField();
      var oi = parseOperator();
      if (!oi.needsValue) return { field: fld.key, op: oi.op };
      if (!peek() || (peek().t !== "str" && peek().t !== "num" && peek().t !== "word")) fail("expected a value after '" + (oi.raw || oi.op) + "'");
      var val = readValue();
      return { field: fld.key, op: oi.op, value: val, ci: !!oi.ci };
    }

    function parsePrimary() {
      var p = peek();
      if (!p) fail("unexpected end of query");
      if (p.t === "lp") { next(); var nn = parseOr(); var cc = peek(); if (cc && cc.t === "rp") next(); else fail("missing ')'"); return nn; }
      return parseCmp();
    }
    function parseAnd() {
      var node = parsePrimary();
      while (peek() && peek().t === "and") { next(); node = { op: "and", l: node, r: parsePrimary() }; }
      return node;
    }
    function parseOr() {
      var node = parseAnd();
      while (peek() && peek().t === "or") { next(); node = { op: "or", l: node, r: parseAnd() }; }
      return node;
    }

    var tree = parseOr();
    if (pos < toks.length) { var leftover = toks[pos]; fail("couldn't parse near '" + (leftover.v || leftover.t) + "' — join clauses with 'and' / 'or'."); }
    return tree;
  }

  /* evaluate one predicate leaf against a data item */
  function freeEvalLeaf(model, leaf, item, overrides) {
    var f = findRootField(model, leaf.field);
    var v = rqVal(item, f);
    var op = leaf.op;
    if (op === "isnull") return f && f.isCollection ? (!Array.isArray(v) || v.length === 0) : rqIsEmpty(v);
    if (op === "isnotnull") return f && f.isCollection ? (Array.isArray(v) && v.length > 0) : !rqIsEmpty(v);
    if (op === "starts" || op === "ends" || op === "contains") {
      var needle = rqStr(leaf.value).toLowerCase();
      var test = function (h) {
        h = rqStr(h).toLowerCase();
        if (op === "starts") return h.indexOf(needle) === 0;
        if (op === "ends") return needle === "" ? true : h.length >= needle.length && h.indexOf(needle, h.length - needle.length) !== -1;
        return h.indexOf(needle) !== -1;
      };
      if (f && f.isCollection && Array.isArray(v)) return v.some(test);
      return test(v);
    }
    if ((op === "eq" || op === "neq") && f && f.isCollection && Array.isArray(v)) {
      var nd = rqStr(leaf.value).toLowerCase();
      var hit = v.some(function (el) { return rqStr(el).toLowerCase() === nd; });
      return op === "eq" ? hit : !hit;
    }
    return rqEvalFilter(model, { field: leaf.field, op: op, value: leaf.value, caseInsensitive: !!leaf.ci }, item, overrides);
  }
  function freeEval(model, node, item, overrides) {
    if (!node) return true;
    if (node.op === "and") return freeEval(model, node.l, item, overrides) && freeEval(model, node.r, item, overrides);
    if (node.op === "or") return freeEval(model, node.l, item, overrides) || freeEval(model, node.r, item, overrides);
    if (node.op === "not") return !freeEval(model, node.l, item, overrides);
    return freeEvalLeaf(model, node, item, overrides);
  }

  /* C# for one predicate leaf (no Where/ToList wrapper) */
  function freeLeafCSharp(model, leaf, overrides) {
    var f = findRootField(model, leaf.field);
    var ref = fieldRef(model, leaf.field, overrides);
    var op = leaf.op;
    if (op === "isnull") return (f && f.isCollection) ? "(" + countExpr(model, leaf.field, overrides) + ") == 0" : ref + " == null";
    if (op === "isnotnull") return (f && f.isCollection) ? "(" + countExpr(model, leaf.field, overrides) + ") > 0" : ref + " != null";
    if (op === "starts" || op === "ends" || op === "contains") {
      var meth = op === "starts" ? "StartsWith" : op === "ends" ? "EndsWith" : "Contains";
      if (f && f.isCollection) return enumerableExpr(model, leaf.field, overrides) + ".Any(x => x." + meth + "(" + csString(leaf.value) + ", StringComparison.OrdinalIgnoreCase))";
      return "(" + ref + " ?? \"\")." + meth + "(" + csString(leaf.value) + ", StringComparison.OrdinalIgnoreCase)";
    }
    if ((op === "eq" || op === "neq") && f && f.isCollection) {
      var inner = enumerableExpr(model, leaf.field, overrides) + ".Any(x => string.Equals(x, " + csString(leaf.value) + ", StringComparison.OrdinalIgnoreCase))";
      return op === "neq" ? "!(" + inner + ")" : inner;
    }
    return filterCmp(model, { field: leaf.field, op: op, value: leaf.value, caseInsensitive: !!leaf.ci }, overrides);
  }
  function freeNodeCSharp(model, node, overrides) {
    if (!node) return "true";
    if (node.op === "and") return "(" + freeNodeCSharp(model, node.l, overrides) + " && " + freeNodeCSharp(model, node.r, overrides) + ")";
    if (node.op === "or") return "(" + freeNodeCSharp(model, node.l, overrides) + " || " + freeNodeCSharp(model, node.r, overrides) + ")";
    if (node.op === "not") return "!(" + freeNodeCSharp(model, node.l, overrides) + ")";
    return freeLeafCSharp(model, node, overrides);
  }

  /* Top-level: parse + (run on rows if given) + emit C#. Never throws. Returns
     { ok:true, predicate, csharp, columns, data } | { ok:false, error }. */
  function freeQuery(model, text, rows, overrides) {
    overrides = overrides || {};
    if (!model || !model.byName) return { ok: false, error: "Infer a model first (paste JSON or CSV)." };
    var node;
    try { node = freeParse(text, model); }
    catch (e) { return { ok: false, error: (e && e.message) ? e.message : "could not parse the query" }; }
    var body = freeNodeCSharp(model, node, overrides);
    var csharp = "var result = source\n    .Where(s => " + body + ")\n    .ToList();";
    var data = null;
    if (Array.isArray(rows)) {
      try { data = rows.filter(function (it) { return freeEval(model, node, it, overrides); }); }
      catch (e2) { return { ok: false, error: "run error: " + ((e2 && e2.message) || e2), csharp: csharp, predicate: body }; }
    }
    return { ok: true, node: node, predicate: body, csharp: csharp, columns: rqColumnsForRoot(model), data: data };
  }

  /* ===================== populated results JSON ===================== */
  /* Coerce a raw cell to its model type so the exported results file matches
     what the generated C# would serialize (Signups -> int|null, keeper -> null). */
  function rqCoerce(model, field, value, overrides) {
    if (!field) return value === undefined ? null : value;
    if (field.isCollection) return Array.isArray(value) ? value : (value == null ? (field.nullable ? null : []) : value);
    if (rqIsEmpty(value)) return null;
    var base = rootEffectiveBase(model, field, overrides);
    if (base === "int" || base === "long") { var n = rqNum(value); return n === null ? null : Math.trunc(n); }
    if (base === "double") { var d = rqNum(value); return d === null ? null : d; }
    if (base === "bool") { var s = rqStr(value).toLowerCase(); return s === "true" || s === "1" || s === "yes"; }
    return rqStr(value);
  }
  function rqTypedObject(model, item, overrides) {
    var root = model && model.byName ? model.byName[model.rootClass] : null;
    if (!root) return item;
    var o = {};
    /* Key by the field's JSON name (camelCase original) when present so this
       matches what the generated Program.cs serializes: System.Text.Json has no
       naming policy set, so it honours each property's [JsonPropertyName] (==
       f.jsonName) and falls back to the C# property name otherwise. */
    root.fields.forEach(function (f) { o[f.jsonName || f.property] = rqCoerce(model, f, rqVal(item, f), overrides); });
    return o;
  }
  var ROOT_ROW_SHAPES = { "filter-equals": 1, "filter-contains": 1, "filter-empty-collection": 1, "filter-nested-any": 1, "sort-by": 1, "top-n": 1, "binary-search": 1 };
  /* Run every output-flagged query over the data and assemble the results object
     ({ outputKey: [matching objects], ... }) the C# would write, as pretty JSON.
     This is what lets the exported output file ship already populated. */
  function buildResultsJson(model, rows, dataRows, overrides) {
    overrides = overrides || {};
    dataRows = Array.isArray(dataRows) ? dataRows : [];
    var out = {};
    (rows || []).forEach(function (row) {
      if (!row || !row.output) return;
      var key = (row.outputKey && String(row.outputKey).trim()) || row.name;
      if (!key) return;
      var r = runQuery(model, row, dataRows, overrides);
      if (!r || !r.ok) { out[key] = null; return; }
      /* a reduced filter writes a scalar (count/any) or a single element (first),
         matching what the generated C# serializes, not a list. */
      if (row.reduce === "count" || row.reduce === "any") { out[key] = r.value; return; }
      if (row.reduce === "first") { out[key] = (r.data && r.data[0]) ? rqTypedObject(model, r.data[0], overrides) : null; return; }
      if (row.shape === "binary-search") { out[key] = (r.data && r.data[0]) ? rqTypedObject(model, r.data[0], overrides) : null; return; }
      if (ROOT_ROW_SHAPES[row.shape]) { out[key] = (r.data || []).map(function (it) { return rqTypedObject(model, it, overrides); }); return; }
      out[key] = r.data || [];   /* group-aggregate / most-frequent / select: plain records */
    });
    return JSON.stringify(out, null, 2);
  }

  /* convenience: the populated results JSON for a preset, in one call */
  function resultsJsonFromPreset(preset) {
    var parsed = parseSample(preset.sample, { classNames: preset.classNames, rootClass: preset.rootClass, allNullable: preset.allNullable !== false });
    if (!parsed.ok) return { ok: false, error: parsed.error };
    var ex = extractRows(preset.sample);
    if (!ex.ok) return { ok: false, error: ex.error };
    return { ok: true, json: buildResultsJson(parsed.model, preset.rows, ex.rows, preset.overrides || {}) };
  }

  /* ===================== exam presets (the three pasted problems) ===================== */

  var WORKSHOPS_CSV = [
    "Id,Title,Tag,Signups,Instructor,Room",
    '1,"Soldering Basics, Part 1",Electronics,12,Ada Lovelace,Lab A',
    "2,Intro to Woodturning,Woodworking,8,Grace Hopper,Workshop 1",
    "3,Lathe Safety,Woodworking,,,Workshop 1",
    "4,Laser Cut Coasters,LaserCutting,20,Alan Turing,Lab B",
    "5,Cabinet Joinery,Woodworking,15,,Workshop 2",
    "6,3D Print Your First Model,3DPrinting,,Katherine Johnson,Lab A",
    "7,TIG Welding,Metalworking,5,Nikola Tesla,Forge",
    '8,"Resin Casting, Intro",3DPrinting,9,,Lab A',
    "9,Hand-Cut Dovetails,Woodworking,18,Grace Hopper,Workshop 1",
  ].join("\n");

  function workshopsPreset() {
    return {
      name: "Workshops (CSV)",
      sample: WORKSHOPS_CSV,
      inputFile: "workshops.csv",
      outputFile: "Problem_4_Query_Results.json",
      namespace: "WorkshopQueries",
      rootClass: "Workshop",
      classNames: {},
      overrides: {},
      rows: [
        { shape: "filter-equals", field: "Tag", op: "eq", value: "Woodworking", name: "woodworking", label: "Woodworking workshops", print: true, output: true, outputKey: "woodworkingWorkshops" },
        { shape: "filter-equals", field: "Instructor", op: "is", name: "noInstructor", label: "no instructor assigned", print: true, output: true, outputKey: "missingInstructor" },
        { shape: "sort-by", field: "Signups", direction: "desc", nullValue: "0", name: "bySignups", label: "sorted by signups, most first (missing = 0)", print: true, output: true, outputKey: "sortedBySignups" },
        { shape: "above-average", field: "Signups", excludeNull: true, name: "aboveAvg", label: "above the average signups (known values only)", print: true, output: true, outputKey: "aboveAverageSignups" },
      ],
    };
  }

  var LIGHTHOUSES_JSON = JSON.stringify([
    { name: "Gannet Stack Light", region: "North Cape", commissionedYear: 1887, flag: false, keeper: "Mara Sundgren", heightMeters: 41.5, homePort: "Gullhaven",
      inspections: [ { year: 2244, inspector: "P. Holt", passed: true, rating: 4 }, { year: 2245, inspector: "R. Vance", passed: true, rating: 5 } ] },
    { name: "Saltmarsh Beacon", region: "South Reach", commissionedYear: 1902, flag: true, keeper: null, heightMeters: 28.0, homePort: "Gullhaven",
      inspections: [ { year: 2245, inspector: "P. Holt", passed: false, rating: 2 } ] },
    { name: "Dawnreef Tower", region: "West Banks", commissionedYear: 1875, flag: true, heightMeters: 53.2, homePort: "Tern Harbor",
      inspections: [ { year: 2240, inspector: "S. Okafor", passed: true, rating: 3 }, { year: 2242, inspector: "S. Okafor", passed: true, rating: 4 }, { year: 2245, inspector: "R. Vance", passed: true, rating: 5 } ] },
    { name: "Lowtide Marker", region: "North Cape", commissionedYear: 1990, flag: true, heightMeters: 0.0, homePort: "Gullhaven", inspections: [] },
    { name: "Cormorant Point", region: "South Reach", commissionedYear: 1860, flag: false, keeper: "Idris Vale", heightMeters: 36.7, homePort: "Tern Harbor",
      inspections: [ { year: 2243, inspector: "P. Holt", passed: true, rating: 4 } ] },
  ], null, 2);

  function lighthousesPreset() {
    return {
      name: "Lighthouses (JSON)",
      sample: LIGHTHOUSES_JSON,
      inputFile: "lighthouses.json",
      outputFile: "Problem_4_Query_Results.json",
      namespace: "LighthouseQueries",
      classNames: { "Item": "Lighthouse", "Inspections": "Inspection" },
      overrides: {},
      rows: [
        { shape: "filter-equals", field: "flag", op: "eq", value: "true", name: "automated", label: "automated lighthouses (flag == true)", print: true, output: true, outputKey: "automated" },
        { shape: "filter-equals", field: "keeper", op: "is", name: "unkept", label: "no keeper (null or missing)", print: true, output: true, outputKey: "unkept" },
        { shape: "sort-by", field: "inspections", byCount: true, direction: "desc", name: "byInspections", label: "sorted by inspection count, most first", print: true, output: true, outputKey: "sortedByInspectionCount" },
        { shape: "group-aggregate", field: "region", aggregate: "Average", subField: "inspections", subCount: true, sort: "keyAsc", name: "avgPerRegion", label: "average inspections per lighthouse, by region", print: true, output: true, outputKey: "averageInspectionsPerRegion" },
        { shape: "filter-nested-any", collection: "inspections", subField: "year", match: "equals", value: "2245", andWhere: { field: "homePort", value: "Gullhaven", op: "equals" }, name: "gullhaven2245", label: "Gullhaven home port with a 2245 inspection", print: true, output: true, outputKey: "gullhaven2245" },
        { shape: "binary-search", field: "name", value: "Gannet Stack Light", name: "search", label: "binary search by name for Gannet Stack Light", print: true, output: false },
      ],
    };
  }

  var COMICS_JSON = JSON.stringify([
    { title: "Iron Vigil #1", author: "Mara Stone", releaseYear: 1998 },
    { title: "Iron Vigil #2", author: "Mara Stone", releaseYear: 1999 },
    { title: "Night Harbor", author: "Lou Park", releaseYear: 1999 },
    { title: "Quantum Lass", author: "Mara Stone", releaseYear: 2001 },
    { title: "Quantum Lass: Returns", author: "Mara Stone", releaseYear: 2001 },
    { title: "Deep Field", author: "Lou Park", releaseYear: 2001 },
    { title: "Solar Wake", author: "Ines Roy", releaseYear: 2024 },
    { title: "Tin Saints", author: "Lou Park", releaseYear: 1995 },
  ], null, 2);

  function comicsPreset() {
    return {
      name: "Comics (JSON)",
      sample: COMICS_JSON,
      inputFile: "comics.json",
      outputFile: "Problem_4_Query_Results.json",
      namespace: "ComicQueries",
      classNames: { "Item": "Comic" },
      overrides: {},
      rows: [
        { shape: "list-method", method: "toString", name: "printAll", label: "print every comic (overrides ToString, task 3.1.3)", print: true, output: false },
        { shape: "list-method", method: "count", name: "total", label: "total number of comics", print: true, output: true, outputKey: "totalComics" },
        { shape: "filter-equals", field: "releaseYear", op: "lt", value: "2000", name: "before2000", label: "released before 2000", print: true, output: true, outputKey: "releasedBefore2000" },
        { shape: "group-aggregate", field: "author", aggregate: "Count", sort: "valueDesc", name: "perAuthor", label: "comics per author, most first", print: true, output: true, outputKey: "comicsPerAuthor" },
        { shape: "most-frequent-per-group", field: "releaseYear", subField: "author", direction: "desc", name: "topAuthorPerYear", label: "most active author per year (ordered by year)", print: true, output: true, outputKey: "mostActiveAuthorPerYear" },
      ],
    };
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
    FILTER_OPS: FILTER_OPS,
    /* runner */
    runQuery: runQuery,
    extractRows: extractRows,
    /* presets */
    presets: presets,
    presetByKey: presetByKey,
    summerPreset: summerPreset,
    reexamPreset: reexamPreset,
    workshopsPreset: workshopsPreset,
    lighthousesPreset: lighthousesPreset,
    comicsPreset: comicsPreset,
    generateFromPreset: generateFromPreset,
    generateSubmissionFromPreset: generateSubmissionFromPreset,
    /* free-text (plain-English) query */
    freeQuery: freeQuery,
    resolveFreeField: resolveFreeField,
    /* populated results JSON for the export bundle */
    buildResultsJson: buildResultsJson,
    resultsJsonFromPreset: resultsJsonFromPreset,
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
