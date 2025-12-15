import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownViewerProps {
  content: string
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="markdown-viewer">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  )
}
