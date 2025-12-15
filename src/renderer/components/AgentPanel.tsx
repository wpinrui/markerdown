import { useState, useEffect, useRef, useCallback } from 'react'
import type { AgentMessage, AgentSession } from '@shared/types'
import { StyledMarkdown } from '../markdownConfig'

interface AgentPanelProps {
  workingDir: string | null
  onClose: () => void
}

export function AgentPanel({ workingDir, onClose }: AgentPanelProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isCancelledRef = useRef(false)
  const historyRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

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

  // Set up streaming listeners
  useEffect(() => {
    const unsubChunk = window.electronAPI.onAgentChunk((chunk) => {
      setStreamingContent((prev) => prev + chunk)
    })

    const unsubComplete = window.electronAPI.onAgentComplete((error) => {
      setIsLoading(false)
      // Ignore errors from intentional cancellation (already handled in handleCancel/handleNewChat)
      if (isCancelledRef.current) {
        isCancelledRef.current = false
        return
      }
      if (error) {
        setStreamingContent('')
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${error}` }])
      } else {
        setStreamingContent((prev) => {
          if (prev) {
            setMessages((msgs) => [...msgs, { role: 'assistant', content: prev }])
          }
          return ''
        })
      }
    })

    return () => {
      unsubChunk()
      unsubComplete()
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading || !workingDir) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)
    setStreamingContent('')

    try {
      const response = await window.electronAPI.agentChat({
        message: userMessage,
        workingDir,
        sessionId: sessionId ?? undefined,
      })
      // Store session ID for conversation continuity
      setSessionId(response.sessionId)
    } catch (err) {
      setIsLoading(false)
      setMessages((prev) => [...prev, { role: 'assistant', content: `Failed to start agent: ${err}` }])
    }
  }, [input, isLoading, workingDir, sessionId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleCancel = () => {
    isCancelledRef.current = true
    window.electronAPI.agentCancel()
    setIsLoading(false)
    if (streamingContent) {
      setMessages((prev) => [...prev, { role: 'assistant', content: streamingContent + '\n\n(cancelled)' }])
      setStreamingContent('')
    }
  }

  const handleNewChat = () => {
    isCancelledRef.current = true
    window.electronAPI.agentCancel()
    setMessages([])
    setSessionId(null)
    setStreamingContent('')
    setIsLoading(false)
    setShowHistory(false)
  }

  const handleToggleHistory = async () => {
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
  }

  const handleLoadSession = async (session: AgentSession) => {
    if (!workingDir) return

    setShowHistory(false)
    setIsLoading(true)

    try {
      const history = await window.electronAPI.loadAgentSession(workingDir, session.sessionId)
      setMessages(history.messages)
      setSessionId(session.sessionId)
      setStreamingContent('')
    } catch (err) {
      console.error('Failed to load session:', err)
    } finally {
      setIsLoading(false)
    }
  }

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

  const formatSessionDate = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

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

  if (!workingDir) {
    return (
      <div className="agent-panel">
        <div className="agent-empty">Open a folder to use the agent</div>
      </div>
    )
  }

  return (
    <div className="agent-panel">
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
                  sessions.slice(0, 20).map((session) => (
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
        {streamingContent && (
          <div className="agent-message agent-message-assistant">
            <div className="agent-message-content">
              <StyledMarkdown content={streamingContent} />
            </div>
          </div>
        )}
        {isLoading && !streamingContent && (
          <div className="agent-message agent-message-assistant">
            <div className="agent-typing">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="agent-input-area">
        <textarea
          ref={inputRef}
          className="agent-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          disabled={isLoading}
          rows={2}
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
              disabled={!input.trim()}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
