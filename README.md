# EdsNcaLayer

Overview
-
EdsNcaLayer is a web application for digital signature operations using Kazakhstan's EDS PKI infrastructure.

**Architecture:**
- **Signing**: Performed via **NCALayer** WebSocket (local installation **mandatory**)
- **Verification**: Performed via **ezsigner.kz/checkSign** external API endpoint
- **Document Extraction**: Performed via **ezsigner.kz/extractSrc** external API endpoint
- **Backend**: ASP.NET Core 10.0 API (proxies verification and extraction requests)
- **Frontend**: React 18 web interface

Repository structure
-
- [Backend](Backend) — ASP.NET Web API project (controller: `VerifyController`).
- [Frontend](Frontend) — JavaScript app (React entry points in `src/`).
- `EdsNcaLayer.sln` — Visual Studio solution file.

Prerequisites
-
### Required Software
- **.NET SDK 10.0+** - for backend API
- **Node.js 20.19+ or 22.12+** - for frontend development
- **npm 10+** - comes with Node.js

### Mandatory for Signing Operations
- **NCALayer** (v1.4+) - **MUST be installed and running locally**
  - WebSocket endpoint: `wss://127.0.0.1:13579`
  - Download: [pki.gov.kz](https://pki.gov.kz/)
  - Verify installation: Open `https://127.0.0.1:13579` in browser
  - Status: **Required** - signing will not work without NCALayer

### External API Dependencies
- **ezsigner.kz** - used for verification and extraction
  - Verification endpoint: `https://ezsigner.kz/checkSign`
  - Extraction endpoint: `https://ezsigner.kz/extractSrc`
  - Status: **Required** - internet connection needed for verification/extraction

### Optional
- **Valid EDS Certificate** (.p12 / .pfx) with password

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
1. **User uploads .cms signature file** in Frontend UI
2. **Frontend sends to Backend** API (`POST /api/verify`)
3. **Backend forwards to ezsigner.kz/checkSign** with signature bytes
4. **ezsigner.kz validates** signature and returns signer information
5. **Results displayed** in Frontend (certificate details, validity status)

**Note**: Requires internet connection to reach ezsigner.kz API.

### Extraction Workflow
1. **User clicks "Extract Document" button** after successful verification
2. **Frontend sends .cms file to Backend** (`POST /api/verify/extract`)
3. **Backend forwards to ezsigner.kz/extractSrc** with signature bytes
4. **ezsigner.kz extracts** original document from CMS container
5. **Document downloaded** with original filename (without .cms extension)

**Note**: Requires internet connection to reach ezsigner.kz API.

Notes for development
-
- The backend is located in [Backend](Backend). See `Program.cs` and `Controllers` for startup and routing.
- The frontend is in [Frontend](Frontend). Adjust proxy settings or CORS if calling the API from the dev server.
- Built artifacts for the backend (debug) are in `Backend/bin/Debug/net10.0/`.
- **NCALayer Integration**: Frontend communicates with NCALayer via WebSocket on port 13579.
- **External APIs**: Backend proxies requests to ezsigner.kz for verification and extraction.

Troubleshooting
-

### NCALayer Issues
- **"NCALayer not available" or signing fails**
  - Confirm NCALayer is installed from [pki.gov.kz](https://pki.gov.kz/)
  - Restart NCALayer app if needed
  - Verify firewall allows port 13579

### Verification/Extraction Issues
- **"Failed to verify" or "Extraction error"**
  - Confirm internet connection is active
  - Check if ezsigner.kz is accessible: `curl https://ezsigner.kz/checkSign`
  - Backend must be able to reach external APIs

### General Issues
- If ports conflict, change the Kestrel/launch settings or the frontend dev server port.
- For API route mismatches, inspect controller attributes in [Backend/Controllers](Backend/Controllers).
- For CORS errors, verify Backend allows Frontend origin in `Program.cs`

