import { useCallback, useRef } from 'react'

type ResizeDirection = 'left' | 'right'

interface UseHorizontalResizeOptions {
  direction: ResizeDirection
  minWidth: number
  maxWidth: number
  setWidth: (width: number) => void
}

/**
 * Hook to handle horizontal panel resize via mouse drag
 */
export function useHorizontalResize({
  direction,
  minWidth,
  maxWidth,
  setWidth,
}: UseHorizontalResizeOptions) {
  const isDragging = useRef(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return
        const newWidth =
          direction === 'left'
            ? Math.min(maxWidth, Math.max(minWidth, e.clientX))
            : Math.min(maxWidth, Math.max(minWidth, window.innerWidth - e.clientX))
        setWidth(newWidth)
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [direction, minWidth, maxWidth, setWidth]
  )

  return { handleMouseDown, isDragging }
}
