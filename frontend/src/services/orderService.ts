import type { ApiSuccess } from '../types/api.types'
import type { CustomerOrder, KitchenOrder, OrderSlots, OrderStatus, PlaceOrderInput } from '../types/order.types'
import { api } from './api'

export async function fetchOrderSlots(chefId: string): Promise<OrderSlots> {
  const { data } = await api.get<ApiSuccess<OrderSlots>>(`/chefs/${encodeURIComponent(chefId)}/order-slots`)
  return data.data
}

export async function placeOrder(input: PlaceOrderInput): Promise<CustomerOrder> {
  const { data } = await api.post<ApiSuccess<{ order: CustomerOrder }>>('/orders', input)
  return data.data.order
}

export async function fetchMyOrders(): Promise<CustomerOrder[]> {
  const { data } = await api.get<ApiSuccess<CustomerOrder[]>>('/orders')
  return data.data
}

/** One order, as its customer (or, for the chef who received it, as a kitchen order). */
export async function fetchOrder(id: string): Promise<CustomerOrder> {
  const { data } = await api.get<ApiSuccess<{ order: CustomerOrder }>>(`/orders/${encodeURIComponent(id)}`)
  return data.data.order
}

export async function cancelOrder(id: string, reason: string | null): Promise<CustomerOrder> {
  const { data } = await api.post<ApiSuccess<{ order: CustomerOrder }>>(`/orders/${encodeURIComponent(id)}/cancel`, { reason })
  return data.data.order
}

export async function fetchKitchenOrders(view: 'active' | 'past'): Promise<KitchenOrder[]> {
  const { data } = await api.get<ApiSuccess<KitchenOrder[]>>('/chefs/me/orders', { params: { view } })
  return data.data
}

export async function updateKitchenOrderStatus(id: string, status: OrderStatus): Promise<KitchenOrder> {
  const { data } = await api.post<ApiSuccess<{ order: KitchenOrder }>>(`/chefs/me/orders/${encodeURIComponent(id)}/status`, { status })
  return data.data.order
}

export async function cancelKitchenOrder(id: string, reason: string | null): Promise<KitchenOrder> {
  const { data } = await api.post<ApiSuccess<{ order: KitchenOrder }>>(`/chefs/me/orders/${encodeURIComponent(id)}/cancel`, { reason })
  return data.data.order
}
