import { useOutletContext } from 'react-router-dom'
import type { OwnKitchen } from '../../types/kitchen.types'

export interface ChefContext {
  kitchen: OwnKitchen
  /** Replace the kitchen after saving changes. */
  setKitchen: (kitchen: OwnKitchen) => void
  /** Load the kitchen again, e.g. after adding a meal changes its counts. */
  reloadKitchen: () => Promise<void>
}

/** The signed-in chef's kitchen, provided by ChefLayout to every dashboard page. */
export function useChefKitchen(): ChefContext {
  return useOutletContext<ChefContext>()
}
