import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from 'motion/react'
import { memo, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { EASE_OUT } from '@/lib/motion/ease'
import type { AnimatedToast, ToastStatus } from '@/lib/toast/useAnimatedToastStack'
import { Tooltip } from '@/components/ui/Tooltip'

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

const STACK_SPRING: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.75,
}

const CONTENT_TRANSITION = {
  duration: 0.28,
  ease: EASE_OUT,
} as const

function ToastStatusIcon({ status }: { status: ToastStatus }) {
  if (status === 'success') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path
          fill="currentColor"
          d="M12 1.55 14.28 3l2.68-.28.95 2.52 2.52.95-.28 2.68L22.45 12 21 14.28l.28 2.68-2.52.95-.95 2.52-2.68-.28L12 22.45 9.72 21l-2.68.28-.95-2.52-2.52-.95.28-2.68L1.55 12 3 9.72l-.28-2.68 2.52-.95.95-2.52 2.68.28L12 1.55Z"
        />
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m8.2 12.15 2.45 2.45 5.2-5.3"
        />
      </svg>
    )
  }

  if (status === 'error') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path
          fill="currentColor"
          d="M12.9 3.2 22.3 19a1.6 1.6 0 0 1-1.4 2.4H3.1A1.6 1.6 0 0 1 1.7 19L11.1 3.2a1.6 1.6 0 0 1 1.8 0Z"
        />
        <path fill="#fff" d="M11.25 9.1h1.5v5.2h-1.5z" />
        <circle cx="12" cy="16.7" r="0.95" fill="#fff" />
      </svg>
    )
  }

  if (status === 'loading') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
        <path
          d="M21 12a9 9 0 1 1-6.22-8.56"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (status === 'info') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path fill="#fff" d="M11.25 10.5h1.5V17h-1.5z" />
        <circle cx="12" cy="7.6" r="1" fill="#fff" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a6 6 0 0 1 6 6c0 6.5 2.5 8 2.5 8H3.5S6 14.5 6 8a6 6 0 0 1 6-6Zm0 20a2.8 2.8 0 0 0 2.45-1.5h-4.9A2.8 2.8 0 0 0 12 22Z"
      />
    </svg>
  )
}

const POSITION_CLASS: Record<ToastPosition, string> = {
  'top-left': 'toastPos-top-left',
  'top-center': 'toastPos-top-center',
  'top-right': 'toastPos-top-right',
  'bottom-left': 'toastPos-bottom-left',
  'bottom-center': 'toastPos-bottom-center',
  'bottom-right': 'toastPos-bottom-right',
}

export function AnimatedToastStack({
  toasts,
  onDismiss,
  position = 'bottom-right',
  maxVisible = 4,
}: {
  toasts: AnimatedToast[]
  onDismiss?: (id: string) => void
  position?: ToastPosition
  maxVisible?: number
}) {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  const visibleToasts = toasts.slice(-maxVisible)
  const isBottom = position.startsWith('bottom')

  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  const stack = (
    <ol
      aria-live="polite"
      aria-atomic="false"
      className={[
        'toastStack',
        isBottom ? 'is-bottom' : 'is-top',
        POSITION_CLASS[position],
      ].join(' ')}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {visibleToasts.map((toast, index) => (
          <ToastItem key={toast.id} toast={toast} index={index} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </ol>
  )

  if (!portalTarget) return null
  return createPortal(stack, portalTarget)
}

const ToastItem = memo(function ToastItem({
  toast,
  index,
  onDismiss,
}: {
  toast: AnimatedToast
  index: number
  onDismiss?: (id: string) => void
}) {
  const reduce = useReducedMotion()
  const status = toast.status ?? 'neutral'
  const canDismiss = toast.dismissible !== false && Boolean(onDismiss)

  return (
    <motion.li
      layout
      initial={
        reduce ? { opacity: 0 } : { opacity: 0, y: 22, scale: 0.96, filter: 'blur(10px)' }
      }
      animate={
        reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
      }
      exit={
        reduce
          ? { opacity: 0 }
          : {
              opacity: 0,
              x: 32,
              scale: 0.96,
              filter: 'blur(8px)',
              transition: { duration: 0.18, ease: EASE_OUT },
            }
      }
      transition={STACK_SPRING}
      drag={canDismiss && !reduce ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.18}
      onDragEnd={(_, info) => {
        if (!canDismiss || !onDismiss) return
        if (Math.abs(info.offset.x) > 72 || Math.abs(info.velocity.x) > 520) {
          onDismiss(toast.id)
        }
      }}
      className="toastItem"
      style={{ zIndex: 20 - index }}
    >
      <div className="toastSurface">
        <div className="toastBody">
          <span className={`toastIconWrap is-${status}`}>
            <AnimatePresence initial={false}>
              <motion.span
                key={status}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.72 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.72 }}
                transition={{ type: 'spring', stiffness: 520, damping: 32, mass: 0.7 }}
                className={`toastIconInner${status === 'loading' ? ' is-spin' : ''}`}
              >
                <ToastStatusIcon status={status} />
              </motion.span>
            </AnimatePresence>
          </span>

          <div className="toastContent">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={`${toast.id}-${status}-${toast.title}`}
                initial={
                  reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: 'blur(6px)' }
                }
                animate={
                  reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }
                }
                exit={
                  reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: 'blur(6px)' }
                }
                transition={CONTENT_TRANSITION}
              >
                <p className="toastTitle">{toast.title}</p>
                {toast.description ? <p className="toastDescription">{toast.description}</p> : null}
              </motion.div>
            </AnimatePresence>
          </div>

          {canDismiss ? (
            <Tooltip content="Fechar" side="left">
              <button
                type="button"
                onClick={() => onDismiss?.(toast.id)}
                aria-label="Fechar"
                className="toastClose"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </motion.li>
  )
})
