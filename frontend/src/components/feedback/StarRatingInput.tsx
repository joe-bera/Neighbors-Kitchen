import { useState, type ReactNode } from 'react'
import { ratingWord } from '../../utils/feedback'

interface StarRatingInputProps {
  /** Radio group name; must be unique on the page. */
  name: string
  legend: ReactNode
  value: number | null
  onChange: (stars: number) => void
  error?: string | null
}

const STARS = [1, 2, 3, 4, 5]

/** Five stars to pick a rating. Made of radio buttons, so it works with a keyboard and screen readers too. */
export default function StarRatingInput({ name, legend, value, onChange, error }: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const shown = hovered ?? value ?? 0
  const errorId = `${name}-error`

  return (
    <fieldset className="star-input" aria-describedby={error ? errorId : undefined}>
      <legend className="field-label">{legend}</legend>
      <div className="star-input-row" onMouseLeave={() => setHovered(null)}>
        {STARS.map((star) => (
          <label key={star} className={star <= shown ? 'star-input-star is-on' : 'star-input-star'} onMouseEnter={() => setHovered(star)}>
            <input
              type="radio"
              className="visually-hidden"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
            />
            <span aria-hidden="true">★</span>
            <span className="visually-hidden">{star === 1 ? '1 star' : `${star} stars`}</span>
          </label>
        ))}
        <span className="star-input-word" aria-hidden="true">{ratingWord(shown)}</span>
      </div>
      {error && <p id={errorId} className="field-error">{error}</p>}
    </fieldset>
  )
}
