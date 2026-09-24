import { env } from '../config/env.js';
import { LatLng } from './geo.js';

// Turns a US street address into map coordinates with the US Census Bureau geocoder
// (free, no account: https://geocoding.geo.census.gov). Returns null when the address is not found
// or the service fails or is slow, so callers can fall back or carry on without a location.
// Addresses are never written to the logs.

const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const TIMEOUT_MS = 6000;

interface CensusAnswer {
  result?: { addressMatches?: { coordinates?: { x?: unknown; y?: unknown } }[] };
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const oneLine = address.trim();
  if (env.GEOCODER === 'off' || oneLine === '') return null;

  const url = new URL(CENSUS_URL);
  url.search = new URLSearchParams({ address: oneLine, benchmark: 'Public_AR_Current', format: 'json' }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`the service answered ${response.status}`);
    const answer = (await response.json()) as CensusAnswer;
    const coordinates = answer.result?.addressMatches?.[0]?.coordinates;
    if (typeof coordinates?.x !== 'number' || typeof coordinates.y !== 'number') return null;
    return { latitude: coordinates.y, longitude: coordinates.x };
  } catch (error) {
    console.warn('Address lookup failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
