# Assina o instalador NSIS do ultimo build.
# Chave gerada com --ci (senha vazia). No Windows, env vazia some —
# usamos cmd.exe para manter TAURI_SIGNING_PRIVATE_KEY_PASSWORD=.
# Nao passa a chave na linha de comando (limite do cmd) — so o PATH.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$key = Join-Path $root 'keys\questlog.key'
if (-not (Test-Path $key)) {
  $key = Join-Path $root 'keys\trophydesk.key'
}
if (-not (Test-Path $key)) {
  Write-Error "Chave privada nao encontrada: keys\questlog.key (ou keys\trophydesk.key)"
}

# Caminho sem espacos — evita problema com "Roteiro SoulMask"
$keyShort = Join-Path $env:USERPROFILE '.cache\questlog-signing.key'
Copy-Item -LiteralPath $key -Destination $keyShort -Force

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

if (-not (Test-Path $setup)) {
  Write-Error "Instalador nao encontrado. Rode primeiro: npm run tauri:build"
}

$cli = Join-Path $root 'node_modules\@tauri-apps\cli\tauri.js'
$node = (Get-Command node).Source

Write-Host "Assinando (senha vazia / --ci): $setup"
Write-Host "Chave: $keyShort"

$cmd = "set `"TAURI_SIGNING_PRIVATE_KEY_PASSWORD=`" && set `"TAURI_SIGNING_PRIVATE_KEY_PATH=$keyShort`" && `"$node`" `"$cli`" signer sign `"$setup`""
cmd /c $cmd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path "$setup.sig")) {
  Write-Error "Assinatura nao gerou o arquivo .sig"
}

Write-Host "OK: $setup.sig"
Write-Host "Sem senha: a chave foi criada com --ci (password vazio)."
