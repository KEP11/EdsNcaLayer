using EdsWebApi.Models;

namespace EdsWebApi.Services;

public interface IDocumentSignService
{
    /// <summary>
    /// Signs multiple documents in batch using the same certificate
    /// </summary>
    /// <param name="request">Batch sign request containing documents and key info</param>
    /// <returns>Batch sign response with individual results</returns>
    BatchSignResponse SignDocumentsBatch(BatchSignRequest request);

    /// <summary>
    /// Gets certificate information from a keystore
    /// </summary>
    /// <param name="keyStoreBase64">Keystore file in base64 format</param>
    /// <param name="password">Keystore password</param>
    /// <param name="storageType">Storage type (PKCS12, etc.)</param>
    /// <returns>Certificate information</returns>
    CertificateInfo GetCertificateInfo(string keyStoreBase64, string password, string storageType = "PKCS12");

    /// <summary>
    /// Verifies a CMS signature
    /// </summary>
    /// <param name="cmsSignatureBase64">CMS signature in base64 format</param>
    /// <param name="originalDocumentBase64">Original document in base64 format (optional for detached signatures)</param>
    /// <param name="keyStoreBase64">Optional: Keystore for verification</param>
    /// <param name="password">Optional: Keystore password</param>
    /// <param name="storageType">Optional: Storage type</param>
    /// <returns>Verification response with status and certificate info</returns>
    VerifyCmsResponse VerifyCmsSignature(
        string cmsSignatureBase64,
        string? originalDocumentBase64 = null,
        string? keyStoreBase64 = null,
        string? password = null,
        string? storageType = null);
}
