# Atualizações automáticas (Questlog)

O app verifica atualizações ao abrir e em **Configurações → Atualizações**.

## Como publicar uma nova versão

1. Suba a versão em `package.json`, `src-tauri/tauri.conf.json` e `src-tauri/Cargo.toml` (ex.: `0.1.1`).
2. Gere o instalador **assinado**:
   ```powershell
   .\tools\build-release.ps1
   ```
3. Crie um release no GitHub (`Cleber-Sanches/Questlog`) e anexe:
   - `Questlog_X.Y.Z_x64-setup.exe`
   - `Questlog_X.Y.Z_x64-setup.exe.sig`
4. Gere o manifesto:
   ```bash
   node tools/write-latest-json.mjs --version X.Y.Z --url "https://github.com/Cleber-Sanches/Questlog/releases/download/vX.Y.Z/Questlog_X.Y.Z_x64-setup.exe"
   ```
5. Anexe também o `updates/latest.json` no release (nome do arquivo: `latest.json`).

## Endpoint

Configurado em `src-tauri/tauri.conf.json`:

```
https://github.com/Cleber-Sanches/Questlog/releases/latest/download/latest.json
```

Se o repositório tiver outro nome/dono, altere esse URL.

## Chaves

- Pública: embutida em `tauri.conf.json` (`plugins.updater.pubkey`)
- Privada: `keys/questlog.key` (ou legado `keys/trophydesk.key`) — não versionar

Se perder a chave privada, precisará gerar um novo par e publicar um instalador “base” novo (atualizações antigas deixam de validar).
