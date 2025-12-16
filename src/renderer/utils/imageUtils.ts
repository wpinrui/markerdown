import { LOCAL_IMAGE_PROTOCOL, getDirname } from '@shared/pathUtils'

// Re-export for convenience
export { LOCAL_IMAGE_PROTOCOL }

/**
 * Converts a relative image path to an absolute URL with the local-image protocol.
 * Handles Windows backslashes by converting them to forward slashes.
 *
 * @param markdownFilePath - Full path to the markdown file being edited
 * @param relativePath - Relative path from the markdown file directory (e.g., '.images/image-123.png')
 * @returns Full URL with local-image protocol
 */
export function buildLocalImageUrl(markdownFilePath: string, relativePath: string): string {
  const markdownDir = getDirname(markdownFilePath)

  // Build absolute path and normalize to forward slashes
  const absolutePath = `${markdownDir}/${relativePath}`.replace(/\\/g, '/')

  return `${LOCAL_IMAGE_PROTOCOL}${absolutePath}`
}
