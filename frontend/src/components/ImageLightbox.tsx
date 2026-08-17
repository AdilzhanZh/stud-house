import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface ImageLightboxProps {
  imageUrls: string[]
  initialIndex: number
  alt: string
  onClose: () => void
}

export function ImageLightbox({ imageUrls, initialIndex, alt, onClose }: ImageLightboxProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(initialIndex)
  const count = imageUrls.length

  const goPrev = () => setIndex((i) => (i - 1 + count) % count)
  const goNext = () => setIndex((i) => (i + 1) % count)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  if (count === 0) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-navy-950/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('dorm.closeFullView')}
        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-navy-900/80 text-sand-100 hover:bg-navy-800"
      >
        <X className="h-5 w-5" />
      </button>

      {count > 1 && (
        <span className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-navy-900/80 px-3 py-1 text-xs font-semibold text-sand-100">
          {t('dorm.imageCounter', { current: index + 1, total: count })}
        </span>
      )}

      <img
        src={imageUrls[index]}
        alt={alt}
        className="max-h-[85vh] max-w-[90vw] rounded-[12px] object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
            aria-label={t('dorm.prevImage')}
            className="absolute top-1/2 left-3 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-navy-900/80 text-sand-100 hover:bg-navy-800 sm:left-6"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
            aria-label={t('dorm.nextImage')}
            className="absolute top-1/2 right-3 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-navy-900/80 text-sand-100 hover:bg-navy-800 sm:right-6"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
    </div>
  )
}
