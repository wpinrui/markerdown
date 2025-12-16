import { Plus, Folder, Settings } from 'lucide-react'

interface SidebarToolbarProps {
  onNewNote: () => void
  onOpenFolder: () => void
  onOpenOptions: () => void
}

export function SidebarToolbar({ onNewNote, onOpenFolder, onOpenOptions }: SidebarToolbarProps) {
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
        title="Open Folder"
      >
        <Folder size={18} strokeWidth={1.5} />
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
