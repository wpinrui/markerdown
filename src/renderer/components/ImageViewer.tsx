import { LOCAL_IMAGE_PROTOCOL } from '@shared/pathUtils'

interface ImageViewerProps {
  filePath: string
}

export function ImageViewer({ filePath }: ImageViewerProps) {
  // Use local-image:// protocol to serve local files (file:// is blocked by Electron security)
  const imageUrl = `${LOCAL_IMAGE_PROTOCOL}${filePath.replace(/\\/g, '/')}`

  return (
    <div className="image-viewer">
      <img
        key={filePath}
        src={imageUrl}
        alt=""
        className="image-content"
      />
    </div>
  )
}
