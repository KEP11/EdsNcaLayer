using System.Text;
using EdsWebApi.Models;
using NKalkan;

namespace EdsWebApi.Services;

public sealed class DocumentSignService : IDocumentSignService
{
    private readonly ILogger<DocumentSignService> _logger;
    private readonly ICmsCoSigningService _coSigningService;
    private readonly KalkanApi _kalkanApi;

    public DocumentSignService(ILogger<DocumentSignService> logger, ICmsCoSigningService coSigningService)
    {
        _logger = logger;
        _coSigningService = coSigningService;
        _kalkanApi = new KalkanApi();
        _kalkanApi.SetTSAUrl("http://tsp.pki.gov.kz");
    }

    /// <summary>
    /// Signs multiple documents in batch using the same certificate
    /// </summary>
    /// <param name="request">Batch sign request containing documents and key info</param>
    /// <returns>Batch sign response with individual results</returns>
    public BatchSignResponse SignDocumentsBatch(BatchSignRequest request)
    {
        var response = new BatchSignResponse
        {
            TotalDocuments = request.Documents.Count,
            Results = new List<DocumentSignResult>()
        };

        try
        {
            var kalkanStorageType = ParseStorageType(request.StorageType);
            _kalkanApi.LoadKeyStoreFromBase64(kalkanStorageType, request.KeyStoreBase64, request.Password);

            foreach (var doc in request.Documents)
            {
                var result = new DocumentSignResult
                {
                    FileName = doc.FileName
                };

                try
                {
                    var documentBytes = Convert.FromBase64String(doc.DocumentBase64);

                    if (IsCmsSignature(doc.DocumentBase64))
                    {
                        result.SignatureBase64 = AddCoSignature(doc.DocumentBase64);
                        result.Success = true;
                        response.SuccessCount++;
                    }
                    else
                    {
                        var signFlags = KalkanSignFlags.SignCms | KalkanSignFlags.WithTimestamp | KalkanSignFlags.OutputBase64;
                        result.SignatureBase64 = _kalkanApi.SignData(documentBytes, signFlags);
                        result.Success = true;
                        response.SuccessCount++;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error signing document {FileName}", doc.FileName);
                    result.Success = false;
                    result.ErrorMessage = ex.Message;
                    response.FailedCount++;
                }

                response.Results.Add(result);
            }

            response.Message = $"Batch signing completed. Success: {response.SuccessCount}, Failed: {response.FailedCount}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in batch signing operation");
            response.Message = $"Batch signing error: {ex.Message}";
            
            // Mark all documents as failed if keystore loading fails
            foreach (var doc in request.Documents.Where(doc => response.Results.All(r => r.FileName != doc.FileName)))
            {
                response.Results.Add(new DocumentSignResult
                {
                    FileName = doc.FileName,
                    Success = false,
                    ErrorMessage = ex.Message
                });
                response.FailedCount++;
            }
        }

        return response;
    }

    /// <summary>
    /// Loads certificate and returns its information without signing
    /// </summary>
    /// <param name="keyStoreBase64">Base64 encoded keystore</param>
    /// <param name="password">Password for the keystore</param>
    /// <param name="storageType">Type of storage</param>
    /// <returns>Certificate information</returns>
    public CertificateInfo GetCertificateInfo(string keyStoreBase64, string password, string storageType = "PKCS12")
    {
        try
        {
            var kalkanStorageType = ParseStorageType(storageType);

            _kalkanApi.LoadKeyStoreFromBase64(kalkanStorageType, keyStoreBase64, password);
            var certificate = _kalkanApi.ExportCertificateFromStore();

            return ExtractCertificateInfo(_kalkanApi, certificate);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting certificate info");
            
            // Provide helpful error message for common issues
            var errorMessage = ex.Message;
            if (errorMessage.Contains("0x8f00040") || errorMessage.Contains("not found root or intermediate certificate"))
            {
                errorMessage = "Root/intermediate certificates not installed. Please install Kazakhstan PKI root certificates from https://pki.gov.kz/. Error: " + ex.Message;
            }
            else if (errorMessage.Contains("password") || errorMessage.Contains("0x03"))
            {
                errorMessage = "Invalid password or corrupted keystore file.";
            }
            
            throw new InvalidOperationException(errorMessage, ex);
        }
    }

