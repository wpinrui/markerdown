import { useState, useEffect, useCallback, useRef } from 'react'
import { TreeView } from './components/TreeView'
import { MarkdownViewer } from './components/MarkdownViewer'
import { EntityViewer } from './components/EntityViewer'
import { PdfViewer } from './components/PdfViewer'
import { buildFileTree } from '@shared/fileTree'
import { isMarkdownFile, isPdfFile, isStructureChange } from '@shared/types'
import type { TreeNode, FileChangeEvent, EntityMember } from '@shared/types'

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [activeMember, setActiveMember] = useState<EntityMember | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="app">
      <header className="header">
        <h1>MarkerDown</h1>
        <button onClick={handleOpenFolder}>Open Folder</button>
      </header>
      <main className="main">
        <aside className="sidebar">
          {folderPath ? (
            <TreeView
              nodes={treeNodes}
              selectedPath={selectedNode?.path ?? null}
              onSelect={handleSelectNode}
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
            />
          ) : selectedNode && isPdfFile(selectedNode.name) && !selectedNode.entity ? (
            <PdfViewer filePath={selectedNode.path} />
          ) : fileContent !== null ? (
            <MarkdownViewer content={fileContent} />
          ) : null}
        </section>
      </main>
    </div>
  )
}

export default App
