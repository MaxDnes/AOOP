using System;
using System.Collections.Generic;
using System.Linq;

namespace DocumentManager;

public class DocumentProcessor
     {
         private readonly ILogger _logger;

         public DocumentProcessor(ILogger logger)
         {
             _logger = logger;
         }

         public bool ProcessSingle(IProcessable document)
         {
              _logger.Log($"Processor attempting to process document {document.DocumentId}...");
               if (document is IValidatable validatableDoc)
               {
                   var errors = validatableDoc.Validate();
                   if(errors.Any())
                   {
                        _logger.Log($"Processor validation failed for {document.DocumentId}.");
                        errors.ForEach(e => _logger.Log($" - Validation Error: {e}"));
                        return false;
                   }
               }
              return document.ProcessDocument();
         }

         public void ProcessBatch(List<IProcessable> documents)
         {
             _logger.Log($"Processor starting batch processing for {documents.Count} documents...");
             int successCount = 0;
             foreach (IProcessable doc in documents)
             {
                 if (ProcessSingle(doc)) { successCount++; }
             }
             _logger.Log($"Processor batch complete. Success: {successCount}/{documents.Count}.");
         }

         public List<string> GenerateSummaries(List<ISummarizable> documents)
         {
              _logger.Log($"Processor generating summaries for {documents.Count} documents...");
              List<string> summaries = new List<string>();
              Console.WriteLine("\n--- Document Summaries (from Processor) ---");
              foreach (ISummarizable doc in documents)
              {
                  string summary = doc.GenerateSummary();
                  Console.WriteLine($"- {summary}");
                  summaries.Add(summary);
              }
              Console.WriteLine("--- End Summaries ---");
              return summaries;
         }
     }