import { Plus, Folder, Settings, MessageSquare, CheckSquare, Calendar } from 'lucide-react'

export type PaneType = 'agent' | 'todos' | 'events'

interface SidebarToolbarProps {
  onNewNote: () => void
  onOpenFolder: () => void
  onOpenOptions: () => void
  activePane: PaneType | null
  onPaneToggle: (pane: PaneType) => void
}

export function SidebarToolbar({
  onNewNote,
  onOpenFolder,
  onOpenOptions,
  activePane,
  onPaneToggle,
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
        className="sidebar-toolbar-btn"
        onClick={onOpenOptions}
        title="Options"
      >
        <Settings size={18} strokeWidth={1.5} />
      </button>
      <div className="sidebar-toolbar-separator" />
      <button
        className={`sidebar-toolbar-btn ${activePane === 'agent' ? 'active' : ''}`}
        onClick={() => onPaneToggle('agent')}
        title="Agent (Ctrl+Shift+A)"
      >
        <MessageSquare size={18} strokeWidth={1.5} />
      </button>
      <button
        className={`sidebar-toolbar-btn ${activePane === 'todos' ? 'active' : ''}`}
        onClick={() => onPaneToggle('todos')}
        title="Todos"
      >
        <CheckSquare size={18} strokeWidth={1.5} />
      </button>
      <button
        className={`sidebar-toolbar-btn ${activePane === 'events' ? 'active' : ''}`}
        onClick={() => onPaneToggle('events')}
        title="Events"
      >
        <Calendar size={18} strokeWidth={1.5} />
      </button>
    </div>
  )
}
