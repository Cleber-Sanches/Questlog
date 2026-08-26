import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface ModalContextValue {
  openModal: (node: ReactNode) => void
  closeModal: () => void
}

const ModalContext = createContext<ModalContextValue | null>(null)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null)

  const openModal = useCallback((n: ReactNode) => setNode(n), [])
  const closeModal = useCallback(() => setNode(null), [])

  const value = useMemo(() => ({ openModal, closeModal }), [openModal, closeModal])

  return (
    <ModalContext.Provider value={value}>
      {children}
      {node}
    </ModalContext.Provider>
  )
}

export function useModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal fora do ModalProvider')
  return ctx
}
