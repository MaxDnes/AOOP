using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System;
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Threading;

namespace Counter.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    [ObservableProperty]
    private int _count = 0;

    [RelayCommand]
    private void Start() 
    {
        
    }

    [RelayCommand]
    private void Stop()
    {

    }

    [RelayCommand]
    private void Reset()
    {

    }
}
