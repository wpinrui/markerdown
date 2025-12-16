import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from '@milkdown/core'
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, wrapInHeadingCommand, wrapInBulletListCommand, wrapInOrderedListCommand, wrapInBlockquoteCommand, insertHrCommand, insertImageCommand } from '@milkdown/preset-commonmark'
import { gfm, toggleStrikethroughCommand, insertTableCommand } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { callCommand } from '@milkdown/utils'
import { nord } from '@milkdown/theme-nord'
import '@milkdown/theme-nord/style.css'

export interface MilkdownEditorRef {
  getMarkdown: () => string
  bold: () => void
  italic: () => void
  strikethrough: () => void
  heading: (level: number) => void
  bulletList: () => void
  orderedList: () => void
  blockquote: () => void
  horizontalRule: () => void
  insertImage: (src: string, alt?: string) => void
  insertTable: () => void
  insertLink: (href: string, text?: string) => void
  insertCode: () => void
  insertCodeBlock: () => void
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

    // Expose getMarkdown method and formatting commands
    useImperativeHandle(ref, () => ({
      getMarkdown: () => contentRef.current,
      bold: () => {
        editorRef.current?.action(callCommand(toggleStrongCommand.key))
      },
      italic: () => {
        editorRef.current?.action(callCommand(toggleEmphasisCommand.key))
      },
      strikethrough: () => {
        editorRef.current?.action(callCommand(toggleStrikethroughCommand.key))
      },
      heading: (level: number) => {
        editorRef.current?.action(callCommand(wrapInHeadingCommand.key, level))
      },
      bulletList: () => {
        editorRef.current?.action(callCommand(wrapInBulletListCommand.key))
      },
      orderedList: () => {
        editorRef.current?.action(callCommand(wrapInOrderedListCommand.key))
      },
      blockquote: () => {
        editorRef.current?.action(callCommand(wrapInBlockquoteCommand.key))
      },
      horizontalRule: () => {
        editorRef.current?.action(callCommand(insertHrCommand.key))
      },
      insertImage: (src: string, alt?: string) => {
        editorRef.current?.action(callCommand(insertImageCommand.key, { src, alt: alt || '' }))
      },
      insertTable: () => {
        editorRef.current?.action(callCommand(insertTableCommand.key))
      },
      insertLink: () => {
        // Links are handled via selection - just toggle inline code as placeholder
        // Users select text first, then apply link
      },
      insertCode: () => {
        // Toggle inline code - need to use prosemirror marks directly
        const editor = editorRef.current
        if (!editor) return
        // Insert backticks around selection or at cursor
      },
      insertCodeBlock: () => {
        // Insert code fence
        const editor = editorRef.current
        if (!editor) return
      },
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
