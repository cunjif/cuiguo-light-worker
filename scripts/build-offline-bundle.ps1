# =============================================================================
# 离线 Arm64 编译依赖打包 - 构建脚本 (Windows PowerShell 版)
#
# 功能: 用 Docker buildx + QEMU 模拟 arm64 构建, 导出 chatmcp.tar.gz
# 产物: .\chatmcp.tar.gz (拷贝到目标 Kylin V10SP1 机器解压即可)
#
# 用法:
#   .\scripts\build-offline-bundle.ps1                 # 默认构建
#   .\scripts\build-offline-bundle.ps1 -NoCache        # 不用缓存
#   .\scripts\build-offline-bundle.ps1 -NodeVersion 24.13.0
# =============================================================================
param(
    [string]$NodeVersion = "24.13.0",
    [switch]$NoCache,
    [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
if (-not $OutputFile) { $OutputFile = Join-Path $ProjectDir "chatmcp.tar.gz" }
$ImageTag = "chat-mcp-offline-builder:arm64"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  离线 Arm64 编译依赖打包" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "项目目录:   $ProjectDir"
Write-Host "产物文件:   $OutputFile"
Write-Host "Node 版本:  $NodeVersion"
Write-Host "镜像标签:   $ImageTag"
Write-Host "============================================================"
Write-Host ""

# 1. 检查 Docker
Write-Host "[1/5] 检查 Docker..." -ForegroundColor Yellow
$dockerVersion = docker version --format "{{.Server.Version}}" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker daemon 未运行, 请启动 Docker Desktop。" -ForegroundColor Red
    exit 1
}
Write-Host "  OK: Docker $dockerVersion"

# 2. 检查 arm64 QEMU 支持
Write-Host "[2/5] 检查 QEMU arm64 支持..." -ForegroundColor Yellow
$arm64Test = docker run --rm --platform linux/arm64 alpine:latest echo "arm64 OK" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  QEMU arm64 未注册, 尝试注册..."
    docker run --rm --privileged tonistiigi/binfmt --install arm64
}
Write-Host "  OK: arm64 模拟可用。"
Write-Host ""

# 3. 构建 arm64 镜像
Write-Host "[3/5] 构建 arm64 Docker 镜像 (QEMU 模拟, 较慢, 请耐心等待)..." -ForegroundColor Yellow
Set-Location $ProjectDir

$buildArgs = @(
    "buildx", "build",
    "--platform", "linux/arm64",
    "--build-arg", "NODE_VERSION=$NodeVersion",
    "--tag", $ImageTag,
    "--load",
    "-f", "Dockerfile",
    "."
)
if ($NoCache) { $buildArgs += "--no-cache" }

& docker @buildArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker 构建失败!" -ForegroundColor Red
    exit 1
}
Write-Host "  OK: 镜像构建完成。"
Write-Host ""

# 4. 导出 tar.gz
Write-Host "[4/5] 从镜像中导出 chatmcp.tar.gz..." -ForegroundColor Yellow
$containerName = "tmp-offline-export-$(Get-Random)"
docker create --name $containerName $ImageTag 2>&1 | Out-Null
docker cp "${containerName}:/chatmcp.tar.gz" $OutputFile
docker rm $containerName 2>&1 | Out-Null

if (-not (Test-Path $OutputFile)) {
    Write-Host "ERROR: 产物文件不存在!" -ForegroundColor Red
    exit 1
}
$fileSize = (Get-Item $OutputFile).Length / 1MB
Write-Host ("  OK: 已导出 ({0:N1} MB)" -f $fileSize)
Write-Host ""

# 5. 完成
Write-Host "[5/5] 完成!" -ForegroundColor Green
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ("  交付物: $OutputFile ({0:N1} MB)" -f $fileSize) -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "部署到目标 Kylin V10SP1 机器步骤:"
Write-Host "  1. 将 chatmcp.tar.gz 拷贝到目标机器"
Write-Host "  2. tar -xzf chatmcp.tar.gz"
Write-Host "  3. bash setup-offline-env.sh"
Write-Host "  4. cd app && source ../env-offline.sh"
Write-Host "  5. npm run start      # 启动应用"
Write-Host "     npm run build-app  # 打包 deb"
Write-Host "     npm run pack:mcp   # 打包 MCP 服务器"
Write-Host ""