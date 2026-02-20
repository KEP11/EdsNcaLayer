# CMS Verification Guide (Current Implementation)

## Overview
There are two verification paths in this repository:

1. **Frontend UI verification (active path):**
   - Uses NCALayer WebSocket directly (`checkCMS`)
   - Supports single verification + batch verification in UI

2. **Backend API verification (available endpoint):**
   - `POST /api/sign/verify`
   - Implemented in `SignController` / `DocumentSignService`

## UI verification (what users currently use)
### Single verification
1. Open `http://localhost:5173`
2. Go to **Verify Document**
3. Click **Choose File (.cms)**
4. Click **Check**
5. Review signer details and validation statuses

### Batch verification
1. In **Batch Verify Documents**, click **Add File** (repeat per file)
2. Click **Verify Batch**
3. Review per-file results and signer cards

Note: NCALayer file picker is single-select; files are added one by one.

## Extraction from CMS
After successful single verification, click **Извлечь документ**.
Frontend calls NCALayer `saveCMS` and shows extracted path.

## Backend API verification
Endpoint: `POST /api/sign/verify`

Request:
```json
{
  "cmsSignatureBase64": "MII...",
  "originalDocumentBase64": "optional_base64",
  "keyStoreBase64": "optional_base64",
  "password": "optional",
  "storageType": "PKCS12"
}
```

Response:
```json
{
  "success": true,
  "message": "Signature verified successfully",
  "verificationInfo": "...",
  "resultData": "..."
}
```

## Common issues
- `NCALayer not connected`: ensure NCALayer is running locally
- `Root/intermediate certificate` errors: install Kazakhstan PKI certificates (see `CERTIFICATE_INSTALLATION.md`)

## Related files
- `Frontend/src/App.jsx`
- `Frontend/src/services/verifyService.js`
- `Frontend/src/services/batchVerifyService.js`
- `Backend/Controllers/SignController.cs`
- `Backend/Services/DocumentSignService.cs`
