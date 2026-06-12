using System;
using System.Collections.Generic;

namespace DocumentManager;

class Program
{
    static void Main(string[] args)
    {
        ILogger logger = new ConsoleLogger();
        DocumentWorkflowManager docManager = new DocumentWorkflowManager(logger); 

        var invoice1 = new Invoice("INV-001", DateTime.Today.AddDays(30),
            new List<InvoiceLineItem> {
                new InvoiceLineItem { Description = "Widget A", Amount = 100 },
                new InvoiceLineItem { Description = "Service B", Amount = 250 }
            }, logger);

        var report1 = new Report("Q1 Sales Report", "Alice",
            new List<string> { "Introduction", "Sales Data", "Conclusion" }, logger);

        logger.Log("\n--- Adding and Processing via Manager ---");
        docManager.RegisterAndProcessDocument(invoice1);
        docManager.RegisterAndProcessDocument(report1);

        logger.Log("\n--- Getting All Summaries via Manager ---");
        List<string> summaries = docManager.RetrieveAllSummaries();

        
        List<IValidatable> validatables = docManager.GetAllDocumentsOfType<IValidatable>();
        Console.WriteLine($"\nFound {validatables.Count} validatable documents via Manager.");
    }
}