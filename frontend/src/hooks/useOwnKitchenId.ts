import { fetchMyKitchen } from '../services/kitchenService'
import { useAuthStore } from '../store/authStore'
import { useAsyncData } from './useAsyncData'

/** The signed-in chef's own kitchen id, or null for customers and visitors. */
export function useOwnKitchenId(): string | null {
  const user = useAuthStore((state) => state.user)
  const isChef = user?.role === 'CHEF'
  const kitchen = useAsyncData(`own-kitchen-id:${isChef ? user.id : 'none'}`, () =>
    isChef ? fetchMyKitchen().then((ownKitchen) => ownKitchen.id) : Promise.resolve(null),
  )
  return isChef ? (kitchen.data ?? null) : null
}
