import { useState } from 'react'

interface MealImageProps {
  src: string | null
  alt: string
  className?: string
}

/** A meal photo that falls back to a neutral placeholder when there is no photo or it fails to load. */
export default function MealImage({ src, alt, className = '' }: MealImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) {
    return (
      <div className={`meal-image meal-image--placeholder ${className}`} role="img" aria-label={alt}>
        <span aria-hidden="true">No photo yet</span>
      </div>
    )
  }
  return (
    <img
      className={`meal-image ${className}`}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
    />
  )
}
