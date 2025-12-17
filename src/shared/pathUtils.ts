/**
 * Path utility functions for cross-platform path manipulation.
 * Handles both forward slashes (/) and backslashes (\).
 */

/** Custom protocol used to serve local images in markdown */
export const LOCAL_IMAGE_PROTOCOL = 'local-image://'

/** Characters that are invalid in Windows filenames */
export const INVALID_FILENAME_CHARS_REGEX = /[<>:"/\\|?*]/

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
