# CMS Signature Verification Guide

## Overview
The CMS verification feature allows you to verify digital signatures created with KalkanAPI. This feature uses the SDK method to verify CMS (PKCS#7) signatures and extract signer certificate information.

## Features
- **Verify CMS Signatures**: Validate signatures in .cms, .p7s, or .p7m format
- **Support for Detached Signatures**: Optionally provide the original document for detached signature verification
- **Certificate Information**: Display signer certificate details after successful verification
- **PEM Format Support**: Automatically handles both binary and PEM-encoded signatures

## How to Use

### Prerequisites
1. Ensure backend is running on `http://localhost:5000`
2. Kazakhstan PKI root and intermediate certificates must be installed (see `CERTIFICATE_INSTALLATION.md`)
3. Have a CMS signature file to verify (can be generated using the "Batch Sign" feature)

### Verification Steps

1. **Navigate to Batch Sign Module**
   - Open the application in your browser
   - Click on the "Batch Sign" tab

2. **Select CMS Signature File**
   - In section "4. Verify CMS Signature (SDK)", click "Choose File" under "CMS Signature File"
   - Select a .cms, .p7s, or .p7m file

3. **Optional: Select Original Document**
   - If the signature is detached (doesn't include the original data), select the original document
   - This is optional for attached signatures (where the signed data is embedded)

4. **Click "Verify SDK" Button**
   - The system will verify the signature using KalkanAPI
   - Verification typically takes 1-2 seconds

5. **View Results**
   - **Success**: Green message with certificate details including:
     - Subject (signer identity)
     - Issuer (certificate authority)
     - Serial Number
     - Validity period
     - Signed data size (if available)
   
   - **Failure**: Red message with error details:
     - Missing PKI certificates (requires installation)
     - Invalid signature
     - Certificate expired
     - Other validation errors

## API Endpoint

### POST /api/sign/verify

**Request Body:**
```json
{
  "cmsSignatureBase64": "LS0tLS1CRUdJTiBDTVMtLS0tLQ0K...",
  "originalDocumentBase64": "SGVsbG8gV29ybGQh..." // optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Signature verified successfully",
  "signedData": "SGVsbG8gV29ybGQh",
  "signerCertificate": {
    "subject": "CN=John Doe, OU=User, O=Company, C=KZ",
    "issuer": "CN=CA, O=NCA, C=KZ",
    "serialNumber": "123456789",
    "validFrom": "2024-01-01T00:00:00",
    "validTo": "2025-01-01T00:00:00"
  }
}
```

**Response (Failure):**
```json
{
  "success": false,
  "message": "Invalid signature or missing PKI root certificates"
}
```

## Common Error Messages

### ⚠️ Root/intermediate certificates not found
**Cause:** Kazakhstan PKI certificates are not installed on the system.

**Solution:**
1. Run the automated installer: `.\install-kz-pki-certificates.ps1`
2. Or follow manual installation steps in `CERTIFICATE_INSTALLATION.md`

### ✗ Invalid signature
**Cause:** The signature is corrupted, tampered with, or doesn't match the original document.

**Solution:**
- Ensure the signature file is not modified
- If using detached signature, verify you selected the correct original document
- Check that the file was created with a valid certificate

### ✗ Certificate has expired
**Cause:** The signer's certificate was valid when signing but has since expired.

**Note:** This is a warning but the signature may still be considered valid depending on your requirements.

## Technical Details

### Verification Process
1. Frontend reads the CMS signature file and converts to Base64
2. Optional: Original document is also converted to Base64 if provided
3. Backend receives the request and cleans PEM format (if present)
4. KalkanAPI's `VerifyData()` method is called with:
   - CMS signature bytes
   - Original document bytes (or null)
   - CMS validation flags
   - Certificate alias (optional)
5. On success, certificate information is extracted and returned
6. On failure, detailed error message is provided

### Supported Signature Formats
- **CMS (PKCS#7)**: Standard cryptographic message syntax
- **PEM Encoding**: Text-based encoding with `-----BEGIN CMS-----` headers
- **Binary DER**: Raw binary format
- **Detached Signatures**: Signature separate from original data
- **Attached Signatures**: Signature includes the original data

## Testing the Feature

### Quick Test
1. Use the "Batch Sign" feature to sign a document
2. Download the resulting .cms signature file
3. In the verification section, select the downloaded .cms file
4. Click "Verify SDK"
5. You should see successful verification with certificate details

### Test Cases
- ✅ Verify a freshly signed document
- ✅ Verify with and without providing original document
- ✅ Verify PEM-encoded signature
- ✅ Verify binary signature
- ❌ Try to verify a modified signature (should fail)
- ❌ Try to verify with wrong original document (should fail)

## Integration Notes

### Using the API in Your Application
```javascript
import { verifyCmsSignature, fileToBase64 } from './services/batchSignApiService';

// Example usage
const verifyFile = async (signatureFile, originalFile = null) => {
  const signatureBase64 = await fileToBase64(signatureFile);
  const originalBase64 = originalFile ? await fileToBase64(originalFile) : null;
  
  const result = await verifyCmsSignature(signatureBase64, originalBase64);
  
  if (result.success) {
    console.log('Signature valid!', result.signerCertificate);
  } else {
    console.error('Verification failed:', result.message);
  }
};
```

## Troubleshooting

### Verification always fails
1. Check that PKI certificates are installed: `certmgr.msc` → Trusted Root Certification Authorities
2. Ensure backend has access to KalkanCrypt.dll
3. Check backend logs for detailed error messages

### Cannot select .cms files
- Some systems may not recognize .cms extension
- Try renaming to .p7s or .p7m
- Or select "All Files" in file picker

### Verification is slow
- First verification may take 2-3 seconds while KalkanAPI initializes
- Subsequent verifications should be faster
- Large files (>10MB) may take longer

## Related Documentation
- `BATCH_SIGNING_README.md` - How to create signatures
- `CERTIFICATE_INSTALLATION.md` - PKI certificate setup
- `QUICK_START.md` - Complete application setup guide

## Support
For issues related to:
- KalkanAPI errors: Check Kazakhstan NCA documentation
- Certificate problems: Refer to `CERTIFICATE_INSTALLATION.md`
- API issues: Check backend logs in `Backend/bin/Debug/net8.0/`
