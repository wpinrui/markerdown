interface PdfViewerProps {
  filePath: string
}

/**
 * Converts a Windows file path to a file:// URL.
 */
function toFileUrl(filePath: string): string {
  // Normalize backslashes to forward slashes
  const normalizedPath = filePath.replace(/\\/g, '/')
  // Ensure proper file:// URL format
  return `file:///${normalizedPath}`
}

export function PdfViewer({ filePath }: PdfViewerProps) {
  const fileUrl = toFileUrl(filePath)

  return (
    <div className="pdf-viewer">
      <iframe
        src={fileUrl}
        className="pdf-iframe"
        title="PDF Viewer"
      />
    </div>
  )
}
