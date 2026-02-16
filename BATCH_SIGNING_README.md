# Batch Document Signing with KalkanAPI

This document describes the batch document signing functionality implemented in the EdsNcaLayer application.

## Overview

The batch signing feature allows you to sign multiple documents at once using a certificate stored in a keystore file (PKCS12, JKS, etc.). This functionality is implemented using the KalkanAPI library and provides both backend API and frontend UI.

## Architecture

### Backend Components

1. **Models** (`Backend/Models/`)
   - `SignRequest.cs` - Single document signing request
   - `SignResponse.cs` - Single document signing response with certificate info
   - `BatchSignRequest.cs` - Batch signing request with multiple documents
   - `BatchSignResponse.cs` - Batch signing response with individual results

2. **Service** (`Backend/Services/`)
   - `DocumentSignService.cs` - Core signing logic using KalkanAPI
     - `SignDocument()` - Signs a single document
     - `SignDocumentsBatch()` - Signs multiple documents in one operation
     - `GetCertificateInfo()` - Retrieves certificate information

3. **Controller** (`Backend/Controllers/`)
   - `SignController.cs` - REST API endpoints
     - `POST /api/sign` - Sign single document
     - `POST /api/sign/batch` - Sign multiple documents
     - `POST /api/sign/certificate/info` - Get certificate information

### Frontend Components

1. **Service** (`Frontend/src/services/`)
   - `batchSignApiService.js` - API client for batch signing
     - `fileToBase64()` - Convert files to Base64
     - `getCertificateInfo()` - Load certificate information
     - `signDocument()` - Sign single document
     - `signDocumentsBatch()` - Sign multiple documents
     - `downloadBase64File()` - Download signed documents

2. **Component** (`Frontend/src/components/`)
   - `BatchSignModule.jsx` - Complete UI for batch signing
     - Certificate/keystore loading
     - Password input with validation
     - Multiple document selection
     - Batch signing execution
     - Results display and download

## Usage

### Step 1: Start the Backend

```bash
cd Backend
dotnet run
```

The API will be available at `http://localhost:5000`

### Step 2: Start the Frontend

```bash
cd Frontend
npm install
npm run dev
```

The UI will be available at `http://localhost:5173`

### Step 3: Batch Sign Documents

1. **Open the Batch Sign Tab**
   - Click on "Batch Sign" button in the main interface

2. **Load Certificate**
   - Select storage type (PKCS12, JKS, or KazToken)
   - Choose your keystore file (.p12, .pfx, or .jks)
   - Enter the keystore password
   - (Optional) Enter certificate alias if your keystore contains multiple certificates
   - Click "Load Certificate" button
   - Certificate information will be displayed

3. **Select Documents**
   - Click "Select Documents" and choose one or more files to sign
   - The list of selected documents will be displayed
   - You can clear and reselect documents if needed

4. **Sign Documents**
   - Click "Sign X Document(s)" button
   - The system will sign all documents using the loaded certificate
   - Progress will be shown during signing

5. **Download Signed Documents**
   - After signing, results will be displayed for each document
   - **Download All**: Click this button to download all successfully signed documents
   - **Individual Download**: Click "Download" next to each successful result
   - Signed documents will have `.cms` extension

## API Reference

### POST /api/sign

Signs a single document.

**Request:**
```json
{
  "documentBase64": "base64_encoded_document",
  "keyStoreBase64": "base64_encoded_keystore",
  "password": "keystore_password",
  "storageType": "PKCS12",
  "certificateAlias": "optional_alias"
}
```

**Response:**
```json
{
  "signatureBase64": "base64_encoded_signature",
  "success": true,
  "message": "Document signed successfully",
  "certificateInfo": {
    "subject": "CN=User Name",
    "issuer": "CN=Issuer",
    "serialNumber": "123456",
    "validFrom": "2024-01-01",
    "validTo": "2026-01-01"
  }
}
```

### POST /api/sign/batch

Signs multiple documents in batch.

**Request:**
```json
{
  "documents": [
    {
      "fileName": "document1.pdf",
      "documentBase64": "base64_encoded_document1"
    },
    {
      "fileName": "document2.txt",
      "documentBase64": "base64_encoded_document2"
    }
  ],
  "keyStoreBase64": "base64_encoded_keystore",
  "password": "keystore_password",
  "storageType": "PKCS12",
  "certificateAlias": "optional_alias"
}
```

**Response:**
```json
{
  "totalDocuments": 2,
  "successCount": 2,
  "failedCount": 0,
  "message": "Batch signing completed. Success: 2, Failed: 0",
  "results": [
    {
      "fileName": "document1.pdf",
      "signatureBase64": "base64_encoded_signature1",
      "success": true,
      "errorMessage": null
    },
    {
      "fileName": "document2.txt",
      "signatureBase64": "base64_encoded_signature2",
      "success": true,
      "errorMessage": null
    }
  ]
}
```

### POST /api/sign/certificate/info

Gets certificate information without signing.

**Request:**
```json
{
  "keyStoreBase64": "base64_encoded_keystore",
  "password": "keystore_password",
  "storageType": "PKCS12",
  "certificateAlias": "optional_alias"
}
```

**Response:**
```json
{
  "subject": "CN=User Name",
  "issuer": "CN=Issuer",
  "serialNumber": "123456",
  "validFrom": "2024-01-01",
  "validTo": "2026-01-01"
}
```

## Supported Storage Types

- **PKCS12** - Most common format (.p12, .pfx files)
- **JKS** - Java KeyStore format (.jks files)
- **KAZTOKEN** - Hardware token storage

## Features

✅ **Batch Processing**: Sign multiple documents with one certificate load
✅ **Certificate Validation**: View certificate information before signing
✅ **Error Handling**: Individual error tracking for each document
✅ **Progress Tracking**: Real-time feedback during batch operations
✅ **Download Management**: Download all or individual signed documents
✅ **Secure**: Password and certificate data never stored on server
✅ **Format Support**: Works with any document format that can be converted to Base64

## Security Considerations

- The keystore and password are sent to the backend via HTTPS
- KalkanAPI is used for all cryptographic operations
- Signed documents are in CMS (PKCS#7) format
- No sensitive data is persisted on the server
- Each signing operation creates a fresh KalkanApi instance

## Troubleshooting

### "Failed to load certificate"
- Check that the keystore file is valid
- Verify the password is correct
- Ensure the storage type matches your file format

### "Signing error"
- Verify that the certificate is valid and not expired
- Check that the certificate has signing capabilities
- Ensure the document format is supported

### Backend not accessible
- Make sure the backend is running on `http://localhost:5000`
- Check CORS settings in `Program.cs`
- Verify firewall settings

## Example Use Cases

1. **Signing Multiple Contracts**: Load certificate once, sign all contracts in batch
2. **Document Approval Workflow**: Sign multiple approval documents simultaneously
3. **Bulk Certificate Application**: Apply digital signature to batches of official documents

## Technical Details

- **Backend Framework**: .NET 8.0, ASP.NET Core
- **Frontend Framework**: React 18
- **Cryptography Library**: NKalkan (KalkanAPI wrapper)
- **Signature Format**: CMS (PKCS#7) in PEM encoding
- **Request Size Limit**: 500MB for batch operations

## Future Enhancements

- [ ] Support for detached signatures
- [ ] Parallel signing for better performance
- [ ] Signature verification for batch operations
- [ ] Support for other signature formats (XML, WSSE)
- [ ] Progress percentage for large batches
- [ ] Batch signing history
