import { useRef, useEffect, useState } from 'react'

interface OptionsModalProps {
  isOpen: boolean
  onClose: () => void
  currentFolderPath: string | null
  onFolderChange: (path: string) => void
  showClaudeMd: boolean
  onShowClaudeMdChange: (show: boolean) => void
}

export function OptionsModal({
  isOpen,
  onClose,
  currentFolderPath,
  onFolderChange,
  showClaudeMd,
  onShowClaudeMdChange,
}: OptionsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [pendingFolderPath, setPendingFolderPath] = useState<string | null>(currentFolderPath)
  const [pendingShowClaudeMd, setPendingShowClaudeMd] = useState(showClaudeMd)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      setPendingFolderPath(currentFolderPath)
      setPendingShowClaudeMd(showClaudeMd)
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen, currentFolderPath, showClaudeMd])

  const handleBrowse = async () => {
    try {
      const path = await window.electronAPI.openFolder()
      if (path) {
        setPendingFolderPath(path)
      }
    } catch (err) {
      console.error('Failed to open folder dialog:', err)
    }
  }

  const handleSave = () => {
    if (pendingFolderPath && pendingFolderPath !== currentFolderPath) {
      onFolderChange(pendingFolderPath)
    }
    if (pendingShowClaudeMd !== showClaudeMd) {
      onShowClaudeMdChange(pendingShowClaudeMd)
    }
    onClose()
  }

  const handleCancel = () => {
    setPendingFolderPath(currentFolderPath)
    setPendingShowClaudeMd(showClaudeMd)
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      handleCancel()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="options-modal"
      onClick={handleBackdropClick}
      onCancel={handleCancel}
    >
      <div className="options-modal-header">Options</div>
      <div className="options-modal-body">
        <div className="options-group">
          <label className="options-label">Folder</label>
          <div className="options-folder-row">
            <input
              type="text"
              className="options-folder-input"
              value={pendingFolderPath ?? ''}
              placeholder="No folder selected"
              readOnly
            />
            <button className="options-browse-btn" onClick={handleBrowse}>
              Browse
            </button>
          </div>
        </div>
        <div className="options-group options-advanced">
          <label className="options-label">Advanced</label>
          <label className="options-checkbox-row">
            <input
              type="checkbox"
              checked={pendingShowClaudeMd}
              onChange={(e) => setPendingShowClaudeMd(e.target.checked)}
            />
            <span>Show claude.md in sidebar</span>
          </label>
        </div>
      </div>
      <div className="options-modal-footer">
        <button className="options-cancel-btn" onClick={handleCancel}>
          Cancel
        </button>
        <button className="options-save-btn" onClick={handleSave}>
          Save
        </button>
      </div>
    </dialog>
  )
}
