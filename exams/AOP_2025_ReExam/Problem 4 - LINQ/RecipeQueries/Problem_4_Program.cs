namespace RecipeQueries;

using System.IO;
using System.Text.Json;
using System.Collections.Generic;

internal class Program
{
    public static void Main()
    {
        List<Recipe> recipes = JsonSerializer.Deserialize<List<Recipe>>(File.ReadAllText("recipes.json"));
    }
}

