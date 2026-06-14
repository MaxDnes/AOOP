using Avalonia.Controls;
using Avalonia.Media;
using System.Collections.Generic;

namespace BoxCodeBehind;

public partial class MainWindow : Window
{
    public List<string> colors = new() { "SteelBlue", "Crimson", "SeaGreen", "Goldenrod", "Purple" };

    public MainWindow()
    {
        InitializeComponent();

        ColorSelector.ItemsSource = colors;

        WidthSlider.ValueChanged += (_, _) =>
        {
            Box.Width = WidthSlider.Value;
            Output.Text = $"{(int)WidthSlider.Value} x {(int)HeightSlider.Value}";
        };

        HeightSlider.ValueChanged += (_, _) =>
        {
            Box.Height = HeightSlider.Value;
            Output.Text = $"{(int)WidthSlider.Value} x {(int)HeightSlider.Value}";
        };

        ColorSelector.SelectionChanged += (_, _) =>
        {
            Box.Fill = Brush.Parse(ColorSelector.SelectedItem.ToString());
        };

        ResetButton.Click += (_, _) =>
        {
            WidthSlider.Value = 120;
            HeightSlider.Value = 80;
            ColorSelector.SelectedIndex = 0;
        };
    }
}
