const ALLOWED_TAGS = new Set([
  'P', 'DIV', 'SPAN', 'BR', 'HR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SUB', 'SUP', 'FONT',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'COL', 'COLGROUP',
])
// Removed with their contents; any other unknown tag keeps its text.
const REMOVED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'SVG', 'MATH', 'TEMPLATE',
  'NOSCRIPT', 'NOEMBED', 'NOFRAMES', 'XMP', 'TITLE', 'TEXTAREA', 'IMG', 'VIDEO', 'AUDIO', 'FORM',
])
const ALLOWED_ATTRIBUTES = new Set(['style', 'class', 'data-token', 'contenteditable', 'colspan', 'rowspan', 'align', 'color', 'size', 'face'])

function clean(parent: Element) {
  for (const element of Array.from(parent.children)) {
    if (REMOVED_TAGS.has(element.tagName.toUpperCase())) {
      element.remove()
      continue
    }
    clean(element)
    if (!ALLOWED_TAGS.has(element.tagName.toUpperCase())) {
      element.replaceWith(...Array.from(element.childNodes))
      continue
    }
    for (const attribute of Array.from(element.attributes)) {
      if (!ALLOWED_ATTRIBUTES.has(attribute.name.toLowerCase())) element.removeAttribute(attribute.name)
    }
  }
}

// The referral template opens on a public page, for anyone with a QR code, and in
// the browser of a signed-in student or manager. Whatever got saved into it must
// not run there. DOMParser's document is inert: no script runs and nothing loads.
export function sanitizeTemplateHtml(html: string): string {
  const { body } = new DOMParser().parseFromString(html, 'text/html')
  clean(body)
  return body.innerHTML
}
