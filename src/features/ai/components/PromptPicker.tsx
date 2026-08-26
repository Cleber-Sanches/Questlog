import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useT } from '@/app/providers/LocaleProvider'

export type PromptPickerOption = {
  value: string
  label: string
  group?: string
  logo?: string
}

export type PromptPickerProps = {
  value: string
  options: PromptPickerOption[]
  onChange: (value: string) => void
  onClose?: () => void
  onOpen?: () => void
  disabled?: boolean
  loading?: boolean
  placeholder?: string
  ariaLabel: string
  logo?: string
  grouped?: boolean
  className?: string
}

function formatGroupLabel(id: string) {
  if (id === 'opencode') return 'OpenCode'
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function PromptPicker({
  value,
  options,
  onChange,
  onClose,
  onOpen,
  disabled,
  loading,
  placeholder = 'Selecionar',
  ariaLabel,
  logo,
  grouped = false,
  className,
}: PromptPickerProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.find((option) => option.value === value)
  const label = loading ? t('common.loading') : selected?.label ?? (value || placeholder)

  const groupedOptions = useMemo(() => {
    if (!grouped) return [{ group: null as string | null, items: options }]
    const map = new Map<string, PromptPickerOption[]>()
    for (const option of options) {
      const group = option.group?.trim() || 'outros'
      const bucket = map.get(group) ?? []
      bucket.push(option)
      map.set(group, bucket)
    }
    return Array.from(map.entries()).map(([group, items]) => ({
      group,
      items,
    }))
  }, [grouped, options])

  const close = () => {
    setOpen(false)
    onClose?.()
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  const pick = (next: string) => {
    onChange(next)
    close()
  }

  let menuBody: ReactNode
  if (!options.length) {
    menuBody = <div className="aiPromptPickerEmpty">{t('ai.models.empty')}</div>
  } else {
    menuBody = groupedOptions.map(({ group, items }) => (
      <div key={group ?? 'flat'} className="aiPromptPickerGroup">
        {grouped && group ? (
          <div className="aiPromptPickerGroupLabel">{formatGroupLabel(group)}</div>
        ) : null}
        {items.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={active}
              className={`aiPromptPickerItem${active ? ' is-active' : ''}`}
              onClick={() => pick(option.value)}
            >
              {option.logo ? (
                <img
                  className="aiPromptPickerItemLogo"
                  src={option.logo}
                  alt=""
                  width={16}
                  height={16}
                  draggable={false}
                />
              ) : null}
              <span className="aiPromptPickerItemLabel">{option.label}</span>
              {active ? <i className="ph-bold ph-check aiPromptPickerCheck" aria-hidden /> : null}
            </button>
          )
        })}
      </div>
    ))
  }

  return (
    <div
      ref={rootRef}
      className={`aiPromptPickerRoot${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
    >
      <button
        type="button"
        className="aiPromptPickerTrigger"
        disabled={disabled || loading}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled || loading) return
          setOpen((prev) => {
            const next = !prev
            if (next) onOpen?.()
            return next
          })
        }}
      >
        {logo ? (
          <img
            className="aiPromptPickerLogo"
            src={logo}
            alt=""
            width={16}
            height={16}
            draggable={false}
          />
        ) : null}
        <span className="aiPromptPickerValue">{label}</span>
        <i className={`ph-bold ph-caret-${open ? 'up' : 'down'} aiPromptPickerCaret`} aria-hidden />
      </button>

      {open ? (
        <div id={listId} className="aiPromptPickerMenu" role="listbox" aria-label={ariaLabel}>
          {menuBody}
        </div>
      ) : null}
    </div>
  )
}
