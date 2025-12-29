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
import { ContextMenu, ContextMenuItem } from './components/ContextMenu'
import { DeleteConfirmModal } from './components/DeleteConfirmModal'
import { RenameModal } from './components/RenameModal'
import { NewMemberModal } from './components/NewMemberModal'
import { SidebarSearch } from './components/SidebarSearch'
import { ContentSearchResults } from './components/ContentSearchResults'
import { useAutoSave } from './hooks/useAutoSave'
import { useHorizontalResize } from './hooks/useHorizontalResize'
import { defaultFormats } from './components/editorTypes'
import { buildFileTree, BuildFileTreeOptions } from '@shared/fileTree'
import { getBasename, getDirname, getExtension, stripExtension, normalizePath } from '@shared/pathUtils'
import { isMarkdownFile, isPdfFile, isMediaFile, isStructureChange, MARKERDOWN_DIR } from '@shared/types'
import type { TreeNode, FileChangeEvent, EntityMember, EditMode, SearchResult } from '@shared/types'
import { Edit3, Trash2, FolderOpen, FilePlus } from 'lucide-react'

const DEFAULT_AGENT_PANEL_WIDTH = 400
const DEFAULT_SIDEBAR_WIDTH = 280
const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 500

// Find a node by path in the tree (path-separator agnostic)
function findNodeByPath(nodes: TreeNode[], targetPath: string): TreeNode | null {
  const normalizedTarget = normalizePath(targetPath)
  for (const node of nodes) {
    if (normalizePath(node.path) === normalizedTarget) return node
    if (node.children) {
      const found = findNodeByPath(node.children, targetPath)
      if (found) return found
    }
  }
  return null
}
const MIN_AGENT_PANEL_WIDTH = 250
const MAX_AGENT_PANEL_WIDTH = 800
const SAVE_IN_PROGRESS_DELAY_MS = 500
const TREE_REFRESH_DELAY_MS = 100
const SCROLL_RESTORE_DELAY_MS = 50
const CONTENT_SEARCH_DEBOUNCE_MS = 300

