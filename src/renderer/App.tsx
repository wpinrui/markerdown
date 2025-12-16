import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { TreeView } from './components/TreeView'
import { MarkdownViewer } from './components/MarkdownViewer'
import { MarkdownEditor, MarkdownEditorRef, ActiveFormats } from './components/MarkdownEditor'
import { PdfViewer } from './components/PdfViewer'
import { MediaViewer } from './components/MediaViewer'
import { SummarizeModal } from './components/SummarizeModal'
import { AgentPanel } from './components/AgentPanel'
import { TodoPanel } from './components/TodoPanel'
import { EventPanel } from './components/EventPanel'
import { OptionsModal } from './components/OptionsModal'
import { TopToolbar, PaneType } from './components/TopToolbar'
import { SidebarToolbar } from './components/SidebarToolbar'
import { NewNoteModal } from './components/NewNoteModal'
import { ContextMenu, ContextMenuItem } from './components/ContextMenu'
import { DeleteConfirmModal } from './components/DeleteConfirmModal'
import { RenameModal } from './components/RenameModal'
import { SidebarSearch } from './components/SidebarSearch'
import { useAutoSave } from './hooks/useAutoSave'
import { useHorizontalResize } from './hooks/useHorizontalResize'
import { defaultFormats } from './components/editorTypes'
import { buildFileTree, BuildFileTreeOptions } from '@shared/fileTree'
import { getBasename, getDirname, getExtension, stripExtension, stripMultipleExtensions, normalizePath, findNodeByPath, flattenTree, detectPathSeparator } from '@shared/pathUtils'
import { isMarkdownFile, isPdfFile, isMediaFile, isStructureChange } from '@shared/types'
import type { TreeNode, FileChangeEvent, EntityMember, EditMode } from '@shared/types'
import { Edit3, Trash2, FolderOpen } from 'lucide-react'

const DEFAULT_AGENT_PANEL_WIDTH = 400
const DEFAULT_SIDEBAR_WIDTH = 280
const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 500

