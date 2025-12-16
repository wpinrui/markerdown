import { useState } from 'react'
import { isMarkdownFile, isPdfFile } from '@shared/types'
import type { TreeNode } from '@shared/types'

const INDENT_PX = 16
const BASE_PADDING_PX = 8

interface TreeViewProps {
  nodes: TreeNode[]
  selectedPath: string | null
  onSelect: (node: TreeNode) => void
  summarizingPaths?: Set<string>
}

export function TreeView({ nodes, selectedPath, onSelect, summarizingPaths }: TreeViewProps) {
  return (
    <div className="tree-view">
      {nodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          summarizingPaths={summarizingPaths}
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
  summarizingPaths?: Set<string>
}

function TreeItem({ node, depth, selectedPath, onSelect, summarizingPaths }: TreeItemProps) {
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

  const getVariantCount = () => {
    if (!node.entity) return null
    const count = node.entity.members.length
    // Only show count if there are multiple variants
    return count > 1 ? count : null
  }

  return (
    <div className="tree-item">
      <div
        className={`tree-item-row ${isSelected ? 'selected' : ''} ${isSuggestion ? 'suggestion' : ''}`}
        style={{ paddingLeft: `${depth * INDENT_PX + BASE_PADDING_PX}px` }}
        onClick={handleRowClick}
        onDoubleClick={handleRowDoubleClick}
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
        {getVariantCount() && (
          <span className="tree-variant-count">{getVariantCount()}</span>
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
              onSelect={onSelect}
              summarizingPaths={summarizingPaths}
            />
          ))}
        </div>
      )}
    </div>
  )
}
