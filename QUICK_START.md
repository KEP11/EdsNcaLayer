# Batch Document Signing - Quick Start Guide

## What Was Implemented

A complete batch document signing solution using KalkanAPI with the following components:

### Backend (ASP.NET Core)
✅ `SignController` - REST API for signing operations  
✅ `DocumentSignService` - Business logic using KalkanAPI  
✅ Request/Response Models for single and batch signing  
✅ Certificate information extraction  
✅ Error handling and validation  

### Frontend (React)
✅ `BatchSignModule` - Complete UI component for batch signing  
✅ `batchSignApiService` - API client service  
✅ Certificate loading and validation  
✅ Multiple document selection  
✅ Progress tracking and results display  
✅ Download functionality for signed documents  

## ⚠️ Prerequisites - Install Kazakhstan PKI Certificates

**IMPORTANT:** Before using the signing functionality, you must install Kazakhstan PKI root certificates.

### Quick Install (Recommended)

Run the automated installer script **as Administrator**:

```powershell
# Right-click PowerShell -> Run as Administrator
.\install-kz-pki-certificates.ps1
```

This will automatically download and install all required certificates from https://pki.gov.kz/

### Manual Install

If the automated script doesn't work, see detailed instructions in [CERTIFICATE_INSTALLATION.md](./CERTIFICATE_INSTALLATION.md)

### Common Error

If you see this error when loading a certificate:
```
ERROR 0x8f00040: not found root or intermediate certificate in system store
```

It means the PKI certificates are not installed. Run the installation script above.

## Quick Start

### 1. Run Backend
```powershell
cd Backend
dotnet run
```
Backend runs at: `http://localhost:5000`

### 2. Run Frontend
```powershell
cd Frontend
npm install
npm run dev
```
Frontend runs at: `http://localhost:5173`

### 3. Use Batch Signing

**In the Web Interface:**

1. Click **"Batch Sign"** tab
2. **Load Certificate:**
   - Select storage type (PKCS12 is default)
   - Choose your .p12 or .pfx file
   - Enter password
   - Click "Load Certificate"
3. **Select Documents:**
   - Click "Select Documents"
   - Choose multiple files to sign
4. **Sign:**
   - Click "Sign X Document(s)" button
5. **Download:**
   - Download all signed files or individual ones
   - Files are saved with .cms extension

## File Structure

```
Backend/
├── Controllers/
│   └── SignController.cs          # API endpoints
├── Services/
│   └── DocumentSignService.cs     # KalkanAPI integration
├── Models/
│   ├── SignRequest.cs             # Single sign request
│   ├── SignResponse.cs            # Single sign response
│   ├── BatchSignRequest.cs        # Batch sign request
│   └── BatchSignResponse.cs       # Batch sign response
└── Program.cs                     # Service registration

Frontend/
├── src/
│   ├── components/
│   │   └── BatchSignModule.jsx    # Main UI component
│   ├── services/
│   │   └── batchSignApiService.js # API client
│   └── App.jsx                    # Updated with batch sign tab
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sign` | POST | Sign single document |
| `/api/sign/batch` | POST | Sign multiple documents |
| `/api/sign/certificate/info` | POST | Get certificate info |

## Example: Sign Documents via API

### Using cURL

```bash
# 1. Get certificate info
curl -X POST http://localhost:5000/api/sign/certificate/info \
  -H "Content-Type: application/json" \
  -d '{
    "keyStoreBase64": "MIIKe...",
    "password": "your_password",
    "storageType": "PKCS12"
  }'

# 2. Sign multiple documents
curl -X POST http://localhost:5000/api/sign/batch \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "fileName": "doc1.pdf",
        "documentBase64": "JVBERi0..."
      },
      {
        "fileName": "doc2.txt",
        "documentBase64": "SGVsbG8..."
      }
    ],
    "keyStoreBase64": "MIIKe...",
    "password": "your_password",
    "storageType": "PKCS12"
  }'
```

### Using PowerShell

