# Installing Kazakhstan PKI Root Certificates

## Problem

When trying to use KalkanAPI for signing, you may encounter this error:

```
ERROR 0x8f00040: Load certificate from system store - not found root or intermediate certificate in system store.
```

This means the Kazakhstan PKI root and intermediate certificates are not installed on your system.

## Solution

### Option 1: Install All Required Certificates (Recommended)

1. **Visit the official PKI website:**
   - Go to https://pki.gov.kz/
   - Navigate to the downloads or certificates section

2. **Download the following certificates:**
   - National Certification Authority (NCA) Root certificate
   - Intermediate CA certificates
   - Look for files like:
     - `root_gost2015.cer` or `root_rsa.cer`
     - `nca_gost2015.cer` or `nca_rsa.cer`

3. **Install Root Certificate:**
   - Right-click on the root certificate file (e.g., `root_gost2015.cer`)
   - Select "Install Certificate"
   - Choose "Local Machine" (requires administrator rights)
   - Select "Place all certificates in the following store"
   - Click "Browse" and select "Trusted Root Certification Authorities"
   - Click "Next" and "Finish"

4. **Install Intermediate Certificates:**
   - Right-click on each intermediate certificate file
   - Select "Install Certificate"
   - Choose "Local Machine"
   - Select "Place all certificates in the following store"
   - Click "Browse" and select "Intermediate Certification Authorities"
   - Click "Next" and "Finish"

### Option 2: Manual Installation via MMC

1. **Open Certificate Manager:**
   - Press `Win + R`
   - Type `mmc` and press Enter
   - Click "File" → "Add/Remove Snap-in"
   - Select "Certificates" → "Add"
   - Choose "Computer account" → "Next" → "Finish"

2. **Import Certificates:**
   - Expand "Certificates (Local Computer)"
   - Right-click "Trusted Root Certification Authorities" → "Certificates"
   - Select "All Tasks" → "Import"
   - Browse and select the root certificate file
   - Click "Next" and "Finish"
   
3. **Repeat for Intermediate Certificates:**
   - Right-click "Intermediate Certification Authorities" → "Certificates"
   - Select "All Tasks" → "Import"
   - Import each intermediate certificate

### Option 3: Automated Installation Script

Create a PowerShell script (requires administrator rights):

```powershell
# Run as Administrator
# install-kz-pki-certs.ps1

# Download and install root certificate
$rootCertUrl = "https://pki.gov.kz/cert/root_gost2015.cer"
$rootCertPath = "$env:TEMP\root_gost2015.cer"

Invoke-WebRequest -Uri $rootCertUrl -OutFile $rootCertPath
Import-Certificate -FilePath $rootCertPath -CertStoreLocation Cert:\LocalMachine\Root

# Download and install intermediate certificate
$ncaCertUrl = "https://pki.gov.kz/cert/nca_gost2015.cer"
$ncaCertPath = "$env:TEMP\nca_gost2015.cer"

Invoke-WebRequest -Uri $ncaCertUrl -OutFile $ncaCertPath
Import-Certificate -FilePath $ncaCertPath -CertStoreLocation Cert:\LocalMachine\CA

Write-Host "Kazakhstan PKI certificates installed successfully!" -ForegroundColor Green
```

Save and run:
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install-kz-pki-certs.ps1
```

## Verification

After installation, verify the certificates are installed:

1. Press `Win + R`, type `certmgr.msc`, press Enter
2. Check "Trusted Root Certification Authorities" → "Certificates"
3. Look for certificates from "National Certificate Authority of the Republic of Kazakhstan"

## Restart Required

After installing the certificates:
1. **Restart your backend application** (stop and start `dotnet run`)
2. Try loading the certificate again in the Batch Sign module

## Alternative: Use Without Chain Validation (Not Recommended for Production)

If you cannot install root certificates and only need basic signing functionality for testing:

⚠️ **Warning:** This approach skips certificate chain validation and should only be used in development environments.

The current implementation requires proper certificate chain validation, which is the secure approach for production use.

## Troubleshooting

### Certificate still not recognized
- Make sure you installed certificates in "Local Machine" store, not "Current User"
- Verify you have administrator rights
- Restart the application after installation

### Wrong certificate format
- Kazakhstan PKI uses GOST algorithms
- Make sure you download the correct certificate format (GOST 2015 or RSA)
- Your keystore (.p12 file) should match the algorithm type

### Still getting errors
- Check that your .p12 file is valid and not corrupted
- Verify the password is correct
- Ensure the certificate in your .p12 file was issued by Kazakhstan NCA

## Links

- **Official PKI Website:** https://pki.gov.kz/
- **Certificate Downloads:** https://pki.gov.kz/cert/
- **Documentation:** https://pki.gov.kz/developers/

## For Production Environments

1. Always install official certificates from https://pki.gov.kz/
2. Validate certificate chains properly
3. Keep certificates up to date
4. Follow your organization's security policies
5. Use hardware tokens (KazToken) when possible for better security
