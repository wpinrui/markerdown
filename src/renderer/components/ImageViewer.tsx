import { useState, useEffect } from 'react'
import { LOCAL_IMAGE_PROTOCOL } from '@shared/pathUtils'

interface ImageViewerProps {
  filePath: string
}

export function ImageViewer({ filePath }: ImageViewerProps) {
  const [error, setError] = useState(false)

  // Reset error state when filePath changes
  useEffect(() => {
    setError(false)
  }, [filePath])

  // Use local-image:// protocol to serve local files (file:// is blocked by Electron security)
  const imageUrl = `${LOCAL_IMAGE_PROTOCOL}${filePath.replace(/\\/g, '/')}`

  if (error) {
    return (
      <div className="image-viewer">
        <div className="image-error">Failed to load image</div>
      </div>
    )
  }

  return (
    <div className="image-viewer">
      <img
        key={filePath}
        src={imageUrl}
        alt=""
        className="image-content"
        onError={() => setError(true)}
      />
    </div>
  )
}
