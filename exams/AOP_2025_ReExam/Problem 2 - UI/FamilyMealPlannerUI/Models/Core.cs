namespace FamilyMealPlannerUI.Models;

using System;
using System.Collections.Generic;
using System.Linq;

public class MealPlanner
{
    private readonly IRecipeFinder _recipeFinder;
    private readonly INotifier _notifier;
    private readonly List<IDietaryRule> _rules;

    public MealPlanner(IRecipeFinder recipeFinder, INotifier notifier, List<IDietaryRule> rules)
    {
        _recipeFinder = recipeFinder;
        _notifier = notifier;
        _rules = rules;
    }

    public List<Recipe> GenerateWeeklyPlan(FamilyProfile family, int numberOfMeals)
    {
        var suitableRecipes = _recipeFinder.FindRecipes(family).ToList();
        var weeklyPlan = new List<Recipe>();
        var inMemoryRepo = _recipeFinder as InMemoryRecipeRepository; // Cast to access GetRandomRecipe

        if (inMemoryRepo == null)
        {
            _notifier.Notify("Error: Recipe finder does not support random selection.");
            return weeklyPlan;
        }

        if (!suitableRecipes.Any())
        {
            _notifier.Notify("No suitable recipes found for the given family profile.");
            return weeklyPlan;
        }

        for (int i = 0; i < numberOfMeals; i++)
        {
            var randomRecipe = inMemoryRepo.GetRandomRecipe(suitableRecipes);
            if (randomRecipe != null)
            {
                weeklyPlan.Add(randomRecipe);
            }
            else
            {
                _notifier.Notify($"Could not find enough recipes to fill {numberOfMeals} meals.");
                break;
            }
        }
        return weeklyPlan;
    }
}

public class ShoppingListGenerator
{
    public List<string> Generate(List<Recipe> mealPlan)
    {
        var shoppingList = new List<string>();
        foreach (var recipe in mealPlan)
        {
            shoppingList.AddRange(recipe.Ingredients);
        }
        return shoppingList.Distinct().OrderBy(item => item).ToList();
    }
}

public class ConsoleNotifier : INotifier
{
    public void Notify(string message)
    {
        Console.WriteLine($"Notification: {message}");
    }
}