interface PdfViewerProps {
  filePath: string
}

/**
 * Converts a local file path to a local-pdf:// protocol URL.
 * This allows secure access to local PDF files via Electron's custom protocol.
 */
function toLocalPdfUrl(filePath: string): string {
  // Normalize backslashes to forward slashes for URL
  const normalizedPath = filePath.replace(/\\/g, '/')
  return `local-pdf://local/${encodeURIComponent(normalizedPath)}`
}

export function PdfViewer({ filePath }: PdfViewerProps) {
  const pdfUrl = toLocalPdfUrl(filePath)

  return (
    <div className="pdf-viewer">
      <object data={pdfUrl} type="application/pdf" className="pdf-object">
        <div className="pdf-fallback">
          <p>Unable to display PDF.</p>
          <p className="pdf-path">{filePath}</p>
        </div>
      </object>
    </div>
  )
}
