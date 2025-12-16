import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { ActiveFormats, defaultFormats } from './editorTypes'

export type { ActiveFormats }

export interface CodeMirrorEditorRef {
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

interface CodeMirrorEditorProps {
  content: string
  filePath: string
  onChange: (content: string) => void
  onSelectionChange?: (formats: ActiveFormats) => void
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorRef, CodeMirrorEditorProps>(
  function CodeMirrorEditor({ content, filePath, onChange, onSelectionChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    const onSelectionChangeRef = useRef(onSelectionChange)
    onChangeRef.current = onChange
    onSelectionChangeRef.current = onSelectionChange

    // Track if we're programmatically updating content
    const isUpdatingRef = useRef(false)

    // Helper to detect active formats from markdown at cursor
    const getActiveFormats = useCallback((): ActiveFormats => {
      const view = viewRef.current
      if (!view) return defaultFormats

      const { from } = view.state.selection.main
      const doc = view.state.doc
      const line = doc.lineAt(from)
      const lineText = line.text
      const formats: ActiveFormats = { ...defaultFormats }

      // Check line-level formatting
      const headingMatch = lineText.match(/^(#{1,6})\s/)
      if (headingMatch) {
        formats.headingLevel = headingMatch[1].length
      }

      if (/^\s*[-*+]\s(?!\[)/.test(lineText)) formats.bulletList = true
      if (/^\s*\d+\.\s/.test(lineText)) formats.orderedList = true
      if (/^\s*[-*+]\s\[[ x]\]/.test(lineText)) formats.taskList = true
      if (/^\s*>\s/.test(lineText)) formats.blockquote = true

      // Check if inside code block by scanning up/down for ```
      let inCodeBlock = false
      let fenceCount = 0
      for (let i = 1; i <= line.number; i++) {
        const l = doc.line(i).text
        if (/^```/.test(l)) fenceCount++
      }
      if (fenceCount % 2 === 1) {
        inCodeBlock = true
        formats.codeBlock = true
      }

      // Check inline formatting around cursor (simplified check)
      if (!inCodeBlock) {
        // Get text around cursor (before and after on current line)
        const cursorCol = from - line.from
        const beforeCursor = lineText.slice(0, cursorCol)
        const afterCursor = lineText.slice(cursorCol)

        // Count opening/closing markers before cursor to determine if we're "inside"
        const countBefore = (pattern: RegExp) => (beforeCursor.match(pattern) || []).length

        // Bold: ** or __
        const boldOpenBefore = countBefore(/\*\*(?!\s)/g)
        const boldCloseBefore = countBefore(/(?<!\s)\*\*/g)
        if (boldOpenBefore > boldCloseBefore) formats.bold = true

        // Italic: * or _ (not ** or __)
        const italicOpenBefore = countBefore(/(?<!\*)\*(?!\*|\s)/g)
        const italicCloseBefore = countBefore(/(?<!\s|\*)\*(?!\*)/g)
        if (italicOpenBefore > italicCloseBefore) formats.italic = true

        // Strikethrough: ~~
        const strikeOpenBefore = countBefore(/~~(?!\s)/g)
        const strikeCloseBefore = countBefore(/(?<!\s)~~/g)
        if (strikeOpenBefore > strikeCloseBefore) formats.strikethrough = true

        // Inline code: `
        const codeCount = countBefore(/`/g)
        if (codeCount % 2 === 1) formats.code = true

        // Link: check if cursor is inside [text](url)
        if (/\[[^\]]*$/.test(beforeCursor) && /^[^\]]*\]\([^)]*\)/.test(afterCursor)) {
          formats.link = true
        }
      }

      return formats
    }, [])

    // Helper to wrap selection or insert at cursor
    const wrapSelection = useCallback((before: string, after: string) => {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      const selectedText = view.state.doc.sliceString(from, to)
      view.dispatch({
        changes: { from, to, insert: before + selectedText + after },
        selection: { anchor: from + before.length, head: to + before.length },
      })
      view.focus()
    }, [])

    // Helper to insert text at cursor
    const insertAtCursor = useCallback((text: string) => {
      const view = viewRef.current
      if (!view) return
      const { from } = view.state.selection.main
      view.dispatch({
        changes: { from, to: from, insert: text },
        selection: { anchor: from + text.length },
      })
      view.focus()
    }, [])

    // Helper to insert at line start
    const insertAtLineStart = useCallback((prefix: string) => {
      const view = viewRef.current
      if (!view) return
      const { from } = view.state.selection.main
      const line = view.state.doc.lineAt(from)
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: prefix },
      })
      view.focus()
    }, [])

    // Expose formatting commands
    useImperativeHandle(ref, () => ({
      bold: () => wrapSelection('**', '**'),
      italic: () => wrapSelection('*', '*'),
      strikethrough: () => wrapSelection('~~', '~~'),
      heading: (level: number) => insertAtLineStart('#'.repeat(level) + ' '),
      bulletList: () => insertAtLineStart('- '),
      orderedList: () => insertAtLineStart('1. '),
      taskList: () => insertAtLineStart('- [ ] '),
      blockquote: () => insertAtLineStart('> '),
      horizontalRule: () => insertAtCursor('\n---\n'),
      insertLink: () => {
        const view = viewRef.current
        if (!view) return
        const { from, to } = view.state.selection.main
        const selectedText = view.state.doc.sliceString(from, to) || 'link text'
        const linkMd = `[${selectedText}](url)`
        view.dispatch({
          changes: { from, to, insert: linkMd },
          selection: { anchor: from + selectedText.length + 3, head: from + selectedText.length + 6 },
        })
        view.focus()
      },
      insertImage: () => {
        const view = viewRef.current
        if (!view) return
        const { from } = view.state.selection.main
        const imgMd = '![alt text](image-url)'
        view.dispatch({
          changes: { from, to: from, insert: imgMd },
          selection: { anchor: from + 2, head: from + 10 },
        })
        view.focus()
      },
      insertCode: () => wrapSelection('`', '`'),
      insertCodeBlock: () => insertAtCursor('\n```\n\n```\n'),
      insertTable: () => insertAtCursor('\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n'),
      getActiveFormats,
    }))

    const handleChange = useCallback((update: { docChanged: boolean; selectionSet: boolean; state: EditorState }) => {
      if (update.docChanged && !isUpdatingRef.current) {
        onChangeRef.current(update.state.doc.toString())
      }
      if (update.selectionSet || update.docChanged) {
        onSelectionChangeRef.current?.(getActiveFormats())
      }
    }, [getActiveFormats])

    useEffect(() => {
      if (!containerRef.current) return

      const state = EditorState.create({
        doc: content,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          markdown(),
          oneDark,
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of(handleChange),
          EditorView.theme({
            '&': {
              height: '100%',
              fontSize: '14px',
            },
            '.cm-scroller': {
              overflow: 'auto',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            },
            '.cm-content': {
              padding: '16px 0',
            },
            '.cm-gutters': {
              backgroundColor: '#1e1e1e',
              borderRight: '1px solid #333',
            },
          }),
        ],
      })

      const view = new EditorView({
        state,
        parent: containerRef.current,
      })

      viewRef.current = view

      return () => {
        view.destroy()
        viewRef.current = null
      }
    }, [handleChange])

    // Update content when prop changes (e.g., when switching files)
    useEffect(() => {
      const view = viewRef.current
      if (!view) return

      const currentContent = view.state.doc.toString()
      if (currentContent !== content) {
        isUpdatingRef.current = true
        view.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
        })
        isUpdatingRef.current = false
      }
    }, [content])

    // Handle paste events for image pasting
    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const handlePaste = async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items
        if (!items) return

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            e.preventDefault()

            const file = item.getAsFile()
            if (!file) continue

            // Convert to data URL
            const reader = new FileReader()
            reader.onload = async () => {
              const dataUrl = reader.result as string

              // Determine extension from MIME type
              const extension = item.type.split('/')[1] === 'jpeg' ? '.jpg' : `.${item.type.split('/')[1]}`

              // Save image via IPC
              const result = await window.electronAPI.saveImage(filePath, dataUrl, extension)

              if (result.success && result.relativePath) {
                // Insert markdown image syntax at cursor
                const view = viewRef.current
                if (!view) return

                const { from } = view.state.selection.main
                const imgMd = `![image](${result.relativePath})`
                view.dispatch({
                  changes: { from, to: from, insert: imgMd },
                  selection: { anchor: from + imgMd.length },
                })
                view.focus()
              } else {
                console.error('Failed to save image:', result.error)
              }
            }
            reader.readAsDataURL(file)
            break
          }
        }
      }

      container.addEventListener('paste', handlePaste)
      return () => container.removeEventListener('paste', handlePaste)
    }, [filePath])

    return <div ref={containerRef} className="codemirror-editor" />
  }
)
