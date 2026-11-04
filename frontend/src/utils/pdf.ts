import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// A4 in pt (jsPDF's 'pt' unit), matching the `format: 'a4'` doc below.
const PAGE_WIDTH_PT = 595.28
const PAGE_HEIGHT_PT = 841.89

// Where a document's pages land on its sheets: `slotsPerSheet` slots of
// slotWidthPt x slotHeightPt side by side, each holding one page's image.
interface SheetLayout {
  orientation: 'portrait' | 'landscape'
  slotsPerSheet: number
  marginPt: number
  gutterPt: number
  slotWidthPt: number
  slotHeightPt: number
  containerWidthPx: number
  containerPadding: string
  lineHeight: string
}

const ONE_PAGE_MARGIN_PT = 40
const ONE_PAGE_PER_SHEET: SheetLayout = {
  orientation: 'portrait',
  slotsPerSheet: 1,
  marginPt: ONE_PAGE_MARGIN_PT,
  gutterPt: 0,
  slotWidthPt: PAGE_WIDTH_PT - ONE_PAGE_MARGIN_PT * 2,
  slotHeightPt: PAGE_HEIGHT_PT - ONE_PAGE_MARGIN_PT * 2,
  // Matches TemplatePages' on-screen page width (w-[794px]) so the exported
  // PDF wraps text the same way the student already saw it on screen.
  containerWidthPx: 794,
  containerPadding: '76px 96px',
  lineHeight: '1.6',
}

const TWO_PAGE_MARGIN_PT = 20
const TWO_PAGE_GUTTER_PT = 20
const TWO_PAGES_PER_SHEET: SheetLayout = {
  orientation: 'landscape',
  slotsPerSheet: 2,
  marginPt: TWO_PAGE_MARGIN_PT,
  gutterPt: TWO_PAGE_GUTTER_PT,
  slotWidthPt: (PAGE_HEIGHT_PT - TWO_PAGE_MARGIN_PT * 2 - TWO_PAGE_GUTTER_PT) / 2,
  slotHeightPt: PAGE_WIDTH_PT - TWO_PAGE_MARGIN_PT * 2,
  // The sheet's own margins replace the container's padding. This width makes
  // the templates' 14px text come out at 8pt, against 9pt on a full page, which
  // fits nearly a full page's text into each half sheet.
  containerWidthPx: 684,
  containerPadding: '0',
  lineHeight: '1.4',
}

export interface PdfOptions {
  twoPagesPerSheet?: boolean
}

// Supersampling factor for html2canvas — higher than 1 keeps rasterized
// text crisp at PDF/print resolution instead of looking like a low-res
// screenshot.
const RENDER_SCALE = 2

// Renders one HTML "page" string into an off-screen container and
// rasterizes it with html2canvas, then adds the result to `doc` as one or
// more images, slicing the canvas whenever the content is taller than one
// slot, starting from slot number `firstSlot`. Returns the next free slot.
//
// This intentionally avoids jsPDF's own doc.html()/context2d autoPaging:
// that path silently desyncs once a custom html2canvas.scale is passed (as
// this used to do) — it draws real vector text via an internal
// pixel-to-pt scale computed from `options.width`/`options.windowWidth`,
// which defaults to 1 unless both are set, while a separately-scaled
// html2canvas render produces a canvas whose actual pixel dimensions no
// longer match that assumed 1:1 ratio. The two "scales" (jsPDF's placement
// math vs. html2canvas's render resolution) drift apart, and the visible
// symptom is exactly what autoPaging produces when its slice boundaries no
// longer line up with the real content: only part of a tall page — the
// downloaded contract's later "half" — actually lands in the PDF.
// Rasterizing here and slicing the canvas ourselves, one page at a time,
// removes that whole class of bug: page boundaries are computed from the
// canvas we actually produced, not inferred from mismatched options.
// Moves a page break up to the nearest fully white pixel row, the gap between
// two lines of text, so that a long document isn't sliced through a line. If
// there's no such gap within the last 15% of the page (a large image, say), the
// break stays where it was.
function findPageBreak(canvas: HTMLCanvasElement, startPx: number, pageHeightPx: number): number {
  const idealBreakPx = startPx + pageHeightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) return idealBreakPx

  const searchHeightPx = Math.floor(pageHeightPx * 0.15)
  const searchTopPx = idealBreakPx - searchHeightPx
  const { data } = ctx.getImageData(0, searchTopPx, canvas.width, searchHeightPx)
  const bytesPerRow = canvas.width * 4

  for (let row = searchHeightPx - 1; row >= 0; row--) {
    let isWhite = true
    for (let i = row * bytesPerRow; i < (row + 1) * bytesPerRow; i++) {
      if (data[i] < 250) {
        isWhite = false
        break
      }
    }
    if (isWhite) return searchTopPx + row + 1
  }
  return idealBreakPx
}

