import { useState, useEffect, useRef, useMemo } from 'react'
import { INVALID_FILENAME_CHARS_REGEX } from '@shared/pathUtils'

interface NewMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (variantName: string) => void
  baseName: string
  existingVariants: string[]
}

export function NewMemberModal({
  isOpen,
  onClose,
  onSubmit,
  baseName,
  existingVariants,
}: NewMemberModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')

  // Reset and focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

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
  const validationError = useMemo(() => {
    const value = inputValue.trim()
    if (!value) return null
    if (INVALID_FILENAME_CHARS_REGEX.test(value)) {
      return 'Name contains invalid characters'
    }
    if (existingVariants.map((v) => v.toLowerCase()).includes(value.toLowerCase())) {
      return 'A variant with this name already exists'
    }
    return null
  }, [inputValue, existingVariants])

  const canSubmit = inputValue.trim() !== '' && !validationError

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit(inputValue.trim())
    onClose()
  }

  return (
    <dialog ref={dialogRef} className="rename-modal">
      <div className="rename-modal-header">New Variant</div>
      <div className="rename-modal-body">
        <div className="rename-base-name">
          <span className="rename-base-label">Base:</span>
          <span className="rename-base-value">{baseName}</span>
        </div>
        <div className="rename-input-group">
          <label className="rename-label">Variant Name</label>
          <input
            ref={inputRef}
            type="text"
            className={`rename-input ${validationError ? 'error' : ''}`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) handleSubmit()
              if (e.key === 'Escape') onClose()
            }}
            placeholder='e.g., "summary", "notes"'
          />
          {validationError && (
            <div className="rename-validation error">{validationError}</div>
          )}
        </div>
        {canSubmit && (
          <div className="rename-preview">
            <div className="rename-preview-label">Will create:</div>
            <div className="rename-preview-list">
              <span className="rename-new">{baseName}.{inputValue.trim()}.md</span>
            </div>
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
          disabled={!canSubmit}
        >
          Create
        </button>
      </div>
    </dialog>
  )
}
