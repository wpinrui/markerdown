import { useEffect, useRef, useCallback } from 'react'

const AUTO_SAVE_DELAY = 1500 // 1.5 seconds after last keystroke

interface UseAutoSaveOptions {
  content: string | null
  filePath: string | null
  isDirty: boolean
  onSave: (content: string, filePath: string) => Promise<void>
  onSaveComplete: () => void
}

export function useAutoSave({
  content,
  filePath,
  isDirty,
  onSave,
  onSaveComplete,
}: UseAutoSaveOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(content)
  const filePathRef = useRef(filePath)

  // Keep refs in sync
  contentRef.current = content
  filePathRef.current = filePath

  const save = useCallback(async () => {
    const currentContent = contentRef.current
    const currentFilePath = filePathRef.current

    if (currentContent === null || currentFilePath === null) return

    await onSave(currentContent, currentFilePath)
    onSaveComplete()
  }, [onSave, onSaveComplete])

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Trigger auto-save when content changes and is dirty
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (!isDirty || !filePath || content === null) {
      return
    }

    timeoutRef.current = setTimeout(() => {
      save()
    }, AUTO_SAVE_DELAY)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [content, filePath, isDirty, save])
}
