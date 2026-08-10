import jsPDF from 'jspdf'

// jsPDF's .html() draws real (searchable) PDF text rather than a raster
// image, using whichever font family the source element resolves to. Its
// own built-in "standard 14" fonts (Helvetica etc.) only cover WinAnsi
// (Latin-1) — any Cyrillic character silently renders as garbage glyphs.
// PT Sans (SIL OFL, public/fonts/) has full Cyrillic coverage.
const FONT_FAMILY = 'PT Sans'
const FONT_REGULAR_URL = '/fonts/PTSans-Regular.ttf'
const FONT_BOLD_URL = '/fonts/PTSans-Bold.ttf'

// Pre-fetched once and cached: if left to jsPDF's own `fontFaces` auto-load,
// it fetches the font via a *synchronous* XHR wrapped in a bare
// `try { ... } catch (e) {}` (see jspdf's fileloading plugin) — any failure
// there (blocked sync XHR, network hiccup) is silently swallowed, and the
// font lookup that follows throws deep inside the render pipeline with
// nothing hooked up to catch it, hanging renderHtmlToPdf's promise forever
// with no error and no output. Fetching the TTFs ourselves with a normal
// (async, real-error-surfacing) fetch and registering them in jsPDF's VFS
// under the exact same URL it would have looked up avoids that path
// entirely — jsPDF finds them already in the VFS and never touches loadFile.
let fontsPromise: Promise<{ regular: string; bold: string }> | null = null

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load font ${url}: ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function loadFonts(): Promise<{ regular: string; bold: string }> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([fetchFontBase64(FONT_REGULAR_URL), fetchFontBase64(FONT_BOLD_URL)]).then(
      ([regular, bold]) => ({ regular, bold }),
    )
  }
  return fontsPromise
}

// Draws one page's HTML into an already-set-up jsPDF document at its current
// page (doc.html() always targets the "current" page — callers wanting more
// than one page must doc.addPage() between calls). Factored out of
// renderHtmlToPdf so renderHtmlPagesToPdf can reuse it across pages of one
// document instead of creating a new jsPDF (and re-registering fonts) per page.
function renderPageIntoDoc(doc: jsPDF, innerHTML: string): Promise<void> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    // html2canvas renders the whole document onto a canvas whose origin is
    // (0,0) — a container positioned at a negative offset (as this used to
    // be, `left: -9999px`) lies entirely outside that canvas's drawable
    // region, so every capture came out blank. Keeping it at a non-negative
    // offset but behind everything else (negative z-index) keeps it out of
    // the user's view without moving it out of the capturable area.
    container.style.position = 'absolute'
    container.style.left = '0'
    container.style.top = '0'
    container.style.zIndex = '-1000'
    container.style.width = '650px'
    container.style.padding = '32px'
    container.style.fontFamily = `'${FONT_FAMILY}', Arial, sans-serif`
    container.style.fontSize = '14px'
    container.style.color = '#111827'
    container.innerHTML = innerHTML
    document.body.appendChild(container)

    doc.html(container, {
      margin: [40, 40, 40, 40],
      html2canvas: { scale: 0.75 },
      fontFaces: [
        { family: FONT_FAMILY, weight: 'normal', src: [{ url: FONT_REGULAR_URL, format: 'truetype' }] },
        { family: FONT_FAMILY, weight: 'bold', src: [{ url: FONT_BOLD_URL, format: 'truetype' }] },
      ],
      callback: () => {
        document.body.removeChild(container)
        resolve()
      },
    })
  })
}

function newPdfDoc(fonts: { regular: string; bold: string }): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.addFileToVFS(FONT_REGULAR_URL, fonts.regular)
  doc.addFileToVFS(FONT_BOLD_URL, fonts.bold)
  return doc
}

// Rasterizes an off-screen HTML node into a jsPDF document via jsPDF's
// html() (html2canvas-backed layout, native-text-drawing) path.
export async function renderHtmlToPdf(innerHTML: string): Promise<jsPDF> {
  const fonts = await loadFonts()
  const doc = newPdfDoc(fonts)
  await renderPageIntoDoc(doc, innerHTML)
  return doc
}

// Same as renderHtmlToPdf but for a document authored as several
// independent pages (e.g. a multi-page contract) — each entry becomes its
// own PDF page, in order, all sharing one set of registered fonts.
export async function renderHtmlPagesToPdf(pagesHtml: string[]): Promise<jsPDF> {
  const fonts = await loadFonts()
  const doc = newPdfDoc(fonts)
  for (let i = 0; i < pagesHtml.length; i++) {
    if (i > 0) doc.addPage()
    await renderPageIntoDoc(doc, pagesHtml[i])
  }
  return doc
}