    /// <summary>
    /// Verifies a CMS signature using KalkanAPI with comprehensive diagnostic logging and fallback support
    /// </summary>
    /// <param name="cmsSignatureBase64">Base64 or PEM encoded CMS signature</param>
    /// <param name="originalDocumentBase64">Optional: Original document for detached signatures</param>
    /// <param name="keyStoreBase64">Optional: Keystore for verification</param>
    /// <param name="password">Optional: Keystore password</param>
    /// <param name="storageType">Optional: Storage type</param>
    /// <returns>Verification response with result and certificate info</returns>
    public VerifyCmsResponse VerifyCmsSignature(
        string cmsSignatureBase64, 
        string? originalDocumentBase64 = null,
        string? keyStoreBase64 = null,
        string? password = null,
        string? storageType = null)
    {
        try
        {
            // Log signature format for diagnostics
            var hasPemHeaders = cmsSignatureBase64.Contains("-----BEGIN");
            _logger.LogInformation("Signature format: {Format}", hasPemHeaders ? "PEM" : "Base64");

            if (!string.IsNullOrWhiteSpace(keyStoreBase64) && !string.IsNullOrWhiteSpace(password))
            {
                var storageTypeEnum = ParseStorageType(storageType ?? "PKCS12");
                _kalkanApi.LoadKeyStoreFromBase64(storageTypeEnum, keyStoreBase64, password);
                _logger.LogInformation("Keystore loaded for verification");
            }

            try
            {
                // Determine if signature has PEM headers or is pure base64
                var signatureForVerification = cmsSignatureBase64;
                
                // If has PEM headers, extract the base64 content
                if (hasPemHeaders)
                {
                    _logger.LogInformation("Signature has PEM headers, extracting base64 content");
                    // Extract base64 content between PEM headers
                    var lines = cmsSignatureBase64.Split('\n');
                    var base64Lines = lines.Where(line => 
                        !line.Contains("-----BEGIN") && 
                        !line.Contains("-----END") && 
                        !string.IsNullOrWhiteSpace(line)).ToArray();
                    signatureForVerification = string.Join("", base64Lines);
                    _logger.LogInformation("Extracted {Length} chars of base64", signatureForVerification.Length);
                }
                else
                {
                    _logger.LogInformation("Signature is pure base64, using as-is");
                }
                
                // Decode original document if provided
                var documentBytes = !string.IsNullOrWhiteSpace(originalDocumentBase64) 
                    ? Convert.FromBase64String(originalDocumentBase64) 
                    : [];

                _logger.LogInformation("Original document: {HasDoc}", documentBytes.Length > 0 ? "Present" : "Detached");

                // Use Base64 input format for CMS signature (already extracted from PEM if needed)
                var flags = KalkanSignFlags.InputBase64 | KalkanSignFlags.OutputPem | KalkanSignFlags.SignCms;
                
                if (documentBytes.Length == 0)
                {
                    _logger.LogInformation("Attempting attached signature verification");
                }
                else
                {
                    _logger.LogInformation("Attempting detached signature verification");
                    flags |= KalkanSignFlags.DetachedData;
                }

                try
                {
                    var verificationInfo = _kalkanApi.VerifyData(documentBytes, signatureForVerification, flags, out var data);
                    
                    _logger.LogInformation("Signature verification successful");
                    
                    return new VerifyCmsResponse
                    {
                        Success = true,
                        Message = "Signature verified successfully",
                        VerificationInfo = verificationInfo,
                        ResultData = data?.ToString()
                    };
                }
                catch (InvalidOperationException ex) when (ex.Message.Contains("UNKNOWN_CMS_FORMAT") || ex.Message.Contains("encode error"))
                {
                    _logger.LogWarning("Standard verification failed: {Error}, attempting alternative approaches", ex.Message);
                    
                    // Try different flag combinations that might work with this CMS format
                    var flagCombinations = new[]
                    {
                        // Try without time check
                        KalkanSignFlags.SignCms | KalkanSignFlags.InputBase64 | KalkanSignFlags.OutputPem | KalkanSignFlags.DoNotCheckCertificateTime,
                        
                        // Try with DER format (binary signature)
                        KalkanSignFlags.SignCms | KalkanSignFlags.InputDer | KalkanSignFlags.OutputDer,
                        
                        // Try with attached data assumption
                        KalkanSignFlags.SignCms | KalkanSignFlags.InputBase64 | KalkanSignFlags.OutputPem,
                    };

                    foreach (var altFlags in flagCombinations)
                    {
                        try
                        {
                            _logger.LogInformation("Trying verification with flags: {Flags}", altFlags);
                            
                            var altVerificationInfo = _kalkanApi.VerifyData(documentBytes, signatureForVerification, altFlags, out var data);
                            
                            _logger.LogInformation("Signature verification successful with alternative flags: {Flags}", altFlags);
                            
                            return new VerifyCmsResponse
                            {
                                Success = true,
                                Message = $"Signature verified successfully (using alternative method)",
                                VerificationInfo = altVerificationInfo,
                                ResultData = data?.ToString()
                            };
                        }
                        catch (Exception altEx)
                        {
                            _logger.LogDebug(altEx, "Alternative verification failed with flags: {Flags}", altFlags);
                            // Continue to next flag combination
                        }
                    }
                    
                    // All attempts failed, throw original exception
                    _logger.LogError("All verification attempts failed for CMS signature");
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying CMS signature");
            
                var errorMessage = ex.Message;
                if (errorMessage.Contains("0x8f00040") || errorMessage.Contains("not found root or intermediate certificate"))
                {
                    errorMessage = "Root/intermediate certificates not installed. Please install Kazakhstan PKI root certificates from https://pki.gov.kz/";
                }
                else if (errorMessage.Contains("0x1f") || errorMessage.Contains("signature"))
                {
                    errorMessage = "Invalid signature or signature verification failed.";
                }
                else if (errorMessage.Contains("UNKNOWN_CMS_FORMAT"))
                {
                    errorMessage = "Unsupported CMS signature format. The signature format is not recognized by NKalkan library. " +
                                   "This may indicate that the signature was created with a different tool or format that is incompatible with NKalkan. " +
                                   "Please verify the signature was created using a compatible signing method.";
                }
                
                return new VerifyCmsResponse
                {
                    Success = false,
                    Message = errorMessage,
                    VerificationInfo = null
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying CMS signature");
            return new VerifyCmsResponse
            {
                Success = false,
                Message = ex.Message,
                VerificationInfo = null
            };
        }
    }

    private CertificateInfo ExtractCertificateInfo(KalkanApi kalkanApi, string certificate) =>
        new()
        {
            Subject = kalkanApi.GetCertificateProperty(certificate, KalkanCertificateProperty.SubjectCommonName),
            Issuer = kalkanApi.GetCertificateProperty(certificate, KalkanCertificateProperty.IssuerCommonName),
            SerialNumber = kalkanApi.GetCertificateProperty(certificate, KalkanCertificateProperty.SubjectSerialNumber),
            ValidFrom = kalkanApi.GetCertificateProperty(certificate, KalkanCertificateProperty.NotBefore),
            ValidTo = kalkanApi.GetCertificateProperty(certificate, KalkanCertificateProperty.NotAfter)
        };

    private KalkanStorageType ParseStorageType(string storageType) =>
        storageType.ToUpperInvariant() switch
        {
            "PKCS12" => KalkanStorageType.PKCS12,
            "KAZTOKEN" => KalkanStorageType.KazToken,
            _ => KalkanStorageType.PKCS12
        };

    private bool IsCmsSignature(string base64Data)
    {
        try
        {
            if (base64Data.Contains("-----BEGIN CMS-----") || base64Data.Contains("-----BEGIN PKCS7-----"))
            {
                return true;
            }

            // Clean the Base64 string to handle whitespace, newlines, etc.
            var cleanedBase64 = base64Data
                .Replace("\r", "")
                .Replace("\n", "")
                .Replace(" ", "")
                .Replace("\t", "");
                
            var data = Convert.FromBase64String(cleanedBase64);

            if (data.Length < 1024 || data[0] != 0x30)
            {
                return false;
            }

            var pkcs7Oid = new byte[] { 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x07 };
            var searchLimit = Math.Min(100, data.Length - pkcs7Oid.Length);

            for (var i = 0; i < searchLimit; i++)
            {
                var match = true;
                for (var j = 0; j < pkcs7Oid.Length; j++)
                {
                    if (data[i + j] != pkcs7Oid[j])
                    {
                        match = false;
                        break;
                    }
                }
                if (match)
                {
                    return true;
                }
            }

            return false;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Wraps base64 content to specified line length (PEM standard is 64 characters)
    /// </summary>
    private static string WrapBase64Content(string base64Content, int lineLength = 64)
    {
        if (string.IsNullOrEmpty(base64Content))
            return base64Content;

        var result = new StringBuilder();
        for (var i = 0; i < base64Content.Length; i += lineLength)
        {
            if (i > 0)
                result.Append('\n');
            
            var length = Math.Min(lineLength, base64Content.Length - i);
            result.Append(base64Content, i, length);
        }
        return result.ToString();
    }

    private string AddCoSignature(string existingCmsBase64)
    {
        _logger.LogInformation("Adding co-signature to existing CMS");

        // Clean the Base64 string to handle whitespace, newlines, etc.
        var cleanedBase64 = existingCmsBase64
            .Replace("\r", "")
            .Replace("\n", "")
            .Replace(" ", "")
            .Replace("\t", "");

        var existingSignaturePem = PrepareSignatureForVerification(cleanedBase64);
        var originalData = ExtractOriginalData(existingSignaturePem);

        return _coSigningService.AddCoSignature(_kalkanApi, cleanedBase64, originalData);
    }

    private string PrepareSignatureForVerification(string cmsBase64)
    {
        if (cmsBase64.Contains("-----BEGIN"))
            return cmsBase64;

        var wrappedBase64 = WrapBase64Content(cmsBase64, 64);
        return $"-----BEGIN CMS-----\n{wrappedBase64}\n-----END CMS-----";
    }

    private byte[] ExtractOriginalData(string signaturePem)
    {
        var verifyFlags = KalkanSignFlags.SignCms | KalkanSignFlags.InputPem | KalkanSignFlags.OutputBase64;
        _kalkanApi.VerifyData([], signaturePem, verifyFlags, out var extractedData, out _);

        if (extractedData is not { Length: > 0 })
            throw new InvalidOperationException("Cannot extract original data from CMS");

        var base64String = extractedData.ToString().Trim('\0');
        return Convert.FromBase64String(base64String);
    }
}
