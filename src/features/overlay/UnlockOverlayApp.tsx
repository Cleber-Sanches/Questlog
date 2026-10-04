import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { DifficultyIcon } from '@/features/achievements/components/DifficultyIcon'
import { overlayDifficulty, type UnlockOverlayPayload } from './types'
import { formatHudCount } from '@/lib/format'

export function UnlockOverlayApp() {
  const [payload, setPayload] = useState<UnlockOverlayPayload | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [brokenIcon, setBrokenIcon] = useState(false)
  const [token, setToken] = useState(0)

  useEffect(() => {
    document.documentElement.classList.add('is-overlay', 'dark')
    document.body.classList.add('is-overlay')
    return () => {
      document.documentElement.classList.remove('is-overlay')
      document.body.classList.remove('is-overlay')
    }
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    void listen<UnlockOverlayPayload>('unlock-overlay', (event) => {
      setLeaving(false)
      setBrokenIcon(false)
      setPayload(event.payload)
      setToken((n) => n + 1)
    }).then((fn) => {
      unlisten = fn
    })
    return () => unlisten?.()
  }, [])

  useEffect(() => {
    if (!payload) return
    const leave = window.setTimeout(() => setLeaving(true), 6200)
    return () => window.clearTimeout(leave)
  }, [payload, token])

  if (!payload) return <div className="unlockOverlay" />

  const showArt = Boolean(payload.icon) && !brokenIcon
  const difficulty = overlayDifficulty(payload.difficulty)
  const missable = Boolean(payload.missable)
  const showMarks = Boolean(difficulty || missable)
  const progressMax =
    typeof payload.progressMax === 'number' && payload.progressMax > 0
      ? payload.progressMax
      : null
  const progress =
    progressMax == null
      ? null
      : Math.min(progressMax, Math.max(0, payload.progress ?? 0))
  const progressPct =
    progressMax && progress != null ? Math.round((progress / progressMax) * 100) : 0
  const progressDone = progressMax != null && progress != null && progress >= progressMax

  return (
    <div className={`unlockOverlay${leaving ? ' is-leaving' : ''}`} key={token}>
      <div className={`unlockBanner${progressMax ? ' has-progress' : ''}`}>
        <div className={`unlockArt${showArt ? '' : ' is-fallback'}`}>
          {showArt ? (
            <img
              className="unlockArtImg"
              src={payload.icon ?? ''}
              alt=""
              width={44}
              height={44}
              onError={() => setBrokenIcon(true)}
            />
          ) : (
            <span className="unlockArtFallback" aria-hidden>
              <i className="ph-fill ph-trophy" />
            </span>
          )}
        </div>
        <div className="unlockBannerBody">
          <p className="unlockBannerKicker">{payload.kicker}</p>
          <div className="unlockTitleRow">
            <p className="unlockBannerTitle">{payload.title}</p>
            {showMarks ? (
              <div className="unlockMarks">
                {missable ? (
                  <span className="diffChip is-iconOnly is-missable">
                    <DifficultyIcon kind="missable" />
                  </span>
                ) : null}
                {difficulty ? (
                  <span className={`diffChip is-iconOnly is-${difficulty}`}>
                    <DifficultyIcon kind={difficulty} />
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="unlockFoot">
            {progressMax != null && progress != null ? (
              <div className={`unlockProgress${progressDone ? ' is-done' : ''}`}>
                <div
                  className="segmentedBar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progressMax}
                  aria-valuenow={progress}
                >
                  {progressPct > 0 ? (
                    <span
                      className="segmentedBarTip"
                      style={{ flexGrow: Math.max(progressPct, 2) }}
                    >
                      <span className={`segmentedBarSeg isOn${progressDone ? ' is-done' : ''}`} />
                    </span>
                  ) : null}
                  {progressPct < 100 ? (
                    <span
                      className="segmentedBarTip"
                      style={{ flexGrow: Math.max(100 - progressPct, 2) }}
                    >
                      <span className="segmentedBarSeg" />
                    </span>
                  ) : null}
                </div>
                <span className="unlockProgressText">
                  {formatHudCount(progress)}/{formatHudCount(progressMax)}
                </span>
              </div>
            ) : payload.subtitle ? (
              <p className="unlockBannerSub">{payload.subtitle}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
