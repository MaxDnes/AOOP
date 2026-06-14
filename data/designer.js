/* ============ VISUAL DESIGNER · UI (drag & drop → AXAML + ViewModel) ============
   window.DESIGNER = { render, init, previewHTML }; all handlers live on window.DSG.
   Loads cleanly under Node (no DOM access at load time; previewHTML is pure). */

(function (global) {
  "use strict";

  const CORE = global.DESIGNER_CORE;

  /* ---------------- local escaping (must not depend on app.js) ---------------- */
  function escH(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------------- state ---------------- */
  let tree = null;          // working Window tree
  let selectedId = null;    // id of the selected node
  let dragType = null;      // palette type being dragged
  let dragNodeId = null;    // existing canvas node being dragged
  let dragColor = null;     // swatch color being dragged
  let currentSlot = "";     // name of the loaded slot ("" = unsaved)
  let dsgCodes = [];        // copy registry for the output panes
  let keysBound = false;    // Delete-key listener registered once
  let lastDropEl = null;    // current drop-target highlight
  let msgTimer = null;
  let undoStack = [];       // serialized {tree, selectedId} snapshots
  let redoStack = [];       // popped snapshots, for redo
  const UNDO_CAP = 100;
  let moveState = null;     // active drag-to-move on the stage (Canvas child)
  let marginMoveState = null; // active center-handle drag that writes Margin
  let resizeState = null;   // active resize-handle drag
  /* reference-image overlay: session-only (data URLs are too big for localStorage
     slots). includeInExport gates whether Export JSON carries the data URL. */
  let refImage = { dataUrl: null, visible: false, opacity: 30, includeInExport: false };

  /* ---------------- persistence (try/catch like app.js store) ---------------- */
  function loadSlots() {
    try { return JSON.parse(localStorage.getItem("aop-designer-slots") || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveSlots(s) {
    try { localStorage.setItem("aop-designer-slots", JSON.stringify(s)); } catch (e) {}
  }
  /* current working-state schema version. Payloads are stamped {v:1, ...}; older
     unversioned payloads ({tree, selectedId, slot}) still load (migration), and any
     unknown/future shape falls back to null so we never crash on a stale payload. */
  const DSG_STATE_V = 1;
  function loadCurrent() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem("aop-designer-current") || "null"); }
    catch (e) { return null; }
    if (!raw || typeof raw !== "object") return null;
    /* versioned shape: accept only versions we understand */
    if (raw.v != null) {
      if (raw.v !== DSG_STATE_V) return null;        // unknown/future -> graceful fallback
      return { tree: raw.tree, selectedId: raw.selectedId, slot: raw.slot };
    }
    /* legacy unversioned shape: migrate in place if it carries a Window tree */
    if (raw.tree && raw.tree.type === "Window") {
      return { tree: raw.tree, selectedId: raw.selectedId, slot: raw.slot };
    }
    return null;
  }
  function saveCurrent() {
    try {
      localStorage.setItem("aop-designer-current",
        JSON.stringify({ v: DSG_STATE_V, tree: tree, selectedId: selectedId, slot: currentSlot }));
    } catch (e) {}
  }

  /* after loading a persisted tree, advance core's id sequence past every used id
     so freshly created nodes never collide with loaded ones */
  function syncIdSeq(t) {
    CORE.syncIdSeq(t);
  }

  /* ---------------- undo / redo ---------------- */
  function snapshot() {
    return JSON.stringify({ tree: tree, selectedId: selectedId });
  }
  /* call BEFORE any mutation: capture the current state for undo, clear redo */
  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > UNDO_CAP) undoStack.shift();
    redoStack.length = 0;
  }
  function restoreSnapshot(str) {
    const snap = JSON.parse(str);
    tree = snap.tree;
    syncIdSeq(tree);
    selectedId = (snap.selectedId && CORE.findNode(tree, snap.selectedId))
      ? snap.selectedId : tree.id;
  }
  function undo() {
    if (!undoStack.length) { msg("nothing to undo"); return; }
    redoStack.push(snapshot());
    restoreSnapshot(undoStack.pop());
    refresh();
    msg("undo");
  }
  function redo() {
    if (!redoStack.length) { msg("nothing to redo"); return; }
    undoStack.push(snapshot());
    restoreSnapshot(redoStack.pop());
    refresh();
    msg("redo");
  }
  function syncUndoButtons() {
    const u = document.getElementById("dsg-undo");
    const r = document.getElementById("dsg-redo");
    if (u) u.disabled = undoStack.length === 0;
    if (r) r.disabled = redoStack.length === 0;
  }
  /* coalesce keystroke-level edits: only push a fresh undo entry when the edit
     target (node + prop) changes, so a continuous typing run is one undo step */
  let coalesceKey = null;
  function pushUndoCoalesced(key) {
    if (coalesceKey === key) return;       // same field still being edited
    coalesceKey = key;
    pushUndo();
  }
  function endCoalesce() { coalesceKey = null; }

  /* ---------------- seed example slots ---------------- */
  function seedRecipe() {
    const w = CORE.createNode("Window");
    w.props.Title = "Recipe Planner"; w.props.Width = 640; w.props.Height = 420;
    const g = CORE.createNode("Grid");
    g.props.ColumnDefinitions = "240,*"; g.props.Margin = "12";
    CORE.addChild(w, w.id, g);
    const lb = CORE.createNode("ListBox");
    lb.bindings.ItemsSource = "Items"; lb.bindings.SelectedItem = "SelectedItem";
    lb.props["Grid.Column"] = 0; lb.props.Margin = "0,0,12,0";
    CORE.addChild(w, g.id, lb);
    const sp = CORE.createNode("StackPanel");
    sp.props.Spacing = 10; sp.props["Grid.Column"] = 1;
    CORE.addChild(w, g.id, sp);
    const tb = CORE.createNode("TextBox");
    tb.bindings.Text = "Name"; tb.props.Watermark = "Recipe name";
    CORE.addChild(w, sp.id, tb);
    const sl = CORE.createNode("Slider");
    sl.bindings.Value = "Rating"; sl.props.Maximum = 5;
    CORE.addChild(w, sp.id, sl);
    const btn = CORE.createNode("Button");
    btn.props.Content = "Add"; btn.bindings.Command = "AddCommand";
    CORE.addChild(w, sp.id, btn);
    const st = CORE.createNode("TextBlock");
    st.bindings.Text = "StatusMessage";
    CORE.addChild(w, sp.id, st);
    return w;
  }

  function seedShapes() {
    const w = CORE.createNode("Window");
    w.props.Title = "Shapes Canvas"; w.props.Width = 520; w.props.Height = 380;
    const cv = CORE.createNode("Canvas");
    cv.props.Background = "#F5F5F5";
    CORE.addChild(w, w.id, cv);
    const r = CORE.createNode("Rectangle");
    r.props["Canvas.Left"] = 40; r.props["Canvas.Top"] = 30;
    r.props.Width = 120; r.props.Height = 70; r.props.Fill = "#39BAE6";
    CORE.addChild(w, cv.id, r);
    const el = CORE.createNode("Ellipse");
    el.props["Canvas.Left"] = 220; el.props["Canvas.Top"] = 60;
    el.props.Width = 90; el.props.Height = 90; el.props.Fill = "#DC143C";
    CORE.addChild(w, cv.id, el);
    const ln = CORE.createNode("Line");
    ln.props.StartPoint = "40,160"; ln.props.EndPoint = "330,250";
    ln.props.Stroke = "#E6B450"; ln.props.StrokeThickness = 3;
    CORE.addChild(w, cv.id, ln);
    return w;
  }

  /* exam preset · Summer 2025 RectangleUI: Canvas-free-position ItemsControl with a
     typed model (X,Y,Width,Height,Brush), two sliders, Add button, count TextBlock */
  function seedRectangleUI() {
    const w = CORE.createNode("Window");
    w.props.Title = "RectangleUI"; w.props.Width = 640; w.props.Height = 460;
    const root = CORE.createNode("DockPanel");
    CORE.addChild(w, w.id, root);

    const panel = CORE.createNode("StackPanel");
    panel.props.Orientation = "Horizontal"; panel.props.Spacing = 12;
    panel.props.Margin = "10"; panel.props["DockPanel.Dock"] = "Top";
    CORE.addChild(w, root.id, panel);

    const ws = CORE.createNode("Slider");
    ws.props.Minimum = 10; ws.props.Maximum = 200; ws.props.Width = 160;
    ws.bindings.Value = "NewWidth";
    CORE.addChild(w, panel.id, ws);
    const hs = CORE.createNode("Slider");
    hs.props.Minimum = 10; hs.props.Maximum = 200; hs.props.Width = 160;
    hs.bindings.Value = "NewHeight";
    CORE.addChild(w, panel.id, hs);
    const add = CORE.createNode("Button");
    add.props.Content = "Add Rectangle"; add.bindings.Command = "AddCommand";
    add.recipes = { Command: "add-random-item" };   // working body: random rect into Rectangles
    CORE.addChild(w, panel.id, add);
    const count = CORE.createNode("TextBlock");
    count.bindings.Text = "CountText";
    CORE.addChild(w, panel.id, count);

    const cv = CORE.createNode("Canvas");
    cv.props.Background = "#F5F5F5";
    CORE.addChild(w, root.id, cv);
    const items = CORE.createNode("ItemsControl");
    items.bindings.ItemsSource = "Rectangles";
    items.model = {
      mode: "typed", className: "RectItem", canvasItems: true,
      fields: [
        { name: "X", type: "double" }, { name: "Y", type: "double" },
        { name: "Width", type: "double" }, { name: "Height", type: "double" },
        { name: "Brush", type: "IBrush" },
      ],
    };
    CORE.addChild(w, cv.id, items);
    /* Summer P2: the 2-second timer recolors every rectangle with a random brush.
       DispatcherTimer ticks on the UI thread, so item.Brush mutations are safe. */
    w.timer = { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "recolor-items" };
    return w;
  }

  /* exam preset · ReExam 2025 MealPlanner: Grid 2 cols + bottom row, left typed
     ListBox (WeekDayItem: Day, RecipeName) with SelectedItem, right strings ListBox
     (Multiple), Generate button spanning the bottom */
  function seedMealPlanner() {
    const w = CORE.createNode("Window");
    w.props.Title = "Family Meal Planner"; w.props.Width = 640; w.props.Height = 440;
    const g = CORE.createNode("Grid");
    g.props.ColumnDefinitions = "*,*"; g.props.RowDefinitions = "*,Auto"; g.props.Margin = "12";
    CORE.addChild(w, w.id, g);

    const left = CORE.createNode("ListBox");
    left.props["Grid.Row"] = 0; left.props["Grid.Column"] = 0; left.props.Margin = "0,0,6,8";
    left.bindings.ItemsSource = "WeekDays";
    left.bindings.SelectedItem = "SelectedRecipe";
    left.model = {
      mode: "typed", className: "WeekDayItem",
      fields: [{ name: "Day", type: "string" }, { name: "RecipeName", type: "string" }],
    };
    CORE.addChild(w, g.id, left);

    const right = CORE.createNode("ListBox");
    right.props["Grid.Row"] = 0; right.props["Grid.Column"] = 1; right.props.Margin = "6,0,0,8";
    right.props.SelectionMode = "Multiple";
    right.bindings.ItemsSource = "Ingredients";
    CORE.addChild(w, g.id, right);

    const gen = CORE.createNode("Button");
    gen.props.Content = "Generate"; gen.props["Grid.Row"] = 1;
    gen.props["Grid.Column"] = 0; gen.props["Grid.ColumnSpan"] = 2;
    gen.props.HorizontalAlignment = "Stretch";
    gen.bindings.Command = "GenerateCommand";
    CORE.addChild(w, g.id, gen);
    return w;
  }

  /* exam preset · ReExam 2025 P3 async counter: a big count TextBlock + Start/Stop/
     Reset buttons wired to a 100ms Task.Delay loop that increments Count on the UI
     thread. Start/Stop pause+resume preserve the count; Reset zeroes it. */
  function seedCounter() {
    const w = CORE.createNode("Window");
    w.props.Title = "Async Counter"; w.props.Width = 420; w.props.Height = 260;
    const sp = CORE.createNode("StackPanel");
    sp.props.Spacing = 14; sp.props.Margin = "20"; sp.props.HorizontalAlignment = "Center";
    CORE.addChild(w, w.id, sp);

    const count = CORE.createNode("TextBlock");
    count.bindings.Text = "Count"; count.props.FontSize = 48;
    count.props.HorizontalAlignment = "Center";
    CORE.addChild(w, sp.id, count);

    const row = CORE.createNode("StackPanel");
    row.props.Orientation = "Horizontal"; row.props.Spacing = 8;
    row.props.HorizontalAlignment = "Center";
    CORE.addChild(w, sp.id, row);

    const start = CORE.createNode("Button");
    start.props.Content = "Start"; start.bindings.Command = "StartCommand";
    start.recipes = { Command: "timer-start" };
    CORE.addChild(w, row.id, start);
    const stop = CORE.createNode("Button");
    stop.props.Content = "Stop"; stop.bindings.Command = "StopCommand";
    stop.recipes = { Command: "timer-stop" };
    CORE.addChild(w, row.id, stop);
    const reset = CORE.createNode("Button");
    reset.props.Content = "Reset"; reset.bindings.Command = "ResetCommand";
    reset.recipes = { Command: "timer-reset" };
    CORE.addChild(w, row.id, reset);

    /* ReExam P3: +1 per 100ms on a background Task loop, posted to the UI thread */
    w.timer = { enabled: true, intervalMs: 100, mechanism: "task", action: "increment-counter" };
    return w;
  }

  function ensureSeeds() {
    const slots = loadSlots();
    if (Object.keys(slots).length) return;
    slots["Recipe list + form"] = seedRecipe();
    slots["Shapes canvas"] = seedShapes();
    slots["Summer 2025 · RectangleUI"] = seedRectangleUI();
    slots["ReExam 2025 · MealPlanner"] = seedMealPlanner();
    slots["ReExam 2025 · Async Counter (P3)"] = seedCounter();
    saveSlots(slots);
  }

  function initState() {
    ensureSeeds();
    if (tree) return;                       // keep the working tree across route switches
    const cur = loadCurrent();
    if (cur && cur.tree && cur.tree.type === "Window") {
      tree = cur.tree;
      currentSlot = cur.slot || "";
      selectedId = (cur.selectedId && CORE.findNode(tree, cur.selectedId)) ? cur.selectedId : tree.id;
      syncIdSeq(tree);
    } else {
      tree = CORE.createNode("Window");
      selectedId = tree.id;
    }
  }

  /* ---------------- tiny value helpers ---------------- */
  function num(v, d) {
    const n = parseFloat(v);
    return isNaN(n) ? (d || 0) : n;
  }
  function firstNum(v, d) {
    const m = /-?\d+(\.\d+)?/.exec(String(v == null ? "" : v));
    return m ? parseFloat(m[0]) : d;
  }
  function cssColor(v) {
    if (v == null || v === "") return "";
    if (/^transparent$/i.test(String(v))) return "transparent";
    return String(v);
  }
  /* value for <input type="color"> — only #RRGGBB is valid; #RGB expands, anything
     else (named colors, Transparent, bindings) falls back to #000000 */
  function hexForPicker(v) {
    const s = String(v == null ? "" : v).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    const m = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(s);
    if (m) return ("#" + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toLowerCase();
    return "#000000";
  }
  /* Avalonia Thickness → CSS margin/padding ("a" | "h,v" | "l,t,r,b") */
  function cssThickness(v) {
    const parts = String(v).split(",").map(function (x) { return parseFloat(x); })
      .filter(function (n) { return !isNaN(n); });
    if (parts.length === 1) return parts[0] + "px";
    if (parts.length === 2) return parts[1] + "px " + parts[0] + "px";
    if (parts.length === 4) return parts[1] + "px " + parts[2] + "px " + parts[3] + "px " + parts[0] + "px";
    return "0";
  }
  /* "Auto,*,2*,200" → "auto 1fr 2fr 200px" */
  function translateDefs(defs) {
    if (defs == null || String(defs).trim() === "") return "";
    return String(defs).split(",").map(function (t) {
      t = t.trim();
      if (!t) return null;
      if (/^auto$/i.test(t)) return "auto";
      if (t === "*") return "1fr";
      const star = /^(\d+(?:\.\d+)?)\*$/.exec(t);
      if (star) return star[1] + "fr";
      const n = parseFloat(t);
      return isNaN(n) ? "auto" : n + "px";
    }).filter(Boolean).join(" ");
  }

  /* ---------------- previewHTML: pure tree → HTML approximation ---------------- */
  function bindChip(vmName) {
    return '<span class="pv-bind">⚡ {Binding ' + escH(vmName) + '}</span>';
  }
  /* extra chips for bound props not already displayed as main content */
  function chips(node, handled) {
    let h = "";
    const b = node.bindings || {};
    Object.keys(b).forEach(function (k) {
      if (handled.indexOf(k) !== -1) return;
      if (!b[k]) return;
      h += ' <span class="pv-bind">⚡ ' + escH(k) + ' {Binding ' + escH(b[k]) + '}</span>';
    });
    return h;
  }

  /* common prop → inline style mapping, incl. attached placement from the parent */
  function baseStyle(node, parent) {
    let s = "";
    const p = node.props || {};
    const def = CORE.CATALOG[node.type] || {};
    const pp = parent ? (parent.props || {}) : {};
    const iw = (parent && parent.type === "WrapPanel") ? pp.ItemWidth : null;
    const ih = (parent && parent.type === "WrapPanel") ? pp.ItemHeight : null;
    /* Line/Polygon are sized by their geometry (points), not Width/Height — applying
       Width/Height here is what made a resized line a tiny diagonal in a big box. */
    const geomSized = node.type === "Line" || node.type === "Polygon";
    if (!geomSized && p.Width != null && p.Width !== "") s += "width:" + num(p.Width) + "px;";
    else if (!geomSized && iw != null && iw !== "") s += "width:" + num(iw) + "px;";
    if (!geomSized && p.Height != null && p.Height !== "") s += "height:" + num(p.Height) + "px;";
    else if (!geomSized && ih != null && ih !== "") s += "height:" + num(ih) + "px;";
    if (p.Margin != null && p.Margin !== "") s += "margin:" + cssThickness(p.Margin) + ";";
    if (def.group !== "Shapes" && p.Background) s += "background:" + cssColor(p.Background) + ";";
    if (p.Foreground) s += "color:" + cssColor(p.Foreground) + ";";
    if (p.FontSize) s += "font-size:" + num(p.FontSize) + "px;";
    if (p.FontWeight === "Bold") s += "font-weight:700;";
    if (p.TextWrapping === "Wrap") s += "white-space:normal;";

    const map = { Left: "flex-start", Top: "flex-start", Center: "center",
                  Right: "flex-end", Bottom: "flex-end", Stretch: "stretch" };
    if (parent && parent.type === "Canvas") {
      s += "position:absolute;left:" + num(p["Canvas.Left"], 0) + "px;top:" + num(p["Canvas.Top"], 0) + "px;";
    } else if (parent && parent.type === "Grid") {
      const r = num(p["Grid.Row"], 0) + 1, c = num(p["Grid.Column"], 0) + 1;
      const rs = num(p["Grid.RowSpan"], 1), cs = num(p["Grid.ColumnSpan"], 1);
      s += "grid-row:" + r + (rs > 1 ? " / span " + rs : "") + ";";
      s += "grid-column:" + c + (cs > 1 ? " / span " + cs : "") + ";";
      if (map[p.VerticalAlignment]) s += "align-self:" + map[p.VerticalAlignment] + ";";
      if (map[p.HorizontalAlignment]) s += "justify-self:" + map[p.HorizontalAlignment] + ";";
    } else if (parent) {
      const horiz = (parent.type === "StackPanel" || parent.type === "WrapPanel")
        && (parent.props || {}).Orientation === "Horizontal";
      const a = horiz ? p.VerticalAlignment : p.HorizontalAlignment;
      if (map[a]) s += "align-self:" + map[a] + ";";
    }
    /* universal rotation (degrees) around the element's centre, mirroring the
       RenderTransform the codegen emits. */
    const rot = Number(p.Rotation);
    if (isFinite(rot) && rot !== 0) s += "transform:rotate(" + rot + "deg);transform-origin:center center;";
    return s;
  }

  /* tight bounding box of a set of points, padded. Returns the min corner too, so
     callers can translate the geometry into a box that HUGS it (a line from
     (40,160)-(330,250) gets a 290x90 box, not a 330x250 one with the line stuck in
     a corner). pad surrounds the geometry on all sides. */
  function svgBounds(pairs, pad) {
    pad = pad || 0;
    if (!pairs || !pairs.length) return { minX: 0, minY: 0, w: pad || 1, h: pad || 1 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pairs.forEach(function (pt) {
      minX = Math.min(minX, pt[0]); minY = Math.min(minY, pt[1]);
      maxX = Math.max(maxX, pt[0]); maxY = Math.max(maxY, pt[1]);
    });
    const half = pad / 2;
    return {
      minX: minX - half, minY: minY - half,
      w: Math.max(1, Math.ceil(maxX - minX + pad)),
      h: Math.max(1, Math.ceil(maxY - minY + pad)),
    };
  }
  function parsePoint(s) {
    const m = String(s == null ? "" : s).split(",").map(function (x) { return parseFloat(x); });
    return [isNaN(m[0]) ? 0 : m[0], isNaN(m[1]) ? 0 : m[1]];
  }

  /* sample data for typed-model previews so an items host shows 3 realistic rows
     ("Monday: Spaghetti", a colored swatch for IBrush) instead of empty gray strips */
  const SAMPLE_WORDS = ["Monday", "Spaghetti", "Tuesday", "Tacos", "Wednesday", "Curry"];
  const SAMPLE_SWATCHES = ["#39BAE6", "#F07178", "#7FD962"];
  function sampleFieldValue(field, row) {
    const t = field.type;
    if (t === "IBrush") {
      return '<span class="pv-swatch" style="background:'
        + SAMPLE_SWATCHES[row % SAMPLE_SWATCHES.length] + '"></span>';
    }
    if (t === "double" || t === "int") {
      const nums = [12, 40, 88];
      return '<span class="pv-cell-num">' + nums[row % nums.length] + "</span>";
    }
    if (t === "bool") return '<span class="pv-cell-bool">' + (row % 2 ? "☑" : "☐") + "</span>";
    /* string (and fallback): pick stable example words, offset per field + row */
    const idx = (row * 2 + (field._i || 0)) % SAMPLE_WORDS.length;
    return '<span class="pv-cell-str">' + escH(SAMPLE_WORDS[idx]) + "</span>";
  }
  /* 3 sample rows for a typed items host, one column per non-position field */
  function sampleRowsHTML(model) {
    const fields = (model && model.fields ? model.fields : [])
      .filter(function (f) { return f && f.name && f.name !== "X" && f.name !== "Y"; })
      .map(function (f, i) { return Object.assign({ _i: i }, f); });
    if (!fields.length) {
      return '<div class="pv-ghost"></div><div class="pv-ghost"></div><div class="pv-ghost"></div>';
    }
    let h = "";
    for (let row = 0; row < 3; row++) {
      h += '<div class="pv-sample-row">'
        + fields.map(function (f) { return sampleFieldValue(f, row); }).join("")
        + "</div>";
    }
    return h;
  }

  /* a node can be resized when its catalog declares both Width and Height props */
  function canResize(node) {
    const def = CORE.CATALOG[node.type];
    if (!def) return false;
    /* Line/Polygon are defined by their points, not Width/Height — showing resize
       grips there just sets inert size props and leaves the shape unchanged (the
       "broken line" bug). Edit their geometry (StartPoint/EndPoint/Points) instead. */
    if (node.type === "Line" || node.type === "Polygon") return false;
    const names = (def.props || []).map(function (pp) { return pp.name; });
    return names.indexOf("Width") !== -1 && names.indexOf("Height") !== -1;
  }
  /* 8 corner/edge grips for the selected element; data-h carries the handle id */
  const GRIP_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  function gripsHTML() {
    return GRIP_HANDLES.map(function (h) {
      return '<span class="dsg-grip dsg-grip-' + h + '" data-grip="' + h + '"></span>';
    }).join("");
  }

  function pvNode(node, selId, parent, extra) {
    const def = CORE.CATALOG[node.type];
    if (!def) {
      return '<div class="pv pv-unknown" data-id="' + escH(node.id) + '">' + escH(node.type) + "?</div>";
    }
    const p = node.props || {};
    const b = node.bindings || {};
    let style = baseStyle(node, parent) + (extra || "");
    let inner = "";
    const kids = node.children || [];
    const renderKids = function () {
      return kids.map(function (k) { return pvNode(k, selId, node, ""); }).join("");
    };

    if (node.type === "StackPanel") {
      style += "display:flex;flex-direction:" + (p.Orientation === "Horizontal" ? "row" : "column") + ";";
      if (p.Spacing != null && p.Spacing !== "") style += "gap:" + num(p.Spacing) + "px;";
      inner = renderKids();
    } else if (node.type === "Grid") {
      style += "display:grid;";
      const rows = translateDefs(p.RowDefinitions), cols = translateDefs(p.ColumnDefinitions);
      if (rows) style += "grid-template-rows:" + rows + ";";
      if (cols) style += "grid-template-columns:" + cols + ";";
      inner = renderKids();
    } else if (node.type === "WrapPanel") {
      style += "display:flex;flex-wrap:wrap;";
      if (p.Orientation === "Vertical") style += "flex-direction:column;";
      inner = renderKids();
    } else if (node.type === "DockPanel") {
      style += "display:flex;flex-direction:column;";
      const fillIdx = p.LastChildFill === false ? -1 : kids.length - 1;
      const tops = [], bottoms = [], lefts = [], rights = [];
      let fill = null;
      kids.forEach(function (k, i) {
        if (i === fillIdx) { fill = k; return; }
        const dock = (k.props || {})["DockPanel.Dock"] || "Left";
        if (dock === "Top") tops.push(k);
        else if (dock === "Bottom") bottoms.push(k);
        else if (dock === "Right") rights.push(k);
        else lefts.push(k);
      });
      let mid = lefts.map(function (k) { return pvNode(k, selId, node, ""); }).join("");
      if (fill) mid += pvNode(fill, selId, node, "flex:1 1 auto;");
      rights.forEach(function (k, i) {
        mid += pvNode(k, selId, node, (!fill && i === 0) ? "margin-left:auto;" : "");
      });
      inner = tops.map(function (k) { return pvNode(k, selId, node, ""); }).join("")
        + '<div class="pv-dockmid">' + mid + "</div>"
        + bottoms.map(function (k) { return pvNode(k, selId, node, ""); }).join("");
    } else if (node.type === "Border") {
      const th = firstNum(p.BorderThickness, 1);
      style += "border:" + th + "px solid " + (cssColor(p.BorderBrush) || "#9aa3b2") + ";";
      if (p.CornerRadius) style += "border-radius:" + firstNum(p.CornerRadius, 0) + "px;";
      if (p.Padding) style += "padding:" + cssThickness(p.Padding) + ";";
      inner = renderKids();
    } else if (node.type === "ScrollViewer") {
      style += "overflow:auto;";
      inner = renderKids();
    } else if (node.type === "Canvas") {
      style += "position:relative;";
      if (p.Height == null || p.Height === "") style += "min-height:220px;";
      inner = renderKids();
    } else if (node.type === "Button") {
      inner = (b.Content ? bindChip(b.Content) : escH(p.Content != null ? p.Content : "Button"))
        + chips(node, ["Content"]);
    } else if (node.type === "TextBox") {
      if (b.Text) inner = bindChip(b.Text);
      else if (p.Text) inner = escH(p.Text);
      else if (p.Watermark) inner = '<span class="pv-dim">' + escH(p.Watermark) + "</span>";
      else inner = '<span class="pv-dim">…</span>';
      inner += chips(node, ["Text"]);
    } else if (node.type === "TextBlock") {
      inner = (b.Text ? bindChip(b.Text) : escH(p.Text != null ? p.Text : "TextBlock"))
        + chips(node, ["Text"]);
    } else if (node.type === "CheckBox" || node.type === "RadioButton") {
      const isCheck = node.type === "CheckBox";
      const on = p.IsChecked === true && !b.IsChecked;
      const glyph = isCheck ? (on ? "☑" : "☐") : (on ? "◉" : "○");
      inner = '<span class="pv-glyph">' + glyph + "</span>"
        + escH(p.Content != null ? p.Content : node.type)
        + chips(node, ["Content"]);
    } else if (node.type === "Slider") {
      const min = num(p.Minimum, 0), max = num(p.Maximum, 100);
      let pct = 40;
      if (!b.Value && p.Value != null && max > min) pct = ((num(p.Value, 0) - min) / (max - min)) * 100;
      pct = Math.max(0, Math.min(100, pct));
      inner = '<span class="pv-track"><span class="pv-thumb" style="left:' + pct.toFixed(1) + '%"></span></span>'
        + chips(node, []);
    } else if (node.type === "ComboBox") {
      inner = (b.ItemsSource ? bindChip(b.ItemsSource)
          : '<span class="pv-dim">' + escH(p.PlaceholderText || "Select…") + "</span>")
        + '<span class="pv-caret">▾</span>'
        + chips(node, ["ItemsSource"]);
    } else if (node.type === "ListBox" || node.type === "ItemsControl") {
      const tm = node.model && node.model.mode === "typed";
      /* typed hosts preview 3 realistic sample rows from the model fields; plain
         string hosts keep the neutral ghost strips */
      const rows = tm ? sampleRowsHTML(node.model)
        : '<div class="pv-ghost"></div><div class="pv-ghost"></div><div class="pv-ghost"></div>';
      inner = (b.ItemsSource ? '<div class="pv-lb-head">' + bindChip(b.ItemsSource)
            + (tm ? ' <span class="pv-typed">' + escH(node.model.className || "Item") + "</span>" : "") + "</div>" : "")
        + rows
        + chips(node, ["ItemsSource"]);
    } else if (node.type === "ToggleSwitch") {
      const on = p.IsChecked === true && !b.IsChecked;
      inner = '<span class="pv-toggle' + (on ? " on" : "") + '"><span class="pv-toggle-knob"></span></span>'
        + '<span class="pv-dim">' + escH((on ? p.OnContent : p.OffContent) || "") + "</span>"
        + chips(node, ["IsChecked"]);
    } else if (node.type === "NumericUpDown") {
      inner = '<span class="pv-num-val">' + escH(b.Value ? "" : (p.Value != null ? p.Value : 0)) + "</span>"
        + (b.Value ? bindChip(b.Value) : "")
        + '<span class="pv-num-spin">▴▾</span>' + chips(node, ["Value"]);
    } else if (node.type === "Separator") {
      inner = "";
    } else if (node.type === "Expander") {
      const open = p.IsExpanded !== false;
      inner = '<div class="pv-exp-head"><span class="pv-exp-arrow">' + (open ? "▾" : "▸") + "</span>"
        + escH(p.Header != null ? p.Header : "Expander") + "</div>"
        + (open ? '<div class="pv-exp-body">' + renderKids() + "</div>" : "");
    } else if (node.type === "TabControl") {
      const tabs = kids.map(function (k, i) {
        return '<span class="pv-tab' + (i === 0 ? " on" : "") + '">'
          + escH((k.props || {}).Header != null ? k.props.Header : "Tab") + "</span>";
      }).join("");
      const active = kids.length ? pvNode(kids[0], selId, node, "") : "";
      inner = '<div class="pv-tabstrip">' + tabs + "</div>"
        + '<div class="pv-tabpage">' + active + "</div>";
    } else if (node.type === "TabItem") {
      inner = renderKids();
    } else if (node.type === "ProgressBar") {
      const min = num(p.Minimum, 0), max = num(p.Maximum, 100);
      let pct = 40;
      if (!b.Value && p.Value != null && max > min) pct = ((num(p.Value, 0) - min) / (max - min)) * 100;
      pct = Math.max(0, Math.min(100, pct));
      inner = '<span class="pv-fillbar" style="width:' + pct.toFixed(1) + '%"></span>' + chips(node, []);
    } else if (node.type === "Image") {
      inner = '<span class="pv-imgicon">▣</span>'
        + (p.Source ? '<span class="pv-dim">' + escH(p.Source) + "</span>" : "");
    } else if (node.type === "Rectangle" || node.type === "Ellipse") {
      style += "background:" + (cssColor(p.Fill) || "#9aa7b8") + ";";
      if (p.Width == null || p.Width === "") style += "width:80px;";
      if (p.Height == null || p.Height === "") style += "height:50px;";
      if (p.Stroke) style += "border:" + num(p.StrokeThickness, 1) + "px solid " + cssColor(p.Stroke) + ";";
      if (node.type === "Rectangle" && p.RadiusX) style += "border-radius:" + num(p.RadiusX) + "px;";
      inner = chips(node, ["Fill"]);
    } else if (node.type === "Line") {
      const a = parsePoint(p.StartPoint), z = parsePoint(p.EndPoint);
      const tw = num(p.StrokeThickness, 2);
      const bb = svgBounds([a, z], tw + 2);
      /* draw in the box's LOCAL space so the line spans the box corner-to-corner
         instead of sitting in one corner of an oversized SVG (the old bug). */
      inner = '<svg width="' + bb.w + '" height="' + bb.h + '" style="display:block;overflow:visible">'
        + '<line x1="' + (a[0] - bb.minX) + '" y1="' + (a[1] - bb.minY)
        + '" x2="' + (z[0] - bb.minX) + '" y2="' + (z[1] - bb.minY)
        + '" stroke="' + escH(cssColor(p.Stroke) || "#1b1b1b")
        + '" stroke-width="' + tw + '" stroke-linecap="round"/></svg>';
    } else if (node.type === "Polygon") {
      const pairs = String(p.Points || "").trim().split(/\s+/).filter(Boolean).map(parsePoint);
      const pts = pairs.length ? pairs : [[80, 0], [80, 40], [0, 40]];
      const tw = num(p.StrokeThickness, 2);
      const bb = svgBounds(pts, tw + 2);
      const local = pts.map(function (pt) { return (pt[0] - bb.minX) + "," + (pt[1] - bb.minY); }).join(" ");
      const fill = cssColor(p.Fill) || (p.Stroke ? "none" : "#9aa7b8");
      inner = '<svg width="' + bb.w + '" height="' + bb.h + '" style="display:block;overflow:visible">'
        + '<polygon points="' + escH(local) + '" fill="' + escH(fill) + '"'
        + (p.Stroke ? ' stroke="' + escH(cssColor(p.Stroke)) + '" stroke-width="' + tw + '"' : "")
        + "/></svg>" + chips(node, ["Fill"]);
    } else if (node.type === "Path") {
      const tw = num(p.StrokeThickness, 1);
      const fill = cssColor(p.Fill) || "none";
      const stroke = cssColor(p.Stroke) || (fill === "none" ? "#1b1b1b" : "none");
      inner = '<svg width="140" height="80" style="overflow:visible"><path d="' + escH(p.Data || "")
        + '" fill="' + escH(fill) + '" stroke="' + escH(stroke) + '" stroke-width="' + tw + '"/></svg>'
        + chips(node, ["Fill"]);
    } else {
      inner = escH(node.type) + chips(node, []);
    }

    const isSel = !!(selId && node.id === selId);
    const onCanvas = parent && parent.type === "Canvas";
    const locked = !!node.locked;
    let cls = "pv pv-" + node.type + (isSel ? " sel" : "") + (locked ? " locked" : "");
    if (onCanvas) cls += " pv-oncanvas";
    /* resize grips + a center move handle appear on the selected element — UNLESS it
       is locked, in which case only the lock toggle shows so it can't be moved by
       accident. The lock toggle is always offered on a selected non-root element. */
    let grips = "";
    if (isSel) {
      if (!locked) {
        if (canResize(node)) grips += gripsHTML();
        grips += '<span class="dsg-move" data-grip="move" title="drag to move (sets Margin)">'
          + '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">'
          + '<path fill="currentColor" d="M8 0 L5.5 2.5 H7 V7 H2.5 V5.5 L0 8 L2.5 10.5 V9 H7 V13.5 H5.5 L8 16 '
          + 'L10.5 13.5 H9 V9 H13.5 V10.5 L16 8 L13.5 5.5 V7 H9 V2.5 H10.5 Z"/></svg></span>';
      }
      grips += '<span class="dsg-lock' + (locked ? " on" : "") + '" data-lock="1"'
        + ' onclick="DSG.toggleLock(\'' + escH(node.id) + '\')"'
        + ' title="' + (locked ? "Locked — click to unlock (no accidental move/resize)" : "Lock position &amp; size so it can't be moved by accident") + '">'
        + (locked ? "🔒" : "🔓") + "</span>";
    }
    return '<div class="' + cls + '" data-id="' + escH(node.id) + '" draggable="' + (locked ? "false" : "true") + '"'
      + (style ? ' style="' + escH(style) + '"' : "") + ">" + inner + grips + "</div>";
  }

  function previewHTML(t, selId) {
    if (!t || !t.children || !t.children.length) {
      return '<div class="dsg-empty">Drag a layout container here<br>'
        + "<span>StackPanel · Grid · DockPanel · Canvas …</span></div>";
    }
    return pvNode(t.children[0], selId || null, t, "");
  }

  /* ---------------- page shell ---------------- */
  function winTitle() {
    return (tree.props.Title || "Exam App") + " · "
      + num(tree.props.Width, 600) + "×" + num(tree.props.Height, 400);
  }

  function slotOptions() {
    const slots = loadSlots();
    let h = '<option value="">— designs —</option>';
    Object.keys(slots).sort().forEach(function (name) {
      h += '<option value="' + escH(name) + '"' + (name === currentSlot ? " selected" : "") + ">"
        + escH(name) + "</option>";
    });
    return h;
  }

  function toolbarHTML() {
    return '<div class="dsg-toolbar">'
      + '<button class="dsg-btn dsg-icbtn" id="dsg-undo" title="Undo (Ctrl+Z)" onclick="DSG.undo()" disabled>↶ Undo</button>'
      + '<button class="dsg-btn dsg-icbtn" id="dsg-redo" title="Redo (Ctrl+Y)" onclick="DSG.redo()" disabled>↷ Redo</button>'
      + '<button class="dsg-btn" title="Duplicate selection (Ctrl+D)" onclick="DSG.duplicate()">⧉ Duplicate</button>'
      + '<span class="dsg-tb-sep"></span>'
      + '<select class="dsg-select" id="dsg-slot" title="saved designs">' + slotOptions() + "</select>"
      + '<button class="dsg-btn" title="open the design picked in the dropdown" onclick="DSG.loadSlot()">Load</button>'
      + '<button class="dsg-btn" title="save the current design under a name" onclick="DSG.saveAs()">Save as…</button>'
      + '<button class="dsg-btn" title="delete the design picked in the dropdown" onclick="DSG.deleteSlot()">Delete</button>'
      + '<button class="dsg-btn" title="start a new, empty window" onclick="DSG.newDesign()">New</button>'
      + '<button class="dsg-btn" title="restore the built-in example designs" onclick="DSG.seedExamples()">↻ Reload examples</button>'
      + '<span class="dsg-tb-sep"></span>'
      + '<button class="dsg-btn" title="download this design as JSON" onclick="DSG.exportDesigns()">⭳ Export</button>'
      + '<button class="dsg-btn" title="import designs from a JSON file" onclick="DSG.importDesigns()">⭱ Import</button>'
      + '<input type="file" id="dsg-import-file" accept="application/json,.json" style="display:none" onchange="DSG.onImportFile(this)">'
      + '<span class="dsg-tb-sep"></span>'
      + sizeLockHTML()
      + exportProjectHTML()
      + submissionHTML()
      + '<span class="dsg-tb-sep"></span>'
      + referenceImageHTML()
      + '<span class="dsg-msg" id="dsg-msg"></span>'
      + "</div>";
  }

  /* the running ZIP/scaffold core (spec 13). Read-only; may be absent if the
     script tag did not load (file:// load-order) — every export path checks this. */
  function projzip() {
    return (typeof global !== "undefined" && global.PROJZIP) ? global.PROJZIP : null;
  }
  /* sensible default project name: the window Title, sanitized to a legal C#
     assembly/namespace by the core (falls back to "ExamApp"). */
  function defaultProjectName() {
    const pz = projzip();
    const raw = (tree && tree.props && tree.props.Title) || "ExamApp";
    return pz ? pz.sanitizeName(raw, "ExamApp") : String(raw).replace(/[^A-Za-z0-9_.]+/g, "_") || "ExamApp";
  }
  /* the last default we wrote into the name input — lets us track the window Title
     without clobbering a name the user typed by hand */
  let lastProjDefault = null;
  /* keep the project-name input following the window Title default UNLESS the user
     has typed their own value (then we leave it alone) */
  function syncProjectName() {
    const el = document.getElementById("dsg-proj-name");
    if (!el) return;
    const next = defaultProjectName();
    const cur = (el.value || "").trim();
    if (cur === "" || cur === lastProjDefault) el.value = next;
    lastProjDefault = next;
  }

  /* "Size locked" toolbar checkbox (default ON): locks the exported/submitted
     Window to its design size (CanResize="False") so the running app keeps the
     exact layout you see here. Unchecking it lets the window be resized. */
  function sizeLockHTML() {
    const locked = tree.props.SizeLocked !== false;
    return '<label class="dsg-sizelock" title="Lock the window to its design size so the exported app can\'t be resized (keeps the running layout matching this preview). Uncheck to allow resizing.">'
      + '<input type="checkbox"' + (locked ? " checked" : "") + ' onchange="DSG.toggleSizeLock(this.checked)">'
      + " Size&nbsp;locked</label>";
  }

  /* "Export project (.zip)" toolbar control: a name input + the success-styled
     button. The whole group is hidden (display:none) when PROJZIP is unavailable so
     the tool never offers an export it cannot fulfil and never crashes on click. */
  function exportProjectHTML() {
    const present = !!projzip();
    return '<span class="dsg-exportproj-wrap" id="dsg-exportproj-wrap"'
      + (present ? "" : ' style="display:none"') + ">"
      + '<input class="dsg-in dsg-proj-name" id="dsg-proj-name" value="' + escH(defaultProjectName())
      + '" title="project / assembly name" placeholder="ExamApp">'
      + '<button class="dsg-btn dsg-btn-export" title="download a complete runnable .NET project (.zip)"'
      + ' onclick="DSG.exportProject()">⬇ Export project (.zip)</button>'
      + "</span>";
  }

  /* "Download submission files" control (spec 16): the flat Problem_2 pair with the
     professor's exact names. Independent of PROJZIP (plain blob downloads, no zip),
     so it is ALWAYS offered. A hint line below restates the flat-folder rule. */
  function submissionHTML() {
    return '<span class="dsg-submit-wrap" id="dsg-submit-wrap">'
      + '<button class="dsg-btn dsg-btn-submit" id="dsg-submit-btn"'
      + ' title="download Problem_2_MainWindow.axaml + Problem_2_MainWindowViewModel.cs"'
      + ' onclick="DSG.exportSubmission()">⇩ Download submission files</button>'
      + '<span class="dsg-submit-hint">submit flat: 6 files, no bin/obj, no subfolders</span>'
      + "</span>";
  }

  /* reference-image toolbar control + popover (file input, opacity, toggle, remove) */
  function referenceImageHTML() {
    return '<span class="dsg-ref-wrap">'
      + '<button class="dsg-btn" title="overlay the task\'s sketch under the stage" onclick="DSG.toggleReferencePopover()">▦ Reference image</button>'
      + '<input type="file" id="dsg-ref-file" accept="image/*" style="display:none" onchange="DSG.onReferenceFile(this)">'
      + '<div class="dsg-ref-pop" id="dsg-ref-pop"><div id="dsg-ref-controls">' + refControlsHTML() + "</div></div>"
      + "</span>";
  }

  /* inner controls, re-rendered after each ref-image state change */
  function refControlsHTML() {
    const has = !!refImage.dataUrl;
    let h = "";
    h += '<button class="dsg-btn dsg-ref-load" onclick="DSG.pickReferenceImage()">'
      + (has ? "Replace image…" : "Load image…") + "</button>";
    if (has) {
      h += '<label class="dsg-ref-toggle"><input type="checkbox"' + (refImage.visible ? " checked" : "")
        + ' onchange="DSG.toggleReferenceImage()"> show overlay</label>';
      h += '<div class="dsg-ref-oprow"><span class="dsg-ref-oplab">opacity</span>'
        + '<input type="range" min="10" max="80" value="' + refImage.opacity + '"'
        + ' oninput="DSG.setReferenceOpacity(this.value)" class="dsg-ref-slider">'
        + '<span class="dsg-ref-opval" id="dsg-ref-oplabel">' + refImage.opacity + '%</span></div>';
      h += '<button class="dsg-btn dsg-ref-remove" onclick="DSG.removeReferenceImage()">Remove</button>';
    }
    h += '<label class="dsg-ref-toggle dsg-ref-exp"><input type="checkbox"' + (refImage.includeInExport ? " checked" : "")
      + ' onchange="DSG.setExportRefImage(this.checked)"> include reference image in Export JSON</label>';
    return h;
  }

  function paletteHTML() {
    let h = '<aside class="dsg-palette">';
    CORE.PALETTE_GROUPS.forEach(function (g) {
      h += '<div class="dsg-pal-label">' + escH(g.name)
        + (g.hint ? '<span class="dsg-pal-label-hint">' + escH(g.hint) + "</span>" : "")
        + '</div><div class="dsg-pal-grid">';
      g.types.forEach(function (t) {
        const def = CORE.CATALOG[t] || {};
        const plain = (CORE.PLAIN && CORE.PLAIN[t]) || "";
        const tip = plain ? t + " — " + plain + ". Drag onto the window." : "drag onto the window";
        h += '<div class="dsg-tool" draggable="true" data-type="' + escH(t) + '" title="' + escH(tip) + '">'
          + '<span class="dsg-tool-ic">' + escH(def.icon || "▭") + "</span>"
          + '<span class="dsg-tool-txt"><span class="dsg-tool-name">' + escH(t) + "</span>"
          + (plain ? '<span class="dsg-tool-sub">' + escH(plain) + "</span>" : "")
          + "</span></div>";
      });
      h += "</div>";
    });
    h += '<div class="dsg-pal-label">Colors</div><div class="dsg-colors">';
    CORE.COLORS.forEach(function (c) {
      h += '<span class="dsg-swatch' + (c === "Transparent" ? " tr" : "") + '" draggable="true" data-color="'
        + escH(c) + '" title="' + escH(c) + '"'
        + (c === "Transparent" ? "" : ' style="background:' + escH(c) + '"') + "></span>";
    });
    h += "</div>";
    h += '<div class="dsg-pal-hint">Drop a swatch on an element to set its Background (Fill on shapes).</div>';
    h += "</aside>";
    return h;
  }

  function crumbsHTML() {
    const node = CORE.findNode(tree, selectedId) || tree;
    const path = [];
    let cur = node;
    while (cur) {
      path.unshift(cur);
      cur = cur.id === tree.id ? null : CORE.findParent(tree, cur.id);
    }
    return path.map(function (n) {
      return '<span class="dsg-crumb-chip' + (n.id === node.id ? " on" : "")
        + '" onclick="DSG.select(\'' + escH(n.id) + '\')">' + escH(n.type) + "</span>";
    }).join('<span class="dsg-crumb-sep">›</span>');
  }

  function stageHTML() {
    return '<div class="dsg-stage">'
      + '<div class="dsg-window" id="dsg-window" style="width:' + num(tree.props.Width, 600) + 'px">'
      + '<div class="dsg-win-chrome" title="click to edit Window properties" onclick="DSG.select(\'' + escH(tree.id) + '\')">'
      + '<span class="pdot"></span><span class="pdot"></span><span class="pdot"></span>'
      + '<span class="dsg-win-title" id="dsg-win-title">' + escH(winTitle()) + "</span></div>"
      + '<div class="dsg-win-stack">'
      /* reference-image overlay sits UNDER the canvas content and never gets pointer events */
      + '<div class="dsg-ref-layer" id="dsg-ref-layer"></div>'
      + '<div id="dsg-canvas" class="dsg-win-body" style="min-height:' + num(tree.props.Height, 400) + 'px">'
      + previewHTML(tree, selectedId) + "</div>"
      + "</div>"
      + '<div class="dsg-coordbadge" id="dsg-coordbadge"></div>'
      + "</div>"
      + '<div class="dsg-crumbs" id="dsg-crumbs">' + crumbsHTML() + "</div>"
      + "</div>";
  }

  /* paint the reference-image overlay layer from the session refImage state */
  function applyReferenceImage() {
    const layer = document.getElementById("dsg-ref-layer");
    if (!layer) return;
    if (refImage.dataUrl && refImage.visible) {
      layer.style.backgroundImage = 'url("' + refImage.dataUrl + '")';
      layer.style.opacity = String(refImage.opacity / 100);
      layer.classList.add("on");
    } else {
      layer.style.backgroundImage = "";
      layer.classList.remove("on");
    }
  }
  /* re-render just the reference popover's inner controls */
  function renderRefControls() {
    const host = document.getElementById("dsg-ref-controls");
    if (host) host.innerHTML = refControlsHTML();
  }

  /* live coordinate/size badge near the cursor during move/resize */
  function showBadge(text, clientX, clientY) {
    const b = document.getElementById("dsg-coordbadge");
    const stage = b && b.parentNode;
    if (!b || !stage) return;
    const sr = stage.getBoundingClientRect();
    b.textContent = text;
    b.style.left = (clientX - sr.left + 14) + "px";
    b.style.top = (clientY - sr.top + 14) + "px";
    b.classList.add("show");
  }
  function hideBadge() {
    const b = document.getElementById("dsg-coordbadge");
    if (b) b.classList.remove("show");
  }

  /* ---------------- inspector ---------------- */
  function suggestBind(name, node) {
    const m = { Command: "SaveCommand", ItemsSource: "Items", SelectedItem: "SelectedItem",
                SelectedItems: "SelectedItems",
                Text: "Name", Content: "Label", Value: "Value", IsChecked: "IsOn", Fill: "FillColor" };
    if (name === "Command" && node && node.props && node.props.Content) {
      const word = String(node.props.Content).replace(/[^A-Za-z0-9]/g, "");
      if (word) return word.charAt(0).toUpperCase() + word.slice(1) + "Command";
    }
    return m[name] || name;
  }

  /* per-command "recipe" dropdown: choose the generated method body. Persisted in
     node.recipes[propName], undo-aware (a prop mutation), exported with the design. */
  function recipeRow(node, propName) {
    const cur = (node.recipes && node.recipes[propName]) || "none";
    const labels = CORE.RECIPE_LABELS || {};
    let opts = "";
    (CORE.RECIPE_IDS || ["none"]).forEach(function (id) {
      opts += '<option value="' + escH(id) + '"' + (id === cur ? " selected" : "") + ">"
        + escH(labels[id] || id) + "</option>";
    });
    return '<div class="dsg-row dsg-recipe-row">'
      + '<label title="generated method body for this command">recipe</label>'
      + '<select class="dsg-in dsg-recipe-sel" onchange="DSG.setRecipe(\'' + escH(propName) + '\', this.value)">'
      + opts + "</select></div>";
  }

  /* Margin/Padding edited as four sides. Parse an Avalonia thickness string
     ("u" | "h,v" | "l,t,r,b") into [Left, Top, Right, Bottom] strings. */
  function parseThickness(str) {
    const s = String(str == null ? "" : str).trim();
    if (!s) return ["", "", "", ""];
    const p = s.split(",").map(function (x) { return x.trim(); });
    if (p.length === 1) return [p[0], p[0], p[0], p[0]];
    if (p.length === 2) return [p[0], p[1], p[0], p[1]];
    return [p[0] || "0", p[1] || "0", p[2] || "0", p[3] || "0"];
  }
  /* compose [L,T,R,B] back to the shortest equivalent string; all-zero -> "" (no margin) */
  function composeThickness(arr) {
    const n = arr.map(function (x) { const v = String(x == null ? "" : x).trim(); return v === "" ? "0" : v; });
    if (n.every(function (v) { return v === "0"; })) return "";
    if (n[0] === n[1] && n[1] === n[2] && n[2] === n[3]) return n[0];
    if (n[0] === n[2] && n[1] === n[3]) return n[0] + "," + n[1];
    return n.join(",");
  }

  function propRow(node, p, defaults) {
    defaults = defaults || {};
    const name = p.name;
    const bound = Object.prototype.hasOwnProperty.call(node.bindings || {}, name);
    const bindOnly = p.kind === "none";
    let h = '<div class="dsg-row">';
    h += "<label>" + escH(name) + "</label>";
    if (p.bindable) {
      h += '<button class="dsg-zap' + ((bound || bindOnly) ? " on" : "")
        + '" title="bind to a ViewModel member"'
        + (bindOnly ? " disabled" : ' onclick="DSG.toggleBind(\'' + escH(name) + '\')"') + ">⚡</button>";
    }
    if (bindOnly || bound) {
      const v = (node.bindings || {})[name] || "";
      h += '<input class="dsg-in dsg-bind-in" placeholder="' + escH(suggestBind(name, node))
        + '" value="' + escH(v) + '"'
        + ' oninput="DSG.setBind(\'' + escH(name) + '\', this.value)"'
        + ' onchange="DSG.commitBind(\'' + escH(name) + '\', this.value)">';
      h += "</div>";
      /* command bindings gain a recipe dropdown selecting the generated method body */
      if (p.vmType === "command" && v) h += recipeRow(node, name);
      return h;
    }
    const cur = node.props[name] != null ? node.props[name] : "";
    /* Margin / Padding: four labelled side boxes (Left / Top / Right / Bottom).
       Editing the Left or Right box is how you nudge an element sideways inside a
       StackPanel; Top / Bottom moves it up/down. */
    if (p.kind === "thickness" || name === "Margin" || name === "Padding") {
      const t = parseThickness(cur);
      const sides = ["Left", "Top", "Right", "Bottom"];
      let cells = "";
      sides.forEach(function (s, idx) {
        cells += '<input class="dsg-in dsg-th" type="number" step="any" title="' + s
          + '" placeholder="' + s.charAt(0) + '" value="' + escH(t[idx]) + '"'
          + ' oninput="DSG.setThicknessSide(\'' + escH(name) + '\', ' + idx + ', this.value)">';
      });
      h += '<span class="dsg-thickness" title="Left · Top · Right · Bottom">' + cells + "</span>";
      h += "</div>";
      return h;
    }
    if (p.kind === "number") {
      h += '<input class="dsg-in" type="number" step="any" value="' + escH(cur) + '"'
        + ' oninput="DSG.setProp(\'' + escH(name) + '\', this.value, \'number\')">';
    } else if (p.kind === "bool") {
      const on = cur === true || (cur === "" && defaults[name] === true);
      h += '<input class="dsg-check" type="checkbox"' + (on ? " checked" : "")
        + ' onchange="DSG.setProp(\'' + escH(name) + '\', this.checked, \'bool\')">';
    } else if (p.kind === "select") {
      const sel = cur !== "" ? cur : (defaults[name] != null ? defaults[name] : "");
      let opts = "";
      if (defaults[name] == null) {
        opts += '<option value=""' + (sel === "" ? " selected" : "") + ">(unset)</option>";
      }
      (p.options || []).forEach(function (o) {
        opts += '<option value="' + escH(o) + '"' + (String(sel) === o ? " selected" : "") + ">" + escH(o) + "</option>";
      });
      h += '<select class="dsg-in" onchange="DSG.setProp(\'' + escH(name) + '\', this.value, \'select\')">' + opts + "</select>";
    } else if (p.kind === "color") {
      h += '<input class="dsg-in dsg-color-text" placeholder="#RRGGBB" value="' + escH(cur) + '"'
        + ' oninput="DSG.setColorText(\'' + escH(name) + '\', this)">';
      h += '<input class="dsg-color-pick" type="color" value="' + escH(hexForPicker(cur))
        + '" title="pick a color" oninput="DSG.setColor(\'' + escH(name) + '\', this.value)">';
      h += '<div class="dsg-colorrow">' + CORE.COLORS.map(function (c) {
        return '<span class="dsg-mini-sw' + (c === "Transparent" ? " tr" : "") + (String(cur) === c ? " on" : "")
          + '" title="' + escH(c) + '"'
          + (c === "Transparent" ? "" : ' style="background:' + escH(c) + '"')
          + ' onclick="DSG.setColor(\'' + escH(name) + '\', \'' + escH(c) + '\')"></span>';
      }).join("") + "</div>";
    } else {
      /* text — Grid definitions get regex validation */
      const isDefs = node.type === "Grid" && (name === "RowDefinitions" || name === "ColumnDefinitions");
      if (isDefs) {
        h += '<input class="dsg-in" placeholder="Auto,*,2*,200" value="' + escH(cur) + '"'
          + ' oninput="DSG.setDefs(\'' + escH(name) + '\', this)">';
      } else {
        h += '<input class="dsg-in" placeholder="' + escH(defaults[name] != null ? defaults[name] : "")
          + '" value="' + escH(cur) + '"'
          + ' oninput="DSG.setProp(\'' + escH(name) + '\', this.value, \'text\')">';
      }
    }
    h += "</div>";
    return h;
  }

  const FIELD_TYPES = ["string", "double", "int", "bool", "IBrush"];

  /* items-mode section for ListBox / ComboBox / ItemsControl: choose strings vs a
     typed model, edit the model class name + name:type field rows */
  function itemsModeHTML(node) {
    const m = node.model || {};
    const typed = m.mode === "typed";
    let h = '<div class="dsg-insp-sec">Items</div>';
    h += '<div class="dsg-row"><label>Mode</label>'
      + '<select class="dsg-in" onchange="DSG.setItemsMode(this.value)">'
      + '<option value="strings"' + (typed ? "" : " selected") + ">strings</option>"
      + '<option value="typed"' + (typed ? " selected" : "") + ">typed model</option>"
      + "</select></div>";
    if (!typed) {
      h += '<div class="dsg-insp-note">String items — ItemsSource binds an '
        + "ObservableCollection&lt;string&gt;.</div>";
      return h;
    }
    h += '<div class="dsg-row"><label>Class</label>'
      + '<input class="dsg-in" value="' + escH(m.className || "Item") + '"'
      + ' oninput="DSG.setModelClass(this.value)" placeholder="Item"></div>';
    /* G6: nested-in-VM model -> vm:Outer+Inner compiled-binding DataType */
    const nested = !!m.nested;
    h += '<div class="dsg-row dsg-row-check"><label>Nested in VM</label>'
      + '<input class="dsg-check" type="checkbox"' + (nested ? " checked" : "")
      + ' onchange="DSG.setNested(this.checked)" title="class declared inside the ViewModel '
      + '(emits the vm:Outer+Inner DataType)"></div>';
    if (nested) {
      h += '<div class="dsg-insp-note">DataType qualified as <code>vm:'
        + escH(m.outerClass || "MainWindowViewModel") + "+" + escH(m.className || "Item")
        + "</code>. Declare the class inside the ViewModel.</div>";
    }
    /* G2: render each item as one shape instead of the debug field list */
    const shape = m.templateShape || "";
    h += '<div class="dsg-row"><label>Item shape</label>'
      + '<select class="dsg-in" onchange="DSG.setTemplateShape(this.value)">'
      + '<option value=""' + (shape ? "" : " selected") + ">list (debug)</option>"
      + '<option value="Ellipse"' + (shape === "Ellipse" ? " selected" : "") + ">Ellipse</option>"
      + '<option value="Rectangle"' + (shape === "Rectangle" ? " selected" : "") + ">Rectangle</option>"
      + "</select></div>";
    if (node.type === "ItemsControl") {
      const on = !!m.canvasItems;
      h += '<div class="dsg-row dsg-row-check"><label>Canvas items panel</label>'
        + '<input class="dsg-check" type="checkbox"' + (on ? " checked" : "")
        + ' onchange="DSG.setCanvasItems(this.checked)" title="free position (Summer 2025 idiom)"></div>'
        + '<div class="dsg-insp-note">Emits an ItemsPanelTemplate Canvas + a '
        + "ContentPresenter style binding Canvas.Left/Top to X/Y. Set the ItemsControl "
        + "Width/Height to size that inner Canvas and the spawn clamps.</div>";
    }
    h += '<div class="dsg-insp-sub">Fields</div>';
    const fields = m.fields || [];
    fields.forEach(function (f, i) {
      h += '<div class="dsg-field-row">'
        + '<input class="dsg-in dsg-field-name" value="' + escH(f.name || "")
        + '" placeholder="Name" oninput="DSG.setFieldName(' + i + ', this.value)">'
        + '<select class="dsg-in dsg-field-type" onchange="DSG.setFieldType(' + i + ', this.value)">'
        + FIELD_TYPES.map(function (t) {
            return '<option value="' + t + '"' + (f.type === t ? " selected" : "") + ">" + t + "</option>";
          }).join("")
        + "</select>"
        + '<button class="dsg-mini dsg-del" title="remove field" onclick="DSG.removeField(' + i + ')">✕</button>'
        + "</div>";
    });
    h += '<button class="dsg-btn dsg-addfield" onclick="DSG.addField()">+ field</button>';
    return h;
  }

  function inspectorHTML() {
    const node = CORE.findNode(tree, selectedId) || tree;
    const def = CORE.CATALOG[node.type] || { props: [] };
    const isRoot = node.id === tree.id;
    let h = '<div class="dsg-insp-head">'
      + '<span class="dsg-insp-type">' + escH(node.type) + "</span>"
      + '<span class="dsg-insp-id">' + escH(node.id) + "</span>";
    if (!isRoot) {
      h += '<span class="dsg-insp-actions">'
        + '<button class="dsg-mini" title="duplicate (Ctrl+D)" onclick="DSG.duplicate()">⧉</button>'
        + '<button class="dsg-mini" title="move up within parent" onclick="DSG.moveSel(-1)">▲</button>'
        + '<button class="dsg-mini" title="move down within parent" onclick="DSG.moveSel(1)">▼</button>'
        + '<button class="dsg-mini dsg-del" title="delete (Del)" onclick="DSG.delSel()">✕</button>'
        + "</span>";
    }
    h += "</div>";
    (def.props || []).forEach(function (p) { h += propRow(node, p, def.defaultProps || {}); });
    /* rotation applies to any control (RenderTransform), so it lives outside the
       per-type prop list — degrees, positive = clockwise, around the centre. */
    if (!isRoot) h += propRow(node, { name: "Rotation", kind: "number" }, {});
    /* honesty hint: in a StackPanel the main-axis alignment is inert (Avalonia
       sizes each child to its own extent there). Show it exactly when the user has
       set that inert axis, and point them at the tool that DOES move it. */
    if (!isRoot) {
      const par0 = CORE.findParent(tree, node.id);
      const inert = par0 && CORE.inertAlignmentAxis ? CORE.inertAlignmentAxis(par0.type, (par0.props || {}).Orientation) : null;
      if (inert && node.props[inert] && node.props[inert] !== "Stretch") {
        const horiz = inert === "HorizontalAlignment";
        h += '<div class="dsg-insp-note">' + escH(inert) + " has no effect inside a "
          + (horiz ? "horizontal" : "vertical") + " StackPanel — the panel gives each child its own "
          + (horiz ? "width" : "height") + ", so there is no room to align within (this matches Avalonia). To move it "
          + (horiz ? "horizontally" : "vertically") + ", set the " + (horiz ? "Left" : "Top")
          + " Margin or drag the center move handle; " + (horiz ? "VerticalAlignment" : "HorizontalAlignment")
          + " still aligns the cross axis.</div>";
      }
    }
    /* G8: root namespace stamped into xmlns:vm / x:Class / `namespace ...`. Blank =
       ExamApp (default; keeps the .zip export's namespace-rewrite path working). */
    if (isRoot) {
      h += '<div class="dsg-insp-sec">Project</div>';
      h += '<div class="dsg-row"><label>Namespace</label>'
        + '<input class="dsg-in" value="' + escH(tree.projectNamespace || "")
        + '" placeholder="ExamApp" title="root namespace for xmlns:vm / x:Class"'
        + ' oninput="DSG.setProjectNamespace(this.value)"></div>'
        + '<div class="dsg-insp-note">Default ExamApp. Set this to match the target '
        + "project so the pasted code lands in the right namespace.</div>";
    }
    if (def.itemsHost) h += itemsModeHTML(node);
    if (!isRoot) {
      const parent = CORE.findParent(tree, node.id);
      const pdef = parent && CORE.CATALOG[parent.type];
      if (pdef && pdef.attachedProps) {
        h += '<div class="dsg-insp-sec">Attached · ' + escH(parent.type) + "</div>";
        pdef.attachedProps.forEach(function (p) { h += propRow(node, p, {}); });
      }
    }
    return h;
  }

  /* ---------------- timer panel (output column header card) ---------------- */
  function timerPanelHTML() {
    const t = tree.timer || {};
    const on = !!t.enabled;
    const mech = t.mechanism || "dispatcher";
    const action = t.action || "recolor-items";
    const interval = t.intervalMs != null ? t.intervalMs : 2000;
    let h = '<div class="dsg-timer-card' + (on ? " on" : "") + '">';
    h += '<label class="dsg-timer-head"><input type="checkbox"' + (on ? " checked" : "")
      + ' onchange="DSG.toggleTimer()"> <span class="dsg-timer-title">Timer</span>'
      + '<span class="dsg-timer-note">DispatcherTimer / Task loop, wired to timer-* command recipes</span></label>';
    if (on) {
      h += '<div class="dsg-timer-body">';
      h += '<label class="dsg-timer-field"><span>interval ms</span>'
        + '<input class="dsg-in" type="number" min="1" step="1" value="' + escH(interval) + '"'
        + ' oninput="DSG.setTimerField(\'intervalMs\', this.value)"></label>';
      h += '<label class="dsg-timer-field"><span>mechanism</span>'
        + '<select class="dsg-in" onchange="DSG.setTimerField(\'mechanism\', this.value)">'
        + (CORE.TIMER_MECHANISMS || ["dispatcher", "task"]).map(function (m) {
            const lab = m === "dispatcher" ? "DispatcherTimer" : "Task.Delay + CTS";
            return '<option value="' + m + '"' + (m === mech ? " selected" : "") + ">" + lab + "</option>";
          }).join("") + "</select></label>";
      h += '<label class="dsg-timer-field"><span>tick action</span>'
        + '<select class="dsg-in" onchange="DSG.setTimerField(\'action\', this.value)">'
        + (CORE.TIMER_ACTIONS || ["recolor-items", "reposition-items", "increment-counter", "custom"]).map(function (a) {
            return '<option value="' + a + '"' + (a === action ? " selected" : "") + ">" + escH(a) + "</option>";
          }).join("") + "</select></label>";
      h += "</div>";
    }
    h += "</div>";
    return h;
  }

  /* ---------------- output panes ---------------- */
  function outputHTML() {
    let gen;
    try { gen = CORE.generate(tree); }
    catch (err) { return '<p class="dsg-hint">codegen error: ' + escH(err && err.message) + "</p>"; }
    dsgCodes = [gen.axaml, gen.viewModel];
    if (gen.model) dsgCodes.push(gen.model);
    const hi = function (code, lang) {
      return (typeof highlight === "function") ? highlight(code, lang) : escH(code);
    };
    const pane = function (title, lang, code, idx) {
      return '<div class="codeblock">'
        + '<div class="code-head"><span class="code-lang lang-' + lang + '">' + lang + "</span>"
        + '<span class="code-title">' + escH(title) + "</span>"
        + '<button class="copybtn" onclick="DSG.copy(this,' + idx + ')">copy</button></div>'
        + '<pre class="code">' + hi(code, lang) + "</pre></div>";
    };
    let panes = pane("Views/MainWindow.axaml", "xml", gen.axaml, 0)
      + pane("ViewModels/MainWindowViewModel.cs", "csharp", gen.viewModel, 1);
    if (gen.model) panes += pane("ViewModels/Item.cs", "csharp", gen.model, 2);
    const hint = gen.model
      ? "Paste AXAML into Views/MainWindow.axaml, the ViewModel + the item model into ViewModels/ — code-behind stays untouched."
      : "Paste AXAML into Views/MainWindow.axaml, ViewModel into ViewModels/MainWindowViewModel.cs — code-behind stays untouched.";
    return timerPanelHTML()
      + '<div class="dsg-outgrid' + (gen.model ? " dsg-outgrid-3" : "") + '">'
      + panes
      + "</div>"
      + '<p class="dsg-hint">' + hint + "</p>";
  }

  /* ---------------- render / refresh ---------------- */
  function render() {
    initState();
    dsgCodes = [];
    let h = '<div class="content-inner content-wide">';
    h += '<div class="crumb"><b>VISUAL DESIGNER</b></div>';
    h += '<h1 class="topic-title">Visual Designer</h1>';
    h += '<p class="bp">New to the control names? Each item in the palette shows a plain-English description of what it does — '
      + 'just drag one into the window, click it to select, and change its settings in the panel on the right. '
      + 'Drag a colour swatch onto anything to paint it; press <span class="kbd">Del</span> to remove what you selected. '
      + "The AXAML + ViewModel code below updates as you go — copy and paste them into the Starter Kit.</p>";
    h += toolbarHTML();
    h += '<div class="dsg">';
    h += paletteHTML();
    h += stageHTML();
    h += '<aside class="dsg-inspector"><div id="dsg-insp">' + inspectorHTML() + "</div></aside>";
    h += "</div>";
    h += '<div id="dsg-output">' + outputHTML() + "</div>";
    h += "</div>";
    return h;
  }

  /* repaint only the dynamic regions (canvas, crumbs, output) — keeps palette handlers alive */
  function refreshLight() {
    if (!CORE.findNode(tree, selectedId)) selectedId = tree.id;
    saveCurrent();
    const canvas = document.getElementById("dsg-canvas");
    if (canvas) {
      canvas.innerHTML = previewHTML(tree, selectedId);
      canvas.style.minHeight = num(tree.props.Height, 400) + "px";
    }
    const win = document.getElementById("dsg-window");
    if (win) win.style.width = num(tree.props.Width, 600) + "px";
    const wt = document.getElementById("dsg-win-title");
    if (wt) wt.textContent = winTitle();
    const cr = document.getElementById("dsg-crumbs");
    if (cr) cr.innerHTML = crumbsHTML();
    const out = document.getElementById("dsg-output");
    if (out) out.innerHTML = outputHTML();
    syncProjectName();
    syncUndoButtons();
  }
  function refresh() {
    refreshLight();
    const insp = document.getElementById("dsg-insp");
    if (insp) insp.innerHTML = inspectorHTML();
  }

  function repaintSlots() {
    const sel = document.getElementById("dsg-slot");
    if (sel) { sel.innerHTML = slotOptions(); sel.value = currentSlot; }
  }

  function msg(text) {
    const el = document.getElementById("dsg-msg");
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  /* ---------------- drag & drop ---------------- */
  function clearDrop() {
    if (lastDropEl) { lastDropEl.classList.remove("drop-ok"); lastDropEl = null; }
    document.querySelectorAll(".drop-ok").forEach(function (el) { el.classList.remove("drop-ok"); });
  }

  function onDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) {
      try { e.dataTransfer.dropEffect = dragNodeId ? "move" : "copy"; } catch (x) {}
    }
    const pv = (e.target && e.target.closest) ? e.target.closest(".pv") : null;
    const el = pv || document.getElementById("dsg-canvas");
    if (el && el !== lastDropEl) {
      clearDrop();
      el.classList.add("drop-ok");
      lastDropEl = el;
    }
  }

  /* compute the drop point relative to the Canvas preview element, dividing out any
     CSS scale (transform: scale on the stage) and rounding/clamping to integers */
  function canvasPointFromEvent(hostId, e) {
    const elw = document.getElementById("dsg-canvas");
    if (!elw || e == null || e.clientX == null) return null;
    const hostEl = elw.querySelector('.pv[data-id="' + cssEsc(hostId) + '"]')
      || (elw.firstElementChild && elw.firstElementChild.getAttribute("data-id") === hostId
            ? elw.firstElementChild : null);
    if (!hostEl) return null;
    const rect = hostEl.getBoundingClientRect();
    const scale = rect.width && hostEl.offsetWidth ? (rect.width / hostEl.offsetWidth) : 1;
    const x = (e.clientX - rect.left) / (scale || 1);
    const y = (e.clientY - rect.top) / (scale || 1);
    return { x: x, y: y };
  }
  /* minimal CSS attribute-selector escape for our nXX ids (digits/letters only) */
  function cssEsc(s) { return String(s).replace(/["\\]/g, "\\$&"); }

  /* returns the host node id the new element landed in, or null */
  function dropNew(type, targetId) {
    const node = CORE.createNode(type);
    let host = CORE.findNode(tree, targetId) || tree;
    while (host) {
      if (CORE.addChild(tree, host.id, node)) {
        selectedId = node.id;
        msg(type + " → " + host.type);
        return { nodeId: node.id, hostId: host.id, hostType: host.type };
      }
      host = host.id === tree.id ? null : CORE.findParent(tree, host.id);
    }
    msg("Nothing there can hold a " + type + " (container full or not a container)");
    return null;
  }

  function dropMove(nodeId, targetId) {
    if (!nodeId || nodeId === targetId) return null;
    const target = CORE.findNode(tree, targetId);
    if (!target) return null;
    /* 1) straight into the target container */
    if (CORE.moveNode(tree, nodeId, target.id)) {
      selectedId = nodeId;
      return { nodeId: nodeId, hostId: target.id, hostType: target.type };
    }
    /* 2) reorder: insert before the target within its parent */
    const parent = CORE.findParent(tree, targetId);
    if (parent) {
      const idx = parent.children.findIndex(function (c) { return c.id === targetId; });
      if (CORE.moveNode(tree, nodeId, parent.id, idx)) {
        selectedId = nodeId;
        return { nodeId: nodeId, hostId: parent.id, hostType: parent.type };
      }
      /* 3) climb to the nearest ancestor that accepts it */
      let host = parent.id === tree.id ? null : CORE.findParent(tree, parent.id);
      while (host) {
        if (CORE.moveNode(tree, nodeId, host.id)) {
          selectedId = nodeId;
          return { nodeId: nodeId, hostId: host.id, hostType: host.type };
        }
        host = host.id === tree.id ? null : CORE.findParent(tree, host.id);
      }
    }
    msg("Can't move it there");
    return null;
  }

  function applyColor(targetId, color) {
    const node = CORE.findNode(tree, targetId);
    if (!node) return;
    const def = CORE.CATALOG[node.type] || {};
    let prop = "Background";
    if (def.group === "Shapes") {
      prop = (def.props || []).some(function (p) { return p.name === "Fill"; }) ? "Fill" : "Stroke";
    }
    node.props[prop] = color;
    selectedId = node.id;
    msg(node.type + " " + prop + " = " + color);
  }

  function onDrop(e) {
    e.preventDefault();
    clearDrop();
    const pv = (e.target && e.target.closest) ? e.target.closest(".pv") : null;
    const targetId = pv ? pv.getAttribute("data-id") : tree.id;
    let type = "", color = "", nodeId = "";
    try {
      type = e.dataTransfer.getData("text/dsg-type");
      color = e.dataTransfer.getData("text/dsg-color");
      nodeId = e.dataTransfer.getData("text/dsg-node");
    } catch (x) {}
    color = color || dragColor;
    type = type || dragType;
    nodeId = nodeId || dragNodeId;
    pushUndo();
    if (color) {
      applyColor(targetId, color);
    } else if (type) {
      const res = dropNew(type, targetId);
      placeIfCanvas(res, e);
    } else if (nodeId) {
      const res = dropMove(nodeId, targetId);
      placeIfCanvas(res, e);
    } else {
      undoStack.pop();   // nothing happened — discard the snapshot
    }
    dragType = dragNodeId = dragColor = null;
    refresh();
  }

  /* if a drop landed in a Canvas, place it at the pointer (pixel-accurate) */
  function placeIfCanvas(res, e) {
    if (!res || !res.nodeId) { undoStack.pop(); return; }
    if (res.hostType !== "Canvas") return;
    const pt = canvasPointFromEvent(res.hostId, e);
    if (pt) {
      /* offset by half the element's own size so the cursor lands near its center */
      const el = document.querySelector('#dsg-canvas .pv[data-id="' + cssEsc(res.nodeId) + '"]');
      let ox = 0, oy = 0;
      if (el) { ox = el.offsetWidth / 2; oy = el.offsetHeight / 2; }
      CORE.placeAtCanvasPoint(tree, res.nodeId, pt.x - ox, pt.y - oy);
    }
  }

  /* ---------------- drag-to-move + resize (pointer based) ---------------- */
  function canvasScale(hostEl) {
    const rect = hostEl.getBoundingClientRect();
    return (rect.width && hostEl.offsetWidth) ? (rect.width / hostEl.offsetWidth) : 1;
  }

  /* begin moving a Canvas child: live-update Canvas.Left/Top, Shift = 8px grid */
  function startMove(nodeId, e) {
    const node = CORE.findNode(tree, nodeId);
    const parent = CORE.findParent(tree, nodeId);
    if (!node || !parent || parent.type !== "Canvas") return false;
    if (node.locked) return false;                 // locked: no accidental drags
    const el = document.querySelector('#dsg-canvas .pv[data-id="' + cssEsc(nodeId) + '"]');
    if (!el) return false;
    const cv = document.querySelector('#dsg-canvas .pv[data-id="' + cssEsc(parent.id) + '"]')
      || document.getElementById("dsg-canvas");
    const scale = canvasScale(cv);
    pushUndo(); endCoalesce();
    moveState = {
      nodeId: nodeId, el: el, scale: scale || 1,
      startX: e.clientX, startY: e.clientY,
      origLeft: num(node.props["Canvas.Left"], 0),
      origTop: num(node.props["Canvas.Top"], 0),
      moved: false,
    };
    selectedId = nodeId;
    document.body.classList.add("dsg-grabbing");
    return true;
  }

  /* center-handle move via Margin — works in StackPanel / Grid / etc. (any non-Canvas
     parent): dragging changes the element's Left + Top margin so it slides around the
     panel. Canvas children return false here and fall back to startMove (Canvas.Left/Top). */
  function marginNums(str) {
    return parseThickness(str).map(function (x) { const n = parseFloat(x); return isNaN(n) ? 0 : n; });
  }
  function startMarginMove(nodeId, e) {
    const node = CORE.findNode(tree, nodeId);
    if (!node) return false;
    if (node.locked) return false;                 // locked: no accidental drags
    const parent = CORE.findParent(tree, nodeId);
    if (parent && parent.type === "Canvas") return false;
    const el = document.querySelector('#dsg-canvas .pv[data-id="' + cssEsc(nodeId) + '"]');
    if (!el) return false;
    const scale = canvasScale(document.getElementById("dsg-canvas"));
    const m = marginNums(node.props.Margin);
    pushUndo(); endCoalesce();
    marginMoveState = {
      nodeId: nodeId, el: el, scale: scale || 1,
      startX: e.clientX, startY: e.clientY,
      origL: m[0], origT: m[1], origR: m[2], origB: m[3],
      moved: false,
    };
    selectedId = nodeId;
    document.body.classList.add("dsg-grabbing");
    return true;
  }

  function startResize(nodeId, handle, e) {
    const node = CORE.findNode(tree, nodeId);
    if (!node) return false;
    if (node.locked) return false;                 // locked: no accidental resize
    const el = document.querySelector('#dsg-canvas .pv[data-id="' + cssEsc(nodeId) + '"]');
    if (!el) return false;
    const parent = CORE.findParent(tree, nodeId);
    const onCanvas = parent && parent.type === "Canvas";
    const cv = document.getElementById("dsg-canvas");
    const scale = canvasScale(cv);
    pushUndo(); endCoalesce();
    resizeState = {
      nodeId: nodeId, handle: handle, el: el, scale: scale || 1, onCanvas: onCanvas,
      startX: e.clientX, startY: e.clientY,
      origW: num(node.props.Width, el.offsetWidth),
      origH: num(node.props.Height, el.offsetHeight),
      origLeft: num(node.props["Canvas.Left"], 0),
      origTop: num(node.props["Canvas.Top"], 0),
    };
    selectedId = nodeId;
    return true;
  }

  function snapInt(v, shift) {
    const n = Math.round(v);
    return shift ? Math.round(n / 8) * 8 : n;
  }

  function onPointerMove(e) {
    if (moveState) {
      const dx = (e.clientX - moveState.startX) / moveState.scale;
      const dy = (e.clientY - moveState.startY) / moveState.scale;
      let left = snapInt(moveState.origLeft + dx, e.shiftKey);
      let top = snapInt(moveState.origTop + dy, e.shiftKey);
      left = Math.max(0, left); top = Math.max(0, top);
      moveState.curLeft = left; moveState.curTop = top;
      moveState.moved = moveState.moved || Math.abs(dx) > 1 || Math.abs(dy) > 1;
      moveState.el.style.left = left + "px";
      moveState.el.style.top = top + "px";
      showBadge("x:" + left + " y:" + top, e.clientX, e.clientY);
      e.preventDefault();
      return;
    }
    if (marginMoveState) {
      const s = marginMoveState;
      const dx = (e.clientX - s.startX) / s.scale;
      const dy = (e.clientY - s.startY) / s.scale;
      const L = snapInt(s.origL + dx, e.shiftKey);
      const T = snapInt(s.origT + dy, e.shiftKey);
      s.curL = L; s.curT = T;
      s.moved = s.moved || Math.abs(dx) > 1 || Math.abs(dy) > 1;
      s.el.style.margin = cssThickness(L + "," + T + "," + s.origR + "," + s.origB);
      showBadge("margin  L " + L + " · T " + T, e.clientX, e.clientY);
      e.preventDefault();
      return;
    }
    if (resizeState) {
      const rs = resizeState;
      const dx = (e.clientX - rs.startX) / rs.scale;
      const dy = (e.clientY - rs.startY) / rs.scale;
      const h = rs.handle;
      let w = rs.origW, ht = rs.origH, left = rs.origLeft, top = rs.origTop;
      if (h.indexOf("e") !== -1) w = rs.origW + dx;
      if (h.indexOf("s") !== -1) ht = rs.origH + dy;
      if (h.indexOf("w") !== -1) { w = rs.origW - dx; if (rs.onCanvas) left = rs.origLeft + dx; }
      if (h.indexOf("n") !== -1) { ht = rs.origH - dy; if (rs.onCanvas) top = rs.origTop + dy; }
      w = Math.max(8, snapInt(w, e.shiftKey));
      ht = Math.max(8, snapInt(ht, e.shiftKey));
      rs.curW = w; rs.curH = ht;
      rs.el.style.width = w + "px"; rs.el.style.height = ht + "px";
      if (rs.onCanvas) {
        left = Math.max(0, snapInt(left, e.shiftKey));
        top = Math.max(0, snapInt(top, e.shiftKey));
        rs.curLeft = left; rs.curTop = top;
        rs.el.style.left = left + "px"; rs.el.style.top = top + "px";
      }
      showBadge(w + "×" + ht, e.clientX, e.clientY);
      e.preventDefault();
      return;
    }
  }

  function onPointerUp() {
    document.body.classList.remove("dsg-grabbing");
    hideBadge();
    if (moveState) {
      const node = CORE.findNode(tree, moveState.nodeId);
      if (node && moveState.curLeft != null) {
        node.props["Canvas.Left"] = moveState.curLeft;
        node.props["Canvas.Top"] = moveState.curTop;
      }
      const wasMoved = moveState.moved;
      moveState = null;
      if (wasMoved) refresh(); else { undoStack.pop(); refresh(); }
      return;
    }
    if (marginMoveState) {
      const s = marginMoveState;
      const node = CORE.findNode(tree, s.nodeId);
      if (node && s.curL != null) {
        const composed = composeThickness([String(s.curL), String(s.curT), String(s.origR), String(s.origB)]);
        if (composed === "") delete node.props.Margin; else node.props.Margin = composed;
      }
      const wasMoved = s.moved;
      marginMoveState = null;
      if (wasMoved) refresh(); else { undoStack.pop(); refresh(); }
      return;
    }
    if (resizeState) {
      const rs = resizeState;
      const node = CORE.findNode(tree, rs.nodeId);
      if (node && rs.curW != null) {
        node.props.Width = rs.curW;
        node.props.Height = rs.curH;
        if (rs.onCanvas && rs.curLeft != null) {
          node.props["Canvas.Left"] = rs.curLeft;
          node.props["Canvas.Top"] = rs.curTop;
        }
        resizeState = null;
        refresh();
      } else { resizeState = null; undoStack.pop(); refresh(); }
      return;
    }
  }

  /* mousedown on the stage: grip → resize, Canvas child → move, else let dnd run */
  function onStageMouseDown(e) {
    if (e.button !== 0) return;
    /* the lock toggle handles itself via onclick — don't start a select/move on it */
    if (e.target && e.target.closest && e.target.closest(".dsg-lock")) return;
    /* center move handle → drag via Margin (Canvas children fall back to Canvas.Left/Top) */
    const mover = (e.target && e.target.closest) ? e.target.closest(".dsg-move") : null;
    if (mover) {
      const movePv = mover.closest(".pv");
      const moveId = movePv && movePv.getAttribute("data-id");
      if (moveId && (startMarginMove(moveId, e) || startMove(moveId, e))) {
        e.preventDefault(); e.stopPropagation();
      }
      return;
    }
    const grip = (e.target && e.target.closest) ? e.target.closest(".dsg-grip") : null;
    if (grip) {
      const pv = grip.closest(".pv");
      if (pv && startResize(pv.getAttribute("data-id"), grip.getAttribute("data-grip"), e)) {
        e.preventDefault(); e.stopPropagation();
      }
      return;
    }
    const pv = (e.target && e.target.closest) ? e.target.closest(".pv") : null;
    if (!pv) return;
    const id = pv.getAttribute("data-id");
    const parent = CORE.findParent(tree, id);
    if (parent && parent.type === "Canvas") {
      if (startMove(id, e)) { e.preventDefault(); }
    }
  }

  /* ---------------- keyboard (guarded to the designer route) ---------------- */
  function onKey(e) {
    if (typeof current === "undefined" || current !== "designer") return;
    const t = e.target || {};
    const tag = (t.tagName || "").toUpperCase();
    const inField = (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable);
    const mod = e.ctrlKey || e.metaKey;
    /* undo/redo work even while a field has focus (standard editor behavior) */
    if (mod && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if (mod && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      redo();
      return;
    }
    if (inField) return;
    if (mod && (e.key === "d" || e.key === "D")) {
      e.preventDefault();
      DSG.duplicate();
      return;
    }
    if (e.key === "Delete" && tree && selectedId && selectedId !== tree.id) {
      e.preventDefault();
      DSG.delSel();
    }
  }

  /* ---------------- init: post-insert wiring ---------------- */
  function init() {
    initState();
    document.querySelectorAll(".dsg-tool").forEach(function (el) {
      el.addEventListener("dragstart", function (e) {
        dragType = el.getAttribute("data-type");
        dragNodeId = null; dragColor = null;
        try { e.dataTransfer.setData("text/dsg-type", dragType); e.dataTransfer.effectAllowed = "copy"; } catch (x) {}
      });
      el.addEventListener("dragend", clearDrop);
    });
    document.querySelectorAll(".dsg-swatch").forEach(function (el) {
      el.addEventListener("dragstart", function (e) {
        dragColor = el.getAttribute("data-color");
        dragType = null; dragNodeId = null;
        try { e.dataTransfer.setData("text/dsg-color", dragColor); e.dataTransfer.effectAllowed = "copy"; } catch (x) {}
      });
      el.addEventListener("dragend", clearDrop);
    });
    const canvas = document.getElementById("dsg-canvas");
    if (canvas) {
      canvas.addEventListener("dragstart", function (e) {
        const pv = (e.target && e.target.closest) ? e.target.closest(".pv") : null;
        if (!pv) return;
        /* Canvas children move via mousedown, not HTML5 dnd */
        const parent = CORE.findParent(tree, pv.getAttribute("data-id"));
        if (parent && parent.type === "Canvas") { e.preventDefault(); return; }
        dragNodeId = pv.getAttribute("data-id");
        dragType = null; dragColor = null;
        try { e.dataTransfer.setData("text/dsg-node", dragNodeId); e.dataTransfer.effectAllowed = "move"; } catch (x) {}
        e.stopPropagation();
      });
      canvas.addEventListener("dragover", onDragOver);
      canvas.addEventListener("dragleave", function (e) {
        if (!canvas.contains(e.relatedTarget)) clearDrop();
      });
      canvas.addEventListener("drop", onDrop);
      canvas.addEventListener("dragend", clearDrop);
      canvas.addEventListener("mousedown", onStageMouseDown);
      canvas.addEventListener("click", function (e) {
        if (e.target && e.target.closest && e.target.closest(".dsg-grip")) return;
        const pv = (e.target && e.target.closest) ? e.target.closest(".pv") : null;
        DSG.select(pv ? pv.getAttribute("data-id") : tree.id);
      });
    }
    if (!keysBound) {
      keysBound = true;
      document.addEventListener("keydown", onKey);
      document.addEventListener("mousemove", onPointerMove);
      document.addEventListener("mouseup", onPointerUp);
    }
    /* baseline the project-name default to what the freshly rendered toolbar shows,
       so later Title edits keep the field in sync unless the user overrides it */
    lastProjDefault = defaultProjectName();
    /* hide the export-project group if PROJZIP failed to load (graceful fallback) */
    const epWrap = document.getElementById("dsg-exportproj-wrap");
    if (epWrap) epWrap.style.display = projzip() ? "" : "none";
    /* re-paint the reference overlay (its layer is rebuilt on every full render) */
    applyReferenceImage();
  }

  /* download one or more text files via blob anchors (file:// safe). Each file is
     {name, text}; we trigger a separate anchor click per file. The professor's
     submission wants two separate downloads, which this does directly. */
  function downloadTextFiles(files) {
    (files || []).forEach(function (f) {
      const blob = new Blob([f.text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (x) {} }, 1000);
    });
  }

  /* ---------------- handlers (window.DSG) ---------------- */
  const DSG = {
    select: function (id) {
      selectedId = id;
      refresh();
    },

    setProp: function (name, value, kind) {
      const node = CORE.findNode(tree, selectedId);
      if (!node) return;
      pushUndoCoalesced(selectedId + "|prop|" + name);
      if (kind === "number") {
        const n = parseFloat(value);
        if (value === "" || isNaN(n)) delete node.props[name];
        else node.props[name] = n;
      } else if (kind === "bool") {
        node.props[name] = !!value;
        endCoalesce();                       // checkbox is a discrete edit
      } else {
        if (value === "") delete node.props[name];
        else node.props[name] = value;
      }
      refreshLight();
    },

    /* G8: the root namespace stamped into xmlns:vm / x:Class / `namespace ...`. Empty
       falls back to ExamApp (keeps the projzip namespace-rewrite path intact). */
    /* one side of a Margin/Padding thickness; recomposes the shortest string */
    setThicknessSide: function (name, idx, value) {
      const node = CORE.findNode(tree, selectedId);
      if (!node) return;
      pushUndoCoalesced(selectedId + "|thick|" + name);
      const parts = parseThickness(node.props[name]);
      parts[idx] = String(value == null ? "" : value).trim();
      const composed = composeThickness(parts);
      if (composed === "") delete node.props[name];
      else node.props[name] = composed;
      refreshLight();
    },

    setProjectNamespace: function (value) {
      pushUndoCoalesced("root|projns");
      const s = String(value == null ? "" : value).trim();
      if (s && s !== "ExamApp") tree.projectNamespace = s;
      else delete tree.projectNamespace;
      refreshLight();
    },

    /* lock/unlock the exported window's size (CanResize). Default is locked, so we
       only store the prop when the user UNLOCKS it; re-locking clears it back to
       the default. Affects the generated axaml (output panes regenerate). */
    toggleSizeLock: function (on) {
      pushUndo(); endCoalesce();
      if (on) delete tree.props.SizeLocked;   // locked is the default
      else tree.props.SizeLocked = false;
      refreshLight();
    },

    /* lock/unlock a single element so it can't be moved or resized by accident.
       Designer-only (never exported); persists with the saved design. */
    toggleLock: function (id) {
      const node = CORE.findNode(tree, id || selectedId);
      if (!node || node.id === tree.id) return;     // the root window isn't movable anyway
      pushUndo(); endCoalesce();
      if (node.locked) delete node.locked; else node.locked = true;
      selectedId = node.id;
      refresh();
    },

    setColor: function (name, value) {
      const node = CORE.findNode(tree, selectedId);
      if (!node) return;
      pushUndo(); endCoalesce();
      if (value === "") delete node.props[name];
      else node.props[name] = value;
      refresh();
    },

    /* hex text field — keep the literal text value, sync nothing else */
    setColorText: function (name, el) {
      const node = CORE.findNode(tree, selectedId);
      if (!node) return;
      pushUndoCoalesced(selectedId + "|color|" + name);
      const v = el.value;
      if (v === "") delete node.props[name];
      else node.props[name] = v;
      /* sync the native picker if the text is a usable hex */
      const pick = el.parentNode && el.parentNode.querySelector(".dsg-color-pick");
      if (pick) pick.value = hexForPicker(v);
      refreshLight();
    },

    setDefs: function (name, el) {
      const node = CORE.findNode(tree, selectedId);
      if (!node) return;
      const v = el.value;
      const re = /^\s*((Auto|\*|\d+\*?|\d+\.\d+\*)\s*,\s*)*(Auto|\*|\d+\*?|\d+\.\d+\*)\s*$/i;
      if (v.trim() === "") {
        el.classList.remove("invalid");
        pushUndoCoalesced(selectedId + "|defs|" + name);
        delete node.props[name];
        refreshLight();
        return;
      }
      if (!re.test(v)) {
        el.classList.add("invalid");        /* invalid → red border, not applied */
        return;
      }
      el.classList.remove("invalid");
      pushUndoCoalesced(selectedId + "|defs|" + name);
      node.props[name] = v.trim();
      refreshLight();
    },

    toggleBind: function (name) {
      const node = CORE.findNode(tree, selectedId);
      if (!node) return;
      pushUndo(); endCoalesce();
      node.bindings = node.bindings || {};
      if (Object.prototype.hasOwnProperty.call(node.bindings, name)) delete node.bindings[name];
      else node.bindings[name] = suggestBind(name, node);
      refresh();
    },

    setBind: function (name, value) {
      const node = CORE.findNode(tree, selectedId);
      if (!node) return;
      pushUndoCoalesced(selectedId + "|bind|" + name);
      node.bindings = node.bindings || {};
      node.bindings[name] = value;
      refreshLight();
    },

    commitBind: function (name, value) {
      const node = CORE.findNode(tree, selectedId);
      if (!node) return;
      endCoalesce();
      node.bindings = node.bindings || {};
      if (!value || !value.trim()) delete node.bindings[name];   /* emptied → back to literal */
      else node.bindings[name] = value.trim();
      refresh();
    },

    moveSel: function (dir) {
      const parent = CORE.findParent(tree, selectedId);
      if (!parent) return;
      const idx = parent.children.findIndex(function (c) { return c.id === selectedId; });
      const ni = idx + dir;
      if (idx < 0 || ni < 0 || ni >= parent.children.length) { msg("already at the edge"); return; }
      pushUndo(); endCoalesce();
      const n = parent.children.splice(idx, 1)[0];
      parent.children.splice(ni, 0, n);
      refresh();
    },

    delSel: function () {
      const node = CORE.findNode(tree, selectedId);
      if (!node || node.id === tree.id) return;
      pushUndo(); endCoalesce();
      const parent = CORE.findParent(tree, selectedId);
      CORE.removeNode(tree, selectedId);
      selectedId = parent ? parent.id : tree.id;
      refresh();
      msg(node.type + " removed");
    },

    /* deep-clone the selected subtree with fresh ids, insert after the original;
       canvas children get a +12,+12 offset so the clone is visible */
    duplicate: function () {
      const node = CORE.findNode(tree, selectedId);
      if (!node || node.id === tree.id) { msg("select an element to duplicate"); return; }
      const parent = CORE.findParent(tree, selectedId);
      if (!parent) return;
      pushUndo(); endCoalesce();
      const clone = CORE.cloneSubtree(node);
      const idx = parent.children.findIndex(function (c) { return c.id === node.id; });
      parent.children.splice(idx + 1, 0, clone);
      if (parent.type === "Canvas") {
        clone.props["Canvas.Left"] = num(clone.props["Canvas.Left"], 0) + 12;
        clone.props["Canvas.Top"] = num(clone.props["Canvas.Top"], 0) + 12;
      }
      selectedId = clone.id;
      refresh();
      msg(node.type + " duplicated");
    },

    /* -- undo / redo -- */
    undo: function () { undo(); },
    redo: function () { redo(); },

    /* -- typed item model -- */
    setItemsMode: function (mode) {
      const node = CORE.findNode(tree, selectedId);
      if (!node) return;
      pushUndo(); endCoalesce();
      if (mode === "typed") {
        node.model = node.model && node.model.fields
          ? Object.assign({}, node.model, { mode: "typed" })
          : { mode: "typed", className: "Item",
              fields: [{ name: "Name", type: "string" }] };
      } else if (node.model) {
        node.model.mode = "strings";
      }
      refresh();
    },
    setModelClass: function (value) {
      const node = CORE.findNode(tree, selectedId);
      if (!node || !node.model) return;
      pushUndoCoalesced(selectedId + "|modelclass");
      node.model.className = value;
      refreshLight();
    },
    setCanvasItems: function (on) {
      const node = CORE.findNode(tree, selectedId);
      if (!node || !node.model) return;
      pushUndo(); endCoalesce();
      node.model.canvasItems = !!on;
      refresh();
    },
    /* G2: item-template shape (none / Ellipse / Rectangle) */
    setTemplateShape: function (value) {
      const node = CORE.findNode(tree, selectedId);
      if (!node || !node.model) return;
      pushUndo(); endCoalesce();
      if (value === "Ellipse" || value === "Rectangle") node.model.templateShape = value;
      else delete node.model.templateShape;
      refresh();
    },
    /* G6: model class nested inside the ViewModel -> vm:Outer+Inner DataType */
    setNested: function (on) {
      const node = CORE.findNode(tree, selectedId);
      if (!node || !node.model) return;
      pushUndo(); endCoalesce();
      if (on) node.model.nested = true; else delete node.model.nested;
      refresh();
    },
    addField: function () {
      const node = CORE.findNode(tree, selectedId);
      if (!node || !node.model) return;
      pushUndo(); endCoalesce();
      node.model.fields = node.model.fields || [];
      node.model.fields.push({ name: "Field" + (node.model.fields.length + 1), type: "string" });
      refresh();
    },
    removeField: function (i) {
      const node = CORE.findNode(tree, selectedId);
      if (!node || !node.model || !node.model.fields) return;
      pushUndo(); endCoalesce();
      node.model.fields.splice(i, 1);
      refresh();
    },
    setFieldName: function (i, value) {
      const node = CORE.findNode(tree, selectedId);
      if (!node || !node.model || !node.model.fields || !node.model.fields[i]) return;
      pushUndoCoalesced(selectedId + "|fieldname|" + i);
      node.model.fields[i].name = value;
      refreshLight();
    },
    setFieldType: function (i, value) {
      const node = CORE.findNode(tree, selectedId);
      if (!node || !node.model || !node.model.fields || !node.model.fields[i]) return;
      pushUndo(); endCoalesce();
      node.model.fields[i].type = value;
      refresh();
    },

    /* -- per-command recipe (working method body) -- */
    setRecipe: function (propName, value) {
      const node = CORE.findNode(tree, selectedId);
      if (!node) return;
      pushUndo(); endCoalesce();
      node.recipes = node.recipes || {};
      if (!value || value === "none") delete node.recipes[propName];
      else node.recipes[propName] = value;
      refresh();
    },

    /* -- design-level timer -- */
    toggleTimer: function () {
      pushUndo(); endCoalesce();
      if (tree.timer && tree.timer.enabled) {
        tree.timer.enabled = false;
      } else {
        tree.timer = tree.timer ? Object.assign(tree.timer, { enabled: true })
          : CORE.defaultTimer();
      }
      refresh();
    },
    setTimerField: function (field, value) {
      if (!tree.timer) tree.timer = CORE.defaultTimer();
      if (field === "intervalMs") {
        pushUndoCoalesced(tree.id + "|timer|interval");
        const n = parseInt(value, 10);
        tree.timer.intervalMs = (isNaN(n) || n <= 0) ? tree.timer.intervalMs : n;
        refreshLight();
        return;
      }
      pushUndo(); endCoalesce();
      tree.timer[field] = value;
      refresh();
    },

    /* -- reference image overlay (session only; never persisted to slots) -- */
    pickReferenceImage: function () {
      const inp = document.getElementById("dsg-ref-file");
      if (inp) { inp.value = ""; inp.click(); }
    },
    onReferenceFile: function (inp) {
      const file = inp && inp.files && inp.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        refImage.dataUrl = String(reader.result);
        refImage.visible = true;
        applyReferenceImage();
        renderRefControls();
        msg("reference image loaded");
      };
      reader.onerror = function () { msg("could not read image"); };
      reader.readAsDataURL(file);
    },
    setReferenceOpacity: function (value) {
      refImage.opacity = Math.max(10, Math.min(80, parseInt(value, 10) || 30));
      applyReferenceImage();
      const lab = document.getElementById("dsg-ref-oplabel");
      if (lab) lab.textContent = refImage.opacity + "%";
    },
    toggleReferenceImage: function () {
      refImage.visible = !refImage.visible;
      applyReferenceImage();
      renderRefControls();
    },
    removeReferenceImage: function () {
      refImage.dataUrl = null; refImage.visible = false;
      applyReferenceImage();
      renderRefControls();
      msg("reference image removed");
    },
    toggleReferencePopover: function () {
      const pop = document.getElementById("dsg-ref-pop");
      if (pop) pop.classList.toggle("open");
    },
    setExportRefImage: function (on) { refImage.includeInExport = !!on; },

    copy: function (btn, idx) {
      const text = dsgCodes[idx];
      if (text == null) return;
      const done = function () {
        btn.textContent = "copied ✓";
        btn.classList.add("done");
        setTimeout(function () { btn.textContent = "copy"; btn.classList.remove("done"); }, 1800);
      };
      const fallback = function () {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (x) {}
        document.body.removeChild(ta);
        done();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fallback);
      } else fallback();
    },

    saveAs: function () {
      const name = (typeof prompt === "function") ? prompt("Save design as:", currentSlot || "My design") : null;
      if (!name || !name.trim()) return;
      const slots = loadSlots();
      slots[name.trim()] = JSON.parse(JSON.stringify(tree));
      saveSlots(slots);
      currentSlot = name.trim();
      saveCurrent();
      repaintSlots();
      msg('Saved "' + name.trim() + '"');
    },

    loadSlot: function () {
      const sel = document.getElementById("dsg-slot");
      const name = sel && sel.value;
      if (!name) { msg("pick a design in the list first"); return; }
      const slots = loadSlots();
      if (!slots[name]) { msg("no such design"); return; }
      pushUndo(); endCoalesce();
      tree = JSON.parse(JSON.stringify(slots[name]));
      syncIdSeq(tree);
      selectedId = tree.id;
      currentSlot = name;
      refresh();
      repaintSlots();
      msg('Loaded "' + name + '"');
    },

    deleteSlot: function () {
      const sel = document.getElementById("dsg-slot");
      const name = sel && sel.value;
      if (!name) { msg("pick a design in the list first"); return; }
      if (typeof confirm === "function" && !confirm('Delete design "' + name + '"?')) return;
      const slots = loadSlots();
      delete slots[name];
      saveSlots(slots);
      if (currentSlot === name) currentSlot = "";
      saveCurrent();
      repaintSlots();
      msg('Deleted "' + name + '"');
    },

    newDesign: function () {
      pushUndo(); endCoalesce();
      tree = CORE.createNode("Window");
      selectedId = tree.id;
      currentSlot = "";
      refresh();
      repaintSlots();
      msg("blank window — drag a layout container in");
    },

    seedExamples: function () {
      const slots = loadSlots();
      slots["Recipe list + form"] = seedRecipe();
      slots["Shapes canvas"] = seedShapes();
      slots["Summer 2025 · RectangleUI"] = seedRectangleUI();
      slots["ReExam 2025 · MealPlanner"] = seedMealPlanner();
      slots["ReExam 2025 · Async Counter (P3)"] = seedCounter();
      saveSlots(slots);
      repaintSlots();
      msg("example + exam designs restored");
    },

    /* -- export / import (file:// safe: Blob download + FileReader) -- */
    exportDesigns: function () {
      const payload = {
        version: 1,
        current: JSON.parse(JSON.stringify(tree)),
        slots: loadSlots(),
      };
      /* reference image is excluded by default; included only behind the checkbox */
      if (refImage.includeInExport && refImage.dataUrl) {
        payload.referenceImage = {
          dataUrl: refImage.dataUrl, opacity: refImage.opacity, visible: refImage.visible,
        };
      }
      const json = JSON.stringify(payload, null, 2);
      try {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "aop-designs.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        msg("exported aop-designs.json");
      } catch (e) {
        msg("export failed: " + (e && e.message));
      }
    },

    importDesigns: function () {
      const inp = document.getElementById("dsg-import-file");
      if (inp) { inp.value = ""; inp.click(); }
    },

    /* -- export a COMPLETE runnable Avalonia project (.zip) from the current design --
       builds entries via window.PROJZIP.avaloniaProject (AXAML + VM + model files,
       namespaces rewritten to the chosen project name), then downloads the zip.
       The reference image is intentionally NOT included (spec 13). */
    exportProject: function () {
      const pz = projzip();
      if (!pz) { msg("project export unavailable (PROJZIP not loaded)"); return; }
      let gen;
      try { gen = CORE.generate(tree); }
      catch (e) { msg("export failed: codegen error"); return; }
      const nameEl = document.getElementById("dsg-proj-name");
      const rawName = (nameEl && nameEl.value && nameEl.value.trim()) || defaultProjectName();
      const name = pz.sanitizeName(rawName, "ExamApp");
      const opts = { axaml: gen.axaml, viewModel: gen.viewModel };
      /* the designer model pane is one file of model (+ optional service) classes in
         the ViewModels namespace; ship it under ViewModels/ so its namespace rewrite
         lines up with the AXAML's xmlns:vm. */
      if (gen.model) opts.models = [{ path: "ViewModels/Item.cs", text: gen.model }];
      try {
        const entries = pz.avaloniaProject(name, opts);
        const url = pz.makeZipBlobUrl(entries);
        const a = document.createElement("a");
        a.href = url;
        a.download = name + ".zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { try { URL.revokeObjectURL(url); } catch (x) {} }, 1000);
        msg("exported " + name + ".zip — unzip, dotnet build, dotnet run");
      } catch (e) {
        msg("export failed: " + (e && e.message));
      }
    },

    /* -- download the flat Problem 2 submission pair (spec 16) --
       Two plain-blob downloads with the professor's EXACT file names. NO zip and
       NO dependence on PROJZIP: the VM file inlines the typed model/service classes
       so the pair is the complete, self-contained deliverable (no third file).
       Only System.*, Avalonia*, CommunityToolkit.Mvvm usings appear (core merges). */
    exportSubmission: function () {
      let sub;
      try { sub = CORE.submission(tree); }
      catch (e) { msg("submission failed: codegen error"); return; }
      try {
        downloadTextFiles(sub.files);
        msg("downloaded " + sub.files.map(function (f) { return f.name; }).join(" + "));
      } catch (e) {
        msg("submission failed: " + (e && e.message));
      }
    },

    onImportFile: function (inp) {
      const file = inp && inp.files && inp.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const data = JSON.parse(String(reader.result));
          applyImport(data);
          msg("imported designs");
        } catch (e) {
          msg("import failed: not a valid designs file");
        }
      };
      reader.onerror = function () { msg("import failed: could not read file"); };
      reader.readAsText(file);
    },
  };

  /* validate the imported payload shape, merge slots, load the current tree, and
     re-sync the id sequence so subsequent inserts never collide */
  function applyImport(data) {
    if (!data || typeof data !== "object") throw new Error("bad shape");
    const cur = data.current;
    if (!cur || cur.type !== "Window") throw new Error("missing current Window");
    if (data.slots && typeof data.slots === "object") {
      const slots = loadSlots();
      Object.keys(data.slots).forEach(function (name) {
        const t = data.slots[name];
        if (t && t.type === "Window") slots[name] = t;
      });
      saveSlots(slots);
    }
    pushUndo(); endCoalesce();
    tree = JSON.parse(JSON.stringify(cur));
    syncIdSeq(tree);
    selectedId = tree.id;
    currentSlot = "";
    /* restore a reference image if the file carried one (opt-in on export) */
    if (data.referenceImage && data.referenceImage.dataUrl) {
      refImage.dataUrl = data.referenceImage.dataUrl;
      refImage.opacity = Math.max(10, Math.min(80, parseInt(data.referenceImage.opacity, 10) || 30));
      refImage.visible = data.referenceImage.visible !== false;
      refImage.includeInExport = true;
    }
    refresh();
    repaintSlots();
    applyReferenceImage();
  }

  /* ---------------- export ---------------- */
  const DESIGNER = { render: render, init: init, previewHTML: previewHTML };
  global.DESIGNER = DESIGNER;
  global.DSG = DSG;
  if (typeof module !== "undefined" && module.exports) module.exports = DESIGNER;
})(typeof window !== "undefined" ? window : globalThis);
