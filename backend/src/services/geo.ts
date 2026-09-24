// Distances between places, and the privacy offset used for chefs' public map areas.
// Pure functions: no database or network.

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_MILES = 3958.8;
export const MILES_PER_DEGREE_LATITUDE = (Math.PI * EARTH_RADIUS_MILES) / 180;

/** Radius of the circle shown to the public around a chef's area center. */
export const AREA_RADIUS_MILES = 0.5;
// The area center is this far from the real location, so the home is inside the circle but never at its center.
const MIN_OFFSET_MILES = 0.1;
const MAX_OFFSET_MILES = 0.3;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const roundCoordinate = (value: number) => Math.round(value * 1e6) / 1e6;

/** Straight-line ("as the crow flies") miles between two places, using the haversine formula. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function roundToTenth(miles: number): number {
  return Math.round(miles * 10) / 10;
}

/**
 * A chef's public area center: the real location moved 0.1 to 0.3 miles in a random direction.
 * `random` returns numbers from 0 up to 1; it is called once for the distance, then once for the direction.
 */
export function approximateLocation(exact: LatLng, random: () => number = Math.random): LatLng {
  const offset = MIN_OFFSET_MILES + random() * (MAX_OFFSET_MILES - MIN_OFFSET_MILES);
  const bearing = random() * 2 * Math.PI;
  const milesPerDegreeLongitude = MILES_PER_DEGREE_LATITUDE * Math.cos(toRadians(exact.latitude));
  return {
    latitude: roundCoordinate(exact.latitude + (offset * Math.cos(bearing)) / MILES_PER_DEGREE_LATITUDE),
    longitude: roundCoordinate(exact.longitude + (offset * Math.sin(bearing)) / milesPerDegreeLongitude),
  };
}

/** A repeatable random number source (mulberry32) seeded from text, so sample data gets the same areas every time. */
export function seededRandom(seedText: string): () => number {
  let seed = 0;
  for (const char of seedText) seed = (Math.imul(31, seed) + char.charCodeAt(0)) | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
