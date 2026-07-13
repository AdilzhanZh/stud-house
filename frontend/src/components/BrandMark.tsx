export function BrandMark({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        <img src="/favicon.svg" alt="" className="brand-icon h-full w-full object-contain" />
      </span>
      <span className="font-heading text-lg text-sand-100">{label ?? 'Student House'}</span>
    </div>
  )
}
