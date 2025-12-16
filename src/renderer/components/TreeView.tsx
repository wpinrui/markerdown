import { useState } from 'react'
import { isMarkdownFile, isPdfFile } from '@shared/types'
import type { TreeNode } from '@shared/types'
import { getDirname } from '@shared/pathUtils'

const INDENT_PX = 16
const BASE_PADDING_PX = 8

interface TreeViewProps {
  nodes: TreeNode[]
  selectedPath: string | null
  onSelect: (node: TreeNode) => void
  summarizingPaths?: Set<string>
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void
  onReorder?: (parentPath: string, newOrder: string[]) => void
  folderPath?: string
}

export function TreeView({ nodes, selectedPath, onSelect, summarizingPaths, onContextMenu, onReorder, folderPath }: TreeViewProps) {
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null)
  const [dropTarget, setDropTarget] = useState<{ node: TreeNode; position: 'before' | 'after'; parentPath: string } | null>(null)

  const handleDragStart = (node: TreeNode) => {
    setDraggedNode(node)
  }

  const handleDragEnd = () => {
    if (draggedNode && dropTarget && onReorder) {
      const draggedParent = getDirname(draggedNode.path)

      // Only allow reordering within same parent
      if (draggedParent === dropTarget.parentPath) {
        // Get siblings by filtering nodes that share the same parent
        const findSiblings = (nodeList: TreeNode[], parentDir: string): TreeNode[] => {
          const result: TreeNode[] = []
          for (const n of nodeList) {
            if (getDirname(n.path) === parentDir) {
              result.push(n)
            }
            if (n.children) {
              result.push(...findSiblings(n.children, parentDir))
            }
          }
          return result
        }

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
    }

    setDraggedNode(null)
    setDropTarget(null)
  }

  const handleDragOver = (node: TreeNode, position: 'before' | 'after', parentPath: string) => {
    if (!draggedNode || draggedNode.path === node.path) return
    setDropTarget({ node, position, parentPath })
  }

  // For root nodes, parent path is the folder path
  const rootParentPath = folderPath || getDirname(nodes[0]?.path || '')

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
  dropTarget: { node: TreeNode; position: 'before' | 'after'; parentPath: string } | null
  onDragStart: (node: TreeNode) => void
  onDragEnd: () => void
  onDragOver: (node: TreeNode, position: 'before' | 'after', parentPath: string) => void
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

    // Determine if cursor is in top or bottom half
    const rect = e.currentTarget.getBoundingClientRect()
    const midpoint = rect.top + rect.height / 2
    const position = e.clientY < midpoint ? 'before' : 'after'

    onDragOver(node, position, parentPath)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation()
    onDragEnd()
  }

  const isDragging = draggedNode?.path === node.path
  const isDropBefore = dropTarget?.node.path === node.path && dropTarget.position === 'before' && dropTarget.parentPath === parentPath
  const isDropAfter = dropTarget?.node.path === node.path && dropTarget.position === 'after' && dropTarget.parentPath === parentPath

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
        className={`tree-item-row ${isSelected ? 'selected' : ''} ${isSuggestion ? 'suggestion' : ''} ${isDragging ? 'dragging' : ''} ${isDropBefore ? 'drop-before' : ''} ${isDropAfter ? 'drop-after' : ''}`}
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
