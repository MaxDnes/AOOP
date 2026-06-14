namespace FamilyMealPlannerUI.Models;

public class VegetarianRule : IDietaryRule
{
    public bool IsSatisfiedBy(Recipe recipe, FamilyProfile family)
    {
        return !family.IsVegetarianFamily || recipe.DietaryTags.Contains("Vegetarian");
    }
}

public class NutAllergyRule : IDietaryRule
{
    public bool IsSatisfiedBy(Recipe recipe, FamilyProfile family)
    {
        return !family.Allergies.Contains("Nuts") || !recipe.DietaryTags.Contains("ContainsNuts");
    }
}