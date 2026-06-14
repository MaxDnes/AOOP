namespace FamilyMealPlanner;

public class Recipe
{
    public string? Name { get; set; }
    public List<string> Ingredients { get; set; } = new List<string>();
    public List<string> DietaryTags { get; set; } = new List<string>(); // e.g., "Vegetarian", "ContainsNuts"
}

public class FamilyProfile
{
    public bool IsVegetarianFamily { get; set; }
    public List<string> Allergies { get; set; } = new List<string>();
}
