using System.Collections.Generic;
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using FamilyMealPlannerUI.Models;

namespace FamilyMealPlannerUI.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    public IRecipeFinder RecipeRepo { get; }
    public MealPlanner Planner { get; }
    public ShoppingListGenerator ShoppingListGenerator { get; }
    public List<IDietaryRule> Rules { get; }
    public FamilyProfile Family { get; }
    private List<Recipe> mealPlan = [];
    private readonly string[] daysOfWeek = { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" };

    [ObservableProperty]
    public WeeklyItem? selectedRecipe;

    public MainWindowViewModel(IRecipeFinder recipeRepo, MealPlanner planner, FamilyProfile family, ShoppingListGenerator shoppingListGenerator, List<IDietaryRule> rules)
    {
        RecipeRepo = recipeRepo;
        Planner = planner;
        Family = family;
        ShoppingListGenerator = shoppingListGenerator;
        Rules = rules;
    }

    [RelayCommand]
    public void CreateWeeklyPlan()
    {

    }

    partial void OnSelectedRecipeChanged(WeeklyItem value)
    {

    }

}
