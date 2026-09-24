import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageLoader from '../components/common/PageLoader'
import { EmptyState, ErrorState } from '../components/common/StatusStates'
import { useAsyncData } from '../hooks/useAsyncData'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchChef } from '../services/catalogService'
import { fetchOrderSlots, placeOrder } from '../services/orderService'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import type { ChefDetail } from '../types/catalog.types'
import type { Handover, OrderSlots } from '../types/order.types'
import { getApiError } from '../utils/apiError'
import { cartSubtotal, type Cart } from '../utils/cart'
import { formatPrice } from '../utils/format'
import { formatSlotDay, formatSlotTime } from '../utils/orders'
import './Orders.css'

export default function CheckoutPage() {
  usePageTitle('Checkout')
  const chef = useCartStore((state) => state.chef)
  const items = useCartStore((state) => state.items)
  // A message rather than a redirect: placing an order empties the cart while this page is
  // still showing, and a redirect here would race the move to the new order's page.
  if (!chef || items.length === 0) {
    return (
      <div className="container">
        <EmptyState title="Your cart is empty" text="Add a meal to your cart to check out.">
          <Link to="/meals" className="btn btn-primary">Browse meals</Link>
        </EmptyState>
      </div>
    )
  }
  return <Checkout cart={{ chef, items }} />
}

function Checkout({ cart }: { cart: Cart }) {
  const chefId = cart.chef!.id
  const [slotsVersion, setSlotsVersion] = useState(0)
  const chef = useAsyncData(`checkout-chef:${chefId}`, () => fetchChef(chefId))
  const slots = useAsyncData(`checkout-slots:${chefId}:${slotsVersion}`, () => fetchOrderSlots(chefId))

  if (chef.status === 'error' || (slots.status === 'error' && !slots.data)) {
    return (
      <div className="container">
        <ErrorState message={chef.error ?? slots.error ?? ''} onRetry={() => { chef.retry(); slots.retry() }} />
      </div>
    )
  }
  if (!chef.data || !slots.data) return <PageLoader label="Getting checkout ready" />

  return (
    <CheckoutForm
      cart={cart}
      chef={chef.data}
      slots={slots.data}
      reloadSlots={() => setSlotsVersion((version) => version + 1)}
    />
  )
}

interface CheckoutFormProps {
  cart: Cart
  chef: ChefDetail
  slots: OrderSlots
  reloadSlots: () => void
}

