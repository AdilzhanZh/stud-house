import { renderHtmlPagesToPdf } from './pdf'
import type { FilledDocument } from './pdf'
import { getProtocolTemplate } from '../api/protocolTemplateApi'
import { formatDate } from './dateFormat'

export interface ProtocolStudentEntry {
  name: string
  dormitoryName: string
  studyGroup: string
}

export interface ProtocolFieldValues {
  protocolNumber: number
  protocolDate?: string
  // The selected students for the "Қаулы етілді" resolution list. Each renders
  // as "name — study group", or just the name if the group isn't known.
  // getFilledProtocolDocument sorts them.
  students: ProtocolStudentEntry[]
}

const STUDENT_LIST_COLUMNS = 2

// Sorted by dormitory, then name, so the numbering is the same however the
// list was gathered: the PDF made on creation matches the detail page's.
export function sortProtocolStudents<T>(
  students: T[],
  dormitoryName: (student: T) => string,
  name: (student: T) => string,
): T[] {
  return [...students].sort(
    (a, b) =>
      dormitoryName(a).localeCompare(dormitoryName(b), 'kk') || name(a).localeCompare(name(b), 'kk'),
  )
}

// A table, because a protocol can list hundreds of students: two numbered
// entries per row, read left to right, keep it to far fewer sheets.
function buildStudentListTable(students: ProtocolStudentEntry[]): HTMLTableElement {
  const table = document.createElement('table')
  table.style.width = '100%'
  table.style.tableLayout = 'fixed'
  table.style.borderCollapse = 'collapse'
  const tbody = table.createTBody()

  for (let start = 0; start < students.length; start += STUDENT_LIST_COLUMNS) {
    const row = tbody.insertRow()
    for (let i = start; i < start + STUDENT_LIST_COLUMNS; i++) {
      const cell = row.insertCell()
      cell.style.width = `${100 / STUDENT_LIST_COLUMNS}%`
      cell.style.padding = '0 12px 2px 0'
      cell.style.verticalAlign = 'top'
      if (i < students.length) {
        const { name, studyGroup } = students[i]
        cell.textContent = `${i + 1}. ${name}${studyGroup ? ` — ${studyGroup}` : ''};`
      }
    }
  }
  return table
}

// A table can't live inside a <p>: the browser would close the paragraph when
// the saved HTML is parsed again, so it goes right after one instead.
function replaceWithStudentList(el: HTMLElement, table: HTMLTableElement) {
  const parent = el.parentElement
  if (parent?.tagName !== 'P') {
    el.replaceWith(table)
    return
  }
  el.remove()
  parent.after(table)
  if (!parent.textContent?.trim()) parent.remove()
}

// The saved template stores {{student_list}} as
// <span class="protocol-var" data-token="{{student_list}}">...</span> —
// unlike every other token (a single value swapped in as plain text), this
// one expands into a whole table of selected students, so it's handled
// separately from the rest. Applied per page since a template can now span
// more than one.
function fillProtocolTemplate(pages: string[], values: Required<ProtocolFieldValues>): string[] {
  return pages.map((page) => {
    const container = document.createElement('div')
    container.innerHTML = page
    container.querySelectorAll<HTMLElement>('.protocol-var').forEach((el) => {
      const token = el.getAttribute('data-token') ?? ''
      const key = token.replace(/^\{\{|\}\}$/g, '')

      if (key === 'student_list') {
        replaceWithStudentList(el, buildStudentListTable(values.students))
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
export async function getFilledProtocolDocument(values: ProtocolFieldValues): Promise<FilledDocument> {
  const template = await getProtocolTemplate()
  return { pages: fillWithDefaults(template.pages, values), twoPagesPerSheet: template.two_pages_per_sheet }
}

function fillWithDefaults(pages: string[], values: ProtocolFieldValues): string[] {
  return fillProtocolTemplate(pages, {
    ...values,
    students: sortProtocolStudents(
      values.students,
      (s) => s.dormitoryName,
      (s) => s.name,
    ),
    protocolDate: values.protocolDate ?? formatDate(new Date()),
  })
}

export async function downloadProtocolPdf(values: ProtocolFieldValues, filename: string): Promise<void> {
  const template = await getProtocolTemplate()
  const doc = await renderHtmlPagesToPdf(fillWithDefaults(template.pages, values), {
    twoPagesPerSheet: template.two_pages_per_sheet,
  })
  doc.save(filename)
}
