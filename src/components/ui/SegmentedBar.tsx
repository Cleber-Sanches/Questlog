import type { ReactElement, ReactNode } from 'react'
import { Tooltip } from '@/components/ui/Tooltip'
import { useT } from '@/app/providers/LocaleProvider'

function BarTip({
  count,
  unit,
  tone,
}: {
  count: number
  unit: string
  tone: 'on' | 'off' | 'platinum'
}) {
  return (
    <span className="segmentedBarBubbleInner">
      <strong>{count}</strong>
      <span className="segmentedBarBubbleLabel">
        <span className={`segmentedBarBubbleDot is-${tone}`} aria-hidden />
        {unit}
      </span>
    </span>
  )
}

function BarHover({
  grow,
  content,
  children,
}: {
  grow: number
  content: ReactNode
  children: ReactElement
}) {
  return (
    <span className="segmentedBarTip" style={{ flexGrow: grow }}>
      <Tooltip
        content={content}
        side="top"
        delay={480}
        hideDelay={80}
        className="segmentedBarBubble"
        wrapperClassName="segmentedBarTipFill"
      >
        {children}
      </Tooltip>
    </span>
  )
}

export function SegmentedBar({
  percent,
  done = 0,
  pending = 0,
  platinum = false,
  className,
}: {
  percent: number
  done?: number
  pending?: number
  platinum?: boolean
  className?: string
}) {
  const t = useT()
  const safe = Math.min(100, Math.max(0, percent))
  const rest = 100 - safe
  const doneLabel = done === 1 ? t('library.bar.done.one') : t('library.bar.done', { n: done })
  const pendingLabel =
    pending === 1 ? t('library.pending.one') : t('library.pending', { n: pending })
  const doneUnit = done === 1 ? t('library.bar.done.unit.one') : t('library.bar.done.unit')
  const pendingUnit =
    pending === 1 ? t('library.bar.pending.unit.one') : t('library.bar.pending.unit')

  return (
    <div
      className={['segmentedBar', platinum ? 'isPlatinum' : '', className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
      aria-label={`${doneLabel}, ${pendingLabel}`}
    >
      {safe > 0 ? (
        <BarHover
          grow={Math.max(safe, 2)}
          content={
            <BarTip count={done} unit={doneUnit} tone={platinum ? 'platinum' : 'on'} />
          }
        >
          <span className="segmentedBarSeg isOn" />
        </BarHover>
      ) : null}
      {rest > 0 ? (
        <BarHover
          grow={Math.max(rest, 2)}
          content={<BarTip count={pending} unit={pendingUnit} tone="off" />}
        >
          <span className="segmentedBarSeg" />
        </BarHover>
      ) : null}
    </div>
  )
}
