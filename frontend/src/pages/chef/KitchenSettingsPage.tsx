import { lazy, Suspense, useState } from 'react'
import KitchenProfileForm from '../../components/chef/KitchenProfileForm'
import { usePageTitle } from '../../hooks/usePageTitle'
import { updateMyKitchen } from '../../services/kitchenService'
import type { KitchenProfileInput } from '../../types/kitchen.types'
import { useChefKitchen } from './chefContext'

const AreaMap = lazy(() => import('../../components/location/AreaMap'))

export default function KitchenSettingsPage() {
  usePageTitle('Kitchen profile')
  const { kitchen, setKitchen } = useChefKitchen()
  const [saved, setSaved] = useState(false)

  const save = async (values: KitchenProfileInput) => {
    setSaved(false)
    setKitchen(await updateMyKitchen(values))
    setSaved(true)
  }

  return (
    <section className="card dashboard-section" aria-labelledby="kitchen-profile-heading">
      <h2 id="kitchen-profile-heading">Kitchen profile</h2>
      {saved && <div className="alert alert-success" role="status">Your kitchen profile is saved.</div>}
      <KitchenProfileForm initialKitchen={kitchen} submitLabel="Save changes" submittingLabel="Saving..." onSubmit={save} />

      <section className="kitchen-location" aria-labelledby="kitchen-location-heading">
        <h3 id="kitchen-location-heading">How neighbors see your location</h3>
        {kitchen.area ? (
          <>
            <Suspense fallback={<div className="map-frame" />}>
              <AreaMap area={kitchen.area} />
            </Suspense>
            <p className="map-note">
              Neighbors see this circle, about a mile across, and never your street address. Your home is inside it but not
              at the center.
            </p>
          </>
        ) : (
          <p className="form-section-note">
            We could not place your address on the map yet, so your kitchen does not appear when neighbors search near
            them. Check your street address and ZIP code above, then save again.
          </p>
        )}
      </section>
    </section>
  )
}
