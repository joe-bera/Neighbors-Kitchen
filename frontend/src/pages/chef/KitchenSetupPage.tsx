import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import KitchenProfileForm from '../../components/chef/KitchenProfileForm'
import PageLoader from '../../components/common/PageLoader'
import { ErrorState } from '../../components/common/StatusStates'
import { useAsyncData } from '../../hooks/useAsyncData'
import { usePageTitle } from '../../hooks/usePageTitle'
import { fetchCurrentUser } from '../../services/authService'
import { becomeChef } from '../../services/kitchenService'
import type { KitchenProfileInput } from '../../types/kitchen.types'
import './ChefPages.css'

/** Where a new chef, or a customer who wants to start cooking, sets up their kitchen. */
export default function KitchenSetupPage() {
  usePageTitle('Set up your kitchen')
  const navigate = useNavigate()
  const location = useLocation()
  const justSignedUp = (location.state as { justSignedUp?: boolean } | null)?.justSignedUp === true
  const me = useAsyncData('me', fetchCurrentUser)

  if (me.status === 'error') {
    return (
      <div className="container">
        <ErrorState message={me.error ?? ''} onRetry={me.retry} />
      </div>
    )
  }
  if (!me.data) return <PageLoader />
  if (me.data.chefProfile) return <Navigate to="/chef" replace />

  const isCustomer = me.data.role === 'CUSTOMER'

  const handleSubmit = async (values: KitchenProfileInput) => {
    await becomeChef(values)
    navigate('/chef', {
      replace: true,
      state: { message: 'Your kitchen is set up! Next, add your first meal and your weekly hours.' },
    })
  }

  return (
    <div className="container kitchen-setup">
      {justSignedUp && (
        <div className="alert alert-success" role="status">
          Your account is ready. One more step: tell neighbors about your kitchen.
        </div>
      )}
      <header className="kitchen-setup-header">
        <h1>Set up your kitchen</h1>
        <p>
          {isCustomer
            ? 'Share your cooking with neighbors. You can keep ordering meals from other chefs too.'
            : 'Tell neighbors about your cooking. You can change any of this later.'}
        </p>
      </header>
      <div className="card">
        <KitchenProfileForm submitLabel="Create my kitchen" submittingLabel="Setting up your kitchen..." onSubmit={handleSubmit} />
      </div>
    </div>
  )
}
