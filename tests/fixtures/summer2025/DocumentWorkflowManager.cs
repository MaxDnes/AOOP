using System;
using System.Collections.Generic;
using System.Linq;

namespace DocumentManager;

public class DocumentWorkflowManager
{
    private readonly List<object> _allDocuments = new List<object>();
    private readonly ILogger _logger;
    private readonly DocumentProcessor _internalProcessor; 
    public DocumentWorkflowManager(ILogger logger)
    {
        _logger = logger;
        _internalProcessor = new DocumentProcessor(logger);
    }

    public bool RegisterAndProcessDocument(IProcessable document)
    {
        if (document is IDisplayableInfo displayable)
        {
                _logger.Log($"Registering document: {displayable}");
                _allDocuments.Add(document);
        }
        else
        {
            _logger.Log($"Registering processable document (ID: {document.DocumentId})");
                _allDocuments.Add(document);
        }

        _logger.Log("Attempting immediate processing via Workflow Manager...");
        return _internalProcessor.ProcessSingle(document);
    }

    public List<string> RetrieveAllSummaries()
    {
        _logger.Log("Workflow Manager retrieving all available summaries...");
            var summarizables = _allDocuments.OfType<ISummarizable>().ToList();
            return _internalProcessor.GenerateSummaries(summarizables); // Delegates
    }

    public List<T> GetAllDocumentsOfType<T>() where T : class
    {
            return _allDocuments.OfType<T>().ToList();
    }
}