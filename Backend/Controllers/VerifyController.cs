using EdsWebApi.Models;
using EdsWebApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace EdsWebApi.Controllers;

[ApiController]
[Route("api/verify")]
public sealed class VerifyController(SignatureVerifyService service) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(100_000_000)] // 100MB limit for document verification
    public async Task<IActionResult> Verify(VerifyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SignatureBase64))
        {
            return BadRequest(new VerificationResult
            {
                Code = "400",
                Message = "SignatureBase64 is required"
            });
        }

        try
        {
            // Convert Base64 strings to bytes
            var signatureBytes = Convert.FromBase64String(request.SignatureBase64);
            
            // Verify using ezsigner.kz API
            var result = await service.VerifySignatureAsync(signatureBytes, request.FileName);
            
            return Ok(result);
        }
        catch (FormatException)
        {
            return BadRequest(new VerificationResult
            {
                Code = "400",
                Message = "Invalid Base64 encoding in DocumentBase64 or SignatureBase64"
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new VerificationResult
            {
                Code = "500",
                Message = $"Verification error: {ex.Message}"
            });
        }
    }

    [HttpPost("extract")]
    [RequestSizeLimit(100_000_000)] // 100MB limit for extraction
    public async Task<IActionResult> ExtractDocument([FromBody] ExtractRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SignatureBase64))
        {
            return BadRequest(new { code = "400", message = "SignatureBase64 is required" });
        }

        try
        {
            // Convert Base64 to bytes
            var signatureBytes = Convert.FromBase64String(request.SignatureBase64);
            
            // Extract document from CMS using ezsigner.kz API
            var documentBase64 = await service.ExtractDocumentFromCMSAsync(signatureBytes);
            
            return Ok(new { documentBase64 });
        }
        catch (FormatException)
        {
            return BadRequest(new { code = "400", message = "Invalid Base64 encoding in SignatureBase64" });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(500, new { code = "500", message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { code = "500", message = $"Extraction error: {ex.Message}" });
        }
    }
}