# ---------------------------------------
# File: run-edsnca-frontend.ps1
# PowerShell script for EdsNcaLayer React UI
# ---------------------------------------

# Папка Frontend проекта
$frontendDir = ".\Frontend"

# Переходим в папку
Set-Location $frontendDir

# ------------------ Проверка Node.js ------------------
Write-Host "Checking Node.js version..."
try {
    $nodeVersion = node -v
} catch {
    Write-Host "Node.js is not installed. Please install Node.js 20.19+ or 22.12+ from https://nodejs.org/"
    exit 1
}

$nodeVersionClean = $nodeVersion.TrimStart('v')
$versionParts = $nodeVersionClean.Split(".") | ForEach-Object { [int]$_ }

if ($versionParts[0] -lt 20) {
    Write-Host "Node.js version is too low ($nodeVersion). Please upgrade to 20.19+ or 22.12+"
    exit 1
}

Write-Host "Node.js version OK: $nodeVersion"

# ------------------ Установка зависимостей ------------------
if (-not (Test-Path ".\node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
} else {
    Write-Host "Dependencies already installed."
}

# ------------------ Запуск dev сервера ------------------
Write-Host "Starting React dev server..."
# --open автоматически откроет браузер после поднятия сервера
npx vite --open

# После запуска сервера PowerShell остаётся открытой
Write-Host "React dev server is running. Press Ctrl+C to stop."
