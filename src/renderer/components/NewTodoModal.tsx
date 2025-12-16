import { useState, useEffect, useRef } from 'react'
import type { TodoItem } from '@shared/types'

interface NewTodoModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (todo: Omit<TodoItem, 'id' | 'createdAt'>) => void
}

export function NewTodoModal({ isOpen, onClose, onSubmit }: NewTodoModalProps) {
  const [text, setText] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const textInputRef = useRef<HTMLInputElement>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setText('')
      setDueDate('')
      setNotes('')
      // Focus text input after a short delay to ensure modal is rendered
      setTimeout(() => textInputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return

    onSubmit({
      text: text.trim(),
      completed: false,
      dueDate: dueDate.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">New Todo</h2>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label htmlFor="todo-text">Task</label>
            <input
              ref={textInputRef}
              id="todo-text"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div className="modal-field">
            <label htmlFor="todo-due">Due Date (optional)</label>
            <input
              id="todo-due"
              type="text"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="YYYY-MM-DD or YYYY-MM-DD HH:mm"
            />
          </div>

          <div className="modal-field">
            <label htmlFor="todo-notes">Notes (optional)</label>
            <textarea
              id="todo-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details, instructions, or progress notes..."
              rows={3}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="modal-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal-btn-primary" disabled={!text.trim()}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
