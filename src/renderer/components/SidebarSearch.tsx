import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

interface SidebarSearchProps {
  value: string
  onChange: (value: string) => void
  debounceMs?: number
}

export function SidebarSearch({ value, onChange, debounceMs = 150 }: SidebarSearchProps) {
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Sync local value when external value changes (e.g., cleared from parent)
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = (newValue: string) => {
    setLocalValue(newValue)

    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce the onChange callback
    debounceRef.current = setTimeout(() => {
      onChange(newValue)
    }, debounceMs)
  }

  const handleClear = () => {
    setLocalValue('')
    onChange('')
    inputRef.current?.focus()
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <div className="sidebar-search">
      <Search size={14} className="sidebar-search-icon" />
      <input
        ref={inputRef}
        type="text"
        className="sidebar-search-input"
        placeholder="Search..."
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
      />
      {localValue && (
        <button
          className="sidebar-search-clear"
          onClick={handleClear}
          title="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
