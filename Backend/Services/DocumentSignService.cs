using EdsWebApi.Models;
using NKalkan;

namespace EdsWebApi.Services;

public sealed class DocumentSignService
{
    private readonly ILogger<DocumentSignService> _logger;
    private KalkanApi _kalkanApi;

    public DocumentSignService(ILogger<DocumentSignService> logger)
    {
        _logger = logger;
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

            // Sign each document
            foreach (var doc in request.Documents)
            {
                var result = new DocumentSignResult
                {
                    FileName = doc.FileName
                };

                try
                {
                    var documentBytes = Convert.FromBase64String(doc.DocumentBase64);

                    var inputFormat = KalkanInputFormat.Pem | KalkanInputFormat.Base64 | KalkanInputFormat.Der;
                    var outputFormat = KalkanOutputFormat.Pem | KalkanOutputFormat.Base64;
                    var signedData = _kalkanApi.SignData(documentBytes, KalkanSignType.Cms, inputFormat, outputFormat);

                    result.SignatureBase64 = signedData;
                    result.Success = true;
                    response.SuccessCount++;
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
            foreach (var doc in request.Documents)
            {
                if (response.Results.All(r => r.FileName != doc.FileName))
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
    public CertificateInfo GetCertificateInfo(
        string keyStoreBase64,
        string password,
        string storageType = "PKCS12")
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
            bool hasPemHeaders = cmsSignatureBase64.Contains("-----BEGIN");
            _logger.LogInformation("Signature format: {Format}", hasPemHeaders ? "PEM" : "Base64");
            
            // Optionally load keystore if provided
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
                var inputFormat = KalkanInputFormat.Base64;
                
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
                byte[] documentBytes = !string.IsNullOrWhiteSpace(originalDocumentBase64) 
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

    private CertificateInfo ExtractCertificateInfo(KalkanApi kalkanApi, string certificate)
    {
        return new CertificateInfo
        {
            Subject = kalkanApi.GetCertificateProperty(certificate, KalkanCertificateProperty.SubjectCommonName),
            Issuer = kalkanApi.GetCertificateProperty(certificate, KalkanCertificateProperty.IssuerCommonName),
            SerialNumber = kalkanApi.GetCertificateProperty(certificate, KalkanCertificateProperty.SubjectSerialNumber),
            ValidFrom = kalkanApi.GetCertificateProperty(certificate, KalkanCertificateProperty.NotBefore),
            ValidTo = kalkanApi.GetCertificateProperty(certificate, KalkanCertificateProperty.NotAfter)
        };
    }

    private KalkanStorageType ParseStorageType(string storageType)
    {
        return storageType.ToUpperInvariant() switch
        {
            "PKCS12" => KalkanStorageType.PKCS12,
            "KAZTOKEN" => KalkanStorageType.KazToken,
            _ => KalkanStorageType.PKCS12
        };
    }
}
