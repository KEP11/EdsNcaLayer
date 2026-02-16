namespace EdsWebApi.Models;

public sealed class BatchSignResponse
{
    public List<DocumentSignResult> Results { get; set; } = new();
    public int TotalDocuments { get; set; }
    public int SuccessCount { get; set; }
    public int FailedCount { get; set; }
    public string? Message { get; set; }
}

public sealed class DocumentSignResult
{
    public string FileName { get; set; } = string.Empty;
    public string? SignatureBase64 { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}
