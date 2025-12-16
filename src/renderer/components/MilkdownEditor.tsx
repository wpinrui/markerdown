import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx, editorViewCtx } from '@milkdown/core'
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, wrapInHeadingCommand, wrapInBulletListCommand, wrapInOrderedListCommand, wrapInBlockquoteCommand, insertHrCommand, insertImageCommand } from '@milkdown/preset-commonmark'
import { gfm, toggleStrikethroughCommand, insertTableCommand } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { callCommand } from '@milkdown/utils'
import { nord } from '@milkdown/theme-nord'
import '@milkdown/theme-nord/style.css'

export interface ActiveFormats {
  bold: boolean
  italic: boolean
  strikethrough: boolean
  code: boolean
  link: boolean
  headingLevel: number | null // 1-6 or null
  bulletList: boolean
  orderedList: boolean
  taskList: boolean
  blockquote: boolean
  codeBlock: boolean
}

export interface MilkdownEditorRef {
  getMarkdown: () => string
  getActiveFormats: () => ActiveFormats
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
  onSelectionChange?: (formats: ActiveFormats) => void
}

const defaultFormats: ActiveFormats = {
  bold: false,
  italic: false,
  strikethrough: false,
  code: false,
  link: false,
  headingLevel: null,
  bulletList: false,
  orderedList: false,
  taskList: false,
  blockquote: false,
  codeBlock: false,
}

export const MilkdownEditor = forwardRef<MilkdownEditorRef, MilkdownEditorProps>(
  function MilkdownEditor({ content, onChange, onSelectionChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const editorRef = useRef<Editor | null>(null)
    const contentRef = useRef(content)
    const onChangeRef = useRef(onChange)
    const onSelectionChangeRef = useRef(onSelectionChange)
    onChangeRef.current = onChange
    onSelectionChangeRef.current = onSelectionChange

    // Helper to detect active formats from ProseMirror state
    const getActiveFormats = (): ActiveFormats => {
      const editor = editorRef.current
      if (!editor) return defaultFormats

      try {
        const view = editor.ctx.get(editorViewCtx)
        const { state } = view
        const { from, to, $from } = state.selection
        const formats: ActiveFormats = { ...defaultFormats }

        // Check marks - use rangeHasMark for selections, storedMarks/cursor marks for collapsed cursor
        const schema = state.schema
        const isCollapsed = from === to

        if (isCollapsed) {
          // Cursor position - check stored marks or marks at position
          const marks = state.storedMarks || $from.marks()
          for (const mark of marks) {
            if (mark.type.name === 'strong') formats.bold = true
            if (mark.type.name === 'emphasis') formats.italic = true
            if (mark.type.name === 'strikethrough') formats.strikethrough = true
            if (mark.type.name === 'inlineCode') formats.code = true
            if (mark.type.name === 'link') formats.link = true
          }
        } else {
          // Selection - check if mark spans the entire selection
          const markChecks = [
            { name: 'strong', format: 'bold' },
            { name: 'emphasis', format: 'italic' },
            { name: 'strikethrough', format: 'strikethrough' },
            { name: 'inlineCode', format: 'code' },
            { name: 'link', format: 'link' },
          ] as const
          for (const { name, format } of markChecks) {
            const markType = schema.marks[name]
            if (markType && state.doc.rangeHasMark(from, to, markType)) {
              formats[format] = true
            }
          }
        }

        // Check parent nodes for block-level formatting
        for (let depth = $from.depth; depth >= 0; depth--) {
          const node = $from.node(depth)
          if (node.type.name === 'heading') {
            formats.headingLevel = node.attrs.level as number
          }
          if (node.type.name === 'bullet_list') formats.bulletList = true
          if (node.type.name === 'ordered_list') formats.orderedList = true
          if (node.type.name === 'list_item' && node.attrs.checked !== undefined) {
            formats.taskList = true
          }
          if (node.type.name === 'blockquote') formats.blockquote = true
          if (node.type.name === 'code_block') formats.codeBlock = true
        }

        return formats
      } catch {
        return defaultFormats
      }
    }

    // Expose getMarkdown method and formatting commands
    useImperativeHandle(ref, () => ({
      getMarkdown: () => contentRef.current,
      getActiveFormats,
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

        // Set up selection change tracking
        const view = editor.ctx.get(editorViewCtx)
        const originalDispatch = view.dispatch.bind(view)
        view.dispatch = (tr) => {
          originalDispatch(tr)
          if (tr.selectionSet || tr.docChanged) {
            onSelectionChangeRef.current?.(getActiveFormats())
          }
        }
      }

      initEditor()

      return () => {
        destroyed = true
        editorRef.current?.destroy()
        editorRef.current = null
      }
    }, []) // Only run on mount

    // Track clicks and keyboard navigation for selection changes
    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const handleSelectionChange = () => {
        if (editorRef.current) {
          onSelectionChangeRef.current?.(getActiveFormats())
        }
      }

      container.addEventListener('click', handleSelectionChange)
      container.addEventListener('keyup', handleSelectionChange)

      return () => {
        container.removeEventListener('click', handleSelectionChange)
        container.removeEventListener('keyup', handleSelectionChange)
      }
    }, [])

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
