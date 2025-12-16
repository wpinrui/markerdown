import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { nord } from '@milkdown/theme-nord'
import '@milkdown/theme-nord/style.css'

export interface MilkdownEditorRef {
  getMarkdown: () => string
}

interface MilkdownEditorProps {
  content: string
  onChange: (content: string) => void
}

export const MilkdownEditor = forwardRef<MilkdownEditorRef, MilkdownEditorProps>(
  function MilkdownEditor({ content, onChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const editorRef = useRef<Editor | null>(null)
    const contentRef = useRef(content)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    // Expose getMarkdown method
    useImperativeHandle(ref, () => ({
      getMarkdown: () => contentRef.current,
    }))

    useEffect(() => {
      if (!containerRef.current) return

      let destroyed = false

      const initEditor = async () => {
        const editor = await Editor.make()
          .config((ctx) => {
            ctx.set(rootCtx, containerRef.current!)
            ctx.set(defaultValueCtx, content)
            ctx.set(editorViewOptionsCtx, {
              attributes: {
                class: 'milkdown-editor-content',
                spellcheck: 'false',
              },
            })
            ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
              contentRef.current = markdown
              onChangeRef.current(markdown)
            })
          })
          .config(nord)
          .use(commonmark)
          .use(gfm)
          .use(history)
          .use(clipboard)
          .use(listener)
          .create()

        if (destroyed) {
          editor.destroy()
          return
        }

        editorRef.current = editor
      }

      initEditor()

      return () => {
        destroyed = true
        editorRef.current?.destroy()
        editorRef.current = null
      }
    }, []) // Only run on mount

    // Update content when prop changes (e.g., switching files)
    useEffect(() => {
      // Skip initial render - editor handles initial content
      if (!editorRef.current) return

      // Recreate editor with new content when file changes
      // Milkdown doesn't have a simple way to replace all content,
      // so we need to destroy and recreate
      const editor = editorRef.current

      // For now, just update our ref - the editor was created with initial content
      // If user switches files, the component should remount with new key
      contentRef.current = content
    }, [content])

    return <div ref={containerRef} className="milkdown-editor" />
  }
)
