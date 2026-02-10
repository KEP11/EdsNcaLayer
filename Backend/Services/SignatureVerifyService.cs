using EdsWebApi.Models;
using System.Text.Json;

namespace EdsWebApi.Services;

public sealed class SignatureVerifyService(HttpClient httpClient)
{
    private const string EzSignerApiUrl = "https://ezsigner.kz/";

    /// <summary>
    /// Verifies a CMS signature using ezsigner.kz API
    /// </summary>
    /// <param name="signatureBytes">CMS signature bytes (.cms file)</param>
    /// <param name="fileName">Original document file name from a client</param>
    /// <returns>Structured verification result from ezsigner.kz API</returns>
    public async Task<VerificationResult> VerifySignatureAsync(byte[] signatureBytes, string? fileName = null)
    {
        try
        {
            var response = await EzSignerRequestAsync(signatureBytes, "checkSign", fileName);
            var responseText = await response.Content.ReadAsStringAsync();
            
            if (!response.IsSuccessStatusCode)
            {
                return new VerificationResult
                {
                    Code = response.StatusCode.ToString(),
                    Message = $"API error: {response.StatusCode}",
                    ResponseObject = null
                };
            }

            var apiResponse = JsonSerializer.Deserialize<VerificationResult>(responseText, new JsonSerializerOptions{ PropertyNameCaseInsensitive = true });
            
            return apiResponse ?? new VerificationResult
            {
                Code = "500",
                Message = "Failed to parse API response",
                ResponseObject = null
            };
        }
        catch (HttpRequestException ex)
        {
            return new VerificationResult
            {
                Code = "500",
                Message = $"Network error: {ex.Message}",
                ResponseObject = null
            };
        }
        catch (Exception ex)
        {
            return new VerificationResult
            {
                Code = "500",
                Message = $"Verification error: {ex.Message}",
                ResponseObject = null
            };
        }
    }

    /// <summary>
    /// Extracts original document from CMS signature using ezsigner.kz API
    /// </summary>
    /// <param name="signatureBytes">CMS signature bytes (.cms file)</param>
    /// <returns>Base64 encoded original document bytes</returns>
    public async Task<string> ExtractDocumentFromCMSAsync(byte[] signatureBytes)
    {
        try
        {
            var response = await EzSignerRequestAsync(signatureBytes, "extractSrc");

            // The response content is the extracted document bytes
            var documentBytes = await response.Content.ReadAsByteArrayAsync();

            // Return as base64 for frontend
            return Convert.ToBase64String(documentBytes);
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException($"Failed to extract document from CMS: {ex.Message}", ex);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Extraction error: {ex.Message}", ex);
        }
    }

    private async Task<HttpResponseMessage> EzSignerRequestAsync(byte[] signatureBytes, string endpoint, string? fileName = null)
    {
        using var content = new MultipartFormDataContent();
        using var fileStreamContent = new StreamContent(new MemoryStream(signatureBytes));
        var signFileName = !string.IsNullOrWhiteSpace(fileName) ? fileName + ".cms" : "signature.cms";
        content.Add(fileStreamContent, "signData", signFileName);
        
        var response = await httpClient.PostAsync($"{EzSignerApiUrl}{endpoint}", content);
            
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Failed to extract document: {response.StatusCode}");
        }

        return response;
    }
}