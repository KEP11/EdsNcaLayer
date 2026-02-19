using Backend.Tests.Helpers;
using EdsWebApi.Models;
using EdsWebApi.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace Backend.Tests.Integration;

/// <summary>
/// Integration tests using real test certificates from test.pki.gov.kz
/// These tests require the test root certificates to be installed
/// </summary>
public class DocumentSigningIntegrationTests
{
    private readonly Mock<ILogger<DocumentSignService>> _loggerMock;
    private readonly Mock<ILogger<CmsCoSigningService>> _coSigningLoggerMock;
    private readonly ICmsCoSigningService _coSigningService;
    private readonly IDocumentSignService _documentSignService;

    public DocumentSigningIntegrationTests()
    {
        _loggerMock = new Mock<ILogger<DocumentSignService>>();
        _coSigningLoggerMock = new Mock<ILogger<CmsCoSigningService>>();
        _coSigningService = new CmsCoSigningService(_coSigningLoggerMock.Object);
        _documentSignService = new DocumentSignService(_loggerMock.Object, _coSigningService);
    }

    [Fact]
    public void SignDocument_WithValidFlCertificate_CreatesSignature()
    {
        // Arrange
        var request = new BatchSignRequest
        {
            KeyStoreBase64 = TestCertificateHelper.GetValidFlCertificateBase64(),
            Password = TestCertificateHelper.GetTestPassword(),
            StorageType = "PKCS12",
            Documents =
            [
                new()
                {
                    FileName = "test-document.txt",
                    DocumentBase64 = TestCertificateHelper.GetSampleDocumentBase64()
                }
            ]
        };

        // Act
        var response = _documentSignService.SignDocumentsBatch(request);

        // Assert
        response.Should().NotBeNull();
        response.SuccessCount.Should().Be(1);
        response.FailedCount.Should().Be(0);
        response.Results.Should().HaveCount(1);
        
        var result = response.Results[0];
        result.Success.Should().BeTrue();
        result.SignatureBase64.Should().NotBeNullOrEmpty();
        result.ErrorMessage.Should().BeNullOrEmpty();
    }

    [Fact]
    public void SignDocument_WithValidUlCertificate_CreatesSignature()
    {
        // Arrange
        var request = new BatchSignRequest
        {
            KeyStoreBase64 = TestCertificateHelper.GetValidUlCertificateBase64(),
            Password = TestCertificateHelper.GetTestPassword(),
            StorageType = "PKCS12",
            Documents =
            [
                new()
                {
                    FileName = "test-document.txt",
                    DocumentBase64 = TestCertificateHelper.GetSampleDocumentBase64()
                }
            ]
        };

        // Act
        var response = _documentSignService.SignDocumentsBatch(request);

        // Assert
        response.Should().NotBeNull();
        response.SuccessCount.Should().Be(1);
        response.FailedCount.Should().Be(0);
        response.Results[0].Success.Should().BeTrue();
    }

    [Fact]
    public void CoSignDocument_WithDifferentCertificates_CreatesTwoSignatures()
    {
        // Arrange - First signature with FL certificate
        var firstRequest = new BatchSignRequest
        {
            KeyStoreBase64 = TestCertificateHelper.GetValidFlCertificateBase64(),
            Password = TestCertificateHelper.GetTestPassword(),
            StorageType = "PKCS12",
            Documents =
            [
                new()
                {
                    FileName = "test-document.txt",
                    DocumentBase64 = TestCertificateHelper.GetSampleDocumentBase64()
                }
            ]
        };

        var firstResponse = _documentSignService.SignDocumentsBatch(firstRequest);
        firstResponse.Results[0].Success.Should().BeTrue();
        var firstSignature = firstResponse.Results[0].SignatureBase64!;

        // Act - Second signature with UL certificate
        var secondRequest = new BatchSignRequest
        {
            KeyStoreBase64 = TestCertificateHelper.GetValidUlCertificateBase64(),
            Password = TestCertificateHelper.GetTestPassword(),
            StorageType = "PKCS12",
            Documents =
            [
                new()
                {
                    FileName = "test-document.txt",
                    DocumentBase64 = firstSignature // Co-sign the already signed document
                }
            ]
        };

        var secondResponse = _documentSignService.SignDocumentsBatch(secondRequest);

        // Assert
        secondResponse.Should().NotBeNull();
        secondResponse.SuccessCount.Should().Be(1);
        secondResponse.Results[0].Success.Should().BeTrue();
        
        var finalSignature = secondResponse.Results[0].SignatureBase64;
        finalSignature.Should().NotBeNullOrEmpty();
        finalSignature.Should().NotBe(firstSignature, "co-signed document should be different");
    }

