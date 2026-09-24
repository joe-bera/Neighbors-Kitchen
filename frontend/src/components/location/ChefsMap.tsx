import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import type { ChefMapData } from '../../types/catalog.types'
import { kitchenTitle } from '../../utils/format'
import { boundsAround, formatDistance, MILES_TO_METERS } from '../../utils/location'
import Rating from '../common/Rating'
import { AREA_STYLE, ORIGIN_STYLE, TILE_CREDIT, TILE_URL } from './mapConfig'
import './Location.css'

// The Inland Empire, shown for a moment before the map fits the results.
const START_CENTER: [number, number] = [34.0, -117.25]
const START_ZOOM = 9

function FitBounds({ bounds }: { bounds: ReturnType<typeof boundsAround> }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 })
  }, [map, bounds])
  return null
}

export default function ChefsMap({ data }: { data: ChefMapData }) {
  // Keyed on the loaded data, so the map only re-fits when the results change.
  const bounds = useMemo(
    () => boundsAround([...data.chefs.map((chef) => chef.area), ...(data.origin ? [data.origin] : [])]),
    [data],
  )

  return (
    <div className="chefs-map">
      <MapContainer center={START_CENTER} zoom={START_ZOOM} scrollWheelZoom={false} className="map-frame map-frame--large">
        <TileLayer url={TILE_URL} attribution={TILE_CREDIT} />
        <FitBounds bounds={bounds} />
        {data.origin && (
          <CircleMarker center={[data.origin.latitude, data.origin.longitude]} radius={7} pathOptions={ORIGIN_STYLE}>
            <Popup>Your search starts here</Popup>
          </CircleMarker>
        )}
        {data.chefs.map((chef) => (
          <Circle
            key={chef.id}
            center={[chef.area.latitude, chef.area.longitude]}
            radius={chef.area.radiusMiles * MILES_TO_METERS}
            pathOptions={AREA_STYLE}
          >
            <Popup>
              <p className="map-popup-title">
                <Link to={`/chefs/${chef.id}`}>{kitchenTitle(chef)}</Link>
              </p>
              <p className="map-popup-meta">
                <Rating average={chef.averageRating} count={chef.totalReviews} /> &middot; {chef.city}
                {chef.distanceMiles !== null && <> &middot; {formatDistance(chef.distanceMiles)}</>}
              </p>
              {!chef.isAcceptingOrders && <p className="map-popup-meta">Not taking orders right now</p>}
            </Popup>
          </Circle>
        ))}
      </MapContainer>
      <p className="map-note">Each circle shows the area a chef cooks in, not their address.</p>
    </div>
  )
}
