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

export function TemplatePages({ pages }: TemplatePagesProps) {
  return (
    <div className="flex flex-col items-center gap-4 overflow-x-auto rounded-2xl bg-navy-950/40 p-4">
      <style>{`
        .template-page {
          font-family: 'Times New Roman', Georgia, serif;
          color: #111827;
          font-size: 14px;
          line-height: 1.6;
        }
      `}</style>
      {pages.map((html, i) => (
        <div
          key={i}
          className="template-page min-h-[1050px] w-[794px] shrink-0 bg-white px-[96px] py-[76px] shadow-lg"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ))}
    </div>
  )
}
