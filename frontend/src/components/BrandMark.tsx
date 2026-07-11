export function BrandMark({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-turquoise-500/15 text-sm font-semibold text-turquoise-400 ring-1 ring-turquoise-400/30">
        SH
      </span>
      <span className="font-heading text-lg text-sand-100">{label ?? 'Student House'}</span>
    </div>
  )
}
