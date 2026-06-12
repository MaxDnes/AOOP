/* ============ AVALONIA UI ============ */

window.TOPICS.push(

{
id: "av-project-structure",
title: "Avalonia MVVM project anatomy",
cat: "Avalonia UI",
tags: ["project structure", "template", "program.cs", "app.axaml", "viewlocator", "viewmodelbase", "csproj"],
related: ["mv-datacontext", "av-xaml-basics", "pb-avalonia-ui"],
blocks: [
  { p: "Every exam UI project is the stock Avalonia 11 MVVM template. Know what each file does so you instantly know what you may touch:" },
  { table: { head: ["File", "Role", "Touch at exam?"], rows: [
    ["`Program.cs`", "Entry point: `BuildAvaloniaApp().StartWithClassicDesktopLifetime(args)`", "never"],
    ["`App.axaml`", "App-wide styles (`<FluentTheme/>`), ViewLocator registration", "never"],
    ["`App.axaml.cs`", "Composition root: builds services + VM, sets `desktop.MainWindow` + DataContext", "READ it, never edit"],
    ["`ViewLocator.cs`", "IDataTemplate mapping FooViewModel → FooView by name", "never"],
    ["`ViewModels/ViewModelBase.cs`", "`class ViewModelBase : ObservableObject`", "never"],
    ["`ViewModels/MainWindowViewModel.cs`", "YOUR main work area", "yes"],
    ["`Views/MainWindow.axaml`", "Layout + bindings — your second work area", "yes"],
    ["`Views/MainWindow.axaml.cs`", "Code-behind: only `InitializeComponent()`", "NEVER (scores zero)"],
    ["`Models/*.cs`", "POCOs / provided domain code", "when the paper says so"],
  ]}},
  { code: String.raw`using Avalonia;
using System;

namespace MyApp;

class Program
{
    // Initialization code. Don't use any Avalonia, third-party APIs or any
    // SynchronizationContext-reliant code before AppMain is called.
    [STAThread]
    public static void Main(string[] args) => BuildAvaloniaApp()
        .StartWithClassicDesktopLifetime(args);

    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .WithInterFont()
            .LogToTrace();
}`, lang: "csharp", title: "Program.cs (template, identical in every project)" },
  { code: String.raw`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <BuiltInComInteropSupport>true</BuiltInComInteropSupport>
    <ApplicationManifest>app.manifest</ApplicationManifest>
    <AvaloniaUseCompiledBindingsByDefault>true</AvaloniaUseCompiledBindingsByDefault>
  </PropertyGroup>
  <ItemGroup>
    <AvaloniaResource Include="Assets\**" />
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="Avalonia" Version="11.2.1" />
    <PackageReference Include="Avalonia.Desktop" Version="11.2.1" />
    <PackageReference Include="Avalonia.Themes.Fluent" Version="11.2.1" />
    <PackageReference Include="Avalonia.Fonts.Inter" Version="11.2.1" />
    <PackageReference Condition="'$(Configuration)' == 'Debug'" Include="Avalonia.Diagnostics" Version="11.2.1" />
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.2.1" />
  </ItemGroup>
</Project>`, lang: "xml", title: "Exam .csproj (exact packages + versions from the 2025 exams)" },
  { code: String.raw`# create a fresh MVVM app at home for practice (template id: avalonia.mvvm)
dotnet new install Avalonia.Templates
dotnet new avalonia.mvvm -o MyApp
dotnet run --project MyApp`, lang: "bash", title: "Creating one yourself" },
  { h: "ViewLocator (know what it does, never edit it)" },
  { code: String.raw`public class ViewLocator : IDataTemplate
{
    public Control? Build(object? param)
    {
        if (param is null) return null;

        // FooViewModel -> FooView, then reflection-instantiate the view
        var name = param.GetType().FullName!.Replace("ViewModel", "View", StringComparison.Ordinal);
        var type = Type.GetType(name);

        if (type != null)
            return (Control)Activator.CreateInstance(type)!;

        return new TextBlock { Text = "Not Found: " + name };
    }

    public bool Match(object? data) => data is ViewModelBase;
}`, lang: "csharp", title: "ViewLocator.cs — naming-convention view resolution" },
]},

{
id: "av-xaml-basics",
title: "XAML / AXAML essentials",
cat: "Avalonia UI",
tags: ["xaml", "axaml", "namespaces", "x:class", "x:datatype", "design.datacontext", "attached properties"],
related: ["av-project-structure", "mv-binding-cookbook"],
blocks: [
  { code: String.raw`<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="using:MyApp.ViewModels"
        xmlns:models="using:MyApp.Models"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        mc:Ignorable="d" d:DesignWidth="800" d:DesignHeight="450"
        x:Class="MyApp.Views.MainWindow"
        x:DataType="vm:MainWindowViewModel"
        Title="MyApp">

    <Design.DataContext>
        <!-- previewer only; the REAL DataContext is set in App.axaml.cs -->
        <vm:MainWindowViewModel/>
    </Design.DataContext>

    <!-- a Window has EXACTLY ONE child; that child is usually a panel -->
    <StackPanel>
        <TextBlock Text="{Binding Greeting}"/>
    </StackPanel>
</Window>`, lang: "xml", title: "Window skeleton, annotated" },
  { list: [
    "`x:Class` links this XAML to its partial class in code-behind.",
    "`x:DataType` enables **compiled bindings**: binding paths are checked at build time against that type. Wrong property name = compile error (a gift at the exam).",
    "`xmlns:vm=\"using:MyApp.ViewModels\"` imports a C# namespace for use in XAML (`vm:MainWindowViewModel`, `models:RectangleData`).",
    "`Design.DataContext` only feeds the IDE previewer.",
    "Attached properties: `Grid.Row=\"1\"`, `DockPanel.Dock=\"Top\"`, `Canvas.Left=\"50\"` — set ON the child, read BY the parent panel.",
    "Property element syntax for complex values: `<ItemsControl.ItemTemplate><DataTemplate>…` when an attribute string isn't enough.",
  ]},
  { gotcha: "A Window (and a Border, and a UserControl) takes exactly ONE child. Two siblings directly inside a Window is a compile error: wrap them in a panel." },
]},

{
id: "av-layout",
title: "Layout panels: the full set",
cat: "Avalonia UI",
tags: ["layout", "stackpanel", "dockpanel", "grid", "canvas", "wrappanel", "uniformgrid", "margin", "padding", "alignment"],
related: ["av-grid", "av-xaml-basics", "av-itemscontrols"],
blocks: [
  { table: { head: ["Panel", "Behavior (course table)"], rows: [
    ["`Panel`", "Lays out all children to fill the bounds of the Panel"],
    ["`Canvas`", "Explicitly position children by coordinates (`Canvas.Left` / `Canvas.Top`)"],
    ["`DockPanel`", "Dock children to edges (`DockPanel.Dock`), last child fills the rest"],
    ["`Grid`", "Flexible rows and columns"],
    ["`RelativePanel`", "Arrange children relative to other elements or the panel"],
    ["`StackPanel`", "Single line, vertical (default) or horizontal"],
    ["`WrapPanel`", "Left-to-right, wraps to the next line at the edge"],
    ["`UniformGrid`", "Equal-size cells, set Rows/Columns (used in styling lecture)"],
  ]}},
  { code: String.raw`<!-- StackPanel: the everyday workhorse -->
<StackPanel Orientation="Vertical" Spacing="10" Margin="10">
    <TextBlock Text="Stacked top-down"/>
    <StackPanel Orientation="Horizontal" Spacing="10">
        <Button Content="Left"/>
        <Button Content="Right"/>
    </StackPanel>
</StackPanel>`, lang: "xml", title: "StackPanel (+ Spacing)" },
  { code: String.raw`<DockPanel LastChildFill="True">
    <Border Height="25" Background="SkyBlue" DockPanel.Dock="Top">
        <TextBlock>Dock = "Top"</TextBlock>
    </Border>
    <Border Height="25" Background="LemonChiffon" DockPanel.Dock="Bottom">
        <TextBlock>Dock = "Bottom"</TextBlock>
    </Border>
    <Border Width="200" Background="PaleGreen" DockPanel.Dock="Left">
        <TextBlock>Dock = "Left"</TextBlock>
    </Border>
    <Border Background="White">
        <TextBlock>This content will "Fill" the remaining space</TextBlock>
    </Border>
</DockPanel>`, lang: "xml", title: "DockPanel (lecture example)" },
  { code: String.raw`<Canvas Background="LightBlue" Width="400" Height="400">
    <Rectangle Width="100" Height="50" Fill="Red"  Canvas.Left="50"  Canvas.Top="30"/>
    <Ellipse   Width="80"  Height="80" Fill="Green" Canvas.Left="150" Canvas.Top="100"/>
    <!-- later children draw ON TOP of earlier ones -->
</Canvas>`, lang: "xml", title: "Canvas: absolute positioning" },
  { code: String.raw`<!-- The full control-tree example from the GUI Design lecture -->
<Window Title="LayoutExample">
  <DockPanel>
      <Menu DockPanel.Dock="Top">
        <MenuItem Header="File">
          <MenuItem Header="Open"/>
          <MenuItem Header="Save"/>
        </MenuItem>
        <MenuItem Header="Edit">
          <MenuItem Header="Undo"/>
          <MenuItem Header="Redo"/>
        </MenuItem>
      </Menu>
      <StackPanel DockPanel.Dock="Left" Width="120" Background="LightGray">
        <TextBlock Text="Navigation" FontWeight="Bold" Padding="5"/>
        <ListBox Background="LightGray">
          <ListBoxItem Content="Home"/>
          <ListBoxItem Content="Settings"/>
          <ListBoxItem Content="Profile"/>
        </ListBox>
      </StackPanel>
      <Canvas Background="LightBlue">
        <Rectangle Width="100" Height="50" Fill="Red" Canvas.Left="50" Canvas.Top="30"/>
        <Ellipse Width="80" Height="80" Fill="Green" Canvas.Left="150" Canvas.Top="100"/>
      </Canvas>
  </DockPanel>
</Window>`, lang: "xml", title: "Menu + sidebar + canvas layout (LayoutExample solution)" },
  { h: "Margin, Padding, Alignment" },
  { list: [
    "**Margin** = space OUTSIDE the control. `Margin=\"20\"` all sides, `Margin=\"20,10\"` horizontal,vertical, `Margin=\"l,t,r,b\"` individually.",
    "**Padding** = space INSIDE a container, between its edge and its content.",
    "`HorizontalAlignment` / `VerticalAlignment`: `Left | Center | Right | Stretch` (`Top | Center | Bottom | Stretch`).",
    "`Width`/`Height` fix sizes; otherwise alignment + parent decide.",
  ]},
]},

{
id: "av-grid",
title: "Grid: rows, columns, spans",
cat: "Avalonia UI",
tags: ["grid", "rowdefinitions", "columndefinitions", "star", "auto", "span"],
related: ["av-layout"],
blocks: [
  { code: String.raw`<!-- Shorthand definitions: * = share leftover, Auto = size to content, 120 = fixed px -->
<Grid RowDefinitions="Auto, *, Auto" ColumnDefinitions="*, *" Margin="15">

    <TextBlock Grid.Row="0" Grid.Column="0" Text="Meal Plan"     FontWeight="Bold"/>
    <TextBlock Grid.Row="0" Grid.Column="1" Text="Shopping List" FontWeight="Bold"/>

    <ListBox Grid.Row="1" Grid.Column="0" ItemsSource="{Binding WeekPlan}"/>
    <ListBox Grid.Row="1" Grid.Column="1" ItemsSource="{Binding ShoppingList}"/>

    <Button Grid.Row="2" Grid.Column="0" Content="Generate Meal Plan"
            Command="{Binding CreateWeeklyPlanCommand}"/>
</Grid>`, lang: "xml", title: "The exact layout shape the re-exam UI wanted" },
  { code: String.raw`<!-- Long form + spanning -->
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="*"/>
        <RowDefinition Height="2*"/>   <!-- twice the share of * -->
    </Grid.RowDefinitions>
    <Grid.ColumnDefinitions>
        <ColumnDefinition Width="150"/>
        <ColumnDefinition Width="*"/>
    </Grid.ColumnDefinitions>

    <TextBlock Grid.Row="0" Grid.Column="0" Grid.ColumnSpan="2" Text="Header across both"/>
    <ListBox   Grid.Row="1" Grid.RowSpan="2" Grid.Column="0"/>
    <Canvas    Grid.Row="1" Grid.Column="1" Background="LightGray"/>
</Grid>`, lang: "xml", title: "Star sizing & Row/ColumnSpan" },
  { rule: "Children default to Row 0 / Column 0 if you don't set the attached properties. Always set them explicitly: silent overlap is the classic Grid bug." },
]},

{
id: "av-controls",
title: "Controls gallery (with the properties that matter)",
cat: "Avalonia UI",
tags: ["controls", "button", "textbox", "textblock", "checkbox", "radiobutton", "combobox", "listbox", "slider", "numericupdown", "image", "border", "tabcontrol"],
related: ["mv-binding-cookbook", "av-events-codebehind"],
blocks: [
  { code: String.raw`<StackPanel Spacing="10" Margin="10">
    <!-- text display vs text input -->
    <TextBlock Text="{Binding Count}" FontSize="24" FontWeight="Bold" TextWrapping="Wrap"/>
    <TextBox   Text="{Binding NewContactName}" Watermark="Enter name..."/>
    <TextBox   Height="120" AcceptsReturn="True" TextWrapping="Wrap"/>  <!-- multiline -->
    <TextBox   IsReadOnly="True"/> <!-- output-style box -->
    <Label     Content="Number of People"/>

    <!-- buttons & toggles -->
    <Button Content="Add Contact" Command="{Binding AddContactCommand}"/>
    <CheckBox Content="Fancy Decorations" IsChecked="{Binding IsFancy}"/>
    <RadioButton GroupName="Animals" Content="Cat"  IsChecked="True"/>
    <RadioButton GroupName="Animals" Content="Dog"/>

    <!-- value pickers -->
    <Slider Minimum="0" Maximum="100" Value="{Binding RectWidth}"/>
    <NumericUpDown Minimum="1" Maximum="100" Increment="1" Value="{Binding People}"/>
    <ComboBox ItemsSource="{Binding CakeSizeOptions}" SelectedItem="{Binding CakeSize}"/>

    <!-- lists -->
    <ListBox ItemsSource="{Binding Contacts}" SelectedItem="{Binding SelectedContact}"
             SelectionMode="Single,Toggle"/>

    <!-- visuals -->
    <Border BorderBrush="Black" BorderThickness="1" CornerRadius="6" Padding="10"
            Background="LightBlue">
        <TextBlock Text="Inside a border"/>
    </Border>
    <Image Width="200" Height="200"/>
    <Rectangle Width="100" Height="50" Fill="Red"/>
    <Ellipse Width="80" Height="80" Fill="Green"/>
</StackPanel>`, lang: "xml", title: "One-screen control reference" },
  { code: String.raw`<TabControl>
    <TabItem Header="Dinner Party">
        <StackPanel><!-- tab 1 content --></StackPanel>
    </TabItem>
    <TabItem Header="Birthday Party">
        <StackPanel><!-- tab 2 content --></StackPanel>
    </TabItem>
</TabControl>`, lang: "xml", title: "TabControl" },
  { table: { head: ["Control", "Key property", "Value type / note"], rows: [
    ["TextBox", "`Text`", "string; TwoWay by default"],
    ["CheckBox", "`IsChecked`", "**bool?** — use `?? false` in code"],
    ["NumericUpDown", "`Value`", "**decimal?** — cast `(int)numeric.Value`"],
    ["Slider", "`Value`", "double"],
    ["ComboBox", "`SelectedItem` / `SelectedIndex` / `ItemsSource`", "object / int / IEnumerable"],
    ["ListBox", "`ItemsSource`, `SelectedItem`, `SelectedItems`, `SelectionMode`", "Multiple enables SelectedItems"],
    ["Button", "`Command`, `Content`, `Click`", "Command in MVVM; Click only in code-behind apps"],
    ["Image", "`Source`", "`new Bitmap(AssetLoader.Open(new Uri(\"avares://App/Assets/cat.jpg\")))`"],
  ]}},
]},

{
id: "av-events-codebehind",
title: "Events & code-behind (when MVVM is NOT required)",
cat: "Avalonia UI",
tags: ["click", "event handler", "findcontrol", "code behind", "sender", "routedeventargs"],
related: ["av-controls", "mv-mvvm-rules"],
blocks: [
  { gotcha: "On the EXAM UI problem, code-behind work scores ZERO: that problem demands MVVM. This page is for understanding course examples and any non-MVVM sub-task." },
  { code: String.raw`<!-- XAML wires the handler by name -->
<TextBox Name="Number1TextBox"/>
<TextBox Name="Number2TextBox"/>
<TextBox Name="ResultTextBox" IsReadOnly="True"/>
<Button Name="Add" Content="Add" Click="Exercise4_Click"/>
<Button Name="Subtract" Content="Subtract" Click="Exercise4_Click"/>`, lang: "xml" },
  { code: String.raw`// Code-behind: named controls become fields automatically (x:Name/Name)
private void Exercise4_Click(object sender, RoutedEventArgs e)
{
    if (double.TryParse(Number1TextBox.Text, out double num1) &&
        double.TryParse(Number2TextBox.Text, out double num2))
    {
        double result = 0;
        if (sender.Equals(Add))      result = num1 + num2;   // one handler, many buttons:
        if (sender.Equals(Subtract)) result = num1 - num2;   // distinguish by sender
        ResultTextBox.Text = result.ToString();
    }
    else
    {
        ResultTextBox.Text = "Invalid input";
    }
}

// FindControl alternative (needed when the field isn't generated, e.g. in tests):
var box = this.FindControl<TextBox>("Number1TextBox");`, lang: "csharp", title: "Shared Click handler + TryParse validation (exercise solution)" },
  { code: String.raw`// Subscribing in C# instead of XAML (Lecture 1 style):
fancyCheckbox.IsCheckedChanged += fancyBoxCheckedChanged;
numeric.ValueChanged += numericUpDownValueChanged;
button.Click += (sender, e) => { CreateParty(); };   // lambda handler`, lang: "csharp", title: "Event subscription in code" },
]},

{
id: "av-styling",
title: "Styling: selectors, classes, pseudo-classes",
cat: "Avalonia UI",
tags: ["style", "selector", "classes", "pointerover", "pressed", "checked", "setter", "styleinclude", "resources"],
related: ["av-animations", "av-controls"],
blocks: [
  { code: String.raw`<Window.Styles>
    <!-- TYPE selector: every TextBlock in this window -->
    <Style Selector="TextBlock">
        <Setter Property="Padding" Value="10"/>
        <Setter Property="FontSize" Value="40"/>
        <Setter Property="TextAlignment" Value="Center"/>
    </Style>

    <!-- CLASS selector: only controls with Classes="highlight" -->
    <Style Selector="TextBlock.highlight">
        <Setter Property="Background" Value="DarkGreen"/>
        <Setter Property="Foreground" Value="White"/>
    </Style>

    <!-- PSEUDO-CLASS selectors: react to control state -->
    <Style Selector="Button:pointerover">
        <Setter Property="Width" Value="120"/>
        <Setter Property="Height" Value="70"/>
    </Style>
    <Style Selector="Button:pressed">
        <Setter Property="FontWeight" Value="ExtraBold"/>
    </Style>

    <!-- Style value bound to ANOTHER CONTROL by name (#name.Property) -->
    <Style Selector="Rectangle">
        <Setter Property="Fill" Value="Red"/>
        <Setter Property="Opacity" Value="{Binding #OpaSlider.Value}"/>
    </Style>
</Window.Styles>

<!-- usage -->
<TextBlock Classes="highlight" Text="Hello"/>
<Rectangle/>
<Slider Name="OpaSlider" Minimum="0" Maximum="1" Value="1"/>`, lang: "xml", title: "Selectors (styling tutorial solution)" },
  { list: [
    "Multiple classes: `Classes=\"red green\"` — both styles apply.",
    "Local attribute beats style: `<Button Classes=\"save\" Background=\"Red\"/>` keeps the red background even if `.save` sets another.",
    "Nested selector with `^` refers to the parent style's selector: a style inside `CheckBox.fading` can target `^:checked` = `CheckBox.fading:checked`.",
    "Child selector: `UniformGrid > Button` styles only direct Button children.",
    "External styles file: `<StyleInclude Source=\"/styles.axaml\"/>` inside `Window.Styles`; the file's root element is `<Styles>`.",
    "Pseudo-classes to know: `:pointerover`, `:pressed`, `:checked`, `:disabled`, `:focus`.",
  ]},
  { code: String.raw`<!-- App-wide resources (App.axaml) -->
<Application.Resources>
    <FontFamily x:Key="MyFont">avares://MyApp/Assets/FontAwesome.otf#Font Awesome 6 Free Regular</FontFamily>
</Application.Resources>
<!-- consume anywhere: -->
<TextBlock FontFamily="{StaticResource MyFont}"/>`, lang: "xml", title: "Resources + StaticResource" },
]},

{
id: "av-animations",
title: "Animations: Transitions & RenderTransform",
cat: "Avalonia UI",
tags: ["animation", "transition", "doubletransition", "rendertransform", "scale", "rotate", "translate", "fade"],
related: ["av-styling"],
blocks: [
  { p: "The course teaches animation through **Transitions**: declare which property animates and how long; whenever a style/state changes that property, the change is animated automatically." },
  { code: String.raw`<!-- Fade out when checked: Opacity animates over 0.5s -->
<Style Selector="CheckBox.fading">
    <Setter Property="Opacity" Value="1"/>
    <Setter Property="Transitions">
        <Transitions>
            <DoubleTransition Property="Opacity" Duration="0:0:0.5"/>
        </Transitions>
    </Setter>
    <Style Selector="^:checked">
        <Setter Property="Opacity" Value="0"/>
    </Style>
</Style>

<!-- Scale x5 when checked -->
<Style Selector="CheckBox.scaling">
    <Setter Property="RenderTransform" Value="scale(1)"/>
    <Setter Property="Transitions">
        <Transitions>
            <TransformOperationsTransition Property="RenderTransform" Duration="0:0:1"/>
        </Transitions>
    </Setter>
    <Style Selector="^:checked">
        <Setter Property="RenderTransform" Value="scale(5)"/>
    </Style>
</Style>

<!-- Rotate a full turn when checked -->
<Style Selector="CheckBox.rotating">
    <Setter Property="RenderTransform" Value="rotate(0)"/>
    <Setter Property="Transitions">
        <Transitions>
            <TransformOperationsTransition Property="RenderTransform" Duration="0:0:1"/>
        </Transitions>
    </Setter>
    <Style Selector="^:checked">
        <Setter Property="RenderTransform" Value="rotate(360deg)"/>
    </Style>
</Style>

<!-- Slide 100px right when checked -->
<Style Selector="CheckBox.moving">
    <Setter Property="RenderTransform" Value="translateX(0px)"/>
    <Setter Property="Transitions">
        <Transitions>
            <TransformOperationsTransition Property="RenderTransform" Duration="0:0:1"/>
        </Transitions>
    </Setter>
    <Style Selector="^:checked">
        <Setter Property="RenderTransform" Value="translateX(100px)"/>
    </Style>
</Style>

<!-- usage: -->
<CheckBox Classes="fading"   Content="Fade"/>
<CheckBox Classes="scaling"  Content="Scale"/>
<CheckBox Classes="rotating" Content="Rotate"/>
<CheckBox Classes="moving"   Content="Move"/>`, lang: "xml", title: "The four animations from the styling lecture (complete)" },
  { list: [
    "Transition types by property type: `DoubleTransition` (Opacity, Width), `TransformOperationsTransition` (RenderTransform), `BrushTransition` (Background), `ThicknessTransition` (Margin).",
    "RenderTransform string values: `scale(2)`, `rotate(45deg)`, `translateX(10px)`, `translateY(-5px)`, combinable: `scale(2) rotate(45deg)`.",
    "Duration format `0:0:0.5` = h:m:s.",
    "Hover-grow recipe: base style sets Transitions + normal size; `Button:pointerover` style sets the bigger size.",
  ]},
]},

{
id: "av-itemscontrols",
title: "Lists of things: ItemsControl, DataTemplates, Canvas items",
cat: "Avalonia UI",
tags: ["itemscontrol", "listbox", "datatemplate", "itemspanel", "itemtemplate", "canvas positioning", "contentpresenter"],
related: ["mv-observablecollection", "ex-june-p2-rectangle", "pb-snippet-bank"],
blocks: [
  { p: "Three escalation levels for showing collections, all exam-relevant:" },
  { h: "Level 1: ListBox + ToString" },
  { code: String.raw`<ListBox ItemsSource="{Binding Contacts}" SelectedItem="{Binding SelectedContact}"/>
<!-- each row shows item.ToString() -- override it in the model -->`, lang: "xml" },
  { h: "Level 2: ListBox + ItemTemplate" },
  { code: String.raw`<ListBox ItemsSource="{Binding WeekPlan}" SelectedItem="{Binding SelectedRecipe}">
    <ListBox.ItemTemplate>
        <DataTemplate>
            <!-- bindings inside resolve against the ITEM (WeeklyItem) -->
            <StackPanel Orientation="Horizontal">
                <TextBlock FontWeight="Bold" Text="{Binding Day}"/>
                <TextBlock Text="{Binding RecipeName}"/>
            </StackPanel>
        </DataTemplate>
    </ListBox.ItemTemplate>
</ListBox>`, lang: "xml", title: "Custom row layout (official re-exam solution)" },
  { h: "Level 3: ItemsControl on a Canvas (free positioning, the RectangleUI pattern)" },
  { code: String.raw`<ItemsControl ItemsSource="{Binding Rectangles}">
    <!-- 1. replace the default panel with a Canvas -->
    <ItemsControl.ItemsPanel>
        <ItemsPanelTemplate>
            <Canvas Background="LightGray" Width="500" Height="500"/>
        </ItemsPanelTemplate>
    </ItemsControl.ItemsPanel>

    <!-- 2. how each item looks -->
    <ItemsControl.ItemTemplate>
        <DataTemplate DataType="{x:Type models:RectangleData}">
            <Rectangle Width="{Binding Width}" Height="{Binding Height}"
                       Fill="{Binding Color}"/>
        </DataTemplate>
    </ItemsControl.ItemTemplate>

    <!-- 3. WHERE each item sits: Canvas.Left/Top must be set on the item CONTAINER
           (ContentPresenter), so use a style with bindings -->
    <ItemsControl.Styles>
        <Style Selector="ContentPresenter" x:DataType="models:RectangleData">
            <Setter Property="Canvas.Left" Value="{Binding X}"/>
            <Setter Property="Canvas.Top"  Value="{Binding Y}"/>
        </Style>
    </ItemsControl.Styles>
</ItemsControl>`, lang: "xml", title: "Items at bound coordinates — memorize all three parts" },
  { gotcha: "Setting `Canvas.Left` inside the DataTemplate's Rectangle does NOT work: the template content is wrapped in a ContentPresenter and THAT is the Canvas child. Hence the ContentPresenter style. This is the single most exotic thing the June exam required, and it was given in the starter file: you only had to replace the hardcoded values with `{Binding X}` / `{Binding Y}`." },
  { p: "Selection multi-bind for the re-exam highlight task: `SelectionMode=\"Multiple\"` plus `SelectedItems=\"{Binding SelectedIngredients}\"` on the ListBox; assign a new list in the ViewModel to highlight those rows." },
]},

{
id: "av-file-dialogs",
title: "File dialogs (StorageProvider)",
cat: "Avalonia UI",
tags: ["file dialog", "open file", "save file", "storageprovider", "toplevel", "stream"],
related: ["df-file-handling"],
blocks: [
  { code: String.raw`using Avalonia.Platform.Storage;
using System.IO;

// OPEN (in a Window's code-behind; this = the window)
private async void OpenFileHandler(object sender, RoutedEventArgs args)
{
    var topLevel = GetTopLevel(this);

    var files = await topLevel.StorageProvider.OpenFilePickerAsync(new FilePickerOpenOptions
    {
        Title = "Open Text File",
        AllowMultiple = false
    });

    if (files.Count >= 1)
    {
        await using var stream = await files[0].OpenReadAsync();
        using var streamReader = new StreamReader(stream);
        var fileContent = await streamReader.ReadToEndAsync();
        TextBox.Text = fileContent;
    }
}

// SAVE
private async void SaveFileHandler(object? sender, RoutedEventArgs e)
{
    var topLevel = GetTopLevel(this);

    var file = await topLevel.StorageProvider.SaveFilePickerAsync(new FilePickerSaveOptions
    {
        Title = "Save Text File"
    });

    if (file is not null)
    {
        await using var stream = await file.OpenWriteAsync();
        using var streamWriter = new StreamWriter(stream);
        await streamWriter.WriteLineAsync(TextBox.Text);
    }
}`, lang: "csharp", title: "Open & save pickers (Search_and_Replace solution, verbatim pattern)" },
  { tip: "These handlers are `async void` because they are event handlers; that is the one accepted use of async void." },
]},

{
id: "av-multiview",
title: "Multi-view navigation & UserControls",
cat: "Avalonia UI",
tags: ["navigation", "contentcontrol", "usercontrol", "viewlocator", "multi view", "wizard", "currentview"],
related: ["av-project-structure", "mv-datacontext"],
blocks: [
  { p: "The course's wizard pattern: a `ContentControl` bound to a `CurrentView` property; clicking Next swaps it. Two variants were shown:" },
  { h: "Variant A: ViewModel holds Views (works, but couples VM to Views)" },
  { code: String.raw`public partial class MainWindowViewModel : ViewModelBase
{
    private FirstView firstView   { get; } = new FirstView()  { DataContext = new FirstViewModel() };
    private SecondView secondView { get; } = new SecondView() { DataContext = new SecondViewModel() };

    [ObservableProperty]
    private UserControl _currentView;

    public MainWindowViewModel() => CurrentView = firstView;

    public void NextView()
        => CurrentView = (CurrentView == firstView) ? secondView : firstView;
}`, lang: "csharp", title: "MultiView Solution (naive)" },
  { h: "Variant B: ViewModel holds ViewModels; ViewLocator builds the Views (clean MVVM)" },
  { code: String.raw`public partial class MainWindowViewModel : ViewModelBase
{
    private FirstViewModel firstView   { get; } = new FirstViewModel();
    private SecondViewModel secondView { get; } = new SecondViewModel();

    [ObservableProperty]
    private object _currentView;        // type it object/ViewModelBase, NOT UserControl

    public MainWindowViewModel() => CurrentView = firstView;

    [RelayCommand]
    public void NextView()
        => CurrentView = (CurrentView == firstView) ? (object)secondView : firstView;
}
// App.axaml registers <local:ViewLocator/> in Application.DataTemplates;
// the ContentControl renders FirstViewModel by instantiating FirstView automatically.`, lang: "csharp", title: "View Locator variant (course solution, type corrected)" },
  { gotcha: "The course's locator-variant file typed `_currentView` as `UserControl` while assigning ViewModels: that does not compile cleanly. Type it `object` (or `ViewModelBase`) as above. Known wrinkle, worth remembering if handed that code." },
  { code: String.raw`<!-- MainWindow.axaml -->
<StackPanel>
    <ContentControl Content="{Binding CurrentView}"/>
    <Button Content="Next" Command="{Binding NextViewCommand}"/>
</StackPanel>`, lang: "xml" },
  { code: String.raw`<!-- Views/FirstView.axaml : a UserControl page -->
<UserControl xmlns="https://github.com/avaloniaui"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:vm="using:TestWizard.ViewModels"
             x:DataType="vm:FirstViewModel"
             x:Class="TestWizard.Views.FirstView">
    <TextBlock Text="{Binding Text}"/>
</UserControl>`, lang: "xml", title: "Page as UserControl" },
]}

);
