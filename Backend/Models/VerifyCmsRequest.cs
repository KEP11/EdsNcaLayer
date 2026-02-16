namespace EdsWebApi.Models;

public sealed class VerifyCmsRequest
{
    public string CmsSignatureBase64 { get; set; } = string.Empty;
    public string? OriginalDocumentBase64 { get; set; }
    
    // Optional keystore parameters for verification
    public string? KeyStoreBase64 { get; set; }
    public string? Password { get; set; }
    public string? StorageType { get; set; }
}

public sealed class VerifyCmsResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? VerificationInfo { get; set; }

    public CertificateInfo? SignerCertificate { get; set; }

    public string? ResultData { get; set; }
}
