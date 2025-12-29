import { isMarkdownFile, isPdfFile, isVideoFile, isAudioFile } from '@shared/types'
import type { TreeNode } from '@shared/types'
import { normalizePath } from '@shared/pathUtils'

const INDENT_PX = 16
const BASE_PADDING_PX = 8

interface TreeViewProps {
  nodes: TreeNode[]
  selectedPath: string | null
  expandedPaths: Set<string>
  onSelect: (node: TreeNode) => void
  onToggleExpand: (path: string) => void
  summarizingPaths?: Set<string>
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void
  // Drag-to-reparent props
  onDragStart?: (node: TreeNode) => void
  onDragEnd?: () => void
  onDragEnter?: (targetPath: string) => void
  onDragLeave?: () => void
  onDrop?: (draggedPath: string, targetNode: TreeNode) => void
  dropTargetPath: string | null
  draggedPath: string | null
}

export function TreeView({ nodes, selectedPath, expandedPaths, onSelect, onToggleExpand, summarizingPaths, onContextMenu, onDragStart, onDragEnd, onDragEnter, onDragLeave, onDrop, dropTargetPath, draggedPath }: TreeViewProps) {
  return (
    <div className="tree-view">
      {nodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          expandedPaths={expandedPaths}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          summarizingPaths={summarizingPaths}
          onContextMenu={onContextMenu}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          dropTargetPath={dropTargetPath}
          draggedPath={draggedPath}
        />
      ))}
    </div>
  )
}

interface TreeItemProps {
  node: TreeNode
  depth: number
  selectedPath: string | null
  expandedPaths: Set<string>
  onSelect: (node: TreeNode) => void
  onToggleExpand: (path: string) => void
  summarizingPaths?: Set<string>
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void
  // Drag-to-reparent props
  onDragStart?: (node: TreeNode) => void
  onDragEnd?: () => void
  onDragEnter?: (targetPath: string) => void
  onDragLeave?: () => void
  onDrop?: (draggedPath: string, targetNode: TreeNode) => void
  dropTargetPath: string | null
  draggedPath: string | null
}

function TreeItem({ node, depth, selectedPath, expandedPaths, onSelect, onToggleExpand, summarizingPaths, onContextMenu, onDragStart, onDragEnd, onDragEnter, onDragLeave, onDrop, dropTargetPath, draggedPath }: TreeItemProps) {
  const expanded = expandedPaths.has(normalizePath(node.path))
  const hasChildren = node.children && node.children.length > 0
  const isSelected = node.path === selectedPath
  const isMarkdown = isMarkdownFile(node.name)
  const isSummarizing = summarizingPaths?.has(node.path) ?? false
  const isPdf = isPdfFile(node.name)
  const isVideo = isVideoFile(node.name)
  const isAudio = isAudioFile(node.name)
  const isEntity = !!node.entity
  const isSuggestion = !!node.isSuggestion
  const isSelectable = isMarkdown || isPdf || isVideo || isAudio || isEntity || isSuggestion

  // Drag-to-reparent: only markdown files and entities can be dragged (not directories, not suggestions)
  const isDraggable = (isMarkdown || isEntity) && !node.isDirectory && !isSuggestion
  // Valid drop targets: markdown files and entities (will become parent)
  const isValidDropTarget = (isMarkdown || isEntity) && !node.isDirectory && !isSuggestion
  const isDropTarget = dropTargetPath === node.path
  const isBeingDragged = draggedPath === node.path

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand(node.path)
  }

  const handleRowClick = () => {
    if (isSelectable) {
      onSelect(node)
    }
    // Single click only selects - doesn't expand/collapse
  }

  const handleRowDoubleClick = () => {
    if (hasChildren) {
      onToggleExpand(node.path)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu?.(e, node)
  }

  // Drag event handlers
  const handleDragStart = (e: React.DragEvent) => {
    if (!isDraggable) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart?.(node)
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!isValidDropTarget) return
    // Prevent dropping on self
    if (draggedPath === node.path) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isValidDropTarget) return
    if (draggedPath === node.path) return
    e.preventDefault()
    onDragEnter?.(node.path)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving this element entirely (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement | null
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      onDragLeave?.()
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isValidDropTarget) return
    if (draggedPath === node.path) return

    const draggedNodePath = e.dataTransfer.getData('text/plain')
    if (!draggedNodePath || draggedNodePath === node.path) return

    onDrop?.(draggedNodePath, node)
  }

  const handleDragEnd = () => {
    onDragEnd?.()
  }

  const getIcon = () => {
    if (node.isSuggestion === 'todos') {
      return '✅'
    }
    if (node.isSuggestion === 'events') {
      return '📅'
    }
    if (node.isDirectory) {
      return expanded ? '📂' : '📁'
    }
    if (node.hasSidecar) {
      return expanded ? '📖' : '📕'
    }
    if (isMarkdown || isEntity) {
      return '📄'
    }
    if (isPdf) {
      return '📑'
    }
    if (isVideo) {
      return '🎬'
    }
    if (isAudio) {
      return '🎵'
    }
    return '📎'
  }

  // Only show variant count when there are multiple variants
  const variantCount = node.entity && node.entity.members.length > 1
    ? node.entity.members.length
    : null

  // Build className for tree-item-row
  const rowClasses = [
    'tree-item-row',
    isSelected && 'selected',
    isSuggestion && 'suggestion',
    isBeingDragged && 'dragging',
    isDropTarget && 'drop-target',
  ].filter(Boolean).join(' ')

  return (
    <div className="tree-item">
      <div
        className={rowClasses}
        style={{ paddingLeft: `${depth * INDENT_PX + BASE_PADDING_PX}px` }}
        onClick={handleRowClick}
        onDoubleClick={handleRowDoubleClick}
        onContextMenu={handleContextMenu}
        draggable={isDraggable}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
        {hasChildren && (
          <span
            className={`tree-chevron ${expanded ? 'expanded' : ''}`}
            onClick={handleChevronClick}
          >
            ▶
          </span>
        )}
        {!hasChildren && <span className="tree-chevron-placeholder" />}
        <span className="tree-icon">{getIcon()}</span>
        <span className="tree-name">{node.name}</span>
        {variantCount && (
          <span className="tree-variant-count">{variantCount}</span>
        )}
        {isSummarizing && (
          <span className="tree-spinner" title="Summarizing with Claude...">
            ⏳
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <div className="tree-children">
          {node.children!.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              summarizingPaths={summarizingPaths}
              onContextMenu={onContextMenu}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              dropTargetPath={dropTargetPath}
              draggedPath={draggedPath}
            />
          ))}
        </div>
      )}
    </div>
  )
}
