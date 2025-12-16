import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ChevronRight, ChevronDown, Check } from 'lucide-react'
import type { TreeNode } from '@shared/types'

interface NewNoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string, parentPath: string | null, childrenPaths: string[]) => void
  treeNodes: TreeNode[]
  selectedNode: TreeNode | null
}

// Flatten tree to get all node names for validation
function getAllNodeNames(nodes: TreeNode[]): string[] {
  const result: string[] = []
  for (const node of nodes) {
    result.push(node.name.toLowerCase())
    if (node.children) {
      result.push(...getAllNodeNames(node.children))
    }
  }
  return result
}

// Get all folder-like nodes (directories and sidecars) for parent selection
function getSelectableParents(nodes: TreeNode[], depth = 0): Array<{ node: TreeNode; depth: number }> {
  const result: Array<{ node: TreeNode; depth: number }> = []
  for (const node of nodes) {
    // Allow selecting directories or files with sidecars (they have children)
    if (node.isDirectory || node.hasSidecar) {
      result.push({ node, depth })
      if (node.children) {
        result.push(...getSelectableParents(node.children, depth + 1))
      }
    }
  }
  return result
}

// Get direct children of a parent for multi-select
function getDirectChildren(nodes: TreeNode[], parentPath: string | null): TreeNode[] {
  if (parentPath === null) {
    return nodes
  }

  // Find the parent node and return its children
  const findChildren = (searchNodes: TreeNode[]): TreeNode[] | null => {
    for (const node of searchNodes) {
      if (node.path === parentPath) {
        return node.children ?? []
      }
      if (node.children) {
        const found = findChildren(node.children)
        if (found !== null) return found
      }
    }
    return null
  }

  return findChildren(nodes) ?? []
}

// Find the parent path of the selected node
// Returns the parent path if found, null if at root level, undefined if not found
function findParentPath(nodes: TreeNode[], targetPath: string, currentParent: string | null = null): string | null | undefined {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return currentParent
    }
    if (node.children) {
      const found = findParentPath(node.children, targetPath, node.path)
      if (found !== undefined) return found
    }
  }
  return undefined
}

// Get the containing folder path of a node
function getContainingFolder(node: TreeNode | null, nodes: TreeNode[]): string | null {
  if (!node) return null

  // If the node is a directory or has a sidecar, use it as parent
  if (node.isDirectory || node.hasSidecar) {
    return node.path
  }

  // Otherwise, find the parent of this node
  return findParentPath(nodes, node.path) ?? null
}

// Ensure filename has .md extension
function ensureMdExtension(filename: string): string {
  return filename.endsWith('.md') ? filename : `${filename}.md`
}

export function NewNoteModal({ isOpen, onClose, onSubmit, treeNodes, selectedNode }: NewNoteModalProps) {
  const [name, setName] = useState('')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [selectedChildren, setSelectedChildren] = useState<Set<string>>(new Set())
  const [showParentDropdown, setShowParentDropdown] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Open/close dialog using showModal for proper backdrop support
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  // Calculate default name on open
  useEffect(() => {
    if (isOpen) {
      const defaultParent = getContainingFolder(selectedNode, treeNodes)
      setParentPath(defaultParent)
      setSelectedChildren(new Set())

      // Generate default name
      let counter = 1
      let defaultName = `Untitled${counter}.md`

      const existingNames = new Set(getAllNodeNames(treeNodes))
      while (existingNames.has(defaultName.toLowerCase())) {
        counter++
        defaultName = `Untitled${counter}.md`
      }

      setName(defaultName)
    }
  }, [isOpen, treeNodes, selectedNode])

  // Validation
  const validation = useMemo(() => {
    if (!name.trim()) {
      return { type: 'error' as const, message: 'Name is required' }
    }

    const normalizedName = ensureMdExtension(name).toLowerCase()

    // Check for duplicate at same parent level
    const siblings = getDirectChildren(treeNodes, parentPath)
    const siblingNames = siblings.map(n => n.name.toLowerCase())

    if (siblingNames.includes(normalizedName)) {
      return { type: 'error' as const, message: 'A file with this name already exists here' }
    }

    // Check for duplicate elsewhere
    const allNames = getAllNodeNames(treeNodes)
    if (allNames.includes(normalizedName)) {
      return { type: 'warning' as const, message: 'A file with this name exists in another location' }
    }

    return null
  }, [name, parentPath, treeNodes])

  const canSubmit = validation?.type !== 'error' && name.trim()

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit(ensureMdExtension(name), parentPath, Array.from(selectedChildren))
    onClose()
  }

  const handleChildToggle = useCallback((path: string) => {
    setSelectedChildren(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const selectableParents = useMemo(() => getSelectableParents(treeNodes), [treeNodes])
  const availableChildren = useMemo(() => getDirectChildren(treeNodes, parentPath), [treeNodes, parentPath])

  // Get display name for parent
  const parentDisplayName = useMemo(() => {
    if (parentPath === null) return '(Root)'
    const parent = selectableParents.find(p => p.node.path === parentPath)
    return parent?.node.name ?? '(Root)'
  }, [parentPath, selectableParents])

  return (
    <dialog ref={dialogRef} className="new-note-modal">
      <div className="new-note-modal-header">New Note</div>
      <div className="new-note-modal-body">
        {/* Name input */}
        <div className="new-note-input-group">
          <label className="new-note-label">Name</label>
          <input
            type="text"
            className={`new-note-input ${validation?.type === 'error' ? 'error' : validation?.type === 'warning' ? 'warning' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) handleSubmit()
              if (e.key === 'Escape') onClose()
            }}
          />
          {validation && (
            <div className={`new-note-validation ${validation.type}`}>
              {validation.message}
            </div>
          )}
        </div>

        {/* Parent selector */}
        <div className="new-note-input-group">
          <label className="new-note-label">Parent Location</label>
          <div className="new-note-dropdown-container">
            <button
              type="button"
              className="new-note-dropdown-btn"
              onClick={() => setShowParentDropdown(!showParentDropdown)}
            >
              <span>{parentDisplayName}</span>
              {showParentDropdown ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {showParentDropdown && (
              <div className="new-note-dropdown">
                <button
                  type="button"
                  className={`new-note-dropdown-item ${parentPath === null ? 'selected' : ''}`}
                  onClick={() => {
                    setParentPath(null)
                    setSelectedChildren(new Set())
                    setShowParentDropdown(false)
                  }}
                >
                  (Root)
                </button>
                {selectableParents.map(({ node, depth }) => (
                  <button
                    key={node.path}
                    type="button"
                    className={`new-note-dropdown-item ${parentPath === node.path ? 'selected' : ''}`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    onClick={() => {
                      setParentPath(node.path)
                      setSelectedChildren(new Set())
                      setShowParentDropdown(false)
                    }}
                  >
                    {node.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Children multi-select */}
        {availableChildren.length > 0 && (
          <div className="new-note-input-group">
            <label className="new-note-label">Move items under this note (optional)</label>
            <div className="new-note-children-list">
              {availableChildren.map((child) => (
                <button
                  key={child.path}
                  type="button"
                  className={`new-note-child-item ${selectedChildren.has(child.path) ? 'selected' : ''}`}
                  onClick={() => handleChildToggle(child.path)}
                >
                  <span className="new-note-child-check">
                    {selectedChildren.has(child.path) && <Check size={14} />}
                  </span>
                  <span className="new-note-child-name">{child.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="new-note-modal-footer">
        <button type="button" className="new-note-cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="new-note-submit-btn"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          Create
        </button>
      </div>
    </dialog>
  )
}
