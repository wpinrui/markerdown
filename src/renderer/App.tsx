import { useState, useEffect, useCallback, useRef } from 'react'
import { TreeView } from './components/TreeView'
import { MarkdownViewer } from './components/MarkdownViewer'
import { MarkdownEditor, MarkdownEditorRef, ActiveFormats } from './components/MarkdownEditor'
import { PdfViewer } from './components/PdfViewer'
import { SummarizeModal } from './components/SummarizeModal'
import { AgentPanel } from './components/AgentPanel'
import { TodoPanel } from './components/TodoPanel'
import { EventPanel } from './components/EventPanel'
import { OptionsModal } from './components/OptionsModal'
import { TopToolbar, PaneType } from './components/TopToolbar'
import { SidebarToolbar } from './components/SidebarToolbar'
import { NewNoteModal } from './components/NewNoteModal'
import { useAutoSave } from './hooks/useAutoSave'
import { defaultFormats } from './components/editorTypes'
import { buildFileTree, BuildFileTreeOptions } from '@shared/fileTree'
import { isMarkdownFile, isPdfFile, isStructureChange } from '@shared/types'
import type { TreeNode, FileChangeEvent, EntityMember, EditMode } from '@shared/types'

const DEFAULT_AGENT_PANEL_WIDTH = 400
const DEFAULT_SIDEBAR_WIDTH = 280
const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 500

// Extract filename from path (handles both / and \ separators)
function getBasename(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return filePath.substring(lastSlash + 1)
}

// Extract directory from path (handles both / and \ separators)
function getDirname(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return filePath.substring(0, lastSlash)
}

// Find a node by path in the tree
function findNodeByPath(nodes: TreeNode[], targetPath: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node
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

  // Right pane state (agent/todos/events)
  const [activePane, setActivePane] = useState<PaneType | null>(null)
  const [agentPanelWidth, setAgentPanelWidth] = useState(DEFAULT_AGENT_PANEL_WIDTH)
  const isDraggingAgentPanel = useRef(false)

  // Left sidebar state
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const isDraggingSidebar = useRef(false)

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
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeMember, selectedNode, handlePaneToggle])

  // Agent panel resize handler (drag from left edge)
  const handleAgentPanelMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingAgentPanel.current = true
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingAgentPanel.current) return
      const newWidth = Math.min(
        MAX_AGENT_PANEL_WIDTH,
        Math.max(MIN_AGENT_PANEL_WIDTH, window.innerWidth - e.clientX)
      )
      setAgentPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      isDraggingAgentPanel.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  // Sidebar resize handler (drag from right edge)
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingSidebar.current = true
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current) return
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, e.clientX)
      )
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      isDraggingSidebar.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

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
  const canSummarize = isPdfActive || isStandalonePdf || isMdActive || isStandaloneMd

  const getOutputPath = (sourcePath: string, outputFilename: string) =>
    `${getDirname(sourcePath)}/${outputFilename}`

  const stripPdfExtension = (filename: string) =>
    filename.replace(/\.pdf$/i, '')

  const stripMdExtension = (filename: string) =>
    filename.replace(/\.md$/i, '')

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

  // Create new note handler
  const handleCreateNote = async (name: string, parentPath: string | null, childrenPaths: string[]) => {
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
        } else if (parentNode.hasSidecar) {
          // For sidecar files, the children go in the folder with same base name
          targetDir = `${getDirname(parentNode.path)}/${stripMdExtension(parentNode.name)}`
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
          if (childNode.hasSidecar && childNode.children) {
            const entityBaseName = childNode.entity.baseName
            const entitySidecarPath = `${getDirname(childNode.path)}/${entityBaseName}`
            await moveItem(entitySidecarPath, `${sidecarDir}/${entityBaseName}`, `folder ${entityBaseName}`)
          }
        } else if (childNode?.hasSidecar && childNode.children) {
          // Move markdown file with sidecar
          const childName = getBasename(childPath)
          const baseName = stripMdExtension(childName)
          const childDir = getDirname(childPath)

          await moveItem(childPath, `${sidecarDir}/${childName}`, childName)
          await moveItem(`${childDir}/${baseName}`, `${sidecarDir}/${baseName}`, `folder ${baseName}`)
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
  }

  // Determine if mode toggle should show (markdown content is active)
  const isMarkdownActive = activeMember?.type === 'markdown' ||
    (selectedNode && (isMarkdownFile(selectedNode.name) || selectedNode.isSuggestion) && !selectedNode.entity)

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
            <div className="sidebar-tree">
              {folderPath ? (
                <TreeView
                  nodes={treeNodes}
                  selectedPath={selectedNode?.path ?? null}
                  onSelect={handleSelectNode}
                  summarizingPaths={summarizingPaths}
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
          />
          <div className="content-body-wrapper">
            <div className="content-body">
              {error ? (
                <p className="error-message">{error}</p>
              ) : selectedNode?.entity && activeMember ? (
                activeMember.type === 'pdf' ? (
                  <PdfViewer filePath={activeMember.path} />
                ) : fileContent !== null ? (
                  renderMarkdownContent(activeMember.path)
                ) : (
                  <div className="placeholder">Loading...</div>
                )
              ) : isStandalonePdf ? (
                <PdfViewer filePath={selectedNode!.path} />
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
    </div>
  )
}

export default App
