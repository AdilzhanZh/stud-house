import { renderHtmlPagesToPdf } from './pdf'
import { getContractTemplate } from '../api/contractTemplateApi'
import { formatDate } from './dateFormat'
import type { ContractLanguage } from '../api/contractTemplateApi'

export interface ContractFieldValues {
  student_full_name: string
  student_iin: string
  student_phone: string
  study_group: string
  room_number: string
  dormitory_name: string
  dormitory_address: string
  monthly_payment_bachelor: string
  monthly_payment_master: string
  monthly_payment_doctorate: string
  yearly_payment_bachelor: string
  yearly_payment_master: string
  yearly_payment_doctorate: string
  date?: string
}

// The saved template stores each variable as
// <span class="contract-var" data-token="{{student_full_name}}">Label</span>
// — same chip mechanism as the petition/protocol templates (see
// petitionPdf.ts's fillPetitionTemplate). Parsing and swapping the element
// out for a real text node means the filled document shows plain text, not
// a chip, both on screen and in the exported PDF.
export function fillContractTemplate(pages: string[], values: Required<ContractFieldValues>): string[] {
  return pages.map((page) => {
    const container = document.createElement('div')
    container.innerHTML = page
    container.querySelectorAll<HTMLElement>('.contract-var').forEach((el) => {
      const token = el.getAttribute('data-token') ?? ''
      const key = token.replace(/^\{\{|\}\}$/g, '') as keyof ContractFieldValues
      el.replaceWith(document.createTextNode(values[key] ?? ''))
    })
    return container.innerHTML
  })
}

async function loadFilledContractPages(values: ContractFieldValues, language: ContractLanguage): Promise<string[]> {
  const template = await getContractTemplate(language)
  return fillContractTemplate(template.pages, {
    ...values,
    date: values.date ?? formatDate(new Date()),
  })
}

// Used by both the student's own contract view and the admin's per-contract
// detail page — the filled pages are shared between on-screen rendering
// (TemplatePages) and PDF export. A contract always exists in both
// languages, so callers pass whichever one the viewer currently wants.
export async function getFilledContractPages(
  values: ContractFieldValues,
  language: ContractLanguage,
): Promise<string[]> {
  return loadFilledContractPages(values, language)
}

export async function downloadContractPdf(
  values: ContractFieldValues,
  filename: string,
  language: ContractLanguage,
): Promise<void> {
  const pages = await loadFilledContractPages(values, language)
  const doc = await renderHtmlPagesToPdf(pages)
  doc.save(filename)
}
