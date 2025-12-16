import type { EditMode } from '@shared/types'

interface EditorToolbarProps {
  mode: EditMode
  onModeChange: (mode: EditMode) => void
  isDirty: boolean
}

export function EditorToolbar({ mode, onModeChange, isDirty }: EditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      <div className="editor-mode-toggle">
        <button
          className={mode === 'view' ? 'active' : ''}
          onClick={() => onModeChange('view')}
          title="View mode"
        >
          View
        </button>
        <button
          className={mode === 'visual' ? 'active' : ''}
          onClick={() => onModeChange('visual')}
          title="Visual editor"
        >
          Visual
        </button>
        <button
          className={mode === 'code' ? 'active' : ''}
          onClick={() => onModeChange('code')}
          title="Code editor"
        >
          Code
        </button>
      </div>

      {isDirty && <span className="save-indicator">Saving...</span>}
    </div>
  )
}
