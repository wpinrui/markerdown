import type { ActiveFormats, MarkdownEditorRef } from './MarkdownEditor'

interface FormatToolbarProps {
  editorRef: React.RefObject<MarkdownEditorRef | null>
  activeFormats: ActiveFormats
}

export function FormatToolbar({
  editorRef,
  activeFormats,
}: FormatToolbarProps) {
  return (
    <div className="editor-format-toolbar" onMouseDown={(e) => e.preventDefault()}>
      <button onClick={() => editorRef.current?.undo()} title="Undo (Ctrl+Z)">↶</button>
      <button onClick={() => editorRef.current?.redo()} title="Redo (Ctrl+Y)">↷</button>
      <span className="toolbar-divider" />
      <button className={activeFormats.bold ? 'active' : ''} onClick={() => editorRef.current?.bold()} title="Bold (Ctrl+B)">B</button>
      <button className={activeFormats.italic ? 'active' : ''} onClick={() => editorRef.current?.italic()} title="Italic (Ctrl+I)"><em>I</em></button>
      <button className={activeFormats.strikethrough ? 'active' : ''} onClick={() => editorRef.current?.strikethrough()} title="Strikethrough"><s>S</s></button>
      <span className="toolbar-divider" />
      <button className={activeFormats.headingLevel === 1 ? 'active' : ''} onClick={() => editorRef.current?.heading(1)} title="Heading 1">H1</button>
      <button className={activeFormats.headingLevel === 2 ? 'active' : ''} onClick={() => editorRef.current?.heading(2)} title="Heading 2">H2</button>
      <button className={activeFormats.headingLevel === 3 ? 'active' : ''} onClick={() => editorRef.current?.heading(3)} title="Heading 3">H3</button>
      <span className="toolbar-divider" />
      <button className={activeFormats.bulletList ? 'active' : ''} onClick={() => editorRef.current?.bulletList()} title="Bullet List">•</button>
      <button className={activeFormats.orderedList ? 'active' : ''} onClick={() => editorRef.current?.orderedList()} title="Numbered List">1.</button>
      <button className={activeFormats.taskList ? 'active' : ''} onClick={() => editorRef.current?.taskList()} title="Task List">☐</button>
      <span className="toolbar-divider" />
      <button className={activeFormats.link ? 'active' : ''} onClick={() => editorRef.current?.insertLink()} title="Link">🔗</button>
      <button onClick={() => editorRef.current?.insertImage()} title="Image">🖼</button>
      <button className={activeFormats.code ? 'active' : ''} onClick={() => editorRef.current?.insertCode()} title="Code">&lt;/&gt;</button>
      <button className={activeFormats.codeBlock ? 'active' : ''} onClick={() => editorRef.current?.insertCodeBlock()} title="Code Block">```</button>
      <span className="toolbar-divider" />
      <button className={activeFormats.blockquote ? 'active' : ''} onClick={() => editorRef.current?.blockquote()} title="Quote">"</button>
      <button onClick={() => editorRef.current?.horizontalRule()} title="Horizontal Rule">―</button>
      <button onClick={() => editorRef.current?.insertTable()} title="Table">⊞</button>
    </div>
  )
}
