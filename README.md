# EdsNcaLayer

## Overview
EdsNcaLayer is a local digital-signature application for Kazakhstan PKI workflows.

Current architecture:
- Frontend (React + Vite) performs signing/verification/extraction through NCALayer WebSocket (`wss://127.0.0.1:13579`)
- Backend (ASP.NET Core 8) exposes API endpoints for signing/verification scenarios with NKalkan
- NCALayer must be installed and running for frontend operations

## Repository Structure
- [Backend](Backend) — ASP.NET Core Web API (`EdsWebApi.csproj`)
- [Frontend](Frontend) — React application
- [Frontend/src/services](Frontend/src/services) — modular frontend services
  - [common.js](Frontend/src/services/common.js)
  - [signService.js](Frontend/src/services/signService.js)
  - [verifyService.js](Frontend/src/services/verifyService.js)
  - [extractService.js](Frontend/src/services/extractService.js)
  - [batchVerifyService.js](Frontend/src/services/batchVerifyService.js)
  - [batchSignService.js](Frontend/src/services/batchSignService.js)
- [start-app.ps1](start-app.ps1) — starts backend and frontend together
- [run-edsnca-ui.ps1](run-edsnca-ui.ps1) — starts frontend only

## Prerequisites
- .NET SDK 8.0+
- Node.js 20.19+ or 22.12+
- npm 10+
- NCALayer (required for frontend flows)
  - endpoint: `wss://127.0.0.1:13579`
  - download: https://ncl.pki.gov.kz/

## Frontend Features (Current)
- Sign document via NCALayer (`signFilePath`)
- Verify CMS signature via NCALayer (`checkCMS`)
- Extract original document from CMS via NCALayer (`saveCMS`)
- Batch verify CMS files (sequentially)
- Batch sign section exists in code but is hidden in UI by feature flag (`showBatchSign = false` in [Frontend/src/App.jsx](Frontend/src/App.jsx))

## Backend Features (Current)
Backend runs on `http://localhost:5000` and exposes Swagger at `/`.

Implemented controller:
- [SignController](Backend/Controllers/SignController.cs)

Available endpoints:
- `POST /api/sign/batch` — batch sign multiple documents
- `POST /api/sign/certificate/info` — load certificate info from keystore
- `POST /api/sign/verify` — verify CMS signature

## Run (Recommended)
Start both services:

```powershell
.\start-app.ps1
```

Expected:
- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`

## Run Frontend Only

```powershell
.\run-edsnca-ui.ps1
```

or

```powershell
cd Frontend
npm install
npm run dev
```

## Run Backend Only

```powershell
cd Backend
dotnet restore
dotnet run --project EdsWebApi.csproj
```

## Notes
- Frontend currently communicates directly with NCALayer for UI operations.
- If NCALayer is not running, frontend signing/verification/extraction will fail.
- Backend and frontend are now modularized and can evolve independently.

## Troubleshooting
- NCALayer connection errors:
  - ensure NCALayer is running
  - check local access to `wss://127.0.0.1:13579`
- Frontend not starting:
  - re-run `npm install` in [Frontend](Frontend)
- Backend not starting:
  - re-run `dotnet restore` in [Backend](Backend)
  - verify .NET 8 SDK installed
