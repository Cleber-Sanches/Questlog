import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { openExternal } from '@/lib/openExternal'

/** Se a resposta for um bloco só, quebra em parágrafos curtos para ler melhor. */
export function softenPlainReply(text: string): string {
  const t = text.trim()
  if (!t) return t
  // já parece markdown estruturado
  if (/^#{1,3}\s|^\s*[-*]\s|^\s*\d+\.\s|```|\*\*|__|\n\n/m.test(t)) {
    return t
  }
  // quebra por frases e agrupa de 2 em 2
  const sentences = t
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length <= 2) return t
  const chunks: string[] = []
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(' '))
  }
  return chunks.join('\n\n')
}

const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        if (href) void openExternal(href)
      }}
    >
      {children}
    </a>
  ),
  // evita nós soltos grandes
  p: ({ children }) => <p>{children}</p>,
}

export function AiMarkdown({ text }: { text: string }) {
  const source = softenPlainReply(text)
  return (
    <div className="aiMd">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )
}
