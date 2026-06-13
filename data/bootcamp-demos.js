/* bootcamp-demos.js — runnable example registry for the 3-Day Bootcamp.
 *
 * Goal: the bootcamp lessons should be self-contained. Instead of "open another
 * tab" / "run it from AOP_extracted\...", each lesson embeds a demo with:
 *   - a one-click DOWNLOAD of a complete, runnable project (.zip, via PROJZIP),
 *   - an inline visual PREVIEW of what it looks like when you run it,
 *   - the full SOURCE inline (no tab-hop).
 *
 * 100% offline, no deps, no ES modules, file:// safe, Node-loadable (no DOM at
 * load time; build() is pure and takes window.PROJZIP as its argument).
 *
 * Every project is calibrated against the LOCAL ground truth: the course
 * solutions in AOP_extracted\ and the AOP Exam Starter Kit. The build()
 * functions lean on the tested PROJZIP scaffolds so they stay in lock-step with
 * the exam's exact package versions (net9.0, Avalonia 11.2.1, Toolkit 8.2.1).
 */
(function (global) {
  "use strict";

  /* ============================================================
   * helpers
   * ============================================================ */

  /* prefix every entry's path with dir/ (for bundling several projects) */
  function prefix(entries, dir) {
    return entries.map(function (e) { return { path: dir + e.path, text: e.text }; });
  }

  /* replace (or append) the entry at an exact path */
  function replaceEntry(entries, path, text) {
    var found = false;
    var out = entries.map(function (e) {
      if (e.path === path) { found = true; return { path: path, text: text }; }
      return e;
    });
    if (!found) out.push({ path: path, text: text });
    return out;
  }

  /* a code file shown in the UI; the SAME string is shipped in the .zip, so the
     preview source can never drift from the downloaded source. */
  function file(title, lang, code) { return { title: title, lang: lang, code: code }; }

  /* ============================================================
   * 1. ContactList MVVM (Day 1 lesson) — the flagship CRUD app
   * ============================================================ */
  var CONTACTLIST_CONTACT = String.raw`namespace ContactListMVVM.Models;

public class Contact
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    public override string ToString() => $"{Name} ({Email})";
}`;

  var CONTACTLIST_IREPO = String.raw`using System.Collections.ObjectModel;
using ContactListMVVM.Models;

namespace ContactListMVVM.Services;

public interface IContactRepository
{
    void Save(string filename, ObservableCollection<Contact> data);
    ObservableCollection<Contact> Load(string filename);
}`;

  var CONTACTLIST_JSONREPO = String.raw`using System.Collections.ObjectModel;
using System.IO;
using System.Text.Json;
using ContactListMVVM.Models;

namespace ContactListMVVM.Services;

public class JSONContactRepository : IContactRepository
{
    public void Save(string filename, ObservableCollection<Contact> data)
    {
        File.WriteAllText(filename, JsonSerializer.Serialize(data));
    }

    public ObservableCollection<Contact> Load(string filename)
    {
        if (!File.Exists(filename))
            return new ObservableCollection<Contact>();

        return JsonSerializer.Deserialize<ObservableCollection<Contact>>(
            File.ReadAllText(filename))!;
    }
}`;

  var CONTACTLIST_VM = String.raw`using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using ContactListMVVM.Models;
using ContactListMVVM.Services;

namespace ContactListMVVM.ViewModels;

public partial class MainWindowViewModel : ObservableObject
{
    public ObservableCollection<Contact> Contacts { get; }

    private readonly IContactRepository _contactRepository;

    [ObservableProperty]
    private string? newContactName;

    [ObservableProperty]
    private string? newContactEmail;

    [ObservableProperty]
    private Contact? selectedContact;

    public MainWindowViewModel(IContactRepository contactRepository)
    {
        _contactRepository = contactRepository;
        Contacts = _contactRepository.Load("contacts.json");
    }

    public void AddContact()
    {
        if (string.IsNullOrWhiteSpace(NewContactName) ||
            string.IsNullOrWhiteSpace(NewContactEmail))
            return;

        Contacts.Add(new Contact { Name = NewContactName!, Email = NewContactEmail! });
        NewContactName = NewContactEmail = null;
    }

    public void DeleteContact()
    {
        if (SelectedContact is not null)
            Contacts.Remove(SelectedContact);
    }

    public void SaveData()
    {
        _contactRepository.Save("contacts.json", Contacts);
    }
}`;

  var CONTACTLIST_AXAML = String.raw`<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="using:ContactListMVVM.ViewModels"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        mc:Ignorable="d" d:DesignWidth="800" d:DesignHeight="450"
        x:Class="ContactListMVVM.Views.MainWindow"
        x:DataType="vm:MainWindowViewModel"
        Title="Contact List">
    <StackPanel Spacing="10" Margin="10">
        <ListBox Name="ContactsListBox" ItemsSource="{Binding Contacts}"
                 SelectionMode="Single,Toggle"
                 SelectedItem="{Binding SelectedContact}"/>
        <TextBox Name="NameTextBox"  Watermark="Name"  Text="{Binding NewContactName}"/>
        <TextBox Name="EmailTextBox" Watermark="Email" Text="{Binding NewContactEmail}"/>
        <StackPanel Orientation="Horizontal" Spacing="8">
            <Button Name="AddContactButton"    Content="Add Contact"    Command="{Binding AddContact}"/>
            <Button Name="DeleteContactButton" Content="Delete Contact" Command="{Binding DeleteContact}"/>
            <Button Name="SaveContactsButton"  Content="Save"           Command="{Binding SaveData}"/>
        </StackPanel>
        <TextBlock Text="{Binding SelectedContact.Name}"/>
        <TextBlock Text="{Binding SelectedContact.Email}"/>
    </StackPanel>
</Window>`;

  var CONTACTLIST_APP = String.raw`using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Data.Core.Plugins;
using Avalonia.Markup.Xaml;
using ContactListMVVM.Services;
using ContactListMVVM.ViewModels;
using ContactListMVVM.Views;
using System.Linq;

namespace ContactListMVVM;

public partial class App : Application
{
    public override void Initialize() => AvaloniaXamlLoader.Load(this);

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            DisableAvaloniaDataAnnotationValidation();

            // Dependency injection done by hand at the composition root:
            IContactRepository repo = new JSONContactRepository();
            desktop.MainWindow = new MainWindow
            {
                DataContext = new MainWindowViewModel(repo),
            };
        }

        base.OnFrameworkInitializationCompleted();
    }

    private void DisableAvaloniaDataAnnotationValidation()
    {
        var plugins = BindingPlugins.DataValidators
            .OfType<DataAnnotationsValidationPlugin>().ToArray();
        foreach (var plugin in plugins)
            BindingPlugins.DataValidators.Remove(plugin);
    }
}`;

  /* ============================================================
   * 2. RectangleUI (Day 1 exam) — June P2, canvas + timer + sliders
   * ============================================================ */
  var RECT_MODEL = String.raw`using Avalonia.Media;
using CommunityToolkit.Mvvm.ComponentModel;

namespace RectangleUI.Models;

// ObservableObject so position/color changes update the UI live (task 2.3!)
public partial class RectangleData : ObservableObject
{
    [ObservableProperty] private double _x;
    [ObservableProperty] private double _y;
    [ObservableProperty] private double _width;
    [ObservableProperty] private double _height;
    [ObservableProperty] private IBrush _color = Brushes.Red;
}`;

  var RECT_VM = String.raw`using System;
using System.Collections.ObjectModel;
using Avalonia.Media;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using RectangleUI.Models;

namespace RectangleUI.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    private const double CanvasSize = 500;       // canvas is 500x500 in the axaml

    private readonly Random _random = new();
    private readonly IBrush[] _colors =
    {
        Brushes.Red, Brushes.Blue, Brushes.Green, Brushes.Orange, Brushes.Purple
    };

    public ObservableCollection<RectangleData> Rectangles { get; } = new();

    // bound to the two sliders (start at their Value="50")
    [ObservableProperty] private double _rectWidth = 50;
    [ObservableProperty] private double _rectHeight = 50;

    public MainWindowViewModel()
    {
        // 2.3: DispatcherTimer ticks ON the UI thread -> thread-safety requirement met
        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        timer.Tick += (_, _) => ShuffleRectangles();
        timer.Start();
    }

    [RelayCommand]
    private void AddRectangle()
    {
        // clamp so the rectangle is ALWAYS fully inside the canvas:
        Rectangles.Add(new RectangleData
        {
            Width  = RectWidth,
            Height = RectHeight,
            X = _random.NextDouble() * (CanvasSize - RectWidth),
            Y = _random.NextDouble() * (CanvasSize - RectHeight),
            Color = _colors[_random.Next(_colors.Length)]
        });
    }

    private void ShuffleRectangles()
    {
        foreach (var r in Rectangles)
        {
            r.X = _random.NextDouble() * (CanvasSize - r.Width);
            r.Y = _random.NextDouble() * (CanvasSize - r.Height);
            r.Color = _colors[_random.Next(_colors.Length)];
        }
    }
}`;

  var RECT_AXAML = String.raw`<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="using:RectangleUI.ViewModels"
        xmlns:models="using:RectangleUI.Models"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        mc:Ignorable="d" d:DesignWidth="700" d:DesignHeight="540"
        x:Class="RectangleUI.Views.MainWindow"
        x:DataType="vm:MainWindowViewModel"
        Title="RectangleUI" Width="700" Height="540">
    <DockPanel LastChildFill="True">
        <StackPanel DockPanel.Dock="Left">
            <Button Margin="10" Content="Add Rectangle"
                    Command="{Binding AddRectangleCommand}"/>
            <Slider Margin="10" Value="{Binding RectWidth}"  Minimum="0" Maximum="100"/>
            <Slider Margin="10" Value="{Binding RectHeight}" Minimum="0" Maximum="100"/>
        </StackPanel>

        <Panel>
            <ItemsControl ItemsSource="{Binding Rectangles}">
                <ItemsControl.ItemsPanel>
                    <ItemsPanelTemplate>
                        <Canvas Background="LightGray" Width="500" Height="500"/>
                    </ItemsPanelTemplate>
                </ItemsControl.ItemsPanel>
                <ItemsControl.ItemTemplate>
                    <DataTemplate DataType="{x:Type models:RectangleData}">
                        <Rectangle Width="{Binding Width}" Height="{Binding Height}"
                                   Fill="{Binding Color}"/>
                    </DataTemplate>
                </ItemsControl.ItemTemplate>
                <ItemsControl.Styles>
                    <Style Selector="ContentPresenter" x:DataType="models:RectangleData">
                        <Setter Property="Canvas.Left" Value="{Binding X}"/>
                        <Setter Property="Canvas.Top"  Value="{Binding Y}"/>
                    </Style>
                </ItemsControl.Styles>
            </ItemsControl>
        </Panel>
    </DockPanel>
</Window>`;

  /* ============================================================
   * 3. TestableCalculator (Day 2 lesson) — CanExecute + headless
   * ============================================================ */
  var CALC_VM = String.raw`using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace Calculator.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    [ObservableProperty]
    private int _firstOperand;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(DivideCommand))]
    private int _secondOperand;
    // ^ whenever SecondOperand changes, re-ask CanExecute -> the / button
    //   enables/disables itself. THIS attribute is the whole lesson.

    [ObservableProperty]
    private float _result;

    [RelayCommand]
    private void Add() => Result = FirstOperand + SecondOperand;

    [RelayCommand]
    private void Substract() => Result = FirstOperand - SecondOperand;

    [RelayCommand]
    private void Multiply() => Result = FirstOperand * SecondOperand;

    [RelayCommand(CanExecute = nameof(CheckIfDivisionByZero))]
    private void Divide() => Result = FirstOperand / SecondOperand;

    private bool CheckIfDivisionByZero() => SecondOperand != 0;
    // guard instead of try/catch: the bad action becomes impossible, not handled
}`;

  var CALC_AXAML = String.raw`<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="using:Calculator.ViewModels"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        mc:Ignorable="d" d:DesignWidth="320" d:DesignHeight="240"
        x:Class="Calculator.Views.MainWindow"
        x:DataType="vm:MainWindowViewModel"
        Title="Calculator"
        SizeToContent="WidthAndHeight"
        CanResize="False">

    <Design.DataContext>
        <vm:MainWindowViewModel/>
    </Design.DataContext>

    <StackPanel Spacing="10" Margin="10" HorizontalAlignment="Left">
        <TextBox Name="FirstOperandInput"  Text="{Binding FirstOperand, Mode=TwoWay}"  Watermark="Operand 1"/>
        <TextBox Name="SecondOperandInput" Text="{Binding SecondOperand, Mode=TwoWay}" Watermark="Operand 2"/>

        <UniformGrid Columns="4">
            <UniformGrid.Styles>
                <Style Selector="UniformGrid > Button">
                    <Setter Property="HorizontalContentAlignment" Value="Center"/>
                    <Setter Property="Margin" Value="10"/>
                    <Setter Property="MinWidth" Value="50"/>
                </Style>
            </UniformGrid.Styles>
            <Button Name="AddButton"      Content="+" Command="{Binding AddCommand}"       Classes="accent"/>
            <Button Name="SubtractButton" Content="-" Command="{Binding SubstractCommand}" Classes="accent"/>
            <Button Name="MultiplyButton" Content="*" Command="{Binding MultiplyCommand}"  Classes="accent"/>
            <Button Name="DivideButton"   Content="/" Command="{Binding DivideCommand}"    Classes="accent"/>
        </UniformGrid>

        <StackPanel Orientation="Horizontal" Spacing="10">
            <TextBlock Text="Result:"/>
            <TextBlock x:Name="ResultBox" Text="{Binding Result}"/>
        </StackPanel>
    </StackPanel>
</Window>`;

  var CALC_TEST_PLAIN = String.raw`using Calculator.ViewModels;
using Xunit;

namespace Calculator.Test;

// Plain xUnit: a ViewModel is just a class, no Avalonia needed.
public class UnitTest1
{
    [Fact]
    public void AddCommand_AddsTwoNumbers()
    {
        MainWindowViewModel vm = new();
        Assert.Equal(0, vm.Result);

        vm.FirstOperand = 1;
        vm.SecondOperand = 1;
        vm.AddCommand.Execute(null);

        Assert.Equal(2, vm.Result);
    }
}`;

  var CALC_TEST_HEADLESS = String.raw`using Avalonia.Headless.XUnit;
using Calculator.ViewModels;
using Calculator.Views;
using Xunit;

namespace Calculator.AvaloniaTest;

public class AvaloniaTests
{
    [AvaloniaFact]   // headless: needs the Avalonia dispatcher, not [Fact]
    public void Should_Enable_Button_If_Not_Zero()
    {
        var window = new MainWindow { DataContext = new MainWindowViewModel() };
        window.Show();

        Assert.False(window.DivideButton.IsEffectivelyEnabled);  // operand2 == 0

        window.SecondOperandInput.Focus();
        window.KeyTextInput("10");                                // real input pipeline

        Assert.True(window.DivideButton.IsEffectivelyEnabled);
    }
}`;

  /* ============================================================
   * 4. Counter tests (Day 2 exam) — June P3 5 required tests, green
   * ============================================================ */
  var COUNTER_VMBASE = String.raw`using CommunityToolkit.Mvvm.ComponentModel;

namespace Counter.ViewModels;

public abstract class ViewModelBase : ObservableObject
{
}`;

  var COUNTER_VM = String.raw`using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace Counter.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    [ObservableProperty]
    private int _count;

    [RelayCommand]
    private void Increment() => Count++;

    [RelayCommand(CanExecute = nameof(CanDecrement))]
    private void Decrement() => Count--;

    private bool CanDecrement() => Count > 0;

    // CanExecute is NOT re-checked automatically -- announce the change:
    partial void OnCountChanged(int value) => DecrementCommand.NotifyCanExecuteChanged();
}`;

  var COUNTER_TESTS = String.raw`using Counter.ViewModels;
using Xunit;

namespace Counter.Tests;

public class MainWindowViewModelTests
{
    [Fact]
    public void Counter_IsInitializedToZero()
    {
        var vm = new MainWindowViewModel();
        Assert.Equal(0, vm.Count);
    }

    [Fact]
    public void DecrementCommand_CannotExecute_AfterInitialization()
    {
        var vm = new MainWindowViewModel();
        Assert.False(vm.DecrementCommand.CanExecute(null));
    }

    [Fact]
    public void IncrementCommand_IncrementsCountByOne()
    {
        var vm = new MainWindowViewModel();
        vm.IncrementCommand.Execute(null);
        Assert.Equal(1, vm.Count);
    }

    [Fact]
    public void DecrementCommand_CanExecute_AfterIncrement()
    {
        var vm = new MainWindowViewModel();
        vm.IncrementCommand.Execute(null);
        Assert.True(vm.DecrementCommand.CanExecute(null));
    }

    [Fact]
    public void DecrementCommand_DecrementsCountByOne()
    {
        var vm = new MainWindowViewModel();
        vm.IncrementCommand.Execute(null);
        vm.DecrementCommand.Execute(null);
        Assert.Equal(0, vm.Count);
    }
}`;

  var COUNTER_HEADLESS = String.raw`// The headless 100-click UI test needs the Counter APP project (App + named
// MainWindow). Add it to a project that ProjectReferences the app, then:
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Counter.ViewModels;
using Counter.Views;
using Xunit;

public class CounterUiTests
{
    [AvaloniaFact]
    public void Clicking_Increment_100_Times_Displays_100()
    {
        var window = new MainWindow { DataContext = new MainWindowViewModel() };
        window.Show();

        var button = window.FindControl<Button>("IncrementButton");
        var output = window.FindControl<TextBlock>("CountText");
        Assert.NotNull(button);
        Assert.NotNull(output);

        for (int i = 0; i < 100; i++)
        {
            button!.Focus();
            window.KeyPressQwerty(PhysicalKey.Enter, RawInputModifiers.None);
        }

        Assert.Equal("100", output!.Text);
    }
}`;

  /* ============================================================
   * 5. Async auto-counter (Day 2 exam) — Aug P3, three solutions
   * ============================================================ */
  var ASYNC_VM_A = String.raw`using System;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace AsyncCounter.ViewModels;

// Solution A: DispatcherTimer (simplest, recommended at the exam).
public partial class MainWindowViewModel : ViewModelBase
{
    [ObservableProperty]
    private int _count = 0;

    private DispatcherTimer? _timer;

    [RelayCommand]
    private void Start()
    {
        if (_timer is { IsEnabled: true }) return;   // guard against double-start
        _timer ??= CreateTimer();
        _timer.Start();
    }

    private DispatcherTimer CreateTimer()
    {
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
        timer.Tick += (_, _) => Count++;   // Tick fires ON the UI thread => thread-safe
        return timer;
    }

    [RelayCommand]
    private void Stop() => _timer?.Stop();     // Count untouched => Start resumes

    [RelayCommand]
    private void Reset() => Count = 0;
}`;

  var ASYNC_VM_B = String.raw`using System;
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace AsyncCounter.ViewModels;

// Solution B: background Task + CancellationToken + Dispatcher.
public partial class MainWindowViewModel : ViewModelBase
{
    [ObservableProperty]
    private int _count = 0;

    private CancellationTokenSource? _cts;

    [RelayCommand]
    private void Start()
    {
        if (_cts is not null) return;            // already running
        _cts = new CancellationTokenSource();
        CancellationToken token = _cts.Token;

        Task.Run(async () =>
        {
            try
            {
                while (!token.IsCancellationRequested)
                {
                    await Task.Delay(100, token);
                    // on a thread-pool thread here -> marshal to the UI thread:
                    Dispatcher.UIThread.Post(() => Count++);
                }
            }
            catch (OperationCanceledException) { /* expected on Stop */ }
        }, token);
    }

    [RelayCommand]
    private void Stop()
    {
        _cts?.Cancel();
        _cts = null;          // lets Start run again, Count resumes from last value
    }

    [RelayCommand]
    private void Reset() => Dispatcher.UIThread.Post(() => Count = 0);
}`;

  var ASYNC_VM_C = String.raw`using System;
using System.Threading;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace AsyncCounter.ViewModels;

// Solution C: PeriodicTimer on the UI thread (async RelayCommand).
public partial class MainWindowViewModel : ViewModelBase
{
    [ObservableProperty]
    private int _count = 0;

    private CancellationTokenSource? _cts;

    [RelayCommand]
    private async Task Start()         // async => generates an AsyncRelayCommand
    {
        if (_cts is not null) return;
        _cts = new CancellationTokenSource();

        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(100));
        try
        {
            // awaiting on the UI thread: continuations resume on the UI thread,
            // so Count++ here is already thread-safe.
            while (await timer.WaitForNextTickAsync(_cts.Token))
                Count++;
        }
        catch (OperationCanceledException) { }
        finally { _cts = null; }
    }

    [RelayCommand]
    private void Stop() => _cts?.Cancel();

    [RelayCommand]
    private void Reset() => Count = 0;
}`;

  var ASYNC_AXAML = String.raw`<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="using:AsyncCounter.ViewModels"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        mc:Ignorable="d" d:DesignWidth="320" d:DesignHeight="240"
        x:Class="AsyncCounter.Views.MainWindow"
        x:DataType="vm:MainWindowViewModel"
        Title="Auto Counter" Width="320" Height="240"
        WindowStartupLocation="CenterScreen">

    <Design.DataContext>
        <vm:MainWindowViewModel/>
    </Design.DataContext>

    <StackPanel Spacing="14" Margin="20" HorizontalAlignment="Center" VerticalAlignment="Center">
        <TextBlock Text="{Binding Count}" FontSize="64" FontWeight="Bold"
                   HorizontalAlignment="Center"/>
        <StackPanel Orientation="Horizontal" Spacing="8" HorizontalAlignment="Center">
            <Button Content="Start" Command="{Binding StartCommand}" Classes="accent"/>
            <Button Content="Stop"  Command="{Binding StopCommand}"/>
            <Button Content="Reset" Command="{Binding ResetCommand}"/>
        </StackPanel>
    </StackPanel>
</Window>`;

  /* ============================================================
   * 6. Spaceships LINQ (Day 3) — June P4 console, real data
   * ============================================================ */
  var SPACE_PROGRAM = String.raw`using System.Text.Json;

internal class Program
{
    public static void Main()
    {
        List<Spaceship> ships =
            JsonSerializer.Deserialize<List<Spaceship>>(File.ReadAllText("spaceships.json"))
            ?? new List<Spaceship>();

        Console.WriteLine("--- 1. Military ships ---");
        var military = ships.Where(s => s.Type == "Military").ToList();
        military.ForEach(s => Console.WriteLine($"{s.Name} ({s.ShipId})"));

        Console.WriteLine("--- 2. Currently traveling (no arrival date yet) ---");
        var traveling = ships
            .Where(s => (s.TravelHistory ?? new()).Any(t => t.ArrivalDate == null))
            .ToList();
        traveling.ForEach(s => Console.WriteLine(s.Name));

        Console.WriteLine("--- 3. Sorted by number of trips (most first) ---");
        var byTrips = ships.OrderByDescending(s => s.TravelHistory?.Count ?? 0).ToList();
        byTrips.ForEach(s => Console.WriteLine($"{s.Name}: {s.TravelHistory?.Count ?? 0} trips"));

        Console.WriteLine("--- 4. Average trips per ship type ---");
        var avgPerType = ships
            .GroupBy(s => s.Type)
            .Select(g => new { Type = g.Key, Avg = g.Average(s => s.TravelHistory?.Count ?? 0) });
        foreach (var row in avgPerType)
            Console.WriteLine($"{row.Type}: {row.Avg:F2}");

        Console.WriteLine("--- 5. Departed Ganymede Port in 2245 ---");
        var ganymede = ships
            .Where(s => (s.TravelHistory ?? new()).Any(t =>
                t.DeparturePort == "Ganymede Port" && t.DepartureDate?.Year == 2245))
            .ToList();
        ganymede.ForEach(s => Console.WriteLine(s.Name));

        // ---- 4.3 binary search (sort by the search key FIRST) ----
        var sorted = ships.OrderBy(s => s.Name, StringComparer.Ordinal).ToList();
        int index = BinarySearchByName(sorted, "Rocinante");
        Console.WriteLine(index >= 0
            ? $"Found: {sorted[index].Name} ({sorted[index].ShipId}, {sorted[index].Type})"
            : "Rocinante not found");
    }

    static int BinarySearchByName(List<Spaceship> list, string name)
    {
        int lo = 0, hi = list.Count - 1;
        while (lo <= hi)
        {
            int mid = (lo + hi) / 2;
            int cmp = string.Compare(list[mid].Name, name, StringComparison.Ordinal);
            if (cmp == 0) return mid;
            else if (cmp < 0) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }
}

public class Spaceship
{
    public string ShipId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public List<Trip>? TravelHistory { get; set; }    // nullable: some ships lack it
}

public class Trip
{
    public string TripId { get; set; } = "";
    public string? DeparturePort { get; set; }
    public string? ArrivalPort { get; set; }
    public DateTime? DepartureDate { get; set; }
    public DateTime? ArrivalDate { get; set; }        // null = still traveling
}`;

  /* Trimmed but representative spaceships.json (8 ships): keeps the download
     small while still exercising every query — missing TravelHistory (Aegis
     Hammer, UNN Scimitar), a ship still traveling (Belt Hauler's last trip has
     no ArrivalDate), a Ganymede-2245 departure (Star Hopper), and Rocinante for
     the binary search. The full 20-ship file ships with the exam. */
  var SPACE_JSON = String.raw`[
  { "ShipId": "SHP-MIL-001", "Name": "Aegis Hammer", "Type": "Military" },
  {
    "ShipId": "SHP-CRG-001", "Name": "Belt Hauler", "Type": "Cargo",
    "TravelHistory": [
      {"TripId":"TRP003","DeparturePort":"Titan Docks","ArrivalPort":"Luna Gateway","DepartureDate":"2245-05-01","ArrivalDate":"2245-05-15"},
      {"TripId":"TRP012","DeparturePort":"Ceres Hub","ArrivalPort":"Luna Gateway","DepartureDate":"2245-06-15","ArrivalDate":"2245-06-23"},
      {"TripId":"TRP030","DeparturePort":"Mars Station Alpha","ArrivalPort":"Ceres Hub","DepartureDate":"2245-07-10"}
    ]
  },
  {
    "ShipId": "SHP-PAS-001", "Name": "Star Hopper", "Type": "Passenger",
    "TravelHistory": [
      {"TripId":"TRP005","DeparturePort":"Luna Gateway","ArrivalPort":"Mars Station Alpha","DepartureDate":"2245-06-01","ArrivalDate":"2245-06-05"},
      {"TripId":"TRP031","DeparturePort":"Ganymede Port","ArrivalPort":"Mars Station Alpha","DepartureDate":"2245-06-20","ArrivalDate":"2245-07-05"}
    ]
  },
  { "ShipId": "SHP-MIL-002", "Name": "UNN Scimitar", "Type": "Military" },
  {
    "ShipId": "SHP-CRG-002", "Name": "Jupiter Ore Carrier", "Type": "Cargo",
    "TravelHistory": [
      {"TripId":"TRP006","DeparturePort":"Ceres Hub","ArrivalPort":"Ganymede Port","DepartureDate":"2245-05-10","ArrivalDate":"2245-05-25"},
      {"TripId":"TRP033","DeparturePort":"Io Sulphur Mines","ArrivalPort":"Ceres Hub","DepartureDate":"2245-06-25"}
    ]
  },
  {
    "ShipId": "SHP-PAS-002", "Name": "Solaris Express", "Type": "Passenger",
    "TravelHistory": [
      {"TripId":"TRP009","DeparturePort":"Titan Docks","ArrivalPort":"Luna Gateway","DepartureDate":"2245-05-18","ArrivalDate":"2245-06-01"}
    ]
  },
  {
    "ShipId": "SHP-MIL-004", "Name": "Rocinante", "Type": "Military",
    "TravelHistory": [
      {"TripId":"TRP019","DeparturePort":"Europa Landing","ArrivalPort":"Titan Docks","DepartureDate":"2245-06-05","ArrivalDate":"2245-06-15"},
      {"TripId":"TRP049","DeparturePort":"Titan Docks","ArrivalPort":"Triton Outpost","DepartureDate":"2245-06-20","ArrivalDate":"2245-07-20"},
      {"TripId":"TRP050","DeparturePort":"Triton Outpost","ArrivalPort":"Titan Docks","DepartureDate":"2245-07-25","ArrivalDate":"2245-08-25"}
    ]
  },
  {
    "ShipId": "SHP-PAS-003", "Name": "Outer Rim Runner", "Type": "Passenger",
    "TravelHistory": [
      {"TripId":"TRP041","DeparturePort":"Titan Docks","ArrivalPort":"Ganymede Port","DepartureDate":"2245-06-20","ArrivalDate":"2245-07-01"},
      {"TripId":"TRP042","DeparturePort":"Ganymede Port","ArrivalPort":"Mars Station Alpha","DepartureDate":"2245-07-05","ArrivalDate":"2245-07-15"}
    ]
  }
]`;

  /* ============================================================
   * 7. Starter Kit (bc-starter-kit) — the real 3-project solution
   *    bundled verbatim from the local AOP Exam Starter Kit.
   * ============================================================ */
  var SK_EXAMAPP_CSPROJ = String.raw`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <AvaloniaUseCompiledBindingsByDefault>true</AvaloniaUseCompiledBindingsByDefault>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Avalonia" Version="11.2.1" />
    <PackageReference Include="Avalonia.Desktop" Version="11.2.1" />
    <PackageReference Include="Avalonia.Themes.Fluent" Version="11.2.1" />
    <PackageReference Include="Avalonia.Fonts.Inter" Version="11.2.1" />
    <PackageReference Condition="'$(Configuration)' == 'Debug'" Include="Avalonia.Diagnostics" Version="11.2.1" />
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.2.1" />
  </ItemGroup>

  <ItemGroup>
    <InternalsVisibleTo Include="ExamApp.Tests" />
  </ItemGroup>
</Project>`;

  var SK_APP_AXAML = String.raw`<Application xmlns="https://github.com/avaloniaui"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:local="using:ExamApp"
             x:Class="ExamApp.App"
             RequestedThemeVariant="Light">

    <Application.DataTemplates>
        <local:ViewLocator/>
    </Application.DataTemplates>

    <Application.Styles>
        <FluentTheme />
    </Application.Styles>
</Application>`;

  var SK_APP_CS = String.raw`using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Data.Core.Plugins;
using Avalonia.Markup.Xaml;
using ExamApp.ViewModels;
using ExamApp.Views;
using System.Linq;

namespace ExamApp;

public partial class App : Application
{
    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            DisableAvaloniaDataAnnotationValidation();

            desktop.MainWindow = new MainWindow
            {
                DataContext = new MainWindowViewModel(),
            };
        }

        base.OnFrameworkInitializationCompleted();
    }

    private void DisableAvaloniaDataAnnotationValidation()
    {
        var dataValidationPluginsToRemove =
            BindingPlugins.DataValidators.OfType<DataAnnotationsValidationPlugin>().ToArray();

        foreach (var plugin in dataValidationPluginsToRemove)
        {
            BindingPlugins.DataValidators.Remove(plugin);
        }
    }
}`;

  var SK_PROGRAM_CS = String.raw`using Avalonia;
using System;

namespace ExamApp;

class Program
{
    [STAThread]
    public static void Main(string[] args) => BuildAvaloniaApp()
        .StartWithClassicDesktopLifetime(args);

    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .WithInterFont()
            .LogToTrace();
}`;

  var SK_VIEWLOCATOR_CS = String.raw`using Avalonia.Controls;
using Avalonia.Controls.Templates;
using ExamApp.ViewModels;
using System;

namespace ExamApp;

public class ViewLocator : IDataTemplate
{
    public Control? Build(object? param)
    {
        if (param is null)
            return null;

        var name = param.GetType().FullName!.Replace("ViewModel", "View", StringComparison.Ordinal);
        var type = Type.GetType(name);

        if (type != null)
        {
            return (Control)Activator.CreateInstance(type)!;
        }

        return new TextBlock { Text = "Not Found: " + name };
    }

    public bool Match(object? data)
    {
        return data is ViewModelBase;
    }
}`;

  var SK_VMBASE_CS = String.raw`using CommunityToolkit.Mvvm.ComponentModel;

namespace ExamApp.ViewModels;

public abstract class ViewModelBase : ObservableObject
{
}`;

  var SK_VM_CS = String.raw`using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace ExamApp.ViewModels;

// A working demonstration of every exam-relevant pattern:
// ObservableCollection, [ObservableProperty], [RelayCommand],
// CanExecute + NotifyCanExecuteChangedFor, SelectedItem.
// Gut it and replace with the actual task.
public partial class MainWindowViewModel : ViewModelBase
{
    public ObservableCollection<string> Items { get; } = new();

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(AddItemCommand))]
    private string? newItem;

    [ObservableProperty]
    private string? selectedItem;

    [ObservableProperty]
    private string statusText = "0 items";

    [RelayCommand(CanExecute = nameof(CanAddItem))]
    private void AddItem()
    {
        Items.Add(NewItem!);
        NewItem = null;
        StatusText = $"{Items.Count} items";
    }

    private bool CanAddItem() => !string.IsNullOrWhiteSpace(NewItem);

    [RelayCommand]
    private void DeleteItem()
    {
        if (SelectedItem is not null)
        {
            Items.Remove(SelectedItem);
            StatusText = $"{Items.Count} items";
        }
    }
}`;

  var SK_MAINWINDOW_AXAML = String.raw`<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="using:ExamApp.ViewModels"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        mc:Ignorable="d" d:DesignWidth="500" d:DesignHeight="400"
        x:Class="ExamApp.Views.MainWindow"
        x:DataType="vm:MainWindowViewModel"
        Title="ExamApp"
        Width="500" Height="420"
        WindowStartupLocation="CenterScreen">

    <Design.DataContext>
        <vm:MainWindowViewModel/>
    </Design.DataContext>

    <DockPanel>
        <Border DockPanel.Dock="Bottom" Background="#F6F6F6" Padding="10,5">
            <TextBlock Name="StatusBlock" Text="{Binding StatusText}"
                       Foreground="#666666" FontSize="12"/>
        </Border>

        <StackPanel Margin="14" Spacing="10">
            <TextBlock Text="Starter Kit" FontSize="22" FontWeight="Bold"/>

            <TextBox Name="NewItemBox" Watermark="Type something..."
                     Text="{Binding NewItem}"/>

            <StackPanel Orientation="Horizontal" Spacing="8">
                <Button Name="AddButton" Content="Add" Classes="accent"
                        Command="{Binding AddItemCommand}"/>
                <Button Name="DeleteButton" Content="Delete selected"
                        Command="{Binding DeleteItemCommand}"/>
            </StackPanel>

            <ListBox Name="ItemsList" Height="220"
                     ItemsSource="{Binding Items}"
                     SelectedItem="{Binding SelectedItem}"/>
        </StackPanel>
    </DockPanel>
</Window>`;

  var SK_MAINWINDOW_CS = String.raw`using Avalonia.Controls;

namespace ExamApp.Views;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
}`;

  var SK_TESTS_CSPROJ = String.raw`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="coverlet.collector" Version="6.0.4" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />
    <PackageReference Include="Avalonia.Headless.XUnit" Version="11.2.1" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\ExamApp\ExamApp.csproj" />
  </ItemGroup>

  <ItemGroup>
    <Using Include="Xunit" />
  </ItemGroup>
</Project>`;

  var SK_TESTAPPBUILDER = String.raw`using Avalonia;
using Avalonia.Headless;
using ExamApp;

[assembly: AvaloniaTestApplication(typeof(TestAppBuilder))]

public class TestAppBuilder
{
    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<App>()
        .UseHeadless(new AvaloniaHeadlessPlatformOptions());
}`;

  var SK_VM_TESTS = String.raw`using ExamApp.ViewModels;

namespace ExamApp.Tests;

// Plain xUnit tests: a ViewModel is just a class. No Avalonia needed.
public class ViewModelTests
{
    [Fact]
    public void AddItemCommand_CannotExecute_WhileInputIsEmpty()
    {
        var vm = new MainWindowViewModel();

        Assert.False(vm.AddItemCommand.CanExecute(null));

        vm.NewItem = "Hello";
        Assert.True(vm.AddItemCommand.CanExecute(null));
    }

    [Fact]
    public void AddItemCommand_AddsItem_AndClearsInput()
    {
        var vm = new MainWindowViewModel();
        vm.NewItem = "Hello";

        vm.AddItemCommand.Execute(null);

        Assert.Single(vm.Items);
        Assert.Equal("Hello", vm.Items[0]);
        Assert.Null(vm.NewItem);
        Assert.Equal("1 items", vm.StatusText);
    }
}`;

  var SK_UI_TESTS = String.raw`using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using ExamApp.ViewModels;
using ExamApp.Views;

namespace ExamApp.Tests;

// Headless Avalonia UI tests: real window + simulated input, no rendering.
public class UiTests
{
    [AvaloniaFact]
    public void Typing_And_PressingAdd_ShowsItem_InList()
    {
        var window = new MainWindow { DataContext = new MainWindowViewModel() };
        window.Show();                              // required, even headless

        Assert.NotNull(window.NewItemBox);
        Assert.NotNull(window.AddButton);

        Assert.False(window.AddButton.IsEffectivelyEnabled);

        window.NewItemBox.Focus();
        window.KeyTextInput("Hello World");
        Assert.True(window.AddButton.IsEffectivelyEnabled);

        window.AddButton.Focus();
        window.KeyPressQwerty(PhysicalKey.Enter, RawInputModifiers.None);

        Assert.Equal(1, window.ItemsList.ItemCount);
        Assert.Equal("1 items", window.StatusBlock.Text);
    }
}`;

  var SK_CONSOLE_CSPROJ = String.raw`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <None Update="data.json">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    </None>
  </ItemGroup>
</Project>`;

  var SK_CONSOLE_PROGRAM = String.raw`using System.Text.Json;

// Problem-4 style pipeline, already working end to end:
// model (nullable members absorb missing values) -> deserialize ->
// LINQ queries + labelled printing -> save results as one JSON file.

List<Item> items =
    JsonSerializer.Deserialize<List<Item>>(File.ReadAllText("data.json"))
    ?? new List<Item>();

Console.WriteLine($"Loaded {items.Count} items.");

Console.WriteLine("--- Electronics ---");
var electronics = items.Where(i => i.Category == "Electronics").ToList();
electronics.ForEach(i => Console.WriteLine($"{i.Name}: {i.Price}"));

Console.WriteLine("--- Sorted by price, most expensive first ---");
var byPrice = items.OrderByDescending(i => i.Price).ToList();
byPrice.ForEach(i => Console.WriteLine($"{i.Name}: {i.Price}"));

Console.WriteLine("--- Average price per category ---");
var avgPerCategory = items
    .GroupBy(i => i.Category)
    .Select(g => new { Category = g.Key, Avg = g.Average(i => i.Price) });
foreach (var row in avgPerCategory)
    Console.WriteLine($"{row.Category}: {row.Avg:F2}");

Console.WriteLine("--- Items with no tags (Tags can be MISSING in the json) ---");
var untagged = items.Where(i => (i.Tags ?? new()).Count == 0).ToList();
untagged.ForEach(i => Console.WriteLine(i.Name));

var results = new { electronics, sortedByPrice = byPrice, averagePerCategory = avgPerCategory, noTags = untagged };
File.WriteAllText("results.json",
    JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true }));
Console.WriteLine("Saved results.json");

public class Item
{
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public decimal Price { get; set; }
    public List<string>? Tags { get; set; }   // nullable: "Coffee Maker" has no Tags
}`;

  var SK_CONSOLE_DATA = String.raw`[
  { "Name": "Laptop", "Category": "Electronics", "Price": 899.99, "Tags": [ "Portable", "Work" ] },
  { "Name": "Smartphone", "Category": "Electronics", "Price": 599.99, "Tags": [ "Portable" ] },
  { "Name": "Desk Chair", "Category": "Office", "Price": 149.99, "Tags": [] },
  { "Name": "Standing Desk", "Category": "Office", "Price": 299.99, "Tags": [ "Work" ] },
  { "Name": "Coffee Maker", "Category": "Home", "Price": 79.50 },
  { "Name": "Sci-Fi Novel", "Category": "Books", "Price": 14.99, "Tags": [ "Leisure" ] }
]`;

  /* the StarterKit.sln, verbatim from the local kit (fixed GUIDs) */
  var SK_SLN = "﻿\r\n" +
"Microsoft Visual Studio Solution File, Format Version 12.00\r\n" +
"# Visual Studio Version 17\r\n" +
"VisualStudioVersion = 17.0.31903.59\r\n" +
"MinimumVisualStudioVersion = 10.0.40219.1\r\n" +
'Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "ExamApp", "ExamApp\\ExamApp.csproj", "{8F7672BD-E649-44E0-9A28-EB14A332A666}"\r\n' +
"EndProject\r\n" +
'Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "ExamApp.Tests", "ExamApp.Tests\\ExamApp.Tests.csproj", "{4C0C3597-EDA9-436A-BA6D-299C1CA58A2D}"\r\n' +
"EndProject\r\n" +
'Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "ExamConsole", "ExamConsole\\ExamConsole.csproj", "{7D95ED2B-BB19-46DB-AB71-B9667C1DB373}"\r\n' +
"EndProject\r\n" +
"Global\r\n" +
"\tGlobalSection(SolutionConfigurationPlatforms) = preSolution\r\n" +
"\t\tDebug|Any CPU = Debug|Any CPU\r\n" +
"\t\tRelease|Any CPU = Release|Any CPU\r\n" +
"\tEndGlobalSection\r\n" +
"\tGlobalSection(ProjectConfigurationPlatforms) = postSolution\r\n" +
"\t\t{8F7672BD-E649-44E0-9A28-EB14A332A666}.Debug|Any CPU.ActiveCfg = Debug|Any CPU\r\n" +
"\t\t{8F7672BD-E649-44E0-9A28-EB14A332A666}.Debug|Any CPU.Build.0 = Debug|Any CPU\r\n" +
"\t\t{8F7672BD-E649-44E0-9A28-EB14A332A666}.Release|Any CPU.ActiveCfg = Release|Any CPU\r\n" +
"\t\t{8F7672BD-E649-44E0-9A28-EB14A332A666}.Release|Any CPU.Build.0 = Release|Any CPU\r\n" +
"\t\t{4C0C3597-EDA9-436A-BA6D-299C1CA58A2D}.Debug|Any CPU.ActiveCfg = Debug|Any CPU\r\n" +
"\t\t{4C0C3597-EDA9-436A-BA6D-299C1CA58A2D}.Debug|Any CPU.Build.0 = Debug|Any CPU\r\n" +
"\t\t{4C0C3597-EDA9-436A-BA6D-299C1CA58A2D}.Release|Any CPU.ActiveCfg = Release|Any CPU\r\n" +
"\t\t{4C0C3597-EDA9-436A-BA6D-299C1CA58A2D}.Release|Any CPU.Build.0 = Release|Any CPU\r\n" +
"\t\t{7D95ED2B-BB19-46DB-AB71-B9667C1DB373}.Debug|Any CPU.ActiveCfg = Debug|Any CPU\r\n" +
"\t\t{7D95ED2B-BB19-46DB-AB71-B9667C1DB373}.Debug|Any CPU.Build.0 = Debug|Any CPU\r\n" +
"\t\t{7D95ED2B-BB19-46DB-AB71-B9667C1DB373}.Release|Any CPU.ActiveCfg = Release|Any CPU\r\n" +
"\t\t{7D95ED2B-BB19-46DB-AB71-B9667C1DB373}.Release|Any CPU.Build.0 = Release|Any CPU\r\n" +
"\tEndGlobalSection\r\n" +
"\tGlobalSection(SolutionProperties) = preSolution\r\n" +
"\t\tHideSolutionNode = FALSE\r\n" +
"\tEndGlobalSection\r\n" +
"EndGlobal\r\n";

  /* ============================================================
   * preview mockups (static HTML; rendered in the light .preview-body)
   * ============================================================ */
  var BTN = "display:inline-block;padding:4px 12px;border:1px solid #adadad;border-radius:3px;background:#e1e1e1;font-size:12px";
  var BTN_ACCENT = "display:inline-block;padding:4px 12px;border:1px solid #0a6cce;border-radius:3px;background:#0a6cce;color:#fff;font-size:12px";
  var BTN_OFF = "display:inline-block;padding:4px 12px;border:1px solid #ccc;border-radius:3px;background:#f0f0f0;color:#a9a9a9;font-size:12px";
  var BOX = "border:1px solid #adadad;border-radius:3px;background:#fff;padding:5px 8px;font-size:12px;color:#555";
  var TERM = "background:#0c0c0c;color:#d6d6d6;padding:14px 16px;border-radius:6px;font-family:'Cascadia Code',Consolas,monospace;font-size:12px;line-height:1.55;margin:0;white-space:pre-wrap;overflow-x:auto";

  var PV_CONTACTLIST =
    '<div style="max-width:380px;margin:0 auto;font-family:\'Segoe UI\',sans-serif">' +
      '<div style="font-size:13px;color:#777;margin-bottom:8px">▣ Contact List</div>' +
      '<div style="border:1px solid #adadad;border-radius:3px;background:#fff;margin-bottom:8px">' +
        '<div style="padding:6px 10px;border-bottom:1px solid #eee">Ada Lovelace (ada@analytical.engine)</div>' +
        '<div style="padding:6px 10px;background:#cce4ff">Alan Turing (alan@bombe.uk)</div>' +
      '</div>' +
      '<div style="' + BOX + ';margin-bottom:6px">Grace Hopper</div>' +
      '<div style="' + BOX + ';margin-bottom:8px">grace@cobol.mil</div>' +
      '<div style="margin-bottom:10px"><span style="' + BTN + '">Add Contact</span> ' +
        '<span style="' + BTN + '">Delete Contact</span> <span style="' + BTN + '">Save</span></div>' +
      '<div style="font-weight:600">Alan Turing</div><div style="color:#555">alan@bombe.uk</div>' +
    '</div>';

  var PV_RECT =
    '<div style="display:flex;gap:14px;font-family:\'Segoe UI\',sans-serif">' +
      '<div style="display:flex;flex-direction:column;gap:14px;padding-top:6px">' +
        '<span style="' + BTN + '">Add Rectangle</span>' +
        '<div style="width:120px;height:4px;background:#bbb;border-radius:2px;position:relative"><span style="position:absolute;left:50%;top:-5px;width:13px;height:13px;border-radius:50%;background:#0a6cce"></span></div>' +
        '<div style="width:120px;height:4px;background:#bbb;border-radius:2px;position:relative"><span style="position:absolute;left:50%;top:-5px;width:13px;height:13px;border-radius:50%;background:#0a6cce"></span></div>' +
      '</div>' +
      '<div style="position:relative;flex:1;min-width:240px;height:230px;background:#d3d3d3;overflow:hidden;border-radius:2px">' +
        '<span style="position:absolute;left:30px;top:24px;width:50px;height:50px;background:#e53935"></span>' +
        '<span style="position:absolute;left:150px;top:60px;width:50px;height:50px;background:#1e88e5"></span>' +
        '<span style="position:absolute;left:90px;top:150px;width:50px;height:50px;background:#43a047"></span>' +
        '<span style="position:absolute;left:200px;top:160px;width:50px;height:50px;background:#8e24aa"></span>' +
        '<span style="position:absolute;left:40px;top:90px;width:50px;height:50px;background:#fb8c00"></span>' +
      '</div>' +
    '</div>' +
    '<div style="font-family:\'Segoe UI\',sans-serif;color:#666;font-size:11px;margin-top:8px">Add drops a clamped, always-fully-visible rectangle; every 2&nbsp;s they all jump &amp; recolor.</div>';

  var PV_CALC =
    '<div style="max-width:300px;margin:0 auto;font-family:\'Segoe UI\',sans-serif">' +
      '<div style="font-size:13px;color:#777;margin-bottom:8px">▣ Calculator</div>' +
      '<div style="' + BOX + ';margin-bottom:6px">6</div>' +
      '<div style="' + BOX + ';margin-bottom:10px;color:#222">0</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px">' +
        '<span style="' + BTN_ACCENT + '">+</span><span style="' + BTN_ACCENT + '">-</span>' +
        '<span style="' + BTN_ACCENT + '">*</span><span style="' + BTN_OFF + '" title="disabled">/</span>' +
      '</div>' +
      '<div>Result: <b>6</b></div>' +
      '<div style="color:#666;font-size:11px;margin-top:8px">The <b>/</b> button is greyed out while operand&nbsp;2 is 0 — that is CanExecute doing its job.</div>' +
    '</div>';

  var PV_COUNTER_TESTS =
    '<pre style="' + TERM + '">$ dotnet test\n' +
    'Determining projects to restore...\n' +
    'Restored Counter.Tests.csproj\n' +
    'Counter.Tests -> bin/Debug/net9.0/Counter.Tests.dll\n\n' +
    '<span style="color:#5fb95f">Passed!</span>  - Failed: 0, <span style="color:#5fb95f">Passed: 5</span>, Skipped: 0, Total: 5\n' +
    '   Counter_IsInitializedToZero\n' +
    '   DecrementCommand_CannotExecute_AfterInitialization\n' +
    '   IncrementCommand_IncrementsCountByOne\n' +
    '   DecrementCommand_CanExecute_AfterIncrement\n' +
    '   DecrementCommand_DecrementsCountByOne</pre>';

  var PV_ASYNC =
    '<div style="max-width:300px;margin:0 auto;font-family:\'Segoe UI\',sans-serif;text-align:center">' +
      '<div style="font-size:13px;color:#777;margin-bottom:10px;text-align:left">▣ Auto Counter</div>' +
      '<div style="font-size:54px;font-weight:700;line-height:1;margin:10px 0 16px">42</div>' +
      '<div><span style="' + BTN_ACCENT + '">Start</span> <span style="' + BTN + '">Stop</span> <span style="' + BTN + '">Reset</span></div>' +
      '<div style="color:#666;font-size:11px;margin-top:12px">Start → +1 every 100&nbsp;ms on the UI thread. Stop pauses (keeps the value); Start resumes.</div>' +
    '</div>';

  var PV_SPACE =
    '<pre style="' + TERM + '">$ dotnet run\n' +
    '--- 1. Military ships ---\n' +
    'Aegis Hammer (SHP-MIL-001)\n' +
    'UNN Scimitar (SHP-MIL-002)\n' +
    'Rocinante (SHP-MIL-004)\n' +
    '--- 2. Currently traveling (no arrival date yet) ---\n' +
    'Belt Hauler\n' +
    'Jupiter Ore Carrier\n' +
    '--- 3. Sorted by number of trips (most first) ---\n' +
    'Rocinante: 3 trips\n' +
    'Belt Hauler: 3 trips\n' +
    'Star Hopper: 2 trips\n' +
    '...\n' +
    'Aegis Hammer: 0 trips\n' +
    '--- 5. Departed Ganymede Port in 2245 ---\n' +
    'Star Hopper\n' +
    '<span style="color:#5fb95f">Found: Rocinante (SHP-MIL-004, Military)</span></pre>';

  var PV_STARTERKIT =
    '<pre style="' + TERM + '">AOP Exam Starter Kit/\n' +
    '├─ <span style="color:#6fb7ff">StarterKit.sln</span>          ← open this, F5, go\n' +
    '├─ ExamApp/                Avalonia MVVM app (1 working binding + command + list)\n' +
    '├─ ExamApp.Tests/          xUnit + headless, 2 passing tests\n' +
    '└─ ExamConsole/            JSON deserialize + LINQ + save-results skeleton\n\n' +
    '$ dotnet run --project ExamApp     → a window opens\n' +
    '$ dotnet test                      → <span style="color:#5fb95f">Passed! 2 tests</span>\n' +
    '$ dotnet run --project ExamConsole → reads data.json, writes results.json</pre>';

  /* ============================================================
   * the registry
   * ============================================================ */
  var DEMOS = [
    {
      id: "contactlist",
      title: "ContactList MVVM — runnable",
      zipName: "ContactListMVVM",
      blurb: "The whole MVVM loop in one window: type a name + email, **Add** appends to the list, select a row to see it below, **Save** persists to JSON behind a repository interface (DIP).",
      runHint: "Unzip → open the folder → `dotnet run` (or F5). Starts empty; add a few, hit Save, restart to see them reload.",
      previewTitle: "ContactList MVVM — running",
      preview: PV_CONTACTLIST,
      build: function (P) {
        var entries = P.avaloniaProject("ContactListMVVM", {
          axaml: CONTACTLIST_AXAML,
          viewModel: CONTACTLIST_VM,
          extraFiles: [
            { path: "Models/Contact.cs", text: CONTACTLIST_CONTACT },
            { path: "Services/IContactRepository.cs", text: CONTACTLIST_IREPO },
            { path: "Services/JSONContactRepository.cs", text: CONTACTLIST_JSONREPO }
          ]
        });
        // the VM needs DI, so replace the scaffold's parameterless wiring:
        return replaceEntry(entries, "App.axaml.cs", CONTACTLIST_APP);
      },
      files: [
        file("Models/Contact.cs", "csharp", CONTACTLIST_CONTACT),
        file("Services/IContactRepository.cs", "csharp", CONTACTLIST_IREPO),
        file("Services/JSONContactRepository.cs", "csharp", CONTACTLIST_JSONREPO),
        file("ViewModels/MainWindowViewModel.cs", "csharp", CONTACTLIST_VM),
        file("Views/MainWindow.axaml", "xml", CONTACTLIST_AXAML),
        file("App.axaml.cs (DI composition root)", "csharp", CONTACTLIST_APP)
      ]
    },
    {
      id: "rectangleui",
      title: "RectangleUI — runnable (June P2)",
      zipName: "RectangleUI",
      blurb: "Click **Add Rectangle** to drop a slider-sized rectangle at a random, always-fully-visible spot on the 500×500 canvas; every 2 seconds all rectangles jump and recolor — on the UI thread, via a `DispatcherTimer`.",
      runHint: "Unzip → `dotnet run` (or F5). Drag the sliders, spam Add, watch the 2-second shuffle.",
      previewTitle: "RectangleUI — running",
      preview: PV_RECT,
      build: function (P) {
        return P.avaloniaProject("RectangleUI", {
          axaml: RECT_AXAML,
          viewModel: RECT_VM,
          extraFiles: [{ path: "Models/RectangleData.cs", text: RECT_MODEL }]
        });
      },
      files: [
        file("Models/RectangleData.cs", "csharp", RECT_MODEL),
        file("ViewModels/MainWindowViewModel.cs", "csharp", RECT_VM),
        file("Views/MainWindow.axaml", "xml", RECT_AXAML)
      ]
    },
    {
      id: "testablecalculator",
      title: "TestableCalculator — runnable",
      zipName: "Calculator",
      blurb: "The unit-testing lecture's flagship. The **/** button disables itself whenever operand 2 is 0 (`CanExecute` + `NotifyCanExecuteChangedFor`). The two tests that prove it — a plain VM test and a headless UI test — are in the source below.",
      runHint: "Unzip → `dotnet run` (or F5). Type 0 in operand 2 and watch **/** grey out; type a number and it lights up.",
      previewTitle: "Calculator — running",
      preview: PV_CALC,
      build: function (P) {
        return P.avaloniaProject("Calculator", {
          axaml: CALC_AXAML,
          viewModel: CALC_VM
        });
      },
      files: [
        file("ViewModels/MainWindowViewModel.cs", "csharp", CALC_VM),
        file("Views/MainWindow.axaml", "xml", CALC_AXAML),
        file("Calculator.Test/UnitTest1.cs (plain xUnit)", "csharp", CALC_TEST_PLAIN),
        file("Calculator.AvaloniaTest/AvaloniaTests.cs (headless)", "csharp", CALC_TEST_HEADLESS)
      ]
    },
    {
      id: "counter-tests",
      title: "Counter tests — `dotnet test` is green",
      zipName: "Counter.Tests",
      blurb: "June P3's five required ViewModel tests in a **standalone, ready-to-run xUnit project** (the Counter VM is copied in, so there's nothing to wire up). Tests 2 and 4 are about `CanExecute`, not arithmetic — that's the point the examiner checks.",
      runHint: "Unzip → `dotnet test` → 5 passing. (The headless 100-click test below needs the app project; it's here to read.)",
      previewTitle: "dotnet test — 5 passed",
      preview: PV_COUNTER_TESTS,
      build: function (P) {
        return P.xunitProject("Counter.Tests", {
          headless: false,
          sourceFiles: [
            { path: "ViewModelBase.cs", text: COUNTER_VMBASE },
            { path: "MainWindowViewModel.cs", text: COUNTER_VM }
          ],
          testFiles: [{ path: "MainWindowViewModelTests.cs", text: COUNTER_TESTS }]
        });
      },
      files: [
        file("Counter VM under test (Counter.ViewModels)", "csharp", COUNTER_VM),
        file("Counter.Tests/MainWindowViewModelTests.cs — the 5 required tests", "csharp", COUNTER_TESTS),
        file("CounterUiTests.cs — headless 100-click (needs the app project)", "csharp", COUNTER_HEADLESS)
      ]
    },
    {
      id: "async-counter",
      title: "Async auto-counter — runnable (Aug P3)",
      zipName: "AsyncCounter",
      blurb: "Counter with **Start / Stop / Reset**: +1 every 100 ms, pause-resumable, reset to zero, all on the UI thread. The download ships Solution A (`DispatcherTimer`); the Task+CTS and PeriodicTimer variants are below.",
      runHint: "Unzip → `dotnet run` (or F5). Click Start (watch it climb), Stop (it pauses), Start (resumes), Reset (back to 0). Double-clicking Start does NOT double the speed — that's the guard.",
      previewTitle: "Auto Counter — running",
      preview: PV_ASYNC,
      build: function (P) {
        return P.avaloniaProject("AsyncCounter", {
          axaml: ASYNC_AXAML,
          viewModel: ASYNC_VM_A
        });
      },
      files: [
        file("Solution A · DispatcherTimer (shipped, recommended)", "csharp", ASYNC_VM_A),
        file("Views/MainWindow.axaml", "xml", ASYNC_AXAML),
        file("Solution B · Task.Run + CancellationToken + Dispatcher", "csharp", ASYNC_VM_B),
        file("Solution C · PeriodicTimer + async RelayCommand", "csharp", ASYNC_VM_C)
      ]
    },
    {
      id: "spaceships-linq",
      title: "Spaceships LINQ — runnable console (June P4)",
      zipName: "Spaceships",
      blurb: "A working Problem-4 console: null-safe deserialize of `spaceships.json` (some ships have no `TravelHistory`), the five queries, and a binary search for Rocinante (sorted by name first). `dotnet run` prints the labelled results.",
      runHint: "Unzip → `dotnet run`. The bundled `spaceships.json` is a trimmed 8-ship version; drop in the full exam file and it just works.",
      previewTitle: "dotnet run — query output",
      preview: PV_SPACE,
      build: function (P) {
        return P.consoleProject("Spaceships", {
          programCs: SPACE_PROGRAM,
          dataFiles: [{ path: "spaceships.json", text: SPACE_JSON }]
        });
      },
      files: [
        file("Program.cs — deserialize + 5 queries + binary search", "csharp", SPACE_PROGRAM),
        file("spaceships.json — sample data (8 ships)", "json", SPACE_JSON)
      ]
    },
    {
      id: "starter-kit",
      title: "The full Starter Kit — 3 projects + solution",
      zipName: "AOP-Exam-Starter-Kit",
      blurb: "The exact zero-setup kit: a minimal Avalonia MVVM app, an xUnit+headless test project already wired to it, and a console JSON/LINQ skeleton — one `StarterKit.sln` that opens and runs. Exam-identical stack, packages pre-pinned.",
      runHint: "Unzip → open `StarterKit.sln` (or the folder) → F5. `dotnet test` → 2 green. Build it once with internet so the NuGet cache is warm for exam day.",
      previewTitle: "AOP Exam Starter Kit — layout",
      preview: PV_STARTERKIT,
      build: function (P) {
        var out = [];
        // ---- ExamApp (Avalonia app) ----
        out = out.concat(prefix([
          { path: "ExamApp.csproj", text: SK_EXAMAPP_CSPROJ },
          { path: "App.axaml", text: SK_APP_AXAML },
          { path: "App.axaml.cs", text: SK_APP_CS },
          { path: "Program.cs", text: SK_PROGRAM_CS },
          { path: "ViewLocator.cs", text: SK_VIEWLOCATOR_CS },
          { path: "ViewModels/ViewModelBase.cs", text: SK_VMBASE_CS },
          { path: "ViewModels/MainWindowViewModel.cs", text: SK_VM_CS },
          { path: "Views/MainWindow.axaml", text: SK_MAINWINDOW_AXAML },
          { path: "Views/MainWindow.axaml.cs", text: SK_MAINWINDOW_CS }
        ], "ExamApp/"));
        // ---- ExamApp.Tests (xUnit + headless, references ExamApp) ----
        out = out.concat(prefix([
          { path: "ExamApp.Tests.csproj", text: SK_TESTS_CSPROJ },
          { path: "TestAppBuilder.cs", text: SK_TESTAPPBUILDER },
          { path: "ViewModelTests.cs", text: SK_VM_TESTS },
          { path: "UiTests.cs", text: SK_UI_TESTS }
        ], "ExamApp.Tests/"));
        // ---- ExamConsole (LINQ/JSON skeleton) ----
        out = out.concat(prefix([
          { path: "ExamConsole.csproj", text: SK_CONSOLE_CSPROJ },
          { path: "Program.cs", text: SK_CONSOLE_PROGRAM },
          { path: "data.json", text: SK_CONSOLE_DATA }
        ], "ExamConsole/"));
        // ---- the solution at the root ----
        out.push({ path: "StarterKit.sln", text: SK_SLN });
        return out;
      },
      files: [
        file("ExamApp/ViewModels/MainWindowViewModel.cs", "csharp", SK_VM_CS),
        file("ExamApp/Views/MainWindow.axaml", "xml", SK_MAINWINDOW_AXAML),
        file("ExamApp.Tests/ViewModelTests.cs", "csharp", SK_VM_TESTS),
        file("ExamApp.Tests/UiTests.cs (headless)", "csharp", SK_UI_TESTS),
        file("ExamConsole/Program.cs", "csharp", SK_CONSOLE_PROGRAM)
      ]
    }
  ];

  function byId(id) {
    for (var i = 0; i < DEMOS.length; i++) if (DEMOS[i].id === id) return DEMOS[i];
    return null;
  }

  var API = {
    list: DEMOS,
    ids: DEMOS.map(function (d) { return d.id; }),
    byId: byId,
    // helpers exposed for tests
    prefix: prefix,
    replaceEntry: replaceEntry
  };

  global.BOOTCAMP_DEMOS = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
