import { useRef, useEffect } from 'react'
import { Check, X } from 'lucide-react'

interface InlineEditInputProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  placeholder: string
  className: string
}

export function InlineEditInput({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder,
  className,
}: InlineEditInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus and select text when mounted
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSave()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={className}
        placeholder={placeholder}
      />
      <button
        type="button"
        className={`${className.replace('-input', '-btn')} save`}
        onClick={onSave}
        title="Save"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        className={`${className.replace('-input', '-btn')} cancel`}
        onClick={onCancel}
        title="Cancel"
      >
        <X size={14} />
      </button>
    </>
  )
}
