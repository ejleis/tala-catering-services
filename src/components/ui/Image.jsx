import { useState } from 'react'

const FALLBACKS = {
  food: 'https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=800&auto=format&fit=crop',
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop',
}

/**
 * Image with a graceful fallback and lazy loading.
 *
 * `alt` is required by the prop contract — decorative images should pass
 * alt="" explicitly rather than omitting it.
 */
export default function Image({ src, alt = '', kind = 'food', className = '', ...props }) {
  const [currentSrc, setCurrentSrc] = useState(src)

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => {
        const fallback = FALLBACKS[kind] ?? FALLBACKS.food
        if (currentSrc !== fallback) setCurrentSrc(fallback)
      }}
      className={className}
      {...props}
    />
  )
}
