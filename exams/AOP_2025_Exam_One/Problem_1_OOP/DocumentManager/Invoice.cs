using System;
using System.Collections.Generic;
using System.Linq;

namespace DocumentManager;

public class Invoice : IProcessable, ISummarizable, IValidatable, IDisplayableInfo
{
    public Guid DocumentId { get; } = Guid.NewGuid(); 
    public string InvoiceNumber { get; private set; }
    public DateTime DueDate { get; private set; }
    public decimal TotalAmount => LineItems.Sum(item => item.Amount);
    public bool IsPaid { get; private set; } = false;
    public List<InvoiceLineItem> LineItems { get; private set; }

    private readonly ILogger _logger;

    public Invoice(string invoiceNumber, DateTime dueDate, List<InvoiceLineItem> items, ILogger logger)
    {
        InvoiceNumber = invoiceNumber;
        DueDate = dueDate;
        LineItems = items ?? new List<InvoiceLineItem>();
        _logger = logger;
    }

    public bool ProcessDocument()
    {
        _logger.Log($"Processing Invoice {InvoiceNumber}...");
        var errors = Validate();
        if (errors.Any())
        {
            _logger.Log($"Validation failed for Invoice {InvoiceNumber}. Cannot process.");
            errors.ForEach(e => _logger.Log($" - Error: {e}"));
            return false;
        }
        Console.WriteLine($"Simulating: Sending Invoice {InvoiceNumber} for {TotalAmount:C}.");
        _logger.Log($"Invoice {InvoiceNumber} processed successfully.");
        return true;
    }

    public string GenerateSummary()
    {
        return $"Invoice Summary: Number='{InvoiceNumber}', Amount='{TotalAmount:C}', Paid='{IsPaid}'";
    }

    public List<string> Validate()
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(InvoiceNumber)) errors.Add("Invoice number empty.");
        if (DueDate < DateTime.Today) errors.Add("Due date in past.");
        if (!LineItems.Any()) errors.Add("No line items.");
        return errors;
    }

    public override string ToString() => $"Invoice: {InvoiceNumber} (Due: {DueDate:d})";

    public void MarkAsPaid() { IsPaid = true; _logger.Log($"Invoice {InvoiceNumber} marked paid."); }
}

public class InvoiceLineItem
{
    public string Description { get; set; } = "";
    public decimal Amount { get; set; }
}