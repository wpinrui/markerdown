import { useState } from 'react'

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null)

  const handleOpenFolder = async () => {
    const path = await window.electronAPI.openFolder()
    if (path) {
      setFolderPath(path)
    }
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
            <div className="folder-info">
              <p>Opened: {folderPath}</p>
              <p className="placeholder">Tree view coming soon...</p>
            </div>
          ) : (
            <p className="placeholder">No folder opened</p>
          )}
        </aside>
        <section className="content">
          <p className="placeholder">Select a markdown file to view</p>
        </section>
      </main>
    </div>
  )
}

export default App
