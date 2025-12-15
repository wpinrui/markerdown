import { useState } from 'react'
import { isMarkdownFile, isPdfFile } from '@shared/types'
import type { TreeNode } from '@shared/types'

const INDENT_PX = 16
const BASE_PADDING_PX = 8

interface TreeViewProps {
  nodes: TreeNode[]
  selectedPath: string | null
  onSelect: (node: TreeNode) => void
}

export function TreeView({ nodes, selectedPath, onSelect }: TreeViewProps) {
  return (
    <div className="tree-view">
      {nodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

interface TreeItemProps {
  node: TreeNode
  depth: number
  selectedPath: string | null
  onSelect: (node: TreeNode) => void
}

function TreeItem({ node, depth, selectedPath, onSelect }: TreeItemProps) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = node.children && node.children.length > 0
  const isSelected = node.path === selectedPath
  const isMarkdown = isMarkdownFile(node.name)
  const isPdf = isPdfFile(node.name)
  const isEntity = !!node.entity
  const isSelectable = isMarkdown || isPdf || isEntity

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  const handleRowClick = () => {
    if (isSelectable) {
      onSelect(node)
    }
    if (hasChildren) {
      if (isSelected) {
        // Only toggle collapse if already viewing this item
        setExpanded(!expanded)
      } else if (!expanded) {
        // Expand when navigating to a collapsed item
        setExpanded(true)
      }
      // Don't collapse when navigating to an already-expanded item
    }
  }

  const getIcon = () => {
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

  const getVariantCount = () => {
    if (!node.entity) return null
    const count = node.entity.members.length
    return count > 1 ? `${count} variants` : '1 variant'
  }

  return (
    <div className="tree-item">
      <div
        className={`tree-item-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * INDENT_PX + BASE_PADDING_PX}px` }}
        onClick={handleRowClick}
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
        {node.entity && (
          <span className="tree-variant-count">{getVariantCount()}</span>
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
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
