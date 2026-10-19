const placeholderStyle = {
  backgroundImage:
    'repeating-linear-gradient(45deg, var(--color-navy-800) 0 8px, var(--color-navy-950) 8px 16px)',
}

interface DormitoryCoverProps {
  src: string | null
  alt: string
  placeholder: string
  // Box shape and corner radius, e.g. "aspect-[16/10] rounded-2xl".
  className: string
}

// Card cover photo. Uploaded photos come in every shape (16:9, 4:3, portrait
// phone shots), so a cropping object-cover box cut off most of the building.
// The photo is shown whole (object-contain) inside a fixed-ratio box, and a
// blurred copy of it fills the leftover bands so they don't read as gaps.
export function DormitoryCover({ src, alt, placeholder, className }: DormitoryCoverProps) {
  if (!src) {
    return (
      <div className={`flex w-full items-center justify-center ${className}`} style={placeholderStyle}>
        <span className="font-mono text-[10px] text-sand-400">{placeholder}</span>
      </div>
    )
  }
  return (
    <div className={`relative w-full overflow-hidden bg-navy-950 ${className}`}>
      <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-lg" />
      <img src={src} alt={alt} className="relative h-full w-full object-contain" />
    </div>
  )
}