function CheckoutForm({ cart, chef, slots, reloadSlots }: CheckoutFormProps) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearCart = useCartStore((state) => state.clear)
  const [handover, setHandover] = useState<Handover>(chef.offersPickup ? 'PICKUP' : 'DELIVERY')
  const [day, setDay] = useState<string | null>(slots.days[0]?.date ?? null)
  const [time, setTime] = useState<string | null>(null)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const chefName = cart.chef!.name
  const daySlots = slots.days.find((candidate) => candidate.date === day)?.slots ?? []
  const subtotal = cartSubtotal(cart)
  const deliveryFee = handover === 'DELIVERY' ? chef.deliveryFee : 0
  const total = Math.round((subtotal + deliveryFee) * 100) / 100

  const validate = () => {
    const problems: Record<string, string> = {}
    if (!time || !daySlots.includes(time)) problems.time = 'Choose a time'
    if (handover === 'DELIVERY') {
      if (deliveryAddress.trim().length < 5) problems.deliveryAddress = 'Enter the delivery address'
      if (phone.replace(/\D/g, '').length < 10) problems.contactPhone = 'Enter a phone number with area code'
    }
    setErrors(problems)
    return Object.keys(problems).length === 0
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      const order = await placeOrder({
        chefId: cart.chef!.id,
        items: cart.items.map(({ mealId, quantity }) => ({ mealId, quantity })),
        pickupOrDelivery: handover,
        scheduledFor: time!,
        deliveryAddress: handover === 'DELIVERY' ? deliveryAddress.trim() : null,
        contactPhone: phone.trim() || null,
        specialInstructions: notes.trim() || null,
      })
      navigate(`/orders/${order.id}`, {
        replace: true,
        state: { message: `Your pre-order was sent to ${chefName}. This page updates when they confirm it.` },
      })
      clearCart()
    } catch (error) {
      const apiError = getApiError(error)
      if (apiError.code === 'INVALID_TIME') {
        setTime(null)
        reloadSlots()
        setSubmitError('That time is no longer available. Please choose another time.')
      } else if (apiError.details && Object.keys(apiError.details).length > 0) {
        setErrors(apiError.details)
        setSubmitError(apiError.message)
      } else {
        setSubmitError(apiError.message)
      }
      setSubmitting(false)
    }
  }

  if (!slots.isAcceptingOrders || slots.days.length === 0) {
    return (
      <div className="container">
        <EmptyState
          title={`${chefName} has no pickup times available right now`}
          text="Please check back soon, or order from another chef."
        >
          <Link to="/meals" className="btn btn-primary">Browse meals</Link>
        </EmptyState>
      </div>
    )
  }

  return (
    <form className="container checkout-layout" onSubmit={submit} noValidate>
      <div className="checkout-main">
        <h1>Checkout</h1>
        {submitError && <div className="alert alert-error" role="alert">{submitError}</div>}

        <section className="card checkout-section" aria-labelledby="handover-heading">
          <h2 id="handover-heading">How would you like your food?</h2>
          <div className="choice-cards">
            {chef.offersPickup && (
              <label className="choice-card">
                <input type="radio" name="handover" checked={handover === 'PICKUP'} onChange={() => setHandover('PICKUP')} className="visually-hidden" />
                <span className="choice-card-title">Pickup</span>
                <span className="choice-card-text">From {chefName} in {chef.city}. The address is shared once the chef confirms.</span>
              </label>
            )}
            {chef.offersDelivery && (
              <label className="choice-card">
                <input type="radio" name="handover" checked={handover === 'DELIVERY'} onChange={() => setHandover('DELIVERY')} className="visually-hidden" />
                <span className="choice-card-title">Delivery</span>
                <span className="choice-card-text">
                  {chef.deliveryFee > 0 ? `${formatPrice(chef.deliveryFee)} fee` : 'Free'} &middot; within {chef.serviceRadiusMiles} miles of {chef.city}
                </span>
              </label>
            )}
          </div>

          {handover === 'DELIVERY' && (
            <div className="checkout-fields">
              <div className="field">
                <label className="field-label" htmlFor="deliveryAddress">Delivery address</label>
                <input
                  id="deliveryAddress"
                  type="text"
                  autoComplete="street-address"
                  className="field-input"
                  placeholder="Street, city and ZIP code"
                  value={deliveryAddress}
                  aria-invalid={errors.deliveryAddress ? true : undefined}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                />
                {errors.deliveryAddress && <p className="field-error">{errors.deliveryAddress}</p>}
              </div>
            </div>
          )}
        </section>

        <section className="card checkout-section" aria-labelledby="time-heading">
          <h2 id="time-heading">When?</h2>
          <p className="card-text">Times are in the chef&apos;s local time. {chefName} needs your order ahead of time to cook it fresh.</p>
          <div className="pill-scroller" role="group" aria-label="Day">
            {slots.days.map((option) => (
              <button
                key={option.date}
                type="button"
                className="pill"
                aria-pressed={option.date === day}
                onClick={() => {
                  setDay(option.date)
                  setTime(null)
                }}
              >
                {formatSlotDay(option.date)}
              </button>
            ))}
          </div>
          <div className="time-grid" role="group" aria-label="Time">
            {daySlots.map((slot) => (
              <button key={slot} type="button" className="pill" aria-pressed={slot === time} onClick={() => setTime(slot)}>
                {formatSlotTime(slot, slots.timezone)}
              </button>
            ))}
          </div>
          {errors.time && <p className="field-error" role="alert">{errors.time}</p>}
        </section>

        <section className="card checkout-section" aria-labelledby="details-heading">
          <h2 id="details-heading">Details for the chef</h2>
          <div className="checkout-fields">
            <div className="field">
              <label className="field-label" htmlFor="contactPhone">
                Phone number {handover === 'PICKUP' && <span className="field-optional">(optional)</span>}
              </label>
              <input
                id="contactPhone"
                type="tel"
                autoComplete="tel"
                className="field-input"
                value={phone}
                aria-invalid={errors.contactPhone ? true : undefined}
                onChange={(event) => setPhone(event.target.value)}
              />
              {errors.contactPhone ? (
                <p className="field-error">{errors.contactPhone}</p>
              ) : (
                <p className="field-hint">Only shared with {chefName} so they can reach you about this order.</p>
              )}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="notes">
                Notes for the chef <span className="field-optional">(optional)</span>
              </label>
              <textarea
                id="notes"
                rows={3}
                maxLength={500}
                className="field-input"
                placeholder="Allergies, spice level, gate code..."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
        </section>
      </div>

      <aside className="card checkout-summary" aria-labelledby="summary-heading">
        <h2 id="summary-heading">Order summary</h2>
        <p className="card-text">{chefName}</p>
        <ul className="summary-items">
          {cart.items.map((item) => (
            <li key={item.mealId} className="summary-row">
              <span>{item.quantity} &times; {item.name}</span>
              <span>{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        {handover === 'DELIVERY' && (
          <div className="summary-row">
            <span>Delivery</span>
            <span>{deliveryFee > 0 ? formatPrice(deliveryFee) : 'Free'}</span>
          </div>
        )}
        <div className="summary-row summary-row--total">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
        {time && (
          <p className="summary-when">
            {handover === 'PICKUP' ? 'Pickup' : 'Delivery'}: {formatSlotDay(day!)} at {formatSlotTime(time, slots.timezone)}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Sending your order...' : 'Place pre-order'}
        </button>
        <p className="card-note">You won&apos;t be charged yet. Online payment is coming soon.</p>
      </aside>
    </form>
  )
}
