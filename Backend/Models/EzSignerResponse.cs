namespace EdsWebApi.Models;

public class VerificationResult
{
    public string? Code { get; set; }
    public string? Message { get; set; }
    public SignatureDocument? ResponseObject { get; set; }
}

public class SignatureDocument
{
    public string? Type { get; set; }
    public string? Date { get; set; }
    public List<SignerInfo> SignerInfos { get; set; } = new();
}

public class SignerInfo
{
    public int Number { get; set; }
    public string? IIN { get; set; }
    public string? Name { get; set; }
    public string? BIN { get; set; }
    public string? OrganizationName { get; set; }
    public string? SerialNumber { get; set; }
    public string? CertificateValidityPeriod { get; set; }
    public string? SignatureAlgorithm { get; set; }
    public string? TspDate { get; set; }
    public string? CheckDate { get; set; }
    public VerificationResultDetail? CertificateVerificationResult { get; set; }
    public VerificationResultDetail? TspVerificationResult { get; set; }
    public VerificationResultDetail? SignatureVerificationResult { get; set; }
    public string? CertTemplateName { get; set; }
    public bool ValidTimestamp { get; set; }
    public bool PersonCertificate { get; set; }
    public bool ValidSignature { get; set; }
}

public class VerificationResultDetail
{
    public string? Message { get; set; }
    public bool Valid { get; set; }
}
