import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Alert } from './Alert'
import { renderHtmlPagesToSheetImages } from '../utils/pdf'
import type { FilledDocument } from '../utils/pdf'

// Read-only view of a filled-in document, one A4 sheet at a time. The sheets
// are images of the PDF's own sheets (see renderHtmlPagesToSheetImages), so
// what's on screen is what downloads: same page breaks, same two-per-sheet.
interface TemplatePagesProps {
  document: FilledDocument
}

interface Sheets {
  urls: string[]
  widthPt: number
  heightPt: number
}

function SheetCarousel({ sheets }: { sheets: Sheets }) {
  const { t } = useTranslation()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const total = sheets.urls.length

  function goTo(index: number) {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollTo({ left: index * scroller.clientWidth, behavior: 'smooth' })
  }

  function handleScroll() {
    const scroller = scrollerRef.current
    if (!scroller) return
    setActive(Math.round(scroller.scrollLeft / scroller.clientWidth))
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' && active > 0) {
      e.preventDefault()
      goTo(active - 1)
    }
    if (e.key === 'ArrowRight' && active < total - 1) {
      e.preventDefault()
      goTo(active + 1)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={scrollerRef}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sheets.urls.map((url, i) => (
          <div key={url} className="flex w-full shrink-0 snap-center justify-center">
            <img
              src={url}
              alt={t('documentViewer.sheetOf', { current: i + 1, total })}
              className="h-auto w-full bg-white"
              style={{
                aspectRatio: `${sheets.widthPt} / ${sheets.heightPt}`,
                // 96 CSS px to the inch, 72 pt: the sheet's actual printed size.
                maxWidth: `${(sheets.widthPt * 96) / 72}px`,
              }}
            />
          </div>
        ))}
      </div>

      {total > 1 && (
        <div className="sticky bottom-3 flex justify-center">
          <div className="flex items-center gap-1 rounded-full bg-navy-900 px-1.5 py-1 shadow-[var(--shadow-card)]">
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              aria-label={t('documentViewer.previousSheet')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-sand-200 hover:bg-navy-800 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex flex-wrap items-center justify-center">
              {sheets.urls.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={t('documentViewer.goToSheet', { page: i + 1 })}
                  aria-current={i === active ? 'page' : undefined}
                  className="flex h-6 w-4 items-center justify-center"
                >
                  <span
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i === active ? 'bg-turquoise-400' : 'bg-sand-400/40'
                    }`}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              disabled={active === total - 1}
              aria-label={t('documentViewer.nextSheet')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-sand-200 hover:bg-navy-800 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function TemplatePages({ document }: TemplatePagesProps) {
  const { t } = useTranslation()
  const [sheets, setSheets] = useState<Sheets | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let urls: string[] = []
    setSheets(null)
    setFailed(false)
    renderHtmlPagesToSheetImages(document.pages, { twoPagesPerSheet: document.twoPagesPerSheet })
      .then(({ images, widthPt, heightPt }) => {
        if (cancelled) return
        urls = images.map((image) => URL.createObjectURL(image))
        setSheets({ urls, widthPt, heightPt })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [document])

  return (
    <div className="rounded-2xl bg-navy-950/40 p-4">
      {failed && <Alert variant="error" message={t('documentViewer.renderFailed')} />}
      {!failed && !sheets && <p className="text-sm text-sand-300">{t('documentViewer.rendering')}</p>}
      {sheets && <SheetCarousel key={sheets.urls[0]} sheets={sheets} />}
    </div>
  )
}
