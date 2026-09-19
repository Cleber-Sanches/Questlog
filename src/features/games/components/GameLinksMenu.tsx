import { useEffect, useRef, useState } from 'react'
import { LinkSimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useModal } from '@/app/providers/ModalProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { openExternal } from '@/lib/openExternal'
import { linkGlyph } from '@/features/games/utils/links'
import { useGameLinks } from '@/features/games/hooks/useGameLinks'
import { GameLinksEditor } from './GameLinksEditor'

export function GameLinksMenu() {
  const t = useT()
  const { activeGame } = useAppData()
  const { openModal } = useModal()
  const { seedDefaults, links } = useGameLinks(activeGame)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!activeGame) return null

  function openEditor() {
    const current = activeGame
    if (!current) return
    setOpen(false)
    openModal(<GameLinksEditor game={current} />)
  }

  return (
    <div className="gameLinksMenu" ref={rootRef}>
      <Button
        variant="secondary"
        size="icon"
        className={open ? 'is-open' : undefined}
        title={open ? undefined : t('game.links.aria')}
        tooltipSide="bottom"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('game.links.aria')}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <LinkSimple size={18} weight="bold" className="btnIcon gameLinksGlyph" aria-hidden />
      </Button>

      {open ? (
        <div className="gameLinksPanel" role="dialog" aria-label={t('game.links.title')}>
          <div className="gameLinksPanelHead">
            <span className="gameLinksPanelTitle">{t('game.links.title')}</span>
            {links.length > 0 ? (
              <span className="gameLinksPanelCount">{links.length}</span>
            ) : null}
          </div>
          {links.length === 0 ? (
            <div className="gameLinksEmpty">
              <p>{t('game.links.empty')}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void seedDefaults()
                }}
              >
                {t('game.links.seed')}
              </Button>
            </div>
          ) : (
            <ul className="gameLinksList">
              {links.map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    className="gameLinksItem"
                    onClick={() => {
                      void openExternal(link.url)
                      setOpen(false)
                    }}
                  >
                    <i className={linkGlyph(link.url, link.label)} aria-hidden />
                    <span>{link.label}</span>
                    <i className="ph ph-arrow-square-out gameLinksItemGo" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="gameLinksPanelFoot">
            <button type="button" className="gameLinksManage" onClick={openEditor}>
              {t('game.links.manage')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
