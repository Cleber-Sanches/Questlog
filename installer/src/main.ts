import './style.css'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import markUrl from './assets/mark.png'

type Phase = 'idle' | 'installing' | 'done' | 'error'

const MIN_INSTALL_MS = 3400

const COPY = {
  idle: 'Acompanhe as conquistas dos seus jogos.',
  installing: 'Estamos colocando tudo no lugar.',
  done: 'Pronto. O Questlog já está instalado.',
  error: 'Não deu para concluir a instalação.',
} as const

const app = document.querySelector('#app')!
app.innerHTML = `
  <div class="shell">
    <header class="titlebar">
      <div class="titlebarDrag" aria-hidden="true"></div>
      <button type="button" id="btn-close" aria-label="Fechar">×</button>
    </header>
    <main class="main">
      <div class="col" id="col">
        <img class="logo" src="${markUrl}" alt="" width="72" height="72" draggable="false" />
        <h1 class="title">Questlog</h1>
        <p class="lead" id="lead">${COPY.idle}</p>
        <div class="meta" id="meta">
          <p class="status" id="status"></p>
          <div class="barWrap" id="bar-wrap">
            <div class="segmentedBar is-brand" id="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <span class="segmentedBarTip" id="bar-on" style="flex-grow: 2">
                <span class="segmentedBarSeg isOn" id="bar-seg"></span>
              </span>
              <span class="segmentedBarTip" id="bar-off" style="flex-grow: 98">
                <span class="segmentedBarSeg"></span>
              </span>
            </div>
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" id="btn-main" type="button">Instalar</button>
          <button class="btn btn-ghost" id="btn-secondary" type="button" aria-hidden="true" tabindex="-1">Agora não</button>
        </div>
      </div>
    </main>
  </div>
`

const leadEl = document.querySelector('#lead') as HTMLParagraphElement
const metaEl = document.querySelector('#meta') as HTMLDivElement
const statusEl = document.querySelector('#status') as HTMLParagraphElement
const barWrap = document.querySelector('#bar-wrap') as HTMLDivElement
const barEl = document.querySelector('#bar') as HTMLDivElement
const barOn = document.querySelector('#bar-on') as HTMLSpanElement
const barOff = document.querySelector('#bar-off') as HTMLSpanElement
const barSeg = document.querySelector('#bar-seg') as HTMLSpanElement
const btnMain = document.querySelector('#btn-main') as HTMLButtonElement
const btnSecondary = document.querySelector('#btn-secondary') as HTMLButtonElement
const btnClose = document.querySelector('#btn-close') as HTMLButtonElement

let phase: Phase = 'idle'
let leadToken = 0

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function setLead(text: string) {
  if (leadEl.textContent === text) return
  const token = ++leadToken
  leadEl.classList.add('is-swap')
  await sleep(140)
  if (token !== leadToken) return
  leadEl.textContent = text
  leadEl.classList.remove('is-swap')
}

function setStatus(text: string, error = false) {
  statusEl.textContent = text
  statusEl.classList.toggle('error', error)
  statusEl.classList.toggle('is-on', Boolean(text))
}

function setProgress(percent: number, done = false) {
  const safe = Math.min(100, Math.max(0, percent))
  barEl.setAttribute('aria-valuenow', String(Math.round(safe)))
  if (safe <= 0) {
    barOn.hidden = true
    barOff.hidden = false
    barOff.style.flexGrow = '100'
  } else if (safe >= 100) {
    barOn.hidden = false
    barOff.hidden = true
    barOn.style.flexGrow = '100'
    barSeg.classList.toggle('is-done', done)
  } else {
    barOn.hidden = false
    barOff.hidden = false
    barOn.style.flexGrow = String(Math.max(safe, 2))
    barOff.style.flexGrow = String(Math.max(100 - safe, 2))
    barSeg.classList.toggle('is-done', done)
  }
}

function setSecondary(visible: boolean, label = 'Agora não') {
  btnSecondary.textContent = label
  btnSecondary.classList.toggle('is-on', visible)
  btnSecondary.setAttribute('aria-hidden', visible ? 'false' : 'true')
  btnSecondary.tabIndex = visible ? 0 : -1
}

function setPhase(next: Phase, message = '') {
  phase = next
  const installing = next === 'installing'
  metaEl.classList.toggle('is-installing', installing)
  barWrap.classList.toggle('is-on', installing)
  void setLead(
    next === 'idle'
      ? COPY.idle
      : next === 'installing'
        ? COPY.installing
        : next === 'done'
          ? COPY.done
          : COPY.error,
  )

  if (next === 'idle') {
    setStatus('')
    setProgress(0)
    setSecondary(false)
    btnMain.disabled = false
    btnMain.textContent = 'Instalar'
  } else if (next === 'installing') {
    setStatus('')
    setSecondary(false)
    btnMain.disabled = true
    btnMain.textContent = 'Instalando…'
    setProgress(3)
  } else if (next === 'done') {
    setStatus('')
    setProgress(100, true)
    setSecondary(true, 'Agora não')
    btnMain.disabled = false
    btnMain.textContent = 'Abrir'
  } else {
    setStatus(message || COPY.error, true)
    setSecondary(true, 'Fechar')
    btnMain.disabled = false
    btnMain.textContent = 'Tentar de novo'
  }
}

btnClose.addEventListener('click', () => {
  void getCurrentWindow().close()
})

btnSecondary.addEventListener('click', () => {
  if (!btnSecondary.classList.contains('is-on')) return
  void getCurrentWindow().close()
})

btnMain.addEventListener('click', async () => {
  if (phase === 'installing') return

  if (phase === 'done') {
    try {
      await invoke('launch_app')
      await getCurrentWindow().close()
    } catch (err) {
      setPhase('error', String(err))
    }
    return
  }

  setPhase('installing')
  const started = Date.now()
  const tick = window.setInterval(() => {
    const t = Math.min(1, (Date.now() - started) / MIN_INSTALL_MS)
    const eased = 1 - (1 - t) * (1 - t)
    setProgress(3 + eased * 85)
  }, 32)

  try {
    await invoke('run_silent_install')
    const elapsed = Date.now() - started
    if (elapsed < MIN_INSTALL_MS) {
      await sleep(MIN_INSTALL_MS - elapsed)
    }
    window.clearInterval(tick)
    setProgress(100, true)
    await sleep(180)
    setPhase('done')
  } catch (err) {
    window.clearInterval(tick)
    setPhase('error', String(err))
  }
})

setPhase('idle')
