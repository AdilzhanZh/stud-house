import { renderHtmlPagesToPdf } from './pdf'
import { getPetitionTemplate } from '../api/petitionTemplateApi'
import { formatDate } from './dateFormat'

export interface PetitionFieldValues {
  full_name: string
  study_group: string
  hometown: string
  phone_self: string
  parent_contact: string
  dormitory_name: string
  date?: string
}

// The saved template stores each variable as
// <span class="petition-var" data-token="{{full_name}}">Аты-жөні</span> —
// the token lives in the data-token attribute, not the visible label text,
// so a plain string replace on "{{full_name}}" would never match anything.
// Parsing and swapping the element out for a real text node also means the
// filled-in PDF shows the student's name as plain text, not a chip.
function fillPetitionTemplate(pages: string[], values: Required<PetitionFieldValues>): string[] {
  return pages.map((page) => {
    const container = document.createElement('div')
    container.innerHTML = page
    container.querySelectorAll<HTMLElement>('.petition-var').forEach((el) => {
      const token = el.getAttribute('data-token') ?? ''
      const key = token.replace(/^\{\{|\}\}$/g, '') as keyof PetitionFieldValues
      el.replaceWith(document.createTextNode(values[key] ?? ''))
    })
    return container.innerHTML
  })
}

async function renderPetition(values: PetitionFieldValues) {
  const template = await getPetitionTemplate()
  const filled = fillPetitionTemplate(template.pages, {
    ...values,
    date: values.date ?? formatDate(new Date()),
  })
  return renderHtmlPagesToPdf(filled)
}

// Used by the manager's per-application "Download" button (queue page) and
// the student's own auto-generated copy at submission time.
export async function downloadPetitionPdf(values: PetitionFieldValues, filename: string): Promise<void> {
  const doc = await renderPetition(values)
  doc.save(filename)
}

export async function generatePetitionPdfBlob(values: PetitionFieldValues): Promise<Blob> {
  const doc = await renderPetition(values)
  return doc.output('blob')
}
