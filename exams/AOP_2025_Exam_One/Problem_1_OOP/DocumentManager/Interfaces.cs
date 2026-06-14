using System;
using System.Collections.Generic;

namespace DocumentManager;
public interface IDisplayableInfo {}

public interface IProcessable
{
    Guid DocumentId { get; }
    bool ProcessDocument();
}

public interface ISummarizable
{
    string GenerateSummary();
}

public interface IValidatable
{
    List<string> Validate();
}

