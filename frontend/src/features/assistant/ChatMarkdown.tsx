import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

// In-app pages links may point to (frontend/src/App.tsx route prefixes).
const APP_PATH = /^\/(admin|applications|committee|contracts|dashboard|dormitories|my-residence|notifications)(\/|\?|$)/

function inAppPath(href: string): string | null {
  if (href.startsWith('/') && !href.startsWith('//')) return APP_PATH.test(href) ? href : null
  try {
    const url = new URL(href)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    const path = url.pathname + url.search
    return APP_PATH.test(path) ? path : null
  } catch {
    return null
  }
}

// A deliberately small Markdown subset for assistant replies: paragraphs,
// "-"/"1." lists, | tables |, **bold**, `code` and [links](/path). In-app paths become
// router links; anything else is shown as plain text (the assistant is only
// told to link in-app pages, so external URLs are never made clickable —
// except that an absolute URL whose path is one of this app's pages, e.g.
// one a model wrote with a made-up domain, is turned back into that page).
// A paragraph holding nothing but one in-app link is shown as a button.
export function ChatMarkdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let table: string[][] | null = null

  const flushTable = () => {
    if (!table) return
    const [head, ...body] = table
    blocks.push(
      <div key={blocks.length} className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {head.map((cell, i) => (
                <th key={i} className="border-b border-navy-700 px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                  {inline(cell, onNavigate)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r}>
                {row.map((cell, i) => (
                  <td key={i} className="border-b border-navy-700/60 px-2 py-1.5 tabular-nums">
                    {inline(cell, onNavigate)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    )
    table = null
  }

  const flush = () => {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    blocks.push(
      <Tag key={blocks.length} className={`ml-5 flex flex-col gap-1 ${list.ordered ? 'list-decimal' : 'list-disc'}`}>
        {list.items.map((item, i) => (
          <li key={i}>{inline(item, onNavigate)}</li>
        ))}
      </Tag>,
    )
    list = null
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('|') && line.endsWith('|') && line.length > 1) {
      flush()
      const cells = line.slice(1, -1).split('|').map((c) => c.trim())
      // The |---|---| separator row only marks the header; skip it.
      if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) (table ??= []).push(cells)
      continue
    }
    flushTable()
    const bullet = /^[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      const ordered = Boolean(numbered)
      if (list && list.ordered !== ordered) flush()
      list ??= { ordered, items: [] }
      list.items.push((bullet ?? numbered)![1])
      continue
    }
    flush()
    if (!line) continue
    const button = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(line)
    const buttonPath = button ? inAppPath(button[2]) : null
    if (button && buttonPath) {
      blocks.push(
        <Link
          key={blocks.length}
          to={buttonPath}
          onClick={onNavigate}
          className="inline-flex w-fit items-center rounded-xl bg-turquoise-500 px-3.5 py-2 text-sm font-semibold text-navy-950 hover:bg-turquoise-400"
        >
          {button[1]}
        </Link>,
      )
      continue
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    blocks.push(
      <p key={blocks.length} className={heading ? 'font-semibold' : undefined}>
        {inline(heading ? heading[1] : line, onNavigate)}
      </p>,
    )
  }
  flush()
  flushTable()
  return <div className="flex flex-col gap-2">{blocks}</div>
}

function inline(text: string, onNavigate?: () => void): ReactNode {
  const parts: ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      const [label, href] = [m[1], m[2]]
      const path = inAppPath(href)
      parts.push(
        path ? (
          <Link key={m.index} to={path} onClick={onNavigate} className="font-semibold text-turquoise-400 underline underline-offset-2">
            {label}
          </Link>
        ) : (
          label
        ),
      )
    } else if (m[3] !== undefined) {
      parts.push(<strong key={m.index}>{m[3]}</strong>)
    } else {
      parts.push(
        <code key={m.index} className="rounded bg-navy-800 px-1 text-[0.9em]">
          {m[4]}
        </code>,
      )
    }
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)
}
