#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Starts both Backend and Frontend services for EdsNcaLayer application

.DESCRIPTION
    This script launches the ASP.NET Core backend API and React frontend development server
    in separate PowerShell processes. Both services run concurrently and can be stopped 
    with Ctrl+C.

.EXAMPLE
    .\start-app.ps1
    Starts both backend and frontend services

.NOTES
    Prerequisites:
    - .NET SDK 8.0+
    - Node.js 20.19+ or 22.12+
    - npm 10+
    - All dependencies installed (dotnet restore, npm install)
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

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║            EdsNcaLayer Application Launcher                ║
║                                                            ║
║  This script will start:                                   ║
║  1. Backend API (ASP.NET Core) on http://localhost:5000   ║
║  2. Frontend Dev Server (Vite) on http://localhost:5173   ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

# Verify directories exist
Write-Step "Verifying project structure..."

if (-not (Test-Path $BackendDir)) {
    Write-Error-Custom "Backend directory not found at: $BackendDir"
    exit 1
}

if (-not (Test-Path $FrontendDir)) {
    Write-Error-Custom "Frontend directory not found at: $FrontendDir"
    exit 1
}

Write-Success "Project directories verified"

# Check prerequisites
Write-Step "Checking prerequisites..."

# Check .NET SDK
try {
    $dotnetVersion = dotnet --version
    Write-Info ".NET SDK version: $dotnetVersion"
} catch {
    Write-Error-Custom ".NET SDK not found. Please install .NET SDK 8.0+"
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Info "Node.js version: $nodeVersion"
} catch {
    Write-Error-Custom "Node.js not found. Please install Node.js 20.19+ or 22.12+"
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Info "npm version: $npmVersion"
} catch {
    Write-Error-Custom "npm not found. Please install npm 10+"
    exit 1
}

Write-Success "All prerequisites met"

# Check if Backend dependencies are restored
Write-Step "Checking Backend dependencies..."
$backendObjDir = Join-Path $BackendDir "obj"
if (-not (Test-Path $backendObjDir)) {
    Write-Info "Backend dependencies not found. Running 'dotnet restore'..."
    Push-Location $BackendDir
    dotnet restore
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Failed to restore Backend dependencies"
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Success "Backend dependencies restored"
} else {
    Write-Success "Backend dependencies already restored"
}

# Check if Frontend dependencies are installed
Write-Step "Checking Frontend dependencies..."
$frontendNodeModules = Join-Path $FrontendDir "node_modules"
if (-not (Test-Path $frontendNodeModules)) {
    Write-Info "Frontend dependencies not found. Running 'npm install'..."
    Push-Location $FrontendDir
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Failed to install Frontend dependencies"
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Success "Frontend dependencies installed"
} else {
    Write-Success "Frontend dependencies already installed"
}

# Start Backend
Write-Step "Starting Backend API..."
Write-Info "Backend will run on: http://localhost:5000"
Write-Info "Swagger UI: http://localhost:5000/swagger"

$backendJob = Start-Job -ScriptBlock {
    param($BackendPath)
    Set-Location $BackendPath
    dotnet run --project EdsWebApi.csproj
} -ArgumentList $BackendDir

Start-Sleep -Seconds 2

# Check if backend started successfully
if ($backendJob.State -eq "Failed") {
    Write-Error-Custom "Failed to start Backend"
    Receive-Job $backendJob
    exit 1
}

Write-Success "Backend started (Job ID: $($backendJob.Id))"

# Start Frontend
Write-Step "Starting Frontend Dev Server..."
Write-Info "Frontend will run on: http://localhost:5173"

$frontendJob = Start-Job -ScriptBlock {
    param($FrontendPath)
    Set-Location $FrontendPath
    npm run dev
} -ArgumentList $FrontendDir

Start-Sleep -Seconds 2

# Check if frontend started successfully
if ($frontendJob.State -eq "Failed") {
    Write-Error-Custom "Failed to start Frontend"
    Receive-Job $frontendJob
    Stop-Job $backendJob
    Remove-Job $backendJob
    exit 1
}

Write-Success "Frontend started (Job ID: $($frontendJob.Id))"

# Wait for services to initialize
Write-Info "`nWaiting for services to initialize..."
Start-Sleep -Seconds 5

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                   Services Running                         ║
╠════════════════════════════════════════════════════════════╣
║  Backend API:  http://localhost:5000                       ║
║  Swagger UI:   http://localhost:5000/swagger              ║
║  Frontend:     http://localhost:5173                       ║
╠════════════════════════════════════════════════════════════╣
║  Press Ctrl+C to stop all services                         ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

# Monitor jobs and display output
try {
    Write-Info "Monitoring services... (Press Ctrl+C to stop)"
    Write-Host ""
    
    while ($true) {
        # Check if jobs are still running
        $backendState = (Get-Job -Id $backendJob.Id).State
        $frontendState = (Get-Job -Id $frontendJob.Id).State
        
        if ($backendState -eq "Failed" -or $backendState -eq "Stopped") {
            Write-Error-Custom "Backend service stopped unexpectedly"
            Write-Host "`nBackend output:"
            Receive-Job $backendJob
            break
        }
        
        if ($frontendState -eq "Failed" -or $frontendState -eq "Stopped") {
            Write-Error-Custom "Frontend service stopped unexpectedly"
            Write-Host "`nFrontend output:"
            Receive-Job $frontendJob
            break
        }
        
        # Display job output
        $backendOutput = Receive-Job $backendJob
        if ($backendOutput) {
            Write-Host "[Backend] " -ForegroundColor Blue -NoNewline
            Write-Host $backendOutput
        }
        
        $frontendOutput = Receive-Job $frontendJob
        if ($frontendOutput) {
            Write-Host "[Frontend] " -ForegroundColor Magenta -NoNewline
            Write-Host $frontendOutput
        }
        
        Start-Sleep -Milliseconds 500
    }
} catch {
    # Ctrl+C pressed or error occurred
    Write-Host "`n"
} finally {
    # Cleanup
    Write-Step "Stopping services..."
    
    if ($backendJob) {
        Stop-Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job $backendJob -ErrorAction SilentlyContinue
        Write-Info "Backend stopped"
    }
    
    if ($frontendJob) {
        Stop-Job $frontendJob -ErrorAction SilentlyContinue
        Remove-Job $frontendJob -ErrorAction SilentlyContinue
        Write-Info "Frontend stopped"
    }
    
    Write-Success "`nAll services stopped. Goodbye!"
}
