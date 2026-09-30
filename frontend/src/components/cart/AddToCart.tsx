import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCartStore } from '../../store/cartStore'
import type { MealDetail } from '../../types/catalog.types'
import { formatPrice } from '../../utils/format'
import QuantityStepper from '../common/QuantityStepper'

/** Quantity picker and "Add to cart" button for a meal page. */
export default function AddToCart({ meal }: { meal: MealDetail }) {
  const [quantity, setQuantity] = useState(1)
  const [conflict, setConflict] = useState(false)
  const [added, setAdded] = useState(false)
  const add = useCartStore((state) => state.add)
  const startNewCart = useCartStore((state) => state.startNewCart)
  const cartChef = useCartStore((state) => state.chef)

  if (!meal.chef.isAcceptingOrders) {
    return (
      <div className="add-to-cart">
        <button type="button" className="btn btn-primary btn-block" disabled>Add to cart</button>
        <p className="card-note">This chef is not taking new orders right now.</p>
      </div>
    )
  }

  const chef = { id: meal.chef.id, name: meal.chef.kitchenName ?? meal.chef.chefName }
  const cartMeal = { mealId: meal.id, name: meal.name, price: meal.price, imageUrl: meal.imageUrl }

  const handleAdd = () => {
    const result = add(chef, cartMeal, quantity)
    setConflict(!result.ok)
    setAdded(result.ok)
  }

  const replaceCart = () => {
    startNewCart(chef, cartMeal, quantity)
    setConflict(false)
    setAdded(true)
  }

  return (
    <div className="add-to-cart">
      <div className="add-to-cart-row">
        <QuantityStepper value={quantity} onChange={setQuantity} label={meal.name} />
        <button type="button" className="btn btn-primary add-to-cart-button" onClick={handleAdd}>
          Add to cart &middot; {formatPrice(meal.price * quantity)}
        </button>
      </div>

      {conflict && (
        <div className="alert alert-info" role="alert">
          <p>
            Your cart has meals from {cartChef?.name}. Each order comes from one kitchen, so you can finish that order first
            or start a new cart.
          </p>
          <div className="card-actions">
            <button type="button" className="btn btn-primary btn-small" onClick={replaceCart}>Start a new cart</button>
            <button type="button" className="btn btn-outline btn-small" onClick={() => setConflict(false)}>Keep my cart</button>
          </div>
        </div>
      )}

      {added && (
        <div className="alert alert-success add-to-cart-added" role="status">
          Added to your cart.
          <Link to="/cart" className="text-link">View cart &rarr;</Link>
        </div>
      )}
    </div>
  )
}
