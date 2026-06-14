namespace FamilyMealPlannerUI.Models;

using System.Collections.Generic;

public interface IRecipeFinder
{
    IEnumerable<Recipe> FindRecipes(FamilyProfile family);
}

public interface INotifier
{
    void Notify(string message);
}

public interface IDietaryRule
{
    bool IsSatisfiedBy(Recipe recipe, FamilyProfile family);
}
