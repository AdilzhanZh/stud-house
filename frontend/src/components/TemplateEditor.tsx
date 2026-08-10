import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, AlignJustify, Plus, Trash2 } from 'lucide-react'
import { Button } from './Button'
import { ConfirmDialog } from './ConfirmDialog'

// document.execCommand is deprecated but remains the only cross-browser way
// to drive bold/italic/alignment on a plain contentEditable surface without
// pulling in a full rich-text editor library. It always targets whichever
// contentEditable page currently has focus, so it works unmodified across
// multiple page editors on one screen.
function exec(command: string) {
  document.execCommand(command)
}

export interface TemplateVariable {
  token: string
  label: string
}

export interface TemplateEditorHandle {
  getPages: () => string[]
}

interface TemplateEditorLabels {
  bold: string
  italic: string
  alignLeft: string
  alignCenter: string
  alignRight: string
  alignJustify: string
  chooseVariable: string
  insertVariable: string
  addPage: string
  deletePage: string
  deletePageConfirmTitle: string
  deletePageConfirmMessage: string
  pageLabel: (current: number, total: number) => string
}

interface TemplateEditorProps {
  initialPages: string[]
  variables: TemplateVariable[]
  pageClassName: string
  chipClassName: string
  labels: TemplateEditorLabels
}

interface PageEntry {
  key: string
  initialHtml: string
}

