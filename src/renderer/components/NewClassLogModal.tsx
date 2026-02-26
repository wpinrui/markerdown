import { useState, useEffect, useRef, useMemo } from 'react'
import type { TreeNode } from '@shared/types'
import { getBasename, getExtension } from '@shared/pathUtils'

export interface ClassLogConfig {
  prefix: string
  number: number
  date: string
  attachedFilePath?: string
  createMd: boolean
  summarise: boolean
}

interface DetectedPrefix {
  prefix: string
  maxNumber: number
}

interface NewClassLogModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (config: ClassLogConfig) => void
  onBrowseFile: () => Promise<string | null>
  folderChildren: TreeNode[]
  attachedFilePath?: string
}

const CLASS_LOG_PATTERN = /^([A-Za-z]+)(\d+)\s*\((.+)\)/

function detectPrefixes(children: TreeNode[]): DetectedPrefix[] {
  const prefixMap = new Map<string, number>()

  for (const child of children) {
    if (child.isDirectory) continue
    const baseName = child.entity?.baseName ?? getBasename(child.name)
    const match = baseName.match(CLASS_LOG_PATTERN)
    if (match) {
      const prefix = match[1]
      const num = parseInt(match[2], 10)
      const current = prefixMap.get(prefix) ?? 0
      if (num > current) {
        prefixMap.set(prefix, num)
      }
    }
  }

  return Array.from(prefixMap.entries())
    .map(([prefix, maxNumber]) => ({ prefix, maxNumber }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix))
}

function formatTodayDate(): string {
  const now = new Date()
  const day = now.getDate()
  const month = now.toLocaleString('en-GB', { month: 'short' })
  return `${day} ${month}`
}

function buildEntityName(prefix: string, number: number, date: string): string {
  return `${prefix}${number} (${date})`
}

