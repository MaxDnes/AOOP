/* design-demos.js — runnable Avalonia projects for every Design Gallery topic.
 *
 * Each Design Gallery doc (data/design.js) gets ONE complete, instantly-runnable
 * project: a full MainWindow.axaml plus a MainWindowViewModel whose members back
 * every {Binding ...} in the view, so the downloaded app shows live data and
 * reacts (no blank window, no missing-binding crash). PROJZIP.avaloniaProject
 * supplies App/Program/ViewLocator/csproj; we only provide the View + ViewModel.
 *
 * Keyed by the gallery topic id so app.js can drop a Download (.zip) button on
 * the matching topic. 100% offline, file:// safe, Node-loadable (no DOM at load
 * time; buildProject() is pure and takes window.PROJZIP as an argument).
 *
 * Only the exam-allowed usings appear (System*, Avalonia*, CommunityToolkit.Mvvm*).
 */
(function (global) {
"use strict";

/* a full Window shell so PROJZIP keeps it verbatim (it only wraps fragments).
   `body` is the inner content; binds resolve against MainWindowViewModel. */
function win(title, size, body) {
  return '<Window xmlns="https://github.com/avaloniaui"\n' +
    '        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n' +
    '        xmlns:vm="using:ExamApp.ViewModels"\n' +
    '        x:Class="ExamApp.Views.MainWindow"\n' +
    '        x:DataType="vm:MainWindowViewModel"\n' +
    '        Title="' + title + '" Width="' + size[0] + '" Height="' + size[1] + '"\n' +
    '        WindowStartupLocation="CenterScreen">\n' +
    body + "\n</Window>\n";
}

/* a CommunityToolkit ViewModel body. `members` is the C# inside the class. */
function vmodel(members) {
  return 'using System;\n' +
    'using System.Collections.ObjectModel;\n' +
    'using CommunityToolkit.Mvvm.ComponentModel;\n' +
    'using CommunityToolkit.Mvvm.Input;\n' +
    '\n' +
    'namespace ExamApp.ViewModels;\n' +
    '\n' +
    'public partial class MainWindowViewModel : ViewModelBase\n' +
    '{\n' +
    members + "\n" +
    '}\n';
}

var DEMOS = [

/* ---- 1. the 5-step method: a reproduced labeled login UI ---- */
{
  id: "dg-workflow", title: "Reproduce any UI (worked result)", name: "ReproduceDemo",
  blurb: "The end result of the 5-step method: a small labeled form, fully bound.",
  axaml: win("Sign in", [340, 240], String.raw`    <StackPanel Margin="24" Spacing="10">
        <TextBlock Text="Sign in" FontSize="20" FontWeight="SemiBold"/>
        <TextBox Watermark="Username" Text="{Binding Username}"/>
        <TextBox Watermark="Password" PasswordChar="•" Text="{Binding Password}"/>
        <Button Content="Sign in" HorizontalAlignment="Right" Command="{Binding SignInCommand}"/>
        <TextBlock Text="{Binding Status}" Foreground="#2980b9"/>
    </StackPanel>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private string _username = "";
    [ObservableProperty] private string _password = "";
    [ObservableProperty] private string _status = "";

    [RelayCommand]
    private void SignIn() => Status = string.IsNullOrWhiteSpace(Username)
        ? "Enter a username." : $"Welcome, {Username}!";`),
},

/* ---- 2. window recipes ---- */
{
  id: "dg-window", title: "Window recipe", name: "WindowDemo",
  blurb: "A standard centered, sized window with a live status line.",
  axaml: win("My App", [420, 260], String.raw`    <StackPanel Margin="24" Spacing="10" VerticalAlignment="Center">
        <TextBlock Text="Window recipe" FontSize="20" FontWeight="SemiBold" HorizontalAlignment="Center"/>
        <TextBlock Text="{Binding Info}" HorizontalAlignment="Center" Foreground="#555"/>
        <Button Content="Toggle theme note" HorizontalAlignment="Center" Command="{Binding ToggleCommand}"/>
    </StackPanel>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private string _info = "900x600 was the design size; this one is 420x260.";

    [RelayCommand]
    private void Toggle() => Info = Info.StartsWith("Light")
        ? "900x600 was the design size; this one is 420x260." : "Light theme is set in App.axaml (RequestedThemeVariant).";`),
},

/* ---- 3. shapes (sized live by a slider) ---- */
{
  id: "dg-shapes", title: "Shapes (live)", name: "ShapesDemo",
  blurb: "Rectangle, Ellipse, Line, Polygon and Path; the box is sized by a bound slider.",
  axaml: win("Shapes", [460, 320], String.raw`    <StackPanel Margin="20" Spacing="14">
        <StackPanel Orientation="Horizontal" Spacing="18">
            <Rectangle Width="{Binding BoxSize}" Height="{Binding BoxSize}" Fill="#E74C3C" RadiusX="8" RadiusY="8"/>
            <Ellipse Width="80" Height="80" Fill="#2ECC71"/>
            <Line StartPoint="0,80" EndPoint="80,0" Stroke="#34495E" StrokeThickness="3"/>
            <Polygon Points="40,0 80,80 0,80" Fill="#E67E22"/>
            <Path Data="M 0,40 C 20,0 60,80 80,40" Stroke="#3498DB" StrokeThickness="3"/>
        </StackPanel>
        <TextBlock Text="{Binding BoxSize, StringFormat='Rectangle size: {0:0} px'}"/>
        <Slider Minimum="30" Maximum="160" Value="{Binding BoxSize}"/>
    </StackPanel>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private double _boxSize = 90;`),
},

/* ---- 4. colors, brushes & gradients ---- */
{
  id: "dg-colors", title: "Colors & gradients", name: "ColorsDemo",
  blurb: "Solid swatches and a gradient; a slider drives the panel opacity (a bound double).",
  axaml: win("Colors", [460, 300], String.raw`    <StackPanel Margin="20" Spacing="14">
        <Border Height="70" CornerRadius="10" Opacity="{Binding Opacity}">
            <Border.Background>
                <LinearGradientBrush StartPoint="0%,0%" EndPoint="100%,0%">
                    <GradientStop Color="#8E2DE2" Offset="0"/>
                    <GradientStop Color="#4A00E0" Offset="1"/>
                </LinearGradientBrush>
            </Border.Background>
        </Border>
        <StackPanel Orientation="Horizontal" Spacing="10">
            <Border Width="60" Height="40" Background="#E74C3C" CornerRadius="6"/>
            <Border Width="60" Height="40" Background="#2ECC71" CornerRadius="6"/>
            <Border Width="60" Height="40" Background="#3498DB" CornerRadius="6"/>
            <Border Width="60" Height="40" Background="#F1C40F" CornerRadius="6"/>
        </StackPanel>
        <TextBlock Text="{Binding Opacity, StringFormat='Opacity: {0:0.00}'}"/>
        <Slider Minimum="0.1" Maximum="1" Value="{Binding Opacity}"/>
    </StackPanel>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private double _opacity = 1.0;`),
},

/* ---- 5. text & typography ---- */
{
  id: "dg-typography", title: "Typography (live)", name: "TypographyDemo",
  blurb: "Headings, weights and alignment; a slider sets the sample's font size (bound).",
  axaml: win("Typography", [460, 300], String.raw`    <StackPanel Margin="20" Spacing="10">
        <TextBlock Text="Heading" FontSize="28" FontWeight="Bold"/>
        <TextBlock Text="Subheading" FontSize="18" FontWeight="SemiBold" Foreground="#555"/>
        <TextBlock Text="Body text wraps across the available width when TextWrapping is set."
                   TextWrapping="Wrap"/>
        <TextBlock Text="{Binding Sample}" FontSize="{Binding FontSize}" Foreground="#2980b9"/>
        <Slider Minimum="10" Maximum="48" Value="{Binding FontSize}"/>
    </StackPanel>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private string _sample = "Resize me with the slider";
    [ObservableProperty] private double _fontSize = 20;`),
},

/* ---- 6. buttons: every look ---- */
{
  id: "dg-buttons", title: "Buttons gallery", name: "ButtonsDemo",
  blurb: "Default, accent, outline and icon buttons; one is wired to a bound click counter.",
  axaml: win("Buttons", [440, 240], String.raw`    <StackPanel Margin="22" Spacing="12">
        <StackPanel Orientation="Horizontal" Spacing="10">
            <Button Content="Default" Command="{Binding ClickCommand}"/>
            <Button Content="Accent" Background="#3498DB" Foreground="White" Command="{Binding ClickCommand}"/>
            <Button Content="Outline" Background="Transparent" BorderBrush="#3498DB" BorderThickness="1" Command="{Binding ClickCommand}"/>
            <Button Content="✓" Width="40" Command="{Binding ClickCommand}"/>
        </StackPanel>
        <TextBlock Text="{Binding Clicks, StringFormat='Clicked {0} time(s)'}" FontSize="16"/>
        <Button Content="Reset" HorizontalAlignment="Left" Command="{Binding ResetCommand}"/>
    </StackPanel>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private int _clicks;

    [RelayCommand] private void Click() => Clicks++;
    [RelayCommand] private void Reset() => Clicks = 0;`),
},

/* ---- 7. inputs & form controls ---- */
{
  id: "dg-inputs", title: "Inputs gallery", name: "InputsDemo",
  blurb: "TextBox, CheckBox, RadioButton, Slider and ComboBox, all two-way bound to the VM.",
  axaml: win("Inputs", [440, 360], String.raw`    <StackPanel Margin="22" Spacing="10">
        <TextBox Watermark="Your name" Text="{Binding Name}"/>
        <CheckBox Content="Subscribe" IsChecked="{Binding Subscribe}"/>
        <StackPanel Orientation="Horizontal" Spacing="14">
            <RadioButton Content="Small"  GroupName="size" IsChecked="{Binding IsSmall}"/>
            <RadioButton Content="Large" GroupName="size"/>
        </StackPanel>
        <Slider Minimum="0" Maximum="100" Value="{Binding Volume}"/>
        <ComboBox ItemsSource="{Binding Colors}" SelectedItem="{Binding SelectedColor}" HorizontalAlignment="Stretch"/>
        <TextBlock Text="{Binding Summary}" Foreground="#2980b9" TextWrapping="Wrap"/>
    </StackPanel>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private string _name = "";
    [ObservableProperty] private bool _subscribe = true;
    [ObservableProperty] private bool _isSmall = true;
    [ObservableProperty] private double _volume = 40;
    [ObservableProperty] private string _selectedColor = "Blue";

    public ObservableCollection<string> Colors { get; } = new() { "Blue", "Green", "Red", "Purple" };

    public string Summary => $"{(string.IsNullOrWhiteSpace(Name) ? "Anonymous" : Name)} · " +
        $"{(Subscribe ? "subscribed" : "not subscribed")} · vol {Volume:0} · {SelectedColor}";

    partial void OnNameChanged(string value) => OnPropertyChanged(nameof(Summary));
    partial void OnSubscribeChanged(bool value) => OnPropertyChanged(nameof(Summary));
    partial void OnVolumeChanged(double value) => OnPropertyChanged(nameof(Summary));
    partial void OnSelectedColorChanged(string value) => OnPropertyChanged(nameof(Summary));`),
},

/* ---- 8. labeled form recipe (login/settings) ---- */
{
  id: "dg-form-recipe", title: "Labeled form", name: "FormDemo",
  blurb: "A two-column Grid form (label | field) with a Save command and a bound status.",
  axaml: win("Settings", [420, 300], String.raw`    <StackPanel Margin="22" Spacing="12">
        <Grid ColumnDefinitions="Auto,*" RowDefinitions="Auto,Auto,Auto" >
            <TextBlock Grid.Row="0" Grid.Column="0" Text="Name" VerticalAlignment="Center" Margin="0,0,12,8"/>
            <TextBox   Grid.Row="0" Grid.Column="1" Margin="0,0,0,8" Text="{Binding Name}"/>
            <TextBlock Grid.Row="1" Grid.Column="0" Text="Email" VerticalAlignment="Center" Margin="0,0,12,8"/>
            <TextBox   Grid.Row="1" Grid.Column="1" Margin="0,0,0,8" Text="{Binding Email}"/>
            <TextBlock Grid.Row="2" Grid.Column="0" Text="Notify" VerticalAlignment="Center" Margin="0,0,12,0"/>
            <CheckBox  Grid.Row="2" Grid.Column="1" Content="by email" IsChecked="{Binding Notify}"/>
        </Grid>
        <Button Content="Save" HorizontalAlignment="Right" Command="{Binding SaveCommand}"/>
        <TextBlock Text="{Binding Status}" Foreground="#27ae60"/>
    </StackPanel>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private string _name = "";
    [ObservableProperty] private string _email = "";
    [ObservableProperty] private bool _notify = true;
    [ObservableProperty] private string _status = "";

    [RelayCommand]
    private void Save() => Status = $"Saved {Name} <{Email}>, notify={Notify}.";`),
},

/* ---- 9. tabs ---- */
{
  id: "dg-tabs", title: "TabControl", name: "TabsDemo",
  blurb: "A TabControl with three tabs; the third tab edits a note bound to the VM.",
  axaml: win("Tabs", [460, 300], String.raw`    <TabControl Margin="8">
        <TabItem Header="Home">
            <TextBlock Margin="16" Text="Home tab content." />
        </TabItem>
        <TabItem Header="Stats">
            <TextBlock Margin="16" Text="Stats tab content." />
        </TabItem>
        <TabItem Header="Notes">
            <StackPanel Margin="16" Spacing="8">
                <TextBox AcceptsReturn="True" Height="100" Text="{Binding Note}"/>
                <TextBlock Text="{Binding Note, StringFormat='{}{0} chars'}"/>
            </StackPanel>
        </TabItem>
    </TabControl>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private string _note = "Type here…";`),
},

/* ---- 10. lists, cards & scrolling ---- */
{
  id: "dg-lists-cards", title: "List + cards", name: "ListDemo",
  blurb: "A bound ListBox with an add/remove command and a selected-item card.",
  axaml: win("Tasks", [440, 360], String.raw`    <DockPanel Margin="16">
        <StackPanel DockPanel.Dock="Top" Orientation="Horizontal" Spacing="8" Margin="0,0,0,10">
            <TextBox Width="220" Watermark="New task" Text="{Binding NewTask}"/>
            <Button Content="Add" Command="{Binding AddCommand}"/>
            <Button Content="Remove" Command="{Binding RemoveCommand}"/>
        </StackPanel>
        <Border DockPanel.Dock="Bottom" Background="#ECF0F1" CornerRadius="8" Padding="12" Margin="0,10,0,0">
            <TextBlock Text="{Binding Selected, StringFormat='Selected: {0}'}"/>
        </Border>
        <ListBox ItemsSource="{Binding Tasks}" SelectedItem="{Binding Selected}"/>
    </DockPanel>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private string _newTask = "";
    [ObservableProperty] private string? _selected;

    public ObservableCollection<string> Tasks { get; } = new() { "Read the slides", "Practice LINQ", "Sleep" };

    [RelayCommand]
    private void Add()
    {
        if (!string.IsNullOrWhiteSpace(NewTask)) { Tasks.Add(NewTask); NewTask = ""; }
    }

    [RelayCommand]
    private void Remove()
    {
        if (Selected is not null) Tasks.Remove(Selected);
    }`),
},

/* ---- 11. spacing & alignment ---- */
{
  id: "dg-spacing", title: "Spacing (live)", name: "SpacingDemo",
  blurb: "A row of cards whose StackPanel Spacing is driven by a bound slider.",
  axaml: win("Spacing", [480, 240], String.raw`    <StackPanel Margin="20" Spacing="14">
        <StackPanel Orientation="Horizontal" Spacing="{Binding Gap}">
            <Border Width="70" Height="70" Background="#3498DB" CornerRadius="8"/>
            <Border Width="70" Height="70" Background="#2ECC71" CornerRadius="8"/>
            <Border Width="70" Height="70" Background="#E67E22" CornerRadius="8"/>
        </StackPanel>
        <TextBlock Text="{Binding Gap, StringFormat='Spacing: {0:0} px'}"/>
        <Slider Minimum="0" Maximum="60" Value="{Binding Gap}"/>
    </StackPanel>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private double _gap = 14;`),
},

/* ---- 12. page skeletons / classic layouts ---- */
{
  id: "dg-layout-recipes", title: "Classic layout (DockPanel)", name: "LayoutDemo",
  blurb: "The header / sidebar / content / footer skeleton with a bound header title.",
  axaml: win("Layout", [520, 360], String.raw`    <DockPanel>
        <Border DockPanel.Dock="Top" Background="#2C3E50" Height="44">
            <TextBlock Text="{Binding Header}" Foreground="White" VerticalAlignment="Center" Margin="14,0" FontSize="16"/>
        </Border>
        <Border DockPanel.Dock="Bottom" Background="#ECF0F1" Height="30">
            <TextBlock Text="Footer" VerticalAlignment="Center" Margin="14,0" Foreground="#555"/>
        </Border>
        <StackPanel DockPanel.Dock="Left" Width="120" Background="#34495E">
            <Button Content="Home" Command="{Binding SelectCommand}" CommandParameter="Home" Margin="8"/>
            <Button Content="Reports" Command="{Binding SelectCommand}" CommandParameter="Reports" Margin="8,0"/>
        </StackPanel>
        <TextBlock Text="{Binding Header, StringFormat='Content area — {0}'}" Margin="18"/>
    </DockPanel>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private string _header = "Home";

    [RelayCommand]
    private void Select(string? page) => Header = page ?? "Home";`),
},

/* ---- 13. canvas drawing: a composed scene moved live ---- */
{
  id: "dg-canvas-scene", title: "Canvas scene (live)", name: "CanvasDemo",
  blurb: "Absolute-positioned shapes on a Canvas; sliders move the sun via bound Canvas.Left/Top.",
  axaml: win("Scene", [460, 380], String.raw`    <StackPanel Margin="12" Spacing="8">
        <Canvas Width="420" Height="240" Background="#D6EAF8">
            <Ellipse Canvas.Left="{Binding SunX}" Canvas.Top="{Binding SunY}" Width="60" Height="60" Fill="#F1C40F"/>
            <Rectangle Canvas.Left="40" Canvas.Top="170" Width="120" Height="60" Fill="#8B5A2B"/>
            <Polygon Points="40,170 100,120 160,170" Fill="#C0392B"/>
            <Rectangle Canvas.Left="0" Canvas.Top="230" Width="420" Height="10" Fill="#27AE60"/>
        </Canvas>
        <TextBlock Text="Sun X / Y"/>
        <Slider Minimum="0" Maximum="360" Value="{Binding SunX}"/>
        <Slider Minimum="0" Maximum="170" Value="{Binding SunY}"/>
    </StackPanel>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private double _sunX = 300;
    [ObservableProperty] private double _sunY = 20;`),
},

/* ---- 14. the bundle: tabs + form + list, fully bound ---- */
{
  id: "dg-bundle", title: "Complete demo (tabs + form + list)", name: "BundleDemo",
  blurb: "The flagship: a TabControl combining a bound form tab and a bound list tab.",
  axaml: win("Demo", [520, 400], String.raw`    <TabControl Margin="8">
        <TabItem Header="Form">
            <StackPanel Margin="16" Spacing="10">
                <TextBox Watermark="Name" Text="{Binding Name}"/>
                <Slider Minimum="0" Maximum="100" Value="{Binding Score}"/>
                <Button Content="Save to list" Command="{Binding SaveCommand}"/>
                <TextBlock Text="{Binding Status}" Foreground="#27ae60"/>
            </StackPanel>
        </TabItem>
        <TabItem Header="People">
            <DockPanel Margin="16">
                <TextBlock DockPanel.Dock="Bottom" Margin="0,8,0,0"
                           Text="{Binding People.Count, StringFormat='{}{0} people'}"/>
                <ListBox ItemsSource="{Binding People}" SelectedItem="{Binding Selected}"/>
            </DockPanel>
        </TabItem>
    </TabControl>`),
  viewModel: vmodel(String.raw`    [ObservableProperty] private string _name = "";
    [ObservableProperty] private double _score = 50;
    [ObservableProperty] private string _status = "";
    [ObservableProperty] private string? _selected;

    public ObservableCollection<string> People { get; } = new() { "Ada (90)", "Linus (80)" };

    [RelayCommand]
    private void Save()
    {
        if (string.IsNullOrWhiteSpace(Name)) { Status = "Enter a name first."; return; }
        People.Add($"{Name} ({Score:0})");
        Status = $"Added {Name}.";
        Name = "";
    }`),
},

];

var BY_ID = {};
DEMOS.forEach(function (d) { BY_ID[d.id] = d; });

/* Build the runnable project entries for one demo via PROJZIP. Returns
   [{path,text}] or null when PROJZIP / the demo is absent. */
function buildProject(PROJZIP, id) {
  var d = BY_ID[id];
  if (!PROJZIP || !d || typeof PROJZIP.avaloniaProject !== "function") return null;
  return PROJZIP.avaloniaProject(d.name, { axaml: d.axaml, viewModel: d.viewModel });
}

/* Object URL for a download link (browser only). */
function buildZipUrl(PROJZIP, id) {
  var entries = buildProject(PROJZIP, id);
  if (!entries || typeof PROJZIP.makeZipBlobUrl !== "function") return null;
  return PROJZIP.makeZipBlobUrl(entries);
}

var API = { demos: DEMOS, byId: BY_ID, buildProject: buildProject, buildZipUrl: buildZipUrl };
global.DESIGN_DEMOS = API;
if (typeof module !== "undefined" && module.exports) module.exports = API;

})(typeof window !== "undefined" ? window : globalThis);
