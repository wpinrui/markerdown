import { useState, useEffect, useCallback, useRef } from 'react'
import { TreeView } from './components/TreeView'
import { MarkdownViewer } from './components/MarkdownViewer'
import { buildFileTree } from '@shared/fileTree'
import { isMarkdownFile } from '@shared/types'
import type { TreeNode, FileChangeEvent } from '@shared/types'

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleOpenFolder = async () => {
    const path = await window.electronAPI.openFolder()
    if (path) {
      setFolderPath(path)
      setSelectedNode(null)
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
  const selectedPathRef = useRef<string | null>(null)
  selectedPathRef.current = selectedNode?.path ?? null

  useEffect(() => {
    if (!folderPath) return

    window.electronAPI.watchFolder(folderPath)

    const unsubscribe = window.electronAPI.onFileChange((event: FileChangeEvent) => {
      if (event.event === 'add' || event.event === 'addDir' || event.event === 'unlink' || event.event === 'unlinkDir') {
        refreshTree()
      } else if (event.event === 'change' && selectedPathRef.current === event.path) {
        window.electronAPI.readFile(event.path).then((content) => {
          if (content !== null) {
            setFileContent(content)
          }
        })
      }
    })

    return () => {
      unsubscribe()
      window.electronAPI.unwatchFolder()
    }
  }, [folderPath, refreshTree])

  // Load file content when selection changes
  useEffect(() => {
    if (!selectedNode || !isMarkdownFile(selectedNode.name)) {
      setFileContent(null)
      return
    }

    let cancelled = false
    const filePath = selectedNode.path
    const fileName = selectedNode.name

    window.electronAPI.readFile(filePath)
      .then((content) => {
        if (cancelled) return
        if (content === null) {
          setError(`Failed to read ${fileName}`)
          setFileContent(null)
        } else {
          setFileContent(content)
          setError(null)
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to read file:', err)
        setError(`Failed to read ${fileName}`)
        setFileContent(null)
      })

    return () => {
      cancelled = true
    }
  }, [selectedNode])

  const handleSelectNode = (node: TreeNode) => {
    setSelectedNode(node)
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
          ) : fileContent !== null ? (
            <MarkdownViewer content={fileContent} />
          ) : (
            <p className="placeholder">Select a markdown file to view</p>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
