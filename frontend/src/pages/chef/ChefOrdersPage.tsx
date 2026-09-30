import { useSearchParams } from 'react-router-dom'
import PageLoader from '../../components/common/PageLoader'
import { EmptyState, ErrorState } from '../../components/common/StatusStates'
import KitchenOrderCard from '../../components/order/KitchenOrderCard'
import { useAsyncData } from '../../hooks/useAsyncData'
import { usePageTitle } from '../../hooks/usePageTitle'
import { fetchKitchenOrders } from '../../services/orderService'
import type { KitchenOrder } from '../../types/order.types'
import { useChefKitchen } from './chefContext'

export default function ChefOrdersPage() {
  usePageTitle('Orders')
  const { reloadKitchen } = useChefKitchen()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'past' ? 'past' : 'active'
  const orders = useAsyncData(`kitchen-orders:${view}`, () => fetchKitchenOrders(view))

  const refresh = async () => {
    orders.retry()
    await reloadKitchen()
  }

  const needsConfirmation = orders.data?.filter((order) => order.status === 'PENDING') ?? []
  const upcoming = orders.data?.filter((order) => order.status !== 'PENDING') ?? []

  return (
    <div className="dashboard-section">
      <div className="pill-group" role="group" aria-label="Which orders">
        <button type="button" className="pill" aria-pressed={view === 'active'} onClick={() => setSearchParams({})}>
          Active orders
        </button>
        <button type="button" className="pill" aria-pressed={view === 'past'} onClick={() => setSearchParams({ view: 'past' })}>
          Past orders
        </button>
      </div>

      {orders.status === 'error' && !orders.data && <ErrorState message={orders.error ?? ''} onRetry={orders.retry} />}
      {!orders.data && orders.status === 'loading' && <PageLoader label="Loading orders" />}

      {orders.data && view === 'past' && (
        orders.data.length === 0 ? (
          <EmptyState title="No past orders yet" text="Completed and cancelled orders will show here." />
        ) : (
          <OrderGroup title="Past orders" orders={orders.data} onChanged={refresh} />
        )
      )}

      {orders.data && view === 'active' && (
        orders.data.length === 0 ? (
          <EmptyState title="No active orders" text="New pre-orders from neighbors will show up here." />
        ) : (
          <>
            {needsConfirmation.length > 0 && (
              <OrderGroup title="Needs your confirmation" orders={needsConfirmation} onChanged={refresh} highlight />
            )}
            {upcoming.length > 0 && <OrderGroup title="Upcoming" orders={upcoming} onChanged={refresh} />}
          </>
        )
      )}
    </div>
  )
}

interface OrderGroupProps {
  title: string
  orders: KitchenOrder[]
  onChanged: () => Promise<void>
  highlight?: boolean
}

function OrderGroup({ title, orders, onChanged, highlight }: OrderGroupProps) {
  return (
    <section className="kitchen-order-group" aria-label={title}>
      <h2>
        {title} <span className="kitchen-order-count">({orders.length})</span>
      </h2>
      <ul className="kitchen-orders">
        {orders.map((order) => (
          <KitchenOrderCard key={order.id} order={order} onChanged={onChanged} highlight={highlight} />
        ))}
      </ul>
    </section>
  )
}
