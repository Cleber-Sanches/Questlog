# Build de release assinado (necessário para atualização automática)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$key = Join-Path $root 'keys\trophydesk.key'
if (-not (Test-Path $key)) {
  Write-Error "Chave privada não encontrada: $key"
}

$env:TAURI_SIGNING_PRIVATE_KEY_PATH = $key
Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue

Write-Host "Assinando com $key"
npm run tauri:build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host ""
Write-Host "Depois: suba o .exe + .sig + latest.json no GitHub Releases"
Write-Host "  node tools/write-latest-json.mjs --version X.Y.Z --url `"https://github.com/Cleber-Sanches/TrophyDesk/releases/download/vX.Y.Z/TrophyDesk_X.Y.Z_x64-setup.exe`""
