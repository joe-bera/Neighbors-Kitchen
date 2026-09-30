import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
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
// Browsers do not count the time a permission prompt waits for an answer, so an ignored prompt never
// calls back. Give up after this long either way.
const LOCATION_GIVE_UP_MS = 15_000
const LOCATION_ERROR = 'We could not get your location. Type your ZIP code instead.'

export default function NearMeForm({ onChoose, variant = 'default', initialZip }: NearMeFormProps) {
  const id = useId()
  const [zip, setZip] = useState(() => initialZip ?? recallZip())
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator
  // The give-up timer of the location request still waiting for an answer, if any.
  const pending = useRef<number | null>(null)
  useEffect(
    () => () => {
      // Leaving the page: forget the request, so a late answer does nothing.
      if (pending.current !== null) window.clearTimeout(pending.current)
      pending.current = null
    },
    [],
  )

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
    /** Ends this request; false when it already ended (gave up, answered, or the page was left). */
    const finish = () => {
      if (pending.current !== timer) return false
      window.clearTimeout(timer)
      pending.current = null
      setLocating(false)
      return true
    }
    const fail = () => {
      if (finish()) setError(LOCATION_ERROR)
    }
    const timer = window.setTimeout(fail, LOCATION_GIVE_UP_MS)
    pending.current = timer
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!finish()) return
        onChoose({
          kind: 'here',
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
        })
      },
      fail,
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
