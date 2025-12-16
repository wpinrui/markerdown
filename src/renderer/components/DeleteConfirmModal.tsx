import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { TreeNode, EntityMember } from '@shared/types'

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  // For deleting a tree node (file, entity, or directory)
  node?: TreeNode
  // For deleting a specific entity member (from tab context menu)
  member?: EntityMember
  entityBaseName?: string
}

function getBasename(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return filePath.substring(lastSlash + 1)
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  node,
  member,
  entityBaseName,
}: DeleteConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  // Determine what we're deleting and what files are affected
  const getDeleteInfo = () => {
    // Deleting a specific entity member
    if (member) {
      const fileName = getBasename(member.path)
      return {
        title: 'Delete File',
        description: `Are you sure you want to delete "${fileName}"?`,
        files: [fileName],
        isEntity: false,
      }
    }

    // Deleting a tree node
    if (node) {
      // Entity - multiple files
      if (node.entity) {
        const fileNames = node.entity.members.map((m) => getBasename(m.path))
        return {
          title: 'Delete Entity',
          description: `Are you sure you want to delete the "${node.entity.baseName}" entity? This will delete ${fileNames.length} file(s):`,
          files: fileNames,
          isEntity: true,
        }
      }

      // Directory
      if (node.isDirectory) {
        return {
          title: 'Delete Folder',
          description: `Are you sure you want to delete the folder "${node.name}" and all its contents?`,
          files: [],
          isEntity: false,
        }
      }

      // Regular file
      return {
        title: 'Delete File',
        description: `Are you sure you want to delete "${node.name}"?`,
        files: [node.name],
        isEntity: false,
      }
    }

    return {
      title: 'Delete',
      description: 'Are you sure you want to delete this item?',
      files: [],
      isEntity: false,
    }
  }

  const { title, description, files } = getDeleteInfo()

  return (
    <dialog ref={dialogRef} className="delete-confirm-modal">
      <div className="delete-confirm-header">
        <AlertTriangle size={20} className="delete-confirm-icon" />
        <span>{title}</span>
      </div>
      <div className="delete-confirm-body">
        <p>{description}</p>
        {files.length > 0 && (
          <ul className="delete-confirm-files">
            {files.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        )}
        <p className="delete-confirm-warning">This action cannot be undone.</p>
      </div>
      <div className="delete-confirm-footer">
        <button
          type="button"
          className="delete-confirm-cancel-btn"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="delete-confirm-btn"
          onClick={handleConfirm}
        >
          Delete
        </button>
      </div>
    </dialog>
  )
}
