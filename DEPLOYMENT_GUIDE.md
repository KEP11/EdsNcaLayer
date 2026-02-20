# EdsNcaLayer Deployment Guide

## Build machine prerequisites
- .NET SDK 8.0+
- Node.js 20.19+ or 22.12+
- npm 10+
- PowerShell 5.1+

## Create distribution package
From repository root:

```powershell
.\build-package.ps1
```

Artifacts:
- `Distribution/`
- `EdsNcaLayer-<version>.zip`

## Target machine prerequisites
- Windows 10/11 (x64)
- NCALayer installed and running
- Kazakhstan PKI root/intermediate certificates installed

## Install on target machine
1. Copy and extract package
2. Open PowerShell as Administrator
3. Install PKI certs:

```powershell
.\install-kz-pki-certificates.ps1
```

4. Run installer:

```powershell
.\install.ps1
```

Optional custom path:

```powershell
.\install.ps1 -InstallPath "D:\MyApps\EdsNcaLayer"
```

## Start application
Use generated start script from install folder:

```powershell
.\start.ps1
```

## Runtime endpoints (current backend config)
- Backend API: `http://localhost:5000`
- Swagger UI: `http://localhost:5000` (root path)
- Frontend dev (source mode): `http://localhost:5173`

## Validation checklist
- Backend responds at `http://localhost:5000`
- Swagger opens at `http://localhost:5000`
- NCALayer is running and reachable
- Sign/verify/extract flows work in UI

## Troubleshooting
- Backend fails: verify .NET runtime and `KalkanCrypt.dll`
- Frontend fails in dev: run `npm install` in `Frontend/`
- NCALayer errors: ensure app is running and local websocket is reachable
- PKI chain errors: reinstall certs via `install-kz-pki-certificates.ps1`
