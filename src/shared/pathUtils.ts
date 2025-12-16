/**
 * Path utility functions for cross-platform path manipulation.
 * Handles both forward slashes (/) and backslashes (\).
 */

export const PATH_SEPARATOR_FORWARD = '/'
export const PATH_SEPARATOR_BACKWARD = '\\'

/** Custom protocol used to serve local images in markdown */
export const LOCAL_IMAGE_PROTOCOL = 'local-image://'

export function getBasename(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return filePath.substring(lastSlash + 1)
}

export function getDirname(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return filePath.substring(0, lastSlash)
}

export function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot !== -1 ? filename.substring(lastDot) : ''
}

export function stripExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot !== -1 ? filename.substring(0, lastDot) : filename
}

export function stripMultipleExtensions(filename: string, ...extensions: string[]): string {
  let result = filename
  for (const ext of extensions) {
    if (result.toLowerCase().endsWith(ext.toLowerCase())) {
      result = stripExtension(result)
    }
  }
  return result
}

/**
 * Try finding a path with both forward and backslash separators.
 * Useful for cross-platform path handling when paths may use either separator.
 * Returns [originalPath, alternatePath] where alternatePath uses the opposite separator.
 */
export function normalizePath(path: string): [string, string] {
  // If path uses backslashes, also try forward slashes (and vice versa)
  const hasBackslash = path.includes(PATH_SEPARATOR_BACKWARD)
  const alternatePath = hasBackslash
    ? path.replace(/\\/g, PATH_SEPARATOR_FORWARD)
    : path.replace(/\//g, PATH_SEPARATOR_BACKWARD)
  return [path, alternatePath]
}

/**
 * Check if a path is a descendant of an ancestor path.
 * Handles both forward and backslash separators.
 */
export function isDescendantPath(ancestorPath: string, descendantPath: string): boolean {
  return (
    descendantPath.startsWith(ancestorPath + PATH_SEPARATOR_FORWARD) ||
    descendantPath.startsWith(ancestorPath + PATH_SEPARATOR_BACKWARD)
  )
}

/**
 * Find node by path in a tree structure.
 */
export function findNodeByPath<T extends { path: string; children?: T[] }>(
  nodes: T[],
  targetPath: string
): T | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node
    if (node.children) {
      const found = findNodeByPath(node.children, targetPath)
      if (found) return found
    }
  }
  return null
}

/**
 * Find all sibling nodes in a tree that share the same parent directory.
 */
export function findSiblings<T extends { path: string; children?: T[] }>(
  nodes: T[],
  parentDir: string
): T[] {
  const result: T[] = []
  for (const node of nodes) {
    if (getDirname(node.path) === parentDir) {
      result.push(node)
    }
    if (node.children) {
      result.push(...findSiblings(node.children, parentDir))
    }
  }
  return result
}

/**
 * Flatten a tree structure into a flat array of nodes.
 */
export function flattenTree<T extends { children?: T[] }>(nodes: T[]): T[] {
  const result: T[] = []
  for (const node of nodes) {
    result.push(node)
    if (node.children) {
      result.push(...flattenTree(node.children))
    }
  }
  return result
}

/**
 * Detect the path separator used in a path.
 * Returns the separator character, defaulting to forward slash if ambiguous.
 */
export function detectPathSeparator(path: string): string {
  return path.includes(PATH_SEPARATOR_BACKWARD) ? PATH_SEPARATOR_BACKWARD : PATH_SEPARATOR_FORWARD
}
