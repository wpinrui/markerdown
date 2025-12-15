import { useState, useEffect, useRef, useCallback } from 'react'
import type { AgentMessage } from '@shared/types'

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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Set up streaming listeners
  useEffect(() => {
    const unsubChunk = window.electronAPI.onAgentChunk((chunk) => {
      setStreamingContent((prev) => prev + chunk)
    })

    const unsubComplete = window.electronAPI.onAgentComplete((error) => {
      setIsLoading(false)
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
    window.electronAPI.agentCancel()
    setIsLoading(false)
    if (streamingContent) {
      setMessages((prev) => [...prev, { role: 'assistant', content: streamingContent + '\n\n(cancelled)' }])
      setStreamingContent('')
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setSessionId(null)
    setStreamingContent('')
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
            <div className="agent-message-content">{msg.content}</div>
          </div>
        ))}
        {streamingContent && (
          <div className="agent-message agent-message-assistant">
            <div className="agent-message-content">{streamingContent}</div>
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
