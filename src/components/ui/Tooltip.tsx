import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from 'motion/react'
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { EASE_OUT } from '@/lib/motion/ease'
import { useDismiss } from '@/lib/hooks/useDismiss'
import { useHoverGesture } from '@/lib/hooks/useHoverGesture'
import { useTapGesture } from '@/lib/hooks/useTapGesture'

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

export type TooltipProps = {
  content: ReactNode
  children: ReactElement
  side?: TooltipSide
  /** Delay antes de mostrar (ms). Default 120. */
  delay?: number
  /** Delay antes de esconder ao sair (ms). Default 0. */
  hideDelay?: number
  className?: string
  wrapperClassName?: string
}

const GAP = 8
const EDGE = 10
const NEED_Y = 44
const NEED_X = 168

const OPPOSITE: Record<TooltipSide, TooltipSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

const transformOrigin: Record<TooltipSide, string> = {
  top: 'center bottom',
  bottom: 'center top',
  left: 'right center',
  right: 'left center',
}

const offsetFrom: Record<TooltipSide, { x?: number; y?: number }> = {
  top: { y: 8 },
  bottom: { y: -8 },
  left: { x: 8 },
  right: { x: -8 },
}

function buildVariants(side: TooltipSide): Variants {
  const o = offsetFrom[side]
  return {
    initial: {
      opacity: 0,
      scale: 0.9,
      filter: 'blur(5px)',
      x: o.x ?? 0,
      y: o.y ?? 0,
    },
    animate: {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      x: 0,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 380,
        damping: 30,
        mass: 0.7,
        opacity: { duration: 0.14, ease: EASE_OUT },
        filter: { duration: 0.18, ease: EASE_OUT },
      },
    },
    exit: {
      opacity: 0,
      scale: 0.94,
      filter: 'blur(3px)',
      x: (o.x ?? 0) * 0.6,
      y: (o.y ?? 0) * 0.6,
      transition: { duration: 0.12, ease: EASE_OUT },
    },
  }
}

const REDUCED_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.14, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } },
}

const WARM_WINDOW_MS = 300
let lastHiddenAt = 0

export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 120,
  hideDelay = 0,
  className,
  wrapperClassName,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<CSSProperties | null>(null)
  const [placedSide, setPlacedSide] = useState<TooltipSide>(side)
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  const id = useId()
  const timer = useRef<number | null>(null)
  const hideTimer = useRef<number | null>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const hover = useHoverGesture()
  const tap = useTapGesture()
  const reduce = useReducedMotion()

  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  const clearTimers = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const place = useCallback(() => {
    const wrap = anchorRef.current
    if (!wrap) return
    const el = (wrap.firstElementChild as HTMLElement | null) ?? wrap
    const nextSide = resolveSide(el, side)
    setPlacedSide(nextSide)
    setCoords(coordsFromEl(el, nextSide))
  }, [side])

  const show = useCallback(() => {
    clearTimers()
    const warm = Date.now() - lastHiddenAt < WARM_WINDOW_MS
    timer.current = window.setTimeout(
      () => {
        place()
        setOpen(true)
      },
      warm ? 0 : delay,
    )
  }, [clearTimers, delay, place])

  const hide = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
    const close = () => {
      setOpen((wasOpen) => {
        if (wasOpen) lastHiddenAt = Date.now()
        return false
      })
    }
    if (hideDelay > 0) {
      hideTimer.current = window.setTimeout(close, hideDelay)
      return
    }
    close()
  }, [hideDelay])

  const toggleOnTap = useCallback(() => {
    const gesture = tap.take()
    if (!gesture || gesture.pointerType === 'mouse') return
    if (gesture.state) {
      hide()
      return
    }
    clearTimers()
    place()
    setOpen(true)
  }, [clearTimers, hide, place, tap])

  useDismiss(open, hide, anchorRef)

  useEffect(() => {
    if (!open) return
    const onMove = () => place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, place])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  const variants = useMemo(
    () => (reduce ? REDUCED_VARIANTS : buildVariants(placedSide)),
    [reduce, placedSide],
  )

  if (!isValidElement(children)) return children
  if (!content) return children

  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-describedby': open ? id : undefined,
  })

  const tip = portalTarget
    ? createPortal(
        <AnimatePresence>
          {open && coords ? (
            <span
              className={`uiTooltipAnchor is-${placedSide}`}
              style={coords}
            >
              <motion.span
                id={id}
                role="tooltip"
                variants={variants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{ transformOrigin: transformOrigin[placedSide] }}
                className={['uiTooltip', className].filter(Boolean).join(' ')}
              >
                {content}
              </motion.span>
            </span>
          ) : null}
        </AnimatePresence>,
        portalTarget,
      )
    : null

  return (
    <>
      <span
        ref={anchorRef}
        className={['uiTooltipWrap', wrapperClassName].filter(Boolean).join(' ')}
        onPointerEnter={(event: ReactPointerEvent) => {
          if (hover.enter(event)) show()
        }}
        onPointerLeave={(event: ReactPointerEvent) => {
          if (hover.leave(event)) hide()
        }}
        onFocus={show}
        onBlur={hide}
        onPointerDown={(event: ReactPointerEvent) => tap.start(event, open)}
        onPointerCancel={tap.drop}
        onKeyDown={tap.drop}
        onClick={toggleOnTap}
      >
        {trigger}
      </span>
      {tip}
    </>
  )
}

