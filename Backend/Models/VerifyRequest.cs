namespace EdsWebApi.Models;

public sealed class VerifyRequest
{
    public string SignatureBase64 { get; set; } = string.Empty;
    public string? FileName { get; set; }
}