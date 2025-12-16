import { useState, useEffect, useCallback, useRef } from 'react'
import { TreeView } from './components/TreeView'
import { MarkdownViewer } from './components/MarkdownViewer'
import { MarkdownEditor, MarkdownEditorRef, ActiveFormats } from './components/MarkdownEditor'
import { FormatToolbar } from './components/FormatToolbar'
import { ModeToggle } from './components/ModeToggle'
import { EntityViewer } from './components/EntityViewer'
import { PdfViewer } from './components/PdfViewer'
import { SummarizeModal } from './components/SummarizeModal'
import { SummarizeButton } from './components/SummarizeButton'
import { AgentPanel } from './components/AgentPanel'
import { useAutoSave } from './hooks/useAutoSave'
import { defaultFormats } from './components/editorTypes'
import { buildFileTree } from '@shared/fileTree'
import { isMarkdownFile, isPdfFile, isStructureChange } from '@shared/types'
import type { TreeNode, FileChangeEvent, EntityMember, EditMode } from '@shared/types'

const DEFAULT_AGENT_PANEL_WIDTH = 400
const MIN_AGENT_PANEL_WIDTH = 250
const MAX_AGENT_PANEL_WIDTH = 800
const SAVE_IN_PROGRESS_DELAY_MS = 500

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [activeMember, setActiveMember] = useState<EntityMember | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSummarizeModal, setShowSummarizeModal] = useState(false)
  const [summarizingPaths, setSummarizingPaths] = useState<Set<string>>(new Set())

  // Agent panel state
  const [showAgent, setShowAgent] = useState(false)
  const [agentPanelWidth, setAgentPanelWidth] = useState(DEFAULT_AGENT_PANEL_WIDTH)
  const isDraggingAgentPanel = useRef(false)

  // Editor state
  const [editMode, setEditMode] = useState<EditMode>('view')
  const [editContent, setEditContent] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const saveInProgressRef = useRef<Set<string>>(new Set())
  const standaloneEditorRef = useRef<MarkdownEditorRef>(null)
  const [standaloneActiveFormats, setStandaloneActiveFormats] = useState<ActiveFormats>(defaultFormats)

  const handleOpenFolder = async () => {
    const path = await window.electronAPI.openFolder()
    if (path) {
      setFolderPath(path)
      setSelectedNode(null)
      setActiveMember(null)
      setFileContent(null)
      setError(null)
      window.electronAPI.setLastFolder(path).catch((err) => {
        console.error('Failed to save last folder:', err)
      })
    }
  }

  // Load last folder on startup
  useEffect(() => {
    window.electronAPI.getLastFolder().then((path) => {
      if (path) setFolderPath(path)
    }).catch((err) => {
      console.error('Failed to load last folder:', err)
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Agent toggle: Ctrl+Shift+A
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setShowAgent((prev) => !prev)
      }
      // Edit mode toggle: Ctrl+E
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        const activeFilePath = activeMember?.path ?? selectedNode?.path
        const isMarkdown = activeMember?.type === 'markdown' || (selectedNode && isMarkdownFile(selectedNode.name))
        if (activeFilePath && isMarkdown) {
          setEditMode((prev) => (prev === 'view' ? 'visual' : 'view'))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeMember, selectedNode])

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

  // Handle selection change for standalone editor
  const handleStandaloneSelectionChange = useCallback((formats: ActiveFormats) => {
    setStandaloneActiveFormats(formats)
  }, [])

  const refreshTree = useCallback(() => {
    if (!folderPath) {
      setTreeNodes([])
      return
    }
    buildFileTree(folderPath, window.electronAPI.readDirectory)
      .then(setTreeNodes)
      .catch((err) => {
        console.error('Failed to build file tree:', err)
        setError('Failed to load folder contents')
      })
  }, [folderPath])

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
      if (isStructureChange(event.event)) {
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
    } else if (selectedNode && isMarkdownFile(selectedNode.name)) {
      // Regular markdown file
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

  const isPdfActive = activeMember?.type === 'pdf'
  const isStandalonePdf = selectedNode && isPdfFile(selectedNode.name) && !selectedNode.entity
  const canSummarize = isPdfActive || isStandalonePdf

  const getOutputPath = (pdfPath: string, outputFilename: string) => {
    const lastSlash = Math.max(pdfPath.lastIndexOf('/'), pdfPath.lastIndexOf('\\'))
    const dir = pdfPath.substring(0, lastSlash)
    return `${dir}/${outputFilename}`
  }

  const getBaseName = (filename: string) => {
    // Remove .pdf extension to get base name
    return filename.replace(/\.pdf$/i, '')
  }

  const handleSummarize = async (prompt: string, outputFilename: string) => {
    if (!selectedNode?.path) return

    // Get PDF path - either from active member (entity) or selected node (standalone)
    const pdfPath = activeMember?.path ?? selectedNode.path
    const outputPath = getOutputPath(pdfPath, outputFilename)

    setSummarizingPaths((prev) => new Set(prev).add(selectedNode.path))
    setShowSummarizeModal(false)

    try {
      const result = await window.electronAPI.summarizePdf({
        pdfPath,
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

  // For entities, use entity members; for standalone PDFs, no existing variants
  const existingVariants = selectedNode?.entity?.members.map((m) => m.variant ?? '') ?? []
  // For entities, use baseName; for standalone PDFs, extract from filename
  const summarizeBaseName = selectedNode?.entity?.baseName ?? (selectedNode ? getBaseName(selectedNode.name) : '')

  return (
    <div className="app">
      <header className="header">
        <h1>MarkerDown</h1>
        <div className="header-actions">
          <button
            className={`agent-toggle-btn ${showAgent ? 'active' : ''}`}
            onClick={() => setShowAgent((prev) => !prev)}
            title="Toggle Agent Panel (Ctrl+Shift+A)"
          >
            Agent
            <span className="shortcut">Ctrl+Shift+A</span>
          </button>
          {(canSummarize || summarizingPaths.size > 0) && (
            <SummarizeButton
              isSummarizing={summarizingPaths.size > 0}
              onClick={() => setShowSummarizeModal(true)}
            />
          )}
          <button onClick={handleOpenFolder}>Open Folder</button>
        </div>
      </header>
      <main className="main">
        <aside className="sidebar">
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
        </aside>
        <section className="content">
          {error ? (
            <p className="error-message">{error}</p>
          ) : selectedNode?.entity && activeMember ? (
            <EntityViewer
              entity={selectedNode.entity}
              activeMember={activeMember}
              content={fileContent}
              onTabChange={handleTabChange}
              editMode={editMode}
              onEditModeChange={setEditMode}
              editContent={editContent}
              onEditContentChange={handleEditContentChange}
              isDirty={isDirty}
            />
          ) : selectedNode && isPdfFile(selectedNode.name) && !selectedNode.entity ? (
            <PdfViewer filePath={selectedNode.path} />
          ) : fileContent !== null && selectedNode ? (
            <div className="standalone-markdown">
              <div className="standalone-markdown-toolbar">
                {/* Show formatting toolbar in edit mode */}
                {editMode !== 'view' && (
                  <FormatToolbar editorRef={standaloneEditorRef} activeFormats={standaloneActiveFormats} />
                )}
                <ModeToggle mode={editMode} onModeChange={setEditMode} />
                {isDirty && <span className="save-indicator">Saving...</span>}
              </div>
              <div className="standalone-markdown-content">
                {editMode === 'view' ? (
                  <MarkdownViewer content={fileContent} />
                ) : (
                  <MarkdownEditor
                    ref={standaloneEditorRef}
                    content={editContent ?? fileContent}
                    filePath={selectedNode.path}
                    mode={editMode}
                    onModeChange={setEditMode}
                    onContentChange={handleEditContentChange}
                    isDirty={isDirty}
                    showToolbar={false}
                    onSelectionChange={handleStandaloneSelectionChange}
                  />
                )}
              </div>
            </div>
          ) : null}
        </section>
        <aside
          className="agent-sidebar"
          style={{ width: agentPanelWidth, display: showAgent ? 'flex' : 'none' }}
        >
          <div
            className="agent-sidebar-resize-handle"
            onMouseDown={handleAgentPanelMouseDown}
          />
          <AgentPanel workingDir={folderPath} onClose={() => setShowAgent(false)} />
        </aside>
      </main>
      <SummarizeModal
        isOpen={showSummarizeModal}
        onClose={() => setShowSummarizeModal(false)}
        onSubmit={handleSummarize}
        entityBaseName={summarizeBaseName}
        existingVariants={existingVariants}
      />
    </div>
  )
}

export default App
