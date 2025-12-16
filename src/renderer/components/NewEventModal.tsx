import { useState, useEffect, useRef } from 'react'
import type { EventItem } from '@shared/types'
import { formatDateForInput, formatDateForStorage } from '../utils/dateUtils'

interface NewEventModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (event: Omit<EventItem, 'id' | 'createdAt'>) => void
}

export function NewEventModal({ isOpen, onClose, onSubmit }: NewEventModalProps) {
  const [text, setText] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
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
      setStartDate(formatDateForInput(new Date()))
      setEndDate('')
      setLocation('')
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
    if (!text.trim() || !startDate) return

    onSubmit({
      text: text.trim(),
      startDate: formatDateForStorage(startDate),
      endDate: formatDateForStorage(endDate) || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  const canSubmit = text.trim() && startDate

  return (
    <dialog ref={dialogRef} className="new-note-modal">
      <div className="new-note-modal-header">New Event</div>
      <div className="new-note-modal-body">
        <div className="new-note-input-group">
          <label className="new-note-label">Event</label>
          <input
            ref={textInputRef}
            type="text"
            className="new-note-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening?"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) handleSubmit()
              if (e.key === 'Escape') onClose()
            }}
          />
        </div>

        <div className="new-note-input-group">
          <label className="new-note-label">Start Date & Time</label>
          <input
            type="datetime-local"
            className="new-note-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="new-note-input-group">
          <label className="new-note-label">End Date & Time (optional)</label>
          <input
            type="datetime-local"
            className="new-note-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="new-note-input-group">
          <label className="new-note-label">Location (optional)</label>
          <input
            type="text"
            className="new-note-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Where is it?"
          />
        </div>

        <div className="new-note-input-group">
          <label className="new-note-label">Notes (optional)</label>
          <textarea
            className="new-note-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details..."
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
          disabled={!canSubmit}
        >
          Create
        </button>
      </div>
    </dialog>
  )
}
