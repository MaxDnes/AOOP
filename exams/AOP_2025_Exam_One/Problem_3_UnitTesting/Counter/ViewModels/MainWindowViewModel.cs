using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace Counter.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    
    [ObservableProperty]
    private int _count;

    [RelayCommand]
    private void Increment()
    {
        Count++;
    }

    [RelayCommand(CanExecute = nameof(CanDecrement))]
    private void Decrement()
    {
        Count--;
    }

    private bool CanDecrement() => Count > 0;

    partial void OnCountChanged(int value)
    {
        DecrementCommand.NotifyCanExecuteChanged();
    }

    public MainWindowViewModel()
    {
        _count = 0;
    }
}