function resolveSide(el: HTMLElement, preferred: TooltipSide): TooltipSide {
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  const fits: Record<TooltipSide, boolean> = {
    top: r.top >= NEED_Y + EDGE,
    bottom: vh - r.bottom >= NEED_Y + EDGE,
    left: r.left >= NEED_X + EDGE,
    right: vw - r.right >= NEED_X + EDGE,
  }

  if (fits[preferred]) return preferred
  const flipped = OPPOSITE[preferred]
  if (fits[flipped]) return flipped
  if (fits.bottom) return 'bottom'
  if (fits.top) return 'top'
  return preferred
}

function coordsFromEl(el: HTMLElement, side: TooltipSide): CSSProperties {
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const tipMax = Math.min(280, vw - 24)

  if (side === 'top' || side === 'bottom') {
    const centerX = r.left + r.width / 2
    const left = Math.min(
      Math.max(EDGE, centerX - tipMax / 2),
      vw - EDGE - tipMax,
    )
    const base =
      side === 'top'
        ? { bottom: vh - r.top + GAP }
        : { top: r.bottom + GAP }
    return {
      ...base,
      left,
      width: tipMax,
    }
  }
  if (side === 'left') {
    return {
      top: r.top,
      height: r.height,
      right: vw - r.left + GAP,
    }
  }
  return {
    top: r.top,
    height: r.height,
    left: r.right + GAP,
  }
}

/** Tooltip preso a um elemento já existente (ex.: img no HTML de dicas). */
export function AnchorTooltip({
  anchor,
  content,
  side = 'top',
}: {
  anchor: HTMLElement | null
  content: ReactNode
  side?: TooltipSide
}) {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  const [coords, setCoords] = useState<CSSProperties | null>(null)
  const [placedSide, setPlacedSide] = useState<TooltipSide>(side)
  const reduce = useReducedMotion()
  const id = useId()

  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  useEffect(() => {
    if (!anchor) {
      setCoords(null)
      return
    }
    const place = () => {
      const nextSide = resolveSide(anchor, side)
      setPlacedSide(nextSide)
      setCoords(coordsFromEl(anchor, nextSide))
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchor, side])

  const variants = useMemo(
    () => (reduce ? REDUCED_VARIANTS : buildVariants(placedSide)),
    [reduce, placedSide],
  )

  if (!portalTarget || !anchor || !content || !coords) return null

  return createPortal(
    <AnimatePresence>
      <span className={`uiTooltipAnchor is-${placedSide}`} style={coords}>
        <motion.span
          id={id}
          role="tooltip"
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ transformOrigin: transformOrigin[placedSide] }}
          className="uiTooltip"
        >
          {content}
        </motion.span>
      </span>
    </AnimatePresence>,
    portalTarget,
  )
}
