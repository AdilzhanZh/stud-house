import { useEffect, useRef, useState } from 'react'

// Read-only, already-filled-in rendering of a template's pages — the
// on-screen counterpart to each *Pdf.ts util's PDF export, sharing the same
// filled HTML. Not editable (unlike TemplateEditor): variable chips have
// already been swapped for plain text by the caller's fill*Template function
// before this ever renders, so this component needs no knowledge of the
// original chip class name — the same fixed styling works for every
// template (petition, protocol, contract all use identical page typography).
interface TemplatePagesProps {
  pages: string[]
}

// A4-ish page width the template HTML is authored/styled against. Content
// inside a page keeps this fixed pixel layout (fixed px padding, etc.) —
// instead of reflowing it for narrow screens, the whole page is scaled down
// as one unit so it always fits the available width without horizontal
// scrolling, the same way a document preview shrinks to fit.
const PAGE_WIDTH = 794

function ScaledPage({ html }: { html: string }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    function recompute() {
      if (!outer || !inner) return
      setScale(Math.min(1, outer.clientWidth / PAGE_WIDTH))
      setHeight(inner.offsetHeight)
    }

    recompute()
    const observer = new ResizeObserver(recompute)
    observer.observe(outer)
    return () => observer.disconnect()
  }, [html])

  return (
    <div
      ref={outerRef}
      className="w-full max-w-[794px]"
      style={{ height: height != null ? height * scale : undefined }}
    >
      <div
        ref={innerRef}
        className="template-page min-h-[1050px] w-[794px] origin-top-left bg-white px-[96px] py-[76px] shadow-lg"
        style={{ transform: `scale(${scale})` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

export function TemplatePages({ pages }: TemplatePagesProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-navy-950/40 p-4">
      <style>{`
        .template-page {
          font-family: 'Times New Roman', Georgia, serif;
          color: #111827;
          font-size: 14px;
          line-height: 1.6;
        }
      `}</style>
      {pages.map((html, i) => (
        <ScaledPage key={i} html={html} />
      ))}
    </div>
  )
}