    [Fact]
    public void CoSignDocument_WithSameCertificate_UsesBouncyCastleApproach()
    {
        // Arrange - First signature
        var firstRequest = new BatchSignRequest
        {
            KeyStoreBase64 = TestCertificateHelper.GetValidFlCertificateBase64(),
            Password = TestCertificateHelper.GetTestPassword(),
            StorageType = "PKCS12",
            Documents =
            [
                new()
                {
                    FileName = "test-document.txt",
                    DocumentBase64 = TestCertificateHelper.GetSampleDocumentBase64()
                }
            ]
        };

        var firstResponse = _documentSignService.SignDocumentsBatch(firstRequest);
        firstResponse.Results[0].Success.Should().BeTrue();
        var firstSignature = firstResponse.Results[0].SignatureBase64!;

        // Act - Second signature with SAME certificate (should use BouncyCastle approach)
        var secondRequest = new BatchSignRequest
        {
            KeyStoreBase64 = TestCertificateHelper.GetValidFlCertificateBase64(),
            Password = TestCertificateHelper.GetTestPassword(),
            StorageType = "PKCS12",
            Documents =
            [
                new()
                {
                    FileName = "test-document.txt",
                    DocumentBase64 = firstSignature // Co-sign with same cert
                }
            ]
        };

        var secondResponse = _documentSignService.SignDocumentsBatch(secondRequest);

        // Assert
        secondResponse.Should().NotBeNull();
        secondResponse.SuccessCount.Should().Be(1);
        secondResponse.Results[0].Success.Should().BeTrue();
        
        var finalSignature = secondResponse.Results[0].SignatureBase64;
        finalSignature.Should().NotBeNullOrEmpty();
        finalSignature.Should().NotBe(firstSignature, "co-signed document should be different");
        
        // Verify that BouncyCastle approach was used (check logs)
        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("BouncyCastle")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.AtLeastOnce,
            "Should log that BouncyCastle approach was used");
    }

    [Fact]
    public void SignMultipleDocuments_WithSameCertificate_AllSucceed()
    {
        // Arrange
        var request = new BatchSignRequest
        {
            KeyStoreBase64 = TestCertificateHelper.GetValidFlCertificateBase64(),
            Password = TestCertificateHelper.GetTestPassword(),
            StorageType = "PKCS12",
            Documents =
            [
                new()
                {
                    FileName = "document1.txt",
                    DocumentBase64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("Document 1 content"))
                },

                new()
                {
                    FileName = "document2.txt",
                    DocumentBase64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("Document 2 content"))
                },

                new()
                {
                    FileName = "document3.txt",
                    DocumentBase64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("Document 3 content"))
                }
            ]
        };

        // Act
        var response = _documentSignService.SignDocumentsBatch(request);

        // Assert
        response.Should().NotBeNull();
        response.TotalDocuments.Should().Be(3);
        response.SuccessCount.Should().Be(3);
        response.FailedCount.Should().Be(0);
        response.Results.Should().HaveCount(3);
        response.Results.Should().OnlyContain(r => r.Success);
    }

    [Fact]
    public void GetCertificateInfo_WithValidCertificate_ReturnsInfo()
    {
        // Arrange
        var keyStoreBase64 = TestCertificateHelper.GetValidFlCertificateBase64();
        var password = TestCertificateHelper.GetTestPassword();

        // Act
        var certInfo = _documentSignService.GetCertificateInfo(keyStoreBase64, password);

        // Assert
        certInfo.Should().NotBeNull();
        certInfo.Subject.Should().NotBeNullOrEmpty();
        certInfo.Issuer.Should().NotBeNullOrEmpty();
        certInfo.SerialNumber.Should().NotBeNullOrEmpty();
        certInfo.ValidFrom.Should().NotBeNullOrEmpty();
        certInfo.ValidTo.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void VerifySignature_WithValidSignature_SucceedsVerification()
    {
        // Arrange - Create a signature
        var signRequest = new BatchSignRequest
        {
            KeyStoreBase64 = TestCertificateHelper.GetValidFlCertificateBase64(),
            Password = TestCertificateHelper.GetTestPassword(),
            StorageType = "PKCS12",
            Documents =
            [
                new()
                {
                    FileName = "test-document.txt",
                    DocumentBase64 = TestCertificateHelper.GetSampleDocumentBase64()
                }
            ]
        };

        var signResponse = _documentSignService.SignDocumentsBatch(signRequest);
        signResponse.Results[0].Success.Should().BeTrue();
        var signedDocument = signResponse.Results[0].SignatureBase64!;

        // Act - Verify the signature
        var verifyResponse = _documentSignService.VerifyCmsSignature(
            signedDocument,
            null, // Embedded signature
            TestCertificateHelper.GetValidFlCertificateBase64(),
            TestCertificateHelper.GetTestPassword(),
            "PKCS12"
        );

        // Assert
        verifyResponse.Should().NotBeNull();
        verifyResponse.Success.Should().BeTrue();
        verifyResponse.Message.Should().Contain("verified");
        verifyResponse.VerificationInfo.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void VerifyCoSignedDocument_WithTwoSignatures_BothVerified()
    {
        // Arrange - Create co-signed document
        var firstSignRequest = new BatchSignRequest
        {
            KeyStoreBase64 = TestCertificateHelper.GetValidFlCertificateBase64(),
            Password = TestCertificateHelper.GetTestPassword(),
            StorageType = "PKCS12",
            Documents =
            [
                new()
                {
                    FileName = "test-document.txt",
                    DocumentBase64 = TestCertificateHelper.GetSampleDocumentBase64()
                }
            ]
        };

        var firstResponse = _documentSignService.SignDocumentsBatch(firstSignRequest);
        var firstSignature = firstResponse.Results[0].SignatureBase64!;

        var secondSignRequest = new BatchSignRequest
        {
            KeyStoreBase64 = TestCertificateHelper.GetValidUlCertificateBase64(),
            Password = TestCertificateHelper.GetTestPassword(),
            StorageType = "PKCS12",
            Documents =
            [
                new()
                {
                    FileName = "test-document.txt",
                    DocumentBase64 = firstSignature
                }
            ]
        };

        var secondResponse = _documentSignService.SignDocumentsBatch(secondSignRequest);
        var coSignedDocument = secondResponse.Results[0].SignatureBase64!;

        // Act - Verify the co-signed document
        var verifyResponse = _documentSignService.VerifyCmsSignature(
            coSignedDocument,
            null,
            TestCertificateHelper.GetValidFlCertificateBase64(),
            TestCertificateHelper.GetTestPassword(),
            "PKCS12"
        );

        // Assert
        verifyResponse.Should().NotBeNull();
        verifyResponse.Success.Should().BeTrue();
        verifyResponse.Message.Should().Contain("verified");
    }
}
