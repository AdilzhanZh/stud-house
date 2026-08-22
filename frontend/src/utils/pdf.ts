import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// A4 in pt (jsPDF's 'pt' unit), matching the `format: 'a4'` doc below.
const PAGE_WIDTH_PT = 595.28
const PAGE_HEIGHT_PT = 841.89
const MARGIN_PT = 40
const CONTENT_WIDTH_PT = PAGE_WIDTH_PT - MARGIN_PT * 2
const CONTENT_HEIGHT_PT = PAGE_HEIGHT_PT - MARGIN_PT * 2

// Matches TemplatePages' on-screen page width (w-[794px]) so the exported
// PDF wraps text the same way the student already saw it on screen.
const CONTAINER_WIDTH_PX = 794
// Supersampling factor for html2canvas — higher than 1 keeps rasterized
// text crisp at PDF/print resolution instead of looking like a low-res
// screenshot.
const RENDER_SCALE = 2

// Renders one HTML "page" string into an off-screen container and
// rasterizes it with html2canvas, then adds the result to `doc` as one or
// more image pages, slicing the canvas whenever the content is taller than
// a single A4 page.
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
async function renderPageIntoDoc(doc: jsPDF, innerHTML: string, isFirstPageOfDoc: boolean): Promise<void> {
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '0'
  container.style.top = '0'
  container.style.zIndex = '-1000'
  container.style.width = `${CONTAINER_WIDTH_PX}px`
  container.style.padding = '76px 96px'
  container.style.background = '#ffffff'
  container.style.fontFamily = `'Times New Roman', Georgia, serif`
  container.style.fontSize = '14px'
  container.style.lineHeight = '1.6'
  container.style.color = '#111827'
  container.innerHTML = innerHTML
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: RENDER_SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
    })

    const pxToPt = CONTENT_WIDTH_PT / CONTAINER_WIDTH_PX
    const pageHeightPx = Math.floor((CONTENT_HEIGHT_PT / pxToPt) * RENDER_SCALE)

    let offsetPx = 0
    let firstSlice = true
    while (offsetPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - offsetPx)

      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceHeightPx
      const ctx = sliceCanvas.getContext('2d')
      if (!ctx) break
      ctx.drawImage(canvas, 0, offsetPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)

      if (!(isFirstPageOfDoc && firstSlice)) {
        doc.addPage()
      }
      const imgHeightPt = (sliceHeightPx / RENDER_SCALE) * pxToPt
      doc.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', MARGIN_PT, MARGIN_PT, CONTENT_WIDTH_PT, imgHeightPt)

      offsetPx += sliceHeightPx
      firstSlice = false
    }
  } finally {
    document.body.removeChild(container)
  }
}

// Rasterizes an off-screen HTML node into a jsPDF document, page by page.
export async function renderHtmlToPdf(innerHTML: string): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  await renderPageIntoDoc(doc, innerHTML, true)
  return doc
}

// Same as renderHtmlToPdf but for a document authored as several
// independent pages (e.g. a multi-page contract) — each entry starts on
// its own PDF page (and may itself span more, if its content overflows one
// physical page), all appended to one document.
export async function renderHtmlPagesToPdf(pagesHtml: string[]): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  for (let i = 0; i < pagesHtml.length; i++) {
    await renderPageIntoDoc(doc, pagesHtml[i], i === 0)
  }
  return doc
}
