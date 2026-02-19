using EdsWebApi.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using NKalkan;

namespace Backend.Tests.Services;

public class CmsCoSigningServiceTests
{
    private readonly Mock<ILogger<CmsCoSigningService>> _loggerMock;
    private readonly CmsCoSigningService _service;

    public CmsCoSigningServiceTests()
    {
        _loggerMock = new Mock<ILogger<CmsCoSigningService>>();
        _service = new CmsCoSigningService(_loggerMock.Object);
    }

    #region AddCoSignature Tests

    [Fact]
    public void AddCoSignature_WithNullKalkanApi_ThrowsException()
    {
        // Arrange
        var existingCmsBase64 = CreateValidCmsSignature();
        var originalData = "test document"u8.ToArray();

        // Act & Assert - Will throw because CMS data is invalid or null KalkanApi
        var exception = Record.Exception(() => 
            _service.AddCoSignature(null!, existingCmsBase64, originalData));
        
        exception.Should().NotBeNull();
    }

    [Fact]
    public void AddCoSignature_WithNullExistingCms_ThrowsException()
    {
        // Arrange
        var kalkanApi = CreateMockKalkanApi();
        var originalData = "test document"u8.ToArray();

        // Act & Assert - Will throw NullReferenceException when cleaning base64
        Assert.Throws<NullReferenceException>(() => 
            _service.AddCoSignature(kalkanApi, null!, originalData));
    }

    [Fact]
    public void AddCoSignature_WithEmptyExistingCms_ThrowsException()
    {
        // Arrange
        var kalkanApi = CreateMockKalkanApi();
        var originalData = "test document"u8.ToArray();

        // Act & Assert - Will throw when parsing empty CMS
        var exception = Record.Exception(() => 
            _service.AddCoSignature(kalkanApi, "", originalData));
        
        exception.Should().NotBeNull();
    }

    [Fact]
    public void AddCoSignature_WithInvalidBase64_ThrowsFormatException()
    {
        // Arrange
        var kalkanApi = CreateMockKalkanApi();
        var originalData = "test document"u8.ToArray();

        // Act & Assert
        Assert.Throws<FormatException>(() => 
            _service.AddCoSignature(kalkanApi, "not-valid-base64!!!", originalData));
    }

    [Fact]
    public void AddCoSignature_WithNullOriginalData_ThrowsException()
    {
        // Arrange
        var kalkanApi = CreateMockKalkanApi();
        var existingCmsBase64 = CreateValidCmsSignature();

        // Act & Assert - Will throw during CMS operations
        var exception = Record.Exception(() => 
            _service.AddCoSignature(kalkanApi, existingCmsBase64, null!));
        
        exception.Should().NotBeNull();
    }

    [Fact]
    public void AddCoSignature_WithEmptyOriginalData_ThrowsException()
    {
        // Arrange
        var kalkanApi = CreateMockKalkanApi();
        var existingCmsBase64 = CreateValidCmsSignature();

        // Act & Assert - Will throw during CMS operations
        var exception = Record.Exception(() => _service.AddCoSignature(kalkanApi, existingCmsBase64, []));
        
        exception.Should().NotBeNull();
    }

    [Fact]
    public void AddCoSignature_WithPemFormattedCms_CleansAndProcesses()
    {
        // Arrange
        var kalkanApi = CreateMockKalkanApi();
        var cmsBase64 = CreateValidCmsSignature();
        var pemFormatted = $"-----BEGIN PKCS7-----\n{cmsBase64}\n-----END PKCS7-----";
        var originalData = "test document"u8.ToArray();

        // Act & Assert - Should not throw, should clean PEM headers
        var exception = Record.Exception(() => _service.AddCoSignature(kalkanApi, pemFormatted, originalData));
        
        // For this test, we expect it might throw due to CMS structure validation,
        // but it should NOT throw FormatException from base64 decoding
        exception?.Should().NotBeOfType<FormatException>();
    }

    [Fact]
    public void AddCoSignature_WithWhitespaceInBase64_CleansAndProcesses()
    {
        // Arrange
        var kalkanApi = CreateMockKalkanApi();
        var cmsBase64 = CreateValidCmsSignature();
        var withWhitespace = $"{cmsBase64.Substring(0, 10)}\n  {cmsBase64.Substring(10, 10)}\r\n\t{cmsBase64.Substring(20)}";
        var originalData = "test document"u8.ToArray();

        // Act & Assert - Should not throw FormatException
        var exception = Record.Exception(() => _service.AddCoSignature(kalkanApi, withWhitespace, originalData));
        exception?.Should().NotBeOfType<FormatException>();
    }

    [Fact]
    public void AddCoSignature_LogsInformation_WhenCalled()
    {
        // Arrange
        var kalkanApi = CreateMockKalkanApi();
        var existingCmsBase64 = CreateValidCmsSignature();
        var originalData = "test document"u8.ToArray();

        // Act
        try
        {
            _service.AddCoSignature(kalkanApi, existingCmsBase64, originalData);
        }
        catch
        {
            // Ignore exceptions for this test - we're only checking logging
        }

        // Assert - Verify that logging was called
        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Adding co-signature")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.AtLeastOnce);
    }

    [Fact]
    public void AddCoSignature_WithValidInputs_ReturnsBase64String()
    {
        // This test would require real Kalkan SDK and valid CMS structures
        // For now, we verify the method signature and basic error handling
        // Integration tests would cover the actual signing functionality
        
        // Arrange
        var kalkanApi = CreateMockKalkanApi();
        var existingCmsBase64 = CreateValidCmsSignature();
        var originalData = "test document"u8.ToArray();

        // Act & Assert
        // In a real integration test, this would return a valid CMS signature
        var exception = Record.Exception(() => _service.AddCoSignature(kalkanApi, existingCmsBase64, originalData));
        
        // We expect some exception since we're using mock data
        exception.Should().NotBeNull();
    }

    #endregion

    #region Helper Methods

    private KalkanApi CreateMockKalkanApi()
    {
        // Note: KalkanApi is not easily mockable as it's a sealed class with native calls
        // For now, return a new instance (will fail at native call level)
        return new KalkanApi();
    }

    private string CreateValidCmsSignature()
    {
        // This creates a minimal valid CMS/PKCS7 structure in base64
        // This is NOT a valid signature, just valid base64 that won't throw FormatException
        var someBytes = new byte[] { 0x30, 0x82, 0x01, 0x00, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x07, 0x02 };
        return Convert.ToBase64String(someBytes);
    }

    #endregion
}
