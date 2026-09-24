import { useState } from 'react'
import KitchenProfileForm from '../../components/chef/KitchenProfileForm'
import { usePageTitle } from '../../hooks/usePageTitle'
import { updateMyKitchen } from '../../services/kitchenService'
import type { KitchenProfileInput } from '../../types/kitchen.types'
import { useChefKitchen } from './chefContext'

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
    </section>
  )
}
