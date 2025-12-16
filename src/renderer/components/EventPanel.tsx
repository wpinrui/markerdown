import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, MapPin } from 'lucide-react'
import type { EventItem } from '@shared/types'
import { NewEventModal } from './NewEventModal'

type FilterMode = 'all' | 'upcoming' | 'past'

interface EventPanelProps {
  workingDir: string | null
  style?: React.CSSProperties
}

// Parse events from markdown format
function parseEvents(content: string): EventItem[] {
  const events: EventItem[] = []
  const lines = content.split('\n')
  let currentEvent: Partial<EventItem> | null = null

  for (const line of lines) {
    // Match event line: - Event text
    const eventMatch = line.match(/^- (.+)$/)
    if (eventMatch && !line.match(/^\s/)) {
      // Save previous event if exists
      if (currentEvent && currentEvent.id && currentEvent.text && currentEvent.startDate) {
        events.push(currentEvent as EventItem)
      }
      currentEvent = {
        id: crypto.randomUUID(),
        text: eventMatch[1],
        createdAt: new Date().toISOString(),
      }
      continue
    }

    // Match metadata lines (indented with 2 spaces)
    if (currentEvent) {
      const startMatch = line.match(/^\s+Start: (.+)$/)
      if (startMatch) {
        currentEvent.startDate = startMatch[1]
        continue
      }

      const endMatch = line.match(/^\s+End: (.+)$/)
      if (endMatch) {
        currentEvent.endDate = endMatch[1]
        continue
      }

      const locationMatch = line.match(/^\s+Location: (.+)$/)
      if (locationMatch) {
        currentEvent.location = locationMatch[1]
        continue
      }

      const notesMatch = line.match(/^\s+Notes: (.+)$/)
      if (notesMatch) {
        currentEvent.notes = notesMatch[1]
        continue
      }
    }
  }

  // Don't forget the last event
  if (currentEvent && currentEvent.id && currentEvent.text && currentEvent.startDate) {
    events.push(currentEvent as EventItem)
  }

  return events
}

// Serialize events to markdown format
function serializeEvents(events: EventItem[]): string {
  return events.map((event) => {
    let result = `- ${event.text}`
    result += `\n  Start: ${event.startDate}`
    if (event.endDate) {
      result += `\n  End: ${event.endDate}`
    }
    if (event.location) {
      result += `\n  Location: ${event.location}`
    }
    if (event.notes) {
      result += `\n  Notes: ${event.notes}`
    }
    return result
  }).join('\n\n') + '\n'
}

// Sort events by start date (soonest first)
function sortEvents(events: EventItem[]): EventItem[] {
  return [...events].sort((a, b) => a.startDate.localeCompare(b.startDate))
}

// Check if event is in the past
function isPast(event: EventItem): boolean {
  const now = new Date()
  const eventDate = new Date(event.endDate || event.startDate)
  return eventDate < now
}

export function EventPanel({ workingDir, style }: EventPanelProps) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [filter, setFilter] = useState<FilterMode>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showNewModal, setShowNewModal] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Load events from file
  const loadEvents = useCallback(async () => {
    if (!workingDir) return

    const filePath = `${workingDir}/.markerdown/events.md`
    const content = await window.electronAPI.readFile(filePath)
    if (content) {
      setEvents(parseEvents(content))
    } else {
      setEvents([])
    }
  }, [workingDir])

  // Save events to file
  const saveEvents = useCallback(async (newEvents: EventItem[]) => {
    if (!workingDir) return

    const dirPath = `${workingDir}/.markerdown`
    const filePath = `${dirPath}/events.md`

    // Ensure directory exists
    await window.electronAPI.mkdir(dirPath)
    await window.electronAPI.writeFile(filePath, serializeEvents(newEvents))
  }, [workingDir])

  // Load on mount and when workingDir changes
  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const handleDelete = async (id: string) => {
    const newEvents = events.filter((e) => e.id !== id)
    setEvents(newEvents)
    await saveEvents(newEvents)
    setDeleteConfirmId(null)
  }

  const handleAddEvent = async (event: Omit<EventItem, 'id' | 'createdAt'>) => {
    const newEvent: EventItem = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    const newEvents = [...events, newEvent]
    setEvents(newEvents)
    await saveEvents(newEvents)
    setShowNewModal(false)
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Filter events
  const filteredEvents = events.filter((event) => {
    if (filter === 'upcoming') return !isPast(event)
    if (filter === 'past') return isPast(event)
    return true
  })

  const sortedEvents = sortEvents(filteredEvents)

  if (!workingDir) {
    return (
      <div className="event-panel" style={style}>
        <div className="event-empty">Open a folder to use events</div>
      </div>
    )
  }

  return (
    <div className="event-panel" style={style}>
      <div className="event-header">
        <span className="event-title">Events</span>
        <button
          className="event-add-btn"
          onClick={() => setShowNewModal(true)}
          title="New Event"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="event-filters">
        <button
          className={`event-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`event-filter-btn ${filter === 'upcoming' ? 'active' : ''}`}
          onClick={() => setFilter('upcoming')}
        >
          Upcoming
        </button>
        <button
          className={`event-filter-btn ${filter === 'past' ? 'active' : ''}`}
          onClick={() => setFilter('past')}
        >
          Past
        </button>
      </div>

      <div className="event-list">
        {sortedEvents.length === 0 ? (
          <div className="event-empty">
            {filter === 'all' ? 'No events yet' : `No ${filter} events`}
          </div>
        ) : (
          sortedEvents.map((event) => {
            const isExpanded = expandedIds.has(event.id)
            const hasDetails = event.location || event.notes
            const eventIsPast = isPast(event)

            return (
              <div
                key={event.id}
                className={`event-item ${eventIsPast ? 'past' : ''}`}
              >
                <div className="event-item-main">
                  {hasDetails && (
                    <button
                      className="event-expand-btn"
                      onClick={() => toggleExpanded(event.id)}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                  <span className="event-text">{event.text}</span>
                  <span className="event-datetime">{event.startDate}</span>
                  {event.endDate && (
                    <span className="event-datetime-end">→ {event.endDate}</span>
                  )}
                  {deleteConfirmId === event.id ? (
                    <div className="event-delete-confirm">
                      <button onClick={() => handleDelete(event.id)}>Yes</button>
                      <button onClick={() => setDeleteConfirmId(null)}>No</button>
                    </div>
                  ) : (
                    <button
                      className="event-delete-btn"
                      onClick={() => setDeleteConfirmId(event.id)}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {isExpanded && (
                  <div className="event-details">
                    {event.location && (
                      <div className="event-location">
                        <MapPin size={12} /> {event.location}
                      </div>
                    )}
                    {event.notes && (
                      <div className="event-notes">{event.notes}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <NewEventModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSubmit={handleAddEvent}
      />
    </div>
  )
}
