# =============================================================================
# Windows 安装包构建脚本
#
# 功能: 设置 npmmirror 镜像后调用 electron-builder 生成 NSIS 安装包
# 产物: artifacts\cuiguo-light-workstation Setup 1.0.0.exe
#
# 用法:
#   .\build-win.ps1                # 默认构建 (npm run build-app)
#   .\build-win.ps1 -WithMcp       # 先打包 MCP 再构建 (npm run build:with-mcp)
# =============================================================================
param(
    [switch]$WithMcp
)


$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Windows 安装包构建" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "项目目录: $ProjectDir"

# -----------------------------------------------------------------------------
# 镜像配置: GitHub releases 直连超时, 改走 npmmirror
# -----------------------------------------------------------------------------
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
$env:ELECTRON_MIRROR                 = "https://npmmirror.com/mirrors/electron/"
$env:npm_config_better_sqlite3_binary_host = "https://npmmirror.com/mirrors/better-sqlite3"

Write-Host "镜像配置:" -ForegroundColor DarkGray
Write-Host "  ELECTRON_BUILDER_BINARIES_MIRROR = $env:ELECTRON_BUILDER_BINARIES_MIRROR" -ForegroundColor DarkGray
Write-Host "  ELECTRON_MIRROR                 = $env:ELECTRON_MIRROR" -ForegroundColor DarkGray
Write-Host "  better_sqlite3_binary_host      = $env:npm_config_better_sqlite3_binary_host" -ForegroundColor DarkGray
Write-Host "------------------------------------------------------------"

$task = if ($WithMcp) { "build:with-mcp" } else { "build-app" }
Write-Host "执行: npm run $task" -ForegroundColor Green

# npm 的日志走 stderr, 不能用 ErrorActionPreference=Stop, 改用退出码判断
& npm run $task
$code = $LASTEXITCODE
if ($code -ne 0) {
    Write-Host "------------------------------------------------------------" -ForegroundColor Red
    Write-Host "构建失败 (exit $code)" -ForegroundColor Red
    exit $code
}

Write-Host "------------------------------------------------------------" -ForegroundColor Green
Write-Host "构建成功" -ForegroundColor Green
Get-ChildItem artifacts -Filter "*.exe" -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host ("  " + $_.Name + "  " + [math]::Round($_.Length/1MB,2) + " MB") -ForegroundColor Yellow }