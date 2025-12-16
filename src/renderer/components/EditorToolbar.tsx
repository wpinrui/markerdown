import type { EditMode } from '@shared/types'
import { ModeToggle } from './ModeToggle'

interface EditorToolbarProps {
  mode: EditMode
  onModeChange: (mode: EditMode) => void
  isDirty: boolean
}

export function EditorToolbar({ mode, onModeChange, isDirty }: EditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      <ModeToggle mode={mode} onModeChange={onModeChange} />
      {isDirty && <span className="save-indicator">Saving...</span>}
    </div>
  )
}
