import { useId, useState, type FormEvent } from 'react'
import { normalizeZip, recallZip, rememberZip, roundCoordinate, type SearchPlace } from '../../utils/location'
import './Location.css'

interface NearMeFormProps {
  /** Called with a ZIP code, or the browser's location rounded to about half a mile. */
  onChoose: (place: SearchPlace) => void
  variant?: 'default' | 'hero'
  /** Starts the box with this ZIP code; otherwise the last one typed on this device. */
  initialZip?: string
}

const LOCATION_TIMEOUT_MS = 10_000

export default function NearMeForm({ onChoose, variant = 'default', initialZip }: NearMeFormProps) {
  const id = useId()
  const [zip, setZip] = useState(() => initialZip ?? recallZip())
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const normalized = normalizeZip(zip)
    if (!normalized) {
      setError('Enter a 5-digit ZIP code')
      return
    }
    setError(null)
    rememberZip(normalized)
    onChoose({ kind: 'zip', zip: normalized })
  }

  const locate = () => {
    setError(null)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        onChoose({
          kind: 'here',
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
        })
      },
      () => {
        setLocating(false)
        setError('We could not get your location. Type your ZIP code instead.')
      },
      { timeout: LOCATION_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 },
    )
  }

  return (
    <form className={`near-me near-me--${variant}`} onSubmit={submit} noValidate>
      <p className="near-me-title" id={`${id}-title`}>Find chefs near you</p>
      <div className="near-me-row" role="group" aria-labelledby={`${id}-title`}>
        <label className="visually-hidden" htmlFor={`${id}-zip`}>ZIP code</label>
        <input
          id={`${id}-zip`}
          type="text"
          className="field-input near-me-input"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={10}
          placeholder="ZIP code"
          value={zip}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => setZip(event.target.value)}
        />
        <button type="submit" className={`btn ${variant === 'hero' ? 'btn-light' : 'btn-primary'}`}>
          Find chefs
        </button>
        {canLocate && (
          <button
            type="button"
            className={`btn ${variant === 'hero' ? 'btn-outline-light' : 'btn-outline'}`}
            onClick={locate}
            disabled={locating}
          >
            {locating ? 'Finding you...' : 'Use my location'}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="field-error near-me-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
