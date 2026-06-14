using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace CartApp.ViewModels;

// A cart line item. Quantity starts at 1 and can never drop below 1.
// Decrement is only allowed while Quantity > 1 (the guard you will test).
public partial class QuantityViewModel : ObservableObject
{
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(DecrementCommand))]
    private int _quantity = 1;

    [RelayCommand]
    private void Increment()
    {
        Quantity++;
    }

    [RelayCommand(CanExecute = nameof(CanDecrement))]
    private void Decrement()
    {
        Quantity--;
    }

    private bool CanDecrement() => Quantity > 1;
}
