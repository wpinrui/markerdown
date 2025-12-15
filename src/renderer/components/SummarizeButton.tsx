import { useState, useRef, useEffect } from 'react'

interface SummarizeButtonProps {
  isSummarizing: boolean
  logs: string
  onClick: () => void
}

export function SummarizeButton({ isSummarizing, logs, onClick }: SummarizeButtonProps) {
  const [showLogs, setShowLogs] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, showLogs])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowLogs(false)
      }
    }
    if (showLogs) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showLogs])

  const handleClick = () => {
    if (isSummarizing) {
      setShowLogs(!showLogs)
    } else {
      onClick()
    }
  }

  return (
    <div className="summarize-button-container" ref={dropdownRef}>
      <button
        className={`summarize-btn ${isSummarizing ? 'loading' : ''}`}
        onClick={handleClick}
      >
        {isSummarizing ? (
          <>
            <span className="summarize-spinner" />
            Summarizing...
          </>
        ) : (
          'Summarize'
        )}
      </button>
      {showLogs && isSummarizing && (
        <div className="summarize-logs-dropdown">
          <div className="summarize-logs-header">Claude CLI Output</div>
          <pre className="summarize-logs-content">
            {logs || 'Waiting for output...'}
            <div ref={logsEndRef} />
          </pre>
        </div>
      )}
    </div>
  )
}
