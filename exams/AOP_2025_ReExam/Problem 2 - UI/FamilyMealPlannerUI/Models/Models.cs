namespace FamilyMealPlannerUI.Models;

using System;
using System.Collections.Generic;
using CommunityToolkit.Mvvm.ComponentModel;

public class Recipe : ObservableObject
{
    public string Name { get; set; } = string.Empty;
    public List<string> Ingredients { get; set; } = new List<string>();
    public List<string> DietaryTags { get; set; } = new List<string>();
}

public class FamilyProfile
{
    public bool IsVegetarianFamily { get; set; }
    public bool IsVeganFamily { get; set; }
    public List<string> Allergies { get; set; } = new List<string>();
}
