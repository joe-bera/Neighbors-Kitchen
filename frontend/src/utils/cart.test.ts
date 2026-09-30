import { describe, expect, it } from 'vitest'
import { addToCart, cartCount, cartSubtotal, emptyCart, setCartQuantity, type Cart } from './cart'

const maria = { id: 'chef-maria', name: "Abuela's Table" }
const tony = { id: 'chef-tony', name: "Nonna Rosa's" }
const enchiladas = { mealId: 'meal-1', name: 'Enchiladas', price: 14, imageUrl: null }
const churros = { mealId: 'meal-2', name: 'Churros', price: 7.5, imageUrl: null }
const lasagna = { mealId: 'meal-3', name: 'Lasagna', price: 16, imageUrl: null }

describe('addToCart', () => {
  it('starts a cart for the chef of the first meal', () => {
    const result = addToCart(emptyCart, maria, enchiladas, 2)

    expect(result).toEqual({ ok: true, cart: { chef: maria, items: [{ ...enchiladas, quantity: 2 }] } })
  })

  it('adds to the quantity when the meal is already in the cart', () => {
    const cart = addToCart(emptyCart, maria, enchiladas, 2).cart

    const result = addToCart(cart, maria, enchiladas, 3)

    expect(result.cart.items).toEqual([{ ...enchiladas, quantity: 5 }])
  })

  it('keeps a meal at 20 or fewer', () => {
    const cart = addToCart(emptyCart, maria, enchiladas, 18).cart

    expect(addToCart(cart, maria, enchiladas, 5).cart.items[0].quantity).toBe(20)
  })

  it("will not mix two chefs' meals in one cart", () => {
    const cart = addToCart(emptyCart, maria, enchiladas, 1).cart

    const result = addToCart(cart, tony, lasagna, 1)

    expect(result).toEqual({ ok: false, reason: 'DIFFERENT_CHEF', cart })
  })
})

describe('setCartQuantity', () => {
  const cart: Cart = { chef: maria, items: [{ ...enchiladas, quantity: 2 }, { ...churros, quantity: 1 }] }

  it('changes the quantity of one meal', () => {
    expect(setCartQuantity(cart, 'meal-2', 4).items).toEqual([
      { ...enchiladas, quantity: 2 },
      { ...churros, quantity: 4 },
    ])
  })

  it('removes a meal when its quantity drops to zero', () => {
    expect(setCartQuantity(cart, 'meal-1', 0).items).toEqual([{ ...churros, quantity: 1 }])
  })

  it('empties the cart, forgetting the chef, when the last meal is removed', () => {
    const single: Cart = { chef: maria, items: [{ ...enchiladas, quantity: 1 }] }

    expect(setCartQuantity(single, 'meal-1', 0)).toEqual(emptyCart)
  })
})

describe('cart totals', () => {
  const cart: Cart = { chef: maria, items: [{ ...enchiladas, quantity: 2 }, { ...churros, quantity: 3 }] }

  it('adds up the price of every meal', () => {
    expect(cartSubtotal(cart)).toBe(50.5)
  })

  it('counts every portion', () => {
    expect(cartCount(cart)).toBe(5)
  })
})
