// Searching for chefs by distance. The place a search starts from lives in the page address:
// ?near=92373 for a ZIP code, or ?lat=34.06&lng=-117.18 for "Use my location".

export const DISTANCE_OPTIONS = [5, 10, 25, 50] as const
export const DEFAULT_MAX_DISTANCE = 25
export const MILES_TO_METERS = 1609.344
const MILES_PER_DEGREE_LATITUDE = 69.09
const LAST_ZIP_KEY = 'nk-last-zip'

export type SearchPlace = { kind: 'zip'; zip: string } | { kind: 'here'; latitude: number; longitude: number }

/** "92373", " 92373 " and "92373-1234" all become "92373"; anything else is null. */
export function normalizeZip(value: string): string | null {
  const match = /^(\d{5})(-\d{4})?$/.exec(value.trim())
  return match ? match[1] : null
}

/** Rounds a browser location to 2 decimals (about half a mile) before it leaves the device. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100
}

export function readSearchPlace(params: URLSearchParams): SearchPlace | null {
  const zip = normalizeZip(params.get('near') ?? '')
  if (zip) return { kind: 'zip', zip }
  const lat = params.get('lat')?.trim() ?? ''
  const lng = params.get('lng')?.trim() ?? ''
  if (lat === '' || lng === '') return null
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { kind: 'here', latitude, longitude }
}

/** Page-address changes for a search place. Clearing the place also clears its distance limit. */
export function searchPlaceParams(place: SearchPlace | null): Record<string, string | null> {
  if (!place) return { near: null, lat: null, lng: null, maxDistance: null }
  if (place.kind === 'zip') return { near: place.zip, lat: null, lng: null }
  return { near: null, lat: String(place.latitude), lng: String(place.longitude) }
}

export function describePlace(place: SearchPlace): string {
  return place.kind === 'zip' ? `near ${place.zip}` : 'near you'
}

export function formatDistance(miles: number): string {
  const rounded = Math.round(miles * 10) / 10
  if (rounded < 1) return 'less than a mile away'
  if (rounded === 1) return '1 mile away'
  return `${rounded} miles away`
}

interface MapSpot {
  latitude: number
  longitude: number
  radiusMiles?: number
}

/** The south-west and north-east corners that fit every spot (and the circle around it) on a map. */
export function boundsAround(spots: MapSpot[]): [[number, number], [number, number]] | null {
  if (spots.length === 0) return null
  let south = 90
  let north = -90
  let west = 180
  let east = -180
  for (const spot of spots) {
    const radius = spot.radiusMiles ?? 0
    const latitudeReach = radius / MILES_PER_DEGREE_LATITUDE
    const longitudeReach = radius / (MILES_PER_DEGREE_LATITUDE * Math.cos((spot.latitude * Math.PI) / 180))
    south = Math.min(south, spot.latitude - latitudeReach)
    north = Math.max(north, spot.latitude + latitudeReach)
    west = Math.min(west, spot.longitude - longitudeReach)
    east = Math.max(east, spot.longitude + longitudeReach)
  }
  return [
    [south, west],
    [north, east],
  ]
}

/** Remembers the last ZIP code typed, to fill in the box next time. Browser storage can be blocked, so this never throws. */
export function rememberZip(zip: string): void {
  try {
    localStorage.setItem(LAST_ZIP_KEY, zip)
  } catch {
    // Storage is blocked or unavailable: nothing to remember.
  }
}

export function recallZip(): string {
  try {
    return localStorage.getItem(LAST_ZIP_KEY) ?? ''
  } catch {
    return ''
  }
}
