import { useEffect, useRef } from 'react'

const IMAGE_MIME_PREFIX = 'image/'
const SUPPORTED_IMAGE_FORMATS = {
  'jpeg': '.jpg',
  'jpg': '.jpg',
  'png': '.png',
  'gif': '.gif',
  'webp': '.webp',
  'svg+xml': '.svg'
} as const

type SupportedImageFormat = keyof typeof SUPPORTED_IMAGE_FORMATS

interface UseImagePasteOptions {
  containerRef: React.RefObject<HTMLElement>
  filePath: string
  onImageSaved: (relativePath: string) => void
  onError?: (error: string) => void
}

function getImageExtension(mimeType: string): string | null {
  const parts = mimeType.split('/')
  const format = parts[1]
  if (!format) return null
  return SUPPORTED_IMAGE_FORMATS[format as SupportedImageFormat] ?? null
}

async function saveImageFromFile(
  file: File,
  filePath: string,
  extension: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async () => {
      const imageDataUrl = reader.result
      if (typeof imageDataUrl !== 'string') {
        reject(new Error('Failed to read image as data URL'))
        return
      }

      try {
        const saveResult = await window.electronAPI.saveImage(filePath, imageDataUrl, extension)

        if (saveResult.success && saveResult.relativePath) {
          resolve(saveResult.relativePath)
        } else {
          reject(new Error(saveResult.error || 'Failed to save image'))
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read image file'))
    }

    reader.readAsDataURL(file)
  })
}

export function useImagePaste({ containerRef, filePath, onImageSaved, onError }: UseImagePasteOptions) {
  const onImageSavedRef = useRef(onImageSaved)
  const onErrorRef = useRef(onError)
  const filePathRef = useRef(filePath)

  // Keep refs up to date
  useEffect(() => {
    onImageSavedRef.current = onImageSaved
    onErrorRef.current = onError
    filePathRef.current = filePath
  }, [onImageSaved, onError, filePath])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith(IMAGE_MIME_PREFIX)) {
          e.preventDefault()

          const file = item.getAsFile()
          if (!file) continue

          const extension = getImageExtension(item.type)
          if (!extension) {
            const errorMsg = `Unsupported image format: ${item.type}`
            console.error(errorMsg)
            onErrorRef.current?.(errorMsg)
            continue
          }

          try {
            const relativePath = await saveImageFromFile(file, filePathRef.current, extension)
            onImageSavedRef.current(relativePath)
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            console.error('Error saving image:', errorMsg)
            onErrorRef.current?.(errorMsg)
          }
          break
        }
      }
    }

    container.addEventListener('paste', handlePaste)
    return () => container.removeEventListener('paste', handlePaste)
  }, [])
}
