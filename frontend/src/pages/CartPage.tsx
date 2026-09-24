import { Link } from 'react-router-dom'
import QuantityStepper from '../components/common/QuantityStepper'
import { EmptyState } from '../components/common/StatusStates'
import MealImage from '../components/meal/MealImage'
import { usePageTitle } from '../hooks/usePageTitle'
import { useCartStore } from '../store/cartStore'
import { cartSubtotal } from '../utils/cart'
import { formatPrice } from '../utils/format'
import './Orders.css'

export default function CartPage() {
  usePageTitle('Your cart')
  const chef = useCartStore((state) => state.chef)
  const items = useCartStore((state) => state.items)
  const setQuantity = useCartStore((state) => state.setQuantity)

  if (!chef || items.length === 0) {
    return (
      <div className="container">
        <EmptyState title="Your cart is empty" text="Browse meals from chefs near you and add something delicious.">
          <Link to="/meals" className="btn btn-primary">Browse meals</Link>
        </EmptyState>
      </div>
    )
  }

  const subtotal = cartSubtotal({ chef, items })

  return (
    <div className="container checkout-layout">
      <section className="checkout-main" aria-labelledby="cart-heading">
        <h1 id="cart-heading">Your cart</h1>
        <p className="cart-chef">
          From <Link to={`/chefs/${chef.id}`} className="text-link">{chef.name}</Link>
        </p>
        <ul className="cart-items">
          {items.map((item) => (
            <li key={item.mealId} className="cart-item">
              <div className="cart-item-photo">
                <MealImage src={item.imageUrl} alt="" />
              </div>
              <div className="cart-item-info">
                <Link to={`/meals/${item.mealId}`} className="cart-item-name">{item.name}</Link>
                <span className="cart-item-price">{formatPrice(item.price)} each</span>
                <button type="button" className="text-button text-button--danger" onClick={() => setQuantity(item.mealId, 0)}>
                  Remove<span className="visually-hidden"> {item.name}</span>
                </button>
              </div>
              <QuantityStepper value={item.quantity} onChange={(quantity) => setQuantity(item.mealId, quantity)} label={item.name} />
              <span className="cart-item-total">{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <Link to={`/chefs/${chef.id}`} className="text-link">&larr; Add more from {chef.name}</Link>
      </section>

      <aside className="card checkout-summary" aria-labelledby="cart-summary-heading">
        <h2 id="cart-summary-heading">Summary</h2>
        <div className="summary-row summary-row--total">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <p className="card-note">You will choose pickup or delivery and a time on the next step.</p>
        <Link to="/checkout" className="btn btn-primary btn-block">Continue to checkout</Link>
      </aside>
    </div>
  )
}
