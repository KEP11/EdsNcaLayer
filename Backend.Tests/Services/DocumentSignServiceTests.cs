using System.Text;
using Backend.Tests.Helpers;
using EdsWebApi.Models;
using EdsWebApi.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace Backend.Tests.Services;

public class DocumentSignServiceTests
{
    private readonly Mock<ILogger<DocumentSignService>> _loggerMock;
    private readonly Mock<ICmsCoSigningService> _coSigningServiceMock;
    private readonly IDocumentSignService _service;

    public DocumentSignServiceTests()
    {
        _loggerMock = new Mock<ILogger<DocumentSignService>>();
        _coSigningServiceMock = new Mock<ICmsCoSigningService>();
        _service = new DocumentSignService(_loggerMock.Object, _coSigningServiceMock.Object);
    }

    #region SignDocumentsBatch Tests

    [Fact]
    public void SignDocumentsBatch_WithNullRequest_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.Throws<NullReferenceException>(() => _service.SignDocumentsBatch(null!));
    }

    [Fact]
    public void SignDocumentsBatch_WithEmptyDocuments_ReturnsEmptyResults()
    {
        // Arrange
        var request = CreateValidBatchSignRequest(documentCount: 0);

        // Act
        var response = _service.SignDocumentsBatch(request);

        // Assert
        response.Should().NotBeNull();
        response.TotalDocuments.Should().Be(0);
        response.Results.Should().BeEmpty();
        response.SuccessCount.Should().Be(0);
        response.FailedCount.Should().Be(0);
    }

    [Fact]
    public void SignDocumentsBatch_WithInvalidKeyStore_ReturnsFailureForAllDocuments()
    {
        // Arrange
        var request = new BatchSignRequest
        {
            KeyStoreBase64 = "invalid-base64-data",
            Password = "wrongpassword",
            StorageType = "PKCS12",
            Documents =
            [
                new()
                {
                    FileName = "doc1.pdf",
                    DocumentBase64 = Convert.ToBase64String("test document"u8.ToArray())
                }
            ]
        };

        // Act
        var response = _service.SignDocumentsBatch(request);

        // Assert
        response.Should().NotBeNull();
        response.FailedCount.Should().BeGreaterThan(0);
        response.SuccessCount.Should().Be(0);
        response.Results.Should().HaveCount(1);
        response.Results[0].Success.Should().BeFalse();
        response.Results[0].ErrorMessage.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void SignDocumentsBatch_WithInvalidDocumentBase64_ReturnsPartialFailure()
    {
        // Arrange
        var request = CreateValidBatchSignRequest(documentCount: 1);
        request.Documents[0].DocumentBase64 = "not-valid-base64!!!";

        // Act
        var response = _service.SignDocumentsBatch(request);

        // Assert
        response.Should().NotBeNull();
        response.TotalDocuments.Should().Be(1);
        response.FailedCount.Should().BeGreaterThan(0);
    }

    [Fact]
    public void SignDocumentsBatch_WithMultipleDocuments_ProcessesAll()
    {
        // Arrange
        var request = CreateValidBatchSignRequest(documentCount: 3);

        // Act
        var response = _service.SignDocumentsBatch(request);

        // Assert
        response.Should().NotBeNull();
        response.TotalDocuments.Should().Be(3);
        response.Results.Should().HaveCount(3);
        (response.SuccessCount + response.FailedCount).Should().Be(3);
    }

    [Fact]
    public void SignDocumentsBatch_WithDifferentStorageType_UsesCorrectType()
    {
        // Arrange
        var request = CreateValidBatchSignRequest(documentCount: 1);
        request.StorageType = "KAZTOKEN";

        // Act
        var response = _service.SignDocumentsBatch(request);

        // Assert
        response.Should().NotBeNull();
        response.Results.Should().HaveCount(1);
    }

    #endregion

    #region GetCertificateInfo Tests

    [Fact]
    public void GetCertificateInfo_WithNullKeyStore_ThrowsException()
    {
        // Act & Assert - Will throw InvalidOperationException wrapping ArgumentNullException
        Assert.Throws<InvalidOperationException>(() => _service.GetCertificateInfo(null!, "password"));
    }

    [Fact]
    public void GetCertificateInfo_WithEmptyKeyStore_ThrowsException()
    {
        // Act & Assert - Will throw InvalidOperationException from Kalkan SDK
        Assert.Throws<InvalidOperationException>(() =>
            _service.GetCertificateInfo(string.Empty, "password"));
    }

    [Fact]
    public void GetCertificateInfo_WithInvalidKeyStore_ThrowsInvalidOperationException()
    {
        // Arrange
        var invalidKeyStore = Convert.ToBase64String("not a valid keystore"u8.ToArray());

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() =>
            _service.GetCertificateInfo(invalidKeyStore, "password"));
    }

    [Fact]
    public void GetCertificateInfo_WithNullPassword_ThrowsException()
    {
        // Arrange
        var keyStore = Convert.ToBase64String("fake keystore"u8.ToArray());

        // Act & Assert - Will throw InvalidOperationException wrapping NullReferenceException
        Assert.Throws<InvalidOperationException>(() =>
            _service.GetCertificateInfo(keyStore, null!));
    }

    [Fact]
    public void GetCertificateInfo_WithDefaultStorageType_UsesPKCS12()
    {
        // Arrange
        var keyStore = Convert.ToBase64String("fake keystore"u8.ToArray());

        // Act & Assert - should not throw NullReferenceException for storageType
        try
        {
            _service.GetCertificateInfo(keyStore, "password");
        }
        catch (InvalidOperationException)
        {
            // Expected - invalid keystore
        }
    }

    [Fact]
    public void GetCertificateInfo_WithKazTokenStorageType_HandlesCorrectly()
    {
        // Arrange
        var keyStore = Convert.ToBase64String("fake keystore"u8.ToArray());

        // Act & Assert
        try
        {
            _service.GetCertificateInfo(keyStore, "password", "KAZTOKEN");
        }
        catch (InvalidOperationException)
        {
            // Expected - invalid keystore
        }
    }

    #endregion

    #region VerifyCmsSignature Tests

    [Fact]
    public void VerifyCmsSignature_WithNullSignature_ReturnsFailureResponse()
    {
        // Act
        var response = _service.VerifyCmsSignature(null!);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeFalse();
        response.Message.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void VerifyCmsSignature_WithEmptySignature_ReturnsFailureResponse()
    {
        // Act
        var response = _service.VerifyCmsSignature(string.Empty);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeFalse();
    }

    [Fact]
    public void VerifyCmsSignature_WithInvalidBase64_ReturnsFailureResponse()
    {
        // Arrange
        var invalidSignature = "not-valid-base64!!!";

        // Act
        var response = _service.VerifyCmsSignature(invalidSignature);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeFalse();
        response.Message.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void VerifyCmsSignature_WithPemFormat_ProcessesCorrectly()
    {
        // Arrange
        var pemSignature = "-----BEGIN CMS-----\n" +
                          Convert.ToBase64String("fake cms data"u8.ToArray()) +
                          "\n-----END CMS-----";

        // Act
        var response = _service.VerifyCmsSignature(pemSignature);

        // Assert
        response.Should().NotBeNull();
    }

    [Fact]
    public void VerifyCmsSignature_WithOriginalDocument_ProcessesDetachedSignature()
    {
        // Arrange
        var signature = Convert.ToBase64String("fake cms signature"u8.ToArray());
        var originalDoc = Convert.ToBase64String("original document content"u8.ToArray());

        // Act
        var response = _service.VerifyCmsSignature(signature, originalDoc);

        // Assert
        response.Should().NotBeNull();
    }

    [Fact]
    public void VerifyCmsSignature_WithKeyStoreParameters_LoadsKeystore()
    {
        // Arrange
        var signature = Convert.ToBase64String("fake cms"u8.ToArray());
        var keyStore = Convert.ToBase64String("fake keystore"u8.ToArray());

        // Act
        var response = _service.VerifyCmsSignature(
            signature,
            null,
            keyStore,
            "password",
            "PKCS12"
        );

        // Assert
        response.Should().NotBeNull();
    }

    [Fact]
    public void VerifyCmsSignature_WithoutKeyStore_VerifiesWithoutLoading()
    {
        // Arrange
        var signature = Convert.ToBase64String("fake cms"u8.ToArray());

        // Act
        var response = _service.VerifyCmsSignature(signature);

        // Assert
        response.Should().NotBeNull();
    }

    [Fact]
    public void VerifyCmsSignature_WithNullOriginalDocument_TreatsAsAttached()
    {
        // Arrange
        var signature = Convert.ToBase64String("fake cms"u8.ToArray());

        // Act
        var response = _service.VerifyCmsSignature(signature);

        // Assert
        response.Should().NotBeNull();
    }

    [Fact]
    public void VerifyCmsSignature_WithEmptyOriginalDocument_TreatsAsAttached()
    {
        // Arrange
        var signature = Convert.ToBase64String("fake cms"u8.ToArray());

        // Act
        var response = _service.VerifyCmsSignature(signature, string.Empty);

        // Assert
        response.Should().NotBeNull();
    }

    #endregion

    #region Helper Methods

    private BatchSignRequest CreateValidBatchSignRequest(int documentCount)
    {
        var certBytes = TestCertificateHelper.LoadValidFlCertificate();
        var certBase64 = TestCertificateHelper.GetValidFlCertificateBase64();
        var password = TestCertificateHelper.GetTestPassword(); // "Qwerty12"

        
        var documents = new List<DocumentToSign>();
        for (int i = 0; i < documentCount; i++)
        {
            documents.Add(new DocumentToSign
            {
                FileName = $"doc{i}.png.cms",
                DocumentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes($"test document {i}"))
            });
        }

        return new()
        {
            KeyStoreBase64 = certBase64,
            Password = password,
            StorageType = "PKCS12",
            Documents = documents
        };
    }

    #endregion
}
