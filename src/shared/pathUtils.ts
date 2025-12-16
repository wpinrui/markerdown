/**
 * Path utility functions for cross-platform path manipulation.
 * Handles both forward slashes (/) and backslashes (\).
 */

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
 */
export function normalizePath(path: string): string[] {
  return [path, path.replace(/\//g, '\\')]
}
