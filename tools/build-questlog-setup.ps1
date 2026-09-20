#Requires -Version 5.1
<#
.SYNOPSIS
  Gera Questlog-Setup.exe (UI premium) com o NSIS do app embutido.

.DESCRIPTION
  1) Builda o app principal (NSIS), se necessário
  2) Copia o *-setup.exe para installer/src-tauri/resources/Questlog_x64-setup.exe
  3) Builda o bootstrapper e copia o exe final para dist-setup/

.PARAMETER SkipAppBuild
  Não rebuilda o app; usa o NSIS mais recente já gerado (ou -NsisPath).

.PARAMETER NsisPath
  Caminho explícito para o Questlog_*_x64-setup.exe
#>
param(
  [switch]$SkipAppBuild,
  [string]$NsisPath = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Installer = Join-Path $Root "installer"
$Resources = Join-Path $Installer "src-tauri\resources"
$OutDir = Join-Path $Root "dist-setup"
$TargetNsis = Join-Path $Resources "Questlog_x64-setup.exe"

$SetupCargoDir = if ($env:CARGO_TARGET_DIR) {
  $env:CARGO_TARGET_DIR
} elseif ($env:QUESTLOG_SETUP_TARGET) {
  $env:QUESTLOG_SETUP_TARGET
} else {
  "C:\Users\Sancs\.cache\questlog-setup-target"
}

$NsisSearchDirs = @(
  (Join-Path $Root "target\release\bundle\nsis"),
  "C:\Users\Sancs\.cache\guia-conquistas-target\release\bundle\nsis"
)
if ($env:QUESTLOG_NSIS_DIR) {
  $NsisSearchDirs = @($env:QUESTLOG_NSIS_DIR) + $NsisSearchDirs
}

Write-Host "==> Questlog Setup builder" -ForegroundColor Cyan

if (-not $SkipAppBuild) {
  Write-Host "==> Building app (NSIS)..." -ForegroundColor Yellow
  Push-Location $Root
  try {
    npm run tauri:build
  } finally {
    Pop-Location
  }
}

if (-not $NsisPath) {
  foreach ($dir in $NsisSearchDirs) {
    if (-not (Test-Path $dir)) { continue }
    $latest = Get-ChildItem $dir -Filter "Questlog_*_x64-setup.exe" -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($latest) {
      $NsisPath = $latest.FullName
      break
    }
  }
}

if (-not $NsisPath -or -not (Test-Path $NsisPath)) {
  throw "NSIS não encontrado. Passe -NsisPath ou rode o build do app antes."
}

New-Item -ItemType Directory -Force -Path $Resources | Out-Null
Copy-Item $NsisPath $TargetNsis -Force
Write-Host "==> Payload: $NsisPath ($([math]::Round((Get-Item $TargetNsis).Length/1MB,1)) MB)" -ForegroundColor Green

Write-Host "==> Building setup UI..." -ForegroundColor Yellow
Push-Location $Installer
try {
  if (-not (Test-Path "node_modules")) {
    npm install
  }
  $env:CARGO_TARGET_DIR = $SetupCargoDir
  npm run tauri:build
} finally {
  Pop-Location
}

$built = Join-Path $SetupCargoDir "release\questlog-setup.exe"
if (-not (Test-Path $built)) {
  $built = Get-ChildItem $SetupCargoDir -Recurse -Filter "questlog-setup.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $built -or -not (Test-Path $built)) {
  throw "Build do setup falhou: exe ausente."
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$final = Join-Path $OutDir "Questlog-Setup.exe"
Copy-Item $built $final -Force
Write-Host "==> OK: $final" -ForegroundColor Green
Write-Host "Teste local: rode o exe (nao faz push/release)." -ForegroundColor DarkGray
