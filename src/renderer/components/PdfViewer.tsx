import { useState, useEffect } from 'react'

interface PdfViewerProps {
  filePath: string
}

export function PdfViewer({ filePath }: PdfViewerProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    window.electronAPI.readPdfAsDataUrl(filePath)
      .then((url) => {
        if (cancelled) return
        if (url) {
          setDataUrl(url)
        } else {
          setError('Failed to load PDF')
        }
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Error loading PDF:', err)
        setError('Failed to load PDF')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filePath])

  if (loading) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-loading">Loading PDF...</div>
      </div>
    )
  }

  if (error || !dataUrl) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-error">{error || 'Failed to load PDF'}</div>
      </div>
    )
  }

  return (
    <div className="pdf-viewer">
      <iframe
        src={dataUrl}
        className="pdf-iframe"
        title="PDF Viewer"
      />
    </div>
  )
}
