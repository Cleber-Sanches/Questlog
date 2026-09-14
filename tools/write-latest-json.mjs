#!/usr/bin/env node
/**
 * Gera updates/latest.json a partir do instalador + .sig do último build.
 *
 * Uso (após tauri:build com assinatura):
 *   node tools/write-latest-json.mjs --version 0.1.1 --url "https://github.com/Cleber-Sanches/Questlog/releases/download/v0.1.1/Questlog_0.1.1_x64-setup.exe"
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)

function arg(name, fallback = '') {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}

const version = arg('version')
const url = arg('url')
const notes = arg('notes', `Questlog ${version}`)
const sigPath = arg(
  'sig',
  path.join(
    process.env.USERPROFILE || '',
    '.cache',
    'guia-conquistas-target',
    'release',
    'bundle',
    'nsis',
    `Questlog_${version}_x64-setup.exe.sig`,
  ),
)

if (!version || !url) {
  console.error('Uso: node tools/write-latest-json.mjs --version 0.1.1 --url "https://..."')
  process.exit(1)
}

if (!fs.existsSync(sigPath)) {
  console.error(`Assinatura não encontrada: ${sigPath}`)
  console.error('Rode o build com TAURI_SIGNING_PRIVATE_KEY_PATH apontando para keys/questlog.key')
  process.exit(1)
}

const signature = fs.readFileSync(sigPath, 'utf8').trim()
const outDir = path.join(root, 'updates')
fs.mkdirSync(outDir, { recursive: true })

const payload = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url,
    },
  },
}

const outFile = path.join(outDir, 'latest.json')
fs.writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n')
console.log(`Escrito ${outFile}`)
