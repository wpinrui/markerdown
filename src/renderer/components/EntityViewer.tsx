import { MarkdownViewer } from './MarkdownViewer'
import type { Entity, EntityMember } from '@shared/types'

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
}

export function EntityViewer({ entity, activeMember, content, onTabChange }: EntityViewerProps) {
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

  return (
    <div className="entity-viewer">
      <div className="entity-tabs">
        {entity.members.map((member) => {
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
      </div>
      <div className="entity-content">
        {activeMember.type === 'pdf' ? (
          <div className="pdf-placeholder">
            <span className="pdf-icon">📑</span>
            <p>PDF viewing coming soon</p>
            <p className="pdf-path">{activeMember.path}</p>
          </div>
        ) : content ? (
          <MarkdownViewer content={content} />
        ) : (
          <div className="placeholder">Loading...</div>
        )}
      </div>
    </div>
  )
}
