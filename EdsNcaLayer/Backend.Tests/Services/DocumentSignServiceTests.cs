using Xunit;

public class DocumentSignServiceTests
{
    [Fact]
    public void Test_SignDocument_ReturnsExpectedResult()
    {
        // Arrange
        var service = new DocumentSignService();
        var document = new Document { /* initialize document */ };

        // Act
        var result = service.SignDocument(document);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(expectedValue, result);
    }
}