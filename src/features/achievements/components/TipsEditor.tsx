import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@/app/providers/LocaleProvider'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { convertFileSrc } from '@tauri-apps/api/core'
import { mediaApi } from '@/features/media/api'
import {
  plainTipsToHtml,
  registerMediaPair,
  tipsHtmlForDisplay,
  tipsHtmlForStorage,
} from '@/features/media/tipsHtml'

type Props = {
  appId: string
  /** Muda quando a conquista muda — reseed do editor */
  seedKey: string | number
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function TipsEditor({ appId, seedKey, value, onChange, placeholder }: Props) {
  const quillRef = useRef<ReactQuill | null>(null)
  const [displayHtml, setDisplayHtml] = useState('')
  const [ready, setReady] = useState(false)
  const seeding = useRef(true)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    ;(async () => {
      const asHtml = plainTipsToHtml(value || '')
      const resolved = await tipsHtmlForDisplay(asHtml)
      if (!cancelled) {
        seeding.current = true
        setDisplayHtml(resolved)
        setReady(true)
        requestAnimationFrame(() => {
          seeding.current = false
        })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed só ao abrir outra conquista
  }, [appId, seedKey])

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image'],
          ['clean'],
        ],
        handlers: {
          image: () => {
            void pickAndInsertImage(appId, quillRef.current)
          },
        },
      },
    }),
    [appId],
  )

  const t = useT()

  if (!ready) {
    return <div className="tipsEditor tipsEditor--loading">{t('tips.editor.loading')}</div>
  }

  return (
    <div className="tipsEditor">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={displayHtml}
        placeholder={placeholder}
        modules={modules}
        onChange={(html) => {
          setDisplayHtml(html)
          if (seeding.current) return
          const stored = tipsHtmlForStorage(html)
          const text = stored.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
          onChange(text ? stored : '')
        }}
      />
    </div>
  )
}

async function pickAndInsertImage(appId: string, quill: ReactQuill | null) {
  if (!quill) return
  const editor = quill.getEditor()

  const choice = window.prompt(
    'Cole a URL da imagem ou deixe vazio para escolher um arquivo local.',
    '',
  )
  if (choice === null) return

  try {
    let token: string
    let path: string

    if (choice.trim()) {
      const saved = await mediaApi.saveFromUrl(appId, choice.trim())
      token = saved.token
      path = saved.path
    } else {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      const file = await new Promise<File | null>((resolve) => {
        input.onchange = () => resolve(input.files?.[0] ?? null)
        input.click()
      })
      if (!file) return
      const dataUrl = await readAsDataUrl(file)
      const saved = await mediaApi.saveBase64(appId, dataUrl, file.type || undefined)
      token = saved.token
      path = saved.path
    }

    const display = convertFileSrc(path)
    registerMediaPair(token, display)

    const range = editor.getSelection(true)
    const index = range?.index ?? editor.getLength()
    editor.insertEmbed(index, 'image', display, 'user')
    editor.setSelection(index + 1, 0)
  } catch (err) {
    window.alert(err instanceof Error ? err.message : 'Falha ao salvar imagem.')
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}