async function renderPageIntoDoc(
  doc: jsPDF,
  innerHTML: string,
  layout: SheetLayout,
  firstSlot: number,
): Promise<number> {
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '0'
  container.style.top = '0'
  container.style.zIndex = '-1000'
  container.style.width = `${layout.containerWidthPx}px`
  container.style.padding = layout.containerPadding
  container.style.background = '#ffffff'
  container.style.fontFamily = `'Times New Roman', Georgia, serif`
  container.style.fontSize = '14px'
  container.style.lineHeight = layout.lineHeight
  container.style.color = '#111827'
  container.innerHTML = innerHTML
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: RENDER_SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
    })

    const pxToPt = layout.slotWidthPt / layout.containerWidthPx
    const pageHeightPx = Math.floor((layout.slotHeightPt / pxToPt) * RENDER_SCALE)

    let offsetPx = 0
    let slot = firstSlot
    while (offsetPx < canvas.height) {
      const remainingPx = canvas.height - offsetPx
      const sliceHeightPx =
        remainingPx > pageHeightPx ? findPageBreak(canvas, offsetPx, pageHeightPx) - offsetPx : remainingPx

      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceHeightPx
      const ctx = sliceCanvas.getContext('2d')
      if (!ctx) break
      ctx.drawImage(canvas, 0, offsetPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)

      if (slot > 0 && slot % layout.slotsPerSheet === 0) {
        doc.addPage('a4', layout.orientation)
      }
      const slotOnSheet = slot % layout.slotsPerSheet
      const imgHeightPt = (sliceHeightPx / RENDER_SCALE) * pxToPt
      // 'FAST' compression: left uncompressed, each page is about 11 MB.
      doc.addImage(
        sliceCanvas.toDataURL('image/png'),
        'PNG',
        layout.marginPt + slotOnSheet * (layout.slotWidthPt + layout.gutterPt),
        layout.marginPt,
        layout.slotWidthPt,
        imgHeightPt,
        undefined,
        'FAST',
      )

      offsetPx += sliceHeightPx
      slot += 1
    }
    return slot
  } finally {
    document.body.removeChild(container)
  }
}

// Rasterizes an off-screen HTML node into a jsPDF document, page by page.
export async function renderHtmlToPdf(innerHTML: string): Promise<jsPDF> {
  return renderHtmlPagesToPdf([innerHTML])
}

// Same as renderHtmlToPdf but for a document authored as several
// independent pages (e.g. a multi-page contract) — each entry starts on
// its own PDF page (and may itself span more, if its content overflows one
// physical page), all appended to one document.
export async function renderHtmlPagesToPdf(pagesHtml: string[], options: PdfOptions = {}): Promise<jsPDF> {
  const layout = options.twoPagesPerSheet ? TWO_PAGES_PER_SHEET : ONE_PAGE_PER_SHEET
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: layout.orientation })
  let slot = 0
  for (const pageHtml of pagesHtml) {
    slot = await renderPageIntoDoc(doc, pageHtml, layout, slot)
  }
  return doc
}
