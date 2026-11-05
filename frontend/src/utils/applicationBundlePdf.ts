import type { PDFDocument } from 'pdf-lib'
import { apiClient } from '../api/client'
import { getApplication } from '../api/applicationApi'
import { createPetitionRenderer, PETITION_RECEIPT_DOCUMENT_NAME, type PetitionFieldValues } from './petitionPdf'
import type { ApplicationDocument } from '../types/applications'

const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89
const IMAGE_MARGIN_PT = 20
// About 200 dpi on A4: readable once printed, without a phone photo's megabytes.
const IMAGE_MAX_SIDE_PX = 2200
const IMAGE_JPEG_QUALITY = 0.85
const PDF_RASTER_DPI = 200

export interface ApplicationBundleEntry {
  applicationId: string
  studentName: string
  petition: PetitionFieldValues
}

// A document that isn't in the PDF, so that the manager can get it another way.
// documentName is null when the student's document list itself couldn't load.
export interface SkippedDocument {
  studentName: string
  documentName: string | null
}

// What goes on paper for one application. The automatic petition copy is left
// out because the petition is rendered fresh, and only the newest upload for a
// required document counts: a re-upload leaves the old row in place, and the
// backend's checks likewise only look at the latest one.
export function documentsToPrint(documents: ApplicationDocument[]): ApplicationDocument[] {
  const latestBySlot = new Map<string, ApplicationDocument>()
  const sorted = [...documents].sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at))
  for (const doc of sorted) {
    if (doc.document_name === PETITION_RECEIPT_DOCUMENT_NAME) continue
    latestBySlot.set(doc.benefit_required_document_id ?? doc.dormitory_required_document_id ?? doc.id, doc)
  }
  return [...latestBySlot.values()]
}

// Stored URLs are absolute and keep the host they were uploaded through, which
// may not be this one, so our own files are always fetched via the API's base
// URL. Anything else is a link the student pasted: it gets a plain fetch, which
// must not carry our auth header, and which that site's CORS rules may refuse.
async function fetchDocument(fileUrl: string): Promise<ArrayBuffer> {
  const { pathname } = new URL(fileUrl, window.location.origin)
  const uploadName = pathname.match(/\/api\/v1\/uploads\/([^/]+)$/)?.[1]
  if (uploadName) {
    const { data } = await apiClient.get<ArrayBuffer>(`/uploads/${uploadName}`, { responseType: 'arraybuffer' })
    return data
  }
  const response = await fetch(fileUrl)
  if (!response.ok) throw new Error(`Could not fetch the document: ${response.status}`)
  return response.arrayBuffer()
}

function isPdf(bytes: ArrayBuffer): boolean {
  // The PDF format allows some junk before its header, within the first 1024 bytes.
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 1024))
  return head.includes('%PDF-')
}

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))),
      'image/jpeg',
      IMAGE_JPEG_QUALITY,
    )
  })
  return jpeg.arrayBuffer()
}

// Some PDFs are locked against editing but open and print without a password,
// and pdf-lib can't read those. pdf.js can, so their pages go in as images.
// Pages are only added once all of them have rendered, so that a failure can't
// leave half a document in the file. A PDF that needs a password, or that
// forbids printing, throws here and is reported like any other skipped document.
async function appendPdfAsImages(target: PDFDocument, bytes: ArrayBuffer): Promise<void> {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  // A copy, because pdf.js hands the buffer it's given over to its worker.
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false })
  try {
    const source = await loadingTask.promise
    const permissions = await source.getPermissions()
    if (permissions && !permissions.includes(pdfjs.PermissionFlag.PRINT)) {
      throw new Error('The PDF does not allow printing')
    }

    const rendered: { jpeg: ArrayBuffer; widthPt: number; heightPt: number }[] = []
    for (let number = 1; number <= source.numPages; number++) {
      const page = await source.getPage(number)
      const { width: widthPt, height: heightPt } = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: PDF_RASTER_DPI / 72 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not draw the page')
      await page.render({ canvasContext: ctx, viewport }).promise
      rendered.push({ jpeg: await canvasToJpeg(canvas), widthPt, heightPt })
    }

    for (const { jpeg, widthPt, heightPt } of rendered) {
      const image = await target.embedJpg(jpeg)
      target.addPage([widthPt, heightPt]).drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt })
    }
  } finally {
    await loadingTask.destroy()
  }
}

async function appendPdf(target: PDFDocument, bytes: ArrayBuffer): Promise<void> {
  const { PDFDocument } = await import('pdf-lib')
  let source: PDFDocument
  try {
    source = await PDFDocument.load(bytes)
  } catch {
    await appendPdfAsImages(target, bytes)
    return
  }
  const pages = await target.copyPages(source, source.getPageIndices())
  if (pages.length === 0) throw new Error('The PDF has no pages')
  pages.forEach((page) => target.addPage(page))
}

// Goes through the browser's decoder rather than embedding the file directly:
// that applies a phone photo's EXIF rotation, which would otherwise print
// sideways, and handles every image format the browser can read.
async function appendImage(target: PDFDocument, bytes: ArrayBuffer): Promise<void> {
  const bitmap = await createImageBitmap(new Blob([bytes]))
  try {
    const scale = Math.min(1, IMAGE_MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not draw the image')
    // JPEG has no transparency: without this, a transparent PNG prints black.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const image = await target.embedJpg(await canvasToJpeg(canvas))

    const isLandscape = image.width > image.height
    const pageWidth = isLandscape ? A4_HEIGHT_PT : A4_WIDTH_PT
    const pageHeight = isLandscape ? A4_WIDTH_PT : A4_HEIGHT_PT
    const fit = Math.min(
      (pageWidth - IMAGE_MARGIN_PT * 2) / image.width,
      (pageHeight - IMAGE_MARGIN_PT * 2) / image.height,
    )
    const width = image.width * fit
    const height = image.height * fit
    target.addPage([pageWidth, pageHeight]).drawImage(image, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    })
  } finally {
    bitmap.close()
  }
}

function saveFile(bytes: Uint8Array, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Not right away: some browsers only start reading the file after this returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// Downloads one PDF with each student's petition followed by that student's own
// documents, so that the printed stack stays in order. A document that can't be
// included (a Word file, a password-protected PDF, a missing file) doesn't stop
// the rest: it's returned, for the caller to tell the manager about.
export async function downloadPetitionsWithDocumentsPdf(
  entries: ApplicationBundleEntry[],
  filename: string,
  options: {
    documentLabel: (doc: ApplicationDocument) => string
    onProgress?: (done: number, total: number) => void
  },
): Promise<SkippedDocument[]> {
  // pdf-lib is only ever needed here, so it stays out of the main bundle.
  const { PDFDocument } = await import('pdf-lib')
  const merged = await PDFDocument.create()
  const renderPetition = await createPetitionRenderer()
  const skipped: SkippedDocument[] = []

  for (const [index, entry] of entries.entries()) {
    options.onProgress?.(index, entries.length)
    await appendPdf(merged, await renderPetition(entry.petition))

    let documents: ApplicationDocument[]
    try {
      documents = documentsToPrint((await getApplication(entry.applicationId)).documents)
    } catch {
      skipped.push({ studentName: entry.studentName, documentName: null })
      continue
    }

    for (const doc of documents) {
      try {
        const bytes = await fetchDocument(doc.file_url)
        await (isPdf(bytes) ? appendPdf(merged, bytes) : appendImage(merged, bytes))
      } catch {
        skipped.push({ studentName: entry.studentName, documentName: options.documentLabel(doc) })
      }
    }
  }

  saveFile(await merged.save(), filename)
  return skipped
}
