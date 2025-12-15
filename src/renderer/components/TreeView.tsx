import { useState } from 'react'
import type { TreeNode } from '@shared/types'

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
  const isMarkdown = node.name.endsWith('.md')

  const handleClick = () => {
    if (hasChildren) {
      setExpanded(!expanded)
    }
    if (isMarkdown) {
      onSelect(node)
    }
  }

  const getIcon = () => {
    if (node.isDirectory) {
      return expanded ? '📂' : '📁'
    }
    if (node.hasSidecar) {
      return expanded ? '📖' : '📕'
    }
    if (isMarkdown) {
      return '📄'
    }
    if (node.name.endsWith('.pdf')) {
      return '📑'
    }
    return '📎'
  }

  return (
    <div className="tree-item">
      <div
        className={`tree-item-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren && (
          <span className={`tree-chevron ${expanded ? 'expanded' : ''}`}>
            ▶
          </span>
        )}
        {!hasChildren && <span className="tree-chevron-placeholder" />}
        <span className="tree-icon">{getIcon()}</span>
        <span className="tree-name">{node.name}</span>
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
