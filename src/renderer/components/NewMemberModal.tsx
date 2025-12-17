import { useState, useEffect, useRef } from 'react'

interface NewMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (variantName: string) => void
  baseName: string
}

export function NewMemberModal({
  isOpen,
  onClose,
  onSubmit,
  baseName,
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

  const canSubmit = inputValue.trim() !== ''

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
            className="rename-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) handleSubmit()
              if (e.key === 'Escape') onClose()
            }}
            placeholder='e.g., "summary", "notes"'
          />
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
