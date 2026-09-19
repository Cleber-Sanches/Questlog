import { useRef, useState, type RefObject } from 'react'
import { DotsSixVertical, LinkBreak, Plus } from '@phosphor-icons/react'
import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import { Modal } from '@/components/overlay/Modal'
import { Button } from '@/components/ui/Button'
import { useModal } from '@/app/providers/ModalProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { useGameLinks } from '@/features/games/hooks/useGameLinks'
import { defaultGameLinks, newLinkId } from '@/features/games/utils/links'
import { SPRING_SWAP } from '@/lib/motion/ease'
import type { Game, GameLink } from '@/types/game'

function emptyLink(): GameLink {
  return { id: newLinkId(), label: '', url: '' }
}

function GameLinkRow({
  row,
  canReorder,
  listRef,
  onUpdate,
  onUnlink,
}: {
  row: GameLink
  canReorder: boolean
  listRef: RefObject<HTMLElement | null>
  onUpdate: (id: string, patch: Partial<GameLink>) => void
  onUnlink: (id: string) => void
}) {
  const t = useT()
  const reduce = useReducedMotion()
  const controls = useDragControls()
  const [dragging, setDragging] = useState(false)

  return (
    <Reorder.Item
      value={row.id}
      dragListener={false}
      dragControls={canReorder ? controls : undefined}
      dragConstraints={listRef}
      dragElastic={0}
      dragMomentum={false}
      transition={reduce ? { duration: 0 } : SPRING_SWAP}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      className={`gameLinksEditorRow${dragging ? ' isDragging' : ''}`}
    >
      {canReorder ? (
        <div
          className="gameLinksDrag"
          role="button"
          aria-label={t('game.links.reorder')}
          onPointerDown={(event) => controls.start(event)}
        >
          <DotsSixVertical size={16} weight="bold" aria-hidden />
        </div>
      ) : (
        <span className="gameLinksDrag isIdle" aria-hidden />
      )}
      <input
        className="gameLinksEditorInput"
        value={row.label}
        onChange={(e) => onUpdate(row.id, { label: e.target.value })}
        placeholder={t('game.links.label.placeholder')}
        autoComplete="off"
        aria-label={t('game.links.label')}
      />
      <input
        className="gameLinksEditorInput"
        value={row.url}
        onChange={(e) => onUpdate(row.id, { url: e.target.value })}
        placeholder="https://"
        autoComplete="off"
        inputMode="url"
        aria-label={t('game.links.url')}
      />
      <button
        type="button"
        className="gameLinksIconBtn"
        aria-label={t('game.links.unlink')}
        title={t('game.links.unlink')}
        onClick={() => onUnlink(row.id)}
      >
        <LinkBreak size={16} weight="bold" aria-hidden />
      </button>
    </Reorder.Item>
  )
}

export function GameLinksEditor({ game }: { game: Game }) {
  const t = useT()
  const { closeModal } = useModal()
  const { save } = useGameLinks(game)
  const listRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<GameLink[]>(() =>
    game.links?.length ? game.links.map((l) => ({ ...l })) : defaultGameLinks(game.appId),
  )
  const [busy, setBusy] = useState(false)
  const canReorder = draft.length > 1

  function update(id: string, patch: Partial<GameLink>) {
    setDraft((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function handleReorder(ids: string[]) {
    setDraft((rows) => {
      const byId = new Map(rows.map((row) => [row.id, row]))
      return ids.flatMap((id) => {
        const row = byId.get(id)
        return row ? [row] : []
      })
    })
  }

  async function handleSave() {
    setBusy(true)
    const ok = await save(draft)
    setBusy(false)
    if (ok) closeModal()
  }

  return (
    <Modal className="gameLinksModal" title={t('game.links.manageTitle', { name: game.name })}>
      <p className="gameLinksHint">{t('game.links.hint')}</p>
      <div ref={listRef} className="gameLinksEditorListWrap">
        <div className="gameLinksEditorHead" aria-hidden>
          <span />
          <span>{t('game.links.label')}</span>
          <span>{t('game.links.url')}</span>
          <span />
        </div>
        <Reorder.Group
          as="ul"
          axis="y"
          values={draft.map((row) => row.id)}
          onReorder={handleReorder}
          className="gameLinksEditorList"
        >
          {draft.map((row) => (
            <GameLinkRow
              key={row.id}
              row={row}
              canReorder={canReorder}
              listRef={listRef}
              onUpdate={update}
              onUnlink={(id) => setDraft((current) => current.filter((r) => r.id !== id))}
            />
          ))}
        </Reorder.Group>
      </div>
      <button
        type="button"
        className="gameLinksAdd"
        onClick={() => setDraft((current) => [...current, emptyLink()])}
      >
        <Plus size={14} weight="bold" aria-hidden />
        {t('game.links.add')}
      </button>
      <div className="modal-actions">
        <Button variant="secondary" size="md" onClick={closeModal}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" size="md" disabled={busy} onClick={() => void handleSave()}>
          {busy ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </Modal>
  )
}
