import { useRef, useEffect, useState } from 'react'

interface OptionsModalProps {
  isOpen: boolean
  onClose: () => void
  currentFolderPath: string | null
  onFolderChange: (path: string) => void
}

export function OptionsModal({
  isOpen,
  onClose,
  currentFolderPath,
  onFolderChange,
}: OptionsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [pendingFolderPath, setPendingFolderPath] = useState<string | null>(currentFolderPath)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      setPendingFolderPath(currentFolderPath)
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen, currentFolderPath])

  const handleBrowse = async () => {
    const path = await window.electronAPI.openFolder()
    if (path) {
      setPendingFolderPath(path)
    }
  }

  const handleSave = () => {
    if (pendingFolderPath && pendingFolderPath !== currentFolderPath) {
      onFolderChange(pendingFolderPath)
    }
    onClose()
  }

  const handleCancel = () => {
    setPendingFolderPath(currentFolderPath)
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
