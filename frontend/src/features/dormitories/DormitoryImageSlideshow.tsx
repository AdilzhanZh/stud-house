import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { ImageLightbox } from '../../components/ImageLightbox'
import type { DormitoryImage } from '../../types/dormitories'

interface DormitoryImageSlideshowProps {
  images: DormitoryImage[]
  alt: string
}

export function DormitoryImageSlideshow({ images, alt }: DormitoryImageSlideshowProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  const count = images.length
  const goPrev = () => setIndex((i) => (i - 1 + count) % count)
  const goNext = () => setIndex((i) => (i + 1) % count)

  if (count === 0) {
    return (
      <div
        className="flex h-40 w-full items-center justify-center rounded-[20px]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, var(--color-navy-800) 0 8px, var(--color-navy-950) 8px 16px)',
        }}
      >
        <span className="font-mono text-[10px] text-sand-400">{t('dorm.photoPlaceholder')}</span>
      </div>
    )
  }

  return (
    <>
      <div className="group relative h-40 w-full overflow-hidden rounded-[20px]">
        <img
          src={images[index].image_url}
          alt={alt}
          className="h-full w-full cursor-pointer object-cover"
          onClick={() => setFullscreen(true)}
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label={t('dorm.prevImage')}
              className="absolute top-1/2 left-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-navy-950/60 text-sand-100 backdrop-blur-sm hover:bg-navy-950/80"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label={t('dorm.nextImage')}
              className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-navy-950/60 text-sand-100 backdrop-blur-sm hover:bg-navy-950/80"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={t('dorm.imageCounter', { current: i + 1, total: count })}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-4 bg-sand-100' : 'w-1.5 bg-sand-100/40'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-navy-950/60 px-3 py-1.5 text-xs font-semibold text-sand-100 backdrop-blur-sm hover:bg-navy-950/80"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          {t('dorm.viewInFull')}
        </button>
      </div>

      {fullscreen && (
        <ImageLightbox
          imageUrls={images.map((img) => img.image_url)}
          initialIndex={index}
          alt={alt}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  )
}
