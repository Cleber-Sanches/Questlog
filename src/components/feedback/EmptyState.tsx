export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <p style={{ color: 'var(--color-text-title)', marginBottom: 6 }}>{title}</p>
      {hint ? <p>{hint}</p> : null}
    </div>
  )
}
