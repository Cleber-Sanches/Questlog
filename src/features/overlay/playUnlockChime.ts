/** Ping curto do Questlog — um toque de vidro, sem fanfarra e sem ruído. */
let audioCtx: AudioContext | null = null

function context() {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!audioCtx) audioCtx = new AC()
  return audioCtx
}

function ping(ctx: AudioContext, dest: AudioNode, freq: number, start: number, dur: number, peak: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, start)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.985, start + dur)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(gain)
  gain.connect(dest)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

export function warmUnlockAudio() {
  const ctx = context()
  if (ctx?.state === 'suspended') void ctx.resume()
}

export function playUnlockChime() {
  const ctx = context()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()

  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.value = 0.55
  master.connect(ctx.destination)

  ping(ctx, master, 659.25, now, 0.55, 0.7)
  ping(ctx, master, 987.77, now + 0.04, 0.7, 0.45)
}

/** Toque mais curto para progresso — não compete com o desbloqueio. */
export function playProgressChime() {
  const ctx = context()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()

  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.value = 0.32
  master.connect(ctx.destination)

  ping(ctx, master, 659.25, now, 0.28, 0.55)
}
