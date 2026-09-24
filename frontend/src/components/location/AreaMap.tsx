import 'leaflet/dist/leaflet.css'
import { Circle, MapContainer, TileLayer } from 'react-leaflet'
import type { ChefArea } from '../../types/catalog.types'
import { MILES_TO_METERS } from '../../utils/location'
import { AREA_STYLE, TILE_CREDIT, TILE_URL } from './mapConfig'
import './Location.css'

/** A small map of the approximate area where a chef cooks. */
export default function AreaMap({ area }: { area: ChefArea }) {
  const center: [number, number] = [area.latitude, area.longitude]
  return (
    // A new key when the area moves, because Leaflet only reads the center once.
    <MapContainer key={center.join(',')} center={center} zoom={13} scrollWheelZoom={false} className="map-frame">
      <TileLayer url={TILE_URL} attribution={TILE_CREDIT} />
      <Circle center={center} radius={area.radiusMiles * MILES_TO_METERS} pathOptions={AREA_STYLE} />
    </MapContainer>
  )
}
