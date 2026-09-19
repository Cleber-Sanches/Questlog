import { useEffect, useState } from 'react'
import { useT } from '@/app/providers/LocaleProvider'
import { useGuideImport } from '@/features/guide-io/hooks/useGuideImport'
import { isGuideFile, looksLikeGuidePack } from '@/features/guide-io/utils/parsePack'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function GuideShareDrop() {
  const t = useT()
  const { importGuide, importGuideText } = useGuideImport()
  const [over, setOver] = useState(false)

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files')

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setOver(true)
    }
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (e: DragEvent) => {
      const next = e.relatedTarget
      if (next instanceof Node && document.documentElement.contains(next)) return
      setOver(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      setOver(false)
      const file = Array.from(e.dataTransfer?.files || []).find(isGuideFile)
      if (file) void importGuide(file)
    }
    const onPaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target)) return
      const text = e.clipboardData?.getData('text') || ''
      if (!looksLikeGuidePack(text)) return
      e.preventDefault()
      void importGuideText(text)
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [importGuide, importGuideText])

  if (!over) return null

  return (
    <div className="guideShareDrop" role="status">
      <div className="guideShareDropCard">
        <i className="ph ph-download-simple" aria-hidden />
        <p>{t('guide.io.drop.title')}</p>
      </div>
    </div>
  )
}
