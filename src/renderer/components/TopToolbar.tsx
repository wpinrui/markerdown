import type { Entity, EntityMember, EditMode } from '@shared/types'
import type { ActiveFormats, MarkdownEditorRef } from './MarkdownEditor'
import { FormatToolbar } from './FormatToolbar'
import { ModeToggle } from './ModeToggle'
import { MessageSquare, CheckSquare, Calendar, Check, X, Sparkles, PanelLeft, Plus } from 'lucide-react'

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
  // Standalone file props (for showing single tab)
  selectedFileName?: string
  selectedFileType?: string
  onTabContextMenu?: (e: React.MouseEvent, member: EntityMember) => void
  // Editor props
  editMode: EditMode
  onEditModeChange: (mode: EditMode) => void
  editorRef: React.RefObject<MarkdownEditorRef | null>
  activeFormats: ActiveFormats
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
  // Suggestion draft props
  suggestionType?: 'todos' | 'events'
  onAcceptSuggestion?: () => void
  onDiscardSuggestion?: () => void
  // Sidebar toggle props
  sidebarVisible: boolean
  onSidebarToggle: () => void
  // Create new entity member
  onCreateMember?: () => void
}

export function TopToolbar({
  entity,
  activeMember,
  onTabChange,
  selectedFileName,
  selectedFileType,
  onTabContextMenu,
  editMode,
  onEditModeChange,
  editorRef,
  activeFormats,
  showModeToggle,
  isEditing,
  canSummarize,
  isSummarizing,
  onSummarizeClick,
  activePane,
  onPaneToggle,
  suggestionType,
  onAcceptSuggestion,
  onDiscardSuggestion,
  sidebarVisible,
  onSidebarToggle,
  onCreateMember,
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
      {/* Sidebar toggle */}
      <button
        className={`toolbar-icon-btn sidebar-toggle ${sidebarVisible ? 'active' : ''}`}
        onClick={onSidebarToggle}
        title="Toggle sidebar (Ctrl+B)"
      >
        <PanelLeft size={16} strokeWidth={1.5} />
      </button>
      <div className="toolbar-separator" />

      {/* Show tabs for entity or standalone file */}
      {!isEditing && (
        <>
          {entity && activeMember && onTabChange ? (
            // Entity with multiple members
            <>
              {entity.members.map((member) => {
                const isActive = member.path === activeMember.path
                const colors = getTabColors(member)
                return (
                  <button
                    key={member.path}
                    type="button"
                    className={`entity-tab ${isActive ? 'active' : ''}`}
                    style={{
                      backgroundColor: colors.base,
                      borderColor: isActive ? colors.light : colors.base,
                      fontWeight: isActive ? 'bold' : 'normal',
                    }}
                    onClick={() => onTabChange(member)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      onTabContextMenu?.(e, member)
                    }}
                  >
                    {getTabLabel(member)}
                  </button>
                )
              })}
              {onCreateMember && (
                <button
                  type="button"
                  className="entity-tab-add"
                  onClick={onCreateMember}
                  title="Add new variant"
                >
                  <Plus size={14} />
                </button>
              )}
            </>
          ) : selectedFileName ? (
            // Standalone file - show single tab
            <>
              <button
                type="button"
                className="entity-tab active"
                style={{
                  backgroundColor: stringToColors(selectedFileName).base,
                  borderColor: stringToColors(selectedFileName).light,
                  fontWeight: 'bold',
                }}
              >
                {selectedFileType === 'markdown' ? selectedFileName : selectedFileType?.toUpperCase()}
              </button>
              {onCreateMember && selectedFileType === 'markdown' && (
                <button
                  type="button"
                  className="entity-tab-add"
                  onClick={onCreateMember}
                  title="Add new variant"
                >
                  <Plus size={14} />
                </button>
              )}
            </>
          ) : null}
        </>
      )}

      {/* Show formatting toolbar in edit mode */}
      {isEditing && (
        <FormatToolbar
          editorRef={editorRef}
          activeFormats={activeFormats}
        />
      )}

      {/* Suggestion draft controls */}
      {suggestionType && onAcceptSuggestion && onDiscardSuggestion && (
        <div className="suggestion-actions">
          <span className="suggestion-label">
            {suggestionType === 'todos' ? 'Task' : 'Event'} Suggestions
          </span>
          <button
            className="suggestion-btn accept"
            onClick={onAcceptSuggestion}
            title="Accept suggestions"
          >
            <Check size={16} strokeWidth={2} />
            Accept
          </button>
          <button
            className="suggestion-btn discard"
            onClick={onDiscardSuggestion}
            title="Discard suggestions"
          >
            <X size={16} strokeWidth={2} />
            Discard
          </button>
        </div>
      )}

      {/* Right-aligned controls */}
      <div className="top-toolbar-actions">
        {showModeToggle && (
          <ModeToggle mode={editMode} onModeChange={onEditModeChange} />
        )}
        {(canSummarize || isSummarizing) && (
          <button
            className={`summarize-btn ${isSummarizing ? 'loading' : ''}`}
            onClick={isSummarizing ? undefined : onSummarizeClick}
            disabled={isSummarizing}
            title="Summarize with Claude"
          >
            {isSummarizing ? (
              <span className="btn-spinner" />
            ) : (
              <Sparkles size={16} strokeWidth={1.5} />
            )}
            <span>Summarize</span>
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
