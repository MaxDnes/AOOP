using System;
using System.Collections.Generic;

namespace DocumentManager;

public class Report : IProcessable, ISummarizable, IDisplayableInfo
{
    public Guid DocumentId { get; } = Guid.NewGuid(); 
    public string Title { get; private set; }
    public string Author { get; private set; }
    public List<string> Sections { get; private set; }

    private readonly ILogger _logger;

    public Report(string title, string author, List<string> sections, ILogger logger)
    {
        Title = title;
        Author = author;
        Sections = sections ?? new List<string>();
        _logger = logger;
    }

    public bool ProcessDocument()
    {
            _logger.Log($"Processing Report '{Title}'...");
            Console.WriteLine($"Simulating: Distributing Report '{Title}' by {Author}.");
            _logger.Log($"Report '{Title}' processed successfully.");
            return true;
    }

    public string GenerateSummary()
    {
        return $"Report Summary: Title='{Title}', Author='{Author}', Sections='{Sections.Count}'";
    }

    public override string ToString() => $"Report: {Title} by {Author}";
}