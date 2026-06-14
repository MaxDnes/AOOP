using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Data.Core;
using Avalonia.Data.Core.Plugins;
using System.Linq;
using Avalonia.Markup.Xaml;
using FamilyMealPlannerUI.ViewModels;
using FamilyMealPlannerUI.Views;
using FamilyMealPlannerUI.Models;
using System.Collections.Generic;
using CommunityToolkit.Mvvm.ComponentModel;

namespace FamilyMealPlannerUI;

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
            // Avoid duplicate validations from both Avalonia and the CommunityToolkit. 
            // More info: https://docs.avaloniaui.net/docs/guides/development-guides/data-validation#manage-validationplugins
            DisableAvaloniaDataAnnotationValidation();

            var family = new FamilyProfile
            {
                IsVegetarianFamily = false, 
                Allergies = new List<string> { "Nuts" }
            };

            IRecipeFinder recipeRepo = new InMemoryRecipeRepository();
            INotifier notifier = new ConsoleNotifier();
            ShoppingListGenerator shoppingListGenerator = new ShoppingListGenerator();
            
            var rules = new List<IDietaryRule>
            {
                new VegetarianRule(),
                new NutAllergyRule()
            };

            var planner = new MealPlanner(recipeRepo, notifier, rules);

            desktop.MainWindow = new MainWindow
            {
                DataContext = new MainWindowViewModel(recipeRepo, planner, family, shoppingListGenerator, rules),
            };
        }

        base.OnFrameworkInitializationCompleted();
    }

    private void DisableAvaloniaDataAnnotationValidation()
    {
        // Get an array of plugins to remove
        var dataValidationPluginsToRemove =
            BindingPlugins.DataValidators.OfType<DataAnnotationsValidationPlugin>().ToArray();

        // remove each entry found
        foreach (var plugin in dataValidationPluginsToRemove)
        {
            BindingPlugins.DataValidators.Remove(plugin);
        }
    }
}