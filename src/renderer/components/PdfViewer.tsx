import { useState, useEffect, useRef, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfViewerProps {
  filePath: string
}

type FitMode = 'width' | 'page' | 'custom'

const ZOOM_STEP = 0.25
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

// Persist scroll positions across tab switches
const scrollPositions = new Map<string, number>()

export function PdfViewer({ filePath }: PdfViewerProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1)
  const [fitMode, setFitMode] = useState<FitMode>('width')
  const [containerWidth, setContainerWidth] = useState<number>(800)
  const [containerHeight, setContainerHeight] = useState<number>(600)
  const [originalPageWidth, setOriginalPageWidth] = useState<number>(0)
  const [searchText, setSearchText] = useState<string>('')
  const [searchOpen, setSearchOpen] = useState<boolean>(false)
  const [zoomInputValue, setZoomInputValue] = useState<string>('')
  const [isEditingZoom, setIsEditingZoom] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const searchInputRef = useRef<HTMLInputElement>(null)
  const zoomInputRef = useRef<HTMLInputElement>(null)

  // Load PDF
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

  // Observe container size
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      // Account for padding (16px) + scrollbar width (8px)
      setContainerWidth(rect.width - 24)
      setContainerHeight(rect.height)
    }

    // Get initial size immediately
    updateSize()

    const observer = new ResizeObserver(() => {
      updateSize()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [loading]) // Re-run when loading changes so container exists

  // Restore scroll position after pages render
  useEffect(() => {
    if (!containerRef.current || numPages === 0) return
    const savedPosition = scrollPositions.get(filePath)
    if (savedPosition !== undefined) {
      // Delay to ensure pages have rendered
      const timer = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = savedPosition
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [filePath, numPages])

  // Save scroll position before unmount or file change
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        scrollPositions.set(filePath, containerRef.current.scrollTop)
      }
    }
  }, [filePath])

  const handleScroll = useCallback(() => {
    if (!containerRef.current || numPages === 0) return

    let visiblePage = 1
    let maxVisibleArea = 0

    pageRefs.current.forEach((el, pageNum) => {
      const rect = el.getBoundingClientRect()
      const containerRect = containerRef.current!.getBoundingClientRect()
      const top = Math.max(rect.top, containerRect.top)
      const bottom = Math.min(rect.bottom, containerRect.bottom)
      const visibleHeight = Math.max(0, bottom - top)

      if (visibleHeight > maxVisibleArea) {
        maxVisibleArea = visibleHeight
        visiblePage = pageNum
      }
    })

    setCurrentPage(visiblePage)

    // Save scroll position
    scrollPositions.set(filePath, containerRef.current.scrollTop)
  }, [numPages, filePath])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Navigate to a specific page
  const goToPage = useCallback((pageNum: number) => {
    const targetPage = Math.max(1, Math.min(pageNum, numPages))
    const pageEl = pageRefs.current.get(targetPage)
    if (pageEl) {
      pageEl.scrollIntoView({ block: 'start' })
    }
  }, [numPages])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Search shortcut
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 0)
        return
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setSearchText('')
        return
      }

      // Don't handle arrow keys if user is in an input field
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      // Left/Right arrow for page navigation
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToPage(currentPage + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPage(currentPage - 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen, currentPage, goToPage])

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    setCurrentPage(1)
  }

  function onPageLoadSuccess({ width }: { width: number }) {
    if (originalPageWidth === 0) {
      setOriginalPageWidth(width)
    }
  }

  // Calculate effective scale (what percentage the current view is relative to original)
  function getEffectiveScale(): number {
    if (originalPageWidth === 0) return 1
    return pageWidth / originalPageWidth
  }

  function zoomIn() {
    const currentEffective = getEffectiveScale()
    const newScale = Math.min(currentEffective + ZOOM_STEP, MAX_ZOOM)
    setFitMode('custom')
    setScale(newScale)
  }

  function zoomOut() {
    const currentEffective = getEffectiveScale()
    const newScale = Math.max(currentEffective - ZOOM_STEP, MIN_ZOOM)
    setFitMode('custom')
    setScale(newScale)
  }

  function handleZoomInputFocus() {
    setIsEditingZoom(true)
    setZoomInputValue(String(Math.round(getEffectiveScale() * 100)))
    setTimeout(() => zoomInputRef.current?.select(), 0)
  }

  function handleZoomInputBlur() {
    setIsEditingZoom(false)
    setZoomInputValue('')
  }

  function handleZoomInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const parsed = parseInt(zoomInputValue, 10)
      if (!isNaN(parsed) && parsed >= MIN_ZOOM * 100 && parsed <= MAX_ZOOM * 100) {
        setFitMode('custom')
        setScale(parsed / 100)
        zoomInputRef.current?.blur()
      } else {
        // Invalid - clear and keep focus
        setZoomInputValue('')
        zoomInputRef.current?.focus()
      }
    } else if (e.key === 'Escape') {
      zoomInputRef.current?.blur()
    }
  }

  function setPageRef(pageNum: number) {
    return (el: HTMLDivElement | null) => {
      if (el) {
        pageRefs.current.set(pageNum, el)
      } else {
        pageRefs.current.delete(pageNum)
      }
    }
  }

  // Calculate page width based on fit mode
  let pageWidth: number
  if (fitMode === 'width') {
    pageWidth = containerWidth
  } else if (fitMode === 'page') {
    // Fit entire page in view - estimate aspect ratio (letter ~8.5x11)
    const aspectRatio = 8.5 / 11
    const widthFromHeight = (containerHeight - 32) * aspectRatio
    pageWidth = Math.min(containerWidth, widthFromHeight)
  } else {
    // Custom mode: scale is relative to original page width
    pageWidth = originalPageWidth > 0 ? originalPageWidth * scale : containerWidth * scale
  }

  function getZoomLabel(): string {
    const effectivePercent = Math.round(getEffectiveScale() * 100)
    return `${effectivePercent}%`
  }

  // Simple text highlight via CSS
  const searchStyle = searchText ? `
    .react-pdf__Page__textContent span {
      background-color: transparent;
    }
    .react-pdf__Page__textContent span[data-highlight="true"] {
      background-color: yellow;
      color: black;
    }
  ` : ''

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
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-group">
          <button onClick={zoomOut} title="Zoom out (−)">−</button>
          <input
            ref={zoomInputRef}
            type="text"
            className="pdf-zoom-input"
            value={isEditingZoom ? zoomInputValue : getZoomLabel()}
            onFocus={handleZoomInputFocus}
            onBlur={handleZoomInputBlur}
            onChange={(e) => setZoomInputValue(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={handleZoomInputKeyDown}
          />
          <button onClick={zoomIn} title="Zoom in (+)">+</button>
        </div>
        <span className="pdf-page-indicator">{currentPage}/{numPages}</span>
        <div className="pdf-toolbar-group">
          <button
            onClick={() => setFitMode('width')}
            className={`pdf-fit-btn ${fitMode === 'width' ? 'active' : ''}`}
          >
            Fit Width
          </button>
          <button
            onClick={() => setFitMode('page')}
            className={`pdf-fit-btn ${fitMode === 'page' ? 'active' : ''}`}
          >
            Fit Page
          </button>
          <button
            onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 0) }}
            className={searchOpen ? 'active' : ''}
            title="Search (Ctrl+F)"
          >
            🔍
          </button>
        </div>
      </div>
      {searchOpen && (
        <div className="pdf-search-bar">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search in PDF... (use Ctrl+F in text layer)"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchOpen(false)
                setSearchText('')
              }
            }}
          />
          <button onClick={() => { setSearchOpen(false); setSearchText('') }}>✕</button>
        </div>
      )}
      <div className="pdf-container" ref={containerRef}>
        <Document
          file={dataUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="pdf-loading">Loading PDF...</div>}
          error={<div className="pdf-error">Failed to load PDF</div>}
        >
          {Array.from(new Array(numPages), (_, index) => (
            <div key={`page_${index + 1}`} ref={setPageRef(index + 1)} className="pdf-page-wrapper">
              <Page
                pageNumber={index + 1}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                onLoadSuccess={index === 0 ? onPageLoadSuccess : undefined}
                customTextRenderer={searchText ? ({ str }) => {
                  if (searchText && str.toLowerCase().includes(searchText.toLowerCase())) {
                    const parts = str.split(new RegExp(`(${searchText})`, 'gi'))
                    return parts.map((part, i) =>
                      part.toLowerCase() === searchText.toLowerCase()
                        ? `<mark>${part}</mark>`
                        : part
                    ).join('')
                  }
                  return str
                } : undefined}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  )
}