// Persist scroll positions across tab switches (session only)
const scrollPositions = new Map<string, number>()

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [activeMember, setActiveMember] = useState<EntityMember | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSummarizeModal, setShowSummarizeModal] = useState(false)
  const [showOptionsModal, setShowOptionsModal] = useState(false)
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
  // For member rename, store the new member path to set as active after refresh
  const [pendingMemberPath, setPendingMemberPath] = useState<string | null>(null)

  // New member modal state
  const [showNewMemberModal, setShowNewMemberModal] = useState(false)

  // Right pane state (agent/todos/events)
  const [activePane, setActivePane] = useState<PaneType | null>(null)
  const [agentPanelWidth, setAgentPanelWidth] = useState(DEFAULT_AGENT_PANEL_WIDTH)

  // Left sidebar state
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'name' | 'content'>('name')
  const [contentSearchResults, setContentSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

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

  // Content search effect
  useEffect(() => {
    if (searchMode !== 'content' || !folderPath || !searchQuery.trim()) {
      setContentSearchResults([])
      return
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await window.electronAPI.searchContent(folderPath, searchQuery)
        setContentSearchResults(results)
      } catch (err) {
        console.error('Search failed:', err)
        setContentSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, CONTENT_SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(searchTimeout)
  }, [searchMode, folderPath, searchQuery])

  // Handle content search result click - navigate to file
  const handleSearchResultClick = useCallback((filePath: string, _lineNumber: number) => {
    const node = findNodeByPath(treeNodes, filePath)
    if (!node) return

    // Expand parent directories by walking up the path
    const pathsToExpand: string[] = []
    let parentPath = getDirname(filePath)
    while (parentPath && parentPath !== filePath) {
      const parentNode = findNodeByPath(treeNodes, parentPath)
      if (parentNode?.isDirectory) {
        pathsToExpand.push(parentNode.path)
      }
      const nextParent = getDirname(parentPath)
      if (nextParent === parentPath) break // Reached root
      parentPath = nextParent
    }

    if (pathsToExpand.length > 0) {
      setExpandedPaths((prev) => {
        const next = new Set(prev)
        for (const p of pathsToExpand) {
          next.add(p)
        }
        return next
      })
    }

    // Select the node
    setSelectedNode(node)
    if (node.entity) {
      const defaultMember = node.entity.defaultMember ?? node.entity.members[0]
      setActiveMember(defaultMember)
    } else {
      setActiveMember(null)
    }

    // Update window title
    const filename = node.entity?.baseName || getBasename(node.path)
    window.electronAPI.setWindowTitle(`${filename} - Markerdown`).catch(console.error)
  }, [treeNodes])

  // Editor state
  const [editMode, setEditMode] = useState<EditMode>('view')
  const [editContent, setEditContent] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const saveInProgressRef = useRef<Set<string>>(new Set())
  const editorRef = useRef<MarkdownEditorRef>(null)
  const contentBodyRef = useRef<HTMLDivElement>(null)
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
    window.electronAPI.getExpandedPaths().then((paths) => {
      if (paths.length > 0) {
        setExpandedPaths(new Set(paths))
      }
    }).catch((err) => {
      console.error('Failed to load expanded paths:', err)
    })
  }, [])

  // Save expanded paths when they change
  useEffect(() => {
    window.electronAPI.setExpandedPaths([...expandedPaths]).catch((err) => {
      console.error('Failed to save expanded paths:', err)
    })
  }, [expandedPaths])

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
      const treeOptions: BuildFileTreeOptions = { showClaudeMd }
      const nodes = await buildFileTree(folderPath, window.electronAPI.readDirectory, treeOptions)

      // Check for suggestion draft files and inject them at the top
      const suggestionNodes: TreeNode[] = []
      const sep = folderPath.includes('\\') ? '\\' : '/'
      const todosDraftPath = `${folderPath}${sep}${MARKERDOWN_DIR}${sep}todos-draft.md`
      const eventsDraftPath = `${folderPath}${sep}${MARKERDOWN_DIR}${sep}events-draft.md`

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

    // Find the node with the new path (findNodeByPath is path-separator agnostic)
    const node = findNodeByPath(treeNodes, pendingSelectionPath)

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
          }).catch((err) => {
            console.error('Failed to read file after rename:', err)
          })
        }
      }
      // Clear pending selection only after successfully finding the node
      setPendingSelectionPath(null)
    }
  }, [treeNodes, pendingSelectionPath])

  // Handle pending member selection after member rename
  useEffect(() => {
    if (!pendingMemberPath || treeNodes.length === 0) return

    const normalizedPendingPath = normalizePath(pendingMemberPath)

    // Find the entity node that contains the renamed member
    const findEntityWithMember = (nodes: TreeNode[]): { node: TreeNode; member: EntityMember } | null => {
      for (const node of nodes) {
        if (node.entity) {
          const member = node.entity.members.find((m) => normalizePath(m.path) === normalizedPendingPath)
          if (member) {
            return { node, member }
          }
        }
        if (node.children) {
          const found = findEntityWithMember(node.children)
          if (found) return found
        }
      }
      return null
    }

    const result = findEntityWithMember(treeNodes)
    if (result) {
      setSelectedNode(result.node)
      setActiveMember(result.member)
      // Load file content for the member
      if (result.member.type === 'markdown') {
        window.electronAPI.readFile(result.member.path).then((content) => {
          if (content !== null) setFileContent(content)
        }).catch((err) => {
          console.error('Failed to read file after member rename:', err)
        })
      }
      setPendingMemberPath(null)
    }
  }, [treeNodes, pendingMemberPath])

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
      const isDraftFile = event.path.includes(MARKERDOWN_DIR) &&
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

  // Save scroll position when switching away from a file
  useEffect(() => {
    const container = contentBodyRef.current
    const filePath = activeFilePath
    return () => {
      // Save on cleanup (before file changes)
      if (container && filePath) {
        scrollPositions.set(filePath, container.scrollTop)
      }
    }
  }, [activeFilePath])

  // Restore scroll position after content loads
  useEffect(() => {
    if (!activeFilePath || fileContent === null) return
    const container = contentBodyRef.current
    if (!container) return

    const savedPosition = scrollPositions.get(activeFilePath)
    if (savedPosition !== undefined) {
      const timer = setTimeout(() => {
        if (contentBodyRef.current) {
          contentBodyRef.current.scrollTop = savedPosition
        }
      }, SCROLL_RESTORE_DELAY_MS)
      return () => clearTimeout(timer)
    }
  }, [activeFilePath, fileContent])

  // Track scroll position as user scrolls
  useEffect(() => {
    const container = contentBodyRef.current
    if (!container || !activeFilePath) return

    const handleScroll = () => {
      scrollPositions.set(activeFilePath, container.scrollTop)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [activeFilePath])

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
    const sep = folderPath.includes('\\') ? '\\' : '/'
    const mainFilePath = `${folderPath}${sep}${MARKERDOWN_DIR}${sep}${suggestionType}.md`

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
      const markerdownDir = `${folderPath}${sep}${MARKERDOWN_DIR}`
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

  const stripPdfExtension = (filename: string) =>
    filename.toLowerCase().endsWith('.pdf') ? stripExtension(filename) : filename

  const stripMdExtension = (filename: string) =>
    filename.toLowerCase().endsWith('.md') ? stripExtension(filename) : filename

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
    ?? (selectedNode ? stripMdExtension(stripPdfExtension(selectedNode.name)) : '')

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

  const handleToggleExpand = useCallback((path: string) => {
    const normalized = normalizePath(path)
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(normalized)) {
        next.delete(normalized)
      } else {
        next.add(normalized)
      }
      return next
    })
  }, [])

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
        // If we deleted the active member, switch to the default member of the entity
        if (activeMember?.path === deleteTarget.member.path && selectedNode?.entity) {
          const remainingMembers = selectedNode.entity.members.filter(
            (m) => m.path !== deleteTarget.member!.path
          )
          if (remainingMembers.length > 0) {
            // Find default member or use first remaining
            const defaultMember = remainingMembers.find((m) => m.type === 'markdown' && m.variant === null)
              ?? remainingMembers[0]
            // Set pending to re-select after tree refresh
            setPendingMemberPath(defaultMember.path)
          } else {
            // No members left, clear selection
            setActiveMember(null)
            setSelectedNode(null)
            setFileContent(null)
          }
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

    // Helper to rename sidecar folder if it exists
    const renameSidecarIfExists = async (node: TreeNode, dir: string, newName: string) => {
      if (node.hasSidecar && node.sidecarName) {
        const oldSidecarPath = `${dir}/${node.sidecarName}`
        const newSidecarPath = `${dir}/${newName}`
        const result = await window.electronAPI.move(oldSidecarPath, newSidecarPath)
        if (!result.success) {
          setError(`Failed to rename folder: ${result.error}`)
        }
      }
    }

    try {
      // Renaming a specific entity member suffix
      if (renameTarget.member && selectedNode?.entity) {
        const member = renameTarget.member
        const entity = selectedNode.entity
        const dir = getDirname(member.path)
        const ext = getExtension(member.path)
        const newFileName = newName ? `${entity.baseName}.${newName}${ext}` : `${entity.baseName}${ext}`
        const newPath = `${dir}/${newFileName}`

        const result = await window.electronAPI.move(member.path, newPath)
        if (!result.success) {
          setError(`Failed to rename: ${result.error}`)
        } else {
          // Track the new member path to set as active after tree refresh
          setPendingMemberPath(newPath)
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
            const ext = getExtension(member.path)
            const variant = member.variant
            const newFileName = variant ? `${newName}.${variant}${ext}` : `${newName}${ext}`
            const newPath = `${dir}/${newFileName}`

            const result = await window.electronAPI.move(member.path, newPath)
            if (!result.success) {
              setError(`Failed to rename ${oldName}: ${result.error}`)
            }
          }

          // Rename sidecar folder if it exists
          await renameSidecarIfExists(node, dir, newName)

          // New entity path uses the default member's new path
          const defaultMember = node.entity.defaultMember ?? node.entity.members[0]
          const ext = getExtension(defaultMember.path)
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
            // Rename sidecar folder if it exists (only if file rename succeeded)
            await renameSidecarIfExists(node, dir, newName)
          }
        }
      }

      // Store pending selection to re-select after tree refresh
      if (newSelectionPath) {
        setPendingSelectionPath(newSelectionPath)
      }

      // Preserve expansion state: if old path was expanded, expand the new path
      if (renameTarget.node && newSelectionPath) {
        const oldPath = normalizePath(renameTarget.node.path)
        const newPath = normalizePath(newSelectionPath)
        setExpandedPaths((prev) => {
          if (prev.has(oldPath)) {
            const next = new Set(prev)
            next.delete(oldPath)
            next.add(newPath)
            return next
          }
          return prev
        })
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

    // Flatten all nodes in tree
    const flattenNodes = (nodes: TreeNode[]): TreeNode[] => {
      const result: TreeNode[] = []
      for (const n of nodes) {
        result.push(n)
        if (n.children) {
          result.push(...flattenNodes(n.children))
        }
      }
      return result
    }

    // Find all nodes in the same directory (excluding the target node)
    return flattenNodes(treeNodes)
      .filter((n) => getDirname(n.path) === dir && n.path !== node.path)
      .map((n) => n.name)
  }, [treeNodes])

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
  const handleCreateNote = useCallback(async (name: string, parentPath: string | null, childrenPaths: string[]) => {
    if (!folderPath) return

    // Helper to move a file/folder and report errors
    const moveItem = async (sourcePath: string, destPath: string, displayName: string) => {
      const result = await window.electronAPI.move(sourcePath, destPath)
      if (!result.success) {
        setError(`Failed to move ${displayName}: ${result.error}`)
      }
    }

    // Determine the directory where the file should be created
    let targetDir = folderPath

    if (parentPath) {
      const parentNode = findNodeByPath(treeNodes, parentPath)
      if (parentNode) {
        if (parentNode.isDirectory) {
          targetDir = parentNode.path
        } else if (parentNode.hasSidecar && parentNode.sidecarName) {
          // For files with existing sidecars, use the sidecar folder
          targetDir = `${getDirname(parentNode.path)}/${parentNode.sidecarName}`
        } else {
          // For files without sidecars, create a sidecar folder
          const parentDir = getDirname(parentNode.path)
          const parentBaseName = stripExtension(getBasename(parentNode.path))
          targetDir = `${parentDir}/${parentBaseName}`
          // Create the sidecar folder
          const mkdirResult = await window.electronAPI.mkdir(targetDir)
          if (!mkdirResult.success) {
            setError(`Failed to create folder: ${mkdirResult.error}`)
            return
          }
        }
      }
    }

    // Create the new file path
    const newFilePath = `${targetDir}/${name}`

    // Create empty markdown file
    const result = await window.electronAPI.writeFile(newFilePath, `# ${stripMdExtension(name)}\n\n`)
    if (!result.success) {
      setError(`Failed to create note: ${result.error}`)
      return
    }

    // Move selected children to become children of this new note
    if (childrenPaths.length > 0) {
      const sidecarDir = `${targetDir}/${stripMdExtension(name)}`

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
          // Move all entity members
          for (const member of childNode.entity.members) {
            const memberName = getBasename(member.path)
            await moveItem(member.path, `${sidecarDir}/${memberName}`, memberName)
          }
          // Also move entity's sidecar folder if it has children
          if (childNode.hasSidecar && childNode.sidecarName && childNode.children) {
            const sidecarName = childNode.sidecarName
            const entitySidecarPath = `${getDirname(childNode.path)}/${sidecarName}`
            await moveItem(entitySidecarPath, `${sidecarDir}/${sidecarName}`, `folder ${sidecarName}`)
          }
        } else if (childNode?.hasSidecar && childNode.sidecarName && childNode.children) {
          // Move markdown file with sidecar
          const childName = getBasename(childPath)
          const sidecarName = childNode.sidecarName
          const childDir = getDirname(childPath)

          await moveItem(childPath, `${sidecarDir}/${childName}`, childName)
          await moveItem(`${childDir}/${sidecarName}`, `${sidecarDir}/${sidecarName}`, `folder ${sidecarName}`)
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

    // Expand the parent so the new note is visible
    if (parentPath) {
      setExpandedPaths((prev) => {
        const next = new Set(prev)
        next.add(normalizePath(parentPath))
        return next
      })
    }

    // Refresh tree (watcher should handle this, but force refresh to be safe)
    refreshTree()

    // Select the new file and open in edit mode
    // We need to wait for the tree to refresh first
    setTimeout(async () => {
      try {
        const newNodes = await buildFileTree(folderPath, window.electronAPI.readDirectory, { showClaudeMd })
        // Try exact match first, then normalized (Windows vs Unix paths)
        const newNode = findNodeByPath(newNodes, newFilePath) ??
          findNodeByPath(newNodes, newFilePath.replace(/\//g, '\\'))

        if (newNode) {
          setSelectedNode(newNode)
          setActiveMember(null)
          setEditMode('visual')
        }
      } catch (err) {
        console.error('Failed to refresh tree after note creation:', err)
      }
    }, TREE_REFRESH_DELAY_MS)
  }, [folderPath, treeNodes, showClaudeMd, refreshTree])

  // Open new note dialog helper (avoids duplicating the openNewNote + handleCreateNote pattern)
  const openNewNoteDialog = useCallback(async (selectedPath: string | null) => {
    const result = await window.electronAPI.openNewNote(treeNodes, selectedPath)
    if (result) {
      handleCreateNote(result.name, result.parentPath, result.childrenPaths)
    }
  }, [treeNodes, handleCreateNote])

  // Build context menu items based on node type
  const getContextMenuItems = useCallback((node: TreeNode): ContextMenuItem[] => {
    const items: ContextMenuItem[] = []

    const newChildNoteItem: ContextMenuItem = {
      label: 'New Child Note',
      icon: FilePlus,
      onClick: () => {
        setContextMenu(null)
        openNewNoteDialog(node.path)
      },
    }

    // Directories get New Child Note, Delete and Reveal in Explorer
    if (node.isDirectory) {
      items.push(newChildNoteItem)
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

    // Files and entities get New Child Note, Rename, Delete, Reveal
    items.push(newChildNoteItem)

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
  }, [handleRevealInExplorer, openNewNoteDialog])

  // Determine if mode toggle should show (markdown content is active)
  const isMarkdownActive = activeMember?.type === 'markdown' ||
    (selectedNode && (isMarkdownFile(selectedNode.name) || selectedNode.isSuggestion) && !selectedNode.entity)

  // Get file info for standalone files
  const getSelectedFileInfo = () => {
    if (!selectedNode || selectedNode.entity) return { fileName: undefined, fileType: undefined }

    if (isMarkdownFile(selectedNode.name)) {
      return { fileName: stripMdExtension(selectedNode.name), fileType: 'markdown' }
    }
    if (isPdfFile(selectedNode.name)) {
      return { fileName: stripPdfExtension(selectedNode.name), fileType: 'pdf' }
    }
    return { fileName: selectedNode.name, fileType: 'other' }
  }

  const { fileName: selectedFileName, fileType: selectedFileType } = getSelectedFileInfo()

  // Handle creating new entity member
  const handleCreateMember = () => {
    if (!selectedNode || !folderPath) return
    setShowNewMemberModal(true)
  }

  // Handle new member modal submit
  const handleNewMemberSubmit = async (variantName: string) => {
    if (!selectedNode || !folderPath) return

    const baseName = selectedNode.entity?.baseName ?? stripMdExtension(stripPdfExtension(selectedNode.name))
    const dirPath = getDirname(selectedNode.path)
    const newFilePath = `${dirPath}/${baseName}.${variantName}.md`

    // Create the new file
    const result = await window.electronAPI.writeFile(newFilePath, `# ${baseName} - ${variantName}\n\n`)
    if (!result.success) {
      setError(`Failed to create variant: ${result.error}`)
      return
    }

    // Set pending member path to select the new member after tree refresh
    setPendingMemberPath(newFilePath)
    refreshTree()
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
              <>
                <SidebarSearch
                  value={searchQuery}
                  onChange={setSearchQuery}
                />
                <div className="search-mode-toggle">
                  <button
                    className={`search-mode-btn ${searchMode === 'name' ? 'active' : ''}`}
                    onClick={() => setSearchMode('name')}
                  >
                    Names
                  </button>
                  <button
                    className={`search-mode-btn ${searchMode === 'content' ? 'active' : ''}`}
                    onClick={() => setSearchMode('content')}
                  >
                    Content
                  </button>
                </div>
              </>
            )}
            {searchMode === 'content' && folderPath && searchQuery.trim() ? (
              <ContentSearchResults
                results={contentSearchResults}
                query={searchQuery}
                isSearching={isSearching}
                onResultClick={handleSearchResultClick}
              />
            ) : (
              <div className="sidebar-tree">
                {folderPath ? (
                  <TreeView
                    nodes={filteredTreeNodes}
                    selectedPath={selectedNode?.path ?? null}
                    expandedPaths={expandedPaths}
                    onSelect={handleSelectNode}
                    onToggleExpand={handleToggleExpand}
                    summarizingPaths={summarizingPaths}
                    onContextMenu={handleTreeContextMenu}
                  />
                ) : (
                  <p className="placeholder">No folder opened</p>
                )}
              </div>
            )}
            <SidebarToolbar
              onNewNote={() => openNewNoteDialog(selectedNode?.path ?? null)}
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
            <div className="content-body" ref={contentBodyRef}>
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
      <NewMemberModal
        isOpen={showNewMemberModal}
        onClose={() => setShowNewMemberModal(false)}
        onSubmit={handleNewMemberSubmit}
        baseName={summarizeBaseName}
        existingVariants={existingVariants}
      />
    </div>
  )
}

export default App
