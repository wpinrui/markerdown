import { useState } from 'react'
import { isMarkdownFile, isPdfFile } from '@shared/types'
import type { TreeNode } from '@shared/types'
import { getDirname, findSiblings, isDescendantPath } from '@shared/pathUtils'

const INDENT_PX = 16
const BASE_PADDING_PX = 8

interface TreeViewProps {
  nodes: TreeNode[]
  selectedPath: string | null
  onSelect: (node: TreeNode) => void
  summarizingPaths?: Set<string>
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void
  onReorder?: (parentPath: string, newOrder: string[]) => void
  onMove?: (node: TreeNode, targetPath: string) => void
  folderPath?: string
}

export function TreeView({ nodes, selectedPath, onSelect, summarizingPaths, onContextMenu, onReorder, onMove, folderPath }: TreeViewProps) {
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    node: TreeNode
    position: 'before' | 'after' | 'into'
    parentPath: string
  } | null>(null)

  const handleDragStart = (node: TreeNode) => {
    setDraggedNode(node)
  }

  const handleDragEnd = () => {
    if (!draggedNode || !dropTarget) {
      setDraggedNode(null)
      setDropTarget(null)
      return
    }

    const draggedParent = getDirname(draggedNode.path)

    // Handle moving into a directory/entity
    if (dropTarget.position === 'into') {
      if (onMove) {
        onMove(draggedNode, dropTarget.node.path)
      }
    }
    // Handle reordering within same parent
    else if (draggedParent === dropTarget.parentPath && onReorder) {
      const siblings = findSiblings(nodes, draggedParent)
      const newOrder = [...siblings.map((n) => n.name)]

      // Remove dragged item
      const draggedIndex = newOrder.indexOf(draggedNode.name)
      if (draggedIndex !== -1) {
        newOrder.splice(draggedIndex, 1)
      }

      // Insert at new position
      let targetIndex = newOrder.indexOf(dropTarget.node.name)
      if (targetIndex !== -1) {
        if (dropTarget.position === 'after') {
          targetIndex++
        }
        newOrder.splice(targetIndex, 0, draggedNode.name)

        onReorder(dropTarget.parentPath, newOrder)
      }
    }

    setDraggedNode(null)
    setDropTarget(null)
  }

  const handleDragOver = (node: TreeNode, position: 'before' | 'after' | 'into', parentPath: string) => {
    if (!draggedNode || draggedNode.path === node.path) return
    setDropTarget({ node, position, parentPath })
  }

  // For root nodes, parent path is the folder path or the first node's parent
  const rootParentPath = folderPath || (nodes.length > 0 ? getDirname(nodes[0].path) : '')

  return (
    <div className="tree-view">
      {nodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          parentPath={rootParentPath}
          selectedPath={selectedPath}
          onSelect={onSelect}
          summarizingPaths={summarizingPaths}
          onContextMenu={onContextMenu}
          draggedNode={draggedNode}
          dropTarget={dropTarget}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          allNodes={nodes}
        />
      ))}
    </div>
  )
}

interface TreeItemProps {
  node: TreeNode
  depth: number
  parentPath: string
  selectedPath: string | null
  onSelect: (node: TreeNode) => void
  summarizingPaths?: Set<string>
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void
  draggedNode: TreeNode | null
  dropTarget: { node: TreeNode; position: 'before' | 'after' | 'into'; parentPath: string } | null
  onDragStart: (node: TreeNode) => void
  onDragEnd: () => void
  onDragOver: (node: TreeNode, position: 'before' | 'after' | 'into', parentPath: string) => void
  allNodes: TreeNode[]
}

function TreeItem({
  node,
  depth,
  parentPath,
  selectedPath,
  onSelect,
  summarizingPaths,
  onContextMenu,
  draggedNode,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  allNodes,
}: TreeItemProps) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = node.children && node.children.length > 0
  const isSelected = node.path === selectedPath
  const isMarkdown = isMarkdownFile(node.name)
  const isSummarizing = summarizingPaths?.has(node.path) ?? false
  const isPdf = isPdfFile(node.name)
  const isEntity = !!node.entity
  const isSuggestion = !!node.isSuggestion
  const isSelectable = isMarkdown || isPdf || isEntity || isSuggestion

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  const handleRowClick = () => {
    if (isSelectable) {
      onSelect(node)
    }
    // Single click only selects - doesn't expand/collapse
  }

  const handleRowDoubleClick = () => {
    if (hasChildren) {
      setExpanded(!expanded)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu?.(e, node)
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation()
    onDragStart(node)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedNode || draggedNode.path === node.path) return

    // Can't drop into itself or its descendants
    if (isDescendantPath(node.path, draggedNode.path)) return

    // Directories and entities with sidecars can accept drops "into" them
    const canAcceptInto = node.isDirectory || node.hasSidecar

    if (canAcceptInto) {
      // For containers, drop "into" them (move inside)
      onDragOver(node, 'into', node.path)
    } else {
      // For regular files, determine position for reordering
      const rect = e.currentTarget.getBoundingClientRect()
      const midpoint = rect.top + rect.height / 2
      const position = e.clientY < midpoint ? 'before' : 'after'
      onDragOver(node, position, parentPath)
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation()
    onDragEnd()
  }

  const isDragging = draggedNode?.path === node.path
  const isDropBefore = dropTarget?.node.path === node.path && dropTarget.position === 'before' && dropTarget.parentPath === parentPath
  const isDropAfter = dropTarget?.node.path === node.path && dropTarget.position === 'after' && dropTarget.parentPath === parentPath
  const isDropInto = dropTarget?.node.path === node.path && dropTarget.position === 'into'

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
    return '📎'
  }

  // Only show variant count when there are multiple variants
  const variantCount = node.entity && node.entity.members.length > 1
    ? node.entity.members.length
    : null

  return (
    <div className="tree-item">
      <div
        className={`tree-item-row ${isSelected ? 'selected' : ''} ${isSuggestion ? 'suggestion' : ''} ${isDragging ? 'dragging' : ''} ${isDropBefore ? 'drop-before' : ''} ${isDropAfter ? 'drop-after' : ''} ${isDropInto ? 'drop-into' : ''}`}
        style={{ paddingLeft: `${depth * INDENT_PX + BASE_PADDING_PX}px` }}
        draggable={!node.isSuggestion}
        onClick={handleRowClick}
        onDoubleClick={handleRowDoubleClick}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
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
              parentPath={node.path}
              selectedPath={selectedPath}
              onSelect={onSelect}
              summarizingPaths={summarizingPaths}
              onContextMenu={onContextMenu}
              draggedNode={draggedNode}
              dropTarget={dropTarget}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              allNodes={allNodes}
            />
          ))}
        </div>
      )}
    </div>
  )
}
