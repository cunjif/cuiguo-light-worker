# Build Linux deb package using Docker (PowerShell)
# Usage: .\build-linux.ps1 [deb|AppImage|rpm|all]

param(
    [string]$Target = "deb"
)

$ErrorActionPreference = "Stop"

Write-Host "🐧 Building Linux package: $Target" -ForegroundColor Cyan
Write-Host "📦 Project: $(Get-Location)" -ForegroundColor Cyan

# Get current directory
$projectDir = Get-Location

# Create cache directories
New-Item -ItemType Directory -Force -Path ".cache\electron" | Out-Null
New-Item -ItemType Directory -Force -Path ".cache\electron-builder" | Out-Null

# Convert paths for Docker
$projectPath = $projectDir.Path.Replace('\', '/')
$electronCache = "$projectPath/.cache/electron"
$builderCache = "$projectPath/.cache/electron-builder"

Write-Host "📥 Starting Docker container..." -ForegroundColor Yellow

docker run --rm `
  -v "${projectPath}:/project" `
  -v "${electronCache}:/root/.cache/electron" `
  -v "${builderCache}:/root/.cache/electron-builder" `
  electronuserland/builder:wine `
  /bin/bash -c "
    set -e
    cd /project
    echo '📥 Installing dependencies...'
    npm install
    echo '🔨 Building TypeScript...'
    npm run build
    echo '📦 Packaging for Linux (target: $Target)...'
    npx electron-builder --linux $Target
    echo '✅ Build complete! Check artifacts/ directory'
  "

Write-Host "`n🎉 Build finished!" -ForegroundColor Green
Write-Host "📂 Output: .\artifacts\" -ForegroundColor Green

if (Test-Path "artifacts") {
    Get-ChildItem "artifacts" | Format-Table Name, Length, LastWriteTime
} else {
    Write-Host "No artifacts found" -ForegroundColor Yellow
}
