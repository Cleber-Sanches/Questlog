import { useEffect, useState, type ComponentType } from 'react'
import {
  Check,
  ClipboardText,
  Medal,
  NotePencil,
  Trash,
  Trophy,
  X,
  type IconProps,
} from '@phosphor-icons/react'
import type { Achievement } from '@/types/achievement'
import { useModal } from '@/app/providers/ModalProvider'
import { DifficultyIcon } from './DifficultyIcon'
import { TipsEditor } from './TipsEditor'
import { Tooltip } from '@/components/ui/Tooltip'
import { useT } from '@/app/providers/LocaleProvider'
import type { MessageKey } from '@/i18n'

type EditorTab = 'dados' | 'adicionais' | 'classificacao'
type PhIcon = ComponentType<IconProps>

const TAB_KEYS: Array<{ id: EditorTab; labelKey: MessageKey; Icon: PhIcon }> = [
  { id: 'dados', labelKey: 'editor.tab.data', Icon: ClipboardText },
  { id: 'adicionais', labelKey: 'editor.tab.extra', Icon: NotePencil },
  { id: 'classificacao', labelKey: 'editor.tab.rating', Icon: Medal },
]

function normText(value: string | null | undefined) {
  return (value ?? '').trim()
}

function normDifficulty(value: Achievement['difficulty']) {
  return value || ''
}

function isDraftDirty(draft: Achievement, base: Achievement) {
  return (
    normText(draft.title) !== normText(base.title) ||
    normText(draft.group) !== normText(base.group) ||
    normText(draft.dlc) !== normText(base.dlc) ||
    normText(draft.description) !== normText(base.description) ||
    normText(draft.videoUrl) !== normText(base.videoUrl) ||
    normText(draft.guideUrl) !== normText(base.guideUrl) ||
    normText(draft.tips) !== normText(base.tips) ||
    normText(draft.reqLevel) !== normText(base.reqLevel) ||
    normDifficulty(draft.difficulty) !== normDifficulty(base.difficulty) ||
    !!draft.missable !== !!base.missable
  )
}

