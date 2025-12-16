import { useState, useEffect, useRef } from 'react'
import type { EventItem } from '@shared/types'

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
  const textInputRef = useRef<HTMLInputElement>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setText('')
      setStartDate('')
      setEndDate('')
      setLocation('')
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
    if (!text.trim() || !startDate.trim()) return

    onSubmit({
      text: text.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim() || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">New Event</h2>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label htmlFor="event-text">Event</label>
            <input
              ref={textInputRef}
              id="event-text"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's happening?"
              required
            />
          </div>

          <div className="modal-field">
            <label htmlFor="event-start">Start Date & Time</label>
            <input
              id="event-start"
              type="text"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="YYYY-MM-DD HH:mm"
              required
            />
          </div>

          <div className="modal-field">
            <label htmlFor="event-end">End Date & Time (optional)</label>
            <input
              id="event-end"
              type="text"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="YYYY-MM-DD HH:mm"
            />
          </div>

          <div className="modal-field">
            <label htmlFor="event-location">Location (optional)</label>
            <input
              id="event-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where is it?"
            />
          </div>

          <div className="modal-field">
            <label htmlFor="event-notes">Notes (optional)</label>
            <textarea
              id="event-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
              rows={3}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="modal-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="modal-btn-primary"
              disabled={!text.trim() || !startDate.trim()}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
