import type { EditMode } from '@shared/types'

interface ModeToggleProps {
  mode: EditMode
  onModeChange: (mode: EditMode) => void
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="editor-mode-toggle">
      <button
        className={mode === 'view' ? 'active' : ''}
        onClick={() => onModeChange('view')}
      >
        View
      </button>
      <button
        className={mode === 'visual' ? 'active' : ''}
        onClick={() => onModeChange('visual')}
      >
        Visual
      </button>
      <button
        className={mode === 'code' ? 'active' : ''}
        onClick={() => onModeChange('code')}
      >
        Code
      </button>
    </div>
  )
}
