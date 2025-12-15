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
  const [filename, setFilename] = useState('')
  const [filenameError, setFilenameError] = useState<string | null>(null)

  // Compute default filename
  useEffect(() => {
    if (!isOpen) return
    const hasDefault = existingVariants.includes('')
    const defaultFilename = hasDefault
      ? `${entityBaseName}.summary.md`
      : `${entityBaseName}.md`
    setFilename(defaultFilename)
    setFilenameError(null)
    setMode('auto')
    setCustomPrompt('')
  }, [isOpen, entityBaseName, existingVariants])

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

  // Validate filename
  useEffect(() => {
    if (!filename) {
      setFilenameError('Filename is required')
      return
    }
    if (!filename.endsWith('.md')) {
      setFilenameError('Filename must end with .md')
      return
    }
    // Extract variant from filename
    const expectedPrefix = `${entityBaseName}.`
    if (!filename.startsWith(expectedPrefix) && filename !== `${entityBaseName}.md`) {
      setFilenameError(`Filename must start with "${entityBaseName}."`)
      return
    }
    // Check if variant already exists
    let variant: string | null = null
    if (filename === `${entityBaseName}.md`) {
      variant = ''
    } else {
      // e.g., physics.summary.md -> variant = "summary"
      const withoutExt = filename.slice(0, -3) // remove .md
      const afterBase = withoutExt.slice(entityBaseName.length + 1) // remove "physics."
      variant = afterBase
    }
    if (existingVariants.includes(variant)) {
      setFilenameError('A file with this name already exists')
      return
    }
    setFilenameError(null)
  }, [filename, entityBaseName, existingVariants])

  const handleSubmit = () => {
    if (filenameError) return
    const prompt = mode === 'auto' ? AUTO_PROMPT : customPrompt
    if (!prompt.trim()) return
    onSubmit(prompt, filename)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const isSubmitDisabled = !!filenameError || (mode === 'custom' && !customPrompt.trim())

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
          <label htmlFor="output-filename">Output filename</label>
          <input
            id="output-filename"
            type="text"
            className={`summarize-input ${filenameError ? 'error' : ''}`}
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
          {filenameError && (
            <div className="summarize-error">{filenameError}</div>
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
