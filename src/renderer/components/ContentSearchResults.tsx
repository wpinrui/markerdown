import { FileText, ChevronRight, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { SearchResult } from '@shared/types'

interface ContentSearchResultsProps {
  results: SearchResult[]
  query: string
  isSearching: boolean
  onResultClick: (filePath: string, lineNumber: number) => void
}

export function ContentSearchResults({
  results,
  query,
  isSearching,
  onResultClick,
}: ContentSearchResultsProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }

  const highlightMatch = (text: string, matchStart: number, matchEnd: number) => {
    // Ensure indices are within bounds
    const safeStart = Math.max(0, Math.min(matchStart, text.length))
    const safeEnd = Math.max(safeStart, Math.min(matchEnd, text.length))

    const before = text.slice(0, safeStart)
    const match = text.slice(safeStart, safeEnd)
    const after = text.slice(safeEnd)

    return (
      <>
        {before}
        <mark className="search-match-highlight">{match}</mark>
        {after}
      </>
    )
  }

  if (isSearching) {
    return (
      <div className="content-search-results">
        <div className="search-status">Searching...</div>
      </div>
    )
  }

  if (!query.trim()) {
    return (
      <div className="content-search-results">
        <div className="search-status">Type to search file contents</div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="content-search-results">
        <div className="search-status">No matches found</div>
      </div>
    )
  }

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0)

  return (
    <div className="content-search-results">
      <div className="search-summary">
        {totalMatches} match{totalMatches === 1 ? '' : 'es'} in {results.length} file
        {results.length === 1 ? '' : 's'}
      </div>
      <div className="search-results-list">
        {results.map((result) => {
          const isExpanded = expandedFiles.has(result.filePath)
          return (
            <div key={result.filePath} className="search-result-file">
              <button
                className="search-result-file-header"
                onClick={() => toggleFile(result.filePath)}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <FileText size={14} className="search-result-icon" />
                <span className="search-result-filename">{result.fileName}</span>
                <span className="search-result-count">{result.matches.length}</span>
              </button>
              {isExpanded && (
                <div className="search-result-matches">
                  {result.matches.map((match, idx) => (
                    <button
                      key={idx}
                      className="search-result-match"
                      onClick={() => onResultClick(result.filePath, match.lineNumber)}
                    >
                      <span className="match-line-number">{match.lineNumber}</span>
                      <span className="match-line-content">
                        {highlightMatch(
                          match.lineContent,
                          match.matchStart,
                          match.matchEnd
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
