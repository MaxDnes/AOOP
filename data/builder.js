/* ============ UI BUILDER · compose features → complete code ============ */

(function () {

const FEATURES = [
  { key: "list",   label: "List of items",        desc: "ObservableCollection + ListBox", deps: [] },
  { key: "add",    label: "Input + Add button",    desc: "TextBox + [RelayCommand]",       deps: ["list"] },
  { key: "guard",  label: "CanExecute guard",      desc: "Add disabled while input empty", deps: ["add"] },
  { key: "select", label: "Selection + Delete",    desc: "SelectedItem + delete command",  deps: ["list"] },
  { key: "detail", label: "React to selection",    desc: "On...Changed partial method",    deps: ["select"] },
  { key: "slider", label: "Slider value",          desc: "bound double property",          deps: [] },
  { key: "check",  label: "CheckBox flag",         desc: "bound bool property",            deps: [] },
  { key: "combo",  label: "ComboBox options",      desc: "options list + selected",        deps: [] },
  { key: "canvas", label: "Shapes on a Canvas",    desc: "the full RectangleUI pattern",   deps: [] },
  { key: "timer",  label: "Every 2 seconds",       desc: "DispatcherTimer (UI-thread safe)", deps: [] },
  { key: "async",  label: "Background work",       desc: "async command + Task.Run",       deps: [] },
  { key: "json",   label: "JSON save / load",      desc: "File + JsonSerializer",          deps: ["list"] },
  { key: "status", label: "Status bar",            desc: "bottom bar with live item count", deps: [] },
];

const PRESETS = [
  { name: "ContactList-style", keys: ["list", "add", "guard", "select", "detail", "json", "status"] },
  { name: "RectangleUI (June exam)", keys: ["canvas", "slider", "timer"] },
  { name: "MealPlanner-style", keys: ["list", "select", "detail", "status"] },
  { name: "Async worker", keys: ["async", "status"] },
  { name: "Everything", keys: FEATURES.map((f) => f.key) },
];

function generate(sel) {
  const has = (k) => sel.has(k);
  const anyCommand = has("add") || has("select") || has("canvas") || has("async") || has("json");

  /* ---------- usings ---------- */
  const usings = [];
  if (has("json")) usings.push("using System.Collections.Generic;");
  if (has("list") || has("canvas")) usings.push("using System.Collections.ObjectModel;");
  if (has("json")) usings.push("using System.IO;");
  if (has("async")) usings.push("using System.Threading.Tasks;");
  if (has("json")) usings.push("using System.Text.Json;");
  if (has("timer")) usings.push("using System;");
  if (has("canvas")) usings.push("using System;");
  if (has("canvas")) usings.push("using Avalonia.Media;");
  if (has("timer")) usings.push("using Avalonia.Threading;");
  usings.push("using CommunityToolkit.Mvvm.ComponentModel;");
  if (anyCommand) usings.push("using CommunityToolkit.Mvvm.Input;");
  const uniqueUsings = [...new Set(usings)];

  /* ---------- fields ---------- */
  const fields = [];
  if (has("list"))
    fields.push('    public ObservableCollection<string> Items { get; } = new() { "Alpha", "Beta" };');
  if (has("canvas")) {
    fields.push("    public ObservableCollection<RectangleData> Rectangles { get; } = new();");
    fields.push("    private readonly Random _random = new();");
    fields.push("    private readonly IBrush[] _colors =");
    fields.push("        { Brushes.Red, Brushes.Blue, Brushes.Green, Brushes.Orange };");
    fields.push("    private const double CanvasSize = 400;");
  }
  if (has("combo"))
    fields.push('    public ObservableCollection<string> Options { get; } = new() { "Small", "Medium", "Large" };');

  const props = [];
  if (has("add")) {
    props.push("    [ObservableProperty]");
    if (has("guard")) props.push("    [NotifyCanExecuteChangedFor(nameof(AddItemCommand))]");
    props.push("    private string? newItem;");
    props.push("");
  }
  if (has("select")) {
    props.push("    [ObservableProperty]");
    props.push("    private string? selectedItem;");
    props.push("");
  }
  if (has("detail")) {
    props.push("    [ObservableProperty]");
    props.push('    private string detailText = "Nothing selected";');
    props.push("");
  }
  if (has("slider")) {
    props.push("    [ObservableProperty]");
    props.push("    private double size = 50;");
    props.push("");
  }
  if (has("check")) {
    props.push("    [ObservableProperty]");
    props.push("    private bool isFancy;");
    props.push("");
  }
  if (has("combo")) {
    props.push("    [ObservableProperty]");
    props.push('    private string? selectedOption = "Medium";');
    props.push("");
  }
  if (has("timer") && !has("canvas")) {
    props.push("    [ObservableProperty]");
    props.push("    private int ticks;");
    props.push("");
  }
  if (has("async")) {
    props.push("    [ObservableProperty]");
    props.push('    private string workStatus = "Idle";');
    props.push("");
  }
  if (has("status")) {
    props.push("    [ObservableProperty]");
    props.push('    private string statusText = "Ready";');
    props.push("");
  }

  /* ---------- constructor ---------- */
  const ctor = [];
  if (has("timer")) {
    ctor.push("    public MainWindowViewModel()");
    ctor.push("    {");
    ctor.push("        // DispatcherTimer ticks ON the UI thread -> bound-property writes are safe");
    ctor.push("        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };");
    ctor.push("        timer.Tick += (_, _) => " + (has("canvas") ? "ShuffleRectangles();" : "Ticks++;"));
    ctor.push("        timer.Start();");
    ctor.push("    }");
    ctor.push("");
  }

  /* ---------- methods ---------- */
  const m = [];
  const statusCall = has("status") && has("list") ? "\n        UpdateStatus();" : "";

  if (has("add")) {
    m.push(has("guard")
      ? "    [RelayCommand(CanExecute = nameof(CanAddItem))]"
      : "    [RelayCommand]");
    m.push("    private void AddItem()");
    m.push("    {");
    m.push("        Items.Add(NewItem!);");
    m.push("        NewItem = null;" + statusCall);
    m.push("    }");
    m.push("");
    if (has("guard")) {
      m.push("    private bool CanAddItem() => !string.IsNullOrWhiteSpace(NewItem);");
      m.push("");
    }
  }
  if (has("select")) {
    m.push("    [RelayCommand]");
    m.push("    private void DeleteItem()");
    m.push("    {");
    m.push("        if (SelectedItem is not null)");
    m.push("        {");
    m.push("            Items.Remove(SelectedItem);" + (statusCall ? statusCall.replace(/\n        /, "\n            ") : ""));
    m.push("        }");
    m.push("    }");
    m.push("");
  }
  if (has("detail") && has("select")) {
    m.push("    // generated hook: runs automatically after SelectedItem changes");
    m.push("    partial void OnSelectedItemChanged(string? value)");
    m.push("    {");
    m.push('        DetailText = value is null ? "Nothing selected" : $"You picked: {value}";');
    m.push("    }");
    m.push("");
  }
  if (has("canvas")) {
    const sz = has("slider") ? "Size" : "50";
    m.push("    [RelayCommand]");
    m.push("    private void AddRectangle()");
    m.push("    {");
    m.push("        double w = " + sz + ", h = " + sz + ";");
    m.push("        Rectangles.Add(new RectangleData");
    m.push("        {");
    m.push("            Width = w,");
    m.push("            Height = h,");
    m.push("            // clamp: keeps the shape fully inside the canvas");
    m.push("            X = _random.NextDouble() * (CanvasSize - w),");
    m.push("            Y = _random.NextDouble() * (CanvasSize - h),");
    m.push("            Color = _colors[_random.Next(_colors.Length)]");
    m.push("        });");
    m.push("    }");
    m.push("");
    if (has("timer")) {
      m.push("    private void ShuffleRectangles()");
      m.push("    {");
      m.push("        foreach (var r in Rectangles)");
      m.push("        {");
      m.push("            r.X = _random.NextDouble() * (CanvasSize - r.Width);");
      m.push("            r.Y = _random.NextDouble() * (CanvasSize - r.Height);");
      m.push("            r.Color = _colors[_random.Next(_colors.Length)];");
      m.push("        }");
      m.push("    }");
      m.push("");
    }
  }
  if (has("async")) {
    m.push("    [RelayCommand]   // async method -> AsyncRelayCommand; button auto-disables while running");
    m.push("    private async Task RunWork()");
    m.push("    {");
    m.push('        WorkStatus = "Working...";');
    m.push("        await Task.Run(async () =>");
    m.push("        {");
    m.push("            await Task.Delay(2000);   // pretend this is heavy work");
    m.push("        });");
    m.push('        WorkStatus = "Done";          // after await: back on the UI thread');
    m.push("    }");
    m.push("");
  }
  if (has("json")) {
    m.push("    [RelayCommand]");
    m.push("    private void Save()");
    m.push("    {");
    m.push('        File.WriteAllText("items.json", JsonSerializer.Serialize(Items));' + statusCall);
    m.push("    }");
    m.push("");
    m.push("    [RelayCommand]");
    m.push("    private void Load()");
    m.push("    {");
    m.push('        if (!File.Exists("items.json")) return;');
    m.push("        Items.Clear();");
    m.push('        foreach (var item in JsonSerializer.Deserialize<List<string>>(File.ReadAllText("items.json"))!)');
    m.push("            Items.Add(item);" + statusCall);
    m.push("    }");
    m.push("");
  }
  if (has("status") && has("list")) {
    m.push('    private void UpdateStatus() => StatusText = $"{Items.Count} items";');
    m.push("");
  }

  /* ---------- ViewModel file ---------- */
  let vm = "// ViewModels/MainWindowViewModel.cs  (generated by UI Builder)\n";
  vm += uniqueUsings.join("\n") + "\n\nnamespace ExamApp.ViewModels;\n\n";
  vm += "public partial class MainWindowViewModel : ViewModelBase\n{\n";
  const body = [];
  if (fields.length) body.push(fields.join("\n"));
  if (props.length) body.push(props.join("\n").replace(/\n$/, ""));
  if (ctor.length) body.push(ctor.join("\n").replace(/\n$/, ""));
  if (m.length) body.push(m.join("\n").replace(/\n$/, ""));
  vm += body.join("\n\n").replace(/\n{3,}/g, "\n\n");
  if (!body.length) vm += "    // pick features on the left to generate code";
  vm += "\n}\n";

  /* ---------- AXAML ---------- */
  const inputRows = [];
  const buttons = [];
  const controls = [];

  if (has("add")) inputRows.push('        <TextBox Watermark="Type something..." Text="{Binding NewItem}"/>');
  if (has("add")) buttons.push('            <Button Content="Add" Classes="accent" Command="{Binding AddItemCommand}"/>');
  if (has("select")) buttons.push('            <Button Content="Delete" Command="{Binding DeleteItemCommand}"/>');
  if (has("canvas")) buttons.push('            <Button Content="Add rectangle" Command="{Binding AddRectangleCommand}"/>');
  if (has("async")) buttons.push('            <Button Content="Run work" Command="{Binding RunWorkCommand}"/>');
  if (has("json")) {
    buttons.push('            <Button Content="Save" Command="{Binding SaveCommand}"/>');
    buttons.push('            <Button Content="Load" Command="{Binding LoadCommand}"/>');
  }
  if (has("slider")) {
    controls.push('        <Slider Minimum="10" Maximum="100" Value="{Binding Size}"/>');
    controls.push('        <TextBlock Text="{Binding Size, StringFormat=Size: {0:F0}}"/>');
  }
  if (has("check")) controls.push('        <CheckBox Content="Fancy mode" IsChecked="{Binding IsFancy}"/>');
  if (has("combo")) controls.push('        <ComboBox ItemsSource="{Binding Options}" SelectedItem="{Binding SelectedOption}"/>');
  if (has("detail")) controls.push('        <TextBlock Text="{Binding DetailText}" Foreground="#0078D4"/>');
  if (has("timer") && !has("canvas")) controls.push('        <TextBlock Text="{Binding Ticks, StringFormat=Timer ticks: {0}}"/>');
  if (has("async")) controls.push('        <TextBlock Text="{Binding WorkStatus}"/>');
  if (has("list")) {
    controls.push('        <ListBox Height="160" ItemsSource="{Binding Items}"' +
      (has("select") ? '\n                 SelectedItem="{Binding SelectedItem}"' : "") + "/>");
  }

  const x = [];
  x.push("<!-- Views/MainWindow.axaml  (generated by UI Builder) -->");
  x.push('<Window xmlns="https://github.com/avaloniaui"');
  x.push('        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"');
  x.push('        xmlns:vm="using:ExamApp.ViewModels"');
  if (has("canvas")) x.push('        xmlns:models="using:ExamApp.Models"');
  x.push('        x:Class="ExamApp.Views.MainWindow"');
  x.push('        x:DataType="vm:MainWindowViewModel"');
  x.push('        Title="Composed UI" Width="560" Height="640">');
  x.push("");
  x.push("    <DockPanel>");
  if (has("status")) {
    x.push('        <Border DockPanel.Dock="Bottom" Background="#F6F6F6" Padding="10,5">');
    x.push('            <TextBlock Text="{Binding StatusText}" Foreground="#666666" FontSize="12"/>');
    x.push("        </Border>");
    x.push("");
  }
  x.push('    <StackPanel Margin="14" Spacing="10">');
  if (!inputRows.length && !buttons.length && !controls.length && !has("canvas")) {
    x.push('        <TextBlock Text="Pick features on the left..."/>');
  }
  inputRows.forEach((r) => x.push(r));
  if (buttons.length) {
    x.push('        <StackPanel Orientation="Horizontal" Spacing="8">');
    buttons.forEach((b) => x.push(b));
    x.push("        </StackPanel>");
  }
  controls.forEach((c) => x.push(c));
  if (has("canvas")) {
    x.push('        <ItemsControl ItemsSource="{Binding Rectangles}">');
    x.push("            <ItemsControl.ItemsPanel>");
    x.push("                <ItemsPanelTemplate>");
    x.push('                    <Canvas Background="#EFEFEF" Width="400" Height="400"/>');
    x.push("                </ItemsPanelTemplate>");
    x.push("            </ItemsControl.ItemsPanel>");
    x.push("            <ItemsControl.ItemTemplate>");
    x.push('                <DataTemplate DataType="{x:Type models:RectangleData}">');
    x.push('                    <Rectangle Width="{Binding Width}" Height="{Binding Height}"');
    x.push('                               Fill="{Binding Color}"/>');
    x.push("                </DataTemplate>");
    x.push("            </ItemsControl.ItemTemplate>");
    x.push("            <ItemsControl.Styles>");
    x.push('                <Style Selector="ContentPresenter" x:DataType="models:RectangleData">');
    x.push('                    <Setter Property="Canvas.Left" Value="{Binding X}"/>');
    x.push('                    <Setter Property="Canvas.Top"  Value="{Binding Y}"/>');
    x.push("                </Style>");
    x.push("            </ItemsControl.Styles>");
    x.push("        </ItemsControl>");
  }
  x.push("    </StackPanel>");
  x.push("    </DockPanel>");
  x.push("</Window>");

  /* ---------- panes ---------- */
  const panes = [];
  if (has("canvas")) {
    panes.push({
      title: "Models/RectangleData.cs",
      lang: "csharp",
      code: "// item class is an ObservableObject so position/color changes show LIVE\nusing Avalonia.Media;\nusing CommunityToolkit.Mvvm.ComponentModel;\n\nnamespace ExamApp.Models;\n\npublic partial class RectangleData : ObservableObject\n{\n    [ObservableProperty] private double _x;\n    [ObservableProperty] private double _y;\n    [ObservableProperty] private double _width;\n    [ObservableProperty] private double _height;\n    [ObservableProperty] private IBrush _color = Brushes.Red;\n}\n",
    });
  }
  panes.push({ title: "ViewModels/MainWindowViewModel.cs", lang: "csharp", code: vm });
  panes.push({ title: "Views/MainWindow.axaml", lang: "xml", code: x.join("\n") + "\n" });
  return panes;
}

window.BUILDER = { FEATURES, PRESETS, generate };
})();
