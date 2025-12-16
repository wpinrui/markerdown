import { useRef, useCallback } from 'react'
import type { EditMode } from '@shared/types'
import { EditorToolbar } from './EditorToolbar'
import { MilkdownEditor, MilkdownEditorRef } from './MilkdownEditor'
import { CodeMirrorEditor } from './CodeMirrorEditor'
import { StyledMarkdown } from '../markdownConfig'

interface MarkdownEditorProps {
  content: string
  filePath: string
  mode: EditMode
  onModeChange: (mode: EditMode) => void
  onContentChange: (content: string) => void
  isDirty: boolean
  showToolbar?: boolean
}

export function MarkdownEditor({
  content,
  filePath,
  mode,
  onModeChange,
  onContentChange,
  isDirty,
  showToolbar = true,
}: MarkdownEditorProps) {
  const milkdownRef = useRef<MilkdownEditorRef>(null)
  const currentContentRef = useRef(content)

  // Track content changes
  const handleContentChange = useCallback(
    (newContent: string) => {
      currentContentRef.current = newContent
      onContentChange(newContent)
    },
    [onContentChange]
  )

  // Handle mode switching - sync content between editors
  const handleModeChange = useCallback(
    (newMode: EditMode) => {
      // When leaving visual mode, get the latest content from Milkdown
      if (mode === 'visual' && milkdownRef.current) {
        const markdown = milkdownRef.current.getMarkdown()
        currentContentRef.current = markdown
      }
      onModeChange(newMode)
    },
    [mode, onModeChange]
  )

  return (
    <div className="markdown-editor">
      {showToolbar && (
        <EditorToolbar mode={mode} onModeChange={handleModeChange} isDirty={isDirty} />
      )}

      <div className="markdown-editor-content">
        {mode === 'view' && <StyledMarkdown content={content} />}

        {mode === 'visual' && (
          <MilkdownEditor
            key={filePath} // Remount when file changes
            ref={milkdownRef}
            content={currentContentRef.current}
            onChange={handleContentChange}
          />
        )}

        {mode === 'code' && (
          <CodeMirrorEditor
            content={currentContentRef.current}
            onChange={handleContentChange}
          />
        )}
      </div>
    </div>
  )
}
