import { useState, useEffect } from 'react'
import { TreeView } from './components/TreeView'
import { buildFileTree } from '@shared/fileTree'
import type { TreeNode } from '@shared/types'

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)

  const handleOpenFolder = async () => {
    const path = await window.electronAPI.openFolder()
    if (path) {
      setFolderPath(path)
      setSelectedNode(null)
      setFileContent(null)
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
      .catch(console.error)
  }, [folderPath])

  // Load file content when selection changes
  useEffect(() => {
    if (!selectedNode || !selectedNode.name.endsWith('.md')) {
      setFileContent(null)
      return
    }

    window.electronAPI.readFile(selectedNode.path)
      .then(setFileContent)
      .catch(console.error)
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
          {fileContent !== null ? (
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
