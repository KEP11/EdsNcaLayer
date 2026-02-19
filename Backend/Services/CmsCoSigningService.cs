using Org.BouncyCastle.Cms;
using NKalkan;

namespace EdsWebApi.Services;

public sealed class CmsCoSigningService(ILogger<CmsCoSigningService> logger) : ICmsCoSigningService
{
    public string AddCoSignature(KalkanApi kalkanApi, string existingCmsBase64, byte[] originalData)
    {
        logger.LogInformation("Adding co-signature using hybrid SDK+BouncyCastle approach");

        var cleanedBase64 = CleanBase64(existingCmsBase64);
        var existingCmsBytes = Convert.FromBase64String(cleanedBase64);
        var existingCms = new CmsSignedData(existingCmsBytes);

        var existingSignerCount = existingCms.GetSignerInfos().Count;
        logger.LogInformation("Existing signers: {Count}", existingSignerCount);

        var newSignatureBase64 = CreateNewSignature(kalkanApi, originalData);
        var newSignatureBytes = Convert.FromBase64String(newSignatureBase64);
        var newSignatureCms = new CmsSignedData(newSignatureBytes);

        var mergedCms = MergeSignatures(existingCms, newSignatureCms, originalData);

        var mergedSignerCount = mergedCms.GetSignerInfos().Count;
        logger.LogInformation("Merged CMS created, total signers: {Count}", mergedSignerCount);

        if (mergedSignerCount != existingSignerCount + 1)
        {
            logger.LogWarning("Expected {Expected} signers, got {Actual}", existingSignerCount + 1, mergedSignerCount);
        }

        return Convert.ToBase64String(mergedCms.GetEncoded());
    }

    private string CleanBase64(string base64String)
    {
        if (base64String.Contains("-----BEGIN"))
        {
            var lines = base64String.Split('\n');
            var base64Lines = lines.Where(line =>
                !line.Contains("-----BEGIN") &&
                !line.Contains("-----END") &&
                !string.IsNullOrWhiteSpace(line)).ToArray();
            base64String = string.Join("", base64Lines);
        }

        return base64String.Replace("\r", "").Replace("\n", "").Replace(" ", "").Replace("\t", "");
    }

    private string CreateNewSignature(KalkanApi kalkanApi, byte[] data)
    {
        logger.LogInformation("Creating new signature with Kalkan SDK");
        var signFlags = KalkanSignFlags.SignCms | KalkanSignFlags.WithTimestamp | KalkanSignFlags.OutputBase64;
        return kalkanApi.SignData(data, signFlags);
    }

    private CmsSignedData MergeSignatures(CmsSignedData existingCms, CmsSignedData newSignatureCms, byte[] originalData)
    {
        var generator = new CmsSignedDataGenerator();

        generator.AddSigners(existingCms.GetSignerInfos());
        generator.AddSigners(newSignatureCms.GetSignerInfos());

        AddCertificates(generator, existingCms, "existing");
        AddCertificates(generator, newSignatureCms, "new");

        var content = new CmsProcessableByteArray(originalData);
        return generator.Generate(content, true);
    }

    private void AddCertificates(CmsSignedDataGenerator generator, CmsSignedData cms, string label)
    {
        try
        {
            var certStore = cms.GetCertificates();
            if (certStore != null)
            {
                var matches = certStore.EnumerateMatches(null);
                var certList = new System.Collections.Generic.List<Org.BouncyCastle.X509.X509Certificate>();
                foreach (Org.BouncyCastle.X509.X509Certificate cert in matches)
                {
                    certList.Add(cert);
                }

                if (certList.Count > 0)
                {
                    var store = Org.BouncyCastle.Utilities.Collections.CollectionUtilities.CreateStore(certList);
                    generator.AddCertificates(store);
                    logger.LogInformation("Added {Count} {Label} certificates", certList.Count, label);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not add {Label} certificates", label);
        }
    }
}
