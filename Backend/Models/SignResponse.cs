namespace EdsWebApi.Models;

public sealed class SignResponse
{
    public string? SignatureBase64 { get; set; }
    public string? Message { get; set; }
    public bool Success { get; set; }
    public CertificateInfo? CertificateInfo { get; set; }
}

public sealed class CertificateInfo
{
    public string? Subject { get; set; }
    public string? Issuer { get; set; }
    public string? SerialNumber { get; set; }
    public string? ValidFrom { get; set; }
    public string? ValidTo { get; set; }
}
