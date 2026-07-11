import jsPDF from 'jspdf'

// Rasterizes an off-screen HTML node into a jsPDF document via jsPDF's
// html() (html2canvas-backed) path — jsPDF's built-in fonts don't cover
// Cyrillic, but rendering through the browser's own font stack does.
export function renderHtmlToPdf(innerHTML: string): Promise<jsPDF> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.style.width = '650px'
    container.style.padding = '32px'
    container.style.fontFamily = 'Arial, sans-serif'
    container.style.fontSize = '14px'
    container.style.color = '#111827'
    container.innerHTML = innerHTML
    document.body.appendChild(container)

    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    doc.html(container, {
      margin: [40, 40, 40, 40],
      html2canvas: { scale: 0.75 },
      callback: (rendered) => {
        document.body.removeChild(container)
        resolve(rendered)
      },
    })
  })
}
