using EdsWebApi.Models;
using EdsWebApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace EdsWebApi.Controllers;

[ApiController]
[Route("api/sign")]
public sealed class SignController(DocumentSignService service) : ControllerBase
{
    /// <summary>
    /// Signs multiple documents in batch using the same certificate
    /// </summary>
    /// <param name="request">Batch sign request containing multiple documents and certificate info</param>
    /// <returns>Batch sign response with results for each document</returns>
    [HttpPost("batch")]
    [RequestSizeLimit(500_000_000)] // 500MB limit for batch operations
    public IActionResult SignDocumentsBatch([FromBody] BatchSignRequest request)
    {
        if (request.Documents.Count == 0)
        {
            return BadRequest(new BatchSignResponse
            {
                Message = "At least one document is required"
            });
        }

        if (string.IsNullOrWhiteSpace(request.KeyStoreBase64))
        {
            return BadRequest(new BatchSignResponse
            {
                Message = "KeyStoreBase64 is required"
            });
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new BatchSignResponse
            {
                Message = "Password is required"
            });
        }

        try
        {
            var result = service.SignDocumentsBatch(request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new BatchSignResponse
            {
                Message = $"Internal error: {ex.Message}",
                TotalDocuments = request.Documents.Count,
                FailedCount = request.Documents.Count
            });
        }
    }

    /// <summary>
    /// Gets certificate information without signing
    /// </summary>
    /// <param name="request">Certificate loading request</param>
    /// <returns>Certificate information</returns>
    [HttpPost("certificate/info")]
    public IActionResult GetCertificateInfo([FromBody] SignRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.KeyStoreBase64))
        {
            return BadRequest(new { message = "KeyStoreBase64 is required" });
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Password is required" });
        }

        try
        {
            var certInfo = service.GetCertificateInfo(
                request.KeyStoreBase64,
                request.Password,
                request.StorageType
            );

            return Ok(certInfo);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Verifies a CMS signature using KalkanAPI
    /// </summary>
    /// <param name="request">Verification request containing CMS signature</param>
    /// <returns>Verification result with certificate info</returns>
    [HttpPost("verify")]
    [RequestSizeLimit(100_000_000)] // 100MB limit
    public IActionResult VerifyCmsSignature([FromBody] VerifyCmsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CmsSignatureBase64))
        {
            return BadRequest(new VerifyCmsResponse
            {
                Success = false,
                Message = "CmsSignatureBase64 is required"
            });
        }

        try
        {
            var result = service.VerifyCmsSignature(
                request.CmsSignatureBase64,
                request.OriginalDocumentBase64,
                request.KeyStoreBase64,
                request.Password,
                request.StorageType
            );

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new VerifyCmsResponse
            {
                Success = false,
                Message = $"Internal error: {ex.Message}"
            });
        }
    }
}
