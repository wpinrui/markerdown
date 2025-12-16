import { useRef, useState, useCallback } from 'react'
import { MarkdownViewer } from './MarkdownViewer'
import { MarkdownEditor, MarkdownEditorRef, ActiveFormats } from './MarkdownEditor'
import { FormatToolbar } from './FormatToolbar'
import { ModeToggle } from './ModeToggle'
import { PdfViewer } from './PdfViewer'
import { defaultFormats } from './editorTypes'
import type { Entity, EntityMember, EditMode } from '@shared/types'

/**
 * Simple string hash function (djb2 algorithm)
 */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return hash >>> 0 // Convert to unsigned 32-bit
}

/**
 * Generate consistent HSL colors from a string.
 * Returns base color (40% lightness) and light color (60% lightness for borders).
 */
function stringToColors(str: string): { base: string; light: string } {
  const hash = hashString(str)
  const hue = hash % 360
  return {
    base: `hsl(${hue}, 65%, 40%)`,
    light: `hsl(${hue}, 65%, 60%)`,
  }
}

interface EntityViewerProps {
  entity: Entity
  activeMember: EntityMember
  content: string | null
  onTabChange: (member: EntityMember) => void
  // Editor props
  editMode: EditMode
  onEditModeChange: (mode: EditMode) => void
  editContent: string | null
  onEditContentChange: (content: string) => void
  isDirty: boolean
  // Agent props
  showAgent: boolean
  onAgentToggle: () => void
  // Summarize props
  canSummarize: boolean
  isSummarizing: boolean
  onSummarizeClick: () => void
}

export function EntityViewer({
  entity,
  activeMember,
  content,
  onTabChange,
  editMode,
  onEditModeChange,
  editContent,
  onEditContentChange,
  isDirty,
  showAgent,
  onAgentToggle,
  canSummarize,
  isSummarizing,
  onSummarizeClick,
}: EntityViewerProps) {
  const editorRef = useRef<MarkdownEditorRef>(null)
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>(defaultFormats)

  const handleSelectionChange = useCallback((formats: ActiveFormats) => {
    setActiveFormats(formats)
  }, [])

  const getTabLabel = (member: EntityMember) => {
    if (member.type === 'pdf') {
      return member.variant ? `${member.variant} (PDF)` : 'PDF'
    }
    if (member.variant === null) {
      return entity.baseName
    }
    return member.variant
  }

  const getTabColors = (member: EntityMember) => {
    const label = getTabLabel(member)
    return stringToColors(label)
  }

  const isMarkdownActive = activeMember.type === 'markdown'
  const isEditing = editMode !== 'view'

  return (
    <div className="entity-viewer">
      <div className="entity-tabs">
        {/* Show tabs only in view mode */}
        {!isEditing &&
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
            showAgentButton
            isAgentActive={showAgent}
            onAgentToggle={onAgentToggle}
          />
        )}

        {isMarkdownActive && (
          <ModeToggle mode={editMode} onModeChange={onEditModeChange} />
        )}
        {isDirty && <span className="save-indicator">Saving...</span>}

        {/* Right-aligned action buttons */}
        <div className="entity-tabs-actions">
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
          <button
            className={`tab-action-btn ${showAgent ? 'active' : ''}`}
            onClick={onAgentToggle}
            title="Toggle Agent (Ctrl+Shift+A)"
          >
            ✦
          </button>
        </div>
      </div>
      <div className="entity-content">
        {activeMember.type === 'pdf' ? (
          <PdfViewer filePath={activeMember.path} />
        ) : content !== null ? (
          editMode === 'view' ? (
            <MarkdownViewer content={content} />
          ) : (
            <MarkdownEditor
              ref={editorRef}
              content={editContent ?? content}
              filePath={activeMember.path}
              mode={editMode}
              onModeChange={onEditModeChange}
              onContentChange={onEditContentChange}
              isDirty={isDirty}
              showToolbar={false}
              onSelectionChange={handleSelectionChange}
            />
          )
        ) : (
          <div className="placeholder">Loading...</div>
        )}
      </div>
    </div>
  )
}
