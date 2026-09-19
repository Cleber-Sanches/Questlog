import { useMemo, useState, type ReactNode } from 'react'
import { Modal } from '@/components/overlay/Modal'
import { Button } from '@/components/ui/Button'
import { useModal } from '@/app/providers/ModalProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { useAppData } from '@/app/providers/AppDataProvider'
import { GameCover } from '@/features/games/components/GameCover'
import { DifficultyIcon } from '@/features/achievements/components/DifficultyIcon'
import { showHiddenAchievements } from '@/features/achievements/utils/hidden'
import type { GuidePackPreviewRow, GuidePackSummary } from '@/features/guide-io/utils/parsePack'
import type { MessageKey } from '@/i18n'

const DIFF_KEYS: Record<'easy' | 'medium' | 'hard', MessageKey> = {
  easy: 'difficulty.easy',
  medium: 'difficulty.medium',
  hard: 'difficulty.hard',
}

function diffKind(value: string): 'easy' | 'medium' | 'hard' | null {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value
  return null
}

function PreviewRow({
  row,
  isHidden,
}: {
  row: GuidePackPreviewRow
  isHidden: boolean
}) {
  const t = useT()
  const difficulty = diffKind(row.difficulty)

  const marks: Array<{ key: string; node: ReactNode }> = []
  if (isHidden) {
    marks.push({
      key: 'hidden',
      node: (
        <span className="guideImportMark isHidden">
          <i className="ph ph-eye-slash" aria-hidden />
          <span>{t('achievement.hidden.badge')}</span>
        </span>
      ),
    })
  }
  if (difficulty) {
    marks.push({
      key: 'diff',
      node: (
        <span className={`guideImportMark is-${difficulty}`}>
          <DifficultyIcon kind={difficulty} />
          <span>{t(DIFF_KEYS[difficulty])}</span>
        </span>
      ),
    })
  }
  if (row.missable) {
    marks.push({
      key: 'missable',
      node: (
        <span className="guideImportMark isMissable">
          <DifficultyIcon kind="missable" />
          <span>{t('row.missable')}</span>
        </span>
      ),
    })
  }
  if (row.hasTips) {
    marks.push({ key: 'tips', node: <span className="guideImportMark">{t('row.tips')}</span> })
  }
  if (row.hasGuide) {
    marks.push({ key: 'guide', node: <span className="guideImportMark">{t('row.guide')}</span> })
  }
  if (row.hasVideo) {
    marks.push({ key: 'video', node: <span className="guideImportMark">{t('row.video')}</span> })
  }

  return (
    <li className="guideImportRow">
      {row.icon ? (
        <img className="guideImportRowIcon" src={row.icon} alt="" width={30} height={30} />
      ) : (
        <span className="guideImportRowIcon isEmpty" aria-hidden>
          <i className="ph ph-trophy" />
        </span>
      )}
      <div className="guideImportRowMain">
        <span className="guideImportRowName">{row.title}</span>
        {marks.length > 0 ? (
          <p className="guideImportRowMeta">
            {marks.map((mark) => (
              <span key={mark.key} className="guideImportMarkWrap">
                {mark.node}
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </li>
  )
}

export function GuideImportPreview({
  summary,
  onConfirm,
}: {
  summary: GuidePackSummary
  onConfirm: () => Promise<void> | void
}) {
  const { closeModal } = useModal()
  const { games, activeGame, achievements, settings } = useAppData()
  const t = useT()
  const [busy, setBusy] = useState(false)
  const revealHidden = showHiddenAchievements(settings)

  const game = useMemo(() => {
    const appId = summary.appId || activeGame?.appId || ''
    const known = games.find((g) => g.appId === appId) ?? activeGame
    return {
      appId,
      name: summary.gameName || known?.name || appId,
      image: known?.image ?? null,
      icon: known?.icon ?? null,
      clienticon: known?.clienticon ?? null,
      links: known?.links ?? [],
    }
  }, [games, activeGame, summary.appId, summary.gameName])

  const hiddenByApi = useMemo(() => {
    const map = new Map<string, boolean>()
    if (!summary.appId || activeGame?.appId !== summary.appId) return map
    for (const achievement of achievements) {
      if (achievement.apiName) map.set(achievement.apiName, Boolean(achievement.hidden))
    }
    return map
  }, [achievements, activeGame?.appId, summary.appId])

  const rows = useMemo(() => {
    const filled = summary.rows.filter((row) => row.hasContent)
    const bare = summary.rows.filter((row) => !row.hasContent)
    return [...filled, ...bare]
  }, [summary.rows])

  async function confirm() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
      closeModal()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('guide.io.preview.title')} className="guideImportPreview">
      <div className="guideImportHero">
        <GameCover game={game} className="guideImportCover" />
        <div className="guideImportHeroFade" aria-hidden />
        <div className="guideImportHuntCopy">
          <p className="guideImportGame">{summary.gameName}</p>
          <p className="guideImportNote">
            {summary.switchesGame
              ? t('guide.io.preview.switch', { name: summary.gameName })
              : t('guide.io.preview.same')}
          </p>
          {!summary.hasContent ? (
            <p className="guideImportNote isSoft">{t('guide.io.preview.empty')}</p>
          ) : null}
        </div>
      </div>

      {summary.count > 0 ? (
        <div className="guideImportBody">
          <ul className="guideImportList">
            {rows.map((row) => {
              const isHidden = row.hidden || hiddenByApi.get(row.key) === true
              return (
                <PreviewRow
                  key={row.key}
                  row={row}
                  isHidden={isHidden && revealHidden}
                />
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="guideImportBottom">
        <div className="guideImportActions">
          <Button onClick={closeModal} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void confirm()} disabled={busy}>
            {t('guide.io.preview.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
