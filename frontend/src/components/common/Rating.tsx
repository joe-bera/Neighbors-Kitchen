interface RatingProps {
  average: number | null
  count: number
}

/** Star rating with review count, or a "New" badge before the first review. */
export default function Rating({ average, count }: RatingProps) {
  if (average === null || count === 0) {
    return <span className="rating rating--new">New</span>
  }
  return (
    <span className="rating" aria-label={`Rated ${average.toFixed(1)} out of 5 from ${count} reviews`}>
      <span className="rating-star" aria-hidden="true">★</span>
      <span aria-hidden="true">{average.toFixed(1)}</span>
      <span className="rating-count" aria-hidden="true">({count})</span>
    </span>
  )
}
