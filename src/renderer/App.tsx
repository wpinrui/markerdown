import { useState, useEffect, useCallback, useRef } from 'react'
import { TreeView } from './components/TreeView'
import { MarkdownViewer } from './components/MarkdownViewer'
import { EntityViewer } from './components/EntityViewer'
import { PdfViewer } from './components/PdfViewer'
import { SummarizeModal } from './components/SummarizeModal'
import { SummarizeButton } from './components/SummarizeButton'
import { AgentPanel } from './components/AgentPanel'
import { buildFileTree } from '@shared/fileTree'
import { isMarkdownFile, isPdfFile, isStructureChange } from '@shared/types'
import type { TreeNode, FileChangeEvent, EntityMember } from '@shared/types'

const DEFAULT_SIDEBAR_WIDTH = 280
const DEFAULT_TREE_HEIGHT_RATIO = 0.6
const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 600
const MIN_PANEL_HEIGHT = 100

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
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [treeHeightRatio, setTreeHeightRatio] = useState(DEFAULT_TREE_HEIGHT_RATIO)
  const sidebarRef = useRef<HTMLElement>(null)
  const isDraggingSidebar = useRef(false)
  const isDraggingDivider = useRef(false)

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

  // Keyboard shortcut for agent toggle (Ctrl+Shift+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setShowAgent((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Sidebar width resize handler
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingSidebar.current = true
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current) return
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, e.clientX))
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

  // Divider resize handler (between tree and agent panel)
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingDivider.current = true
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    const sidebarEl = sidebarRef.current
    if (!sidebarEl) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDivider.current || !sidebarEl) return
      const rect = sidebarEl.getBoundingClientRect()
      const totalHeight = rect.height
      const relativeY = e.clientY - rect.top
      const newRatio = Math.min(0.9, Math.max(0.1, relativeY / totalHeight))

      // Ensure minimum heights
      const treeHeight = totalHeight * newRatio
      const agentHeight = totalHeight * (1 - newRatio)
      if (treeHeight >= MIN_PANEL_HEIGHT && agentHeight >= MIN_PANEL_HEIGHT) {
        setTreeHeightRatio(newRatio)
      }
    }

    const handleMouseUp = () => {
      isDraggingDivider.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
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

  const handleSelectNode = (node: TreeNode) => {
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
        <aside
          className="sidebar"
          ref={sidebarRef}
          style={{ width: sidebarWidth }}
        >
          <div
            className="sidebar-content"
            style={{ height: showAgent ? `${treeHeightRatio * 100}%` : '100%' }}
          >
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
          {showAgent && (
            <>
              <div
                className="sidebar-divider"
                onMouseDown={handleDividerMouseDown}
              />
              <div style={{ height: `${(1 - treeHeightRatio) * 100}%` }}>
                <AgentPanel workingDir={folderPath} />
              </div>
            </>
          )}
          <div
            className="sidebar-resize-handle"
            onMouseDown={handleSidebarMouseDown}
          />
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
            />
          ) : selectedNode && isPdfFile(selectedNode.name) && !selectedNode.entity ? (
            <PdfViewer filePath={selectedNode.path} />
          ) : fileContent !== null ? (
            <MarkdownViewer content={fileContent} />
          ) : null}
        </section>
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
