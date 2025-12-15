import { useRef, useEffect, useState } from 'react'

const AUTO_PROMPT = `Read this PDF and create comprehensive notes with these sections:

## Take Note!
Extract critical information: important tasks, deadlines, dates, gotchas, and anything requiring immediate attention.

## [Content Sections]
Organize the main content into logical sections with clear headers. Summarize key information without duplicating content across sections.

## Appendix
Collect reference information: links, contact details, administrative instructions, and other details that may be useful later.

Format as clean markdown. Be thorough but concise.`

interface SummarizeModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (prompt: string, outputFilename: string) => void
  entityBaseName: string
  existingVariants: string[]
}

export function SummarizeModal({
  isOpen,
  onClose,
  onSubmit,
  entityBaseName,
  existingVariants,
}: SummarizeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<'auto' | 'custom'>('auto')
  const [customPrompt, setCustomPrompt] = useState('')
  const [suffix, setSuffix] = useState('')
  const [suffixError, setSuffixError] = useState<string | null>(null)

  // Compute the full filename from suffix
  const outputFilename = suffix ? `${entityBaseName}.${suffix}.md` : `${entityBaseName}.md`

  // Compute default suffix
  useEffect(() => {
    if (!isOpen) return
    const hasDefault = existingVariants.includes('')
    setSuffix(hasDefault ? 'summary' : '')
    setSuffixError(null)
    setMode('auto')
    setCustomPrompt('')
  }, [isOpen, existingVariants])

  // Open/close dialog
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  // Validate suffix
  useEffect(() => {
    // Check for invalid characters in suffix
    if (suffix && !/^[a-zA-Z0-9_-]+$/.test(suffix)) {
      setSuffixError('Only letters, numbers, - and _ allowed')
      return
    }
    // Check if variant already exists
    const variant = suffix || ''
    if (existingVariants.includes(variant)) {
      setSuffixError('A file with this name already exists')
      return
    }
    setSuffixError(null)
  }, [suffix, existingVariants])

  const handleSubmit = () => {
    if (suffixError) return
    const prompt = mode === 'auto' ? AUTO_PROMPT : customPrompt
    if (!prompt.trim()) return
    onSubmit(prompt, outputFilename)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const isSubmitDisabled = !!suffixError || (mode === 'custom' && !customPrompt.trim())

  return (
    <dialog
      ref={dialogRef}
      className="summarize-modal"
      onKeyDown={handleKeyDown}
      onClose={onClose}
    >
      <div className="summarize-modal-header">
        Summarize PDF
      </div>
      <div className="summarize-modal-body">
        <div className="summarize-mode-buttons">
          <button
            className={`summarize-mode-btn ${mode === 'auto' ? 'active' : ''}`}
            onClick={() => setMode('auto')}
          >
            Auto
          </button>
          <button
            className={`summarize-mode-btn ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => setMode('custom')}
          >
            Custom
          </button>
        </div>

        <textarea
          className="summarize-textarea"
          value={mode === 'auto' ? AUTO_PROMPT : customPrompt}
          onChange={(e) => mode === 'custom' && setCustomPrompt(e.target.value)}
          readOnly={mode === 'auto'}
          placeholder={mode === 'custom' ? 'Enter your custom prompt...' : undefined}
        />

        <div className="summarize-input-group">
          <label htmlFor="output-suffix">Variant suffix (optional)</label>
          <input
            id="output-suffix"
            type="text"
            className={`summarize-input ${suffixError ? 'error' : ''}`}
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            placeholder="e.g., summary, notes"
          />
          <div className="summarize-filename-preview">
            Output: <strong>{outputFilename}</strong>
          </div>
          {suffixError && (
            <div className="summarize-error">{suffixError}</div>
          )}
        </div>
      </div>
      <div className="summarize-modal-footer">
        <button className="summarize-cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="summarize-submit-btn"
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
        >
          Summarize
        </button>
      </div>
    </dialog>
  )
}
