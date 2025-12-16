import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

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
}

interface CodeMirrorEditorProps {
  content: string
  onChange: (content: string) => void
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorRef, CodeMirrorEditorProps>(
  function CodeMirrorEditor({ content, onChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    // Track if we're programmatically updating content
    const isUpdatingRef = useRef(false)

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
    }))

    const handleChange = useCallback((update: { docChanged: boolean; state: EditorState }) => {
      if (update.docChanged && !isUpdatingRef.current) {
        onChangeRef.current(update.state.doc.toString())
      }
    }, [])

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

    return <div ref={containerRef} className="codemirror-editor" />
  }
)
