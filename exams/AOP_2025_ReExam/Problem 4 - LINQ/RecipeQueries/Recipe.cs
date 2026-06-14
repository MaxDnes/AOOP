namespace RecipeQueries;

public class Recipe
{
    public string Name { get; set; } = string.Empty;
    public List<string> Ingredients { get; set; } = new List<string>();
    public List<string> DietaryTags { get; set; } = new List<string>();

    public override string ToString()
    {
        return Name;
    }
}