/* ============ DESIGN GALLERY (visual previews + AXAML) ============ */

window.TOPICS.push(

{
id: "dg-workflow",
title: "Reproduce any UI: the 5-step method",
cat: "Design Gallery",
tags: ["design", "workflow", "sketch", "reproduce", "build ui", "method"],
related: ["dg-layout-recipes", "dg-bundle", "pb-avalonia-ui"],
blocks: [
  { p: "Exam UI tasks give you a sketch (\"closely resemble the sketch\", 10 free points for layout alone). This is the conversion algorithm from any picture to AXAML:" },
  { steps: [
    "**Slice into rectangles.** Draw boxes around regions of the sketch: header? sidebar? two columns? bottom bar? Each box becomes a panel.",
    "**Pick the outer panel.** Edges docked + one filling rest → `DockPanel`. Strict rows/columns → `Grid` with `RowDefinitions`/`ColumnDefinitions`. Simple top-down flow → `StackPanel`. Free-floating positions → `Canvas`.",
    "**Fill each region with controls.** Text label → `TextBlock`, input → `TextBox`, choice → `ComboBox`/`RadioButton`, list of things → `ListBox`, action → `Button`. (Full menu: [[dg-inputs|inputs gallery]].)",
    "**Space and align.** `Margin` outside, `Padding` inside, `Spacing` between StackPanel children, `HorizontalAlignment`/`VerticalAlignment` to pin things. See [[dg-spacing|spacing visually]].",
    "**Style last.** Headers bold + bigger, group with `Border` + `CornerRadius`, colors via `Background`/`Foreground`. Only after the structure matches the sketch.",
  ]},
  { rule: "Layout points are graded on RESEMBLANCE, not beauty. Two ListBoxes side by side with headers and a button = `Grid ColumnDefinitions=\"*,*\"` + done. Don't gold-plate before functionality works." },
  { p: "Worked micro-example: sketch shows a title bar, a list on the left, details on the right, a button bottom-left." },
  { code: String.raw`<DockPanel>
    <TextBlock DockPanel.Dock="Top" Text="My App" FontSize="22" FontWeight="Bold" Margin="10"/>
    <Button DockPanel.Dock="Bottom" Content="Do Thing" Margin="10" HorizontalAlignment="Left"/>
    <Grid ColumnDefinitions="*,*">
        <ListBox Grid.Column="0" Margin="10"/>
        <StackPanel Grid.Column="1" Margin="10" Spacing="6">
            <TextBlock Text="Details" FontWeight="Bold"/>
            <TextBlock Text="..."/>
        </StackPanel>
    </Grid>
</DockPanel>`, lang: "xml", title: "Sketch → skeleton in 60 seconds" },
]},

{
id: "dg-window",
title: "Window recipes",
cat: "Design Gallery",
tags: ["window", "size", "title", "resize", "sizetocontent", "startup location", "background"],
related: ["dg-layout-recipes", "av-xaml-basics"],
blocks: [
  { code: String.raw`<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        x:Class="MyApp.Views.MainWindow"
        Title="My App"
        Width="900" Height="600"
        MinWidth="400" MinHeight="300"
        WindowStartupLocation="CenterScreen"
        Background="#f5f6fa">
    <!-- exactly ONE child -->
</Window>`, lang: "xml", title: "Standard fixed-size window" },
  { table: { head: ["Property", "Effect"], rows: [
    ["`Width` / `Height`", "initial size in px"],
    ["`SizeToContent=\"WidthAndHeight\"`", "window shrink-wraps its content (the Calculator app uses this)"],
    ["`CanResize=\"False\"`", "lock the size"],
    ["`WindowStartupLocation=\"CenterScreen\"`", "open centered"],
    ["`Background=\"LightGray\"` or `\"#2b2b2b\"`", "window background brush"],
    ["`Title=\"...\"`", "title bar text"],
    ["`Icon=\"/Assets/avalonia-logo.ico\"`", "title bar icon (template default)"],
  ]}},
  { gotcha: "Don't change Window properties of an exam starter unless asked: \"the original layout of the application should not change.\"" },
]},

{
id: "dg-shapes",
title: "Shapes: Rectangle, Ellipse, Line, Polygon, Path",
cat: "Design Gallery",
tags: ["shapes", "rectangle", "ellipse", "circle", "line", "polygon", "triangle", "path", "star", "stroke", "fill"],
related: ["dg-colors", "dg-canvas-scene", "ex-june-p2-rectangle"],
blocks: [
  { preview: '<div style="display:flex;gap:26px;align-items:center;flex-wrap:wrap">' +
    '<svg width="110" height="70"><rect width="110" height="70" fill="#e74c3c"/></svg>' +
    '<svg width="110" height="70"><rect width="110" height="70" rx="12" ry="12" fill="#3498db"/></svg>' +
    '<svg width="110" height="70"><rect x="2" y="2" width="106" height="66" fill="#f1c40f" stroke="#1b1b1b" stroke-width="3"/></svg>' +
    '<svg width="90" height="90"><ellipse cx="45" cy="45" rx="44" ry="44" fill="#2ecc71"/></svg>' +
    '<svg width="120" height="70"><ellipse cx="60" cy="35" rx="58" ry="33" fill="#9b59b6"/></svg>' +
    '</div>', title: "Rectangle · rounded · stroked · circle · ellipse" },
  { code: String.raw`<!-- shapes need Width+Height (or live in a sized container) -->
<Rectangle Width="110" Height="70" Fill="#E74C3C"/>

<Rectangle Width="110" Height="70" Fill="#3498DB"
           RadiusX="12" RadiusY="12"/>                  <!-- rounded corners -->

<Rectangle Width="110" Height="70" Fill="#F1C40F"
           Stroke="Black" StrokeThickness="3"/>          <!-- outline -->

<Ellipse Width="90" Height="90" Fill="#2ECC71"/>         <!-- equal W/H = circle -->
<Ellipse Width="120" Height="70" Fill="#9B59B6"/>`, lang: "xml", title: "Rectangle & Ellipse" },
  { preview: '<div style="display:flex;gap:26px;align-items:center;flex-wrap:wrap">' +
    '<svg width="130" height="70"><line x1="0" y1="60" x2="120" y2="10" stroke="#e74c3c" stroke-width="3"/></svg>' +
    '<svg width="130" height="70"><line x1="0" y1="35" x2="120" y2="35" stroke="#1b1b1b" stroke-width="2" stroke-dasharray="6 4"/></svg>' +
    '<svg width="110" height="80"><polygon points="55,5 105,75 5,75" fill="#e67e22"/></svg>' +
    '<svg width="110" height="80"><polygon points="55,2 67,30 98,30 73,49 83,78 55,60 27,78 37,49 12,30 43,30" fill="#f1c40f" stroke="#d4a017" stroke-width="2"/></svg>' +
    '<svg width="130" height="70"><path d="M 5,35 C 35,0 65,70 95,35 S 125,20 125,35" fill="none" stroke="#3498db" stroke-width="3"/></svg>' +
    '</div>', title: "Line · dashed · triangle · star · curve (Path)" },
  { code: String.raw`<!-- Line uses StartPoint / EndPoint in Avalonia (not X1/Y1!) -->
<Line StartPoint="0,60" EndPoint="120,10" Stroke="#E74C3C" StrokeThickness="3"/>

<Line StartPoint="0,35" EndPoint="120,35" Stroke="Black" StrokeThickness="2"
      StrokeDashArray="4,2"/>                            <!-- dashed -->

<!-- Polygon: list of x,y points, auto-closed -->
<Polygon Points="55,5 105,75 5,75" Fill="#E67E22"/>      <!-- triangle -->

<Polygon Points="55,2 67,30 98,30 73,49 83,78 55,60 27,78 37,49 12,30 43,30"
         Fill="#F1C40F" Stroke="#D4A017" StrokeThickness="2"/>   <!-- star -->

<!-- Path: mini drawing language. M move, L line, C curve, Z close -->
<Path Data="M 5,35 C 35,0 65,70 95,35 S 125,20 125,35"
      Stroke="#3498DB" StrokeThickness="3"/>`, lang: "xml", title: "Line, Polygon, Path" },
  { table: { head: ["Property", "Works on", "Meaning"], rows: [
    ["`Fill`", "all closed shapes", "inside color (any brush, incl. gradients)"],
    ["`Stroke` / `StrokeThickness`", "all shapes", "outline color / width"],
    ["`StrokeDashArray=\"4,2\"`", "all shapes", "dash pattern (4 on, 2 off)"],
    ["`RadiusX` / `RadiusY`", "Rectangle", "rounded corners"],
    ["`Opacity=\"0.5\"`", "any control", "transparency 0..1"],
    ["`Stretch=\"Fill|Uniform\"`", "shapes without fixed size", "how the shape fills available space"],
  ]}},
  { tip: "For rectangles that need a thick border AND rounded corners AND content inside, prefer `Border` over `Rectangle`: a Border can host a child. See [[dg-lists-cards|cards]]." },
]},

{
id: "dg-colors",
title: "Colors, brushes & gradients",
cat: "Design Gallery",
tags: ["colors", "brush", "hex", "gradient", "lineargradientbrush", "radialgradientbrush", "opacity", "transparent"],
related: ["dg-shapes", "av-styling"],
blocks: [
  { preview: '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
    ['#FF0000|Red','#1E90FF|DodgerBlue','#2E8B57|SeaGreen','#FFA500|Orange','#9370DB|MediumPurple','#FFD700|Gold','#FF69B4|HotPink','#708090|SlateGray','#ADD8E6|LightBlue','#F5F5DC|Beige'].map(function(c){var p=c.split("|");return '<div style="text-align:center"><div style="width:74px;height:44px;border-radius:6px;border:1px solid #00000022;background:'+p[0]+'"></div><div style="font-size:10px;margin-top:3px;color:#444">'+p[1]+'<br>'+p[0]+'</div></div>';}).join("") + "</div>", title: "Named colors (any CSS-style name works)" },
  { code: String.raw`<!-- three ways to say "a color" -->
<Rectangle Fill="DodgerBlue"/>            <!-- named color -->
<Rectangle Fill="#1E90FF"/>               <!-- hex RRGGBB -->
<Rectangle Fill="#801E90FF"/>             <!-- hex AARRGGBB: 80 = 50% alpha FIRST -->

<!-- in C#: -->
<!-- rect.Fill = Brushes.DodgerBlue;
     rect.Fill = new SolidColorBrush(Color.Parse("#1E90FF")); -->`, lang: "xml", title: "Solid colors" },
  { preview: '<div style="display:flex;gap:14px;flex-wrap:wrap">' +
    '<div style="width:170px;height:60px;border-radius:6px;background:linear-gradient(to right,#ff512f,#dd2476)"></div>' +
    '<div style="width:170px;height:60px;border-radius:6px;background:linear-gradient(135deg,#1fa2ff,#12d8fa,#a6ffcb)"></div>' +
    '<div style="width:170px;height:60px;border-radius:6px;background:radial-gradient(circle at 50% 40%,#fceabb,#f8b500)"></div>' +
    '<div style="width:170px;height:60px;border-radius:6px;border:1px solid #ccc;background:repeating-conic-gradient(#e0e0e0 0% 25%, #ffffff 0% 50%) 0 0/16px 16px"><div style="width:100%;height:100%;background:#1E90FF;opacity:.45;border-radius:6px"></div></div>' +
    '</div>', title: "Linear · 3-stop diagonal · radial · 45% opacity over checkers" },
  { code: String.raw`<!-- horizontal two-stop gradient -->
<Rectangle Width="170" Height="60">
    <Rectangle.Fill>
        <LinearGradientBrush StartPoint="0%,50%" EndPoint="100%,50%">
            <GradientStop Color="#FF512F" Offset="0"/>
            <GradientStop Color="#DD2476" Offset="1"/>
        </LinearGradientBrush>
    </Rectangle.Fill>
</Rectangle>

<!-- diagonal three-stop -->
<Border Width="170" Height="60" CornerRadius="6">
    <Border.Background>
        <LinearGradientBrush StartPoint="0%,0%" EndPoint="100%,100%">
            <GradientStop Color="#1FA2FF" Offset="0"/>
            <GradientStop Color="#12D8FA" Offset="0.5"/>
            <GradientStop Color="#A6FFCB" Offset="1"/>
        </LinearGradientBrush>
    </Border.Background>
</Border>

<!-- radial -->
<Ellipse Width="170" Height="60">
    <Ellipse.Fill>
        <RadialGradientBrush Center="50%,40%" GradientOrigin="50%,40%" Radius="0.7">
            <GradientStop Color="#FCEABB" Offset="0"/>
            <GradientStop Color="#F8B500" Offset="1"/>
        </RadialGradientBrush>
    </Ellipse.Fill>
</Ellipse>

<!-- transparency: alpha hex or Opacity -->
<Rectangle Fill="#1E90FF" Opacity="0.45"/>
<Rectangle Fill="Transparent"/>           <!-- invisible but still hit-testable -->`, lang: "xml", title: "Gradients & opacity" },
  { tip: "Predefined color list of an exam VM: `private readonly IBrush[] _colors = { Brushes.Red, Brushes.Blue, Brushes.Green, Brushes.Orange, Brushes.Purple };` then bind `Fill=\"{Binding Color}\"` (property type `IBrush`). Exactly what RectangleUI 2.3 wanted." },
]},

{
id: "dg-typography",
title: "Text & typography",
cat: "Design Gallery",
tags: ["text", "textblock", "fontsize", "fontweight", "italic", "underline", "wrap", "alignment", "label"],
related: ["dg-buttons", "av-controls"],
blocks: [
  { preview: '<div style="display:flex;flex-direction:column;gap:8px">' +
    '<div style="font-size:28px;font-weight:700">Page Title (28, Bold)</div>' +
    '<div style="font-size:18px;font-weight:600;color:#444">Section header (18, SemiBold)</div>' +
    '<div style="font-size:13px">Body text at the default size for reading lengths of content.</div>' +
    '<div style="font-size:13px;font-style:italic;color:#666">Italic hint text in gray (#666)</div>' +
    '<div style="font-size:13px;text-decoration:underline">Underlined</div>' +
    '<div style="font-size:13px;text-decoration:line-through;color:#999">Strikethrough</div>' +
    '<div style="font-size:12px;color:#0078d4;font-weight:600">ACCENT LABEL (#0078D4)</div>' +
    '<div style="width:260px;font-size:13px;border:1px dashed #bbb;padding:6px">Wrapping: TextWrapping=&quot;Wrap&quot; makes long text flow onto multiple lines inside its given width.</div>' +
    '</div>', title: "Type scale" },
  { code: String.raw`<TextBlock Text="Page Title" FontSize="28" FontWeight="Bold"/>
<TextBlock Text="Section header" FontSize="18" FontWeight="SemiBold" Foreground="#444444"/>
<TextBlock Text="Body text..." FontSize="13"/>
<TextBlock Text="Italic hint text" FontStyle="Italic" Foreground="#666666"/>
<TextBlock Text="Underlined" TextDecorations="Underline"/>
<TextBlock Text="Strikethrough" TextDecorations="Strikethrough" Foreground="#999999"/>
<TextBlock Text="ACCENT LABEL" Foreground="#0078D4" FontWeight="SemiBold" FontSize="12"/>

<!-- wrapping + trimming -->
<TextBlock Width="260" TextWrapping="Wrap"
           Text="Long text flows onto multiple lines inside its width."/>
<TextBlock Width="160" TextTrimming="CharacterEllipsis" Text="Too long gets an ellipsis..."/>

<!-- alignment within the TextBlock's space -->
<TextBlock TextAlignment="Center" Text="centered"/>

<!-- weights: Thin Light Normal Medium SemiBold Bold ExtraBold Black -->`, lang: "xml", title: "TextBlock cookbook" },
  { p: "`Label` (used in early lectures: `Content=\"Number of People\"`) is for captions attached to inputs; `TextBlock` is the general text element and what you bind: `Text=\"{Binding Count}\"`." },
]},

{
id: "dg-buttons",
title: "Buttons: every look",
cat: "Design Gallery",
tags: ["button", "accent", "styled button", "cornerradius", "hover", "disabled", "icon button", "full width"],
related: ["dg-inputs", "av-styling", "mv-relaycommand"],
blocks: [
  { preview: '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
    '<span style="background:#fbfbfb;border:1px solid #d1d1d1;border-bottom-color:#b0b0b0;border-radius:4px;padding:6px 18px;font-size:13px">Default</span>' +
    '<span style="background:#0078d4;color:#fff;border:1px solid #0067b8;border-radius:4px;padding:6px 18px;font-size:13px">Accent</span>' +
    '<span style="background:#2ecc71;color:#fff;border:none;border-radius:18px;padding:8px 22px;font-size:13px;font-weight:600">Pill / custom</span>' +
    '<span style="background:#e74c3c;color:#fff;border:none;border-radius:4px;padding:6px 18px;font-size:13px">Danger</span>' +
    '<span style="background:#fbfbfb;border:1px solid #d1d1d1;border-radius:4px;padding:6px 12px;font-size:15px">＋</span>' +
    '<span style="background:#f0f0f0;color:#9d9d9d;border:1px solid #e0e0e0;border-radius:4px;padding:6px 18px;font-size:13px">Disabled</span>' +
    '</div>', title: "Button variants (Fluent light)" },
  { code: String.raw`<!-- default Fluent button -->
<Button Content="Default" Command="{Binding DoThingCommand}"/>

<!-- built-in blue accent (Fluent theme class) -->
<Button Content="Accent" Classes="accent"/>

<!-- custom-styled: any Background/CornerRadius/Padding you like -->
<Button Content="Pill / custom"
        Background="#2ECC71" Foreground="White"
        CornerRadius="18" Padding="22,8" FontWeight="SemiBold"/>

<Button Content="Danger" Background="#E74C3C" Foreground="White" CornerRadius="4"/>

<!-- icon-ish button: just use a glyph as content -->
<Button Content="＋" FontSize="15"/>

<!-- disabled: IsEnabled or (better in MVVM) a command whose CanExecute is false -->
<Button Content="Disabled" IsEnabled="False"/>

<!-- full-width -->
<Button Content="Save" HorizontalAlignment="Stretch" HorizontalContentAlignment="Center"/>`, lang: "xml", title: "All variants" },
  { code: String.raw`<!-- hover/press behavior via styles (put in Window.Styles) -->
<Style Selector="Button.grow">
    <Setter Property="RenderTransform" Value="scale(1)"/>
    <Setter Property="Transitions">
        <Transitions>
            <TransformOperationsTransition Property="RenderTransform" Duration="0:0:0.15"/>
        </Transitions>
    </Setter>
</Style>
<Style Selector="Button.grow:pointerover">
    <Setter Property="RenderTransform" Value="scale(1.08)"/>
</Style>
<Style Selector="Button.grow:pressed">
    <Setter Property="RenderTransform" Value="scale(0.95)"/>
</Style>`, lang: "xml", title: "Animated hover (Classes=\"grow\")" },
]},

{
id: "dg-inputs",
title: "Inputs & form controls gallery",
cat: "Design Gallery",
tags: ["inputs", "textbox", "watermark", "password", "checkbox", "radiobutton", "combobox", "slider", "numericupdown", "datepicker", "toggleswitch", "progressbar"],
related: ["dg-form-recipe", "av-controls", "mv-binding-cookbook"],
blocks: [
  { preview: '<div style="display:flex;flex-direction:column;gap:10px;max-width:330px">' +
    '<input readonly value="Typed text" style="background:#fff;border:1px solid #ababab;border-bottom:2px solid #5c5c5c;border-radius:4px;padding:6px 10px;font-size:13px">' +
    '<input readonly placeholder="Watermark hint..." style="background:#fff;border:1px solid #ababab;border-bottom:2px solid #5c5c5c;border-radius:4px;padding:6px 10px;font-size:13px">' +
    '<input readonly value="••••••••" style="background:#fff;border:1px solid #ababab;border-bottom:2px solid #5c5c5c;border-radius:4px;padding:6px 10px;font-size:13px">' +
    '<div style="display:flex;gap:18px;align-items:center"><span><span style="display:inline-block;width:15px;height:15px;background:#0078d4;border-radius:3px;color:#fff;font-size:11px;text-align:center;line-height:15px;margin-right:6px;vertical-align:-2px">✓</span>Checked</span><span><span style="display:inline-block;width:15px;height:15px;border:1px solid #8a8a8a;border-radius:3px;margin-right:6px;vertical-align:-2px"></span>Unchecked</span></div>' +
    '<div style="display:flex;gap:18px;align-items:center"><span><span style="display:inline-block;width:14px;height:14px;border:4px solid #0078d4;border-radius:50%;margin-right:6px;vertical-align:-2px"></span>Cat</span><span><span style="display:inline-block;width:14px;height:14px;border:1px solid #8a8a8a;border-radius:50%;margin-right:6px;vertical-align:-2px"></span>Dog</span></div>' +
    '<div style="background:#fff;border:1px solid #ababab;border-radius:4px;padding:6px 10px;font-size:13px;display:flex;justify-content:space-between"><span>Medium</span><span style="color:#555">▾</span></div>' +
    '<div style="padding:6px 0"><div style="width:240px;height:4px;background:#8a8a8a;border-radius:2px;position:relative"><div style="width:55%;height:100%;background:#0078d4;border-radius:2px"></div><div style="position:absolute;left:124px;top:-7px;width:18px;height:18px;background:#0078d4;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #bbb"></div></div></div>' +
    '<div style="display:flex;align-items:center;gap:8px"><div style="width:42px;height:22px;background:#0078d4;border-radius:11px;position:relative"><div style="position:absolute;right:3px;top:3px;width:16px;height:16px;background:#fff;border-radius:50%"></div></div><span>On</span></div>' +
    '<div style="width:240px;height:6px;background:#e0e0e0;border-radius:3px"><div style="width:70%;height:100%;background:#0078d4;border-radius:3px"></div></div>' +
    '</div>', title: "TextBoxes · CheckBox · Radio · ComboBox · Slider · ToggleSwitch · ProgressBar" },
  { code: String.raw`<StackPanel Spacing="10" Width="330">

    <TextBox Text="{Binding Name}"/>
    <TextBox Watermark="Watermark hint..." Text="{Binding Email}"/>
    <TextBox PasswordChar="•" Watermark="Password" Text="{Binding Password}"/>
    <TextBox Height="80" AcceptsReturn="True" TextWrapping="Wrap"
             Watermark="Multi-line notes..."/>
    <TextBox IsReadOnly="True" Text="read-only output box"/>

    <CheckBox Content="Checked" IsChecked="{Binding IsFancy}"/>
    <CheckBox Content="Unchecked"/>

    <!-- same GroupName = only one selectable -->
    <StackPanel Orientation="Horizontal" Spacing="18">
        <RadioButton GroupName="Pet" Content="Cat" IsChecked="True"/>
        <RadioButton GroupName="Pet" Content="Dog"/>
    </StackPanel>

    <ComboBox ItemsSource="{Binding CakeSizeOptions}"
              SelectedItem="{Binding CakeSize}"
              PlaceholderText="Pick a size"/>

    <Slider Minimum="0" Maximum="100" Value="{Binding Amount}"
            TickFrequency="10" IsSnapToTickEnabled="True"/>

    <NumericUpDown Minimum="1" Maximum="100" Increment="1" Value="{Binding People}"/>

    <ToggleSwitch OnContent="On" OffContent="Off" IsChecked="{Binding IsEnabled}"/>

    <DatePicker SelectedDate="{Binding Date}"/>

    <ProgressBar Minimum="0" Maximum="100" Value="70"/>
    <ProgressBar IsIndeterminate="True"/>

</StackPanel>`, lang: "xml", title: "The whole input vocabulary, bound" },
  { gotcha: "Types behind the bindings: CheckBox/ToggleSwitch `IsChecked` is `bool?`; NumericUpDown `Value` is `decimal?`; Slider `Value` is `double`; DatePicker `SelectedDate` is `DateTimeOffset?`. Match your ViewModel property types or the binding silently fails." },
]},

{
id: "dg-form-recipe",
title: "Recipe: labeled forms (login & settings)",
cat: "Design Gallery",
tags: ["form", "login", "labels", "grid form", "settings", "submit", "recipe"],
related: ["dg-inputs", "dg-buttons", "av-grid"],
blocks: [
  { preview: '<div style="max-width:340px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:8px;padding:24px;box-shadow:0 2px 10px #00000014">' +
    '<div style="font-size:20px;font-weight:700;margin-bottom:14px;text-align:center">Sign in</div>' +
    '<div style="font-size:12px;color:#555;margin-bottom:4px">Username</div>' +
    '<input readonly style="width:100%;background:#fff;border:1px solid #ababab;border-bottom:2px solid #5c5c5c;border-radius:4px;padding:6px 10px;font-size:13px;margin-bottom:10px">' +
    '<div style="font-size:12px;color:#555;margin-bottom:4px">Password</div>' +
    '<input readonly value="••••••" style="width:100%;background:#fff;border:1px solid #ababab;border-bottom:2px solid #5c5c5c;border-radius:4px;padding:6px 10px;font-size:13px;margin-bottom:10px">' +
    '<div style="font-size:13px;margin-bottom:14px"><span style="display:inline-block;width:14px;height:14px;border:1px solid #8a8a8a;border-radius:3px;margin-right:6px;vertical-align:-2px"></span>Remember me</div>' +
    '<div style="background:#0078d4;color:#fff;border-radius:4px;padding:8px;text-align:center;font-size:13px;font-weight:600">Log in</div>' +
    '<div style="color:#c42b1c;font-size:12px;margin-top:10px;text-align:center">Wrong username or password</div>' +
    '</div>', title: "Login card" },
  { code: String.raw`<!-- centered card login form -->
<Border Background="White" CornerRadius="8" Padding="24" Width="340"
        HorizontalAlignment="Center" VerticalAlignment="Center"
        BoxShadow="0 2 10 0 #14000000">
    <StackPanel Spacing="6">
        <TextBlock Text="Sign in" FontSize="20" FontWeight="Bold"
                   HorizontalAlignment="Center" Margin="0,0,0,8"/>

        <TextBlock Text="Username" FontSize="12" Foreground="#555555"/>
        <TextBox Text="{Binding Username}" Margin="0,0,0,4"/>

        <TextBlock Text="Password" FontSize="12" Foreground="#555555"/>
        <TextBox PasswordChar="•" Text="{Binding Password}" Margin="0,0,0,4"/>

        <CheckBox Content="Remember me" Margin="0,0,0,8"/>

        <Button Content="Log in" Classes="accent"
                HorizontalAlignment="Stretch" HorizontalContentAlignment="Center"
                Command="{Binding LoginCommand}"/>

        <TextBlock Text="{Binding ErrorMessage}" Foreground="#C42B1C"
                   FontSize="12" HorizontalAlignment="Center"
                   IsVisible="{Binding HasError}"/>
    </StackPanel>
</Border>`, lang: "xml", title: "Login card (homework's login screen, ready to paste)" },
  { code: String.raw`<!-- label-left form: the Grid pattern (calculator exercise style) -->
<Grid RowDefinitions="Auto,Auto,Auto,Auto" ColumnDefinitions="120,*"
      Margin="16" VerticalAlignment="Top">
    <Grid.Styles>
        <Style Selector="TextBlock"><Setter Property="VerticalAlignment" Value="Center"/></Style>
        <Style Selector="TextBox, ComboBox"><Setter Property="Margin" Value="0,4"/></Style>
    </Grid.Styles>

    <TextBlock Grid.Row="0" Grid.Column="0" Text="Name:"/>
    <TextBox   Grid.Row="0" Grid.Column="1" Text="{Binding Name}"/>

    <TextBlock Grid.Row="1" Grid.Column="0" Text="Email:"/>
    <TextBox   Grid.Row="1" Grid.Column="1" Text="{Binding Email}"/>

    <TextBlock Grid.Row="2" Grid.Column="0" Text="Role:"/>
    <ComboBox  Grid.Row="2" Grid.Column="1" ItemsSource="{Binding Roles}"
               SelectedItem="{Binding SelectedRole}"/>

    <Button Grid.Row="3" Grid.Column="1" Content="Save" Classes="accent"
            HorizontalAlignment="Right" Margin="0,10,0,0"
            Command="{Binding SaveCommand}"/>
</Grid>`, lang: "xml", title: "Label-left settings form" },
  { tip: "`IsVisible=\"{Binding HasError}\"` + a `public bool HasError => !string.IsNullOrEmpty(ErrorMessage);` (with `[NotifyPropertyChangedFor(nameof(HasError))]` on the message field) = clean conditional error display." },
]},

{
id: "dg-tabs",
title: "Tabs (TabControl) designs",
cat: "Design Gallery",
tags: ["tabs", "tabcontrol", "tabitem", "tabstripplacement", "header", "multi page"],
related: ["dg-layout-recipes", "av-multiview", "dg-bundle"],
blocks: [
  { preview: '<div style="background:#fff;border:1px solid #ddd;border-radius:6px;overflow:hidden">' +
    '<div style="display:flex;gap:4px;padding:8px 10px 0">' +
    '<div style="padding:7px 16px;font-size:13px;font-weight:600;border-bottom:3px solid #0078d4">Dinner Party</div>' +
    '<div style="padding:7px 16px;font-size:13px;color:#666;border-bottom:3px solid transparent">Birthday Party</div>' +
    '<div style="padding:7px 16px;font-size:13px;color:#666;border-bottom:3px solid transparent">Settings</div>' +
    '</div><div style="border-top:1px solid #eee;padding:18px;font-size:13px;color:#444">Content of the selected tab. Each TabItem holds ONE child panel.</div></div>', title: "Standard top tabs" },
  { code: String.raw`<TabControl>
    <TabItem Header="Dinner Party">
        <StackPanel Margin="10" Spacing="8">
            <TextBlock Text="Dinner party form goes here"/>
        </StackPanel>
    </TabItem>
    <TabItem Header="Birthday Party">
        <StackPanel Margin="10" Spacing="8">
            <TextBlock Text="Birthday party form goes here"/>
        </StackPanel>
    </TabItem>
    <TabItem Header="Settings">
        <TextBlock Margin="10" Text="Settings"/>
    </TabItem>
</TabControl>`, lang: "xml", title: "Basic TabControl (PartyPlanner / exercises pattern)" },
  { code: String.raw`<!-- tabs on the left (vertical navigation feel) -->
<TabControl TabStripPlacement="Left">
    <TabItem Header="Home"> ... </TabItem>
    <TabItem Header="Profile"> ... </TabItem>
</TabControl>
<!-- also: Top (default), Bottom, Right -->

<!-- richer headers: any content, not just text -->
<TabItem>
    <TabItem.Header>
        <StackPanel Orientation="Horizontal" Spacing="6">
            <Ellipse Width="10" Height="10" Fill="#2ECC71"/>
            <TextBlock Text="Online"/>
        </StackPanel>
    </TabItem.Header>
    <TextBlock Text="..."/>
</TabItem>

<!-- styling tab headers -->
<Style Selector="TabItem">
    <Setter Property="FontSize" Value="14"/>
</Style>
<Style Selector="TabItem:selected">
    <Setter Property="Foreground" Value="#0078D4"/>
</Style>`, lang: "xml", title: "Placement, rich headers, selected style" },
  { p: "Tabs vs multi-view navigation: TabControl is the zero-effort option when all pages can exist at once. The MVVM wizard ([[av-multiview|ContentControl + ViewLocator]]) is for when pages need their own ViewModels or conditional flow (login → role-specific screens, like the homework)." },
]},

{
id: "dg-lists-cards",
title: "Lists, cards & scrolling",
cat: "Design Gallery",
tags: ["listbox", "cards", "border", "cornerradius", "boxshadow", "scrollviewer", "itemtemplate", "horizontal list"],
related: ["av-itemscontrols", "dg-layout-recipes"],
blocks: [
  { preview: '<div style="display:flex;gap:22px;flex-wrap:wrap">' +
    '<div style="width:200px;background:#fff;border:1px solid #ddd;border-radius:6px;padding:4px;font-size:13px">' +
    '<div style="padding:7px 10px;background:#cce4f7;border-radius:4px">Spaghetti (selected)</div>' +
    '<div style="padding:7px 10px">Vegetable Curry</div>' +
    '<div style="padding:7px 10px">Lentil Soup</div>' +
    '<div style="padding:7px 10px">Beef Tacos</div></div>' +
    '<div style="display:flex;flex-direction:column;gap:10px;width:250px">' +
    '<div style="background:#fff;border:1px solid #e3e3e3;border-radius:8px;padding:12px;box-shadow:0 2px 6px #0000000f"><div style="font-weight:600;font-size:13px">Monday</div><div style="font-size:12px;color:#666">Spaghetti Carbonara</div><div style="font-size:11px;color:#0078d4;margin-top:4px">4 ingredients</div></div>' +
    '<div style="background:#fff;border:1px solid #e3e3e3;border-radius:8px;padding:12px;box-shadow:0 2px 6px #0000000f"><div style="font-weight:600;font-size:13px">Tuesday</div><div style="font-size:12px;color:#666">Vegetable Curry</div><div style="font-size:11px;color:#0078d4;margin-top:4px">3 ingredients</div></div>' +
    '</div></div>', title: "Plain ListBox · card-style ItemTemplate" },
  { code: String.raw`<!-- plain list: rows show ToString() -->
<ListBox ItemsSource="{Binding Recipes}" SelectedItem="{Binding SelectedRecipe}"
         Background="White" CornerRadius="6"/>`, lang: "xml", title: "Plain" },
  { code: String.raw`<!-- card list: each item is a Border "card" -->
<ListBox ItemsSource="{Binding WeekPlan}" Background="Transparent">
    <ListBox.ItemTemplate>
        <DataTemplate>
            <Border Background="White" BorderBrush="#E3E3E3" BorderThickness="1"
                    CornerRadius="8" Padding="12" Margin="0,4"
                    BoxShadow="0 2 6 0 #0F000000">
                <StackPanel>
                    <TextBlock Text="{Binding Day}" FontWeight="SemiBold"/>
                    <TextBlock Text="{Binding RecipeName}" Foreground="#666666" FontSize="12"/>
                </StackPanel>
            </Border>
        </DataTemplate>
    </ListBox.ItemTemplate>
</ListBox>`, lang: "xml", title: "Cards" },
  { code: String.raw`<!-- horizontal strip: swap the items panel -->
<ListBox ItemsSource="{Binding Photos}">
    <ListBox.ItemsPanel>
        <ItemsPanelTemplate>
            <StackPanel Orientation="Horizontal" Spacing="8"/>
        </ItemsPanelTemplate>
    </ListBox.ItemsPanel>
</ListBox>

<!-- grid of items: WrapPanel as the items panel -->
<ItemsControl ItemsSource="{Binding Products}">
    <ItemsControl.ItemsPanel>
        <ItemsPanelTemplate>
            <WrapPanel/>
        </ItemsPanelTemplate>
    </ItemsControl.ItemsPanel>
</ItemsControl>

<!-- anything scrollable: wrap it -->
<ScrollViewer Height="300">
    <StackPanel><!-- tall content --></StackPanel>
</ScrollViewer>`, lang: "xml", title: "Horizontal / wrapped / scrolling" },
  { tip: "ListBox already scrolls internally when constrained (give it a Height or put it in a `*` Grid row). Only standalone tall content needs an explicit ScrollViewer." },
]},

{
id: "dg-spacing",
title: "Spacing & alignment, visually",
cat: "Design Gallery",
tags: ["margin", "padding", "spacing", "alignment", "stretch", "center", "layout debug"],
related: ["av-layout", "dg-layout-recipes"],
blocks: [
  { preview: '<div style="display:flex;gap:30px;flex-wrap:wrap;align-items:flex-start">' +
    '<div><div style="font-size:11px;color:#777;margin-bottom:6px">Margin (outside) vs Padding (inside)</div>' +
    '<div style="background:#ffe2b8;display:inline-block;padding:18px"><div style="background:#bde0fe;padding:14px;border:2px solid #0078d4"><span style="background:#fff;padding:2px 6px;border:1px solid #999;font-size:12px">content</span></div></div>' +
    '<div style="font-size:10px;color:#777;margin-top:4px">orange = Margin area · blue = Padding area</div></div>' +
    '<div><div style="font-size:11px;color:#777;margin-bottom:6px">HorizontalAlignment in a full-width row</div>' +
    '<div style="width:260px;border:1px dashed #aaa;padding:4px;margin-bottom:4px"><span style="background:#0078d4;color:#fff;font-size:11px;padding:3px 10px;border-radius:3px">Left</span></div>' +
    '<div style="width:260px;border:1px dashed #aaa;padding:4px;margin-bottom:4px;text-align:center"><span style="background:#0078d4;color:#fff;font-size:11px;padding:3px 10px;border-radius:3px">Center</span></div>' +
    '<div style="width:260px;border:1px dashed #aaa;padding:4px;margin-bottom:4px;text-align:right"><span style="background:#0078d4;color:#fff;font-size:11px;padding:3px 10px;border-radius:3px">Right</span></div>' +
    '<div style="width:260px;border:1px dashed #aaa;padding:4px"><span style="display:block;background:#0078d4;color:#fff;font-size:11px;padding:3px 10px;border-radius:3px;text-align:center">Stretch (default)</span></div></div>' +
    '</div>', title: "The two spacing systems + alignment" },
  { code: String.raw`<!-- Margin: space OUTSIDE the control -->
<Button Margin="20"/>            <!-- all four sides -->
<Button Margin="20,10"/>         <!-- horizontal, vertical -->
<Button Margin="20,10,5,0"/>     <!-- left, top, right, bottom -->

<!-- Padding: space INSIDE a container, around its content -->
<Border Padding="15"> ... </Border>
<Button Padding="22,8" Content="Roomy"/>

<!-- Spacing: gap BETWEEN StackPanel children (instead of margins on each) -->
<StackPanel Spacing="10"> ... </StackPanel>

<!-- Alignment: where a control sits in the space its parent gives it -->
<Button HorizontalAlignment="Left"/>     <!-- Left | Center | Right | Stretch -->
<Button VerticalAlignment="Center"/>     <!-- Top | Center | Bottom | Stretch -->`, lang: "xml", title: "Margin / Padding / Spacing / Alignment" },
  { rule: "Debug layout fast: temporarily give panels loud backgrounds (`Background=\"#33FF0000\"`). You instantly see who owns which space. Remove before submitting." },
]},

{
id: "dg-layout-recipes",
title: "Page skeletons: 4 classic layouts",
cat: "Design Gallery",
tags: ["layout recipes", "sidebar", "header", "footer", "master detail", "dashboard", "skeleton", "page"],
related: ["dg-workflow", "av-layout", "av-grid"],
blocks: [
  { h: "1 · Header + sidebar + content (the app classic)" },
  { preview: '<div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;width:420px;font-size:11px">' +
    '<div style="background:#0078d4;color:#fff;padding:8px 12px;font-weight:600">Header / Menu</div>' +
    '<div style="display:flex;height:120px"><div style="background:#e8e8e8;width:110px;padding:8px">Sidebar<div style="margin-top:6px;color:#555">Home<br>Settings<br>Profile</div></div>' +
    '<div style="flex:1;background:#fff;padding:10px;color:#777">Content fills the rest</div></div></div>' },
  { code: String.raw`<DockPanel>
    <Border DockPanel.Dock="Top" Background="#0078D4" Padding="12,8">
        <TextBlock Text="Header / Menu" Foreground="White" FontWeight="SemiBold"/>
    </Border>
    <StackPanel DockPanel.Dock="Left" Width="120" Background="#E8E8E8">
        <TextBlock Text="Sidebar" FontWeight="Bold" Margin="8"/>
        <ListBox Background="Transparent">
            <ListBoxItem Content="Home"/>
            <ListBoxItem Content="Settings"/>
            <ListBoxItem Content="Profile"/>
        </ListBox>
    </StackPanel>
    <Border Background="White" Padding="10">
        <TextBlock Text="Content fills the rest"/>
    </Border>
</DockPanel>`, lang: "xml" },
  { h: "2 · Header + content + footer (Grid rows)" },
  { preview: '<div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;width:420px;font-size:11px">' +
    '<div style="background:#2c3e50;color:#fff;padding:8px 12px">Title bar (Auto)</div>' +
    '<div style="background:#fff;padding:10px;height:90px;color:#777">Main content (*)</div>' +
    '<div style="background:#ecf0f1;padding:6px 12px;color:#555;border-top:1px solid #ddd">Status bar (Auto)</div></div>' },
  { code: String.raw`<Grid RowDefinitions="Auto,*,Auto">
    <Border Grid.Row="0" Background="#2C3E50" Padding="12,8">
        <TextBlock Text="Title bar" Foreground="White"/>
    </Border>
    <ScrollViewer Grid.Row="1">
        <StackPanel Margin="10"><!-- main content --></StackPanel>
    </ScrollViewer>
    <Border Grid.Row="2" Background="#ECF0F1" Padding="12,6">
        <TextBlock Text="Status bar" Foreground="#555555"/>
    </Border>
</Grid>`, lang: "xml" },
  { h: "3 · Master-detail (two columns, the re-exam shape)" },
  { preview: '<div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;width:420px;font-size:11px;display:flex">' +
    '<div style="width:50%;background:#fff;border-right:1px solid #ddd;padding:8px"><b>Meal Plan</b><div style="margin-top:5px;background:#cce4f7;padding:4px 6px;border-radius:3px">Mon: Spaghetti</div><div style="padding:4px 6px">Tue: Curry</div><div style="padding:4px 6px">Wed: Soup</div><div style="margin-top:8px;display:inline-block;background:#fbfbfb;border:1px solid #ccc;border-radius:3px;padding:3px 10px">Generate</div></div>' +
    '<div style="width:50%;background:#f7f7f7;padding:8px"><b>Shopping List</b><div style="margin-top:5px;background:#cce4f7;padding:4px 6px;border-radius:3px">Pasta</div><div style="background:#cce4f7;padding:4px 6px;border-radius:3px;margin-top:2px">Tomatoes</div><div style="padding:4px 6px">Lentils</div></div></div>' },
  { code: String.raw`<Grid ColumnDefinitions="*,*" Margin="10">
    <StackPanel Grid.Column="0" Margin="0,0,10,0">
        <TextBlock Text="Meal Plan" FontWeight="Bold"/>
        <ListBox ItemsSource="{Binding WeekPlan}" SelectedItem="{Binding SelectedRecipe}"/>
        <Button Content="Generate" Command="{Binding CreateWeeklyPlanCommand}" Margin="0,10,0,0"/>
    </StackPanel>
    <StackPanel Grid.Column="1">
        <TextBlock Text="Shopping List" FontWeight="Bold"/>
        <ListBox ItemsSource="{Binding ShoppingList}"
                 SelectionMode="Multiple" SelectedItems="{Binding SelectedIngredients}"/>
    </StackPanel>
</Grid>`, lang: "xml" },
  { h: "4 · Dashboard card grid" },
  { preview: '<div style="border:1px solid #ccc;border-radius:6px;width:420px;background:#f0f2f5;padding:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px">' +
    ['Users|1,204|#0078d4','Sales|$8.3k|#2ecc71','Errors|3|#e74c3c','Uptime|99.9%|#9b59b6','Tasks|17|#e67e22','Disk|71%|#16a085'].map(function(c){var p=c.split("|");return '<div style="background:#fff;border-radius:6px;padding:10px;box-shadow:0 1px 4px #00000012"><div style="color:#888">'+p[0]+'</div><div style="font-size:17px;font-weight:700;color:'+p[2]+'">'+p[1]+'</div></div>';}).join("") + '</div>' },
  { code: String.raw`<UniformGrid Columns="3" Margin="10">
    <Border Background="White" CornerRadius="6" Padding="12" Margin="6"
            BoxShadow="0 1 4 0 #12000000">
        <StackPanel>
            <TextBlock Text="Users" Foreground="#888888" FontSize="12"/>
            <TextBlock Text="1,204" FontSize="22" FontWeight="Bold" Foreground="#0078D4"/>
        </StackPanel>
    </Border>
    <!-- repeat per card; or bind with an ItemsControl + WrapPanel for dynamic cards -->
</UniformGrid>`, lang: "xml" },
]},

{
id: "dg-canvas-scene",
title: "Canvas drawing: compose a scene",
cat: "Design Gallery",
tags: ["canvas", "scene", "drawing", "zindex", "positioning", "absolute", "house"],
related: ["dg-shapes", "av-layout", "ex-june-p2-rectangle"],
blocks: [
  { preview: '<svg width="380" height="220" style="background:#bfe3f2;border-radius:6px">' +
    '<circle cx="320" cy="45" r="28" fill="#f9d71c"/>' +
    '<rect x="0" y="170" width="380" height="50" fill="#7ec850"/>' +
    '<rect x="70" y="100" width="120" height="80" fill="#e8b06b"/>' +
    '<polygon points="60,100 130,55 200,100" fill="#b5482a"/>' +
    '<rect x="100" y="135" width="28" height="45" fill="#6b4a2b"/>' +
    '<rect x="150" y="115" width="24" height="22" fill="#bfe9ff" stroke="#6b4a2b" stroke-width="2"/>' +
    '<ellipse cx="280" cy="80" rx="34" ry="16" fill="#ffffff" opacity="0.9"/>' +
    '<ellipse cx="305" cy="90" rx="26" ry="13" fill="#ffffff" opacity="0.9"/>' +
    '</svg>', title: "A composed Canvas scene" },
  { code: String.raw`<Canvas Width="380" Height="220" Background="#BFE3F2">

    <!-- sun (drawn first = behind everything later) -->
    <Ellipse Canvas.Left="292" Canvas.Top="17" Width="56" Height="56" Fill="#F9D71C"/>

    <!-- ground strip pinned to the bottom -->
    <Rectangle Canvas.Left="0" Canvas.Top="170" Width="380" Height="50" Fill="#7EC850"/>

    <!-- house body -->
    <Rectangle Canvas.Left="70" Canvas.Top="100" Width="120" Height="80" Fill="#E8B06B"/>

    <!-- roof: Polygon points are CANVAS coordinates -->
    <Polygon Points="60,100 130,55 200,100" Fill="#B5482A"/>

    <!-- door + window draw ON TOP because they come later in the file -->
    <Rectangle Canvas.Left="100" Canvas.Top="135" Width="28" Height="45" Fill="#6B4A2B"/>
    <Rectangle Canvas.Left="150" Canvas.Top="115" Width="24" Height="22"
               Fill="#BFE9FF" Stroke="#6B4A2B" StrokeThickness="2"/>

    <!-- clouds with transparency -->
    <Ellipse Canvas.Left="246" Canvas.Top="64" Width="68" Height="32" Fill="White" Opacity="0.9"/>
    <Ellipse Canvas.Left="279" Canvas.Top="77" Width="52" Height="26" Fill="White" Opacity="0.9"/>

</Canvas>`, lang: "xml", title: "The same scene in AXAML, 1:1" },
  { list: [
    "Position with attached properties: `Canvas.Left` / `Canvas.Top` (also `Canvas.Right` / `Canvas.Bottom`).",
    "**Z-order = document order**: later children draw on top. Override with `ZIndex=\"5\"`.",
    "Unpositioned children land at 0,0. The Canvas does NOT clip by default (`ClipToBounds=\"True\"` if you need it).",
    "Dynamic version: generate shapes from a ViewModel with the [[av-itemscontrols|ItemsControl-on-Canvas]] pattern.",
  ]},
]},

{
id: "dg-bundle",
title: "Bundle: complete demo window (tabs + form + shapes + list)",
cat: "Design Gallery",
tags: ["bundle", "complete window", "template", "all in one", "demo app", "starting point"],
related: ["dg-workflow", "dg-tabs", "dg-form-recipe", "dg-shapes"],
blocks: [
  { p: "One ready-to-paste MainWindow that wires together a menu, three tabs (form, shapes, list), and a status bar. Use it as a skeleton and delete what you don't need." },
  { preview: '<div style="border:1px solid #bbb;border-radius:8px;overflow:hidden;width:460px;font-size:11px;background:#fff">' +
    '<div style="background:#f6f6f6;border-bottom:1px solid #e0e0e0;padding:5px 10px;color:#444">File &nbsp;&nbsp; Edit &nbsp;&nbsp; Help</div>' +
    '<div style="display:flex;gap:2px;padding:6px 8px 0;background:#fff">' +
    '<div style="padding:6px 14px;font-weight:600;border-bottom:3px solid #0078d4">Form</div>' +
    '<div style="padding:6px 14px;color:#666">Shapes</div>' +
    '<div style="padding:6px 14px;color:#666">List</div></div>' +
    '<div style="border-top:1px solid #eee;padding:12px;display:flex;gap:14px">' +
    '<div style="flex:1"><div style="color:#555;margin-bottom:3px">Name</div><input readonly style="width:100%;border:1px solid #ababab;border-radius:4px;padding:4px 8px;font-size:11px;margin-bottom:8px"><div style="color:#555;margin-bottom:3px">Type</div><div style="border:1px solid #ababab;border-radius:4px;padding:4px 8px;display:flex;justify-content:space-between"><span>Standard</span><span>▾</span></div></div>' +
    '<div style="display:flex;align-items:flex-end"><span style="background:#0078d4;color:#fff;border-radius:4px;padding:5px 16px">Add</span></div></div>' +
    '<div style="background:#f6f6f6;border-top:1px solid #e0e0e0;padding:4px 10px;color:#666">Ready · 3 items</div></div>', title: "The assembled shell" },
  { code: String.raw`<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="using:DemoApp.ViewModels"
        x:Class="DemoApp.Views.MainWindow"
        x:DataType="vm:MainWindowViewModel"
        Title="Demo" Width="800" Height="550">

    <DockPanel>

        <!-- ===== top menu ===== -->
        <Menu DockPanel.Dock="Top">
            <MenuItem Header="File">
                <MenuItem Header="Save" Command="{Binding SaveCommand}"/>
                <MenuItem Header="Load" Command="{Binding LoadCommand}"/>
            </MenuItem>
            <MenuItem Header="Edit"/>
            <MenuItem Header="Help"/>
        </Menu>

        <!-- ===== bottom status bar ===== -->
        <Border DockPanel.Dock="Bottom" Background="#F6F6F6" Padding="10,4">
            <TextBlock Text="{Binding StatusText}" Foreground="#666666" FontSize="12"/>
        </Border>

        <!-- ===== tabs fill the rest ===== -->
        <TabControl>

            <TabItem Header="Form">
                <Grid ColumnDefinitions="*,Auto" Margin="12">
                    <StackPanel Grid.Column="0" Spacing="6" MaxWidth="320"
                                HorizontalAlignment="Left">
                        <TextBlock Text="Name" FontSize="12" Foreground="#555555"/>
                        <TextBox Text="{Binding NewName}" Watermark="Enter a name..."/>
                        <TextBlock Text="Type" FontSize="12" Foreground="#555555"/>
                        <ComboBox ItemsSource="{Binding TypeOptions}"
                                  SelectedItem="{Binding SelectedType}"/>
                        <CheckBox Content="Active" IsChecked="{Binding IsActive}"/>
                    </StackPanel>
                    <Button Grid.Column="1" Content="Add" Classes="accent"
                            VerticalAlignment="Bottom"
                            Command="{Binding AddItemCommand}"/>
                </Grid>
            </TabItem>

            <TabItem Header="Shapes">
                <Canvas Background="#FAFAFA">
                    <Rectangle Canvas.Left="30" Canvas.Top="30" Width="120" Height="70"
                               Fill="#3498DB" RadiusX="8" RadiusY="8"/>
                    <Ellipse Canvas.Left="190" Canvas.Top="40" Width="80" Height="80"
                             Fill="#2ECC71"/>
                    <Polygon Points="350,110 400,30 450,110" Fill="#E67E22"/>
                    <Line StartPoint="30,160" EndPoint="450,160"
                          Stroke="#E74C3C" StrokeThickness="3" StrokeDashArray="6,3"/>
                </Canvas>
            </TabItem>

            <TabItem Header="List">
                <Grid RowDefinitions="*,Auto" Margin="12">
                    <ListBox Grid.Row="0" ItemsSource="{Binding Items}"
                             SelectedItem="{Binding SelectedItem}"/>
                    <StackPanel Grid.Row="1" Orientation="Horizontal" Spacing="8"
                                Margin="0,10,0,0">
                        <Button Content="Delete" Command="{Binding DeleteItemCommand}"/>
                        <TextBlock Text="{Binding SelectedItem}" VerticalAlignment="Center"
                                   Foreground="#0078D4"/>
                    </StackPanel>
                </Grid>
            </TabItem>

        </TabControl>
    </DockPanel>
</Window>`, lang: "xml", title: "MainWindow.axaml — the whole shell" },
  { code: String.raw`using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace DemoApp.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    public ObservableCollection<string> Items { get; } = new() { "Alpha", "Beta", "Gamma" };
    public ObservableCollection<string> TypeOptions { get; } = new() { "Standard", "Premium" };

    [ObservableProperty] private string? newName;
    [ObservableProperty] private string? selectedType = "Standard";
    [ObservableProperty] private bool isActive = true;
    [ObservableProperty] private string? selectedItem;
    [ObservableProperty] private string statusText = "Ready · 3 items";

    [RelayCommand]
    private void AddItem()
    {
        if (string.IsNullOrWhiteSpace(NewName)) return;
        Items.Add(NewName!);
        NewName = null;
        StatusText = $"Ready · {Items.Count} items";
    }

    [RelayCommand]
    private void DeleteItem()
    {
        if (SelectedItem is not null) Items.Remove(SelectedItem);
        StatusText = $"Ready · {Items.Count} items";
    }

    [RelayCommand] private void Save() { /* JSON save here */ }
    [RelayCommand] private void Load() { /* JSON load here */ }
}`, lang: "csharp", title: "Matching ViewModel — drop in and it runs" },
]}

);
