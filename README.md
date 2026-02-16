# EdsNcaLayer

Overview
-
EdsNcaLayer is a web application for digital signature operations using Kazakhstan's EDS PKI infrastructure.

**Architecture:**
- **Signing**: Performed via **NCALayer** WebSocket (local installation **mandatory**)
- **Verification**: Performed via **NCALayer** WebSocket connection
- **Document Extraction**: Performed via **NCALayer** WebSocket connection
- **Backend**: ASP.NET Core 8.0 API
- **Frontend**: React 18 web interface

Repository structure
-
- [Backend](Backend) — ASP.NET Web API project (controller: `SignController`).
- [Frontend](Frontend) — JavaScript app (React entry points in `src/`).
- `EdsNcaLayer.sln` — Visual Studio solution file.
- `start-app.ps1` — PowerShell script to run both Backend and Frontend services.
- `build-package.ps1` — PowerShell script to create distribution package.

Prerequisites
-
### Required Software
- **.NET SDK 8.0+** - for backend API
- **Node.js 20.19+ or 22.12+** - for frontend development
- **npm 10+** - comes with Node.js

### Mandatory for All Operations
- **NCALayer** (v1.4+) - **MUST be installed and running locally**
  - WebSocket endpoint: `wss://127.0.0.1:13579`
  - Download: [ncl.pki.gov.kz](https://ncl.pki.gov.kz/)
  - Verify installation: Check system tray for NCALayer icon, or try connecting from the application
  - Status: **Required** - signing, verification, and extraction operations require NCALayer

### Mandatory for Sign Operations
- **Valid EDS Certificate** (.p12) with password

Quick Start
-
### Using the Startup Script (Recommended)

The easiest way to run both Backend and Frontend services:

```powershell
.\start-app.ps1
```

**What this script does:**
- ✅ Verifies all prerequisites (.NET SDK, Node.js, npm)
- ✅ Restores Backend dependencies if needed (`dotnet restore`)
- ✅ Installs Frontend dependencies if needed (`npm install`)
- ✅ Starts Backend API on `http://localhost:5000`
- ✅ Starts Frontend Dev Server on `http://localhost:5173`
- ✅ Monitors both services and displays output
- ✅ Handles graceful shutdown with Ctrl+C

**After starting:**
- Backend API: http://localhost:5000
- Swagger UI: http://localhost:5000/swagger
- Frontend: http://localhost:5173

Press `Ctrl+C` to stop all services.

Backend (Development)
-
1. Open a terminal in [Backend](Backend).
2. Restore and build:

```powershell
dotnet restore
dotnet build
```

3. Run the API:

```powershell
dotnet run --project Backend/EdsWebApi.csproj
```

4. The API project exposes controllers under the conventional routes. Check [Backend/Controllers](Backend/Controllers) for exact route attributes. 

Frontend (Development)
-
1. Open a terminal in [Frontend](Frontend).
2. Install dependencies and run the dev server:

```bash
npm install
# then one of:
npm start
# or
npm run dev
```

Check [Frontend/package.json](Frontend/package.json) for the exact scripts used by this project.

Architecture Overview
-

### Signing Workflow
1. **User selects file** in Frontend UI
2. **Frontend connects to NCALayer** via WebSocket (`wss://127.0.0.1:13579`)
3. **NCALayer handles signing** using local certificate storage (PKCS12, HSM, etc.)
4. **Signed CMS file** is returned and saved to disk

**Note**: NCALayer must be installed and running. Without it, signing operations will fail.

### Verification Workflow
1. **User selects .cms signature file** in Frontend UI
2. **Frontend sends verification request to NCALayer** via WebSocket
3. **NCALayer validates** signature using local certificate stores
4. **Results returned to Frontend** with signer information
5. **Details displayed** in Frontend (certificate details, validity status)

**Note**: Requires NCALayer to be installed and running locally.

### Extraction Workflow
1. **User clicks "Extract Document" button** after successful verification
2. **Frontend sends extraction request to NCALayer** via WebSocket
3. **NCALayer extracts** original document from CMS container
4. **Document returned to Frontend**
5. **Document downloaded** with original filename (without .cms extension)

**Note**: Requires NCALayer to be installed and running locally.

Deployment & Distribution
-

### Creating Distribution Package

To create a deployable package for installation on other PCs:

```powershell
.\build-package.ps1
```

**What this script does:**
- ✅ Builds Backend as self-contained deployment (includes .NET 8.0 runtime)
- ✅ Builds Frontend for production (optimized static files)
- ✅ Bundles all dependencies (KalkanCrypt.dll, etc.)
- ✅ Creates installation script
- ✅ Packages everything into a ZIP archive
- ✅ Generates documentation for target PC

**Output:**
- `Distribution/` folder - Ready-to-deploy package
- `EdsNcaLayer-[version].zip` - Compressed package

The resulting package is **self-contained** and includes:
- Backend API with .NET runtime (no SDK installation needed on target PC)
- Frontend production build (static files)
- All cryptography dependencies (KalkanCrypt.dll)
- Installation and startup scripts
- Documentation

### Installing on Target PC

**Prerequisites on Target PC:**
1. Windows 10/11 (64-bit)
2. NCALayer installed and running
3. Kazakhstan PKI certificates installed

**Installation Steps:**

1. Copy the ZIP file to target PC and extract
2. Run PowerShell as Administrator
3. Navigate to extracted folder
4. Run installation script:

```powershell
.\install.ps1
```

Or install to custom location:

```powershell
.\install.ps1 -InstallPath "D:\MyApps\EdsNcaLayer"
```

5. Install PKI certificates (if not already installed):

```powershell
.\install-kz-pki-certificates.ps1
```

6. Start the application:

```powershell
cd "C:\Program Files\EdsNcaLayer"
.\start.ps1
```

**Important Notes:**
- ❗ **No .NET SDK or Node.js required** on target PC (runtime is included)
- ❗ **NCALayer is MANDATORY** - must be installed separately
- ❗ **PKI certificates are MANDATORY** - run certificate installation script
- ✅ **Works offline** - no internet connection required for signing operations

For detailed installation instructions, see `PACKAGE_README.md` included in the distribution package.

Notes for development
-
- The backend is located in [Backend](Backend). See `Program.cs` and `Controllers` for startup and routing.
- The frontend is in [Frontend](Frontend). Adjust proxy settings or CORS if calling the API from the dev server.
- Built artifacts for the backend (debug) are in `Backend/bin/Debug/net8.0/`.
- **NCALayer Integration**: Frontend communicates with NCALayer via WebSocket on port 13579 for all signing, verification, and extraction operations.

Troubleshooting
-

### NCALayer Issues
- **"NCALayer not available" or signing fails**
  - Confirm NCALayer is installed from [pki.gov.kz](https://pki.gov.kz/)
  - Restart NCALayer app if needed
  - Verify firewall allows port 13579

### Verification/Extraction Issues
- **"Failed to verify" or "Extraction error"**
  - Confirm NCALayer is running
  - Check system tray for NCALayer icon
  - Restart NCALayer if needed
  - Verify the .cms file is valid and not corrupted

### General Issues
- If ports conflict, change the Kestrel/launch settings or the frontend dev server port.
- For API route mismatches, inspect controller attributes in [Backend/Controllers](Backend/Controllers).
- For CORS errors, verify Backend allows Frontend origin in `Program.cs`