export function AchievementEditor({
  achievement,
  appId,
  onSave,
  onDelete,
  isNew = false,
  variant = 'drawer',
}: {
  achievement: Achievement
  /** AppID do jogo (mídia de dicas fica em media/{appId}/…) */
  appId: string
  onSave: (a: Achievement) => void
  onDelete?: () => void
  isNew?: boolean
  variant?: 'drawer' | 'panel'
}) {
  const { closeModal } = useModal()
  const t = useT()
  const mediaAppId = appId.trim() || 'misc'
  const [draft, setDraft] = useState(achievement)
  const [tab, setTab] = useState<EditorTab>('dados')
  const difficulty = draft.difficulty || ''
  const isPanel = variant === 'panel'
  const isDirty = isDraftDirty(draft, achievement)

  useEffect(() => {
    setDraft(achievement)
    setTab('dados')
  }, [achievement])

  const handleDismiss = () => {
    if (isPanel) {
      setDraft(achievement)
      return
    }
    closeModal()
  }

  useEffect(() => {
    if (isPanel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeModal()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const target = e.target as HTMLElement | null
        if (target?.closest('input, textarea, [contenteditable="true"]')) return
        e.preventDefault()
        const idx = TAB_KEYS.findIndex((item) => item.id === tab)
        const next =
          e.key === 'ArrowDown'
            ? TAB_KEYS[(idx + 1) % TAB_KEYS.length]
            : TAB_KEYS[(idx - 1 + TAB_KEYS.length) % TAB_KEYS.length]
        setTab(next.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPanel, closeModal, tab])

  const handleSave = () => {
    if (!isDirty) return
    onSave(draft)
    if (!isPanel) closeModal()
  }

  const panel = (
    <div
      className={isPanel ? 'detailPanel' : 'drawerPanel'}
      role={isPanel ? 'region' : 'dialog'}
      aria-modal={isPanel ? undefined : true}
      aria-label={isNew ? t('editor.new') : t('editor.edit')}
      onClick={isPanel ? undefined : (e) => e.stopPropagation()}
    >
      <div className="drawerTopBar">
        <div className="drawerIdentity" title={draft.title || t('editor.title.fallback')}>
          <div className="drawerIconSlot" aria-hidden>
            {draft.icon ? (
              <img src={draft.icon} alt="" />
            ) : (
              <span className="drawerIconPlaceholder">
                <Trophy size={18} weight="fill" aria-hidden />
              </span>
            )}
          </div>
          <input
            className="drawerTitleInput"
            type="text"
            placeholder={t('editor.title.placeholder')}
            value={draft.title}
            size={Math.max(4, Math.min(36, (draft.title || t('editor.title.placeholder')).length + 1))}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            aria-label={t('editor.title.aria')}
          />
        </div>

        <span className="drawerTopSpacer" aria-hidden />

        {!isPanel ? (
          <Tooltip content={t('editor.close.tip')} side="left" wrapperClassName="drawerCloseTip">
            <button type="button" className="drawerClose" onClick={handleDismiss} aria-label={t('common.close')}>
              <X size={14} weight="bold" aria-hidden />
            </button>
          </Tooltip>
        ) : null}
      </div>

      <div className="drawerSubject">
        <div className="drawerSubjectTrack" role="tablist" aria-label={t('editor.sections.aria')}>
          {TAB_KEYS.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`editor-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`editor-panel-${id}`}
              className={`drawerSubjectItem${tab === id ? ' is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon size={16} weight="fill" aria-hidden />
              <span>{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="drawerShell">
        <div className="drawerBody">
          {tab === 'dados' ? (
            <section
              className="drawerTabPanel"
              role="tabpanel"
              id="editor-panel-dados"
              aria-labelledby="editor-tab-dados"
            >
              <div className="drawerFields drawerFieldsSplit">
                <label className="drawerField">
                  <span>{t('editor.field.group')}</span>
                  <input
                    type="text"
                    placeholder={t('editor.field.group.placeholder')}
                    value={draft.group || ''}
                    onChange={(e) => setDraft({ ...draft, group: e.target.value })}
                  />
                </label>
                <label className="drawerField">
                  <span>{t('editor.field.dlc')}</span>
                  <input
                    type="text"
                    placeholder={t('editor.field.dlc.placeholder')}
                    value={draft.dlc || ''}
                    onChange={(e) => setDraft({ ...draft, dlc: e.target.value })}
                  />
                </label>
                <label className="drawerField drawerFieldFull">
                  <span>{t('editor.field.description')}</span>
                  <textarea
                    rows={3}
                    placeholder={t('editor.field.description.placeholder')}
                    value={draft.description || ''}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </label>
              </div>
            </section>
          ) : null}

          {tab === 'adicionais' ? (
            <section
              className="drawerTabPanel"
              role="tabpanel"
              id="editor-panel-adicionais"
              aria-labelledby="editor-tab-adicionais"
            >
              <div className="drawerFields drawerFieldsSplit">
                <label className="drawerField">
                  <span>{t('editor.field.video')}</span>
                  <input
                    type="url"
                    placeholder={t('editor.field.video.placeholder')}
                    value={draft.videoUrl || ''}
                    onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })}
                  />
                </label>
                <label className="drawerField">
                  <span>{t('editor.field.guide')}</span>
                  <input
                    type="url"
                    placeholder={t('editor.field.guide.placeholder')}
                    value={draft.guideUrl || ''}
                    onChange={(e) => setDraft({ ...draft, guideUrl: e.target.value })}
                  />
                </label>
                <label className="drawerField drawerFieldFull">
                  <span>{t('editor.field.tips')}</span>
                  <TipsEditor
                    appId={mediaAppId}
                    seedKey={achievement.id}
                    value={draft.tips || ''}
                    placeholder={t('editor.field.tips.placeholder')}
                    onChange={(tips) => setDraft((d) => ({ ...d, tips }))}
                  />
                </label>
              </div>
            </section>
          ) : null}

          {tab === 'classificacao' ? (
            <section
              className="drawerTabPanel"
              role="tabpanel"
              id="editor-panel-classificacao"
              aria-labelledby="editor-tab-classificacao"
            >
              <div className="drawerFields drawerFieldsClassificacao">
                <div className="drawerField">
                  <span>{t('editor.field.difficulty')}</span>
                  <div className="diffSeg" role="radiogroup" aria-label={t('editor.field.difficulty')}>
                    {(
                      [
                        { value: '', labelKey: 'editor.difficulty.none' as const, className: '' },
                        { value: 'easy', labelKey: 'difficulty.easy' as const, className: 'is-easy' },
                        { value: 'medium', labelKey: 'difficulty.medium' as const, className: 'is-medium' },
                        { value: 'hard', labelKey: 'difficulty.hard' as const, className: 'is-hard' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value || 'none'}
                        type="button"
                        className={`diffSegBtn ${opt.className} ${difficulty === opt.value ? 'is-active' : ''}`}
                        aria-pressed={difficulty === opt.value}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            difficulty: opt.value as Achievement['difficulty'],
                          })
                        }
                      >
                        {opt.value ? (
                          <span className="diffSegIcon">
                            <DifficultyIcon kind={opt.value} />
                          </span>
                        ) : null}
                        {t(opt.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="drawerClassifRow">
                  <label className="drawerField">
                    <span>{t('editor.field.reqLevel')}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={t('editor.field.reqLevel.placeholder')}
                      value={draft.reqLevel || ''}
                      onChange={(e) => setDraft({ ...draft, reqLevel: e.target.value })}
                    />
                  </label>

                  <div className="drawerField">
                    <span>{t('editor.field.missable')}</span>
                    <Tooltip
                      content={t('editor.field.missable.tip')}
                      side="bottom"
                      delay={450}
                      hideDelay={200}
                    >
                      <button
                        type="button"
                        className={`drawerMissableToggle${draft.missable ? ' is-active' : ''}`}
                        aria-pressed={!!draft.missable}
                        onClick={() => setDraft({ ...draft, missable: !draft.missable })}
                      >
                        <span className="drawerMissableIcon" aria-hidden>
                          <DifficultyIcon kind="missable" />
                        </span>
                        {t('editor.field.missable')}
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <div className="drawerShellActions">
          <div className="drawerShellActionsLeft">
            {!isNew && onDelete ? (
              <button type="button" className="drawerActionDanger" onClick={onDelete}>
                <Trash size={16} weight="fill" aria-hidden />
                <span>{t('common.delete')}</span>
              </button>
            ) : (
              <span aria-hidden />
            )}
          </div>
          <div className="drawerShellActionsRight">
            <button
              type="button"
              className="drawerActionPrimary"
              onClick={handleSave}
              disabled={!isDirty}
              aria-disabled={!isDirty}
            >
              <Check size={16} weight="bold" aria-hidden />
              <span>{t('common.save')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="drawerHintBar">
        <div className="drawerHintGroup">
          <span className="drawerHintKey">esc</span>
          <span className="drawerHintLabel">{t('editor.hint.close')}</span>
        </div>
      </div>
    </div>
  )

  if (isPanel) return panel

  return (
    <div className="drawer-backdrop" onClick={handleDismiss} role="presentation">
      {panel}
    </div>
  )
}
