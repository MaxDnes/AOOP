using Avalonia.Controls;
using Avalonia.Media;
using System.Collections.Generic;

namespace CircleCodeBehind;

public partial class MainWindow : Window
{
    public List<string> colors=new(){"Green", "Red", "Blue", "Purple", "Black"};
    
    public MainWindow()
    {
        InitializeComponent();

        SizeSlider.ValueChanged += (e, v) =>
        {
            Circle.Height = SizeSlider.Value;
            Circle.Width = SizeSlider.Value;
            Output.Text = SizeSlider.Value.ToString();
        };

        ResetButton.Click += (_, _) =>
        {
            SizeSlider.Value = 100;
        };

        ColorSelector.ItemsSource = colors;
        ColorSelector.SelectionChanged += (_, _) =>
        {
            Circle.Fill = Brush.Parse(ColorSelector.SelectedItem.ToString());
        };
    }
}