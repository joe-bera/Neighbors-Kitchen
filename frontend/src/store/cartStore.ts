import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  addToCart,
  emptyCart,
  setCartQuantity,
  type AddToCartResult,
  type Cart,
  type CartChef,
  type CartMeal,
} from '../utils/cart'

interface CartState extends Cart {
  /** Adds a meal, unless the cart already holds another chef's meals. */
  add: (chef: CartChef, meal: CartMeal, quantity: number) => AddToCartResult
  /** Empties the cart and starts over with this meal. */
  startNewCart: (chef: CartChef, meal: CartMeal, quantity: number) => void
  setQuantity: (mealId: string, quantity: number) => void
  clear: () => void
}

/** The shopping cart, remembered in this browser between visits. */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      ...emptyCart,
      add: (chef, meal, quantity) => {
        const result = addToCart(get(), chef, meal, quantity)
        if (result.ok) set(result.cart)
        return result
      },
      startNewCart: (chef, meal, quantity) => set(addToCart(emptyCart, chef, meal, quantity).cart),
      setQuantity: (mealId, quantity) => set(setCartQuantity(get(), mealId, quantity)),
      clear: () => set(emptyCart),
    }),
    {
      name: 'nk-cart',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ chef: state.chef, items: state.items }),
    },
  ),
)
