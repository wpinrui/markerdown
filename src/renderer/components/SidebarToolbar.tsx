import { Plus, Folder, Settings, Archive } from 'lucide-react'

interface SidebarToolbarProps {
  onNewNote: () => void
  onOpenFolder: () => void
  onOpenOptions: () => void
  showArchived: boolean
  onToggleArchived: () => void
}

export function SidebarToolbar({
  onNewNote,
  onOpenFolder,
  onOpenOptions,
  showArchived,
  onToggleArchived,
}: SidebarToolbarProps) {
  return (
    <div className="sidebar-toolbar">
      <button
        className="sidebar-toolbar-btn"
        onClick={onNewNote}
        title="New Note"
      >
        <Plus size={18} strokeWidth={1.5} />
      </button>
      <button
        className="sidebar-toolbar-btn"
        onClick={onOpenFolder}
        title="Open in File Explorer"
      >
        <Folder size={18} strokeWidth={1.5} />
      </button>
      <button
        className={`sidebar-toolbar-btn ${showArchived ? 'active' : ''}`}
        onClick={onToggleArchived}
        title={showArchived ? 'Hide Archived Items' : 'Show Archived Items'}
      >
        <Archive size={18} strokeWidth={1.5} />
      </button>
      <button
        className="sidebar-toolbar-btn"
        onClick={onOpenOptions}
        title="Options"
      >
        <Settings size={18} strokeWidth={1.5} />
      </button>
    </div>
  )
}
