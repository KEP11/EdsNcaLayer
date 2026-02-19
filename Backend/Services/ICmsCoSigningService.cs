using NKalkan;

namespace EdsWebApi.Services;

public interface ICmsCoSigningService
{
    /// <summary>
    /// Adds a co-signature to an existing CMS signed document using hybrid SDK+BouncyCastle approach
    /// </summary>
    /// <param name="kalkanApi">KalkanApi instance with loaded keystore</param>
    /// <param name="existingCmsBase64">Existing CMS signature in base64 format</param>
    /// <param name="originalData">Original document data to sign</param>
    /// <returns>New CMS signature with added co-signature in base64 format</returns>
    string AddCoSignature(KalkanApi kalkanApi, string existingCmsBase64, byte[] originalData);
}
