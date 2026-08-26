import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { AnimatedToastStack } from '@/components/feedback/AnimatedToastStack'
import {
  useAnimatedToastStack,
  type ToastStatus,
} from '@/lib/toast/useAnimatedToastStack'

type ToastKind = 'info' | 'error' | 'success'

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const KIND_TO_STATUS: Record<ToastKind, ToastStatus> = {
  info: 'info',
  error: 'error',
  success: 'success',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, showToast, dismissToast } = useAnimatedToastStack({
    defaultDuration: 3600,
    limit: 5,
  })

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      showToast({
        title: message,
        status: KIND_TO_STATUS[kind],
      })
    },
    [showToast],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <AnimatedToastStack toasts={toasts} onDismiss={dismissToast} position="bottom-right" />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast fora do ToastProvider')
  return ctx
}
