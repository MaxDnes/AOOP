namespace FamilyMealPlanner;

public class Program
{
    public static void Main(string[] args)
    {
        // 1. Define the family's dietary needs.
        var family = new FamilyProfile
        {
            IsVegetarianFamily = false, 
            Allergies = new List<string> { "Nuts" }
        };

        // 2. Setup Dependencies 
        IRecipeFinder recipeRepo = new InMemoryRecipeRepository();
        INotifier notifier = new ConsoleNotifier();
        ShoppingListGenerator shoppingListGenerator = new ShoppingListGenerator();
        
        var rules = new List<IDietaryRule>
        {
            new VegetarianRule(),
            new NutAllergyRule()
        };

        // 3. Create the main application service
        var planner = new MealPlanner(recipeRepo, notifier, rules);

        // 4. Run the application logic.
        var plan = planner.GenerateMealPlan(family, 7); 

        if (plan.Any())
        {
            Console.WriteLine("\n--- Your Weekly Meal Plan ---");
            string[] daysOfWeek = { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" };
            
            for (int i = 0; i < plan.Count; i++)
            {
                if (i < daysOfWeek.Length) 
                {
                    Console.WriteLine($"- {daysOfWeek[i]}: {plan[i].Name}");
                }
                else
                {
                    Console.WriteLine($"- Extra Meal {i + 1}: {plan[i].Name}"); 
                }
            }
            
            var shoppingList = shoppingListGenerator.Generate(plan);

            Console.WriteLine("\n--- Your Shopping List ---");
            shoppingList.ForEach(item => Console.WriteLine($"- {item}"));
        }
        else
        {
            Console.WriteLine("\n--- Could not generate a weekly meal plan with the given constraints. ---");
        }
        
        Console.WriteLine("\n--- End of program ---");
    }
}
