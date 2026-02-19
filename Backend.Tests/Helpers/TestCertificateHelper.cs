using System.Reflection;

namespace Backend.Tests.Helpers;

/// <summary>
/// Helper class for loading test certificates and keys
/// </summary>
public static class TestCertificateHelper
{
    private const string TestPassword = "Qwerty12";
    private const string TestBasePath = "Keys and Certs\\Gost2015\\2025.10.17-2026.10.17";
    
    /// <summary>
    /// Gets the password for test certificates
    /// </summary>
    public static string GetTestPassword() => TestPassword;
    
    /// <summary>
    /// Gets the test TSA URL
    /// </summary>
    public static string GetTestTsaUrl() => "http://test.pki.gov.kz/tsp/";
    
    /// <summary>
    /// Gets the test OCSP URL
    /// </summary>
    public static string GetTestOcspUrl() => "http://test.pki.gov.kz/ocsp/";
    
    /// <summary>
    /// Loads a valid FL (individual) certificate
    /// </summary>
    public static byte[] LoadValidFlCertificate()
    {
        return LoadCertificate("FL\\valid\\GOST512_d6d1e53515d516a7d95d399b668cf09011bf118d.p12");
    }
    
    /// <summary>
    /// Loads a valid UL (organization) certificate - First Director
    /// </summary>
    public static byte[] LoadValidUlFirstDirectorCertificate()
    {
        return LoadCertificate("UL\\Первый руководитель\\valid\\GOST512_0f923a405e7a60ef08debcf4715d7f818637b82b.p12");
    }
    
    /// <summary>
    /// Loads a valid UL (organization) certificate - Employee with signing rights
    /// </summary>
    public static byte[] LoadValidUlEmployeeCertificate()
    {
        return LoadCertificate("UL\\Сотрудник с правом подписи\\valid\\GOST512_a69b258320a0d289ec98aef354f990fd168b472f.p12");
    }
    
    /// <summary>
    /// Loads a valid UL (organization) certificate - Information System
    /// </summary>
    public static byte[] LoadValidUlInfoSystemCertificate()
    {
        return LoadCertificate("UL\\Информационная система\\valid\\GOST512_aa30cf5ab17b98d1b18bc3540943e444e183f2e6.p12");
    }
    
    /// <summary>
    /// Loads a revoked FL certificate
    /// </summary>
    public static byte[] LoadRevokedFlCertificate()
    {
        return LoadCertificate("FL\\revoked\\GOST512_36ab73273b4922617b0c4c781f3e02db2e017cc6.p12");
    }
    
    /// <summary>
    /// Loads a revoked UL certificate
    /// </summary>
    public static byte[] LoadRevokedUlCertificate()
    {
        return LoadCertificate("UL\\Первый руководитель\\revoked\\GOST512_247d879996b173e1d1b3ee66c04265871ecbcf9d.p12");
    }
    
    /// <summary>
    /// Gets the base64 encoded string of a valid FL certificate
    /// </summary>
    public static string GetValidFlCertificateBase64()
    {
        return Convert.ToBase64String(LoadValidFlCertificate());
    }
    
    /// <summary>
    /// Gets the base64 encoded string of a valid UL certificate
    /// </summary>
    public static string GetValidUlCertificateBase64()
    {
        return Convert.ToBase64String(LoadValidUlFirstDirectorCertificate());
    }
    
    /// <summary>
    /// Gets sample document bytes for testing
    /// </summary>
    public static byte[] GetSampleDocumentBytes()
    {
        return System.Text.Encoding.UTF8.GetBytes("This is a test document for digital signature testing.");
    }
    
    /// <summary>
    /// Gets sample document base64 string
    /// </summary>
    public static string GetSampleDocumentBase64()
    {
        return Convert.ToBase64String(GetSampleDocumentBytes());
    }
    
    private static byte[] LoadCertificate(string relativePath)
    {
        var assemblyLocation = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        if (assemblyLocation == null)
        {
            throw new InvalidOperationException("Could not determine assembly location");
        }
        
        var fullPath = Path.Combine(assemblyLocation, TestBasePath, relativePath);
        
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException($"Test certificate not found at: {fullPath}");
        }
        
        return File.ReadAllBytes(fullPath);
    }
    
    /// <summary>
    /// Gets the full path to a certificate file
    /// </summary>
    public static string GetCertificatePath(string relativePath)
    {
        var assemblyLocation = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        if (assemblyLocation == null)
        {
            throw new InvalidOperationException("Could not determine assembly location");
        }
        
        return Path.Combine(assemblyLocation, TestBasePath, relativePath);
    }
}
