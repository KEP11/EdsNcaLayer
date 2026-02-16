# EdsNcaLayer - Deployment Guide

## For Developers: Building Distribution Package

### Prerequisites (Build Machine)
- .NET SDK 8.0+
- Node.js 20.19+ or 22.12+
- npm 10+
- PowerShell 5.1+

### Build Steps

1. Open PowerShell in project root directory

2. Run build script:
```powershell
.\build-package.ps1
```

3. Wait for build to complete (usually 2-5 minutes)

4. Find the output:
   - **Distribution/** folder - Uncompressed package
   - **EdsNcaLayer-[version].zip** - Compressed archive

### What's Included in Package

```
Distribution/
├── Backend/
│   ├── EdsWebApi.exe          # Main executable
│   ├── KalkanCrypt.dll         # Cryptography SDK (CRITICAL)
│   └── *.dll                   # All .NET runtime & dependencies
├── Frontend/
│   ├── index.html              # Entry point
│   └── assets/                 # JS, CSS bundles
├── install.ps1                 # Installation script
├── start.ps1                   # Startup script (created during install)
├── install-kz-pki-certificates.ps1
├── README.md
├── QUICK_START.md
├── CERTIFICATE_INSTALLATION.md
├── PACKAGE_README.md           # Instructions for target PC
└── version.json                # Build information
```

### Package Size
Approximately **80-150 MB** (includes .NET runtime)

---

## For IT/Users: Installing on Target PC

### System Requirements

**Target PC:**
- Windows 10 (64-bit) or Windows 11
- 500 MB free disk space
- Administrator privileges (for installation)

**MANDATORY External Software:**
- **NCALayer** (v1.4+) - Download: https://ncl.pki.gov.kz/
- **Kazakhstan PKI Root Certificates** - Included in package

**NOT Required on Target PC:**
- ❌ .NET SDK (runtime is included in package)
- ❌ Node.js (frontend is pre-built static files)
- ❌ npm (not needed)
- ❌ Visual Studio
- ❌ Development tools

### Installation Procedure

#### Step 1: Prepare Target PC

1. **Install NCALayer:**
   - Download from https://ncl.pki.gov.kz/
   - Install and run
   - Verify icon appears in system tray

2. **Verify NCALayer is running:**
   - Check system tray for NCALayer icon
   - Icon should be active (not grayed out)

3. **(Optional) Install Node.js for better frontend experience:**
   - Download from https://nodejs.org/ (LTS version)
   - Only needed if you want to use `npx serve` for serving frontend
   - Not required - frontend can also open directly in browser

#### Step 2: Copy Package

1. Copy `EdsNcaLayer-[version].zip` to target PC
2. Extract to temporary location (e.g., `C:\Temp\EdsNcaLayer`)

#### Step 3: Install PKI Certificates

**CRITICAL: This must be done BEFORE running application**

1. Open PowerShell **as Administrator**
2. Navigate to extracted folder:
```powershell
cd "C:\Temp\EdsNcaLayer"
```

3. Run certificate installation:
```powershell
.\install-kz-pki-certificates.ps1
```

4. Restart PowerShell after installation

#### Step 4: Run Installation Script

1. Open PowerShell **as Administrator** (new window after restart)
2. Navigate to extracted folder
3. Run installer:

```powershell
.\install.ps1
```

**For custom installation path:**
```powershell
.\install.ps1 -InstallPath "D:\MyApps\EdsNcaLayer"
```

4. Follow prompts:
   - Confirm overwrite if directory exists
   - Choose whether to create desktop shortcut

#### Step 5: Start Application

**Option A: Using Desktop Shortcut**
- Double-click "EdsNcaLayer" shortcut on desktop (if created)

**Option B: Using PowerShell**
```powershell
cd "C:\Program Files\EdsNcaLayer"
.\start.ps1
```

**Option C: Manual Start**
```powershell
cd "C:\Program Files\EdsNcaLayer\Backend"
.\EdsWebApi.exe
```
Then open `Frontend\index.html` in web browser

#### Step 6: Access Application

Open web browser and navigate to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Swagger UI**: http://localhost:5000/swagger

---

## Uninstallation

To remove the application:

1. Stop running application (close PowerShell window or Ctrl+C)
2. Delete installation folder:
```powershell
Remove-Item "C:\Program Files\EdsNcaLayer" -Recurse -Force
```
3. Delete desktop shortcut (if created)
4. (Optional) Uninstall NCALayer using Windows Settings

**Note:** PKI certificates remain installed and can be used by other applications.

---

## Troubleshooting Installation

### Build Issues (Developer)

**"dotnet command not found"**
- Install .NET SDK 8.0+: https://dotnet.microsoft.com/download

**"npm command not found"**
- Install Node.js 20.19+: https://nodejs.org/

**"KalkanCrypt.dll not found in output"**
- Verify `Backend/KalkanCrypt.dll` exists in source
- Check `.csproj` has `<None Include="KalkanCrypt.dll" CopyToOutputDirectory="PreserveNewest" />`
- Clean and rebuild: `dotnet clean && dotnet build`

### Installation Issues (Target PC)

**"Access denied" during installation**
- Run PowerShell as Administrator
- Check disk space (need 500+ MB free)
- Try custom installation path in user directory

**"Backend won't start"**
- Verify KalkanCrypt.dll is in `Backend/` folder
- Check `Backend/EdsWebApi.exe` exists
- Run as Administrator
- Check Windows Event Viewer for errors

**"Frontend doesn't open"**
- If you have Node.js installed: `npx serve -s Frontend -l 5173`
- Or use any web server pointing to `Frontend/` folder
- Or open `Frontend/index.html` directly in browser (note: some features may not work with file:// protocol)

**"Certificate errors" (0x8f00040)**
- Run `install-kz-pki-certificates.ps1` as Administrator
- Restart application after certificate installation
- See CERTIFICATE_INSTALLATION.md for manual steps

**"NCALayer connection failed"**
- Verify NCALayer is installed and running
- Check system tray for NCALayer icon
- Restart NCALayer application
- Check firewall allows port 13579

### Runtime Issues

**"Port already in use"**
- Backend (5000): Another application is using port
- Frontend (5173): Another web server is running
- Change ports in configuration or stop conflicting application

**"Signing fails"**
- Verify NCALayer is running (check system tray)
- Insert token/smart card if using hardware
- Check certificate in NCALayer settings
- Verify certificate password is correct

**"Verification fails with certificate error"**
- Ensure PKI certificates are installed
- Restart backend after certificate installation
- Check certificate expiration date

---

## Network Deployment

### Multiple PC Installation

**Option 1: Network Share**
1. Place ZIP on network share (e.g., `\\Server\Software\EdsNcaLayer.zip`)
2. Each PC copies and extracts locally
3. Run installation on each PC individually

**Option 2: Silent Installation Script**
Create batch deployment script:
```powershell
# deploy-multiple.ps1
$targetPCs = @("PC01", "PC02", "PC03")
$sourcePath = "\\Server\Software\EdsNcaLayer.zip"
$installPath = "C:\Program Files\EdsNcaLayer"

foreach ($pc in $targetPCs) {
    Invoke-Command -ComputerName $pc -ScriptBlock {
        param($src, $dest)
        Copy-Item $src "C:\Temp\EdsNcaLayer.zip"
        Expand-Archive "C:\Temp\EdsNcaLayer.zip" -DestinationPath "C:\Temp\EdsNcaLayer"
        & "C:\Temp\EdsNcaLayer\install.ps1" -InstallPath $dest
    } -ArgumentList $sourcePath, $installPath
}
```

**Option 3: Group Policy Deployment**
- Create MSI installer (requires WiX Toolset)
- Deploy via Active Directory Group Policy
- Automate certificate installation

---

## Version Updates

To update existing installation:

1. Stop running application
2. Run new `install.ps1` with same path
3. Confirm overwrite when prompted
4. Start application with new version

**Alternative: Side-by-side installation**
```powershell
.\install.ps1 -InstallPath "C:\Program Files\EdsNcaLayer-v2"
```

---

## Security Considerations

### Permissions

**Installation folder:**
- Default: `C:\Program Files\EdsNcaLayer`
- Requires Administrator to write
- Runtime: Normal user can execute

**Backend executable:**
- Runs under current user context
- No elevation required after installation
- Access to local NCALayer via localhost only

**Certificates:**
- Stored in Windows Certificate Store (system-wide)
- Installation requires Administrator
- Usage: Normal user can access

### Firewall

**Outbound connections:**
- None required (application works offline)
- NCALayer: localhost only (no network)

**Inbound connections:**
- Backend: 5000 (localhost only, no external access)
- Frontend: 5173 (localhost only, no external access)

**No firewall rules needed** - all communication is localhost only.

---

## Support & Documentation

**Included Documentation:**
- `README.md` - Complete application documentation
- `QUICK_START.md` - Quick start guide with examples
- `CERTIFICATE_INSTALLATION.md` - Detailed certificate setup
- `PACKAGE_README.md` - Distribution package overview
- `version.json` - Build version and information

**Online Resources:**
- NCALayer: https://ncl.pki.gov.kz/
- Kazakhstan PKI: https://pki.gov.kz/

---

## Checklist

### Pre-Deployment (Developer)
- [ ] Source code is up to date
- [ ] All tests pass
- [ ] .NET SDK 8.0+ installed
- [ ] Node.js 20.19+ installed
- [ ] Run `.\build-package.ps1`
- [ ] Verify `KalkanCrypt.dll` in output
- [ ] Test installation on clean VM
- [ ] Create deployment documentation

### Installation (Target PC)
- [ ] Windows 10/11 64-bit
- [ ] 500+ MB free disk space
- [ ] NCALayer installed and running
- [ ] Extract distribution package
- [ ] Run `install-kz-pki-certificates.ps1` as Admin
- [ ] Run `install.ps1` as Admin
- [ ] Test startup with `start.ps1`
- [ ] Verify http://localhost:5173 opens
- [ ] Test signing with real certificate

### Post-Installation Verification
- [ ] Backend API responds (http://localhost:5000/swagger)
- [ ] Frontend loads correctly
- [ ] NCALayer connection works
- [ ] Can select certificate
- [ ] Can sign test document
- [ ] Can verify signed document
- [ ] No certificate errors in logs

---

**Last Updated:** February 16, 2026  
**Package Version Format:** YYYY.MM.DD.HHmm  
**Support:** See README.md and included documentation
