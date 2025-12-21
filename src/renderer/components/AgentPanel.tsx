import { useState, useEffect, useRef, useCallback, memo } from 'react'
import type { AgentMessage, AgentSession } from '@shared/types'
import { StyledMarkdown } from '../markdownConfig'

const MAX_DISPLAYED_SESSIONS = 20
const MS_PER_DAY = 1000 * 60 * 60 * 24
const MIN_TEXTAREA_HEIGHT = 44 // Roughly 2 rows
const MAX_TEXTAREA_HEIGHT = 200

function formatSessionDate(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / MS_PER_DAY)

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
}

// Memoized message list to prevent re-renders when input changes
interface MessageListProps {
  messages: AgentMessage[]
  isLoading: boolean
}

const MessageList = memo(function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <>
      {messages.map((msg, i) => (
        <div key={i} className={`agent-message agent-message-${msg.role}`}>
          <div className="agent-message-content">
            {msg.role === 'assistant' ? (
              <StyledMarkdown content={msg.content} />
            ) : (
              msg.content
            )}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="agent-message agent-message-assistant">
          <div className="agent-typing">Thinking...</div>
        </div>
      )}
    </>
  )
})

interface AgentPanelProps {
  workingDir: string | null
  currentFilePath: string | null
  onClose: () => void
  style?: React.CSSProperties
}