// Multi-page WYSIWYG editor shared by the petition, protocol, and contract
// template admin pages: toolbar (bold/italic/align), a variable picker that
// inserts a non-editable chip (`<span class={chipClassName} data-token=...>`)
// at the cursor, and per-page add/delete controls. Each caller owns its own
// data fetching, save call, and surrounding page chrome (title, hint,
// load/save alerts, last-saved footer) — this component only owns page
// content and exposes it via `getPages()` on save.
export const TemplateEditor = forwardRef<TemplateEditorHandle, TemplateEditorProps>(function TemplateEditor(
  { initialPages, variables, pageClassName, chipClassName, labels },
  ref,
) {
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const mountedKeys = useRef<Set<string>>(new Set())
  const nextKey = useRef(0)

  function makeKey() {
    nextKey.current += 1
    return `p${nextKey.current}`
  }

  const [pages, setPages] = useState<PageEntry[]>(() => initialPages.map((html) => ({ key: makeKey(), initialHtml: html })))
  const [activeKey, setActiveKey] = useState<string | null>(pages[0]?.key ?? null)
  const [selectedVariable, setSelectedVariable] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    getPages: () => pages.map((p) => pageRefs.current[p.key]?.innerHTML ?? ''),
  }))

  function insertVariable(token: string, label: string) {
    const key = activeKey
    const editor = key ? pageRefs.current[key] : null
    if (!editor) return
    editor.focus()
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
    const range = selection!.getRangeAt(0)
    range.deleteContents()
    const chip = document.createElement('span')
    chip.className = chipClassName
    chip.setAttribute('data-token', token)
    chip.setAttribute('contenteditable', 'false')
    chip.textContent = label
    range.insertNode(chip)
    range.setStartAfter(chip)
    range.setEndAfter(chip)
    selection!.removeAllRanges()
    selection!.addRange(range)
  }

  function handleInsertSelected() {
    const variable = variables.find((v) => v.token === selectedVariable)
    if (!variable) return
    insertVariable(variable.token, variable.label)
    setSelectedVariable('')
  }

  function handleAddPage() {
    const newEntry: PageEntry = { key: makeKey(), initialHtml: '' }
    const activeIndex = pages.findIndex((p) => p.key === activeKey)
    const insertAt = activeIndex === -1 ? pages.length : activeIndex + 1
    const next = [...pages.slice(0, insertAt), newEntry, ...pages.slice(insertAt)]
    setPages(next)
    setActiveKey(newEntry.key)
  }

  function handleDeletePage() {
    if (!deleteTarget) return
    const next = pages.filter((p) => p.key !== deleteTarget)
    delete pageRefs.current[deleteTarget]
    mountedKeys.current.delete(deleteTarget)
    setPages(next)
    if (activeKey === deleteTarget) {
      setActiveKey(next[0]?.key ?? null)
    }
    setDeleteTarget(null)
  }

  return (
    <>
      <style>{`
        .${pageClassName} {
          font-family: 'Times New Roman', Georgia, serif;
          color: #111827;
          font-size: 14px;
          line-height: 1.6;
        }
        .${pageClassName} .${chipClassName} {
          display: inline-block;
          padding: 1px 8px;
          margin: 0 2px;
          border-radius: 6px;
          background: #cdeae6;
          color: #0b4740;
          font-weight: 600;
          font-size: 0.92em;
          white-space: nowrap;
          cursor: default;
          user-select: none;
        }
        .${pageClassName}:focus {
          outline: none;
        }
      `}</style>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-navy-700 bg-navy-900 p-2">
        <button
          type="button"
          onClick={() => exec('bold')}
          title={labels.bold}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sand-200 hover:bg-navy-800"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('italic')}
          title={labels.italic}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sand-200 hover:bg-navy-800"
        >
          <Italic className="h-4 w-4" />
        </button>
        <span className="mx-1 h-6 w-px bg-navy-700" />
        <button
          type="button"
          onClick={() => exec('justifyLeft')}
          title={labels.alignLeft}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sand-200 hover:bg-navy-800"
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('justifyCenter')}
          title={labels.alignCenter}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sand-200 hover:bg-navy-800"
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('justifyRight')}
          title={labels.alignRight}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sand-200 hover:bg-navy-800"
        >
          <AlignRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('justifyFull')}
          title={labels.alignJustify}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sand-200 hover:bg-navy-800"
        >
          <AlignJustify className="h-4 w-4" />
        </button>
        <span className="mx-1 h-6 w-px bg-navy-700" />
        <select
          value={selectedVariable}
          onChange={(e) => setSelectedVariable(e.target.value)}
          className="rounded-lg border border-navy-700 bg-navy-950 px-3 py-2 text-sm text-sand-100 outline-none"
        >
          <option value="">{labels.chooseVariable}</option>
          {variables.map((v) => (
            <option key={v.token} value={v.token}>
              {v.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          className="!px-3 !py-2 text-sm"
          disabled={!selectedVariable}
          onClick={handleInsertSelected}
        >
          {labels.insertVariable}
        </Button>
        <span className="mx-1 h-6 w-px bg-navy-700" />
        <Button type="button" variant="secondary" className="!px-3 !py-2 text-sm" onClick={handleAddPage}>
          <Plus className="mr-1 inline h-4 w-4" />
          {labels.addPage}
        </Button>
      </div>

      <div className="flex flex-col items-center gap-4 overflow-x-auto rounded-2xl bg-navy-950/40 p-6">
        {pages.map((entry, i) => (
          <div key={entry.key} className="flex w-[794px] shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sand-300">{labels.pageLabel(i + 1, pages.length)}</span>
              <button
                type="button"
                onClick={() => setDeleteTarget(entry.key)}
                disabled={pages.length <= 1}
                title={labels.deletePage}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sand-300 hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div
              ref={(el) => {
                pageRefs.current[entry.key] = el
                if (el && !mountedKeys.current.has(entry.key)) {
                  el.innerHTML = entry.initialHtml
                  mountedKeys.current.add(entry.key)
                }
              }}
              onFocus={() => setActiveKey(entry.key)}
              contentEditable
              suppressContentEditableWarning
              className={`${pageClassName} min-h-[1050px] w-[794px] shrink-0 bg-white px-[96px] py-[76px] shadow-lg`}
            />
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={labels.deletePageConfirmTitle}
        message={labels.deletePageConfirmMessage}
        danger
        onConfirm={handleDeletePage}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
})
