namespace EdsWebApi.Models;

public sealed class SignRequest
{
    public string DocumentBase64 { get; set; } = string.Empty;
    public string KeyStoreBase64 { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string StorageType { get; set; } = "PKCS12"; // PKCS12, JKS, etc.
}
