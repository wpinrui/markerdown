import { useState, useEffect } from 'react'
import { TreeView } from './components/TreeView'
import { buildFileTree } from '@shared/fileTree'
import { isMarkdownFile } from '@shared/types'
import type { TreeNode } from '@shared/types'

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
    }
  }

  // Build tree when folder changes
  useEffect(() => {
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

  // Load file content when selection changes
  useEffect(() => {
    if (!selectedNode || !isMarkdownFile(selectedNode.name)) {
      setFileContent(null)
      return
    }

    window.electronAPI.readFile(selectedNode.path)
      .then((content) => {
        setFileContent(content)
        setError(null)
      })
      .catch((err) => {
        console.error('Failed to read file:', err)
        setError(`Failed to read ${selectedNode.name}`)
        setFileContent(null)
      })
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
            <pre className="markdown-raw">{fileContent}</pre>
          ) : (
            <p className="placeholder">Select a markdown file to view</p>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
