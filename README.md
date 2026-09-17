# Questlog

Guia local de conquistas Steam (Tauri 2 + React + SQLite).

## Dev

```powershell
npm install
npm run tauri:dev
```

## Build

```powershell
npm run tauri:build
# Assinado (auto-update):
npm run tauri:build:signed
```

## Artefatos

- Executável: `%USERPROFILE%\.cache\guia-conquistas-target\release\questlog.exe`
- Instalador NSIS: `%USERPROFILE%\.cache\guia-conquistas-target\release\bundle\nsis\Questlog_0.2.0_x64-setup.exe`

## Dados

- SQLite: `%APPDATA%\com.questlog.desktop\guia.sqlite`
- Backups automáticos: `%APPDATA%\com.questlog.desktop\backups\`
- Dados de versões antigas: `com.trophydesk.desktop`, `com.guiaconquistas.desktop`, `com.myconquist.desktop`

Atualizações: ver `updates/README.md`.
