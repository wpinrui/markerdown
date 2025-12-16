import type { EditMode } from '@shared/types'
import { ModeToggle } from './ModeToggle'

interface EditorToolbarProps {
  mode: EditMode
  onModeChange: (mode: EditMode) => void
}

export function EditorToolbar({ mode, onModeChange }: EditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      <ModeToggle mode={mode} onModeChange={onModeChange} />
    </div>
  )
}
