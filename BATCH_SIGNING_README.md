# Batch Signing (Current State)

## Current status
Backend batch signing API is implemented and exposed.
Frontend batch signing UI is available through `BatchSignModule` in the **Batch Sign** tab.

This means:
- API consumers can use backend batch signing directly
- End users can batch sign from the current web UI

## Backend endpoint
`POST /api/sign/batch`

Controller: `Backend/Controllers/SignController.cs`
Service: `Backend/Services/DocumentSignService.cs`

## Request example
```json
{
  "documents": [
    {
      "fileName": "doc1.pdf",
      "documentBase64": "JVBER..."
    },
    {
      "fileName": "doc2.txt",
      "documentBase64": "SGVsbG8..."
    }
  ],
  "keyStoreBase64": "MII...",
  "password": "your_password",
  "storageType": "PKCS12"
}
```

## Response example
```json
{
  "totalDocuments": 2,
  "successCount": 2,
  "failedCount": 0,
  "message": "Batch signing completed. Success: 2, Failed: 0",
  "results": [
    {
      "fileName": "doc1.pdf",
      "signatureBase64": "MII...",
      "success": true,
      "errorMessage": null
    }
  ]
}
```

## Test via PowerShell
```powershell
$body = @{
  documents = @(
    @{ fileName = 'doc1.txt'; documentBase64 = 'SGVsbG8=' }
  )
  keyStoreBase64 = '...'
  password = '...'
  storageType = 'PKCS12'
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri 'http://localhost:5000/api/sign/batch' -Method Post -ContentType 'application/json' -Body $body
```

## Frontend note
`BatchSignModule` uses backend API (`/api/sign/batch`) for batch signing workflow.
Single-sign and verification workflows use NCALayer WebSocket in other modules.

## Related files
- `Backend/Controllers/SignController.cs`
- `Backend/Services/DocumentSignService.cs`
- `Frontend/src/components/BatchSignModule.jsx`
- `Frontend/src/services/batchSignApiService.js`
