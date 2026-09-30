import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LatLng } from './geo.js';

// ZIP code centers from the US Census Bureau's ZCTA Gazetteer (public domain), built by scripts/build-zip-centroids.mjs.
// Works from src/services (tests, tsx) and dist/services (production build): both are two folders below backend/.
const DATA_FILE = fileURLToPath(new URL('../../data/zip-centroids.csv', import.meta.url));

let centroids: Map<string, LatLng> | null = null;

function loadCentroids(): Map<string, LatLng> {
  const rows = fs.readFileSync(DATA_FILE, 'utf8').trim().split('\n').slice(1);
  return new Map(
    rows.map((row) => {
      const [zip, latitude, longitude] = row.split(',');
      return [zip, { latitude: Number(latitude), longitude: Number(longitude) }];
    }),
  );
}

/** The middle of a 5-digit ZIP code (a ZIP+4 is fine), or null if there is no such ZIP code. */
export function zipCentroid(zip: string): LatLng | null {
  const match = /^(\d{5})(-\d{4})?$/.exec(zip.trim());
  if (!match) return null;
  centroids ??= loadCentroids();
  return centroids.get(match[1]) ?? null;
}

// Five digits in a row (a ZIP+4 is fine), not part of a longer number.
const FIVE_DIGITS = /(?<!\d)(\d{5})(?:-\d{4})?(?!\d)/g;

/**
 * The 5-digit ZIP code in an address someone typed, or null when there is none or it is unclear which
 * number is the ZIP code (for example a gate code next to it). A house number at the start is not a ZIP code.
 */
export function zipFromAddress(address: string): string | null {
  const text = address.trim();
  const candidates = [...text.matchAll(FIVE_DIGITS)].filter((match) => match.index !== 0);
  return candidates.length === 1 ? candidates[0][1] : null;
}
