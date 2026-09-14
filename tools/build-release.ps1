# Build de release assinado (necessário para atualização automática)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$key = Join-Path $root 'keys\questlog.key'
if (-not (Test-Path $key)) {
  $key = Join-Path $root 'keys\trophydesk.key'
}
if (-not (Test-Path $key)) {
  Write-Error "Chave privada não encontrada: keys\questlog.key (ou keys\trophydesk.key)"
}

$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw -LiteralPath $key
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = $key
# Senha vazia (--ci). Remover a env faz o tauri pedir prompt interativo.
[Environment]::SetEnvironmentVariable('TAURI_SIGNING_PRIVATE_KEY_PASSWORD', '', 'Process')

Write-Host "Build + assinatura com $key (senha vazia)"
# Evita hang no prompt: build sem depender do sign embutido travar — o .sig vem no passo abaixo.
npx tauri build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$nsisDir = Join-Path $env:USERPROFILE '.cache\guia-conquistas-target\release\bundle\nsis'
$setup = Join-Path $nsisDir "Questlog_${version}_x64-setup.exe"

if (-not (Test-Path $setup)) {
  $alt = Get-ChildItem -Path $env:TEMP -Recurse -Filter "Questlog_${version}_x64-setup.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($alt) {
    $setup = $alt.FullName
    $nsisDir = $alt.DirectoryName
  }
}

if (Test-Path $setup) {
  $sig = "$setup.sig"
  if (-not (Test-Path $sig)) {
    & (Join-Path $root 'tools\sign-installer.ps1')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
}

Write-Host ""
Write-Host "Artefatos em: $nsisDir"
Write-Host "Depois: suba o .exe + .sig + latest.json no GitHub Releases"
Write-Host "  node tools/write-latest-json.mjs --version $version --url `"https://github.com/Cleber-Sanches/Questlog/releases/download/v$version/Questlog_${version}_x64-setup.exe`""
