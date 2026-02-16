# ========================================
# Kazakhstan PKI Certificate Installer
# ========================================
# This script installs PKI root and intermediate certificates
# from the National Certificate Authority of Kazakhstan
#
# IMPORTANT: Run this script as Administrator
# ========================================

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select Run as Administrator, then run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Kazakhstan PKI Certificate Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Certificate URLs (update these URLs if they change)
$certificates = @(
    @{
        Name = "Root GOST 2022"
        Url = "https://pki.gov.kz/cert/root_gost_2022.cer"
        Store = "Root"
        FileName = "root_gost2015.cer"
    },
    @{
        Name = "NCA GOST 2022"
        Url = "https://pki.gov.kz/cert/nca_gost_2022.cer"
        Store = "CA"
        FileName = "nca_gost2015.cer"
    },
    @{
        Name = "Root RSA"
		Url = "https://pki.gov.kz/cert/root_rsa_2020.cer"
        Store = "Root"
        FileName = "root_rsa.cer"
    },
    @{
        Name = "NCA RSA"
        Url = "https://pki.gov.kz/cert/nca_rsa_2022.cer"
        Store = "CA"
        FileName = "nca_rsa.cer"
    }
)

$tempDir = "$env:TEMP\KZ_PKI_Certs"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir | Out-Null
}

$successCount = 0
$failCount = 0

foreach ($cert in $certificates) {
    Write-Host "Installing: $($cert.Name)..." -ForegroundColor Yellow
    
    $certPath = Join-Path $tempDir $cert.FileName
    
    try {
        # Download certificate
        Write-Host "  Downloading from $($cert.Url)..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $cert.Url -OutFile $certPath -ErrorAction Stop
        
        # Import certificate
        $storeLocation = "Cert:\LocalMachine\$($cert.Store)"
        Write-Host "  Installing to $storeLocation..." -ForegroundColor Gray
        Import-Certificate -FilePath $certPath -CertStoreLocation $storeLocation -ErrorAction Stop | Out-Null
        
        Write-Host "  [OK] Successfully installed $($cert.Name)" -ForegroundColor Green
        $successCount++
    }
    catch {
        Write-Host "  [FAIL] Failed to install $($cert.Name): $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
    }
    
    Write-Host ""
}

# Clean up temp files
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Successfully installed: $successCount certificate(s)" -ForegroundColor Green
Write-Host "Failed: $failCount certificate(s)" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Gray" })
Write-Host ""

if ($successCount -gt 0) {
    Write-Host "[SUCCESS] Installation completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "1. Restart your backend application (stop and run dotnet run again)" -ForegroundColor White
    Write-Host "2. Try loading your certificate in the Batch Sign module" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "[ERROR] No certificates were installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host "1. Check your internet connection" -ForegroundColor White
    Write-Host "2. Verify the URLs are still valid at https://pki.gov.kz/" -ForegroundColor White
    Write-Host "3. Try manual installation (see CERTIFICATE_INSTALLATION.md)" -ForegroundColor White
    Write-Host ""
}

Write-Host "Press Enter to exit..."
Read-Host
