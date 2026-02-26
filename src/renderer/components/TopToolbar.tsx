import type { EditMode } from '@shared/types'
import type { ActiveFormats, MarkdownEditorRef } from './MarkdownEditor'
import { FormatToolbar } from './FormatToolbar'
import { ModeToggle } from './ModeToggle'
import { MessageSquare, CheckSquare, Calendar, Check, X, Sparkles, PanelLeft } from 'lucide-react'

export type PaneType = 'agent' | 'todos' | 'events'

interface TopToolbarProps {
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
}

export function TopToolbar({
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
}: TopToolbarProps) {
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
