import type { MouseEvent } from 'react'
import type { Achievement, GroupBy } from '@/types/achievement'
import { formatPercent, formatProgressCount } from '@/lib/format'
import { openExternal } from '@/lib/openExternal'
import { resolveVideoAction } from '@/lib/url'
import { useModal } from '@/app/providers/ModalProvider'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useT, useLocale } from '@/app/providers/LocaleProvider'
import type { MessageKey } from '@/i18n'
import { achievementDescription, achievementGroup, achievementTitle } from '@/features/achievements/utils/display'
import { isBaseDlc, isPlaceholderGroup } from '@/features/achievements/utils/keys'
import { AchievementEditor } from './AchievementEditor'
import { VideoModal } from '@/components/overlay/VideoModal'
import { ConfirmDialog } from '@/components/overlay/ConfirmDialog'
import { Modal } from '@/components/overlay/Modal'
import { DifficultyIcon } from './DifficultyIcon'
import { TipsHtml } from './TipsHtml'
import { tipsHasImage } from '@/features/media/tipsHtml'
import { Tooltip } from '@/components/ui/Tooltip'

const DIFF_LABEL_KEYS: Record<'easy' | 'medium' | 'hard', MessageKey> = {
  easy: 'difficulty.easy',
  medium: 'difficulty.medium',
  hard: 'difficulty.hard',
}

function diffKey(value?: string | null): 'easy' | 'medium' | 'hard' | null {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value
  return null
}

