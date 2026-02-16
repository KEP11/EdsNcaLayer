#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Creates a distribution package for EdsNcaLayer application

.DESCRIPTION
    This script builds both Backend and Frontend for production deployment,
    creates a self-contained package with all dependencies included.
    The resulting package can be deployed to any Windows PC without requiring
    .NET SDK or Node.js installation.

.EXAMPLE
    .\build-package.ps1
    Creates distribution package in .\Distribution folder

.NOTES
    Requirements for building (on build machine):
    - .NET SDK 8.0+
    - Node.js 20.19+ or 22.12+
    - PowerShell 5.1+
#>

$ErrorActionPreference = "Stop"

# Color output functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Yellow
}

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "Backend"
$FrontendDir = Join-Path $ScriptDir "Frontend"
$DistDir = Join-Path $ScriptDir "Distribution"
$Version = Get-Date -Format "yyyy.MM.dd.HHmm"

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║        EdsNcaLayer Distribution Package Builder            ║
║                                                            ║
║  This will create a deployable package containing:        ║
║  • Backend API (self-contained, includes .NET runtime)    ║
║  • Frontend (production build)                            ║
║  • Installation scripts                                   ║
║  • Documentation                                          ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

Write-Info "Package version: $Version"

# Check prerequisites
Write-Step "Checking build prerequisites..."

try {
    $dotnetVersion = dotnet --version
    Write-Info ".NET SDK version: $dotnetVersion"
} catch {
    Write-Error-Custom ".NET SDK not found. Please install .NET SDK 8.0+"
    exit 1
}

try {
    $nodeVersion = node --version
    Write-Info "Node.js version: $nodeVersion"
} catch {
    Write-Error-Custom "Node.js not found. Please install Node.js 20.19+"
    exit 1
}

try {
    $npmVersion = npm --version
    Write-Info "npm version: $npmVersion"
} catch {
    Write-Error-Custom "npm not found"
    exit 1
}

Write-Success "All build tools available"

# Clean distribution directory
Write-Step "Cleaning distribution directory..."
if (Test-Path $DistDir) {
    Remove-Item $DistDir -Recurse -Force
    Write-Info "Removed existing distribution folder"
}
New-Item -ItemType Directory -Path $DistDir | Out-Null
Write-Success "Distribution directory ready: $DistDir"

# Build Backend (self-contained)
Write-Step "Building Backend (self-contained)..."
Push-Location $BackendDir
try {
    Write-Info "Restoring packages..."
    dotnet restore
    if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed" }
    
    Write-Info "Publishing self-contained deployment..."
    dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o (Join-Path $DistDir "Backend")
    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }
    
    Write-Success "Backend built successfully"
} catch {
    Write-Error-Custom "Backend build failed: $_"
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

# Verify KalkanCrypt.dll is copied
$kalkanDll = Join-Path $DistDir "Backend\KalkanCrypt.dll"
if (-not (Test-Path $kalkanDll)) {
    Write-Error-Custom "KalkanCrypt.dll not found in output. Build may have issues."
    exit 1
}
Write-Success "KalkanCrypt.dll verified in output"

# Build Frontend (production)
Write-Step "Building Frontend (production)..."
Push-Location $FrontendDir
try {
    Write-Info "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    
    Write-Info "Building production bundle..."
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm build failed" }
    
    # Copy built files to distribution
    $frontendBuildDir = Join-Path $FrontendDir "dist"
    if (-not (Test-Path $frontendBuildDir)) {
        throw "Frontend build output not found at: $frontendBuildDir"
    }
    
    $distFrontendDir = Join-Path $DistDir "Frontend"
    Copy-Item $frontendBuildDir $distFrontendDir -Recurse -Force
    Write-Success "Frontend built successfully"
} catch {
    Write-Error-Custom "Frontend build failed: $_"
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

# Create installation script
Write-Step "Creating installation files..."

$installScript = @'
#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Installs EdsNcaLayer application on the target system

.DESCRIPTION
    Installs and configures EdsNcaLayer application.
    No .NET SDK or Node.js required - all dependencies are included.

.EXAMPLE
    .\install.ps1
    Installs to default location: C:\Program Files\EdsNcaLayer

.EXAMPLE
    .\install.ps1 -InstallPath "D:\Apps\EdsNcaLayer"
    Installs to custom location

.PARAMETER InstallPath
    Installation directory (default: C:\Program Files\EdsNcaLayer)
#>

param(
    [string]$InstallPath = "C:\Program Files\EdsNcaLayer"
)

$ErrorActionPreference = "Stop"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║         EdsNcaLayer Application Installer                  ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

Write-Info "Installation path: $InstallPath"

# Check admin privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "Not running as Administrator. Installing to user directory may be required."
}

# Create installation directory
Write-Info "Creating installation directory..."
if (Test-Path $InstallPath) {
    $response = Read-Host "Installation directory already exists. Overwrite? (y/n)"
    if ($response -ne 'y') {
        Write-Info "Installation cancelled"
        exit 0
    }
    Remove-Item $InstallPath -Recurse -Force
}

New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
Write-Success "Installation directory created"

# Copy files
Write-Info "Copying application files..."
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Copy-Item (Join-Path $scriptDir "Backend") (Join-Path $InstallPath "Backend") -Recurse -Force
Copy-Item (Join-Path $scriptDir "Frontend") (Join-Path $InstallPath "Frontend") -Recurse -Force
Copy-Item (Join-Path $scriptDir "*.md") $InstallPath -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $scriptDir "*.ps1") $InstallPath -Force -ErrorAction SilentlyContinue -Exclude "install.ps1"

