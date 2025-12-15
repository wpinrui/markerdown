import Markdown from 'react-markdown'

interface MarkdownViewerProps {
  content: string
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="markdown-viewer">
      <Markdown>{content}</Markdown>
    </div>
  )
}
