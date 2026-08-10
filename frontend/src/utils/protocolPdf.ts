import { renderHtmlPagesToPdf } from './pdf'
import { getProtocolTemplate } from '../api/protocolTemplateApi'
import { formatDate } from './dateFormat'

export interface ProtocolFieldValues {
  protocolNumber: number
  protocolDate?: string
  // Full names of the selected students, in the order they should be
  // numbered in the "Қаулы етілді" resolution list.
  studentNames: string[]
}

// The saved template stores {{student_list}} as
// <span class="protocol-var" data-token="{{student_list}}">...</span> —
// unlike every other token (a single value swapped in as plain text), this
// one expands into a whole numbered paragraph per selected student, so it's
// handled separately from the rest. Applied per page since a template can
// now span more than one.
function fillProtocolTemplate(pages: string[], values: Required<ProtocolFieldValues>): string[] {
  return pages.map((page) => {
    const container = document.createElement('div')
    container.innerHTML = page
    container.querySelectorAll<HTMLElement>('.protocol-var').forEach((el) => {
      const token = el.getAttribute('data-token') ?? ''
      const key = token.replace(/^\{\{|\}\}$/g, '')

      if (key === 'student_list') {
        const fragment = document.createDocumentFragment()
        values.studentNames.forEach((name, i) => {
          const p = document.createElement('p')
          p.style.margin = '0 0 2px'
          p.textContent = `${i + 1}. ${name};`
          fragment.appendChild(p)
        })
        el.replaceWith(fragment)
        return
      }

      const value =
        key === 'protocol_number'
          ? String(values.protocolNumber)
          : key === 'protocol_date'
            ? values.protocolDate
            : ''
      el.replaceWith(document.createTextNode(value))
    })
    return container.innerHTML
  })
}

// Fetches the current template and fills it in with real values — used both
// to build the downloadable PDF and to render an inline read-only "white
// pages" preview on ProtocolDetailPage, so viewing the full document no
// longer requires downloading it first.
export async function getFilledProtocolPages(values: ProtocolFieldValues): Promise<string[]> {
  const template = await getProtocolTemplate()
  return fillProtocolTemplate(template.pages, {
    ...values,
    protocolDate: values.protocolDate ?? formatDate(new Date()),
  })
}

export async function downloadProtocolPdf(values: ProtocolFieldValues, filename: string): Promise<void> {
  const filled = await getFilledProtocolPages(values)
  const doc = await renderHtmlPagesToPdf(filled)
  doc.save(filename)
}
