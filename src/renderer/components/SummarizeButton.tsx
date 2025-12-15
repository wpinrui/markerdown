interface SummarizeButtonProps {
  isSummarizing: boolean
  onClick: () => void
}

export function SummarizeButton({ isSummarizing, onClick }: SummarizeButtonProps) {
  return (
    <button
      className={`summarize-btn ${isSummarizing ? 'loading' : ''}`}
      onClick={isSummarizing ? undefined : onClick}
      disabled={isSummarizing}
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
  )
}
