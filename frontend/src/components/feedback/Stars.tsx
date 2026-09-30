const STARS = [1, 2, 3, 4, 5]

/** Read-only stars, e.g. ★★★★☆ for 4. Averages are rounded to the nearest whole star. */
export default function Stars({ rating }: { rating: number }) {
  const filled = Math.round(rating)
  const spoken = Number.isInteger(rating) ? String(rating) : rating.toFixed(1)
  return (
    <span className="stars" role="img" aria-label={`${spoken} out of 5 stars`}>
      {STARS.map((star) => (
        <span key={star} className={star <= filled ? 'star star--on' : 'star'} aria-hidden="true">★</span>
      ))}
    </span>
  )
}
