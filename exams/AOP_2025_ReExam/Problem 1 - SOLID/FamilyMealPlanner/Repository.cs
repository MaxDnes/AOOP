namespace FamilyMealPlanner;

public class InMemoryRecipeRepository : IRecipeFinder
{
    private readonly List<Recipe> _recipes;
    private readonly Random _random;

    public InMemoryRecipeRepository()
    {
        _random = new Random();
        _recipes = new List<Recipe>
        {
            new Recipe { Name = "Spaghetti Bolognese", Ingredients = { "Pasta", "Ground Beef", "Tomatoes" }, DietaryTags = { } },
            new Recipe { Name = "Vegetable Curry", Ingredients = { "Mixed Vegetables", "Coconut Milk", "Curry Paste" }, DietaryTags = { "Vegetarian" } },
            new Recipe { Name = "Chicken Stir-fry", Ingredients = { "Chicken Breast", "Broccoli", "Soy Sauce" }, DietaryTags = { } },
            new Recipe { Name = "Lentil Soup", Ingredients = { "Lentils", "Carrots", "Celery" }, DietaryTags = { "Vegetarian" } },
            new Recipe { Name = "Salmon with Asparagus", Ingredients = { "Salmon Fillet", "Asparagus", "Lemon" }, DietaryTags = { } },
            new Recipe { Name = "Beef Tacos", Ingredients = { "Ground Beef", "Tortillas", "Salsa" }, DietaryTags = { } },
            new Recipe { Name = "Mushroom Risotto", Ingredients = { "Arborio Rice", "Mushrooms", "Parmesan" }, DietaryTags = { "Vegetarian" } },
            new Recipe { Name = "Pork Chops with Apples", Ingredients = { "Pork Chops", "Apples", "Onion" }, DietaryTags = { } },
            new Recipe { Name = "Quinoa Salad", Ingredients = { "Quinoa", "Cucumber", "Tomatoes", "Feta" }, DietaryTags = { "Vegetarian" } },
            new Recipe { Name = "Shepherd's Pie", Ingredients = { "Ground Lamb", "Potatoes", "Peas" }, DietaryTags = { } },
            new Recipe { Name = "Nutty Granola Bars", Ingredients = { "Oats", "Honey", "Nuts" }, DietaryTags = { "ContainsNuts", "Vegetarian" } } // Example with nuts
        };
    }

    public IEnumerable<Recipe> FindRecipes(FamilyProfile family)
    {
        var suitableRecipes = _recipes.Where(recipe =>
            (family.IsVegetarianFamily == false || recipe.DietaryTags.Contains("Vegetarian")) &&
            (!family.Allergies.Contains("Nuts") || !recipe.DietaryTags.Contains("ContainsNuts"))
        ).ToList();

        return suitableRecipes;
    }

    public Recipe GetRandomRecipe(IEnumerable<Recipe> suitableRecipes)
    {
        var recipeList = suitableRecipes.ToList();
        if (!recipeList.Any())
        {
            return null;
        }
        int index = _random.Next(recipeList.Count);
        return recipeList[index];
    }
}
