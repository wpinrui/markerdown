import type { Entity, EntityMember } from '@shared/types'
import { Plus } from 'lucide-react'

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

interface BottomTabBarProps {
  entity?: Entity
  activeMember?: EntityMember
  onTabChange?: (member: EntityMember) => void
  selectedFileName?: string
  selectedFileType?: string
  onTabContextMenu?: (e: React.MouseEvent, member: EntityMember) => void
  onCreateMember?: () => void
}

export function BottomTabBar({
  entity,
  activeMember,
  onTabChange,
  selectedFileName,
  selectedFileType,
  onTabContextMenu,
  onCreateMember,
}: BottomTabBarProps) {
  const getTabLabel = (member: EntityMember) => {
    if (member.type === 'pdf') {
      return member.variant ? `${member.variant} (PDF)` : 'PDF'
    }
    if (member.type === 'image') {
      return member.variant ? `${member.variant} (Image)` : 'Image'
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

  const hasTabs =
    (entity && activeMember && onTabChange) || selectedFileName

  if (!hasTabs) return null

  return (
    <div className="bottom-tab-bar">
      {entity && activeMember && onTabChange ? (
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
    </div>
  )
}