```powershell
# Read files and convert to Base64
$keyStoreBytes = [System.IO.File]::ReadAllBytes("path\to\certificate.p12")
$keyStoreBase64 = [Convert]::ToBase64String($keyStoreBytes)

$doc1Bytes = [System.IO.File]::ReadAllBytes("path\to\document1.pdf")
$doc1Base64 = [Convert]::ToBase64String($doc1Bytes)

# Create request body
$body = @{
    documents = @(
        @{
            fileName = "document1.pdf"
            documentBase64 = $doc1Base64
        }
    )
    keyStoreBase64 = $keyStoreBase64
    password = "your_password"
    storageType = "PKCS12"
} | ConvertTo-Json

# Send request
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/sign/batch" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"

# Save signed document
$signatureBytes = [Convert]::FromBase64String($response.results[0].signatureBase64)
[System.IO.File]::WriteAllBytes("document1.cms", $signatureBytes)
```

## Features

### Certificate Management
- Load PKCS12 (.p12, .pfx) certificates
- Support for JKS and KazToken
- Display certificate information (subject, issuer, validity)
- Password validation

### Batch Operations
- Select multiple documents at once
- Sign all documents with one certificate load
- Individual success/failure tracking
- Progress updates during signing

### Download Options
- Download all successful signatures
- Download individual signatures
- Automatic .cms file naming

### Error Handling
- Certificate loading errors
- Individual document signing errors
- Network error handling
- User-friendly error messages

## Testing the Implementation

### Test 1: Load Certificate
1. Prepare a .p12 certificate file
2. Load it in the UI
3. Verify certificate information is displayed correctly

### Test 2: Single Document Sign
1. Load certificate
2. Select one document
3. Click sign
4. Download and verify .cms file

### Test 3: Batch Sign (Multiple Documents)
1. Load certificate
2. Select 3-5 documents
3. Click batch sign
4. Verify all documents are signed
5. Download all signatures

### Test 4: Error Handling
1. Try loading with wrong password (should fail)
2. Try signing without certificate (should prompt)
3. Try signing without documents (should prompt)

## Technical Notes

### KalkanAPI Configuration
- Uses CMS (PKCS#7) signature format
- PEM encoding for input/output
- Signature type: Attached signature (document + signature)
- Each signing operation uses a fresh KalkanApi instance

### Security
- HTTPS recommended for production
- Passwords sent over secure connection
- No data persistence on server
- Certificate data only in memory during operation

### Performance
- Batch signing reuses certificate loading
- Single KalkanApi instance per batch
- Suitable for batches of 1-100 documents
- Large files (>50MB) may take longer

## Troubleshooting

### Certificate Issues (Most Common)

**"ERROR 0x8f00040: not found root or intermediate certificate":**
- **Solution:** Install Kazakhstan PKI root certificates
- Run: `.\install-kz-pki-certificates.ps1` as Administrator
- See [CERTIFICATE_INSTALLATION.md](./CERTIFICATE_INSTALLATION.md) for details
- **After installation:** Restart the backend application

**"Invalid password or corrupted keystore file":**
- Verify the password is correct
- Check that the .p12/.pfx file is not corrupted
- Try opening the file with certutil: `certutil -dump yourfile.p12`

**"Failed to load certificate":**
- Ensure your certificate was issued by Kazakhstan NCA
- Verify the certificate hasn't expired
- Check that KalkanCrypt DLLs are in the output folder

### Backend Issues

**"Service not registered" error:**
- Check `Program.cs` has `builder.Services.AddScoped<DocumentSignService>();`
- Rebuild the project: `dotnet build`

**"KalkanApi not found":**
- Verify NKalkan package is installed
- Check .csproj includes: `<PackageReference Include="NKalkan" Version="0.7.0" />`
- Ensure KalkanCrypt DLLs are copied to output: Check `.csproj` has the `<None Include>` section

**"KalkanCrypt.dll not found":**
- Verify `KalkanCrypt\*.dll` files exist in Backend folder
- Rebuild: `dotnet clean` then `dotnet build`
- Check output folder: `Backend\bin\Debug\net8.0\` should contain the DLL files

### Frontend Issues

**"Cannot find module" error:**
```bash
cd Frontend
npm install
```

**CORS errors:**
- Check backend `Program.cs` CORS settings
- Ensure frontend URL is in allowed origins

**API connection failed:**
- Verify backend is running on port 5000
- Check `batchSignApiService.js` API_BASE_URL

## Next Steps

1. **Test with your certificates** - Use real .p12 files
2. **Customize UI** - Adjust styles in BatchSignModule.jsx
3. **Add features** - Implement additional signature formats
4. **Deploy** - Configure for production environment
5. **Monitor** - Add logging and analytics

## Support

For detailed API documentation, see [BATCH_SIGNING_README.md](./BATCH_SIGNING_README.md)
