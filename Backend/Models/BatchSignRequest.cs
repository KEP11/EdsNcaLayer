namespace EdsWebApi.Models;

public sealed class BatchSignRequest
{
    public List<DocumentToSign> Documents { get; set; } = new();
    public string KeyStoreBase64 { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string StorageType { get; set; } = "PKCS12";
}

public sealed class DocumentToSign
{
    public string FileName { get; set; } = string.Empty;
    public string DocumentBase64 { get; set; } = string.Empty;
}
