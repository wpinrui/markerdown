import { isVideoFile } from '../../shared/types'

interface MediaViewerProps {
  filePath: string
}

export default function MediaViewer({ filePath }: MediaViewerProps) {
  const isVideo = isVideoFile(filePath)
  // Convert Windows path to file:// URL
  const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`

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
