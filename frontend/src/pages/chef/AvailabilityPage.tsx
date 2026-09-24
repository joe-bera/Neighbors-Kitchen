import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../../hooks/usePageTitle'
import { updateAvailability } from '../../services/kitchenService'
import { getApiError } from '../../utils/apiError'
import {
  DAY_NAMES,
  fromScheduleDraft,
  summarizeAvailability,
  toScheduleDraft,
  type ScheduleDraftDay,
} from '../../utils/availability'
import { useChefKitchen } from './chefContext'

const LEAD_TIME_OPTIONS = [
  { hours: 12, label: '12 hours ahead' },
  { hours: 24, label: '1 day ahead' },
  { hours: 48, label: '2 days ahead' },
  { hours: 72, label: '3 days ahead' },
]

export default function AvailabilityPage() {
  usePageTitle('Hours and delivery')
  const { kitchen, setKitchen } = useChefKitchen()
  const [days, setDays] = useState<ScheduleDraftDay[]>(() => toScheduleDraft(kitchen.availability))
  const [leadTimeHours, setLeadTimeHours] = useState(kitchen.orderLeadTimeHours)
  const [offersPickup, setOffersPickup] = useState(kitchen.offersPickup)
  const [offersDelivery, setOffersDelivery] = useState(kitchen.offersDelivery)
  const [deliveryFee, setDeliveryFee] = useState(kitchen.deliveryFee.toFixed(2))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const updateDay = (dayOfWeek: number, changes: Partial<ScheduleDraftDay>) => {
    setDays((current) => current.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...changes } : day)))
    setStatus('idle')
  }

  const validate = () => {
    const problems: Record<string, string> = {}
    for (const day of days) {
      if (day.open && day.endTime <= day.startTime) {
        problems[`day-${day.dayOfWeek}`] = 'Closing time must be after opening time'
      }
    }
    if (!offersPickup && !offersDelivery) problems.handover = 'Offer pickup, delivery, or both'
    const fee = Number(deliveryFee)
    if (offersDelivery && (deliveryFee.trim() === '' || Number.isNaN(fee) || fee < 0 || fee > 50)) {
      problems.deliveryFee = 'Enter a delivery fee from $0 to $50'
    }
    setErrors(problems)
    return Object.keys(problems).length === 0
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaveError(null)
    if (!validate()) return
    setStatus('saving')
    try {
      const updated = await updateAvailability({
        schedule: fromScheduleDraft(days),
        orderLeadTimeHours: leadTimeHours,
        offersPickup,
        offersDelivery,
        deliveryFee: offersDelivery ? Number(deliveryFee) : 0,
      })
      setKitchen(updated)
      setStatus('saved')
    } catch (error) {
      setSaveError(getApiError(error).message)
      setStatus('idle')
    }
  }

  const preview = summarizeAvailability(fromScheduleDraft(days))

  return (
    <form className="dashboard-section" onSubmit={save} noValidate>
      {status === 'saved' && <div className="alert alert-success" role="status">Your hours and delivery options are saved.</div>}
      {saveError && <div className="alert alert-error" role="alert">{saveError}</div>}

      <section className="card" aria-labelledby="weekly-hours-heading">
        <h2 id="weekly-hours-heading">Weekly hours</h2>
        <p className="card-text">Choose the days and times when your food is ready for pickup or delivery.</p>
        <div className="week-editor">
          {days.map((day) => {
            const error = errors[`day-${day.dayOfWeek}`]
            const name = DAY_NAMES[day.dayOfWeek]
            return (
              <div key={day.dayOfWeek} className={`week-row ${day.open ? '' : 'week-row--closed'}`}>
                <label className="checkbox-option week-row-day">
                  <input
                    type="checkbox"
                    checked={day.open}
                    onChange={(event) => updateDay(day.dayOfWeek, { open: event.target.checked })}
                  />
                  {name}
                </label>
                {day.open ? (
                  <div className="week-row-times">
                    <label className="visually-hidden" htmlFor={`start-${day.dayOfWeek}`}>{name} opening time</label>
                    <input
                      id={`start-${day.dayOfWeek}`}
                      type="time"
                      className="field-input"
                      value={day.startTime}
                      aria-invalid={error ? true : undefined}
                      onChange={(event) => updateDay(day.dayOfWeek, { startTime: event.target.value })}
                    />
                    <span aria-hidden="true">to</span>
                    <label className="visually-hidden" htmlFor={`end-${day.dayOfWeek}`}>{name} closing time</label>
                    <input
                      id={`end-${day.dayOfWeek}`}
                      type="time"
                      className="field-input"
                      value={day.endTime}
                      aria-invalid={error ? true : undefined}
                      onChange={(event) => updateDay(day.dayOfWeek, { endTime: event.target.value })}
                    />
                  </div>
                ) : (
                  <span className="week-row-closed">Closed</span>
                )}
                {error && <p className="field-error week-row-error" role="alert">{error}</p>}
              </div>
            )
          })}
        </div>
        <div className="schedule-preview">
          <p className="field-label">Customers will see</p>
          {preview.length > 0 ? (
            <ul className="hours-list">{preview.map((line) => <li key={line}>{line}</li>)}</ul>
          ) : (
            <p className="card-text">No hours yet. Customers will not be able to pick a time until you add some.</p>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="ordering-heading">
        <h2 id="ordering-heading">Ordering</h2>
        <div className="field">
          <label className="field-label" htmlFor="leadTime">How far ahead must customers order?</label>
          <select
            id="leadTime"
            className="field-input field-input--auto"
            value={leadTimeHours}
            onChange={(event) => {
              setLeadTimeHours(Number(event.target.value))
              setStatus('idle')
            }}
          >
            {LEAD_TIME_OPTIONS.map((option) => (
              <option key={option.hours} value={option.hours}>{option.label}</option>
            ))}
          </select>
        </div>

        <fieldset className="checkbox-group">
          <legend className="field-label">How customers get their food</legend>
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={offersPickup}
              onChange={(event) => {
                setOffersPickup(event.target.checked)
                setStatus('idle')
              }}
            />
            Pickup from my kitchen
          </label>
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={offersDelivery}
              onChange={(event) => {
                setOffersDelivery(event.target.checked)
                setStatus('idle')
              }}
            />
            I deliver (within {kitchen.serviceRadiusMiles} miles)
          </label>
          {errors.handover && <p className="field-error" role="alert">{errors.handover}</p>}
        </fieldset>

        {offersDelivery && (
          <div className="field field--narrow">
            <label className="field-label" htmlFor="deliveryFee">Delivery fee ($)</label>
            <input
              id="deliveryFee"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={50}
              className="field-input"
              value={deliveryFee}
              aria-invalid={errors.deliveryFee ? true : undefined}
              onChange={(event) => {
                setDeliveryFee(event.target.value)
                setStatus('idle')
              }}
            />
            {errors.deliveryFee ? (
              <p className="field-error" role="alert">{errors.deliveryFee}</p>
            ) : (
              <p className="field-hint">Use 0 for free delivery.</p>
            )}
            <p className="field-hint">
              Delivery distance is set on your <Link to="/chef/kitchen" className="text-link">Kitchen profile</Link>.
            </p>
          </div>
        )}
      </section>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving...' : 'Save hours and delivery'}
        </button>
      </div>
    </form>
  )
}
