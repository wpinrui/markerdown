import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import type { EditMode } from '@shared/types'
import { EditorToolbar } from './EditorToolbar'
import { MilkdownEditor, MilkdownEditorRef } from './MilkdownEditor'
import { CodeMirrorEditor, CodeMirrorEditorRef } from './CodeMirrorEditor'
import { StyledMarkdown } from '../markdownConfig'
import { ActiveFormats, defaultFormats } from './editorTypes'

export type { ActiveFormats }

export interface MarkdownEditorRef {
  bold: () => void
  italic: () => void
  strikethrough: () => void
  heading: (level: number) => void
  bulletList: () => void
  orderedList: () => void
  taskList: () => void
  blockquote: () => void
  horizontalRule: () => void
  insertLink: () => void
  insertImage: () => void
  insertCode: () => void
  insertCodeBlock: () => void
  insertTable: () => void
  getActiveFormats: () => ActiveFormats
}

interface MarkdownEditorProps {
  content: string
  filePath: string
  mode: EditMode
  onModeChange: (mode: EditMode) => void
  onContentChange: (content: string) => void
  isDirty: boolean
  showToolbar?: boolean
  onSelectionChange?: (formats: ActiveFormats) => void
}

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  function MarkdownEditor(
    { content, filePath, mode, onModeChange, onContentChange, isDirty, showToolbar = true, onSelectionChange },
    ref
  ) {
    const milkdownRef = useRef<MilkdownEditorRef>(null)
    const codemirrorRef = useRef<CodeMirrorEditorRef>(null)
    const currentContentRef = useRef(content)

    // Helper to get active formats from current editor
    const getActiveFormats = useCallback((): ActiveFormats => {
      if (mode === 'visual') {
        return milkdownRef.current?.getActiveFormats() ?? defaultFormats
      } else if (mode === 'code') {
        return codemirrorRef.current?.getActiveFormats() ?? defaultFormats
      }
      return defaultFormats
    }, [mode])

    // Handle selection change from child editors
    const handleSelectionChange = useCallback((formats: ActiveFormats) => {
      onSelectionChange?.(formats)
    }, [onSelectionChange])

    // Expose formatting commands - delegate to active editor
    useImperativeHandle(ref, () => ({
      bold: () => {
        if (mode === 'visual') milkdownRef.current?.bold()
        else if (mode === 'code') codemirrorRef.current?.bold()
      },
      italic: () => {
        if (mode === 'visual') milkdownRef.current?.italic()
        else if (mode === 'code') codemirrorRef.current?.italic()
      },
      strikethrough: () => {
        if (mode === 'visual') milkdownRef.current?.strikethrough()
        else if (mode === 'code') codemirrorRef.current?.strikethrough()
      },
      heading: (level: number) => {
        if (mode === 'visual') milkdownRef.current?.heading(level)
        else if (mode === 'code') codemirrorRef.current?.heading(level)
      },
      bulletList: () => {
        if (mode === 'visual') milkdownRef.current?.bulletList()
        else if (mode === 'code') codemirrorRef.current?.bulletList()
      },
      orderedList: () => {
        if (mode === 'visual') milkdownRef.current?.orderedList()
        else if (mode === 'code') codemirrorRef.current?.orderedList()
      },
      taskList: () => {
        // Milkdown doesn't have task list toggle, use code editor
        if (mode === 'code') codemirrorRef.current?.taskList()
      },
      blockquote: () => {
        if (mode === 'visual') milkdownRef.current?.blockquote()
        else if (mode === 'code') codemirrorRef.current?.blockquote()
      },
      horizontalRule: () => {
        if (mode === 'visual') milkdownRef.current?.horizontalRule()
        else if (mode === 'code') codemirrorRef.current?.horizontalRule()
      },
      insertLink: () => {
        if (mode === 'visual') milkdownRef.current?.insertLink?.('', '')
        else if (mode === 'code') codemirrorRef.current?.insertLink()
      },
      insertImage: () => {
        if (mode === 'visual') milkdownRef.current?.insertImage?.('', '')
        else if (mode === 'code') codemirrorRef.current?.insertImage()
      },
      insertCode: () => {
        if (mode === 'visual') milkdownRef.current?.insertCode?.()
        else if (mode === 'code') codemirrorRef.current?.insertCode()
      },
      insertCodeBlock: () => {
        if (mode === 'visual') milkdownRef.current?.insertCodeBlock?.()
        else if (mode === 'code') codemirrorRef.current?.insertCodeBlock()
      },
      insertTable: () => {
        if (mode === 'visual') milkdownRef.current?.insertTable()
        else if (mode === 'code') codemirrorRef.current?.insertTable()
      },
      getActiveFormats,
    }))

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
              onSelectionChange={handleSelectionChange}
            />
          )}

          {mode === 'code' && (
            <CodeMirrorEditor
              ref={codemirrorRef}
              content={currentContentRef.current}
              onChange={handleContentChange}
              onSelectionChange={handleSelectionChange}
            />
          )}
        </div>
      </div>
    )
  }
)
