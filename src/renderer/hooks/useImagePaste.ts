import { useEffect } from 'react'

interface SaveImageResult {
  success: boolean
  relativePath?: string
  error?: string
}

interface UseImagePasteOptions {
  containerRef: React.RefObject<HTMLElement>
  filePath: string
  onImageSaved: (relativePath: string) => void
}

export function useImagePaste({ containerRef, filePath, onImageSaved }: UseImagePasteOptions) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()

          const file = item.getAsFile()
          if (!file) continue

          // Convert to data URL
          const reader = new FileReader()
          reader.onload = async () => {
            const dataUrl = reader.result as string

            // Determine extension from MIME type
            const extension = item.type.split('/')[1] === 'jpeg' ? '.jpg' : `.${item.type.split('/')[1]}`

            // Save image via IPC
            const result: SaveImageResult = await window.electronAPI.saveImage(filePath, dataUrl, extension)

            if (result.success && result.relativePath) {
              onImageSaved(result.relativePath)
            } else {
              console.error('Failed to save image:', result.error)
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
