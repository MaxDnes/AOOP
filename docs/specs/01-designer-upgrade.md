# Spec 01: Visual Designer upgrade ("drag and drop, get full Avalonia code")

Read docs/specs/00-master-plan.md first. You own ONLY: data/designer-core.js,
data/designer.js, designer.css, tests/designer-core.test.js, tests/designer-ui.test.js.
Read all five files fully before changing anything; extend the existing architecture
(catalog in designer-core, tree ops, genAxaml/genViewModel, DESIGNER.render/init UI),
do not rewrite it.

## Features

### 1. Canvas pixel-accurate drop (highest priority)
Today onDrop ignores coordinates, every Canvas child lands at 0,0. Fix: when the drop
target (or resolved ancestor) is a Canvas, compute the drop point from the drop event
relative to the Canvas preview element's bounding rect, divide out any scale, round to
integers, clamp >= 0, and set Canvas.Left / Canvas.Top attached props on the dropped
node. Applies to BOTH new palette drops and moves of existing elements.

### 2. Drag-to-move Canvas children on the stage
mousedown (not HTML5 dnd) on an element whose parent is a Canvas starts a move: track
pointer, live-update Canvas.Left/Top (visual + state on mouseup, or throttled state
updates), integer snapping, hold Shift for an 8px grid. Cursor: move. Keep HTML5 dnd
for palette-to-stage and reparenting drops on non-Canvas containers.

### 3. Resize handles
Selected element shows 8 corner/edge grips (8px cyan squares, amber on hover).
Dragging writes Width/Height (min 8, integers). For Canvas children, W/N edges also
adjust Canvas.Left/Top so the opposite edge stays anchored. Works for shapes and
controls that have Width/Height in their catalog props.

### 4. Undo/redo
Snapshot the serialized tree + selection before every mutation (setProp, drop, move,
delete, recolor, duplicate, import, preset load). Cap 100 entries. Ctrl+Z undo,
Ctrl+Y / Ctrl+Shift+Z redo, hooked into the existing guarded onKey handler (route
check already exists). Toolbar gets undo/redo buttons with disabled states.

### 5. Duplicate
Ctrl+D and an inspector button: deep-clone selected subtree with fresh ids (reuse the
id-sequence logic), insert after the original; if a Canvas child, offset the clone
+12,+12 so it is visible.

### 6. Typed-model ItemsSource (exam-critical codegen)
ListBox / ComboBox / new ItemsControl get an items mode choice: "strings" (current
behavior) or "typed model". Typed model config in the inspector: model class name
(default Item) and a fields editor (list of name:type rows, types offered: string,
double, int, bool, IBrush). Codegen then produces:
- a THIRD output pane "Models/Item.cs": `public partial class Item : ObservableObject`
  with [ObservableProperty] fields (camelCase backing fields), using CommunityToolkit.
- ViewModel: `ObservableCollection<Item>` plus a seeded constructor example.
- AXAML: `<ListBox.ItemTemplate><DataTemplate x:DataType="vm:Item">...` binding each
  field in a horizontal StackPanel (TextBlocks; IBrush fields bind a small Rectangle
  Fill).
For ItemsControl add a checkbox "Canvas items panel (free position)" that emits the
Summer-2025 idiom verbatim:
  `<ItemsControl.ItemsPanel><ItemsPanelTemplate><Canvas/></ItemsPanelTemplate></ItemsControl.ItemsPanel>`
  plus `<ItemsControl.Styles><Style Selector="ContentPresenter" x:DataType="vm:Item">
  <Setter Property="Canvas.Left" Value="{Binding X}"/>...` with X/Y double fields
  auto-added to the model if missing.

### 7. ListBox selection codegen (ReExam idiom)
ListBox props gain SelectionMode (Single/Multiple) emitted to AXAML, and a
"bind SelectedItem" toggle that emits `SelectedItem="{Binding SelectedX}"` plus an
[ObservableProperty] of the item type in the VM and a comment showing the generated
`partial void OnSelectedXChanged(T value)` hook with a note "use this to drive
multi-select highlighting (ReExam P2.3)".

### 8. Catalog additions
ItemsControl (container, items mode per #6), TabControl (children are TabItems with
Header prop, preview as tab strip + active page), Expander (Header, IsExpanded),
ToggleSwitch (IsChecked, On/OffContent), NumericUpDown (Value, Minimum, Maximum,
Increment), Separator. Sensible defaultProps, preview approximations fine, AXAML must
be exact and xmlBalanced.

### 9. Color picker
In inspector color rows add a native `<input type="color">` next to the hex text
field (sync both ways; named colors like "Tomato" just show #000 in the picker
without breaking the text value). Swatch row stays.

### 10. Export / Import designs
Toolbar buttons. Export: download JSON {version, current, slots} via Blob + a[download]
(file:// safe). Import: hidden `<input type="file">` + FileReader, validate shape,
re-sync id sequence, toast on success/failure. Protects against a clean browser
profile on the exam machine.

### 11. Exam presets
Two new seeded designs next to the existing ones:
- "Summer 2025 · RectangleUI": Canvas-free-position ItemsControl with typed model
  (X, Y, Width, Height, Brush), two Sliders (width/height) with two-way bindings,
  Add Rectangle Button bound to AddCommand, count TextBlock.
- "ReExam 2025 · MealPlanner": Grid 2 columns + bottom row; left ListBox (typed
  WeekDayItem: Day, RecipeName), right ListBox (strings, SelectionMode=Multiple),
  Generate Button (RelayCommand) spanning bottom, SelectedItem binding on the left
  list with the OnSelectedChanged note.

## Looks
Keep the three-pane layout. Grips cyan, selection outline amber dashed (exists),
move/resize live feedback with --text-faint coordinate badge near cursor (e.g.
"x:120 y:48" / "200x96") in mono font. Toolbar buttons match existing styling.
Third code pane: same chrome as the two existing panes, header "Models/Item.cs",
only visible when a typed model exists.

## Tests (extend the two existing test files; all must pass)
- Canvas drop sets Left/Top from coordinates (expose a pure core helper, e.g.
  placeAtCanvasPoint(tree, nodeId, x, y), and test it).
- Undo/redo round-trip: mutate, undo restores exact serialized tree, redo reapplies.
- Duplicate: fresh unique ids, deep clone, +12 offset on canvas children.
- Typed model codegen: model class contains ObservableObject + [ObservableProperty]
  per field; AXAML contains DataTemplate with x:DataType; ItemsControl canvas mode
  emits ItemsPanelTemplate + ContentPresenter style with Canvas.Left binding;
  xmlBalanced on every generated AXAML.
- SelectionMode + SelectedItem emission; VM gets the [ObservableProperty].
- New catalog types each render to xmlBalanced AXAML with defaults omitted.
- Export/import: serialize -> parse -> identical tree, id sequence safe.

## Definition of done
- Your own test file passes; at session end full `node tests/run-tests.js` green
  (if a NON-designer test fails because parallel agents are mid-edit, note it and
  move on; never edit their files).
- Both exam presets generate AXAML + VM + model that a human can paste into the real
  starter projects (verify against the actual idioms quoted in the master plan).
- No file outside your ownership touched.

## Return (final message, raw JSON)
{"done": bool, "features_shipped": [..], "tests": "X passed",
 "manual_checks": ["things Max should click through"], "skipped": [..], "notes": ".."}
