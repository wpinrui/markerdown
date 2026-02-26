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

interface PdfDocumentProxy {
  numPages: number
  getPage: (n: number) => Promise<{ getViewport: (opts: { scale: number }) => { width: number; height: number } }>
}

const ZOOM_STEP = 0.25
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const SCROLL_RESTORE_DELAY_MS = 100
const CONTAINER_PADDING_WITH_SCROLLBAR = 24
const TOOLBAR_HEIGHT = 32
const DEFAULT_ASPECT_RATIO = 8.5 / 11 // US Letter fallback before page dimensions load
const US_LETTER_WIDTH = 612 // US Letter width at 72 DPI
const US_LETTER_HEIGHT = 792 // US Letter height at 72 DPI
const PAGE_OVERSCAN = 2 // Number of pages to pre-render above/below viewport
const OBSERVER_ROOT_MARGIN = '200px 0px'

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function createSearchHighlighter(searchText: string) {
  return ({ str }: { str: string }) => {
    if (str.toLowerCase().includes(searchText.toLowerCase())) {
      const parts = str.split(new RegExp(`(${escapeRegExp(searchText)})`, 'gi'))
      return parts.map((part) =>
        part.toLowerCase() === searchText.toLowerCase()
          ? `<mark>${escapeHtml(part)}</mark>`
          : escapeHtml(part)
      ).join('')
    }
    return escapeHtml(str)
  }
}

// Persist scroll positions across tab switches
const scrollPositions = new Map<string, number>()