function tipsIsEmpty(tips?: string | null): boolean {
  const raw = tips?.trim()
  if (!raw) return true
  if (tipsHasImage(raw)) return false
  return !raw.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

export function AchievementRow({
  achievement,
  groupBy,
  compact = false,
  selected = false,
  onSelect,
  onToggle,
  onSave,
  onDelete,
}: {
  achievement: Achievement
  groupBy: GroupBy
  compact?: boolean
  selected?: boolean
  onSelect?: () => void
  onToggle: () => void
  onSave: (a: Achievement) => void
  onDelete: () => void
}) {
  const { openModal } = useModal()
  const { activeGame } = useAppData()
  const t = useT()
  const { locale, bcp47 } = useLocale()
  const appId = activeGame?.appId || 'misc'
  const title = achievementTitle(achievement, locale)
  const description = achievementDescription(achievement, locale)
  const groupLabel = achievementGroup(achievement, locale)
  const completed = !!achievement.completed
  const isManual = completed && !!achievement.completedManual
  const difficulty = diffKey(achievement.difficulty)
  const dlc = (achievement.dlc || '').trim()
  const showDlc = groupBy === 'flat' && dlc && !isBaseDlc(dlc)
  const showGroup = groupBy === 'flat' && !isPlaceholderGroup(achievement.group)
  const hasVideo = !!achievement.videoUrl?.trim()
  const hasGuide = !!achievement.guideUrl?.trim()
  const hasTips = !tipsIsEmpty(achievement.tips)
  const hasTipImages = tipsHasImage(achievement.tips)
  const reqLevel = achievement.reqLevel?.trim()
  const progressMax =
    typeof achievement.progressMax === 'number' && achievement.progressMax > 0
      ? achievement.progressMax
      : null
  const progressCurrent =
    progressMax == null
      ? null
      : Math.min(
          progressMax,
          Math.max(0, typeof achievement.progress === 'number' ? achievement.progress : 0),
        )
  const progressPct =
    progressMax && progressCurrent != null
      ? Math.round((progressCurrent / progressMax) * 100)
      : 0
  const progressLabel =
    progressMax != null && progressCurrent != null
      ? `${formatProgressCount(progressCurrent, bcp47)} / ${formatProgressCount(progressMax, bcp47)}`
      : ''
  const progressTitle =
    progressMax != null && progressCurrent != null
      ? `${progressCurrent.toLocaleString(bcp47)} / ${progressMax.toLocaleString(bcp47)}`
      : ''
  const statusLabel = completed
    ? isManual
      ? t('row.status.manual')
      : t('row.status.completed')
    : t('row.status.complete')
  const tipsTooltip = hasTips
    ? hasTipImages
      ? t('row.tips.withImage')
      : t('row.tips')
    : t('row.tips.empty')

  const openEditor = () => {
    if (onSelect) {
      onSelect()
      return
    }
    openModal(
      <AchievementEditor
        achievement={achievement}
        appId={appId}
        onSave={onSave}
        onDelete={() =>
          openModal(
            <ConfirmDialog
              title={t('guide.delete.title')}
              message={t('guide.delete.message')}
              confirmLabel={t('common.delete')}
              onConfirm={onDelete}
            />,
          )
        }
      />,
    )
  }

  const openTips = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openModal(
      <Modal title={`${t('row.tips')} · ${title}`}>
        {hasTips ? (
          <TipsHtml html={achievement.tips || ''} />
        ) : (
          <p className="tipsEmpty">{t('row.tips.emptyBody')}</p>
        )}
      </Modal>,
    )
  }

  const openVideo = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const action = resolveVideoAction(achievement.videoUrl)
    if (!action) return
    if (action.mode === 'external') {
      void openExternal(action.url)
      return
    }
    openModal(
      <VideoModal title={title} url={action.url} embedUrl={action.embedUrl} />,
    )
  }

  const openGuide = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    void openExternal(achievement.guideUrl)
  }

  return (
    <article
      className={`achievement isClickable${compact ? ' isCompact' : ''}${selected ? ' isSelected' : ''}${completed ? ' isCompleted' : ''}${isManual ? ' isManual' : ''}`}
      onClick={(e) => {
        const t = e.target as HTMLElement
        // Só ignora controles reais (botões/links). cardMeta / helpLinks
        // não podem engolir o clique ou a faixa inferior fica "morta".
        if (t.closest('.status, button, a, input, label, .globalStat, .titleMarks, .achieveProgress')) {
          return
        }
        openEditor()
      }}
    >
      {achievement.icon ? (
        <img className="achievementIcon" src={achievement.icon} alt="" />
      ) : (
        <div className="achievementIcon" />
      )}

      <div className="info">
        <div className="titleRow">
          <h2>
            {title}
            {isManual ? (
              <span className="manualBadge">
                <i className="ph-bold ph-hand" aria-hidden /> {t('row.status.manual')}
              </span>
            ) : null}
          </h2>
          {(difficulty || achievement.missable || showDlc || reqLevel) && (
            <div className="titleMarks">
              {reqLevel ? <span className="levelTag">{reqLevel}</span> : null}
              {showDlc ? <span className="steamDlcTag">DLC</span> : null}
              {achievement.missable ? (
                <Tooltip content={t('row.missable')} side="top">
                  <span className="diffChip is-iconOnly is-missable">
                    <DifficultyIcon kind="missable" />
                  </span>
                </Tooltip>
              ) : null}
              {difficulty ? (
                <Tooltip content={t(DIFF_LABEL_KEYS[difficulty])} side="top">
                  <span className={`diffChip is-iconOnly is-${difficulty}`}>
                    <DifficultyIcon kind={difficulty} />
                  </span>
                </Tooltip>
              ) : null}
            </div>
          )}
        </div>

        <p>{description}</p>

        {progressMax != null && progressCurrent != null ? (
          <div
            className={`achieveProgress${completed ? ' isDone' : ''}`}
            title={progressTitle}
          >
            <div
              className="achieveProgressTrack"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progressMax}
              aria-valuenow={progressCurrent}
              aria-label={progressTitle}
            >
              <div className="achieveProgressFill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="achieveProgressText">{progressLabel}</span>
          </div>
        ) : null}

        <div className="cardMeta">
          {showGroup ? (
            <span className="metaChip groupBadge">
              <i className="ph-duotone ph-folder" aria-hidden />
              <span>{groupLabel}</span>
            </span>
          ) : null}
          <div className="helpLinks">
            {hasVideo ? (
              <button type="button" className="helpLink helpVideo" onClick={openVideo}>
                <i className="ph-duotone ph-play" aria-hidden />
                <span>{t('row.video')}</span>
              </button>
            ) : (
              <span className="helpLink isDisabled" aria-disabled="true">
                <i className="ph-duotone ph-play" aria-hidden />
                <span>{t('row.video')}</span>
              </span>
            )}
            {hasGuide ? (
              <button type="button" className="helpLink" onClick={openGuide}>
                <i className="ph-duotone ph-book-open" aria-hidden />
                <span>{t('row.guide')}</span>
              </button>
            ) : (
              <span className="helpLink isDisabled" aria-disabled="true">
                <i className="ph-duotone ph-book-open" aria-hidden />
                <span>{t('row.guide')}</span>
              </span>
            )}
            <Tooltip content={tipsTooltip} side="top">
              <button
                type="button"
                className={`helpLink helpTip${hasTips ? '' : ' isMuted'}${hasTipImages ? ' hasImages' : ''}`}
                onClick={openTips}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <i className="ph-duotone ph-note" aria-hidden />
                <span>{t('row.tips')}</span>
                {hasTipImages ? (
                  <span className="helpTipImageMark" aria-label={t('row.tips.hasImage')}>
                    <i className="ph-bold ph-image" aria-hidden />
                  </span>
                ) : null}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="actions">
        <Tooltip
          content={completed ? t('row.status.markPending') : t('row.status.markCompleted')}
          side="left"
        >
          <label className="status" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={completed} onChange={onToggle} />
            <span className="statusIcon statusIconOff" aria-hidden>
              <i className="ph ph-circle" />
            </span>
            <span className="statusIcon statusIconOn" aria-hidden>
              <i className="ph-bold ph-check" />
            </span>
            <span className="statusLabel">{statusLabel}</span>
          </label>
        </Tooltip>
        {typeof achievement.globalPercent === 'number' ? (
          <Tooltip content={t('row.globalRarity')} side="left">
            <span className="globalStat">{formatPercent(achievement.globalPercent)}</span>
          </Tooltip>
        ) : null}
      </div>
    </article>
  )
}
