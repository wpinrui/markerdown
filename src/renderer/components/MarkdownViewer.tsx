import { useState, useEffect } from 'react'
import Markdown from 'react-markdown'
import 'katex/dist/katex.min.css'
import { REMARK_PLUGINS, REHYPE_PLUGINS } from '../markdownConfig'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.0
const ZOOM_STEP = 0.1

interface MarkdownViewerProps {
  content: string
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
      } else if (e.key === '-') {
        e.preventDefault()
        setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="markdown-viewer" style={{ fontSize: `${zoom}em` }}>
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
      >
        {content}
      </Markdown>
    </div>
  )
}
