# Problem 3 - Async (config-driven, no input file to paste)

Build the **download progress simulator** ViewModel in the **Async Composer** tab.

Config to enter:
- Pattern: **progress**
- Mechanism: **timer** (DispatcherTimer) - then also try **task** to compare
- Interval: **200** ms
- Step: **5**
- Stop at max: **100**
- Commands: **Start**, **Pause**, **Reset**
- Thread safety: all UI updates on the UI thread

Full task statement and self-check: see `../MOCK_EXAM_PACK.md` (Problem 3 - Async Composer).
Deliverable: `Problem_3_MainWindowViewModel.cs` (+ `.axaml` if the paper asks).
