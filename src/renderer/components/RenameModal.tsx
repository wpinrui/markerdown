import { useState, useEffect, useRef, useMemo } from 'react'
import { getBasename, getExtension, stripExtension, INVALID_FILENAME_CHARS_REGEX } from '@shared/pathUtils'
import type { TreeNode, EntityMember, Entity } from '@shared/types'

type RenameMode = 'entity' | 'file' | 'member'

interface RenameModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (newName: string) => void
  // For renaming a tree node (file or entity)
  node?: TreeNode
  // For renaming a specific entity member suffix
  member?: EntityMember
  entity?: Entity
  // All existing names at the same level (for conflict detection)
  existingNames?: string[]
}

export function RenameModal({
  isOpen,
  onClose,
  onSubmit,
  node,
  member,
  entity,
  existingNames = [],
}: RenameModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')

  // Determine the mode
  const mode: RenameMode = useMemo(() => {
    if (member && entity) return 'member'
    if (node?.entity) return 'entity'
    return 'file'
  }, [member, entity, node])

  // Get current values based on mode
  const currentInfo = useMemo(() => {
    if (mode === 'member' && member && entity) {
      // Member mode: editing suffix only
      const filename = getBasename(member.path)
      const ext = getExtension(filename)
      const suffix = member.variant ?? ''
      return {
        baseName: entity.baseName,
        suffix,
        extension: ext,
        fullName: filename,
      }
    }
    if (mode === 'entity' && node?.entity) {
      // Entity mode: editing base name
      return {
        baseName: node.entity.baseName,
        suffix: '',
        extension: '',
        fullName: node.entity.baseName,
      }
    }
    if (node) {
      // File mode: editing full name (without extension)
      const ext = getExtension(node.name)
      const nameWithoutExt = stripExtension(node.name)
      return {
        baseName: nameWithoutExt,
        suffix: '',
        extension: ext,
        fullName: node.name,
      }
    }
    return { baseName: '', suffix: '', extension: '', fullName: '' }
  }, [mode, member, entity, node])

  // Initialize input value when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(mode === 'member' ? currentInfo.suffix : currentInfo.baseName)
      // Focus input after dialog opens
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }, [isOpen, mode, currentInfo])

  // Open/close dialog
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  // Validation
  const validation = useMemo(() => {
    const value = inputValue.trim()

    if (mode === 'member') {
      // Suffix can be empty (becomes default member)
      // Check for conflicts with other variants of the same file type
      if (entity && member) {
        const otherVariants = entity.members
          .filter((m) => m.path !== member.path && m.type === member.type)
          .map((m) => m.variant ?? '')
        if (otherVariants.includes(value)) {
          return { type: 'error' as const, message: 'A variant with this suffix already exists' }
        }
      }
      return null
    }

    // For entity and file modes
    if (!value) {
      return { type: 'error' as const, message: 'Name is required' }
    }

    // Check for invalid characters
    if (INVALID_FILENAME_CHARS_REGEX.test(value)) {
      return { type: 'error' as const, message: 'Name contains invalid characters' }
    }

    // Check for conflicts
    const newFullName = mode === 'file' ? `${value}${currentInfo.extension}` : value
    if (existingNames.map((n) => n.toLowerCase()).includes(newFullName.toLowerCase())) {
      if (newFullName.toLowerCase() !== currentInfo.fullName.toLowerCase()) {
        return { type: 'error' as const, message: 'A file with this name already exists' }
      }
    }

    return null
  }, [inputValue, mode, entity, member, existingNames, currentInfo])

  // In member mode, empty suffix is valid (becomes default member)
  const canSubmit = validation?.type !== 'error' && (mode === 'member' || inputValue.trim() !== '')
  const hasChanged = inputValue.trim() !== (mode === 'member' ? currentInfo.suffix : currentInfo.baseName)

  const handleSubmit = () => {
    if (!canSubmit || !hasChanged) return
    onSubmit(inputValue.trim())
    onClose()
  }

  // Preview of what will change
  const preview = useMemo(() => {
    const newValue = inputValue.trim()
    if (!hasChanged) return null

    if (mode === 'member' && entity && member) {
      const ext = currentInfo.extension
      const oldName = getBasename(member.path)
      const newName = newValue ? `${entity.baseName}.${newValue}${ext}` : `${entity.baseName}${ext}`
      return [{ old: oldName, new: newName }]
    }

    if (mode === 'entity' && node?.entity) {
      return node.entity.members.map((m) => {
        const oldName = getBasename(m.path)
        const ext = getExtension(oldName)
        const variant = m.variant
        const newName = variant ? `${newValue}.${variant}${ext}` : `${newValue}${ext}`
        return { old: oldName, new: newName }
      })
    }

    if (mode === 'file' && node) {
      const ext = currentInfo.extension
      return [{ old: node.name, new: `${newValue}${ext}` }]
    }

    return null
  }, [inputValue, hasChanged, mode, entity, member, node, currentInfo])

  const getTitle = () => {
    if (mode === 'member') return 'Rename Variant'
    if (mode === 'entity') return 'Rename Entity'
    return 'Rename'
  }

  const getLabel = () => {
    if (mode === 'member') return 'Suffix'
    if (mode === 'entity') return 'Base Name'
    return 'Name'
  }

  return (
    <dialog ref={dialogRef} className="rename-modal">
      <div className="rename-modal-header">{getTitle()}</div>
      <div className="rename-modal-body">
        {mode === 'member' && (
          <div className="rename-base-name">
            <span className="rename-base-label">Base:</span>
            <span className="rename-base-value">{currentInfo.baseName}</span>
          </div>
        )}
        <div className="rename-input-group">
          <label className="rename-label">{getLabel()}</label>
          <input
            ref={inputRef}
            type="text"
            className={`rename-input ${validation?.type === 'error' ? 'error' : ''}`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit && hasChanged) handleSubmit()
              if (e.key === 'Escape') onClose()
            }}
            placeholder={mode === 'member' ? '(empty for default)' : ''}
          />
          {validation && (
            <div className={`rename-validation ${validation.type}`}>
              {validation.message}
            </div>
          )}
        </div>

        {preview && preview.length > 0 && (
          <div className="rename-preview">
            <div className="rename-preview-label">Preview:</div>
            <ul className="rename-preview-list">
              {preview.map((item, i) => (
                <li key={i}>
                  <span className="rename-old">{item.old}</span>
                  <span className="rename-arrow">→</span>
                  <span className="rename-new">{item.new}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="rename-modal-footer">
        <button type="button" className="rename-cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="rename-submit-btn"
          onClick={handleSubmit}
          disabled={!canSubmit || !hasChanged}
        >
          Rename
        </button>
      </div>
    </dialog>
  )
}