const MIN_AGENT_PANEL_WIDTH = 250
const MAX_AGENT_PANEL_WIDTH = 800
const SAVE_IN_PROGRESS_DELAY_MS = 500
const TREE_REFRESH_DELAY_MS = 100

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [activeMember, setActiveMember] = useState<EntityMember | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSummarizeModal, setShowSummarizeModal] = useState(false)
  const [showOptionsModal, setShowOptionsModal] = useState(false)
  const [showNewNoteModal, setShowNewNoteModal] = useState(false)
  const [summarizingPaths, setSummarizingPaths] = useState<Set<string>>(new Set())
  const [showClaudeMd, setShowClaudeMd] = useState(false)

  // Context menu state (for tree nodes and entity tabs)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node?: TreeNode; member?: EntityMember } | null>(null)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ node?: TreeNode; member?: EntityMember } | null>(null)

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState<{ node?: TreeNode; member?: EntityMember } | null>(null)
  // After rename, store the new path to re-select once tree refreshes
  const [pendingSelectionPath, setPendingSelectionPath] = useState<string | null>(null)

  // Right pane state (agent/todos/events)
  const [activePane, setActivePane] = useState<PaneType | null>(null)
  const [agentPanelWidth, setAgentPanelWidth] = useState(DEFAULT_AGENT_PANEL_WIDTH)

  // Left sidebar state
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [searchQuery, setSearchQuery] = useState('')

  // Resize handlers
  const { handleMouseDown: handleAgentPanelMouseDown } = useHorizontalResize({
    direction: 'right',
    minWidth: MIN_AGENT_PANEL_WIDTH,
    maxWidth: MAX_AGENT_PANEL_WIDTH,
    setWidth: setAgentPanelWidth,
  })
  const { handleMouseDown: handleSidebarMouseDown } = useHorizontalResize({
    direction: 'left',
    minWidth: MIN_SIDEBAR_WIDTH,
    maxWidth: MAX_SIDEBAR_WIDTH,
    setWidth: setSidebarWidth,
  })

  // Filter tree nodes by search query
  const filteredTreeNodes = useMemo(() => {
    if (!searchQuery.trim()) return treeNodes

    const query = searchQuery.toLowerCase()

    function filterNodes(nodes: TreeNode[]): TreeNode[] {
      const result: TreeNode[] = []
      for (const node of nodes) {
        const nameMatches = node.name.toLowerCase().includes(query)
        const filteredChildren = node.children ? filterNodes(node.children) : undefined

        // Include node if it matches or has matching descendants
        if (nameMatches || (filteredChildren && filteredChildren.length > 0)) {
          result.push({
            ...node,
            children: filteredChildren,
          })
        }
      }
      return result
    }

    return filterNodes(treeNodes)
  }, [treeNodes, searchQuery])

  // Editor state
  const [editMode, setEditMode] = useState<EditMode>('view')
  const [editContent, setEditContent] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const saveInProgressRef = useRef<Set<string>>(new Set())
  const editorRef = useRef<MarkdownEditorRef>(null)
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>(defaultFormats)

  const handleFolderChange = (path: string) => {
    setFolderPath(path)
    setSelectedNode(null)
    setActiveMember(null)
    setFileContent(null)
    setError(null)
    window.electronAPI.setLastFolder(path).catch((err) => {
      console.error('Failed to save last folder:', err)
    })
    window.electronAPI.setWindowTitle('Markerdown').catch((err: unknown) => {
      console.error('Failed to set window title:', err)
    })
  }

  // Load settings on startup
  useEffect(() => {
    window.electronAPI.getLastFolder().then((path) => {
      if (path) setFolderPath(path)
    }).catch((err) => {
      console.error('Failed to load last folder:', err)
    })
    window.electronAPI.getShowClaudeMd().then((show) => {
      setShowClaudeMd(show)
    }).catch((err) => {
      console.error('Failed to load showClaudeMd setting:', err)
    })
  }, [])

  // Pane toggle helper
  const handlePaneToggle = useCallback((pane: PaneType) => {
    setActivePane((prev) => (prev === pane ? null : pane))
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Agent toggle: Ctrl+Shift+A
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        handlePaneToggle('agent')
      }
      // Edit mode toggle: Ctrl+E
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        const activeFilePath = activeMember?.path ?? selectedNode?.path
        const isMarkdown = activeMember?.type === 'markdown' || (selectedNode && (isMarkdownFile(selectedNode.name) || selectedNode.isSuggestion))
        if (activeFilePath && isMarkdown) {
          setEditMode((prev) => (prev === 'view' ? 'visual' : 'view'))
        }
      }
      // Sidebar toggle: Ctrl+B
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSidebarVisible((v) => !v)
      }
      // Rename: F2
      if (e.key === 'F2' && selectedNode && !selectedNode.isDirectory && !selectedNode.isSuggestion) {
        e.preventDefault()
        setRenameTarget({ node: selectedNode })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeMember, selectedNode, handlePaneToggle])

  // Save handler for editor
  const handleSaveFile = useCallback(async (content: string, filePath: string) => {
    saveInProgressRef.current.add(filePath)
    const result = await window.electronAPI.writeFile(filePath, content)
    if (result.success) {
      setFileContent(content) // Sync the source of truth
    } else {
      setError(`Failed to save: ${result.error}`)
    }
    // Remove from set after a delay (in case watcher fires late)
    setTimeout(() => saveInProgressRef.current.delete(filePath), SAVE_IN_PROGRESS_DELAY_MS)
  }, [])

  // Auto-save hook
  const activeFilePath = activeMember?.path ?? selectedNode?.path ?? null
  useAutoSave({
    content: editContent,
    filePath: activeFilePath,
    isDirty,
    onSave: handleSaveFile,
    onSaveComplete: () => setIsDirty(false),
  })

  // Handle edit content changes
  const handleEditContentChange = useCallback((content: string) => {
    setEditContent(content)
    setIsDirty(true)
  }, [])

  const handleEditorSelectionChange = useCallback((formats: ActiveFormats) => {
    setActiveFormats(formats)
  }, [])

  const refreshTree = useCallback(async () => {
    if (!folderPath) {
      setTreeNodes([])
      return
    }
    try {
      const treeOptions: BuildFileTreeOptions = {
        showClaudeMd,
        readOrder: window.electronAPI.readOrder,
      }
      const nodes = await buildFileTree(folderPath, window.electronAPI.readDirectory, treeOptions)

      // Check for suggestion draft files and inject them at the top
      const suggestionNodes: TreeNode[] = []
      const sep = detectPathSeparator(folderPath)
      const todosDraftPath = `${folderPath}${sep}.markerdown${sep}todos-draft.md`
      const eventsDraftPath = `${folderPath}${sep}.markerdown${sep}events-draft.md`

      const [todosDraftExists, eventsDraftExists] = await Promise.all([
        window.electronAPI.exists(todosDraftPath),
        window.electronAPI.exists(eventsDraftPath),
      ])

      if (todosDraftExists) {
        suggestionNodes.push({
          name: 'Task Suggestions',
          path: todosDraftPath,
          isDirectory: false,
          hasSidecar: false,
          isSuggestion: 'todos',
        })
      }
      if (eventsDraftExists) {
        suggestionNodes.push({
          name: 'Event Suggestions',
          path: eventsDraftPath,
          isDirectory: false,
          hasSidecar: false,
          isSuggestion: 'events',
        })
      }

      setTreeNodes([...suggestionNodes, ...nodes])
    } catch (err) {
      console.error('Failed to build file tree:', err)
      setError('Failed to load folder contents')
    }
  }, [folderPath, showClaudeMd])

  // Build tree when folder changes
  useEffect(() => {
    refreshTree()
  }, [refreshTree])

  // Handle pending selection after rename (re-select the renamed node)
  useEffect(() => {
    if (!pendingSelectionPath || treeNodes.length === 0) return

    // Find the node with the new path (try both forward and backslash variants)
    const [path1, path2] = normalizePath(pendingSelectionPath)
    const node = findNodeByPath(treeNodes, path1) ?? findNodeByPath(treeNodes, path2)

    if (node) {
      setSelectedNode(node)
      // Set active member to default member if it's an entity
      if (node.entity) {
        setActiveMember(node.entity.defaultMember ?? node.entity.members[0])
      }
      // Load file content
      if (node.entity?.defaultMember || !node.isDirectory) {
        const memberPath = node.entity?.defaultMember?.path ?? node.entity?.members[0]?.path ?? node.path
        if (isMarkdownFile(memberPath)) {
          window.electronAPI.readFile(memberPath).then((content) => {
            if (content !== null) setFileContent(content)
          })
        }
      }
    }

    // Clear pending selection
    setPendingSelectionPath(null)
  }, [treeNodes, pendingSelectionPath])

  // Watch folder for changes
  const activeFilePathRef = useRef<string | null>(null)
  activeFilePathRef.current = activeMember?.path ?? selectedNode?.path ?? null

  useEffect(() => {
    if (!folderPath) return

    window.electronAPI.watchFolder(folderPath).catch((err) => {
      console.error('Failed to watch folder:', err)
    })

    const unsubscribe = window.electronAPI.onFileChange((event: FileChangeEvent) => {
      // Check if this is a draft file change (need to refresh tree for suggestion items)
      const isDraftFile = event.path.includes('.markerdown') &&
        (event.path.endsWith('todos-draft.md') || event.path.endsWith('events-draft.md'))

      if (isStructureChange(event.event) || isDraftFile) {
        refreshTree()
      } else if (event.event === 'change' && activeFilePathRef.current === event.path) {
        // Skip reload if we just saved this file (avoid overwriting edits)
        if (saveInProgressRef.current.has(event.path)) {
          return
        }
        window.electronAPI.readFile(event.path).then((content) => {
          if (content !== null) {
            setFileContent(content)
          }
        }).catch((err) => {
          console.error('Failed to reload file:', err)
        })
      }
    })

    return () => {
      unsubscribe()
      window.electronAPI.unwatchFolder()
    }
  }, [folderPath, refreshTree])

  // Load file content when selection or active member changes
  useEffect(() => {
    // Determine which file to load
    let filePath: string | null = null

    if (activeMember) {
      // Loading entity member content
      if (activeMember.type === 'markdown') {
        filePath = activeMember.path
      }
      // PDF doesn't load content this way
    } else if (selectedNode && (isMarkdownFile(selectedNode.name) || selectedNode.isSuggestion)) {
      // Regular markdown file or suggestion draft
      filePath = selectedNode.path
    }

    if (!filePath) {
      setFileContent(null)
      return
    }

    let cancelled = false

    window.electronAPI.readFile(filePath)
      .then((content) => {
        if (cancelled) return
        if (content === null) {
          setError(`Failed to read file`)
          setFileContent(null)
        } else {
          setFileContent(content)
          setError(null)
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to read file:', err)
        setError(`Failed to read file`)
        setFileContent(null)
      })

    return () => {
      cancelled = true
    }
  }, [selectedNode, activeMember])

  // Reset edit state helper
  const resetEditState = useCallback(() => {
    setEditMode('view')
    setEditContent(null)
    setIsDirty(false)
  }, [])

  const handleSelectNode = (node: TreeNode) => {
    resetEditState()
    setSelectedNode(node)
    // If node has an entity, set the default member as active
    if (node.entity) {
      const defaultMember = node.entity.defaultMember ?? node.entity.members[0]
      setActiveMember(defaultMember)
    } else {
      setActiveMember(null)
    }
    // Update window title
    const filename = node.entity?.baseName || getBasename(node.path)
    window.electronAPI.setWindowTitle(`${filename} - Markerdown`).catch((err: unknown) => {
      console.error('Failed to set window title:', err)
    })
  }

  const handleTabChange = (member: EntityMember) => {
    resetEditState()
    setActiveMember(member)
  }

  const handleAcceptSuggestion = async () => {
    if (!selectedNode?.isSuggestion || !folderPath) return

    const suggestionType = selectedNode.isSuggestion
    const draftPath = selectedNode.path
    const sep = detectPathSeparator(folderPath)
    const mainFilePath = `${folderPath}${sep}.markerdown${sep}${suggestionType}.md`

    try {
      // Read draft content
      const draftContent = await window.electronAPI.readFile(draftPath)
      if (!draftContent) return

      // Read existing main file (or empty)
      const existingContent = await window.electronAPI.readFile(mainFilePath) ?? ''

      // Append draft content to main file
      const newContent = existingContent
        ? `${existingContent.trimEnd()}\n\n${draftContent.trim()}\n`
        : `${draftContent.trim()}\n`

      // Ensure .markerdown directory exists
      const markerdownDir = `${folderPath}${sep}.markerdown`
      await window.electronAPI.mkdir(markerdownDir)

      // Write updated main file
      await window.electronAPI.writeFile(mainFilePath, newContent)

      // Delete draft file
      await window.electronAPI.deleteFile(draftPath)

      // Deselect and refresh
      setSelectedNode(null)
      setFileContent(null)
      refreshTree()
    } catch (err) {
      console.error('Failed to accept suggestion:', err)
    }
  }

  const handleDiscardSuggestion = async () => {
    if (!selectedNode?.isSuggestion) return

    try {
      // Delete draft file
      await window.electronAPI.deleteFile(selectedNode.path)

      // Deselect and refresh
      setSelectedNode(null)
      setFileContent(null)
      refreshTree()
    } catch (err) {
      console.error('Failed to discard suggestion:', err)
    }
  }

  const isPdfActive = activeMember?.type === 'pdf'
  const isStandalonePdf = selectedNode && isPdfFile(selectedNode.name) && !selectedNode.entity
  const isMdActive = activeMember?.type === 'markdown'
  const isStandaloneMd = selectedNode && isMarkdownFile(selectedNode.name) && !selectedNode.entity && !selectedNode.isSuggestion
  const isStandaloneMedia = selectedNode && isMediaFile(selectedNode.name) && !selectedNode.entity
  const canSummarize = isPdfActive || isStandalonePdf || isMdActive || isStandaloneMd

  const getOutputPath = (sourcePath: string, outputFilename: string) =>
    `${getDirname(sourcePath)}/${outputFilename}`

  const handleSummarize = async (prompt: string, outputFilename: string) => {
    if (!selectedNode?.path) return

    // Get source path - either from active member (entity) or selected node (standalone)
    const sourcePath = activeMember?.path ?? selectedNode.path
    const outputPath = getOutputPath(sourcePath, outputFilename)

    setSummarizingPaths((prev) => new Set(prev).add(selectedNode.path))
    setShowSummarizeModal(false)

    try {
      const result = await window.electronAPI.summarize({
        sourcePath,
        outputPath,
        prompt,
        workingDir: folderPath!,
      })

      if (!result.success) {
        setError(result.error || 'Summarization failed')
      }
      // File watcher will auto-detect new file and refresh tree
    } catch (err) {
      setError(`Summarization failed: ${err}`)
    } finally {
      setSummarizingPaths((prev) => {
        const next = new Set(prev)
        next.delete(selectedNode.path)
        return next
      })
    }
  }

  // For entities, use entity members; for standalone files, no existing variants
  const existingVariants = selectedNode?.entity?.members.map((m) => m.variant ?? '') ?? []
  // For entities, use baseName; for standalone files, strip .pdf/.md extensions
  const summarizeBaseName = selectedNode?.entity?.baseName
    ?? (selectedNode ? stripMultipleExtensions(selectedNode.name, '.pdf', '.md') : '')

  const isEditing = editMode !== 'view'

  // Open in file explorer handler (for sidebar toolbar)
  const handleOpenInExplorer = async () => {
    if (folderPath) {
      await window.electronAPI.openInExplorer(folderPath)
    }
  }

  // Context menu handlers
  const handleTreeContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }, [])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Shared helper to move a file/folder with error handling
  const moveItem = useCallback(async (sourcePath: string, destPath: string, displayName: string): Promise<boolean> => {
    const result = await window.electronAPI.move(sourcePath, destPath)
    if (!result.success) {
      setError(`Failed to move ${displayName}: ${result.error}`)
      return false
    }
    return true
  }, [])

  // Helper to move an entity (all members + sidecar folder)
  const moveEntityWithSidecar = useCallback(async (node: TreeNode, targetDir: string): Promise<boolean> => {
    if (!node.entity) return false

    // Move all entity members
    for (const member of node.entity.members) {
      const memberName = getBasename(member.path)
      const success = await moveItem(member.path, `${targetDir}/${memberName}`, memberName)
      if (!success) return false
    }

    // Move sidecar folder if it exists
    if (node.hasSidecar && node.children) {
      const entityBaseName = node.entity.baseName
      const sidecarPath = `${getDirname(node.path)}/${entityBaseName}`
      const success = await moveItem(sidecarPath, `${targetDir}/${entityBaseName}`, `folder ${entityBaseName}`)
      if (!success) return false
    }

    return true
  }, [moveItem])

  // Helper to move a file with its sidecar folder
  const moveFileWithSidecar = useCallback(async (node: TreeNode, targetDir: string): Promise<boolean> => {
    const nodeName = getBasename(node.path)
    const baseName = stripExtension(nodeName)
    const nodeDir = getDirname(node.path)

    const success = await moveItem(node.path, `${targetDir}/${nodeName}`, nodeName)
    if (!success) return false

    // Only move sidecar if it exists
    if (node.hasSidecar && node.children) {
      const sidecarSuccess = await moveItem(`${nodeDir}/${baseName}`, `${targetDir}/${baseName}`, `folder ${baseName}`)
      if (!sidecarSuccess) return false
    }

    return true
  }, [moveItem])

  const handleRevealInExplorer = useCallback(async (node: TreeNode) => {
    // Get the path to reveal - for entities use the first member's path
    const pathToReveal = node.entity?.members[0]?.path ?? node.path
    await window.electronAPI.openInExplorer(pathToReveal)
  }, [])

  // Delete handler - performs actual deletion
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return

    try {
      // Deleting a specific entity member
      if (deleteTarget.member) {
        const result = await window.electronAPI.deleteFile(deleteTarget.member.path)
        if (!result.success) {
          setError(`Failed to delete file: ${result.error}`)
        }
        // Clear selection if we deleted the active member
        if (activeMember?.path === deleteTarget.member.path) {
          setActiveMember(null)
          setSelectedNode(null)
          setFileContent(null)
        }
      }
      // Deleting a tree node
      else if (deleteTarget.node) {
        const node = deleteTarget.node

        // Entity - delete all member files (leave sidecar folder intact per user preference)
        if (node.entity) {
          for (const member of node.entity.members) {
            const result = await window.electronAPI.deleteFile(member.path)
            if (!result.success) {
              setError(`Failed to delete ${getBasename(member.path)}: ${result.error}`)
            }
          }
        }
        // Directory
        else if (node.isDirectory) {
          const result = await window.electronAPI.deleteDir(node.path)
          if (!result.success) {
            setError(`Failed to delete folder: ${result.error}`)
          }
        }
        // Regular file
        else {
          const result = await window.electronAPI.deleteFile(node.path)
          if (!result.success) {
            setError(`Failed to delete file: ${result.error}`)
          }
        }

        // Clear selection if we deleted the selected node
        if (selectedNode?.path === node.path) {
          setSelectedNode(null)
          setActiveMember(null)
          setFileContent(null)
        }
      }

      // File watcher will refresh tree automatically
      refreshTree()
    } catch (err) {
      setError(`Delete failed: ${err}`)
    }
  }, [deleteTarget, activeMember, selectedNode, refreshTree])

  // Rename handler - performs actual renaming
  const handleRenameSubmit = useCallback(async (newName: string) => {
    if (!renameTarget || !folderPath) return

    let newSelectionPath: string | null = null

    try {
      // Renaming a specific entity member suffix
      if (renameTarget.member && selectedNode?.entity) {
        const member = renameTarget.member
        const entity = selectedNode.entity
        const dir = getDirname(member.path)
        const ext = member.type === 'pdf' ? '.pdf' : '.md'
        const newFileName = newName ? `${entity.baseName}.${newName}${ext}` : `${entity.baseName}${ext}`
        const newPath = `${dir}/${newFileName}`

        const result = await window.electronAPI.move(member.path, newPath)
        if (!result.success) {
          setError(`Failed to rename: ${result.error}`)
        } else {
          // Keep same entity selected, just update active member path
          newSelectionPath = selectedNode.path
        }
      }
      // Renaming a tree node (entity or file)
      else if (renameTarget.node) {
        const node = renameTarget.node
        const dir = getDirname(node.path)

        // Entity - rename all member files and sidecar folder
        if (node.entity) {
          for (const member of node.entity.members) {
            const oldName = getBasename(member.path)
            const ext = member.type === 'pdf' ? '.pdf' : '.md'
            const variant = member.variant
            const newFileName = variant ? `${newName}.${variant}${ext}` : `${newName}${ext}`
            const newPath = `${dir}/${newFileName}`

            const result = await window.electronAPI.move(member.path, newPath)
            if (!result.success) {
              setError(`Failed to rename ${oldName}: ${result.error}`)
            }
          }

          // Rename sidecar folder if it exists
          if (node.hasSidecar) {
            const oldSidecarPath = `${dir}/${node.entity.baseName}`
            const newSidecarPath = `${dir}/${newName}`
            // Only attempt rename if sidecar folder actually exists
            const sidecarExists = await window.electronAPI.exists(oldSidecarPath)
            if (sidecarExists) {
              const result = await window.electronAPI.move(oldSidecarPath, newSidecarPath)
              if (!result.success) {
                setError(`Failed to rename sidecar folder: ${result.error}`)
              }
            }
          }

          // New entity path uses the default member's new path
          const defaultMember = node.entity.defaultMember ?? node.entity.members[0]
          const ext = defaultMember.type === 'pdf' ? '.pdf' : '.md'
          const variant = defaultMember.variant
          const newFileName = variant ? `${newName}.${variant}${ext}` : `${newName}${ext}`
          newSelectionPath = `${dir}/${newFileName}`
        }
        // Regular file
        else {
          const ext = getExtension(node.name)
          const newFileName = `${newName}${ext}`
          const newPath = `${dir}/${newFileName}`

          const result = await window.electronAPI.move(node.path, newPath)
          if (!result.success) {
            setError(`Failed to rename: ${result.error}`)
          } else {
            newSelectionPath = newPath
          }
        }
      }

      // Store pending selection to re-select after tree refresh
      if (newSelectionPath) {
        setPendingSelectionPath(newSelectionPath)
      }

      // File watcher will refresh tree automatically
      refreshTree()
    } catch (err) {
      setError(`Rename failed: ${err}`)
    }
  }, [renameTarget, folderPath, selectedNode, refreshTree])

  // Get sibling names for conflict detection
  const getSiblingNames = useCallback((node: TreeNode): string[] => {
    const dir = getDirname(node.path)

    // Find all nodes in the same directory (excluding the target node)
    return flattenTree(treeNodes)
      .filter((n) => getDirname(n.path) === dir && n.path !== node.path)
      .map((n) => n.name)
  }, [treeNodes])

  // Build context menu items based on node type
  const getContextMenuItems = useCallback((node: TreeNode): ContextMenuItem[] => {
    const items: ContextMenuItem[] = []

    // Directories get Delete and Reveal in Explorer
    if (node.isDirectory) {
      items.push({
        label: 'Delete',
        icon: Trash2,
        onClick: () => setDeleteTarget({ node }),
        danger: true,
      })
      items.push({
        label: 'Reveal in Explorer',
        icon: FolderOpen,
        onClick: () => handleRevealInExplorer(node),
      })
      return items
    }

    // Don't show context menu for suggestion drafts
    if (node.isSuggestion) {
      return items
    }

    // Files and entities get Rename, Delete, Reveal
    items.push({
      label: 'Rename',
      icon: Edit3,
      onClick: () => setRenameTarget({ node }),
    })

    items.push({
      label: 'Delete',
      icon: Trash2,
      onClick: () => setDeleteTarget({ node }),
      danger: true,
    })

    items.push({
      label: 'Reveal in Explorer',
      icon: FolderOpen,
      onClick: () => handleRevealInExplorer(node),
    })

    return items
  }, [handleRevealInExplorer])

  // Build context menu items for entity tab members
  const getTabContextMenuItems = useCallback((member: EntityMember): ContextMenuItem[] => {
    const items: ContextMenuItem[] = []

    items.push({
      label: 'Rename',
      icon: Edit3,
      onClick: () => setRenameTarget({ member }),
    })

    items.push({
      label: 'Delete',
      icon: Trash2,
      onClick: () => setDeleteTarget({ member }),
      danger: true,
    })

    return items
  }, [])

  // Tab context menu handler
  const handleTabContextMenu = useCallback((e: React.MouseEvent, member: EntityMember) => {
    setContextMenu({ x: e.clientX, y: e.clientY, member })
  }, [])

  // Create new note handler
  const handleCreateNote = async (name: string, parentPath: string | null, childrenPaths: string[]) => {
    if (!folderPath) return

    // Determine the directory where the file should be created
    let targetDir = folderPath

    if (parentPath) {
      const parentNode = findNodeByPath(treeNodes, parentPath)
      if (parentNode) {
        if (parentNode.isDirectory) {
          targetDir = parentNode.path
        } else if (parentNode.hasSidecar) {
          // For sidecar files, the children go in the folder with same base name
          targetDir = `${getDirname(parentNode.path)}/${stripExtension(parentNode.name)}`
        }
      }
    }

    // Create the new file path
    const newFilePath = `${targetDir}/${name}`

    // Create empty markdown file
    const result = await window.electronAPI.writeFile(newFilePath, `# ${stripExtension(name)}\n\n`)
    if (!result.success) {
      setError(`Failed to create note: ${result.error}`)
      return
    }

    // Move selected children to become children of this new note
    if (childrenPaths.length > 0) {
      const sidecarDir = `${targetDir}/${stripExtension(name)}`

      // Create the sidecar folder
      const mkdirResult = await window.electronAPI.mkdir(sidecarDir)
      if (!mkdirResult.success) {
        setError(`Failed to create folder: ${mkdirResult.error}`)
        return
      }

      // Move each selected child into the sidecar folder
      for (const childPath of childrenPaths) {
        const childNode = findNodeByPath(treeNodes, childPath)

        if (childNode?.entity) {
          await moveEntityWithSidecar(childNode, sidecarDir)
        } else if (childNode?.hasSidecar && childNode.children) {
          await moveFileWithSidecar(childNode, sidecarDir)
        } else if (childNode?.isDirectory) {
          // Move entire directory
          const dirName = getBasename(childPath)
          await moveItem(childPath, `${sidecarDir}/${dirName}`, dirName)
        } else {
          // Simple file move
          const childName = getBasename(childPath)
          await moveItem(childPath, `${sidecarDir}/${childName}`, childName)
        }
      }
    }

    // Refresh tree (watcher should handle this, but force refresh to be safe)
    refreshTree()

    // Select the new file and open in edit mode
    // We need to wait for the tree to refresh first
    setTimeout(async () => {
      try {
        const newNodes = await buildFileTree(folderPath, window.electronAPI.readDirectory, {
          showClaudeMd,
          readOrder: window.electronAPI.readOrder,
        })
        // Try exact match first, then normalized (Windows vs Unix paths)
        const [path1, path2] = normalizePath(newFilePath)
        const newNode = findNodeByPath(newNodes, path1) ?? findNodeByPath(newNodes, path2)

        if (newNode) {
          setSelectedNode(newNode)
          setActiveMember(null)
          setEditMode('visual')
        }
      } catch (err) {
        console.error('Failed to refresh tree after note creation:', err)
      }
    }, TREE_REFRESH_DELAY_MS)
  }

  // Determine if mode toggle should show (markdown content is active)
  const isMarkdownActive = activeMember?.type === 'markdown' ||
    (selectedNode && (isMarkdownFile(selectedNode.name) || selectedNode.isSuggestion) && !selectedNode.entity)

  // Get file info for standalone files
  const getSelectedFileInfo = () => {
    if (!selectedNode || selectedNode.entity) return { fileName: undefined, fileType: undefined }

    if (isMarkdownFile(selectedNode.name)) {
      return { fileName: stripExtension(selectedNode.name), fileType: 'markdown' }
    }
    if (isPdfFile(selectedNode.name)) {
      return { fileName: stripExtension(selectedNode.name), fileType: 'pdf' }
    }
    return { fileName: selectedNode.name, fileType: 'other' }
  }

  const { fileName: selectedFileName, fileType: selectedFileType } = getSelectedFileInfo()

  // Handle tree reordering
  const handleTreeReorder = useCallback(async (parentPath: string, newOrder: string[]) => {
    if (!folderPath) return

    const result = await window.electronAPI.writeOrder(parentPath, newOrder)
    if (!result.success) {
      setError(`Failed to save order: ${result.error}`)
    }

    // Refresh tree to reflect new order
    refreshTree()
  }, [folderPath, refreshTree])

  // Handle tree node move (cross-directory)
  const handleTreeMove = useCallback(async (node: TreeNode, targetPath: string) => {
    if (!folderPath) return

    // Determine target directory
    let targetDir = targetPath
    const targetNode = findNodeByPath(treeNodes, targetPath)

    if (targetNode) {
      if (targetNode.isDirectory) {
        // Target is a directory - use it directly
        targetDir = targetNode.path
      } else if (targetNode.hasSidecar) {
        // Target is a file with sidecar - use the sidecar directory
        const baseName = stripExtension(targetNode.name)
        targetDir = `${getDirname(targetNode.path)}/${baseName}`
      } else {
        // Invalid target
        setError('Invalid drop target')
        return
      }
    }

    // Move entity (all members + sidecar)
    if (node.entity) {
      const success = await moveEntityWithSidecar(node, targetDir)
      if (!success) return
    }
    // Move file with sidecar
    else if (node.hasSidecar && node.children) {
      const success = await moveFileWithSidecar(node, targetDir)
      if (!success) return
    }
    // Move directory
    else if (node.isDirectory) {
      const dirName = getBasename(node.path)
      const success = await moveItem(node.path, `${targetDir}/${dirName}`, dirName)
      if (!success) return
    }
    // Move simple file
    else {
      const fileName = getBasename(node.path)
      const success = await moveItem(node.path, `${targetDir}/${fileName}`, fileName)
      if (!success) return
    }

    // Clear selection if moved node was selected
    if (selectedNode?.path === node.path) {
      setSelectedNode(null)
      setActiveMember(null)
      setFileContent(null)
    }

    // Refresh tree
    refreshTree()
  }, [folderPath, treeNodes, selectedNode, refreshTree, moveItem, moveEntityWithSidecar, moveFileWithSidecar])

  // Handle creating new entity member
  const handleCreateMember = async () => {
    if (!selectedNode || !folderPath) return

    // Prompt for variant name
    const variantName = prompt('Enter variant name (e.g., "summary", "notes"):')
    if (!variantName) return

    const baseName = selectedNode.entity?.baseName ?? stripMultipleExtensions(selectedNode.name, '.pdf', '.md')
    const dirPath = getDirname(selectedNode.path)
    const newFilePath = `${dirPath}/${baseName}.${variantName}.md`

    // Create the new file
    const result = await window.electronAPI.writeFile(newFilePath, `# ${baseName} - ${variantName}\n\n`)
    if (!result.success) {
      setError(`Failed to create variant: ${result.error}`)
      return
    }

    // Refresh tree and select the new file
    setTimeout(() => {
      refreshTree()
    }, TREE_REFRESH_DELAY_MS)
  }

  // Render markdown content (viewer or editor) - shared between entity and standalone
  const renderMarkdownContent = (filePath: string) => {
    if (editMode === 'view') {
      return <MarkdownViewer content={fileContent!} />
    }
    return (
      <MarkdownEditor
        ref={editorRef}
        content={editContent ?? fileContent!}
        filePath={filePath}
        mode={editMode}
        onModeChange={setEditMode}
        onContentChange={handleEditContentChange}
        showToolbar={false}
        onSelectionChange={handleEditorSelectionChange}
      />
    )
  }

  return (
    <div className="app">
      <main className="main">
        {sidebarVisible && (
          <aside className="sidebar" style={{ width: sidebarWidth }}>
            {folderPath && (
              <SidebarSearch
                value={searchQuery}
                onChange={setSearchQuery}
              />
            )}
            <div className="sidebar-tree">
              {folderPath ? (
                <TreeView
                  nodes={filteredTreeNodes}
                  selectedPath={selectedNode?.path ?? null}
                  onSelect={handleSelectNode}
                  summarizingPaths={summarizingPaths}
                  onContextMenu={handleTreeContextMenu}
                  onReorder={handleTreeReorder}
                  onMove={handleTreeMove}
                  folderPath={folderPath}
                />
              ) : (
                <p className="placeholder">No folder opened</p>
              )}
            </div>
            <SidebarToolbar
              onNewNote={() => setShowNewNoteModal(true)}
              onOpenFolder={handleOpenInExplorer}
              onOpenOptions={() => setShowOptionsModal(true)}
            />
            <div
              className="sidebar-resize-handle"
              onMouseDown={handleSidebarMouseDown}
            />
          </aside>
        )}
        <section className="content">
          <TopToolbar
            entity={selectedNode?.entity}
            activeMember={activeMember ?? undefined}
            onTabChange={handleTabChange}
            selectedFileName={selectedFileName}
            selectedFileType={selectedFileType}
            onTabContextMenu={handleTabContextMenu}
            editMode={editMode}
            onEditModeChange={setEditMode}
            editorRef={editorRef}
            activeFormats={activeFormats}
            showModeToggle={!!isMarkdownActive}
            isEditing={isEditing}
            canSummarize={!!canSummarize}
            isSummarizing={summarizingPaths.size > 0}
            onSummarizeClick={() => setShowSummarizeModal(true)}
            activePane={activePane}
            onPaneToggle={handlePaneToggle}
            suggestionType={selectedNode?.isSuggestion}
            onAcceptSuggestion={handleAcceptSuggestion}
            onDiscardSuggestion={handleDiscardSuggestion}
            sidebarVisible={sidebarVisible}
            onSidebarToggle={() => setSidebarVisible((v) => !v)}
            onCreateMember={handleCreateMember}
          />
          <div className="content-body-wrapper">
            <div className="content-body">
              {error ? (
                <p className="error-message">{error}</p>
              ) : selectedNode?.entity && activeMember ? (
                activeMember.type === 'pdf' ? (
                  <PdfViewer filePath={activeMember.path} />
                ) : activeMember.type === 'video' || activeMember.type === 'audio' ? (
                  <MediaViewer filePath={activeMember.path} />
                ) : fileContent !== null ? (
                  renderMarkdownContent(activeMember.path)
                ) : (
                  <div className="placeholder">Loading...</div>
                )
              ) : isStandalonePdf ? (
                <PdfViewer filePath={selectedNode!.path} />
              ) : isStandaloneMedia ? (
                <MediaViewer filePath={selectedNode!.path} />
              ) : fileContent !== null && selectedNode ? (
                renderMarkdownContent(selectedNode.path)
              ) : null}
            </div>
            <aside
              className="agent-sidebar"
              style={{ width: agentPanelWidth, display: activePane ? 'flex' : 'none' }}
            >
              <div
                className="agent-sidebar-resize-handle"
                onMouseDown={handleAgentPanelMouseDown}
              />
              <AgentPanel
                workingDir={folderPath}
                currentFilePath={activeFilePath}
                onClose={() => setActivePane(null)}
                style={{ display: activePane === 'agent' ? 'flex' : 'none' }}
              />
              <TodoPanel
                workingDir={folderPath}
                style={{ display: activePane === 'todos' ? 'flex' : 'none' }}
              />
              <EventPanel
                workingDir={folderPath}
                style={{ display: activePane === 'events' ? 'flex' : 'none' }}
              />
            </aside>
          </div>
        </section>
      </main>
      <SummarizeModal
        isOpen={showSummarizeModal}
        onClose={() => setShowSummarizeModal(false)}
        onSubmit={handleSummarize}
        entityBaseName={summarizeBaseName}
        existingVariants={existingVariants}
      />
      <OptionsModal
        isOpen={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        currentFolderPath={folderPath}
        onFolderChange={handleFolderChange}
        showClaudeMd={showClaudeMd}
        onShowClaudeMdChange={(show) => {
          setShowClaudeMd(show)
          window.electronAPI.setShowClaudeMd(show).catch((err) => {
            console.error('Failed to save showClaudeMd setting:', err)
          })
        }}
      />
      <NewNoteModal
        isOpen={showNewNoteModal}
        onClose={() => setShowNewNoteModal(false)}
        onSubmit={handleCreateNote}
        treeNodes={treeNodes}
        selectedNode={selectedNode}
      />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.node ? getContextMenuItems(contextMenu.node) : contextMenu.member ? getTabContextMenuItems(contextMenu.member) : []}
          onClose={handleCloseContextMenu}
        />
      )}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        node={deleteTarget?.node}
        member={deleteTarget?.member}
      />
      <RenameModal
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRenameSubmit}
        node={renameTarget?.node}
        member={renameTarget?.member}
        entity={renameTarget?.node?.entity ?? selectedNode?.entity}
        existingNames={renameTarget?.node ? getSiblingNames(renameTarget.node) : []}
      />
    </div>
  )
}

export default App
