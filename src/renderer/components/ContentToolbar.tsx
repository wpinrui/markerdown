interface ContentToolbarProps {
  onOptionsClick: () => void
  showSummarize: boolean
  isSummarizing: boolean
  onSummarizeClick: () => void
  showAgent: boolean
  onAgentToggle: () => void
}

export function ContentToolbar({
  onOptionsClick,
  showSummarize,
  isSummarizing,
  onSummarizeClick,
  showAgent,
  onAgentToggle,
}: ContentToolbarProps) {
  return (
    <div className="content-toolbar">
      <button
        className="content-toolbar-btn"
        onClick={onOptionsClick}
        title="Options"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
        </svg>
      </button>

      {showSummarize && (
        <button
          className={`content-toolbar-btn ${isSummarizing ? 'loading' : ''}`}
          onClick={isSummarizing ? undefined : onSummarizeClick}
          disabled={isSummarizing}
          title="Summarize PDF"
        >
          {isSummarizing ? (
            <span className="toolbar-spinner" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 1v2H1v10h10v-4h2v6H0V2h4V0h8v7h-2V2H5zm2 6H5v2h2V7zm0-2H5v1h2V5zm8 0h-2V3h-1v2h-2v1h2v2h1V6h2V5z"/>
            </svg>
          )}
        </button>
      )}

      <button
        className={`content-toolbar-btn ${showAgent ? 'active' : ''}`}
        onClick={onAgentToggle}
        title="Toggle Agent (Ctrl+Shift+A)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0l1.669.864 1.858.282.842 1.68 1.337 1.32-.189 1.87.831 1.669-.831 1.669.189 1.87-1.337 1.32-.842 1.68-1.858.282L8 16l-1.669-.864-1.858-.282-.842-1.68-1.337-1.32.189-1.87L1.652 8.315l.831-1.669-.189-1.87 1.337-1.32.842-1.68 1.858-.282L8 0zm0 2.5L6.881 3.11l-1.217.185-.552 1.1-.876.865.124 1.224L3.815 8l.545 1.093-.124 1.224.876.865.552 1.1 1.217.185L8 13.5l1.119-.61 1.217-.185.552-1.1.876-.865-.124-1.224L12.185 8l-.545-1.093.124-1.224-.876-.865-.552-1.1-1.217-.185L8 2.5z"/>
        </svg>
      </button>
    </div>
  )
}
