# Test Certificates Setup

## Overview

This project includes real test certificates from Kazakhstan's test PKI infrastructure (test.pki.gov.kz) for integration testing.

## Test Certificates Location

All test certificates are located in `Backend.Tests\Keys and Certs\Gost2015\2025.10.17-2026.10.17\`

### Available Certificates

- **FL (Individual)**: Valid and revoked individual certificates
- **UL (Organization)**: Various organization certificates including:
  - First Director (Первый руководитель)
  - Employee with signing rights (Сотрудник с правом подписи)
  - Organization employee (Сотрудник организации)
  - Information system (Информационная система)
  - Treasury client (Казначейство клиент)

### Certificate Password

All test certificates use the password: **Qwerty12**

## Prerequisites for Integration Tests

Integration tests require the following setup:

### 1. Install Test Root Certificates

Download and install these certificates on your machine:

- **Root CA (КУЦ)**: http://test.pki.gov.kz/cert/root_test_gost_2022.cer
- **NCA (НУЦ)**: http://test.pki.gov.kz/cert/nca_gost2022_test.cer
- **Base CRL**: http://test.pki.gov.kz/crl/nca_gost2022_test.crl

### 2. Test Service URLs

The following test services are used:

- **Test TSA (Time Stamp Authority)**: http://test.pki.gov.kz/tsp/
- **Test OCSP (Certificate Status)**: http://test.pki.gov.kz/ocsp/

### 3. Network Access

Ensure your test environment has network access to `test.pki.gov.kz` for:
- Time stamping
- Certificate validation (OCSP)
- CRL downloads

## Using Test Certificates

### In Unit Tests

Use the `TestCertificateHelper` class for easy access to test certificates:

```csharp
using Backend.Tests.Helpers;

// Get certificate bytes
var certBytes = TestCertificateHelper.LoadValidFlCertificate();

// Get certificate as base64
var certBase64 = TestCertificateHelper.GetValidFlCertificateBase64();

// Get password
var password = TestCertificateHelper.GetTestPassword();

// Get test service URLs
var tsaUrl = TestCertificateHelper.GetTestTsaUrl();
var ocspUrl = TestCertificateHelper.GetTestOcspUrl();
```

### Available Helper Methods

- `LoadValidFlCertificate()` - Valid individual certificate
- `LoadValidUlFirstDirectorCertificate()` - Valid organization director certificate
- `LoadValidUlEmployeeCertificate()` - Valid organization employee certificate
- `LoadValidUlInfoSystemCertificate()` - Valid information system certificate
- `LoadRevokedFlCertificate()` - Revoked individual certificate
- `LoadRevokedUlCertificate()` - Revoked organization certificate

## Test Structure

### Unit Tests (31 tests)
Located in `Backend.Tests\Services\` and root - these tests use mocks and don't require real certificates or network access. **These run successfully without any prerequisites.**

### Integration Tests (9 tests)
Located in `Backend.Tests\Integration\` - these tests use real certificates and require:
- Installed root certificates
- Network access to test.pki.gov.kz
- Valid test certificates

Integration tests cover:
1. Signing documents with FL certificates
2. Signing documents with UL certificates
3. Co-signing with different certificates
4. Co-signing with the same certificate (BouncyCastle approach)
5. Batch signing multiple documents
6. Getting certificate information
7. Verifying signatures
8. Verifying co-signed documents

## Running Tests

### Unit Tests Only (Fast, No Prerequisites)
```bash
dotnet test --filter "FullyQualifiedName!~IntegrationTests"
```

### Integration Tests Only (Requires Setup)
```bash
dotnet test --filter "FullyQualifiedName~IntegrationTests"
```

### All Tests
```bash
dotnet test
```

## Troubleshooting

### Integration Tests Fail

If integration tests fail, check:

1. **Root certificates installed?**
   - Install from URLs listed above
   - Import to "Trusted Root Certification Authorities"

2. **Network access?**
   - Can you ping `test.pki.gov.kz`?
   - Firewall/proxy blocking connections?

3. **Certificate validity?**
   - Test certificates are valid from 2025.10.17 to 2026.10.17
   - Check system date

4. **TSA configured?**
   - Service uses `http://test.pki.gov.kz/tsp/` by default
   - Check if TSA service is accessible

### Certificate Not Found Errors

Ensure the test project's `.csproj` includes:

```xml
<ItemGroup>
  <None Update="Keys and Certs\**\*.*">
    <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
  </None>
</ItemGroup>
```

This ensures certificates are copied to the output directory during build.

## Security Note

**These are test certificates for development and testing purposes only.**
- Use only in test/dev environments
- Never use in production
- All test certificates and their passwords are publicly known
- Real production certificates use different infrastructure (pki.gov.kz)