export function AgentPanel({ workingDir, currentFilePath, onClose, style }: AgentPanelProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [hasInput, setHasInput] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const isCancelledRef = useRef(false)

  const cancelCurrentRequest = useCallback(() => {
    isCancelledRef.current = true
    window.electronAPI.agentCancel()
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Load most recent session when panel opens
  useEffect(() => {
    if (!workingDir) return

    const loadMostRecent = async () => {
      try {
        const fetchedSessions = await window.electronAPI.getAgentSessions(workingDir)
        if (fetchedSessions.length > 0) {
          const mostRecent = fetchedSessions[0]
          const history = await window.electronAPI.loadAgentSession(workingDir, mostRecent.sessionId)
          setMessages(history.messages)
          setSessionId(mostRecent.sessionId)
        }
      } catch (err) {
        console.error('Failed to load most recent session:', err)
      }
    }

    loadMostRecent()
  }, [workingDir])

  const reloadSession = useCallback(async (dir: string, sid: string): Promise<boolean> => {
    try {
      const history = await window.electronAPI.loadAgentSession(dir, sid)
      setMessages(history.messages)
      return true
    } catch (err) {
      console.error('Failed to reload session:', err)
      return false
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    const textarea = inputRef.current
    if (!textarea) return

    const userMessage = textarea.value.trim()
    if (!userMessage || isLoading || !workingDir) return

    textarea.value = ''
    textarea.style.height = `${MIN_TEXTAREA_HEIGHT}px`
    setHasInput(false)
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)
    isCancelledRef.current = false

    // Set up completion listener BEFORE starting agent to avoid race condition
    let cleanup: (() => void) | undefined
    const completionPromise = new Promise<string | undefined>((resolve) => {
      const unsub = window.electronAPI.onAgentComplete((error) => {
        unsub()
        resolve(error)
      })
      cleanup = unsub
    })

    try {
      const response = await window.electronAPI.agentChat({
        message: userMessage,
        workingDir,
        sessionId: sessionId ?? undefined,
        currentFilePath: currentFilePath ?? undefined,
      })
      setSessionId(response.sessionId)

      // Wait for agent to finish, then reload from file
      const error = await completionPromise
      if (isCancelledRef.current) {
        // User cancelled - don't show error or reload
        isCancelledRef.current = false
      } else if (error) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${error}` }])
      } else {
        const loaded = await reloadSession(workingDir, response.sessionId)
        if (!loaded) {
          setMessages((prev) => [...prev, { role: 'assistant', content: 'Failed to load response. Try refreshing the session.' }])
        }
      }
    } catch (err) {
      cleanup?.() // Clean up listener on error
      setMessages((prev) => [...prev, { role: 'assistant', content: `Failed to start agent: ${err}` }])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, workingDir, sessionId, currentFilePath, reloadSession])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  // Handle input changes - resize textarea and update hasInput for button state
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    const hasContent = textarea.value.trim().length > 0

    // Only update state if hasInput actually changed (avoids unnecessary re-renders)
    setHasInput((prev) => (prev !== hasContent ? hasContent : prev))

    // Auto-resize textarea
    textarea.style.height = 'auto'
    const newHeight = Math.min(Math.max(textarea.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT)
    textarea.style.height = `${newHeight}px`
  }, [])

  const handleCancel = useCallback(() => {
    cancelCurrentRequest()
    setIsLoading(false)
  }, [cancelCurrentRequest])

  const handleNewChat = useCallback(() => {
    cancelCurrentRequest()
    setMessages([])
    setSessionId(null)
    setIsLoading(false)
    setShowHistory(false)
  }, [cancelCurrentRequest])

  const handleToggleHistory = useCallback(async () => {
    if (showHistory) {
      setShowHistory(false)
      return
    }
    if (!workingDir) return

    setShowHistory(true)
    setLoadingSessions(true)
    try {
      const fetchedSessions = await window.electronAPI.getAgentSessions(workingDir)
      setSessions(fetchedSessions)
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
      setSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }, [showHistory, workingDir])

  const handleLoadSession = useCallback(async (session: AgentSession) => {
    if (!workingDir) return

    cancelCurrentRequest()
    setShowHistory(false)
    setIsLoading(true)

    try {
      const history = await window.electronAPI.loadAgentSession(workingDir, session.sessionId)
      setMessages(history.messages)
      setSessionId(session.sessionId)
    } catch (err) {
      console.error('Failed to load session:', err)
      setMessages([{ role: 'assistant', content: 'Failed to load session history.' }])
    } finally {
      setIsLoading(false)
    }
  }, [workingDir, cancelCurrentRequest])

  // Close history dropdown when clicking outside
  useEffect(() => {
    if (!showHistory) return

    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHistory])

  if (!workingDir) {
    return (
      <div className="agent-panel" style={style}>
        <div className="agent-empty">Open a folder to use the agent</div>
      </div>
    )
  }

  return (
    <div className="agent-panel" style={style}>
      <div className="agent-header">
        <span className="agent-title">Agent</span>
        <div className="agent-header-actions">
          <div className="agent-history-container" ref={historyRef}>
            <button
              className="agent-history-btn"
              onClick={handleToggleHistory}
              title="Chat history"
            >
              ☰
            </button>
            {showHistory && (
              <div className="agent-history-dropdown">
                {loadingSessions ? (
                  <div className="agent-history-loading">Loading...</div>
                ) : sessions.length === 0 ? (
                  <div className="agent-history-empty">No past chats</div>
                ) : (
                  sessions.slice(0, MAX_DISPLAYED_SESSIONS).map((session) => (
                    <button
                      key={session.sessionId}
                      className={`agent-history-item ${session.sessionId === sessionId ? 'active' : ''}`}
                      onClick={() => handleLoadSession(session)}
                    >
                      <span className="agent-history-date">{formatSessionDate(session.timestamp)}</span>
                      <span className="agent-history-preview">{session.firstMessage}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {sessionId && (
            <button className="agent-new-chat-btn" onClick={handleNewChat} title="New chat">
              +
            </button>
          )}
          <button className="agent-close-btn" onClick={onClose} title="Close panel">
            ✕
          </button>
        </div>
      </div>
      <div className="agent-messages">
        <MessageList messages={messages} isLoading={isLoading} />
        <div ref={messagesEndRef} />
      </div>
      <div className="agent-input-area">
        <textarea
          ref={inputRef}
          className="agent-input"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          disabled={isLoading}
          style={{ height: MIN_TEXTAREA_HEIGHT, minHeight: MIN_TEXTAREA_HEIGHT, maxHeight: MAX_TEXTAREA_HEIGHT }}
        />
        <div className="agent-input-actions">
          {isLoading ? (
            <button className="agent-cancel-btn" onClick={handleCancel}>
              Cancel
            </button>
          ) : (
            <button
              className="agent-send-btn"
              onClick={handleSubmit}
              disabled={!hasInput}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
