import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from 'motion/react'
import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { EASE_OUT, SPRING_PRESS } from '@/lib/motion/ease'
import { useHoverCapable } from '@/lib/hooks/useHoverCapable'
import { Tooltip, type TooltipSide } from '@/components/ui/Tooltip'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children' | 'title'> {
  variant?: ButtonVariant
  size?: ButtonSize
  pressScale?: number
  ripple?: boolean
  children?: ReactNode
  tooltip?: ReactNode
  tooltipSide?: TooltipSide
  /** Vira tooltip animado (não usa o title nativo do browser). */
  title?: string
}

type Ripple = { id: number; x: number; y: number; size: number }

function buttonClass(
  variant: ButtonVariant,
  size: ButtonSize,
  ripple: boolean,
  extra?: string,
) {
  return [
    'btn',
    `btn-${variant}`,
    size === 'icon' ? 'btn-icon' : `btn-${size}`,
    ripple ? 'btn-has-ripple' : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    pressScale = 0.93,
    ripple = false,
    className = '',
    children,
    onPointerDown,
    type = 'button',
    tooltip,
    tooltipSide = 'top',
    title,
    ...rest
  },
  ref,
) {
  const reduce = useReducedMotion()
  const canHover = useHoverCapable()
  const [ripples, setRipples] = useState<Ripple[]>([])
  const nextId = useRef(0)

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (ripple && !reduce) {
        const rect = event.currentTarget.getBoundingClientRect()
        const rippleSize = Math.max(rect.width, rect.height) * 2
        const id = nextId.current++
        setRipples((prev) => [
          ...prev,
          {
            id,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            size: rippleSize,
          },
        ])
      }
      onPointerDown?.(event)
    },
    [ripple, reduce, onPointerDown],
  )

  const button = (
    <motion.button
      ref={ref}
      type={type}
      whileTap={reduce ? undefined : { scale: pressScale }}
      whileHover={reduce || !canHover || Boolean(tooltip ?? title) ? undefined : { scale: 1.02 }}
      transition={SPRING_PRESS}
      onPointerDown={handlePointerDown}
      className={buttonClass(variant, size, ripple, className)}
      {...rest}
    >
      {ripple && !reduce ? (
        <span className="btnRippleLayer" aria-hidden>
          <AnimatePresence>
            {ripples.map((r) => (
              <motion.span
                key={r.id}
                className="btnRipple"
                style={{
                  left: r.x,
                  top: r.y,
                  width: r.size,
                  height: r.size,
                }}
                initial={{ scale: 0.05, opacity: 0.28 }}
                animate={{ scale: 1, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.6, ease: EASE_OUT }}
                onAnimationComplete={() =>
                  setRipples((prev) => prev.filter((x) => x.id !== r.id))
                }
              />
            ))}
          </AnimatePresence>
        </span>
      ) : null}
      {children}
    </motion.button>
  )

  const tip = tooltip ?? title
  if (!tip) return button

  return (
    <Tooltip content={tip} side={tooltipSide}>
      {button}
    </Tooltip>
  )
})
