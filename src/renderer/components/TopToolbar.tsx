import type { Entity, EntityMember, EditMode } from '@shared/types'
import type { ActiveFormats, MarkdownEditorRef } from './MarkdownEditor'
import { FormatToolbar } from './FormatToolbar'
import { ModeToggle } from './ModeToggle'
import { MessageSquare, CheckSquare, Calendar } from 'lucide-react'

export type PaneType = 'agent' | 'todos' | 'events'

/**
 * Simple string hash function (djb2 algorithm)
 */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return hash >>> 0
}

function stringToColors(str: string): { base: string; light: string } {
  const hash = hashString(str)
  const hue = hash % 360
  return {
    base: `hsl(${hue}, 65%, 40%)`,
    light: `hsl(${hue}, 65%, 60%)`,
  }
}

interface TopToolbarProps {
  // Entity tab props (optional - only when viewing entity)
  entity?: Entity
  activeMember?: EntityMember
  onTabChange?: (member: EntityMember) => void
  // Editor props
  editMode: EditMode
  onEditModeChange: (mode: EditMode) => void
  editorRef: React.RefObject<MarkdownEditorRef | null>
  activeFormats: ActiveFormats
  isDirty: boolean
  // What type of content is shown
  showModeToggle: boolean
  isEditing: boolean
  // Summarize props
  canSummarize: boolean
  isSummarizing: boolean
  onSummarizeClick: () => void
  // Pane toggle props
  activePane: PaneType | null
  onPaneToggle: (pane: PaneType) => void
}

export function TopToolbar({
  entity,
  activeMember,
  onTabChange,
  editMode,
  onEditModeChange,
  editorRef,
  activeFormats,
  isDirty,
  showModeToggle,
  isEditing,
  canSummarize,
  isSummarizing,
  onSummarizeClick,
  activePane,
  onPaneToggle,
}: TopToolbarProps) {
  const getTabLabel = (member: EntityMember) => {
    if (member.type === 'pdf') {
      return member.variant ? `${member.variant} (PDF)` : 'PDF'
    }
    if (member.variant === null && entity) {
      return entity.baseName
    }
    return member.variant
  }

  const getTabColors = (member: EntityMember) => {
    const label = getTabLabel(member) || ''
    return stringToColors(label)
  }

  return (
    <div className="top-toolbar">
      {/* Show entity tabs only in view mode when viewing an entity */}
      {entity && activeMember && !isEditing && onTabChange &&
        entity.members.map((member) => {
          const isActive = member.path === activeMember.path
          const colors = getTabColors(member)
          return (
            <button
              key={member.path}
              className={`entity-tab ${isActive ? 'active' : ''}`}
              style={{
                backgroundColor: colors.base,
                borderColor: isActive ? colors.light : colors.base,
                fontWeight: isActive ? 'bold' : 'normal',
              }}
              onClick={() => onTabChange(member)}
            >
              {getTabLabel(member)}
            </button>
          )
        })}

      {/* Show formatting toolbar in edit mode */}
      {isEditing && (
        <FormatToolbar
          editorRef={editorRef}
          activeFormats={activeFormats}
        />
      )}

      {/* Right-aligned controls */}
      <div className="top-toolbar-actions">
        {showModeToggle && (
          <ModeToggle mode={editMode} onModeChange={onEditModeChange} />
        )}
        {isDirty && <span className="save-indicator">Saving...</span>}
        {(canSummarize || isSummarizing) && (
          <button
            className={`tab-action-btn ${isSummarizing ? 'loading' : ''}`}
            onClick={isSummarizing ? undefined : onSummarizeClick}
            disabled={isSummarizing}
            title="Summarize PDF"
          >
            {isSummarizing ? <span className="btn-spinner" /> : '📋'}
          </button>
        )}
        <div className="toolbar-separator" />
        <button
          className={`toolbar-icon-btn ${activePane === 'agent' ? 'active' : ''}`}
          onClick={() => onPaneToggle('agent')}
          title="Agent (Ctrl+Shift+A)"
        >
          <MessageSquare size={16} strokeWidth={1.5} />
        </button>
        <button
          className={`toolbar-icon-btn ${activePane === 'todos' ? 'active' : ''}`}
          onClick={() => onPaneToggle('todos')}
          title="Todos"
        >
          <CheckSquare size={16} strokeWidth={1.5} />
        </button>
        <button
          className={`toolbar-icon-btn ${activePane === 'events' ? 'active' : ''}`}
          onClick={() => onPaneToggle('events')}
          title="Events"
        >
          <Calendar size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
