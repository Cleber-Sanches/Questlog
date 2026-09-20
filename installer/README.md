# Questlog Setup (bootstrapper)

UI de uma tela no visual do app. Por baixo roda o NSIS do Questlog em `/S`.

## Build local

Na raiz do monorepo:

```powershell
# Builda o app + embute o NSIS + gera dist-setup/Questlog-Setup.exe
npm run build:setup

# Ou só a UI, reusando um NSIS já gerado / baixado:
npm run build:setup:ui
```

Saída: `dist-setup/Questlog-Setup.exe`.

## Dev da UI

```powershell
cd installer
npm install
npm run tauri:dev
```

Precisa de `installer/src-tauri/resources/Questlog_x64-setup.exe` (o script de build copia).
