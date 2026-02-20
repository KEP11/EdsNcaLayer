# Batch Signing (Current State)

## Important status
Backend batch signing API is implemented.
Frontend batch signing UI is currently hidden (`showBatchSign = false` in `Frontend/src/App.jsx`).

This means:
- API consumers can use backend batch signing now
- End users in current web UI do not see batch signing section

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
Frontend currently performs user-facing signing through NCALayer directly (WebSocket), not through this batch API module.

## Related files
- `Backend/Controllers/SignController.cs`
- `Backend/Services/DocumentSignService.cs`
- `Frontend/src/services/batchSignApiService.js` (available, but UI path is hidden)
