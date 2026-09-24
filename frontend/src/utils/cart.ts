// The cart holds meals from one chef at a time, because each order goes to a single kitchen.

const MAX_QUANTITY = 20

export interface CartChef {
  id: string
  name: string
}

export interface CartMeal {
  mealId: string
  name: string
  price: number
  imageUrl: string | null
}

export interface CartItem extends CartMeal {
  quantity: number
}

export interface Cart {
  chef: CartChef | null
  items: CartItem[]
}

export type AddToCartResult = { ok: true; cart: Cart } | { ok: false; reason: 'DIFFERENT_CHEF'; cart: Cart }

export const emptyCart: Cart = { chef: null, items: [] }

const clampQuantity = (quantity: number) => Math.min(MAX_QUANTITY, Math.max(0, Math.floor(quantity)))

export function addToCart(cart: Cart, chef: CartChef, meal: CartMeal, quantity: number): AddToCartResult {
  if (cart.chef && cart.chef.id !== chef.id && cart.items.length > 0) {
    return { ok: false, reason: 'DIFFERENT_CHEF', cart }
  }
  const alreadyInCart = cart.items.some((item) => item.mealId === meal.mealId)
  const items = alreadyInCart
    ? cart.items.map((item) =>
        item.mealId === meal.mealId ? { ...item, quantity: clampQuantity(item.quantity + quantity) } : item,
      )
    : [...cart.items, { ...meal, quantity: clampQuantity(quantity) }]
  return { ok: true, cart: { chef, items } }
}

export function setCartQuantity(cart: Cart, mealId: string, quantity: number): Cart {
  const items =
    quantity <= 0
      ? cart.items.filter((item) => item.mealId !== mealId)
      : cart.items.map((item) => (item.mealId === mealId ? { ...item, quantity: clampQuantity(quantity) } : item))
  return items.length === 0 ? emptyCart : { ...cart, items }
}

export function cartSubtotal(cart: Cart): number {
  const cents = cart.items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0)
  return cents / 100
}

export function cartCount(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0)
}
