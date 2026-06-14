using CommunityToolkit.Mvvm.ComponentModel;

public partial class WeeklyItem : ObservableObject
{
    [ObservableProperty]
    private string _day = string.Empty;

    [ObservableProperty]
    private string _recipeName = string.Empty;

    public override string ToString()
    {
        return $"{Day}: {RecipeName}";
    }
}