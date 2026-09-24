import { lazy, Suspense } from 'react'
import type { ChefArea } from '../../types/catalog.types'
import type { LocationPrecision } from '../../types/kitchen.types'

const AreaMap = lazy(() => import('./AreaMap'))

interface KitchenLocationPreviewProps {
  area: ChefArea | null
  precision: LocationPrecision | null
  zipCode: string
}

/** Shows chefs how neighbors see their location, and says plainly when it could not be found. */
export default function KitchenLocationPreview({ area, precision, zipCode }: KitchenLocationPreviewProps) {
  if (!area) {
    return (
      <p className="form-section-note">
        We could not place your address on the map yet, so your kitchen does not appear when neighbors search near
        them. Check your street address and ZIP code above, then save again.
      </p>
    )
  }
  if (precision !== 'ADDRESS') {
    return (
      <p className="form-section-note">
        We could only find your ZIP code {zipCode}, so neighbors see your kitchen near the middle of that ZIP code
        instead of near your home, and delivery distances are not checked yet. Check your street address above and
        save again.
      </p>
    )
  }
  return (
    <>
      <Suspense fallback={<div className="map-frame" />}>
        <AreaMap area={area} />
      </Suspense>
      <p className="map-note">
        Neighbors see this circle, about a mile across, and never your street address. Your home is inside it but not at
        the center.
      </p>
    </>
  )
}
