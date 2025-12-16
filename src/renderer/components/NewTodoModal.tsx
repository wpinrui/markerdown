import { useState, useEffect, useRef } from 'react'
import type { TodoItem } from '@shared/types'

interface NewTodoModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (todo: Omit<TodoItem, 'id' | 'createdAt'>) => void
}

// Format date for datetime-local input (YYYY-MM-DDTHH:mm)
function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Convert datetime-local value to our format (YYYY-MM-DD HH:mm)
function formatDateForStorage(datetimeLocal: string): string {
  if (!datetimeLocal) return ''
  return datetimeLocal.replace('T', ' ')
}

export function NewTodoModal({ isOpen, onClose, onSubmit }: NewTodoModalProps) {
  const [text, setText] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)

  // Open/close dialog using showModal for proper backdrop support
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
      // Reset form and set default date
      setText('')
      setDueDate(formatDateForInput(new Date()))
      setNotes('')
      setTimeout(() => textInputRef.current?.focus(), 50)
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  // Handle escape key - dialog handles this natively, but we need to sync state
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  const handleSubmit = () => {
    if (!text.trim()) return

    onSubmit({
      text: text.trim(),
      completed: false,
      dueDate: formatDateForStorage(dueDate) || undefined,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <dialog ref={dialogRef} className="new-note-modal">
      <div className="new-note-modal-header">New Todo</div>
      <div className="new-note-modal-body">
        <div className="new-note-input-group">
          <label className="new-note-label">Task</label>
          <input
            ref={textInputRef}
            type="text"
            className="new-note-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs to be done?"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) handleSubmit()
              if (e.key === 'Escape') onClose()
            }}
          />
        </div>

        <div className="new-note-input-group">
          <label className="new-note-label">Due Date (optional)</label>
          <input
            type="datetime-local"
            className="new-note-input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="new-note-input-group">
          <label className="new-note-label">Notes (optional)</label>
          <textarea
            className="new-note-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details, instructions, or progress notes..."
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>
      </div>
      <div className="new-note-modal-footer">
        <button type="button" className="new-note-cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="new-note-submit-btn"
          onClick={handleSubmit}
          disabled={!text.trim()}
        >
          Create
        </button>
      </div>
    </dialog>
  )
}
