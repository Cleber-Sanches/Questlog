# Atualizações automáticas (Questlog)

O app verifica atualizações ao abrir e em **Configurações → Atualizações**.

Endpoint (em `src-tauri/tauri.conf.json`):

```
https://github.com/Cleber-Sanches/Questlog/releases/latest/download/latest.json
```

## Liberar pelo GitHub Actions (recomendado)

Workflow: [`.github/workflows/release.yml`](../.github/workflows/release.yml)

### 1. Secret da assinatura (uma vez)

Em **Settings → Secrets and variables → Actions**, crie `TAURI_SIGNING_PRIVATE_KEY` com o conteúdo **inteiro** de `keys/questlog.key`.

Forma segura (preserva quebras de linha — evita o erro `Missing comment in secret key`):

```powershell
gh secret set TAURI_SIGNING_PRIVATE_KEY < keys/questlog.key
```

A chave local é `--ci` (senha vazia). Não precisa de secret de senha.

Em **Settings → Actions → General → Workflow permissions**, marque **Read and write**.

### 2. Subir a versão

Alinhe a mesma versão em:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

Commit no `main`.

### 3. Tag e push

```powershell
git tag v0.3.2
git push origin v0.3.2
```

A Action:

1. Faz o build Windows (NSIS)
2. Assina o instalador (updater)
3. Cria o GitHub Release `vX.Y.Z`
4. Anexa o `.exe`, o `.sig` e o `latest.json`

Também dá para disparar em **Actions → Release → Run workflow** (usa a versão já commitada no `package.json`).

## Fluxo manual (fallback)

1. Suba a versão nos três arquivos acima.
2. Gere o instalador assinado:
   ```powershell
   .\tools\build-release.ps1
   ```
3. Crie um release no GitHub e anexe:
   - `Questlog_X.Y.Z_x64-setup.exe`
   - `Questlog_X.Y.Z_x64-setup.exe.sig`
4. Gere o manifesto:
   ```bash
   node tools/write-latest-json.mjs --version X.Y.Z --url "https://github.com/Cleber-Sanches/Questlog/releases/download/vX.Y.Z/Questlog_X.Y.Z_x64-setup.exe"
   ```
5. Anexe também o `updates/latest.json` no release (nome do arquivo: `latest.json`).

## Chaves

- Pública: embutida em `tauri.conf.json` (`plugins.updater.pubkey`)
- Privada: `keys/questlog.key` (ou legado `keys/trophydesk.key`) — **não versionar**; no CI vai no secret

Se perder a chave privada, precisa gerar um novo par e publicar um instalador “base” novo (atualizações antigas deixam de validar).
