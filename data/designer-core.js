/* ============ VISUAL DESIGNER · core (pure: catalog + tree ops + codegen) ============
   UMD-guarded: loaded via <script> in the browser AND require()d by the Node tests.
   NO DOM access anywhere in this file. */

(function (global) {
  "use strict";

  /* ---------------- shared prop fragments ---------------- */
  function alignProps() {
    return [
      { name: "HorizontalAlignment", kind: "select", options: ["Left", "Center", "Right", "Stretch"] },
      { name: "VerticalAlignment", kind: "select", options: ["Top", "Center", "Bottom", "Stretch"] },
    ];
  }
  function sizeProps() {
    return [
      { name: "Width", kind: "number", bindable: true, vmType: "double" },
      { name: "Height", kind: "number", bindable: true, vmType: "double" },
    ];
  }
  /* Which alignment axis is INERT for a child of this parent. A StackPanel sizes
     each child to its own extent along the stacking (main) axis, so the matching
     alignment has no effect there — exactly as in Avalonia. Vertical stack ->
     VerticalAlignment is inert; horizontal stack -> HorizontalAlignment is inert.
     Returns null for containers (Grid, Border, Window…) that give space on both
     axes, where both alignments work. */
  function inertAlignmentAxis(parentType, orientation) {
    if (parentType !== "StackPanel" && parentType !== "WrapPanel") return null;
    var orient = orientation || (parentType === "WrapPanel" ? "Horizontal" : "Vertical");
    return orient === "Horizontal" ? "HorizontalAlignment" : "VerticalAlignment";
  }

  /* ---------------- catalog ---------------- */
  const CATALOG = {
    /* -- root (not in palette) -- */
    Window: {
      group: "Root", container: true, maxChildren: 1, icon: "⊞",
      defaultProps: { Title: "Exam App", Width: 600, Height: 400 },
      props: [
        { name: "Title", kind: "text" },
        { name: "Width", kind: "number" }, { name: "Height", kind: "number" },
      ],
    },

    /* -- layout containers -- */
    StackPanel: {
      group: "Layout", container: true, icon: "▤",
      defaultProps: { Orientation: "Vertical" },
      props: [
        { name: "Orientation", kind: "select", options: ["Vertical", "Horizontal"] },
        { name: "Spacing", kind: "number" },
        { name: "Margin", kind: "text" },
        { name: "Background", kind: "color" },
      ].concat(sizeProps(), alignProps()),
    },
    Grid: {
      group: "Layout", container: true, icon: "▦",
      defaultProps: {},
      props: [
        { name: "RowDefinitions", kind: "text" },
        { name: "ColumnDefinitions", kind: "text" },
        { name: "Margin", kind: "text" },
        { name: "Background", kind: "color" },
        { name: "ShowGridLines", kind: "bool" },
      ],
      attachedProps: [
        { name: "Grid.Row", kind: "number" },
        { name: "Grid.Column", kind: "number" },
        { name: "Grid.RowSpan", kind: "number" },
        { name: "Grid.ColumnSpan", kind: "number" },
      ],
    },
    DockPanel: {
      group: "Layout", container: true, icon: "◧",
      defaultProps: { LastChildFill: true },
      props: [
        { name: "LastChildFill", kind: "bool" },
        { name: "Margin", kind: "text" },
        { name: "Background", kind: "color" },
      ],
      attachedProps: [
        { name: "DockPanel.Dock", kind: "select", options: ["Left", "Top", "Right", "Bottom"] },
      ],
    },
    WrapPanel: {
      group: "Layout", container: true, icon: "▨",
      defaultProps: { Orientation: "Horizontal" },
      props: [
        { name: "Orientation", kind: "select", options: ["Horizontal", "Vertical"] },
        { name: "ItemWidth", kind: "number" },
        { name: "ItemHeight", kind: "number" },
        { name: "Margin", kind: "text" },
      ],
    },
    Border: {
      group: "Layout", container: true, maxChildren: 1, icon: "▢",
      defaultProps: {},
      props: [
        { name: "Background", kind: "color" },
        { name: "BorderBrush", kind: "color" },
        { name: "BorderThickness", kind: "text" },
        { name: "CornerRadius", kind: "text" },
        { name: "Padding", kind: "text" },
        { name: "Margin", kind: "text" },
      ],
    },
    ScrollViewer: {
      group: "Layout", container: true, maxChildren: 1, icon: "⇕",
      defaultProps: {},
      props: [
        { name: "Margin", kind: "text" },
      ].concat(sizeProps()),
    },
    Canvas: {
      group: "Layout", container: true, icon: "✛",
      defaultProps: {},
      props: [{ name: "Background", kind: "color" }].concat(sizeProps()),
      attachedProps: [
        { name: "Canvas.Left", kind: "number" },
        { name: "Canvas.Top", kind: "number" },
      ],
    },

    /* -- controls -- */
    Button: {
      group: "Controls", container: false, icon: "▭",
      defaultProps: { Content: "Button" },
      props: [
        { name: "Content", kind: "text", bindable: true, vmType: "string" },
        { name: "Command", kind: "none", bindable: true, vmType: "command" }, // binding-only
        { name: "Width", kind: "number" }, { name: "Height", kind: "number" },
        { name: "Margin", kind: "text" },
        { name: "Background", kind: "color" }, { name: "Foreground", kind: "color" },
        { name: "FontSize", kind: "number" },
      ].concat(alignProps()),
    },
    TextBox: {
      group: "Controls", container: false, icon: "⌶",
      defaultProps: {},
      props: [
        { name: "Text", kind: "text", bindable: true, vmType: "string" },
        { name: "Watermark", kind: "text" },
        { name: "Width", kind: "number" },
        { name: "FontSize", kind: "number" },
        { name: "Margin", kind: "text" },
      ].concat(alignProps()),
    },
    TextBlock: {
      group: "Controls", container: false, icon: "T",
      defaultProps: { Text: "TextBlock" },
      props: [
        { name: "Text", kind: "text", bindable: true, vmType: "string" },
        { name: "FontSize", kind: "number" },
        { name: "FontWeight", kind: "select", options: ["Normal", "Bold"] },
        { name: "Foreground", kind: "color" },
        { name: "Margin", kind: "text" },
        { name: "TextWrapping", kind: "select", options: ["NoWrap", "Wrap"] },
      ].concat(alignProps()),
    },
    CheckBox: {
      group: "Controls", container: false, icon: "☑",
      defaultProps: { Content: "CheckBox" },
      props: [
        { name: "Content", kind: "text" },
        { name: "IsChecked", kind: "bool", bindable: true, vmType: "bool" },
        { name: "Margin", kind: "text" },
      ],
    },
    RadioButton: {
      group: "Controls", container: false, icon: "◉",
      defaultProps: { Content: "RadioButton" },
      props: [
        { name: "Content", kind: "text" },
        { name: "GroupName", kind: "text" },
        { name: "IsChecked", kind: "bool", bindable: true, vmType: "bool" },
        { name: "Margin", kind: "text" },
      ],
    },
    Slider: {
      group: "Controls", container: false, icon: "⊷",
      defaultProps: { Minimum: 0, Maximum: 100 },
      props: [
        { name: "Minimum", kind: "number" },
        { name: "Maximum", kind: "number" },
        { name: "Value", kind: "number", bindable: true, vmType: "double" },
        { name: "Width", kind: "number" },
        { name: "TickFrequency", kind: "number" },
        { name: "Margin", kind: "text" },
      ],
    },
    ComboBox: {
      group: "Controls", container: false, icon: "▾", itemsHost: true,
      defaultProps: {},
      props: [
        { name: "ItemsSource", kind: "none", bindable: true, vmType: "collection" },
        { name: "SelectedItem", kind: "none", bindable: true, vmType: "selectedItem" },
        { name: "PlaceholderText", kind: "text" },
        { name: "Width", kind: "number" },
        { name: "Margin", kind: "text" },
      ],
    },
    ListBox: {
      group: "Controls", container: false, icon: "≡", itemsHost: true,
      defaultProps: { SelectionMode: "Single" },
      props: [
        { name: "ItemsSource", kind: "none", bindable: true, vmType: "collection" },
        { name: "SelectedItem", kind: "none", bindable: true, vmType: "selectedItem" },
        /* SelectedItems: two-way sync of the multi-selection from the VM (G6). Binds to
           an IList the VM exposes/observes; lets selection sync without hand-editing. */
        { name: "SelectedItems", kind: "none", bindable: true, vmType: "selectedItems" },
        { name: "Height", kind: "number" },
        { name: "SelectionMode", kind: "select", options: ["Single", "Multiple"] },
        { name: "Margin", kind: "text" },
      ],
    },
    ItemsControl: {
      group: "Controls", container: false, icon: "⋮", itemsHost: true,
      defaultProps: {},
      props: [
        { name: "ItemsSource", kind: "none", bindable: true, vmType: "collection" },
        { name: "Margin", kind: "text" },
      ].concat(sizeProps()),
    },
    ProgressBar: {
      group: "Controls", container: false, icon: "▱",
      defaultProps: { Minimum: 0, Maximum: 100 },
      props: [
        { name: "Minimum", kind: "number" },
        { name: "Maximum", kind: "number" },
        { name: "Value", kind: "number", bindable: true, vmType: "double" },
        { name: "IsIndeterminate", kind: "bool" },
        { name: "Width", kind: "number" },
        { name: "Height", kind: "number" },
        { name: "Margin", kind: "text" },
      ],
    },
    Image: {
      group: "Controls", container: false, icon: "▣",
      defaultProps: {},
      props: [
        { name: "Source", kind: "text" },
        { name: "Width", kind: "number" },
        { name: "Height", kind: "number" },
        { name: "Stretch", kind: "select", options: ["None", "Fill", "Uniform", "UniformToFill"] },
        { name: "Margin", kind: "text" },
      ],
    },
    ToggleSwitch: {
      group: "Controls", container: false, icon: "◐",
      defaultProps: {},
      props: [
        { name: "IsChecked", kind: "bool", bindable: true, vmType: "bool" },
        { name: "OnContent", kind: "text" },
        { name: "OffContent", kind: "text" },
        { name: "Margin", kind: "text" },
      ],
    },
    NumericUpDown: {
      group: "Controls", container: false, icon: "⇅",
      defaultProps: { Minimum: 0, Maximum: 100, Increment: 1 },
      props: [
        { name: "Value", kind: "number", bindable: true, vmType: "double" },
        { name: "Minimum", kind: "number" },
        { name: "Maximum", kind: "number" },
        { name: "Increment", kind: "number" },
        { name: "Width", kind: "number" },
        { name: "Margin", kind: "text" },
      ],
    },

    /* -- structural containers -- */
    TabControl: {
      group: "Containers", container: true, icon: "⊟", childTypes: ["TabItem"],
      defaultProps: {},
      props: [
        { name: "Margin", kind: "text" },
      ].concat(sizeProps()),
    },
    TabItem: {
      group: "Containers", container: true, maxChildren: 1, icon: "▭", parentTypes: ["TabControl"],
      defaultProps: { Header: "Tab" },
      props: [
        { name: "Header", kind: "text" },
      ],
    },
    Expander: {
      group: "Containers", container: true, maxChildren: 1, icon: "▾▸",
      defaultProps: { Header: "Expander", IsExpanded: true },
      props: [
        { name: "Header", kind: "text" },
        { name: "IsExpanded", kind: "bool" },
        { name: "Margin", kind: "text" },
      ],
    },
    Separator: {
      group: "Containers", container: false, icon: "─",
      defaultProps: {},
      props: [
        { name: "Margin", kind: "text" },
      ],
    },

    /* -- shapes -- */
    Rectangle: {
      group: "Shapes", container: false, icon: "▮",
      defaultProps: {},
      props: [
        { name: "Width", kind: "number", bindable: true, vmType: "double" },
        { name: "Height", kind: "number", bindable: true, vmType: "double" },
        { name: "Fill", kind: "color", bindable: true, vmType: "brush" },
        { name: "Stroke", kind: "color" },
        { name: "StrokeThickness", kind: "number" },
        { name: "RadiusX", kind: "number" },
        { name: "RadiusY", kind: "number" },
        { name: "Margin", kind: "thickness" },
      ].concat(alignProps()),
    },
    Ellipse: {
      group: "Shapes", container: false, icon: "◯",
      defaultProps: {},
      props: [
        { name: "Width", kind: "number", bindable: true, vmType: "double" },
        { name: "Height", kind: "number", bindable: true, vmType: "double" },
        { name: "Fill", kind: "color", bindable: true, vmType: "brush" },
        { name: "Stroke", kind: "color" },
        { name: "StrokeThickness", kind: "number" },
        { name: "Margin", kind: "thickness" },
      ].concat(alignProps()),
    },
    Line: {
      group: "Shapes", container: false, icon: "╱",
      defaultProps: { StartPoint: "0,0", EndPoint: "100,100" },
      props: [
        { name: "StartPoint", kind: "text" },
        { name: "EndPoint", kind: "text" },
        { name: "Stroke", kind: "color" },
        { name: "StrokeThickness", kind: "number" },
        { name: "Margin", kind: "thickness" },
      ].concat(alignProps()),
    },
    Polygon: {
      group: "Shapes", container: false, icon: "△",
      defaultProps: { Points: "0,40 40,0 80,40" },
      props: [
        { name: "Points", kind: "text" },
        { name: "Fill", kind: "color", bindable: true, vmType: "brush" },
        { name: "Stroke", kind: "color" },
        { name: "StrokeThickness", kind: "number" },
        { name: "Margin", kind: "thickness" },
      ].concat(alignProps()),
    },
    Path: {
      group: "Shapes", container: false, icon: "∿",
      defaultProps: { Data: "M 0,0 L 40,40" },
      props: [
        { name: "Data", kind: "text" },
        { name: "Fill", kind: "color", bindable: true, vmType: "brush" },
        { name: "Stroke", kind: "color" },
        { name: "StrokeThickness", kind: "number" },
        { name: "Margin", kind: "thickness" },
      ].concat(alignProps()),
    },
  };

  /* Normalize the catalog so EVERY visual element can be sized, positioned and
     aligned: add Width/Height (bindable), Margin (four-side editor) and
     Horizontal/VerticalAlignment wherever a control's own definition didn't already
     declare them. Added only where missing, so each control's explicit props (and
     their bindable flags / custom options) are preserved. The Window root is left
     alone — a window has no Margin/Alignment. Width/Height on every element also
     means the resize grips (which require both) now appear on every element. */
  (function ensureLayoutPropsForAll() {
    Object.keys(CATALOG).forEach(function (type) {
      var def = CATALOG[type];
      if (!def || def.group === "Root") return;
      var names = (def.props || []).map(function (p) { return p.name; });
      var add = [];
      if (names.indexOf("Width") === -1) add.push({ name: "Width", kind: "number", bindable: true, vmType: "double" });
      if (names.indexOf("Height") === -1) add.push({ name: "Height", kind: "number", bindable: true, vmType: "double" });
      if (names.indexOf("Margin") === -1) add.push({ name: "Margin", kind: "thickness" });
      if (names.indexOf("HorizontalAlignment") === -1) add.push({ name: "HorizontalAlignment", kind: "select", options: ["Left", "Center", "Right", "Stretch"] });
      if (names.indexOf("VerticalAlignment") === -1) add.push({ name: "VerticalAlignment", kind: "select", options: ["Top", "Center", "Bottom", "Stretch"] });
      if (add.length) def.props = (def.props || []).concat(add);
    });
  })();

  const PALETTE_GROUPS = [
    { name: "Layout", hint: "arrange things on screen", types: ["StackPanel", "Grid", "DockPanel", "WrapPanel", "Border", "ScrollViewer", "Canvas"] },
    { name: "Containers", hint: "sections, tabs & dividers", types: ["TabControl", "TabItem", "Expander", "Separator"] },
    { name: "Controls", hint: "buttons, text & inputs", types: ["Button", "TextBox", "TextBlock", "CheckBox", "RadioButton", "Slider", "ComboBox", "ListBox", "ItemsControl", "ProgressBar", "Image", "ToggleSwitch", "NumericUpDown"] },
    { name: "Shapes", hint: "draw rectangles, circles, lines", types: ["Rectangle", "Ellipse", "Line", "Polygon", "Path"] },
  ];

  /* Plain-English one-liner for every palette control, shown under its real
     Avalonia name so a beginner knows what each one does (and still learns the
     real type name for the exam). Keyed by catalog type. */
  const PLAIN = {
    // Layout
    StackPanel: "stacks items in a row or column",
    Grid: "rows & columns, like a table",
    DockPanel: "pins items to an edge (top / side / bottom)",
    WrapPanel: "lays items out left-to-right, wrapping to the next line",
    Border: "a frame or coloured box around one item",
    ScrollViewer: "adds scrollbars when the content is too big",
    Canvas: "place items freely by x / y position",
    // Containers
    TabControl: "tabbed pages (holds the tabs)",
    TabItem: "one tab page — goes inside a TabControl",
    Expander: "a section you can fold open and closed",
    Separator: "a thin divider line between things",
    // Controls
    Button: "a button the user clicks",
    TextBox: "a box the user types text into",
    TextBlock: "shows a piece of text (a label)",
    CheckBox: "a tickbox that is on or off",
    RadioButton: "pick one option out of a group",
    Slider: "drag a handle to choose a number",
    ComboBox: "a dropdown list to pick one item",
    ListBox: "a scrollable list of items to pick from",
    ItemsControl: "repeats a layout once per item in a list",
    ProgressBar: "a bar that shows progress (0–100%)",
    Image: "displays a picture",
    ToggleSwitch: "an on / off switch",
    NumericUpDown: "a number box with + / − steppers",
    // Shapes
    Rectangle: "a rectangle (corners can be rounded)",
    Ellipse: "a circle or oval",
    Line: "a straight line",
    Polygon: "a shape from several points",
    Path: "a custom drawn shape",
  };

  const COLORS = [
    "#0B0E14", "#1F2430", "#39BAE6", "#59C2FF", "#7FD962", "#AAD94C", "#E6B450",
    "#FF8F40", "#F07178", "#DC143C", "#D2A6FF", "#B8CFE6", "#FFFFFF", "#F5F5F5",
    "#808080", "#404040", "#2E7D32", "#1565C0", "#6A1B9A", "Transparent",
  ];

  /* ---------------- tree operations ---------------- */
  let idSeq = 1;

  function createNode(type) {
    const def = CATALOG[type] || { defaultProps: {} };
    return {
      id: "n" + (idSeq++), type,
      props: Object.assign({}, def.defaultProps), bindings: {}, children: [],
    };
  }

  function findNode(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i++) {
      const hit = findNode(kids[i], id);
      if (hit) return hit;
    }
    return null;
  }

  function findParent(node, id) {
    if (!node) return null;
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i++) {
      if (kids[i].id === id) return node;
      const hit = findParent(kids[i], id);
      if (hit) return hit;
    }
    return null;
  }

  function canContain(parentType, childType) {
    const p = CATALOG[parentType];
    const c = CATALOG[childType];
    if (!p || !p.container || !c) return false;
    if (p.childTypes && p.childTypes.indexOf(childType) === -1) return false;
    if (c.parentTypes && c.parentTypes.indexOf(parentType) === -1) return false;
    return true;
  }

  function addChild(tree, parentId, node, index) {
    const parent = findNode(tree, parentId);
    if (!parent || !node) return false;
    if (!canContain(parent.type, node.type)) return false;
    const def = CATALOG[parent.type];
    if (def && def.maxChildren != null && parent.children.length >= def.maxChildren) return false;
    const i = (index == null) ? parent.children.length
      : Math.max(0, Math.min(index, parent.children.length));
    parent.children.splice(i, 0, node);
    return true;
  }

  function removeNode(tree, id) {
    const parent = findParent(tree, id);
    if (!parent) return null;
    const i = parent.children.findIndex((c) => c.id === id);
    return i === -1 ? null : parent.children.splice(i, 1)[0];
  }

  function moveNode(tree, id, newParentId, index) {
    const node = findNode(tree, id);
    const target = findNode(tree, newParentId);
    if (!node || !target || node === target) return false;
    if (findNode(node, newParentId)) return false;      // target is a descendant of node
    if (!canContain(target.type, node.type)) return false;
    const def = CATALOG[target.type];
    const already = target.children.indexOf(node) !== -1;
    if (def && def.maxChildren != null && !already && target.children.length >= def.maxChildren) return false;
    removeNode(tree, id);
    const i = (index == null) ? target.children.length
      : Math.max(0, Math.min(index, target.children.length));
    target.children.splice(i, 0, node);
    return true;
  }

  function walk(node, fn, parent, depth) {
    if (!node) return;
    fn(node, parent || null, depth || 0);
    (node.children || []).forEach((c) => walk(c, fn, node, (depth || 0) + 1));
  }

  /* advance idSeq past every nXX id already present in a (loaded/imported) tree so
     freshly created nodes never collide with existing ones */
  function syncIdSeq(t) {
    let max = 0;
    walk(t, function (n) {
      const m = /^n(\d+)$/.exec(String((n && n.id) || ""));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    if (idSeq <= max) idSeq = max + 1;
    return idSeq;
  }

  /* deep-clone a subtree, assigning fresh ids to every node (reuses createNode's
     id sequence so clones never collide with the live tree or future inserts) */
  function cloneSubtree(node) {
    if (!node) return null;
    const copy = {
      id: "n" + (idSeq++),
      type: node.type,
      props: Object.assign({}, node.props),
      bindings: Object.assign({}, node.bindings),
      children: (node.children || []).map(cloneSubtree),
    };
    if (node.model) copy.model = JSON.parse(JSON.stringify(node.model));
    /* carry the command recipe + click behaviors so a duplicated button keeps its logic */
    if (node.recipes) copy.recipes = Object.assign({}, node.recipes);
    if (node.behaviors) copy.behaviors = JSON.parse(JSON.stringify(node.behaviors));
    return copy;
  }

  /* set Canvas.Left/Top on a node from an (already canvas-relative) point.
     Rounds to integers and clamps to >= 0. Returns true when applied. */
  function placeAtCanvasPoint(tree, nodeId, x, y) {
    const node = findNode(tree, nodeId);
    if (!node) return false;
    const left = Math.max(0, Math.round(Number(x) || 0));
    const top = Math.max(0, Math.round(Number(y) || 0));
    node.props["Canvas.Left"] = left;
    node.props["Canvas.Top"] = top;
    return true;
  }

  /* serialize / deserialize the working tree for undo/redo + export/import.
     deserialize re-syncs the id sequence so later inserts stay collision-free. */
  function serialize(tree) { return JSON.stringify(tree); }
  function deserialize(str) {
    const t = (typeof str === "string") ? JSON.parse(str) : str;
    if (!t || t.type !== "Window") throw new Error("not a Window tree");
    syncIdSeq(t);
    return t;
  }

  /* ---------------- codegen: AXAML ---------------- */
  function xmlEsc(v) {
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtValue(v) {
    if (typeof v === "boolean") return v ? "True" : "False";
    return xmlEsc(v);
  }

  function indentOf(depth) { return "    ".repeat(Math.max(0, depth - 1)); }

  /* a node uses a typed item model when its model config says mode === "typed" */
  function typedModelOf(node) {
    const m = node && node.model;
    if (!m || m.mode !== "typed") return null;
    const className = (m.className || "Item").trim() || "Item";
    let fields = (m.fields || []).filter((f) => f && f.name);
    /* ItemsControl in canvas mode positions each item; ensure X/Y doubles exist */
    if (m.canvasItems) {
      const have = {};
      fields.forEach((f) => { have[f.name] = true; });
      const augmented = fields.slice();
      if (!have.X) augmented.push({ name: "X", type: "double" });
      if (!have.Y) augmented.push({ name: "Y", type: "double" });
      fields = augmented;
    }
    const out = { className, fields, canvasItems: !!m.canvasItems };
    /* G8: carry an explicit host Width/Height so the VM clamp constants and the inner
       Canvas agree. Unset stays null -> the 400/300 defaults are kept byte-for-byte. */
    if (out.canvasItems) out.canvasBounds = canvasBoundsOf(node);
    /* G2: an item-template shape (Ellipse / Rectangle) replaces the debug list */
    if (m.templateShape === "Ellipse" || m.templateShape === "Rectangle") {
      out.templateShape = m.templateShape;
    }
    /* G6: a model class nested inside the ViewModel needs the vm:Outer+Inner
       compiled-binding DataType. outerClass defaults to the VM class name. */
    if (m.nested) {
      out.nested = true;
      out.outerClass = (m.outerClass || "MainWindowViewModel").trim() || "MainWindowViewModel";
    }
    return out;
  }

  /* the x:DataType reference for an item model: the bare class name, or the nested
     CLR form vm:Outer+Inner when the model class lives inside the ViewModel (G6).
     Compiled bindings (x:CompileBindings) require the runtime '+' nested-type name. */
  function dataTypeName(model) {
    if (model && model.nested) return model.outerClass + "+" + model.className;
    return model.className;
  }

  /* the IBrush ("brush") field name on a model, or null when none — used to decide
     whether a shape template can bind Fill (G2). */
  function brushFieldName(model) {
    const f = (model && model.fields ? model.fields : []).find((x) => x.type === "IBrush");
    return f ? f.name : null;
  }

  /* The geometry-defining props of point/path shapes. These are what make the shape
     visible at all, so they must be emitted EVEN when the value equals the catalog
     default — otherwise a freshly-dropped Line/Polygon/Path exports with no geometry
     (e.g. `<Polygon Fill="..."/>`), lays out as a 0x0 nothing, and the running app is
     blank. This was THE "shapes don't show / no elements displayed" bug. */
  const DEFINING_PROPS = {
    Line: ["StartPoint", "EndPoint"],
    Polygon: ["Points"],
    Polyline: ["Points"],
    Path: ["Data"],
  };
  /* a point/path shape is sized by its geometry, not Width/Height */
  function isGeomShape(type) { return type === "Line" || type === "Polygon" || type === "Polyline" || type === "Path"; }

  /* ---------------- programmable behaviors (Scratch-style, MVVM-compiled) ----------------
     A behavior lives on a trigger element (a Button) as node.behaviors = [ {kind, target, value} ].
     It compiles to pure MVVM: each controlled target property becomes a ViewModel-backed
     binding (Text / IsVisible / Value), and the trigger button's [RelayCommand] sets those
     properties. No code-behind — the exam requires strict MVVM, and this keeps it. */
  const BEHAVIOR_ACTIONS = [
    { id: "setText", label: "set text to…", needsValue: true },
    { id: "clearText", label: "clear text", needsValue: false },
    { id: "show", label: "show element", needsValue: false },
    { id: "hide", label: "hide element", needsValue: false },
    { id: "toggleVisible", label: "show / hide (toggle)", needsValue: false },
    { id: "setValue", label: "set value to…", needsValue: true },
  ];

  function sanitizeIdent(s, fallback) {
    let t = String(s == null ? "" : s).replace(/[^A-Za-z0-9]+/g, " ").trim()
      .split(/\s+/).filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join("");
    if (!t || !/^[A-Za-z_]/.test(t)) t = (fallback || "El") + t;
    return t;
  }
  function behaviorBaseName(node) {
    if (!node) return "El";
    const p = node.props || {};
    return sanitizeIdent(p.Content || p.Text || p.Header || "", node.type) || node.type;
  }
  /* the text-bearing property of a control: Content for Button/CheckBox/RadioButton, else Text */
  function behaviorTextProp(node) {
    const t = node ? node.type : "";
    return (t === "Button" || t === "CheckBox" || t === "RadioButton") ? "Content" : "Text";
  }
  function csStr(s) {
    return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      .replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t");
  }

  /* Compile every node.behaviors[] into:
       injected: { nodeId: { prop: {vmName, vmType, binit} } } — bindings to inject on targets
                 (and a Command binding on a trigger button that lacks one), so attrsOf emits
                 them and registers the matching ViewModel members.
       commandBodies: { commandName: [lines] } — the [RelayCommand] body for each trigger. */
  function behaviorPlan(tree) {
    const injected = {};
    const commandBodies = {};
    const used = {};
    /* reserve real binding member names so synthetic ones never collide */
    walk(tree, function (n) {
      Object.keys(n.bindings || {}).forEach(function (k) { if (n.bindings[k]) used[n.bindings[k]] = true; });
    });
    function memberFor(targetId, prop, vmType, binit) {
      const target = findNode(tree, targetId);
      if (!target) return null;
      const real = (target.bindings || {})[prop];
      if (real) return real;                                 // a real binding already exposes it
      injected[targetId] = injected[targetId] || {};
      if (injected[targetId][prop]) return injected[targetId][prop].vmName;
      const suffix = prop === "IsVisible" ? "Visible" : prop; // Text->Text, Content->Content, Value->Value
      let base = behaviorBaseName(target) + suffix, name = base, i = 2;
      while (used[name]) name = base + (i++);
      used[name] = true;
      injected[targetId][prop] = { vmName: name, vmType: vmType, binit: binit };
      return name;
    }
    walk(tree, function (node) {
      const bhs = node.behaviors;
      if (!Array.isArray(bhs) || !bhs.length) return;
      let cmdName = (node.bindings && node.bindings.Command) || "";
      if (!cmdName) {
        cmdName = behaviorBaseName(node) + "Command";
        injected[node.id] = injected[node.id] || {};
        injected[node.id].Command = { vmName: cmdName, vmType: "command", binit: null };
        used[cmdName] = true;
      }
      const lines = [];
      bhs.forEach(function (a) {
        if (!a || !a.kind || !a.target) return;
        const target = findNode(tree, a.target);
        if (!target) return;
        if (a.kind === "setText" || a.kind === "clearText") {
          const prop = behaviorTextProp(target);
          const cur = (target.props || {})[prop] || "";
          const vm = memberFor(a.target, prop, "string", ' = "' + csStr(cur) + '";');
          if (vm) lines.push("        " + vm + ' = "' + csStr(a.kind === "clearText" ? "" : (a.value || "")) + '";');
        } else if (a.kind === "show" || a.kind === "hide" || a.kind === "toggleVisible") {
          const vm = memberFor(a.target, "IsVisible", "bool", " = true;");
          if (vm) lines.push("        " + vm + (a.kind === "show" ? " = true;" : a.kind === "hide" ? " = false;" : " = !" + vm + ";"));
        } else if (a.kind === "setValue") {
          const cur = Number((target.props || {}).Value) || 0;
          const vm = memberFor(a.target, "Value", "double", " = " + cur + ";");
          if (vm) lines.push("        " + vm + " = " + (Number(a.value) || 0) + ";");
        }
      });
      commandBodies[cmdName] = lines.length ? lines : ["        // TODO: add behavior actions in the Behaviors panel"];
    });
    return { injected: injected, commandBodies: commandBodies };
  }

  /* attributes for one node: non-default catalog props (in catalog order),
     attached props last, then bindings as {Binding X}. `injected` (from behaviorPlan)
     adds behavior-driven bindings to the relevant nodes. */
  function attrsOf(node, out, injected) {
    const def = CATALOG[node.type] || { props: [], defaultProps: {} };
    const props = def.props || [];
    const defaults = def.defaultProps || {};
    const inj = (injected && injected[node.id]) || null;
    /* merge behavior-injected bindings into a local copy so the normal "binding wins"
       logic suppresses any literal and emits {Binding X} for the controlled prop */
    const bindings = Object.assign({}, node.bindings || {});
    if (inj) Object.keys(inj).forEach(function (prop) {
      if (bindings[prop] == null || bindings[prop] === "") bindings[prop] = inj[prop].vmName;
    });
    const known = {};
    const attrs = [];
    const model = typedModelOf(node);

    const geomShape = isGeomShape(node.type);
    const defining = DEFINING_PROPS[node.type] || [];
    props.forEach((p) => {
      known[p.name] = true;
      // Line/Polygon/Path are point/path-defined; Width/Height are inert and would push
      // the shape into the corner of an oversized box in the running app — never emit them.
      if (geomShape && (p.name === "Width" || p.name === "Height")) return;
      if (bindings[p.name] != null && bindings[p.name] !== "") return; // binding wins
      const isDefining = defining.indexOf(p.name) !== -1;
      const v = node.props[p.name];
      if (v == null || v === "") {
        // a defining prop must NEVER be empty: fall back to the catalog default so the
        // shape always has geometry to render (the blank-shape fix).
        if (isDefining && defaults[p.name] != null && defaults[p.name] !== "") {
          attrs.push(p.name + '="' + fmtValue(defaults[p.name]) + '"');
        }
        return;
      }
      // defining props are always emitted (even when equal to the default); every other
      // prop is omitted when it matches the catalog default to keep the output clean.
      if (!isDefining && v === defaults[p.name]) return;
      attrs.push(p.name + '="' + fmtValue(v) + '"');
    });

    /* attached props (Grid.Row, Canvas.Left, DockPanel.Dock, ...) and any extras.
       Rotation is handled specially below (it maps to a RenderTransform, not a
       literal Rotation="" attribute, which Avalonia controls don't have). */
    Object.keys(node.props).forEach((name) => {
      if (known[name] || name === "Rotation") return;
      const v = node.props[name];
      if (v == null || v === "") return;
      if (v === defaults[name]) return;
      attrs.push(name + '="' + fmtValue(v) + '"');
    });

    /* bindings last; collect ViewModel members */
    const recipes = node.recipes || {};
    Object.keys(bindings).forEach((name) => {
      const vmName = bindings[name];
      if (!vmName) return;
      attrs.push(name + '="{Binding ' + xmlEsc(vmName) + '}"');
      const pd = props.find((p) => p.name === name);
      let vmType = pd && pd.vmType ? pd.vmType : "string";
      // a behavior-injected binding carries its own vmType (IsVisible -> bool, etc.) and
      // an initializer for the generated [ObservableProperty] member.
      let binit;
      if (inj && inj[name]) { vmType = inj[name].vmType; binit = inj[name].binit; }
      const entry = { name: vmName, vmType };
      if (binit != null) entry.binit = binit;
      if (vmType === "selectedItem") {
        entry.vmType = "selectedItem";
        entry.itemType = model ? model.className : "string";
      }
      if (vmType === "selectedItems") {
        entry.vmType = "selectedItems";
        entry.itemType = model ? model.className : "string";
      }
      if (vmType === "collection") {
        entry.elementType = model ? model.className : "string";
        if (model) entry.model = model;
      }
      if (vmType === "command") {
        entry.recipe = recipes[name] || "none";
      }
      out.push(entry);
    });

    if (model) out.push({ model: model, modelOnly: true });

    /* shapes render as NOTHING at runtime without a Stroke/Fill: a Line needs both
       Stroke and StrokeThickness, a Polygon/Path needs a Fill or Stroke. The in-app
       preview fakes these defaults, so guarantee the same here or the exported app
       shows a blank window (the "no line at all" bug). Only fills gaps the user left. */
    const hasAttr = function (name) {
      if (bindings[name] != null && bindings[name] !== "") return true;
      const pre = name + '="';
      return attrs.some(function (a) { return a.slice(0, pre.length) === pre; });
    };
    if (node.type === "Line") {
      if (!hasAttr("Stroke")) attrs.push('Stroke="Black"');
      if (!hasAttr("StrokeThickness")) attrs.push('StrokeThickness="2"');
    } else if (node.type === "Rectangle" || node.type === "Ellipse") {
      // a fill-less, size-less shape is a 0x0 nothing at runtime; the preview shows
      // a grey 80x50 box, so emit the same so the exported app matches.
      if (!hasAttr("Width")) attrs.push('Width="80"');
      if (!hasAttr("Height")) attrs.push('Height="50"');
      if (!hasAttr("Fill") && !hasAttr("Stroke")) attrs.push('Fill="#9AA7B8"');
    } else if (node.type === "Polygon" || node.type === "Path") {
      if (!hasAttr("Fill") && !hasAttr("Stroke")) attrs.push('Fill="#9AA7B8"');
    }

    /* universal rotation: node.props.Rotation (degrees) -> a RenderTransform that
       spins the element around its own centre, matching the in-app preview. */
    const rot = Number(node.props.Rotation);
    if (isFinite(rot) && rot !== 0) {
      attrs.push('RenderTransform="rotate(' + rot + 'deg)"');
      // 50%,50% (relative) = the element's centre; a bare "0.5,0.5" would be read as
      // absolute pixels in Avalonia and rotate around the top-left corner instead.
      attrs.push('RenderTransformOrigin="50%,50%"');
    }

    return attrs;
  }

  function openTag(node, attrs, depth, selfClose) {
    const ind = indentOf(depth);
    const close = selfClose ? "/>" : ">";
    if (attrs.length === 0) return ind + "<" + node.type + close;
    if (attrs.length <= 2) return ind + "<" + node.type + " " + attrs.join(" ") + close;
    const pad = " ".repeat(ind.length + node.type.length + 2);
    return ind + "<" + node.type + " " + attrs[0] + "\n"
      + attrs.slice(1).map((a) => pad + a).join("\n") + close;
  }

  /* a <DataTemplate x:DataType="vm:Item"> binding each field in a horizontal
     StackPanel: TextBlocks for value fields, a small Rectangle for IBrush fields */
  function fieldRowAxaml(field, depth) {
    const ind = indentOf(depth);
    if (field.type === "IBrush") {
      return ind + '<Rectangle Width="16" Height="16" Fill="{Binding ' + xmlEsc(field.name) + '}"/>';
    }
    return ind + '<TextBlock Text="{Binding ' + xmlEsc(field.name) + '}"/>';
  }

  /* G2: a single-shape item template. The shape binds Width/Height to the model and
     Fill to the brush field when the model has one, else a neutral default fill. */
  function shapeTemplateAxaml(model, depth) {
    const ind = indentOf(depth);
    const brush = brushFieldName(model);
    const fill = brush
      ? 'Fill="{Binding ' + xmlEsc(brush) + '}"'
      : 'Fill="SteelBlue"';
    const fields = (model && model.fields) || [];
    const hasField = function (n) { return fields.some(function (f) { return f.name === n; }); };
    /* Only bind Width/Height to the model when those fields actually exist. Under
       compiled bindings (AvaloniaUseCompiledBindingsByDefault), a {Binding Width} to a
       model that has no Width property is a hard AVLN2000 build error — not a silent
       no-op. When the field is absent, emit a literal default size so the shape is still
       visible and the AXAML compiles. */
    const w = hasField("Width") ? 'Width="{Binding Width}"' : 'Width="40"';
    const h = hasField("Height") ? 'Height="{Binding Height}"' : 'Height="40"';
    return ind + "<" + model.templateShape + " " + w + " " + h + " " + fill + "/>";
  }

  function itemTemplateAxaml(hostType, model, depth) {
    const ind = indentOf(depth);
    const ind1 = indentOf(depth + 1);
    const ind2 = indentOf(depth + 2);
    const lines = [];
    lines.push(ind + "<" + hostType + ".ItemTemplate>");
    lines.push(ind1 + '<DataTemplate x:DataType="vm:' + dataTypeName(model) + '">');
    if (model.templateShape) {
      /* G2: render each item as one Ellipse/Rectangle instead of the debug list */
      lines.push(shapeTemplateAxaml(model, depth + 2));
    } else {
      lines.push(ind2 + '<StackPanel Orientation="Horizontal" Spacing="8">');
      model.fields.forEach((f) => { lines.push(fieldRowAxaml(f, depth + 3)); });
      lines.push(ind2 + "</StackPanel>");
    }
    lines.push(ind1 + "</DataTemplate>");
    lines.push(ind + "</" + hostType + ".ItemTemplate>");
    return lines.join("\n");
  }

  /* read an explicit Width/Height off an ItemsControl node into canvas bounds (G8).
     Returns null components when the prop is unset/non-positive so callers fall back
     to today's defaults (400 x 300) byte-for-byte. */
  function canvasBoundsOf(node) {
    const props = (node && node.props) || {};
    const w = Number(props.Width), h = Number(props.Height);
    return {
      width: (isFinite(w) && w > 0) ? Math.round(w) : null,
      height: (isFinite(h) && h > 0) ? Math.round(h) : null,
    };
  }

  /* the Summer-2025 free-position idiom for an ItemsControl: a Canvas items panel
     plus a ContentPresenter style binding Canvas.Left/Top to the model's X/Y.
     When the host carries an explicit Width/Height (G8) the inner panel Canvas is
     sized to match so positions and clamps agree; unset stays a bare <Canvas/>. */
  function canvasItemsAxaml(model, depth, bounds) {
    const ind = indentOf(depth);
    const ind1 = indentOf(depth + 1);
    const ind2 = indentOf(depth + 2);
    const b = bounds || {};
    const sizeAttrs = [];
    if (b.width != null) sizeAttrs.push('Width="' + b.width + '"');
    if (b.height != null) sizeAttrs.push('Height="' + b.height + '"');
    const canvasTag = sizeAttrs.length ? "<Canvas " + sizeAttrs.join(" ") + "/>" : "<Canvas/>";
    const lines = [];
    lines.push(ind + "<ItemsControl.ItemsPanel>");
    lines.push(ind1 + "<ItemsPanelTemplate>");
    lines.push(ind2 + canvasTag);
    lines.push(ind1 + "</ItemsPanelTemplate>");
    lines.push(ind + "</ItemsControl.ItemsPanel>");
    lines.push(ind + "<ItemsControl.Styles>");
    lines.push(ind1 + '<Style Selector="ContentPresenter" x:DataType="vm:' + dataTypeName(model) + '">');
    lines.push(ind2 + '<Setter Property="Canvas.Left" Value="{Binding X}"/>');
    lines.push(ind2 + '<Setter Property="Canvas.Top" Value="{Binding Y}"/>');
    lines.push(ind1 + "</Style>");
    lines.push(ind + "</ItemsControl.Styles>");
    return lines.join("\n");
  }

  function emitNode(node, depth, out, injected) {
    if (!node) return "";
    if (!CATALOG[node.type]) {
      return indentOf(depth) + "<!-- skipped unknown element: "
        + xmlEsc(node.type).replace(/--/g, "- -") + " -->";
    }
    const attrs = attrsOf(node, out, injected);
    const def = CATALOG[node.type];
    const model = typedModelOf(node);

    /* items hosts with a typed model emit synthetic template/panel children */
    if (def.itemsHost && model) {
      const inner = [];
      if (node.type === "ItemsControl" && model.canvasItems) {
        inner.push(canvasItemsAxaml(model, depth + 1, canvasBoundsOf(node)));
      }
      inner.push(itemTemplateAxaml(node.type, model, depth + 1));
      return openTag(node, attrs, depth, false) + "\n"
        + inner.join("\n") + "\n"
        + indentOf(depth) + "</" + node.type + ">";
    }

    const kids = (node.children || [])
      .map((c) => emitNode(c, depth + 1, out, injected))
      .filter((s) => s !== "");
    if (kids.length === 0) return openTag(node, attrs, depth, true);
    return openTag(node, attrs, depth, false) + "\n"
      + kids.join("\n") + "\n"
      + indentOf(depth) + "</" + node.type + ">";
  }

  /* G8: the root namespace that fills xmlns:vm / x:Class / `namespace ...`. Defaults
     to the literal "ExamApp" so existing output is byte-identical AND the projzip
     namespace-rewrite path (which replaces \bExamApp\b) keeps working untouched. */
  function projectNamespaceOf(tree) {
    const ns = tree && tree.projectNamespace;
    const s = (ns == null ? "" : String(ns)).trim();
    return s || "ExamApp";
  }

  function generate(tree) {
    const bindings = [];                       // collected {name, vmType, ...}
    const ns = projectNamespaceOf(tree);
    const plan = behaviorPlan(tree);           // Scratch-style behaviors -> injected bindings + command bodies
    const body = emitNode(tree.children[0], 2, bindings, plan.injected);
    const axaml = [
      '<Window xmlns="https://github.com/avaloniaui"',
      '        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"',
      '        xmlns:vm="using:' + ns + '.ViewModels"',
      '        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"',
      '        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
      '        mc:Ignorable="d" d:DesignWidth="' + (tree.props.Width || 600) + '" d:DesignHeight="' + (tree.props.Height || 400) + '"',
      '        x:Class="' + ns + '.Views.MainWindow"',
      '        x:DataType="vm:MainWindowViewModel"',
      '        Title="' + xmlEsc(tree.props.Title || "Exam App") + '"',
      /* size-locked (default): a fixed, non-resizable window so the running app
         keeps the exact layout shown in the designer. Unlock (SizeLocked=false)
         to let the user resize it. */
      '        Width="' + (tree.props.Width || 600) + '" Height="' + (tree.props.Height || 400) + '"'
        + (tree.props.SizeLocked === false ? '' : ' CanResize="False"') + '>',
      '',
      '    <Design.DataContext><vm:MainWindowViewModel/></Design.DataContext>',
      '',
      body || '    <!-- drag a layout container here -->',
      '</Window>', ''
    ].join("\n");
    /* collect distinct typed models for the third (Models/Item.cs) pane */
    const models = collectModels(bindings);
    const vmRes = emitViewModel(bindings, tree, plan.commandBodies);
    const out = { axaml, viewModel: vmRes.code };
    /* regenerate-from-service adds its interface + InMemory impl to the Models pane
       so the paste compiles standalone (usings merged at the top of the file) */
    if (models.length || vmRes.service) {
      out.model = modelsPane(models, vmRes.service || null, ns);
    }
    return out;
  }

  function collectModels(bindings) {
    const seen = {};
    const list = [];
    bindings.forEach((b) => {
      const m = b.model;
      if (!m || seen[m.className]) return;
      seen[m.className] = true;
      list.push(m);
    });
    return list;
  }

  /* ---------------- submission export (spec 16) ----------------
     The professor's final submission is a flat 6-file folder, NO third file:
       Problem_2_MainWindow.axaml + Problem_2_MainWindowViewModel.cs.
     So the VM file must INLINE the typed model class (and any service classes)
     below the ViewModel, in the same namespace, with all using directives merged
     to the top so the single file compiles. The in-app Models pane + the project
     .zip export keep their separate-file layout; only this path inlines.

     A C# file we emit always has the shape:
       <using lines...>
       (blank)
       namespace ExamApp.ViewModels;
       (blank)
       <type bodies...>
     so we split on the namespace line, harvest the `using` lines from the header,
     and keep everything after the namespace as the body. Merging the VM body with
     the model/service bodies under one merged using set + one namespace yields a
     single self-contained file. */
  const SUBMISSION_NS = "namespace ExamApp.ViewModels;";

  /* split one of our generated C# files into { usings:[..], body:"..." }.
     usings keep their full "using X;" text; body is everything from the first
     line after the namespace declaration onward, with surrounding blank lines
     trimmed so we can re-join cleanly. nsMarker defaults to the ExamApp marker so
     existing callers are unchanged; a custom projectNamespace passes its own. */
  function splitCsFile(code, nsMarker) {
    const marker = nsMarker || SUBMISSION_NS;
    const text = String(code == null ? "" : code);
    const nsIdx = text.indexOf(marker);
    if (nsIdx === -1) {
      /* no namespace marker (should not happen for our output): treat the whole
         thing as body, harvest any using lines we can find at the top */
      const lines = text.split("\n");
      const us = [];
      let i = 0;
      for (; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t === "") continue;
        if (/^using\s+[^;]+;$/.test(t)) { us.push(t); continue; }
        break;
      }
      return { usings: us, body: lines.slice(i).join("\n").replace(/^\n+|\n+$/g, "") };
    }
    const head = text.slice(0, nsIdx);
    const after = text.slice(nsIdx + marker.length);
    const usings = head.split("\n")
      .map((l) => l.trim())
      .filter((l) => /^using\s+[^;]+;$/.test(l));
    const body = after.replace(/^\n+|\n+$/g, "");
    return { usings: usings, body: body };
  }

  /* a stable, idiomatic ordering for merged usings: System.* first (ordinal),
     then Avalonia.*, then CommunityToolkit.*, then anything else. Dedupes. */
  function mergeUsings(lists) {
    const seen = {};
    const all = [];
    lists.forEach((list) => (list || []).forEach((u) => {
      if (!u || seen[u]) return;
      seen[u] = true;
      all.push(u);
    }));
    const rank = (u) => {
      const ns = u.replace(/^using\s+/, "").replace(/;$/, "");
      if (ns === "System" || ns.indexOf("System.") === 0) return 0;
      if (ns.indexOf("Avalonia") === 0) return 1;
      if (ns.indexOf("CommunityToolkit") === 0) return 2;
      return 3;
    };
    return all.slice().sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a < b ? -1 : (a > b ? 1 : 0);
    });
  }

  /* every using namespace we emit must be one of System.*, Avalonia*, or
     CommunityToolkit.Mvvm.* (spec 16 allowed-library rule). Returns the list of
     offenders (empty when clean) so a test/caller can assert on it. */
  function foreignUsings(code) {
    const text = String(code == null ? "" : code);
    const bad = [];
    text.split("\n").forEach((l) => {
      const m = /^\s*using\s+(?:static\s+)?([^;]+);\s*$/.exec(l);
      if (!m) return;
      const ns = m[1].trim();
      const ok = ns === "System" || ns.indexOf("System.") === 0
        || ns === "Avalonia" || ns.indexOf("Avalonia.") === 0
        || ns.indexOf("CommunityToolkit.Mvvm") === 0;
      if (!ok) bad.push(ns);
    });
    return bad;
  }

  /* build the flat submission pair for Problem 2 from the working tree:
       { axaml, viewModel } keyed by the EXACT submission file names.
     The axaml is the same complete Window the in-app pane shows (x:Class +
     xmlns:vm consistent with the inlined VM namespace). The viewModel inlines
     the model + service classes below the ViewModel under one merged using set. */
  function submission(tree) {
    const gen = generate(tree);
    /* the namespace marker tracks projectNamespace (G8); default stays ExamApp so
       existing submissions are byte-identical. */
    const nsMarker = "namespace " + projectNamespaceOf(tree) + ".ViewModels;";
    const vmParts = splitCsFile(gen.viewModel, nsMarker);
    const usingLists = [vmParts.usings];
    const bodies = [vmParts.body];
    if (gen.model) {
      const mParts = splitCsFile(gen.model, nsMarker);
      usingLists.push(mParts.usings);
      if (mParts.body) bodies.push(mParts.body);
    }
    const merged = mergeUsings(usingLists);
    const parts = [];
    if (merged.length) parts.push(merged.join("\n"));
    parts.push(nsMarker);
    parts.push(bodies.filter((b) => b && b.trim() !== "").join("\n\n"));
    const viewModel = parts.join("\n\n") + "\n";
    return {
      files: [
        { name: "Problem_2_MainWindow.axaml", text: gen.axaml },
        { name: "Problem_2_MainWindowViewModel.cs", text: viewModel },
      ],
      axaml: gen.axaml,
      viewModel: viewModel,
    };
  }

  /* class bodies only (no usings/namespace) — the Models pane header is assembled
     once in modelsPane() so model classes + a service can share one valid file */
  function modelClassBodies(models) {
    const csTypes = { string: "string", double: "double", int: "int", bool: "bool", IBrush: "IBrush" };
    return models.map((m) => {
      const blocks = m.fields.map((f) => {
        const type = csTypes[f.type] || "string";
        /* non-nullable reference fields need an initializer under Nullable enable
           (CS8618): string -> "", IBrush -> a sensible default brush. */
        let init = ";";
        if (type === "string") init = ' = "";';
        else if (type === "IBrush") init = " = Brushes.SteelBlue;";
        return "    [ObservableProperty]\n    private " + type + " " + camel(f.name) + init;
      });
      return "public partial class " + m.className + " : ObservableObject\n{\n"
        + blocks.join("\n\n") + "\n}";
    }).join("\n\n");
  }

  /* Models/Item.cs : usings + namespace + model classes (+ optional service classes).
     All `using` directives are merged to the top so the file always compiles.
     ns defaults to "ExamApp" (G8) so existing output and the projzip rewrite hold. */
  function modelsPane(models, svc, ns) {
    const root = (ns == null ? "" : String(ns)).trim() || "ExamApp";
    const needsBrush = models.some((m) => m.fields.some((f) => f.type === "IBrush"));
    const usings = [];
    if (svc) usings.push("using System.Collections.Generic;");
    if (needsBrush) usings.push("using Avalonia.Media;");
    if (models.length) usings.push("using CommunityToolkit.Mvvm.ComponentModel;");
    const parts = [];
    if (usings.length) parts.push(usings.join("\n"));
    parts.push("namespace " + root + ".ViewModels;");
    if (models.length) parts.push(modelClassBodies(models));
    if (svc) parts.push(serviceClassBodies(svc));
    return parts.join("\n\n") + "\n";
  }

  /* ---------------- codegen: ViewModel ---------------- */
  function camel(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  /* a human noun for a count display from a collection name: "Rectangles" ->
     "rectangles", "Items" -> "items". Falls back to "items" when empty. */
  function countLabelFor(collName) {
    const s = String(collName == null ? "" : collName).trim();
    if (!s) return "items";
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  /* method name a [RelayCommand] generates from a binding: strip the Command suffix */
  function methodNameFor(b) { return b.name.replace(/Command$/, "") || b.name; }

  const RECIPE_IDS = ["none", "add-random-item", "remove-selected", "clear-all",
    "regenerate-from-service", "counter-increment",
    "timer-toggle", "timer-start", "timer-stop", "timer-reset"];

  /* a stable sample-strings literal + a brush palette literal, reused across recipes */
  const SAMPLE_STRINGS = '"Alpha", "Bravo", "Charlie", "Delta", "Echo"';

  function fieldByName(model, name) {
    return (model && model.fields ? model.fields : []).find((f) => f.name === name) || null;
  }
  /* numeric clamp/value expression for one model field inside add-random-item */
  function randomFieldExpr(f, model, ctx) {
    const canvas = model && model.canvasItems;
    if (f.type === "IBrush") return f.name + " = " + ctx.brushPick + ",";
    if (f.type === "string") return f.name + " = " + ctx.stringPick + ",";
    if (f.type === "bool") return f.name + " = _random.Next(2) == 1,";
    /* numeric (double/int) */
    if (canvas && (f.name === "X")) {
      const wf = fieldByName(model, "Width");
      return "X = _random.Next(0, (int)(CanvasWidth - " + (wf ? "w" : "20") + ")),";
    }
    if (canvas && (f.name === "Y")) {
      const hf = fieldByName(model, "Height");
      return "Y = _random.Next(0, (int)(CanvasHeight - " + (hf ? "h" : "20") + ")),";
    }
    if (f.name === "Width") return "Width = w,";
    if (f.name === "Height") return "Height = h,";
    return f.name + " = _random.Next(0, 100),";
  }

  function emitViewModel(bindings, tree, commandBodies) {
    commandBodies = commandBodies || {};
    /* dedupe by name, first descriptor wins */
    const seen = {};
    const list = [];
    bindings.forEach((b) => {
      if (b.modelOnly || !b.name || seen[b.name]) return;
      seen[b.name] = true;
      list.push(b);
    });

    const propTypes = { string: "string", "string?": "string?", double: "double", int: "int", bool: "bool", brush: "IBrush" };
    const observables = list.filter((b) => propTypes[b.vmType]);
    const collections = list.filter((b) => b.vmType === "collection");
    const selected = list.filter((b) => b.vmType === "selectedItem");
    const selectedMany = list.filter((b) => b.vmType === "selectedItems");
    const commands = list.filter((b) => b.vmType === "command");

    /* recipe context: resolve the (single) primary collection + selected item the
       recipes act on. Exam designs use one items host, so first wins. */
    const primaryColl = collections[0] || null;
    const primarySel = selected[0] || null;
    const timer = (tree && tree.timer && tree.timer.enabled) ? normalizeTimer(tree.timer) : null;

    /* a "CountText" string property bound to a TextBlock is meant to mirror the
       primary collection's count (Summer RectangleUI shows the rectangle count).
       When such a property + a collection both exist, recompute it whenever the
       collection changes (covers add / remove / clear / seeding) instead of leaving
       the bound display permanently empty. */
    const countTextProp = (primaryColl
      ? observables.find((b) => b.name === "CountText" && b.vmType === "string")
      : null) || null;

    const recipeOf = {};
    commands.forEach((b) => { recipeOf[b.name] = b.recipe || "none"; });
    const usedRecipes = commands.map((b) => recipeOf[b.name]);
    const has = (r) => usedRecipes.indexOf(r) !== -1;
    /* when a CONTINUOUS timer (recolor/reposition/custom) is enabled but NO timer-*
       command controls it (the Summer recolor case: only an Add command), it must
       auto-start at construction so the design actually ticks. A counter timer is
       always user-driven (Start/Stop/Reset, exam P3 semantics) — never auto-start it,
       and always keep its full stop/reset surface so reset can zero the count. */
    const timerHasController = has("timer-toggle") || has("timer-start");
    const isCounterTimer = !!timer && timer.action === "increment-counter";
    const autoStartTimer = !!timer && !isCounterTimer && !timerHasController;

    /* a typed collection needs a seeded constructor example referencing its model */
    const typedColls = collections.filter((b) => b.elementType && b.elementType !== "string");
    const collModel = primaryColl && primaryColl.model ? primaryColl.model : null;
    const collHasBrush = !!(collModel && collModel.fields.some((f) => f.type === "IBrush"));

    /* ---- decide which helper fields/usings the chosen recipes + timer require ---- */
    const wantAddRandom = has("add-random-item");
    const wantService = has("regenerate-from-service");
    const wantCounter = has("counter-increment") || (timer && timer.action === "increment-counter");
    /* "recolor-reposition" does both, so it must trip BOTH gates (palette + canvas
       bounds + Random) — the exact Summer P2.3 requirement: move AND recolor every 2s. */
    const timerRecolor = timer && (timer.action === "recolor-items" || timer.action === "recolor-reposition");
    const timerReposition = timer && (timer.action === "reposition-items" || timer.action === "recolor-reposition");

    const needRandom = wantAddRandom || timerRecolor || timerReposition;
    const needPalette = (wantAddRandom && collHasBrush) || (timerRecolor && collHasBrush);
    /* add-random-item references _samples either for a string field of a typed
       model, OR for a plain strings collection (no model → picks a sample string) */
    const needSamples = wantAddRandom && primaryColl
      && (collModel ? collModel.fields.some((f) => f.type === "string") : true);
    const needCanvasBounds = (wantAddRandom && collModel && collModel.canvasItems)
      || timerReposition;
    const needBrushUsing = collHasBrush || needPalette
      || observables.some((b) => b.vmType === "brush")
      || (collections.some((b) => b.model && b.model.fields.some((f) => f.type === "IBrush")));

    /* ---- usings ---- */
    const lines = [];
    if (needRandom) lines.push("using System;");
    if (collections.length || selectedMany.length) lines.push("using System.Collections.ObjectModel;");
    if (timer && timer.mechanism === "task") {
      lines.push("using System.Threading;");
      lines.push("using System.Threading.Tasks;");
    }
    if (needBrushUsing) lines.push("using Avalonia.Media;");
    if (timer) lines.push("using Avalonia.Threading;");
    lines.push("using CommunityToolkit.Mvvm.ComponentModel;");
    if (commands.length) lines.push("using CommunityToolkit.Mvvm.Input;");
    lines.push("");
    lines.push("namespace " + projectNamespaceOf(tree) + ".ViewModels;");
    lines.push("");
    lines.push("public partial class MainWindowViewModel : ObservableObject");
    lines.push("{");

    const blocks = [];

    /* ---- helper fields (Random, palette, samples, canvas bounds, timer) ---- */
    const helperFieldLines = [];
    if (needCanvasBounds) {
      /* G8: when the host ItemsControl carries an explicit Width/Height, the clamp
         constants match the inner Canvas so spawned items stay in view. Unset keeps
         today's 400 x 300 defaults byte-for-byte. */
      const cb = (collModel && collModel.canvasBounds) || {};
      const cw = cb.width != null ? cb.width : 400;
      const ch = cb.height != null ? cb.height : 300;
      helperFieldLines.push("    private const double CanvasWidth = " + cw + ";");
      helperFieldLines.push("    private const double CanvasHeight = " + ch + ";");
    }
    if (needRandom) helperFieldLines.push("    private readonly Random _random = new();");
    if (needPalette) {
      helperFieldLines.push("    private static readonly IBrush[] _palette =\n"
        + "        { Brushes.SteelBlue, Brushes.IndianRed, Brushes.SeaGreen, Brushes.Goldenrod, Brushes.MediumPurple };");
    }
    if (needSamples) {
      helperFieldLines.push("    private static readonly string[] _samples =\n"
        + "        { " + SAMPLE_STRINGS + " };");
    }
    if (helperFieldLines.length) blocks.push(helperFieldLines.join("\n"));

    /* ---- observable scalar properties ---- */
    /* a counter (Count) is always int even if bound from a TextBlock.Text (string):
       Avalonia converts int → string for display, and Count++/Count=0 need int */
    observables.forEach((b) => {
      let type = propTypes[b.vmType];
      if (wantCounter && b.name === "Count") type = "int";
      // a behavior-injected member carries its own initializer (IsVisible -> true, a text
      // member -> the target's current text). Otherwise use the type's sensible default.
      const init = (b.binit != null) ? b.binit
        : (type === "string" ? ' = "";' : (type === "IBrush" ? " = Brushes.Gray;" : ";"));
      blocks.push("    [ObservableProperty]\n    private " + type + " " + camel(b.name) + init);
    });

    /* counter property (int Count) when a counter-increment recipe / timer needs it
       and no binding already introduced a Count member */
    if (wantCounter && !observables.some((b) => b.name === "Count")) {
      blocks.push("    [ObservableProperty]\n    private int count;");
    }

    /* ---- collections ---- */
    collections.forEach((b) => {
      const el = (b.elementType && b.elementType !== "string") ? b.elementType : "string";
      blocks.push("    public ObservableCollection<" + el + "> " + b.name + " { get; } = new();");
    });

    /* ---- ctor-injected service for regenerate-from-service ---- */
    let svc = null;
    if (wantService && primaryColl) {
      svc = serviceContext(primaryColl, tree);
      blocks.push("    private readonly " + svc.iface + " " + svc.field + ";");
    }

    /* ---- selected item + OnXChanged hook ---- */
    selected.forEach((b) => {
      const itemType = (b.itemType && b.itemType !== "string") ? b.itemType + "?" : "string?";
      blocks.push("    [ObservableProperty]\n    private " + itemType + " " + camel(b.name) + ";");
      const bare = itemType.replace(/\?$/, "");
      blocks.push("    // use this to drive multi-select highlighting (ReExam P2.3)\n"
        + "    partial void On" + b.name + "Changed(" + bare + "? value)\n    {\n"
        + "        // react to the new selection here\n    }");
    });

    /* ---- SelectedItems: a VM-side ObservableCollection the multi-select binds to
       (G6). ListBox.SelectedItems is IList; an ObservableCollection<T> satisfies it
       and lets the VM read/sync the selection without code-behind. */
    selectedMany.forEach((b) => {
      const el = (b.itemType && b.itemType !== "string") ? b.itemType : "string";
      blocks.push("    // multi-selection synced from the ListBox (bind SelectedItems=\"{Binding "
        + b.name + "}\")\n"
        + "    public ObservableCollection<" + el + "> " + b.name + " { get; } = new();");
    });

    /* ---- timer field ---- */
    if (timer) blocks.push(timerFieldBlock(timer));

    /* ---- constructor (service injection, seeded items, timer construction) ---- */
    const ctorBody = [];
    if (svc) {
      ctorBody.push("        " + svc.field + " = " + svc.paramName + ";");
    }
    /* seed example items only when NOT regenerating from a service (service repopulates) */
    if (!svc) {
      typedColls.forEach((b) => {
        const m = b.model;
        const inits = (m ? m.fields : []).map((f) => f.name + " = " + seedFieldValue(f)).join(", ");
        ctorBody.push("        " + b.name + ".Add(new " + b.elementType + " { " + inits + " });");
      });
    }
    if (timer && timer.mechanism === "dispatcher") {
      ctorBody.push("        _timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds("
        + timer.intervalMs + ") };");
      ctorBody.push("        _timer.Tick += (_, _) => OnTick();");
    }
    if (svc) ctorBody.push("        " + svc.regenMethod + "();");
    /* keep the bound count text in sync with the collection: recompute on every
       add / remove / clear, and once now for the seeded items. */
    if (countTextProp && primaryColl) {
      ctorBody.push("        " + primaryColl.name + ".CollectionChanged += (_, _) => UpdateCountText();");
      ctorBody.push("        UpdateCountText();");
    }
    /* auto-start an uncontrolled timer so the preset runs on launch (Summer P2) */
    if (autoStartTimer) ctorBody.push("        StartTimer();");
    if (svc || ctorBody.length) {
      if (svc) {
        /* the DI ctor needs a provider, but the starter kit's App.axaml.cs constructs the
           VM with `new MainWindowViewModel()`. Emit a parameterless ctor that chains to the
           DI overload with the InMemory implementation so the pasted code compiles against
           the unmodified harness (no CS7036), while keeping the injected overload for tests. */
        blocks.push("    public MainWindowViewModel() : this(new " + svc.impl + "()) { }");
        blocks.push("    public MainWindowViewModel(" + svc.iface + " " + svc.paramName + ")\n    {\n" + ctorBody.join("\n") + "\n    }");
      } else {
        blocks.push("    public MainWindowViewModel()\n    {\n" + ctorBody.join("\n") + "\n    }");
      }
    }

    /* ---- command methods (recipe bodies) ---- */
    /* if the design has slider-bound size properties (a double VM prop named like
       NewWidth / RectHeight), the add-random recipe sizes new items FROM them rather
       than a random fallback — the exam wants "width/height according to the sliders". */
    const sizeWProp = (observables.find((b) => b.vmType === "double" && /width/i.test(b.name)) || {}).name;
    const sizeHProp = (observables.find((b) => b.vmType === "double" && /height/i.test(b.name)) || {}).name;
    commands.forEach((b) => {
      // a behavior-driven command (from the Behaviors panel) carries a precomputed body
      // that sets the target ViewModel members; it takes precedence over any recipe.
      const bb = commandBodies[b.name];
      if (bb && bb.length) {
        blocks.push("    [RelayCommand]\n    private void " + methodNameFor(b) + "()\n    {\n" + bb.join("\n") + "\n    }");
        return;
      }
      blocks.push(commandBlock(b, recipeOf[b.name], {
        coll: primaryColl, sel: primarySel, timer: timer, svc: svc, collModel: collModel,
        sizeWProp: sizeWProp, sizeHProp: sizeHProp,
      }));
    });

    /* ---- UpdateCountText(): mirror the collection count into the bound text ---- */
    if (countTextProp && primaryColl) {
      const noun = countLabelFor(primaryColl.name);
      blocks.push("    private void UpdateCountText()\n    {\n"
        + "        " + countTextProp.name + " = $\"{" + primaryColl.name + ".Count} " + noun + "\";\n    }");
    }

    /* ---- Regenerate(): clears + repopulates the collection from the service ---- */
    if (svc && primaryColl) {
      blocks.push("    private void " + svc.regenMethod + "()\n    {\n"
        + "        " + primaryColl.name + ".Clear();\n"
        + "        foreach (var item in " + svc.field + ".GetItems())\n"
        + "        {\n"
        + "            " + primaryColl.name + ".Add(item);\n"
        + "        }\n    }");
    }

    /* ---- timer plumbing methods (OnTick + Task loop helpers) ----
       emit Stop/Reset only when a timer-* command (or toggle) can call them; an
       auto-started, uncontrolled timer (Summer recolor) only needs StartTimer. */
    if (timer) blocks.push.apply(blocks, timerMethodBlocks(timer, {
      coll: primaryColl, collModel: collModel, collHasBrush: collHasBrush,
      emitStop: !autoStartTimer || has("timer-stop") || has("timer-toggle"),
      emitReset: !autoStartTimer || has("timer-reset"),
    }));

    if (blocks.length) lines.push(blocks.join("\n\n"));
    lines.push("}");
    lines.push("");

    const result = { code: lines.join("\n") };
    if (svc) result.service = svc;
    return result;
  }

  /* default timer config + normalization (clamps + fills defaults) */
  function normalizeTimer(t) {
    const action = t.action || "custom";
    const mechanism = t.mechanism === "task" ? "task" : "dispatcher";
    let intervalMs = parseInt(t.intervalMs, 10);
    if (isNaN(intervalMs) || intervalMs <= 0) intervalMs = action === "increment-counter" ? 100 : 2000;
    return { enabled: true, action, mechanism, intervalMs };
  }

  /* service interface/impl context for regenerate-from-service */
  function serviceContext(coll, tree) {
    const cfg = (tree && tree.service) || {};
    const el = (coll.elementType && coll.elementType !== "string") ? coll.elementType : "string";
    const iface = (cfg.interfaceName || "IItemProvider").trim() || "IItemProvider";
    const impl = (cfg.implName || ("InMemory" + iface.replace(/^I/, ""))).trim();
    return {
      iface: iface, impl: impl, element: el,
      field: "_provider", paramName: "provider",
      regenMethod: "Regenerate",
      collName: coll.name, model: coll.model || null,
    };
  }

  function seedFieldValue(f) {
    switch (f.type) {
      case "double": return f.name === "Width" || f.name === "Height" ? "60" : "0";
      case "int": return "0";
      case "bool": return "false";
      case "IBrush": return "Brushes.SteelBlue";
      default: return '"' + (f.name || "value") + '"';
    }
  }

  /* ---------------- recipe command bodies ---------------- */
  function commandBlock(b, recipe, ctx) {
    const method = methodNameFor(b);
    const body = recipeBody(recipe, ctx);
    return "    [RelayCommand]\n    private void " + method + "()\n    {\n" + body + "\n    }";
  }

  function recipeBody(recipe, ctx) {
    const coll = ctx.coll, sel = ctx.sel, model = ctx.collModel;
    if (recipe === "clear-all") {
      if (!coll) return "        // TODO: no collection in the design to clear";
      return "        " + coll.name + ".Clear();";
    }
    if (recipe === "remove-selected") {
      if (!coll) return "        // TODO: no collection in the design";
      const selName = sel ? sel.name : "SelectedItem";
      return "        if (" + selName + " != null)\n"
        + "        {\n"
        + "            " + coll.name + ".Remove(" + selName + ");\n"
        + "        }";
    }
    if (recipe === "counter-increment") {
      return "        Count++;";
    }
    if (recipe === "regenerate-from-service") {
      return "        Regenerate();";
    }
    if (recipe === "add-random-item") {
      return addRandomBody(coll, model, ctx);
    }
    if (recipe === "timer-toggle" || recipe === "timer-start" || recipe === "timer-stop"
        || recipe === "timer-reset") {
      /* these reference StartTimer/StopTimer/ResetTimer/_timerRunning, which are only
         emitted when the tree has an enabled timer. Without one the VM would not
         compile (CS0103), so guard like the no-collection clear-all/remove-selected
         cases and tell the user to enable the Timer panel. */
      if (!ctx.timer) {
        return "        // TODO: enable the Timer panel to generate StartTimer/StopTimer (this recipe needs it)";
      }
      if (recipe === "timer-toggle") {
        return "        if (_timerRunning) StopTimer(); else StartTimer();";
      }
      if (recipe === "timer-start") return "        StartTimer();";
      if (recipe === "timer-stop") return "        StopTimer();";
      return "        ResetTimer();";  /* timer-reset */
    }
    return "        // TODO: implement";  /* recipe "none" */
  }

  function addRandomBody(coll, model, ctx) {
    if (!coll) return "        // TODO: no collection in the design to add to";
    if (!model) {
      /* strings collection */
      return "        " + coll.name + ".Add(_samples[_random.Next(_samples.Length)]);";
    }
    const lines = [];
    const hasW = !!fieldByName(model, "Width");
    const hasH = !!fieldByName(model, "Height");
    /* prefer the slider-bound size property (exam 2.2: "sized by the sliders"); cast the
       double to int for the clamp math, falling back to a random size when no slider exists. */
    const wProp = ctx && ctx.sizeWProp, hProp = ctx && ctx.sizeHProp;
    if (hasW) lines.push(wProp ? "        int w = (int)" + wProp + ";" : "        int w = _random.Next(20, 120);");
    if (hasH) lines.push(hProp ? "        int h = (int)" + hProp + ";" : "        int h = _random.Next(20, 120);");
    lines.push("        " + coll.name + ".Add(new " + coll.elementType + "");
    lines.push("        {");
    const ctxExpr = {
      brushPick: "_palette[_random.Next(_palette.Length)]",
      stringPick: "_samples[_random.Next(_samples.Length)]",
    };
    model.fields.forEach((f) => {
      lines.push("            " + randomFieldExpr(f, model, ctxExpr));
    });
    lines.push("        });");
    return lines.join("\n");
  }

  /* ---------------- timer codegen ---------------- */
  function timerFieldBlock(timer) {
    const lines = [];
    if (timer.mechanism === "dispatcher") {
      lines.push("    private readonly DispatcherTimer _timer;");
      lines.push("    private bool _timerRunning;");
    } else {
      lines.push("    private CancellationTokenSource? _cts;");
      lines.push("    private bool _timerRunning;");
    }
    return lines.join("\n");
  }

  function timerMethodBlocks(timer, ctx) {
    const blocks = [];
    /* Stop/Reset emitted only when something can call them (timer-* recipes); an
       uncontrolled auto-started timer needs only Start. Default true so callers
       that pass no flags keep the full start/stop/reset surface. */
    const emitStop = ctx.emitStop !== false;
    const emitReset = ctx.emitReset !== false;
    /* start/stop/reset wired to timer-* recipe commands */
    if (timer.mechanism === "dispatcher") {
      blocks.push("    private void StartTimer()\n    {\n"
        + "        _timer.Start();\n"
        + "        _timerRunning = true;\n    }");
      if (emitStop) blocks.push("    private void StopTimer()\n    {\n"
        + "        // pause: keeps Count / item state so resume continues\n"
        + "        _timer.Stop();\n"
        + "        _timerRunning = false;\n    }");
      if (emitReset) blocks.push("    private void ResetTimer()\n    {\n"
        + "        _timer.Stop();\n"
        + "        _timerRunning = false;\n"
        + resetStateLine(timer)
        + "    }");
      blocks.push("    // DispatcherTimer already ticks on the UI thread\n"
        + "    private void OnTick()\n    {\n" + tickActionBody(timer, ctx, false) + "\n    }");
    } else {
      /* Task.Delay loop + CancellationTokenSource */
      blocks.push("    private void StartTimer()\n    {\n"
        + "        if (_timerRunning) return;\n"
        + "        _timerRunning = true;\n"
        + "        _cts = new CancellationTokenSource();\n"
        + "        _ = RunLoopAsync(_cts.Token);\n    }");
      if (emitStop) blocks.push("    private void StopTimer()\n    {\n"
        + "        // pause: cancel the loop but keep state so resume continues\n"
        + "        _cts?.Cancel();\n"
        + "        _timerRunning = false;\n    }");
      if (emitReset) blocks.push("    private void ResetTimer()\n    {\n"
        + "        _cts?.Cancel();\n"
        + "        _timerRunning = false;\n"
        + resetStateLine(timer)
        + "    }");
      blocks.push("    private async Task RunLoopAsync(CancellationToken token)\n    {\n"
        + "        try\n"
        + "        {\n"
        + "            while (!token.IsCancellationRequested)\n"
        + "            {\n"
        + "                await Task.Delay(" + timer.intervalMs + ", token);\n"
        + "                // UI thread: required (we are on a background task here)\n"
        + "                Dispatcher.UIThread.Post(OnTick);\n"
        + "            }\n"
        + "        }\n"
        + "        catch (TaskCanceledException)\n"
        + "        {\n"
        + "            // expected when Stop/Reset cancels the token mid-delay\n"
        + "        }\n    }");
      blocks.push("    private void OnTick()\n    {\n" + tickActionBody(timer, ctx, true) + "\n    }");
    }
    return blocks;
  }

  /* reset zeroes counter state where the action is a counter */
  function resetStateLine(timer) {
    if (timer.action === "increment-counter") return "        Count = 0;\n";
    return "";
  }

  /* the per-tick action body (recolor / reposition / increment / custom) */
  function tickActionBody(timer, ctx, isBackground) {
    const coll = ctx.coll, model = ctx.collModel;
    if (timer.action === "increment-counter") {
      return "        Count++;";
    }
    if (timer.action === "recolor-items") {
      if (!coll || !ctx.collHasBrush) return "        // TODO: needs a typed collection with an IBrush field";
      const brushField = (model.fields.find((f) => f.type === "IBrush") || { name: "Brush" }).name;
      return "        foreach (var item in " + coll.name + ")\n"
        + "        {\n"
        + "            item." + brushField + " = _palette[_random.Next(_palette.Length)];\n"
        + "        }";
    }
    if (timer.action === "reposition-items" || timer.action === "recolor-reposition") {
      if (!coll || !model) return "        // TODO: needs a typed collection with X/Y fields";
      /* only subtract item.Width/Height when the model actually declares those fields;
         a shape model that has no Width/Height (e.g. an Ellipse positioned by X/Y only)
         would otherwise reference a member that does not exist (CS1061). Fall back to a
         constant margin so the items stay inside the canvas either way. */
      const wExpr = fieldByName(model, "Width") ? "item.Width" : "20";
      const hExpr = fieldByName(model, "Height") ? "item.Height" : "20";
      /* recolor-reposition also assigns a new brush in the SAME loop (one pass, all on
         the UI thread via the DispatcherTimer) — this is the move-AND-recolour answer. */
      const brushField = (timer.action === "recolor-reposition" && ctx.collHasBrush)
        ? (model.fields.find((f) => f.type === "IBrush") || { name: "Brush" }).name : null;
      return "        foreach (var item in " + coll.name + ")\n"
        + "        {\n"
        + "            item.X = _random.Next(0, (int)(CanvasWidth - " + wExpr + "));\n"
        + "            item.Y = _random.Next(0, (int)(CanvasHeight - " + hExpr + "));\n"
        + (brushField ? "            item." + brushField + " = _palette[_random.Next(_palette.Length)];\n" : "")
        + "        }";
    }
    return "        // TODO: custom tick action";
  }

  /* the service interface + InMemory implementation class bodies for the Models pane
     (no usings/namespace — modelsPane() supplies those) */
  function serviceClassBodies(svc) {
    const el = svc.element;
    const lines = [];
    lines.push("// service for regenerate-from-service");
    lines.push("public interface " + svc.iface);
    lines.push("{");
    lines.push("    IEnumerable<" + el + "> GetItems();");
    lines.push("}");
    lines.push("");
    lines.push("public class " + svc.impl + " : " + svc.iface);
    lines.push("{");
    lines.push("    public IEnumerable<" + el + "> GetItems()");
    lines.push("    {");
    if (svc.model) {
      const inits = svc.model.fields.map((f) => f.name + " = " + seedFieldValue(f)).join(", ");
      lines.push("        return new[]");
      lines.push("        {");
      lines.push("            new " + el + " { " + inits + " },");
      lines.push("            new " + el + " { " + inits + " },");
      lines.push("        };");
    } else {
      lines.push("        return new[] { " + SAMPLE_STRINGS + " };");
    }
    lines.push("    }");
    lines.push("}");
    return lines.join("\n");
  }

  /* recipe options keyed by the *intent* a bound command serves; the UI offers
     only the recipes that make sense for the current design (helped by hints) */
  const RECIPE_LABELS = {
    "none": "none (TODO stub)",
    "add-random-item": "add random item",
    "remove-selected": "remove selected",
    "clear-all": "clear all",
    "regenerate-from-service": "regenerate from service",
    "counter-increment": "counter +1",
    "timer-toggle": "timer start/stop",
    "timer-start": "timer start",
    "timer-stop": "timer stop",
    "timer-reset": "timer reset",
  };
  const TIMER_ACTIONS = ["recolor-items", "reposition-items", "recolor-reposition", "increment-counter", "custom"];
  const TIMER_MECHANISMS = ["dispatcher", "task"];
  function defaultTimer() {
    return { enabled: true, intervalMs: 2000, mechanism: "dispatcher", action: "recolor-items" };
  }

  /* ---------------- export ---------------- */
  const CORE = { CATALOG, PALETTE_GROUPS, PLAIN, COLORS, inertAlignmentAxis, createNode, findNode, findParent,
                 canContain, addChild, removeNode, moveNode, walk, generate,
                 submission, foreignUsings,
                 syncIdSeq, cloneSubtree, placeAtCanvasPoint, serialize, deserialize,
                 RECIPE_IDS, RECIPE_LABELS, TIMER_ACTIONS, TIMER_MECHANISMS, defaultTimer,
                 BEHAVIOR_ACTIONS };
  global.DESIGNER_CORE = CORE;
  if (typeof module !== "undefined" && module.exports) module.exports = CORE;
})(typeof window !== "undefined" ? window : globalThis);
