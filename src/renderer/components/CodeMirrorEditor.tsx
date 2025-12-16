import { useEffect, useRef, useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

interface CodeMirrorEditorProps {
  content: string
  onChange: (content: string) => void
}

export function CodeMirrorEditor({ content, onChange }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Track if we're programmatically updating content
  const isUpdatingRef = useRef(false)

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
