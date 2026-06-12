/* projzip-core.js — pure-JS ZIP writer + .NET project scaffolds (spec 13, Agent Z).
 *
 * 100% offline, no deps, no ES modules, file:// safe, Node-loadable.
 *   - makeZip(entries) -> Uint8Array     (STORE method, CRC-32, local + central + EOCD)
 *   - makeZipBlobUrl(entries) -> objURL   (browser only; never touches Blob at load time)
 *   - avaloniaProject / xunitProject / consoleProject -> entries[] for a runnable project
 *
 * Every scaffold is calibrated against the LOCAL ground truth:
 *   "AOP Exam Starter Kit\ExamApp\*", "...\ExamApp.Tests\*",
 *   and the Summer2025 Problem_4_LINQ console (Spaceships). Package versions are
 *   the exact ones from those csproj files.
 */
(function (global) {
  "use strict";

  /* ============================================================
   * 1. CRC-32 (standard IEEE 802.3 polynomial 0xEDB88320, reflected)
   * ============================================================ */
  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  /* crc32 over a Uint8Array, returns an unsigned 32-bit number */
  function crc32(bytes) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /* ============================================================
   * 2. UTF-8 encoding (no TextEncoder dependency, file:// + old-Node safe)
   * ============================================================ */
  function utf8Bytes(str) {
    str = String(str == null ? "" : str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) {
        out.push(code);
      } else if (code < 0x800) {
        out.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
      } else if (code >= 0xD800 && code <= 0xDBFF) {
        // high surrogate: combine with the following low surrogate
        var hi = code;
        var lo = str.charCodeAt(i + 1);
        if (lo >= 0xDC00 && lo <= 0xDFFF) {
          i++;
          var cp = 0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00);
          out.push(
            0xF0 | (cp >> 18),
            0x80 | ((cp >> 12) & 0x3F),
            0x80 | ((cp >> 6) & 0x3F),
            0x80 | (cp & 0x3F)
          );
        } else {
          // lone high surrogate -> replacement char
          out.push(0xEF, 0xBF, 0xBD);
        }
      } else if (code >= 0xDC00 && code <= 0xDFFF) {
        // lone low surrogate -> replacement char
        out.push(0xEF, 0xBF, 0xBD);
      } else {
        out.push(
          0xE0 | (code >> 12),
          0x80 | ((code >> 6) & 0x3F),
          0x80 | (code & 0x3F)
        );
      }
    }
    return new Uint8Array(out);
  }

  /* ============================================================
   * 3. ZIP writer (STORE / method 0, no compression)
   *    Layout: [local header + data] per entry, then central directory, then EOCD.
   * ============================================================ */

  /* a tiny growable byte sink with little-endian writers */
  function ByteSink() {
    this.parts = [];
    this.length = 0;
  }
  ByteSink.prototype.u8 = function (arr) {
    this.parts.push(arr);
    this.length += arr.length;
  };
  ByteSink.prototype.u16 = function (v) {
    this.u8(new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF]));
  };
  ByteSink.prototype.u32 = function (v) {
    this.u8(new Uint8Array([
      v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF
    ]));
  };
  ByteSink.prototype.toUint8Array = function () {
    var out = new Uint8Array(this.length);
    var off = 0;
    for (var i = 0; i < this.parts.length; i++) {
      out.set(this.parts[i], off);
      off += this.parts[i].length;
    }
    return out;
  };

  /* normalize a path: forward slashes only, no leading slash, collapse "\\" */
  function normPath(p) {
    return String(p == null ? "" : p).replace(/\\/g, "/").replace(/^\/+/, "");
  }

  /* DOS time/date constant (a fixed valid value: 2020-01-01 00:00:00).
   * Using a constant keeps zips byte-stable across runs; Expand-Archive is happy. */
  var DOS_TIME = 0;                       // 00:00:00
  var DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;  // 2020-01-01

  /* makeZip(entries) -> Uint8Array.  entries = [{path, text}] (UTF-8 text). */
  function makeZip(entries) {
    if (!entries || !entries.length) {
      throw new Error("makeZip: at least one entry required");
    }
    var sink = new ByteSink();
    var records = [];   // central-directory bookkeeping per entry

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var nameBytes = utf8Bytes(normPath(e.path));
      var dataBytes = utf8Bytes(e.text == null ? "" : e.text);
      var crc = crc32(dataBytes);
      var localOffset = sink.length;

      // ---- local file header (PK\x03\x04) ----
      sink.u32(0x04034b50);     // signature
      sink.u16(20);             // version needed to extract (2.0)
      sink.u16(0x0800);         // general purpose flag: bit 11 = UTF-8 names
      sink.u16(0);              // compression method: 0 = STORE
      sink.u16(DOS_TIME);
      sink.u16(DOS_DATE);
      sink.u32(crc);            // CRC-32
      sink.u32(dataBytes.length); // compressed size (== uncompressed for STORE)
      sink.u32(dataBytes.length); // uncompressed size
      sink.u16(nameBytes.length); // file name length
      sink.u16(0);              // extra field length
      sink.u8(nameBytes);       // file name
      sink.u8(dataBytes);       // file data (stored verbatim)

      records.push({
        nameBytes: nameBytes,
        crc: crc,
        size: dataBytes.length,
        offset: localOffset
      });
    }

    // ---- central directory ----
    var centralStart = sink.length;
    for (var j = 0; j < records.length; j++) {
      var r = records[j];
      sink.u32(0x02014b50);     // central file header signature (PK\x01\x02)
      sink.u16(20);             // version made by
      sink.u16(20);             // version needed to extract
      sink.u16(0x0800);         // general purpose flag: UTF-8
      sink.u16(0);              // compression method: STORE
      sink.u16(DOS_TIME);
      sink.u16(DOS_DATE);
      sink.u32(r.crc);
      sink.u32(r.size);         // compressed size
      sink.u32(r.size);         // uncompressed size
      sink.u16(r.nameBytes.length);
      sink.u16(0);              // extra field length
      sink.u16(0);              // file comment length
      sink.u16(0);              // disk number start
      sink.u16(0);              // internal file attributes
      sink.u32(0);              // external file attributes
      sink.u32(r.offset);       // relative offset of local header
      sink.u8(r.nameBytes);
    }
    var centralSize = sink.length - centralStart;

    // ---- end of central directory record (PK\x05\x06) ----
    sink.u32(0x06054b50);
    sink.u16(0);                // number of this disk
    sink.u16(0);                // disk with start of central directory
    sink.u16(records.length);   // entries on this disk
    sink.u16(records.length);   // total entries
    sink.u32(centralSize);      // size of central directory
    sink.u32(centralStart);     // offset of central directory
    sink.u16(0);                // comment length

    return sink.toUint8Array();
  }

  /* makeZipBlobUrl(entries) -> object URL (browser only).
   * Guarded so that merely loading this file in Node never references Blob. */
  function makeZipBlobUrl(entries) {
    if (typeof Blob === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) {
      throw new Error("makeZipBlobUrl requires a browser (Blob/URL) environment");
    }
    var bytes = makeZip(entries);
    var blob = new Blob([bytes], { type: "application/zip" });
    return URL.createObjectURL(blob);
  }

  /* ============================================================
   * 4. Helpers shared by the scaffolds
   * ============================================================ */

  /* exact package versions read from the local Starter Kit csproj files */
  var PKG = {
    avalonia: "11.2.1",
    communityToolkitMvvm: "8.2.1",
    coverlet: "6.0.4",
    testSdk: "17.14.1",
    xunit: "2.9.3",
    xunitRunner: "3.1.4",
    avaloniaHeadlessXunit: "11.2.1"
  };

  /* sanitize an arbitrary string into a legal C#/MSBuild root namespace + assembly
   * name: keep letters/digits/dots/underscores, collapse the rest to underscores,
   * never start with a digit, never empty. ("My App!" -> "My_App") */
  function sanitizeName(raw, fallback) {
    var s = String(raw == null ? "" : raw).trim();
    // turn path separators and spaces into underscores, drop other junk
    s = s.replace(/[\\/]+/g, "_").replace(/[^A-Za-z0-9_.]+/g, "_");
    // collapse repeats, trim edge separators
    s = s.replace(/_+/g, "_").replace(/\.+/g, ".").replace(/^[._]+|[._]+$/g, "");
    // nothing legal left -> use the fallback before per-segment fixups
    if (!s) return fallback || "ExamProject";
    // each dot-segment must start with a letter or underscore
    s = s.split(".").map(function (seg) {
      if (seg === "") return "_";
      if (/^[0-9]/.test(seg)) return "_" + seg;
      return seg;
    }).join(".");
    return s;
  }

  /* rewrite designer-emitted ExamApp.* namespaces/x:Class to <name>.* .
   * The designer always emits the literal token "ExamApp" as the root namespace,
   * so a word-boundary replace is reliable and won't touch unrelated text. */
  function rewriteNamespace(text, name) {
    if (text == null) return text;
    // \bExamApp\b but NOT "ExamApp.Tests" handled by caller; here root only.
    return String(text).replace(/\bExamApp\b/g, name);
  }

  /* derive a relative file path for a model class from its `path` or class name */
  function modelFileName(m, idx) {
    if (m && m.path) return normPath(m.path);
    if (m && m.name) return "Models/" + m.name + ".cs";
    return "Models/Model" + (idx + 1) + ".cs";
  }

  /* ============================================================
   * 5a. avaloniaProject(name, {axaml, viewModel, models[], extraFiles[]})
   *     -> entries for a complete, buildable Avalonia 11.2.1 app.
   *     Mirrors the Starter Kit ExamApp exactly, with namespaces rewritten.
   * ============================================================ */
  function avaloniaProject(name, opts) {
    opts = opts || {};
    name = sanitizeName(name, "ExamApp");
    var entries = [];

    /* ---- <name>.csproj (Starter Kit ExamApp.csproj, no InternalsVisibleTo so the
            app builds standalone without a Tests project to reference) ---- */
    entries.push({
      path: name + ".csproj",
      text:
'<Project Sdk="Microsoft.NET.Sdk">\n' +
'  <PropertyGroup>\n' +
'    <OutputType>WinExe</OutputType>\n' +
'    <TargetFramework>net9.0</TargetFramework>\n' +
'    <Nullable>enable</Nullable>\n' +
'    <ImplicitUsings>enable</ImplicitUsings>\n' +
'    <AvaloniaUseCompiledBindingsByDefault>true</AvaloniaUseCompiledBindingsByDefault>\n' +
'  </PropertyGroup>\n' +
'\n' +
'  <ItemGroup>\n' +
'    <PackageReference Include="Avalonia" Version="' + PKG.avalonia + '" />\n' +
'    <PackageReference Include="Avalonia.Desktop" Version="' + PKG.avalonia + '" />\n' +
'    <PackageReference Include="Avalonia.Themes.Fluent" Version="' + PKG.avalonia + '" />\n' +
'    <PackageReference Include="Avalonia.Fonts.Inter" Version="' + PKG.avalonia + '" />\n' +
'    <PackageReference Condition="\'$(Configuration)\' == \'Debug\'" Include="Avalonia.Diagnostics" Version="' + PKG.avalonia + '" />\n' +
'    <PackageReference Include="CommunityToolkit.Mvvm" Version="' + PKG.communityToolkitMvvm + '" />\n' +
'  </ItemGroup>\n' +
'</Project>\n'
    });

    /* ---- Program.cs ---- */
    entries.push({
      path: "Program.cs",
      text:
'using Avalonia;\n' +
'using System;\n' +
'\n' +
'namespace ' + name + ';\n' +
'\n' +
'class Program\n' +
'{\n' +
'    // Initialization code. Don\'t use any Avalonia, third-party APIs or any\n' +
'    // SynchronizationContext-reliant code before AppMain is called.\n' +
'    [STAThread]\n' +
'    public static void Main(string[] args) => BuildAvaloniaApp()\n' +
'        .StartWithClassicDesktopLifetime(args);\n' +
'\n' +
'    // Avalonia configuration, don\'t remove; also used by visual designer.\n' +
'    public static AppBuilder BuildAvaloniaApp()\n' +
'        => AppBuilder.Configure<App>()\n' +
'            .UsePlatformDetect()\n' +
'            .WithInterFont()\n' +
'            .LogToTrace();\n' +
'}\n'
    });

    /* ---- App.axaml ---- */
    entries.push({
      path: "App.axaml",
      text:
'<Application xmlns="https://github.com/avaloniaui"\n' +
'             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n' +
'             xmlns:local="using:' + name + '"\n' +
'             x:Class="' + name + '.App"\n' +
'             RequestedThemeVariant="Light">\n' +
'\n' +
'    <Application.DataTemplates>\n' +
'        <local:ViewLocator/>\n' +
'    </Application.DataTemplates>\n' +
'\n' +
'    <Application.Styles>\n' +
'        <FluentTheme />\n' +
'    </Application.Styles>\n' +
'</Application>\n'
    });

    /* ---- App.axaml.cs (DataContext wiring like the Starter Kit) ---- */
    entries.push({
      path: "App.axaml.cs",
      text:
'using Avalonia;\n' +
'using Avalonia.Controls.ApplicationLifetimes;\n' +
'using Avalonia.Data.Core.Plugins;\n' +
'using Avalonia.Markup.Xaml;\n' +
'using ' + name + '.ViewModels;\n' +
'using ' + name + '.Views;\n' +
'using System.Linq;\n' +
'\n' +
'namespace ' + name + ';\n' +
'\n' +
'public partial class App : Application\n' +
'{\n' +
'    public override void Initialize()\n' +
'    {\n' +
'        AvaloniaXamlLoader.Load(this);\n' +
'    }\n' +
'\n' +
'    public override void OnFrameworkInitializationCompleted()\n' +
'    {\n' +
'        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)\n' +
'        {\n' +
'            // Avoid duplicate validations from both Avalonia and the CommunityToolkit.\n' +
'            DisableAvaloniaDataAnnotationValidation();\n' +
'\n' +
'            desktop.MainWindow = new MainWindow\n' +
'            {\n' +
'                DataContext = new MainWindowViewModel(),\n' +
'            };\n' +
'        }\n' +
'\n' +
'        base.OnFrameworkInitializationCompleted();\n' +
'    }\n' +
'\n' +
'    private void DisableAvaloniaDataAnnotationValidation()\n' +
'    {\n' +
'        var dataValidationPluginsToRemove =\n' +
'            BindingPlugins.DataValidators.OfType<DataAnnotationsValidationPlugin>().ToArray();\n' +
'\n' +
'        foreach (var plugin in dataValidationPluginsToRemove)\n' +
'        {\n' +
'            BindingPlugins.DataValidators.Remove(plugin);\n' +
'        }\n' +
'    }\n' +
'}\n'
    });

    /* ---- ViewLocator.cs (FooViewModel -> FooView convention) ---- */
    entries.push({
      path: "ViewLocator.cs",
      text:
'using Avalonia.Controls;\n' +
'using Avalonia.Controls.Templates;\n' +
'using ' + name + '.ViewModels;\n' +
'using System;\n' +
'\n' +
'namespace ' + name + ';\n' +
'\n' +
'public class ViewLocator : IDataTemplate\n' +
'{\n' +
'    public Control? Build(object? param)\n' +
'    {\n' +
'        if (param is null)\n' +
'            return null;\n' +
'\n' +
'        var name = param.GetType().FullName!.Replace("ViewModel", "View", StringComparison.Ordinal);\n' +
'        var type = Type.GetType(name);\n' +
'\n' +
'        if (type != null)\n' +
'        {\n' +
'            return (Control)Activator.CreateInstance(type)!;\n' +
'        }\n' +
'\n' +
'        return new TextBlock { Text = "Not Found: " + name };\n' +
'    }\n' +
'\n' +
'    public bool Match(object? data)\n' +
'    {\n' +
'        return data is ViewModelBase;\n' +
'    }\n' +
'}\n'
    });

    /* ---- ViewModels/ViewModelBase.cs ---- */
    entries.push({
      path: "ViewModels/ViewModelBase.cs",
      text:
'using CommunityToolkit.Mvvm.ComponentModel;\n' +
'\n' +
'namespace ' + name + '.ViewModels;\n' +
'\n' +
'public abstract class ViewModelBase : ObservableObject\n' +
'{\n' +
'}\n'
    });

    /* ---- Views/MainWindow.axaml (from the designer AXAML, namespace rewritten) ---- */
    var axaml = opts.axaml != null ? rewriteNamespace(opts.axaml, name) : defaultMainWindowAxaml(name);
    // a designer AXAML already carries the full <Window ...> shell; if a caller
    // passes only a fragment, wrap it. Detect by the <Window root tag, skipping
    // any leading XML comment banner so a commented complete Window is not
    // double-wrapped into a Window inside a Window.
    if (!/^\s*(?:<!--[\s\S]*?-->\s*)*<Window[\s>]/.test(axaml)) {
      axaml = wrapInMainWindow(axaml, name, opts);
    }
    entries.push({ path: "Views/MainWindow.axaml", text: ensureTrailingNewline(axaml) });

    /* ---- Views/MainWindow.axaml.cs (only InitializeComponent) ---- */
    entries.push({
      path: "Views/MainWindow.axaml.cs",
      text:
'using Avalonia.Controls;\n' +
'\n' +
'namespace ' + name + '.Views;\n' +
'\n' +
'public partial class MainWindow : Window\n' +
'{\n' +
'    public MainWindow()\n' +
'    {\n' +
'        InitializeComponent();\n' +
'    }\n' +
'}\n'
    });

    /* ---- ViewModels/MainWindowViewModel.cs (from the designer VM, ns rewritten) ---- */
    var vm = opts.viewModel != null ? rewriteNamespace(opts.viewModel, name) : defaultMainWindowViewModel(name);
    entries.push({ path: "ViewModels/MainWindowViewModel.cs", text: ensureTrailingNewline(vm) });

    /* ---- Models/*.cs (each typed model; namespaces rewritten) ---- */
    var models = opts.models || [];
    for (var i = 0; i < models.length; i++) {
      var m = models[i];
      // model may be {path, text} or {name, text} or a bare string of code
      var mPath, mText;
      if (typeof m === "string") {
        mPath = "Models/Model" + (i + 1) + ".cs";
        mText = m;
      } else {
        mPath = modelFileName(m, i);
        mText = m.text != null ? m.text : (m.code != null ? m.code : "");
      }
      entries.push({ path: mPath, text: ensureTrailingNewline(rewriteNamespace(mText, name)) });
    }

    /* ---- extra files (verbatim, but still namespace-rewritten if C#/AXAML) ---- */
    appendExtraFiles(entries, opts.extraFiles, name);

    return entries;
  }

  function defaultMainWindowAxaml(name) {
    return (
'<Window xmlns="https://github.com/avaloniaui"\n' +
'        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n' +
'        xmlns:vm="using:' + name + '.ViewModels"\n' +
'        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"\n' +
'        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"\n' +
'        mc:Ignorable="d" d:DesignWidth="500" d:DesignHeight="400"\n' +
'        x:Class="' + name + '.Views.MainWindow"\n' +
'        x:DataType="vm:MainWindowViewModel"\n' +
'        Title="' + name + '"\n' +
'        Width="500" Height="420"\n' +
'        WindowStartupLocation="CenterScreen">\n' +
'\n' +
'    <Design.DataContext>\n' +
'        <vm:MainWindowViewModel/>\n' +
'    </Design.DataContext>\n' +
'\n' +
'    <TextBlock Text="Replace me with the exam UI" Margin="14"/>\n' +
'</Window>\n'
    );
  }

  /* wrap a bare AXAML fragment (e.g. async composer snippet) in a full MainWindow */
  function wrapInMainWindow(fragment, name, opts) {
    var title = (opts && opts.title) ? opts.title : name;
    var indented = String(fragment).split("\n").map(function (l) {
      return l ? "    " + l : l;
    }).join("\n");
    return (
'<Window xmlns="https://github.com/avaloniaui"\n' +
'        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n' +
'        xmlns:vm="using:' + name + '.ViewModels"\n' +
'        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"\n' +
'        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"\n' +
'        mc:Ignorable="d" d:DesignWidth="500" d:DesignHeight="400"\n' +
'        x:Class="' + name + '.Views.MainWindow"\n' +
'        x:DataType="vm:MainWindowViewModel"\n' +
'        Title="' + xmlEsc(title) + '"\n' +
'        Width="500" Height="420"\n' +
'        WindowStartupLocation="CenterScreen">\n' +
'\n' +
'    <Design.DataContext>\n' +
'        <vm:MainWindowViewModel/>\n' +
'    </Design.DataContext>\n' +
'\n' +
indented + '\n' +
'</Window>\n'
    );
  }

  function defaultMainWindowViewModel(name) {
    return (
'using System.Collections.ObjectModel;\n' +
'using CommunityToolkit.Mvvm.ComponentModel;\n' +
'using CommunityToolkit.Mvvm.Input;\n' +
'\n' +
'namespace ' + name + '.ViewModels;\n' +
'\n' +
'public partial class MainWindowViewModel : ViewModelBase\n' +
'{\n' +
'    public ObservableCollection<string> Items { get; } = new();\n' +
'\n' +
'    [ObservableProperty]\n' +
'    [NotifyCanExecuteChangedFor(nameof(AddItemCommand))]\n' +
'    private string? newItem;\n' +
'\n' +
'    [ObservableProperty]\n' +
'    private string? selectedItem;\n' +
'\n' +
'    [ObservableProperty]\n' +
'    private string statusText = "0 items";\n' +
'\n' +
'    [RelayCommand(CanExecute = nameof(CanAddItem))]\n' +
'    private void AddItem()\n' +
'    {\n' +
'        Items.Add(NewItem!);\n' +
'        NewItem = null;\n' +
'        StatusText = $"{Items.Count} items";\n' +
'    }\n' +
'\n' +
'    private bool CanAddItem() => !string.IsNullOrWhiteSpace(NewItem);\n' +
'\n' +
'    [RelayCommand]\n' +
'    private void DeleteItem()\n' +
'    {\n' +
'        if (SelectedItem is not null)\n' +
'        {\n' +
'            Items.Remove(SelectedItem);\n' +
'            StatusText = $"{Items.Count} items";\n' +
'        }\n' +
'    }\n' +
'}\n'
    );
  }

  /* ============================================================
   * 5b. xunitProject(name, {sourceFiles[], testFiles[], headless})
   *     -> standalone test project (source under test is COPIED in, so no
   *        ProjectReference is needed and it compiles on its own).
   * ============================================================ */
  function xunitProject(name, opts) {
    opts = opts || {};
    name = sanitizeName(name, "ExamApp.Tests");
    var headless = !!opts.headless;
    var entries = [];

    /* ---- csproj: xunit + Microsoft.NET.Test.Sdk + runner (+ headless when asked).
            No ProjectReference: the code under test lives in Source/ . When headless
            we also need Avalonia itself so the headless harness can spin a window. */
    var pkgs = [];
    pkgs.push('    <PackageReference Include="coverlet.collector" Version="' + PKG.coverlet + '" />');
    pkgs.push('    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="' + PKG.testSdk + '" />');
    pkgs.push('    <PackageReference Include="xunit" Version="' + PKG.xunit + '" />');
    pkgs.push('    <PackageReference Include="xunit.runner.visualstudio" Version="' + PKG.xunitRunner + '" />');
    if (headless) {
      // headless needs the Avalonia app stack PLUS the headless xUnit adapter,
      // and CommunityToolkit because the typical ViewModel under test uses it.
      pkgs.push('    <PackageReference Include="Avalonia" Version="' + PKG.avalonia + '" />');
      pkgs.push('    <PackageReference Include="Avalonia.Desktop" Version="' + PKG.avalonia + '" />');
      pkgs.push('    <PackageReference Include="Avalonia.Themes.Fluent" Version="' + PKG.avalonia + '" />');
      pkgs.push('    <PackageReference Include="Avalonia.Fonts.Inter" Version="' + PKG.avalonia + '" />');
      pkgs.push('    <PackageReference Include="Avalonia.Headless.XUnit" Version="' + PKG.avaloniaHeadlessXunit + '" />');
      pkgs.push('    <PackageReference Include="CommunityToolkit.Mvvm" Version="' + PKG.communityToolkitMvvm + '" />');
    } else {
      // plain VM/class tests still commonly use the CommunityToolkit attributes.
      pkgs.push('    <PackageReference Include="CommunityToolkit.Mvvm" Version="' + PKG.communityToolkitMvvm + '" />');
    }

    entries.push({
      path: name + ".csproj",
      text:
'<Project Sdk="Microsoft.NET.Sdk">\n' +
'  <PropertyGroup>\n' +
'    <TargetFramework>net9.0</TargetFramework>\n' +
'    <Nullable>enable</Nullable>\n' +
'    <ImplicitUsings>enable</ImplicitUsings>\n' +
'    <IsPackable>false</IsPackable>\n' +
(headless ? '    <AvaloniaUseCompiledBindingsByDefault>true</AvaloniaUseCompiledBindingsByDefault>\n' : '') +
'  </PropertyGroup>\n' +
'\n' +
'  <ItemGroup>\n' +
pkgs.join('\n') + '\n' +
'  </ItemGroup>\n' +
'\n' +
'  <ItemGroup>\n' +
'    <Using Include="Xunit" />\n' +
'  </ItemGroup>\n' +
'</Project>\n'
    });

    /* ---- Source/ copies of the pasted code under test ---- */
    var src = opts.sourceFiles || [];
    for (var i = 0; i < src.length; i++) {
      var s = src[i];
      var sPath, sText;
      if (typeof s === "string") {
        sPath = "Source/Source" + (i + 1) + ".cs";
        sText = s;
      } else {
        sPath = s.path ? ("Source/" + baseName(s.path)) : ("Source/" + (s.name || ("Source" + (i + 1))) + ".cs");
        sText = s.text != null ? s.text : (s.code != null ? s.code : "");
      }
      entries.push({ path: sPath, text: ensureTrailingNewline(sText) });
    }

    /* ---- Tests/ generated tests ---- */
    var tests = opts.testFiles || [];
    for (var j = 0; j < tests.length; j++) {
      var t = tests[j];
      var tPath, tText;
      if (typeof t === "string") {
        tPath = "Tests/Tests" + (j + 1) + ".cs";
        tText = t;
      } else {
        tPath = t.path ? ("Tests/" + baseName(t.path)) : ("Tests/" + (t.name || ("Tests" + (j + 1))) + ".cs");
        tText = t.text != null ? t.text : (t.code != null ? t.code : "");
      }
      entries.push({ path: tPath, text: ensureTrailingNewline(tText) });
    }

    /* ---- TestAppBuilder.cs when headless (configures the headless platform).
            It configures Avalonia.Application directly so the test project needs
            no separate app project. ---- */
    if (headless) {
      entries.push({
        path: "TestAppBuilder.cs",
        text:
'using Avalonia;\n' +
'using Avalonia.Headless;\n' +
'\n' +
'[assembly: AvaloniaTestApplication(typeof(TestAppBuilder))]\n' +
'\n' +
'public class TestAppBuilder\n' +
'{\n' +
'    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<Application>()\n' +
'        .UseHeadless(new AvaloniaHeadlessPlatformOptions());\n' +
'}\n'
      });
    }

    appendExtraFiles(entries, opts.extraFiles, null);
    return entries;
  }

  /* ============================================================
   * 5c. consoleProject(name, {programCs, dataFiles[]})
   *     -> net9.0 console app: csproj, Program.cs, data .json files copied
   *        to the output directory (PreserveNewest), like the Spaceships csproj.
   * ============================================================ */
  function consoleProject(name, opts) {
    opts = opts || {};
    name = sanitizeName(name, "ConsoleApp");
    var entries = [];
    var data = opts.dataFiles || [];

    /* ---- csproj: each data file gets a <None Update .../> with CopyToOutputDirectory.
            We use <None Update> (the file lives in the project dir) which matches the
            Starter Kit ExamConsole.csproj pattern exactly. ---- */
    var noneItems = [];
    for (var i = 0; i < data.length; i++) {
      var fname = baseName(typeof data[i] === "string" ? ("data" + (i + 1) + ".json") : (data[i].path || data[i].name || ("data" + (i + 1) + ".json")));
      noneItems.push(
'    <None Update="' + fname + '">\n' +
'      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>\n' +
'    </None>'
      );
    }
    var noneGroup = noneItems.length
      ? ('\n  <ItemGroup>\n' + noneItems.join('\n') + '\n  </ItemGroup>\n')
      : '';

    entries.push({
      path: name + ".csproj",
      text:
'<Project Sdk="Microsoft.NET.Sdk">\n' +
'  <PropertyGroup>\n' +
'    <OutputType>Exe</OutputType>\n' +
'    <TargetFramework>net9.0</TargetFramework>\n' +
'    <Nullable>enable</Nullable>\n' +
'    <ImplicitUsings>enable</ImplicitUsings>\n' +
'  </PropertyGroup>\n' +
noneGroup +
'</Project>\n'
    });

    /* ---- Program.cs ---- */
    entries.push({
      path: "Program.cs",
      text: ensureTrailingNewline(opts.programCs != null ? opts.programCs : defaultConsoleProgram())
    });

    /* ---- data .json files (verbatim text) ---- */
    for (var j = 0; j < data.length; j++) {
      var d = data[j];
      var dPath, dText;
      if (typeof d === "string") {
        dPath = "data" + (j + 1) + ".json";
        dText = d;
      } else {
        dPath = baseName(d.path || d.name || ("data" + (j + 1) + ".json"));
        dText = d.text != null ? d.text : "";
      }
      entries.push({ path: dPath, text: ensureTrailingNewline(dText) });
    }

    appendExtraFiles(entries, opts.extraFiles, null);
    return entries;
  }

  function defaultConsoleProgram() {
    return (
'Console.WriteLine("Hello from the exam console scaffold.");\n'
    );
  }

  /* ============================================================
   * 6. small shared utilities
   * ============================================================ */
  function baseName(p) {
    return normPath(p).split("/").pop();
  }
  function ensureTrailingNewline(text) {
    text = text == null ? "" : String(text);
    return text.charAt(text.length - 1) === "\n" ? text : text + "\n";
  }
  function xmlEsc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  /* extra files: {path, text} kept verbatim. C#/AXAML get namespace-rewritten when
     a project name is provided (Avalonia case); data files etc. pass through. */
  function appendExtraFiles(entries, extra, name) {
    if (!extra) return;
    for (var i = 0; i < extra.length; i++) {
      var f = extra[i];
      if (!f || !f.path) continue;
      var text = f.text != null ? f.text : (f.code != null ? f.code : "");
      if (name && /\.(cs|axaml)$/i.test(f.path)) text = rewriteNamespace(text, name);
      entries.push({ path: normPath(f.path), text: ensureTrailingNewline(text) });
    }
  }

  /* ============================================================
   * 7. exports (Node-guarded; browser gets window.PROJZIP)
   * ============================================================ */
  var CORE = {
    /* zip */
    crc32: crc32,
    utf8Bytes: utf8Bytes,
    makeZip: makeZip,
    makeZipBlobUrl: makeZipBlobUrl,
    /* scaffolds */
    avaloniaProject: avaloniaProject,
    xunitProject: xunitProject,
    consoleProject: consoleProject,
    /* helpers exposed for the UI + tests */
    sanitizeName: sanitizeName,
    rewriteNamespace: rewriteNamespace,
    PKG: PKG
  };

  global.PROJZIP = CORE;
  if (typeof module !== "undefined" && module.exports) module.exports = CORE;
})(typeof window !== "undefined" ? window : globalThis);
