import { isMarkdownFile, MARKDOWN_EXTENSION } from './types'
import type { FileEntry, TreeNode } from './types'

/**
 * Build a hierarchical tree from a flat list of file entries.
 * Detects sidecar relationships: if X.md exists alongside X/ folder,
 * the folder's contents become children of the markdown file.
 */
export async function buildFileTree(
  dirPath: string,
  readDirectory: (path: string) => Promise<FileEntry[]>
): Promise<TreeNode[]> {
  const entries = await readDirectory(dirPath)

  // Separate files and directories
  const files = entries.filter((e) => !e.isDirectory)
  const dirs = entries.filter((e) => e.isDirectory)

  // Find markdown files
  const mdFiles = files.filter((f) => isMarkdownFile(f.name))
  const otherFiles = files.filter((f) => !isMarkdownFile(f.name))

  // Build a set of directory names for quick lookup
  const dirNames = new Set(dirs.map((d) => d.name))

  const nodes: TreeNode[] = []
  const processedDirs = new Set<string>()

  // Process markdown files first (they may have sidecar folders)
  for (const mdFile of mdFiles) {
    const baseName = mdFile.name.slice(0, -MARKDOWN_EXTENSION.length)
    const hasSidecar = dirNames.has(baseName)

    const node: TreeNode = {
      name: mdFile.name,
      path: mdFile.path,
      isDirectory: false,
      hasSidecar,
    }

    // If there's a sidecar folder, recursively get its contents as children
    if (hasSidecar) {
      const sidecarDir = dirs.find((d) => d.name === baseName)!
      node.children = await buildFileTree(sidecarDir.path, readDirectory)
      processedDirs.add(baseName)
    }

    nodes.push(node)
  }

  // Process directories that weren't sidecars
  for (const dir of dirs) {
    if (processedDirs.has(dir.name)) continue

    const node: TreeNode = {
      name: dir.name,
      path: dir.path,
      isDirectory: true,
      hasSidecar: false,
      children: await buildFileTree(dir.path, readDirectory),
    }

    nodes.push(node)
  }

  // Add non-markdown files (PDFs, images, etc.)
  for (const file of otherFiles) {
    nodes.push({
      name: file.name,
      path: file.path,
      isDirectory: false,
      hasSidecar: false,
    })
  }

  // Sort: directories/sidecars first, then files, alphabetically within each group
  return nodes.sort((a, b) => {
    const aIsContainer = a.isDirectory || a.hasSidecar
    const bIsContainer = b.isDirectory || b.hasSidecar

    if (aIsContainer && !bIsContainer) return -1
    if (!aIsContainer && bIsContainer) return 1
    return a.name.localeCompare(b.name)
  })
}