export function PdfViewer({ filePath }: PdfViewerProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1)
  const [fitMode, setFitMode] = useState<FitMode>('page')
  const [containerWidth, setContainerWidth] = useState<number>(800)
  const [containerHeight, setContainerHeight] = useState<number>(600)
  const [originalPageWidth, setOriginalPageWidth] = useState<number>(0)
  const [originalPageHeight, setOriginalPageHeight] = useState<number>(0)
  const [searchText, setSearchText] = useState<string>('')
  const [searchOpen, setSearchOpen] = useState<boolean>(false)
  const [zoomInputValue, setZoomInputValue] = useState<string>('')
  const [isEditingZoom, setIsEditingZoom] = useState<boolean>(false)
  const [pageDimensions, setPageDimensions] = useState<Map<number, { width: number; height: number }>>(new Map())
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]))
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const searchInputRef = useRef<HTMLInputElement>(null)
  const zoomInputRef = useRef<HTMLInputElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const intersectingPagesRef = useRef<Set<number>>(new Set())
  const visiblePagesRef = useRef(visiblePages)
  visiblePagesRef.current = visiblePages
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = currentPage

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
      setContainerWidth(rect.width - CONTAINER_PADDING_WITH_SCROLLBAR)
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

  // Restore scroll position after pages render (wait for dimensions so placeholders have correct heights)
  useEffect(() => {
    if (!containerRef.current || numPages === 0 || pageDimensions.size === 0) return
    const savedPosition = scrollPositions.get(filePath)
    if (savedPosition !== undefined) {
      const timer = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = savedPosition
        }
      }, SCROLL_RESTORE_DELAY_MS)
      return () => clearTimeout(timer)
    }
  }, [filePath, numPages, pageDimensions])

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

    let mostVisiblePage = currentPageRef.current
    let maxVisibleArea = 0
    const containerRect = containerRef.current.getBoundingClientRect()

    // Only check pages near the viewport instead of all pages
    visiblePagesRef.current.forEach((pageNum) => {
      const el = pageRefs.current.get(pageNum)
      if (!el) return
      const rect = el.getBoundingClientRect()
      const top = Math.max(rect.top, containerRect.top)
      const bottom = Math.min(rect.bottom, containerRect.bottom)
      const visibleHeight = Math.max(0, bottom - top)

      if (visibleHeight > maxVisibleArea) {
        maxVisibleArea = visibleHeight
        mostVisiblePage = pageNum
      }
    })

    setCurrentPage(mostVisiblePage)

    // Save scroll position
    scrollPositions.set(filePath, containerRef.current.scrollTop)
  }, [numPages, filePath])

  useEffect(() => {
    const container = containerRef.current
    if (!container || numPages === 0) return
    container.addEventListener('scroll', handleScroll)
    // Run once on mount to set initial page
    handleScroll()
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll, numPages])

  // IntersectionObserver for lazy page rendering
  useEffect(() => {
    const container = containerRef.current
    if (!container || numPages === 0 || pageDimensions.size === 0) return

    intersectingPagesRef.current = new Set()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Update the set of actually-intersecting pages based on entry changes
        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '0', 10)
          if (pageNum <= 0) return
          if (entry.isIntersecting) {
            intersectingPagesRef.current.add(pageNum)
          } else {
            intersectingPagesRef.current.delete(pageNum)
          }
        })

        // Build visible set: intersecting pages + overscan
        const newVisible = new Set<number>()
        intersectingPagesRef.current.forEach((pageNum) => {
          for (let i = Math.max(1, pageNum - PAGE_OVERSCAN); i <= Math.min(numPages, pageNum + PAGE_OVERSCAN); i++) {
            newVisible.add(i)
          }
        })

        // Ensure at least page 1 is visible (e.g. during fast scroll)
        if (newVisible.size === 0) newVisible.add(1)

        setVisiblePages((prev) => {
          if (newVisible.size === prev.size && [...newVisible].every((n) => prev.has(n))) {
            return prev
          }
          return newVisible
        })
      },
      {
        root: container,
        rootMargin: OBSERVER_ROOT_MARGIN,
        threshold: 0
      }
    )

    // Observe all page wrapper divs
    pageRefs.current.forEach((el) => {
      observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [numPages, pageDimensions])

  // Navigate to a specific page
  const goToPage = useCallback((pageNum: number) => {
    const targetPage = Math.max(1, Math.min(pageNum, numPages))
    const pageEl = pageRefs.current.get(targetPage)
    if (pageEl) {
      pageEl.scrollIntoView({ block: 'start' })
    }
  }, [numPages])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchText('')
  }, [])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }, [])

  const toggleSearch = useCallback(() => {
    if (searchOpen) {
      closeSearch()
    } else {
      openSearch()
    }
  }, [searchOpen, closeSearch, openSearch])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Search shortcut
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        openSearch()
        return
      }
      if (e.key === 'Escape' && searchOpen) {
        closeSearch()
        return
      }

      // Don't handle arrow keys if user is in an input field
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      // Left/Right arrow for page navigation (use ref to avoid stale closure)
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToPage(currentPageRef.current + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPage(currentPageRef.current - 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen, goToPage, closeSearch, openSearch])

  async function onDocumentLoadSuccess(pdf: PdfDocumentProxy) {
    setNumPages(pdf.numPages)
    setCurrentPage(1)

    // Pre-fetch all page dimensions (metadata only, no rendering)
    const dims = new Map<number, { width: number; height: number }>()
    let firstWidth = 0
    let firstHeight = 0
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1 })
        dims.set(i, { width: viewport.width, height: viewport.height })
        if (firstWidth === 0) {
          firstWidth = viewport.width
          firstHeight = viewport.height
        }
      } catch {
        // Use first page dimensions as fallback, or a default aspect ratio
        const fallbackWidth = firstWidth || US_LETTER_WIDTH
        const fallbackHeight = firstHeight || US_LETTER_HEIGHT
        dims.set(i, { width: fallbackWidth, height: fallbackHeight })
      }
    }
    setPageDimensions(dims)

    if (firstWidth > 0) {
      setOriginalPageWidth(firstWidth)
      setOriginalPageHeight(firstHeight)
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
    const aspectRatio = originalPageHeight > 0 ? originalPageWidth / originalPageHeight : DEFAULT_ASPECT_RATIO
    const widthFromHeight = (containerHeight - TOOLBAR_HEIGHT) * aspectRatio
    pageWidth = Math.min(containerWidth, widthFromHeight)
  } else {
    // Custom mode: scale is relative to original page width
    pageWidth = originalPageWidth > 0 ? originalPageWidth * scale : containerWidth * scale
  }

  function getZoomLabel(): string {
    const effectivePercent = Math.round(getEffectiveScale() * 100)
    return `${effectivePercent}%`
  }

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
            onClick={toggleSearch}
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
                closeSearch()
              }
            }}
          />
          <button onClick={closeSearch}>✕</button>
        </div>
      )}
      <div className="pdf-container" ref={containerRef}>
        <Document
          file={dataUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="pdf-loading">Loading PDF...</div>}
          error={<div className="pdf-error">Failed to load PDF</div>}
        >
          {Array.from(new Array(numPages), (_, index) => {
            const pageNum = index + 1
            const isVisible = visiblePages.has(pageNum)
            const dims = pageDimensions.get(pageNum)
            const scaledHeight = dims
              ? (pageWidth / dims.width) * dims.height
              : pageWidth / DEFAULT_ASPECT_RATIO

            return (
              <div key={`page_${pageNum}`} ref={setPageRef(pageNum)} className="pdf-page-wrapper" data-page-number={pageNum}>
                {isVisible ? (
                  <Page
                    pageNumber={pageNum}
                    width={pageWidth}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    customTextRenderer={searchText ? createSearchHighlighter(searchText) : undefined}
                    loading={
                      <div className="pdf-page-placeholder" style={{ width: pageWidth, height: scaledHeight }}>
                        <div className="pdf-page-spinner" />
                      </div>
                    }
                  />
                ) : (
                  <div
                    className="pdf-page-placeholder"
                    style={{ width: pageWidth, height: scaledHeight }}
                  />
                )}
              </div>
            )
          })}
        </Document>
      </div>
    </div>
  )
}
