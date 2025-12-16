import { isVideoFile } from '@shared/types'

interface MediaViewerProps {
  filePath: string
}

export function MediaViewer({ filePath }: MediaViewerProps) {
  const isVideo = isVideoFile(filePath)
  // Use custom media:// protocol to serve local files (file:// is blocked by Electron security)
  // Use "localhost" as host to avoid URL parsing issues with Windows drive letters
  const fileUrl = `media://localhost/${filePath.replace(/\\/g, '/')}`

  return (
    <div className="media-viewer">
      {isVideo ? (
        <video key={filePath} controls autoPlay={false} className="media-player">
          <source src={fileUrl} />
          Your browser does not support video playback.
        </video>
      ) : (
        <audio key={filePath} controls autoPlay={false} className="media-player">
          <source src={fileUrl} />
          Your browser does not support audio playback.
        </audio>
      )}
    </div>
  )
}