export function NewClassLogModal({
  isOpen,
  onClose,
  onSubmit,
  onBrowseFile,
  folderChildren,
  attachedFilePath: initialAttachedFile,
}: NewClassLogModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const prefixInputRef = useRef<HTMLInputElement>(null)

  const [prefix, setPrefix] = useState('')
  const [number, setNumber] = useState(1)
  const [date, setDate] = useState('')
  const [attachedFile, setAttachedFile] = useState<string | null>(null)
  const [createMd, setCreateMd] = useState(true)
  const [summarise, setSummarise] = useState(true)
  const [useCustomPrefix, setUseCustomPrefix] = useState(false)

  const detectedPrefixes = useMemo(() => detectPrefixes(folderChildren), [folderChildren])

  // Initialize state when modal opens
  useEffect(() => {
    if (!isOpen) return

    setDate(formatTodayDate())
    setAttachedFile(initialAttachedFile ?? null)
    setCreateMd(true)
    setSummarise(true)

    if (detectedPrefixes.length > 0) {
      const first = detectedPrefixes[0]
      setPrefix(first.prefix)
      setNumber(first.maxNumber + 1)
      setUseCustomPrefix(false)
    } else {
      setPrefix('')
      setNumber(1)
      setUseCustomPrefix(true)
    }

    setTimeout(() => prefixInputRef.current?.focus(), 50)
  }, [isOpen, detectedPrefixes, initialAttachedFile])

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

  // Update number when prefix changes (to match detected sequence)
  const handlePrefixSelect = (value: string) => {
    if (value === '__custom__') {
      setUseCustomPrefix(true)
      setPrefix('')
      setNumber(1)
      return
    }
    setUseCustomPrefix(false)
    setPrefix(value)
    const detected = detectedPrefixes.find((d) => d.prefix === value)
    if (detected) {
      setNumber(detected.maxNumber + 1)
    }
  }

  const handleBrowse = async () => {
    const filePath = await onBrowseFile()
    if (filePath) {
      setAttachedFile(filePath)
    }
  }

  // Validation
  const entityName = buildEntityName(prefix, number, date)

  const existingNames = useMemo(() => {
    const names = new Set<string>()
    for (const child of folderChildren) {
      const baseName = child.entity?.baseName ?? getBasename(child.name)
      names.add(baseName.toLowerCase())
    }
    return names
  }, [folderChildren])

  const validation = useMemo(() => {
    if (!prefix.trim()) return { type: 'error' as const, message: 'Prefix is required' }
    if (!date.trim()) return { type: 'error' as const, message: 'Date is required' }
    if (number < 1) return { type: 'error' as const, message: 'Number must be at least 1' }

    // Check for conflict
    const fullName = entityName.toLowerCase()
    if (existingNames.has(fullName)) {
      return { type: 'warning' as const, message: 'An entity with this name already exists' }
    }

    if (!createMd && !attachedFile) {
      return { type: 'error' as const, message: 'Either create a note or attach a file' }
    }

    return null
  }, [prefix, number, date, entityName, existingNames, createMd, attachedFile])

  const canSubmit = validation?.type !== 'error' && prefix.trim() && date.trim()

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({
      prefix: prefix.trim(),
      number,
      date: date.trim(),
      attachedFilePath: attachedFile ?? undefined,
      createMd,
      summarise: summarise && !!attachedFile,
    })
  }

  const attachedFileName = attachedFile ? getBasename(attachedFile) : null
  const attachedFileExt = attachedFile ? getExtension(attachedFile) : null
  const previewFiles: string[] = []
  if (attachedFile && attachedFileExt) {
    previewFiles.push(`${entityName}${attachedFileExt}`)
  }
  if (createMd) {
    previewFiles.push(`${entityName}.md`)
  }

  return (
    <dialog ref={dialogRef} className="class-log-modal" onClose={onClose}>
      <div className="class-log-modal-header">New Class Log</div>
      <div className="class-log-modal-body">
        {/* Prefix + Number row */}
        <div className="class-log-row">
          <div className="class-log-input-group class-log-prefix-group">
            <label className="class-log-label">Prefix</label>
            {!useCustomPrefix && detectedPrefixes.length > 0 ? (
              <select
                className="class-log-select"
                value={prefix}
                onChange={(e) => handlePrefixSelect(e.target.value)}
              >
                {detectedPrefixes.map((d) => (
                  <option key={d.prefix} value={d.prefix}>
                    {d.prefix} (last: {d.maxNumber})
                  </option>
                ))}
                <option value="__custom__">Custom...</option>
              </select>
            ) : (
              <input
                ref={prefixInputRef}
                type="text"
                className="class-log-input"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. T, A, L"
              />
            )}
          </div>
          <div className="class-log-input-group class-log-number-group">
            <label className="class-log-label">Number</label>
            <input
              type="number"
              className="class-log-input"
              value={number}
              onChange={(e) => setNumber(parseInt(e.target.value, 10) || 1)}
              min={1}
            />
          </div>
        </div>

        {/* Date */}
        <div className="class-log-input-group">
          <label className="class-log-label">Date</label>
          <input
            type="text"
            className="class-log-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="e.g. 26 Feb"
          />
        </div>

        {/* Attached file */}
        <div className="class-log-input-group">
          <label className="class-log-label">Attached file</label>
          {attachedFileName ? (
            <div className="class-log-file-attachment">
              <span className="class-log-file-name" title={attachedFile ?? undefined}>
                {attachedFileName}
              </span>
              <button
                type="button"
                className="class-log-file-remove"
                onClick={() => setAttachedFile(null)}
              >
                Remove
              </button>
            </div>
          ) : (
            <button type="button" className="class-log-browse-btn" onClick={handleBrowse}>
              Browse...
            </button>
          )}
        </div>

        {/* Checkboxes */}
        <div className="class-log-checkboxes">
          <label className="class-log-checkbox-label">
            <input
              type="checkbox"
              checked={createMd}
              onChange={(e) => setCreateMd(e.target.checked)}
            />
            Create .md note
          </label>
          <label className="class-log-checkbox-label">
            <input
              type="checkbox"
              checked={summarise}
              onChange={(e) => setSummarise(e.target.checked)}
              disabled={!attachedFile}
            />
            Summarise attached file
          </label>
        </div>

        {/* Validation message */}
        {validation && (
          <div className={`class-log-validation ${validation.type}`}>
            {validation.message}
          </div>
        )}

        {/* Preview */}
        {previewFiles.length > 0 && prefix.trim() && date.trim() && (
          <div className="class-log-preview">
            <div className="class-log-preview-label">Will create:</div>
            <ul className="class-log-preview-list">
              {previewFiles.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="class-log-modal-footer">
        <button type="button" className="class-log-cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="class-log-submit-btn"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          Create
        </button>
      </div>
    </dialog>
  )
}
