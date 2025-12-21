import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ChevronRight, ChevronDown, Check } from 'lucide-react'
import type { TreeNode } from '@shared/types'

declare global {
  interface Window {
    newNoteAPI: {
      getInitialData: () => Promise<{ treeNodes: TreeNode[]; selectedPath: string | null }>
      submit: (name: string, parentPath: string | null, childrenPaths: string[]) => void
      cancel: () => void
    }
  }
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

// Get all nodes (directories and files) for parent selection
function getSelectableParents(nodes: TreeNode[], depth = 0): Array<{ node: TreeNode; depth: number }> {
  const result: Array<{ node: TreeNode; depth: number }> = []
  for (const node of nodes) {
    result.push({ node, depth })
    if (node.children) {
      result.push(...getSelectableParents(node.children, depth + 1))
    }
  }
  return result
}

// Get direct children of a parent for multi-select
function getDirectChildren(nodes: TreeNode[], parentPath: string | null): TreeNode[] {
  if (parentPath === null) {
    return nodes
  }

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

// Ensure filename has .md extension
function ensureMdExtension(filename: string): string {
  return filename.toLowerCase().endsWith('.md') ? filename : `${filename}.md`
}

export function NewNoteWindow() {
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [name, setName] = useState('')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [selectedChildren, setSelectedChildren] = useState<Set<string>>(new Set())
  const [showParentDropdown, setShowParentDropdown] = useState(false)
  const [parentSearch, setParentSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const parentSearchRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Load initial data from main process
  useEffect(() => {
    async function loadData() {
      const data = await window.newNoteAPI.getInitialData()
      setTreeNodes(data.treeNodes)
      setParentPath(data.selectedPath)

      // Generate default name
      let counter = 1
      let defaultName = `Untitled${counter}.md`
      const existingNames = new Set(getAllNodeNames(data.treeNodes))
      while (existingNames.has(defaultName.toLowerCase())) {
        counter++
        defaultName = `Untitled${counter}.md`
      }
      setName(defaultName)
      setIsLoading(false)

      // Focus name input after load
      setTimeout(() => nameInputRef.current?.select(), 50)
    }
    loadData()
  }, [])

  // Validation
  const validation = useMemo(() => {
    if (!name.trim()) {
      return { type: 'error' as const, message: 'Name is required' }
    }

    const normalizedName = ensureMdExtension(name).toLowerCase()
    const siblings = getDirectChildren(treeNodes, parentPath)
    const siblingNames = siblings.map(sibling => sibling.name.toLowerCase())

    if (siblingNames.includes(normalizedName)) {
      return { type: 'error' as const, message: 'A file with this name already exists here' }
    }

    const allNames = getAllNodeNames(treeNodes)
    if (allNames.includes(normalizedName)) {
      return { type: 'warning' as const, message: 'A file with this name exists in another location' }
    }

    return null
  }, [name, parentPath, treeNodes])

  const canSubmit = validation?.type !== 'error' && name.trim()

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    window.newNoteAPI.submit(ensureMdExtension(name), parentPath, Array.from(selectedChildren))
  }, [canSubmit, name, parentPath, selectedChildren])

  const handleCancel = useCallback(() => {
    window.newNoteAPI.cancel()
  }, [])

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

  const handleSelectParent = useCallback((path: string | null) => {
    setParentPath(path)
    setSelectedChildren(new Set())
    setShowParentDropdown(false)
    setParentSearch('')
  }, [])

  const selectableParents = useMemo(() => getSelectableParents(treeNodes), [treeNodes])
  const filteredParents = useMemo(() => {
    if (!parentSearch.trim()) return selectableParents
    const search = parentSearch.toLowerCase()
    return selectableParents.filter(({ node }) => node.name.toLowerCase().includes(search))
  }, [selectableParents, parentSearch])
  const availableChildren = useMemo(() => getDirectChildren(treeNodes, parentPath), [treeNodes, parentPath])

  const parentDisplayName = useMemo(() => {
    if (parentPath === null) return '(Root)'
    const parent = selectableParents.find(entry => entry.node.path === parentPath)
    return parent?.node.name ?? '(Root)'
  }, [parentPath, selectableParents])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (showParentDropdown && parentSearchRef.current) {
      parentSearchRef.current.focus()
    }
  }, [showParentDropdown])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showParentDropdown) {
          setShowParentDropdown(false)
          setParentSearch('')
        } else {
          handleCancel()
        }
      } else if (e.key === 'Enter' && !showParentDropdown && canSubmit) {
        handleSubmit()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showParentDropdown, canSubmit, handleSubmit, handleCancel])

  if (isLoading) {
    return <div className="new-note-loading">Loading...</div>
  }

  return (
    <div className="new-note-window">
      <div className="new-note-body">
        {/* Name input */}
        <div className="new-note-input-group">
          <label className="new-note-label">Name</label>
          <input
            ref={nameInputRef}
            type="text"
            className={`new-note-input ${validation?.type === 'error' ? 'error' : validation?.type === 'warning' ? 'warning' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
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
                <input
                  ref={parentSearchRef}
                  type="text"
                  className="new-note-dropdown-search"
                  placeholder="Search..."
                  value={parentSearch}
                  onChange={(e) => setParentSearch(e.target.value)}
                />
                <div className="new-note-dropdown-list">
                  {!parentSearch.trim() && (
                    <button
                      type="button"
                      className={`new-note-dropdown-item ${parentPath === null ? 'selected' : ''}`}
                      onClick={() => handleSelectParent(null)}
                    >
                      (Root)
                    </button>
                  )}
                  {filteredParents.map(({ node, depth }) => (
                    <button
                      key={node.path}
                      type="button"
                      className={`new-note-dropdown-item ${parentPath === node.path ? 'selected' : ''}`}
                      style={{ paddingLeft: `${12 + (parentSearch.trim() ? 0 : depth) * 16}px` }}
                      onClick={() => handleSelectParent(node.path)}
                    >
                      {node.name}
                    </button>
                  ))}
                  {filteredParents.length === 0 && parentSearch.trim() && (
                    <div className="new-note-dropdown-empty">No matches</div>
                  )}
                </div>
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
      <div className="new-note-footer">
        <button type="button" className="new-note-cancel-btn" onClick={handleCancel}>
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
    </div>
  )
}
