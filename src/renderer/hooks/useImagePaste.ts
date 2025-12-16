import { useEffect } from 'react'

const IMAGE_MIME_PREFIX = 'image/'
const SUPPORTED_IMAGE_FORMATS: Record<string, string> = {
  'jpeg': '.jpg',
  'jpg': '.jpg',
  'png': '.png',
  'gif': '.gif',
  'webp': '.webp',
  'svg+xml': '.svg'
}

interface UseImagePasteOptions {
  containerRef: React.RefObject<HTMLElement>
  filePath: string
  onImageSaved: (relativePath: string) => void
}

function getImageExtension(mimeType: string): string | null {
  const format = mimeType.split('/')[1]
  return format ? SUPPORTED_IMAGE_FORMATS[format] || null : null
}

export function useImagePaste({ containerRef, filePath, onImageSaved }: UseImagePasteOptions) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith(IMAGE_MIME_PREFIX)) {
          e.preventDefault()

          const file = item.getAsFile()
          if (!file) continue

          const extension = getImageExtension(item.type)
          if (!extension) {
            console.error('Unsupported image format:', item.type)
            continue
          }

          // Convert to data URL
          const reader = new FileReader()
          reader.onload = async () => {
            const result = reader.result
            if (typeof result !== 'string') {
              console.error('Failed to read image as data URL')
              return
            }

            // Save image via IPC
            const saveResult = await window.electronAPI.saveImage(filePath, result, extension)

            if (saveResult.success && saveResult.relativePath) {
              onImageSaved(saveResult.relativePath)
            } else {
              console.error('Failed to save image:', saveResult.error)
            }
          }
          reader.onerror = () => {
            console.error('Failed to read image file')
          }
          reader.readAsDataURL(file)
          break
        }
      }
    }

    container.addEventListener('paste', handlePaste)
    return () => container.removeEventListener('paste', handlePaste)
  }, [containerRef, filePath, onImageSaved])
}
