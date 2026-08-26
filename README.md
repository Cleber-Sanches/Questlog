# TrophyDesk

App desktop local (Tauri 2 + React + SQLite) para organizar conquistas Steam, guias e progresso.

## Requisitos

- Node.js 20+
- Rust (rustup) + **WebView2** no Windows
- **Visual Studio Build Tools 2022** com workload “Desktop development with C++” (`link.exe` / MSVC)  
  O toolchain `windows-gnu` falha neste projeto (espaços no path + limite de símbolos do linker).
- Steam instalada (para sync de progresso local)

## Desenvolvimento

O caminho `...\Roteiro SoulMask\...` tem espaços e quebra o MinGW. Use o atalho sem espaços:

```bat
cd C:\Users\Sancs\trophy-desk
npm install
npm run tauri:dev
```

(Ou rode `Iniciar Guia.bat`, que cria/usa esse junction.)

Depois de instalar as Build Tools:

```bash
rustup default stable-x86_64-pc-windows-msvc
```

Frontend Vite em `http://localhost:5173`, backend Rust via Tauri.

## Atualizações automáticas

O app verifica novas versões ao abrir e em **Configurações → Atualizações**.

Para publicar: veja `updates/README.md` e use `npm run tauri:build:signed`.

## Build / instalador

```bash
npm run tauri:build
```

- Executável: `%USERPROFILE%\.cache\guia-conquistas-target\release\trophy-desk.exe`
- Instalador NSIS: `%USERPROFILE%\.cache\guia-conquistas-target\release\bundle\nsis\TrophyDesk_0.1.0_x64-setup.exe`

> O projeto usa `target-dir` customizado em `.cargo/config.toml`, então os artefatos **não** ficam em `src-tauri/target/`.

## Dados do usuário

Tudo fica na máquina do usuário:

- SQLite: `%APPDATA%\com.trophydesk.desktop\guia.sqlite`
- Backups automáticos: `%APPDATA%\com.trophydesk.desktop\backups\` (últimos 10)
- Dados de versões antigas: `com.guiaconquistas.desktop` e `com.myconquist.desktop`
- Pasta externa opcional em **Configurações**

Export/import JSON de perfil e de guia por jogo continuam disponíveis.

## Steam

- Progresso: caches locais (`appcache/stats`)
- Lista/busca: Store / Community / SteamHunters (sem API key)
- Se a Steam não for encontrada, defina `STEAM_PATH`

## Legado

O app Node antigo permanece em `legacy/` + `tools/` para referência:

```bash
npm run start:legacy
```

## Estrutura frontend

```
src/
  app/          # providers + router
  pages/        # Guide, Settings, Archived
  layouts/      # AppShell, GuideLayout
  features/     # games, achievements, steam, guide-io, backup
  components/   # ui / feedback / overlay
  styles/       # tokens, reset, layouts
  types/
```
