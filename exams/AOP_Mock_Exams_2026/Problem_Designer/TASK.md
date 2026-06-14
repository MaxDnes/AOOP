# Problem 2 (alternative) - Visual Designer (build from a sketch)

Reproduce the "Temperature Converter" layout in the **Visual Designer** tab, then
Generate + export the AXAML.

```
+--------------------------------------------------+
|  Temperature Converter            (Title, H1)    |
|                                                  |
|  Celsius:      [ __________ ]   (label + TextBox)|
|  Fahrenheit:   [ __________ ]   (label + TextBox)|
|                                                  |
|            [   Convert   ]      (Button)         |
|                                                  |
|  Result: 0 C = 32 F             (TextBlock)      |
+--------------------------------------------------+
```

Controls: title TextBlock, two labelled TextBoxes (`CelsiusBox`, `FahrenheitBox`),
a centered `ConvertButton`, a result TextBlock. Keep the window size-locked so the
layout holds when run.

Full task statement: see `../MOCK_EXAM_PACK.md` (Problem 2 alternative - Visual Designer).
Deliverable: `Problem_2_MainWindow.axaml`.