Write-Success "Files copied successfully"

# Create start script
Write-Info "Creating startup script..."
$startScript = @"
`#!/usr/bin/env pwsh
`$BackendPath = Join-Path `$PSScriptRoot "Backend\EdsWebApi.exe"
`$FrontendPath = Join-Path `$PSScriptRoot "Frontend"

Write-Host "Starting EdsNcaLayer..." -ForegroundColor Green
Write-Host "Backend API: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Start Backend
`$backend = Start-Process -FilePath `$BackendPath -WorkingDirectory (Split-Path `$BackendPath) -PassThru -WindowStyle Normal

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start frontend - try npx serve, otherwise open in browser
if (Get-Command npx -ErrorAction SilentlyContinue) {
    Write-Host "Starting frontend with npx serve on http://localhost:5173..." -ForegroundColor Cyan
    `$frontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx serve -l 5173 -s ." -WorkingDirectory `$FrontendPath -PassThru
} else {
    Write-Host "npx not found. Opening frontend in default browser..." -ForegroundColor Yellow
    Write-Host "Note: Some features may not work with file:// protocol" -ForegroundColor Yellow
    Start-Process (Join-Path `$FrontendPath "index.html")
    `$frontend = `$null
}

Write-Host "Services started. Open http://localhost:5173 in your browser" -ForegroundColor Green
Write-Host "To stop: Close this window or press Ctrl+C" -ForegroundColor Yellow

# Wait for Ctrl+C
try {
    Wait-Process -Id `$backend.Id
} finally {
    Stop-Process -Id `$backend.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id `$frontend.Id -Force -ErrorAction SilentlyContinue
}
"@

$startScript | Out-File -FilePath (Join-Path $InstallPath "start.ps1") -Encoding UTF8 -Force
Write-Success "Startup script created"

# Create desktop shortcut (optional)
$createShortcut = Read-Host "Create desktop shortcut? (y/n)"
if ($createShortcut -eq 'y') {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\EdsNcaLayer.lnk")
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$InstallPath\start.ps1`""
    $Shortcut.WorkingDirectory = $InstallPath
    $Shortcut.IconLocation = "powershell.exe,0"
    $Shortcut.Description = "EdsNcaLayer Application"
    $Shortcut.Save()
    Write-Success "Desktop shortcut created"
}

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║              Installation Complete!                        ║
╠════════════════════════════════════════════════════════════╣
║  Installed to: $InstallPath
║                                                            ║
║  To start the application:                                 ║
║  1. Run: $InstallPath\start.ps1
║  2. Open browser: http://localhost:5173                    ║
║                                                            ║
║  Prerequisites (on target PC):                             ║
║  • NCALayer must be installed and running                  ║
║  • PKI certificates must be installed (run                 ║
║    install-kz-pki-certificates.ps1)                        ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green
'@

$installScript | Out-File -FilePath (Join-Path $DistDir "install.ps1") -Encoding UTF8 -Force
Write-Success "Installation script created"

# Copy documentation
Write-Step "Copying documentation..."
Copy-Item (Join-Path $ScriptDir "README.md") $DistDir -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $ScriptDir "QUICK_START.md") $DistDir -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $ScriptDir "CERTIFICATE_INSTALLATION.md") $DistDir -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $ScriptDir "install-kz-pki-certificates.ps1") $DistDir -Force -ErrorAction SilentlyContinue
Write-Success "Documentation copied"

# Create README for package
$packageReadme = @"
# EdsNcaLayer Distribution Package

Version: $Version
Build Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## Contents

- **Backend/** - ASP.NET Core 8.0 API (self-contained, includes .NET runtime)
- **Frontend/** - React 18 production build
- **install.ps1** - Installation script
- **install-kz-pki-certificates.ps1** - PKI certificate installation
- **Documentation** - README.md, QUICK_START.md, etc.

## Installation on Target PC

### Prerequisites on Target PC

1. **Windows 10/11** (64-bit)
2. **NCALayer** installed and running
   - Download: https://ncl.pki.gov.kz/
3. **Kazakhstan PKI Certificates** installed
   - Run: ``install-kz-pki-certificates.ps1`` as Administrator

### Installation Steps

1. Copy this entire folder to target PC
2. Run PowerShell as Administrator
3. Navigate to this folder
4. Run installation script:

````````powershell
.\install.ps1
````````

Or install to custom location:

````````powershell
.\install.ps1 -InstallPath "D:\MyApps\EdsNcaLayer"
````````

5. Follow the prompts

### Starting the Application

After installation, run:

````````powershell
cd "C:\Program Files\EdsNcaLayer"
.\start.ps1
````````

Or use the desktop shortcut if created during installation.

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Swagger UI: http://localhost:5000/swagger

## No Internet Required

This package is **self-contained** and includes:
- .NET 8.0 runtime (no SDK installation needed)
- All backend dependencies
- Compiled frontend (static files)

Only NCALayer and PKI certificates need to be installed on target PC.

## Support

See included documentation:
- README.md - Full documentation
- QUICK_START.md - Quick start guide
- CERTIFICATE_INSTALLATION.md - Certificate setup

## Package Structure

````````
Distribution/
  Backend/
    EdsWebApi.exe          (Main executable)
    KalkanCrypt.dll         (Cryptography SDK)
    *.dll                   (Dependencies)
  Frontend/
    index.html
    assets/                 (JS, CSS bundles)
  install.ps1                 (Installation script)
  install-kz-pki-certificates.ps1
  *.md                        (Documentation)
````````

## Troubleshooting

### Backend won't start
- Verify all .dll files are in Backend folder
- Check KalkanCrypt.dll is present
- Run as Administrator if needed

### Frontend won't open
- Optional: Install Node.js to use ``npx serve`` for serving frontend
- Alternative: Frontend will open directly in browser (some features may have limitations with file:// protocol)
- Alternative: Use any web server pointing to Frontend folder

### Certificate errors
- Run: ``install-kz-pki-certificates.ps1`` as Administrator
- Restart backend after certificate installation

For detailed troubleshooting, see README.md
"@

$packageReadme | Out-File -FilePath (Join-Path $DistDir "PACKAGE_README.md") -Encoding UTF8 -Force
Write-Success "Package README created"

# Create version info file
$versionInfo = @{
    Version = $Version
    BuildDate = Get-Date -Format "o"
    DotNetVersion = $dotnetVersion
    NodeVersion = $nodeVersion
    BackendFramework = "net8.0"
    FrontendFramework = "React 18"
} | ConvertTo-Json

$versionInfo | Out-File -FilePath (Join-Path $DistDir "version.json") -Encoding UTF8 -Force

# Create ZIP archive
Write-Step "Creating ZIP archive..."
$zipPath = Join-Path $ScriptDir "EdsNcaLayer-$Version.zip"
Compress-Archive -Path "$DistDir\*" -DestinationPath $zipPath -Force
Write-Success "ZIP archive created: $zipPath"

# Calculate size
$distSize = (Get-ChildItem $DistDir -Recurse | Measure-Object -Property Length -Sum).Sum
$distSizeMB = [math]::Round($distSize / 1MB, 2)

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║              Package Build Complete!                       ║
╠════════════════════════════════════════════════════════════╣
║  Version: $Version
║  Size: $distSizeMB MB
║                                                            ║
║  Distribution folder: $DistDir
║  ZIP archive: $zipPath
║                                                            ║
║  Next steps:                                               ║
║  1. Copy ZIP file to target PC                             ║
║  2. Extract contents                                       ║
║  3. Run install.ps1                                        ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

Write-Info "Package is ready for deployment!"
