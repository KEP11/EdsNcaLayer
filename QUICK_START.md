# EdsNcaLayer Quick Start

## What is implemented now
- Frontend (React + Vite) uses NCALayer WebSocket for:
  - Sign one document
  - Verify one CMS
  - Extract original document from CMS
  - Batch verify CMS files (sequentially)
- Frontend also supports Batch Sign through `BatchSignModule` (calls backend API)
- Backend (ASP.NET Core 8) provides API endpoints in `SignController`:
  - `POST /api/sign/batch`
  - `POST /api/sign/certificate/info`
  - `POST /api/sign/verify`

## Prerequisites
- .NET SDK 8.0+
- Node.js 20.19+ or 22.12+
- npm 10+
- NCALayer installed and running (`wss://127.0.0.1:13579`)
- Kazakhstan PKI cert chain installed (see `CERTIFICATE_INSTALLATION.md`)

## Fastest run (recommended)
From repository root:

```powershell
.\start-app.ps1
```

Expected services:
- Backend API: `http://localhost:5000`
- Frontend: `http://localhost:5173`
- Swagger UI: `http://localhost:5000` (served at root)

## Manual run
### Backend
```powershell
cd Backend
dotnet restore
dotnet run --project EdsWebApi.csproj
```

### Frontend
```powershell
cd Frontend
npm install
npm run dev
```

## Current UI flow
### Sign one document
1. Open app (`http://localhost:5173`)
2. Go to **Sign Document**
3. Choose file through NCALayer picker
4. Click **Sign Document**

### Verify / extract
1. Go to **Verify Document**
2. Choose CMS file
3. Click **Check** to verify
4. Click **Извлечь документ** to extract original file

### Batch verify
1. In **Batch Verify Documents**, click **Add File** repeatedly
2. Click **Verify Batch**
3. Review per-file result and signer details

### Batch sign
1. Go to **Batch Sign** tab
2. Load keystore and password
3. Select one or more documents
4. Click **Sign X Document(s)**
5. Download produced `.cms` files

## Troubleshooting
- NCALayer connection issues:
  - Ensure NCALayer is running
  - Check local endpoint `wss://127.0.0.1:13579`
- Frontend won’t start:
  - `cd Frontend && npm install`
- Backend won’t start:
  - `cd Backend && dotnet restore`
  - Verify .NET 8 SDK
