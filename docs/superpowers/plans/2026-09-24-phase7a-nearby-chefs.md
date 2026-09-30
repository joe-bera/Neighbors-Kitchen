# Phase 7a: Find Chefs Near You Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers find chefs by ZIP code or their location, see them on a map as approximate circles, and delivery orders beyond a chef's delivery distance are refused.

**Architecture:** The backend stores each kitchen's exact position (private) and a randomly shifted public "area center". All public distances are measured from the area center. Chef searches rank by distance in code after a normal Prisma filter. Addresses are geocoded with the free US Census geocoder; ZIP codes come from a bundled Census list. The frontend adds a ZIP/"Use my location" form, a distance filter, a List/Map toggle and small area maps, drawn with Leaflet and OpenStreetMap tiles in lazy-loaded chunks.

**Tech Stack:** Express 5, Prisma 6, PostgreSQL, Zod 4, Vitest + Supertest (backend); React 19, React Router 7, Vitest + Testing Library (frontend); Leaflet 1.9 + react-leaflet 5 (new).

**Spec:** `docs/superpowers/specs/2026-09-24-phase7a-nearby-chefs-design.md`

## Global Constraints

- Public responses never include `latitude`, `longitude`, `addressLine1`, `addressLine2`, `zipCode`, `userId`, email or phone. Only `area` (the shifted center plus `radiusMiles: 0.5`) and distances measured from it are public.
- The area center is 0.1 to 0.3 miles from the exact position; `AREA_RADIUS_MILES = 0.5`.
- Every distance shown or compared is rounded with `roundToTenth` and measured from the area center.
- Backend relative imports end in `.js`; read settings from `env`, never `process.env` (except in `prisma/seed.ts`, which already does).
- Throw `AppError(status, code, message, details?)` for client errors.
- `GEOCODER` setting: `census` (default) or `off`; the test environment is `off`. Tests never reach the network.
- Map tiles: `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with the credit `© OpenStreetMap contributors` linking to https://www.openstreetmap.org/copyright.
- Leaflet code and CSS load only through `React.lazy`, never in the main bundle.
- Copy is plain and friendly; no emojis.
- Commit after each task with a conventional message ending in the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push at the end (Task 12).

## Review Focus

1. A delivery address exactly at the chef's limit must be accepted, and 0.2 miles past it refused (Task 7 pins both).
2. When the Census service is slow or down, a delivery order must still go through, after at most about 6 seconds (Task 3 pins the timeout path; Task 7 pins "address not found means the order goes through").
3. A customer who types a ZIP+4 or extra spaces in the ZIP box gets results for the 5-digit ZIP (Task 8 `normalizeZip`, Task 9 form test).
4. A leftover `maxDistance` without a place must not hide chefs; clearing the location also clears the distance (Task 6 backend test, Task 8 `searchPlaceParams(null)` test).
5. A chef who edits only the apartment line, or saves the same address again, must not be looked up again, so their circle does not jump (Task 4 test).

---

### Task 1: Distance math and the privacy offset

**Files:**
- Create: `backend/src/services/geo.ts`
- Test: `backend/tests/geo.test.ts`

**Interfaces:**
- Produces: `interface LatLng { latitude: number; longitude: number }`, `distanceMiles(a: LatLng, b: LatLng): number`, `roundToTenth(miles: number): number`, `approximateLocation(exact: LatLng, random?: () => number): LatLng`, `seededRandom(seedText: string): () => number`, `AREA_RADIUS_MILES = 0.5`, `MILES_PER_DEGREE_LATITUDE` (about 69.094).

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/geo.test.ts
import { describe, expect, it } from 'vitest';
import { AREA_RADIUS_MILES, approximateLocation, distanceMiles, roundToTenth, seededRandom } from '../src/services/geo.js';

const redlands = { latitude: 34.0556, longitude: -117.1825 };
const riverside = { latitude: 33.9806, longitude: -117.3755 };

describe('distanceMiles', () => {
  it('measures straight-line miles between two places', () => {
    expect(distanceMiles(redlands, riverside)).toBeCloseTo(12.2, 1);
    expect(distanceMiles(riverside, redlands)).toBeCloseTo(distanceMiles(redlands, riverside), 10);
  });

  it('is zero for the same place', () => {
    expect(distanceMiles(redlands, redlands)).toBe(0);
  });
});

describe('roundToTenth', () => {
  it('rounds to one decimal place', () => {
    expect(roundToTenth(11.26)).toBe(11.3);
    expect(roundToTenth(0.04)).toBe(0);
  });
});

describe('approximateLocation', () => {
  it('moves the location 0.1 to 0.3 miles, always inside the public circle', () => {
    for (let i = 0; i < 500; i += 1) {
      const offset = distanceMiles(redlands, approximateLocation(redlands));
      expect(offset).toBeGreaterThanOrEqual(0.099);
      expect(offset).toBeLessThanOrEqual(0.301);
      expect(offset).toBeLessThan(AREA_RADIUS_MILES);
    }
  });

  it('uses the random source for the distance and then the direction', () => {
    expect(approximateLocation(redlands, () => 0)).toEqual({ latitude: 34.057047, longitude: -117.1825 });
    const draws = [0.5, 0.25]; // 0.2 miles, due east
    expect(approximateLocation(redlands, () => draws.shift()!)).toEqual({ latitude: 34.0556, longitude: -117.179006 });
  });
});

describe('seededRandom', () => {
  it('repeats the same numbers for the same seed', () => {
    const first = seededRandom('maria@neighborskitchen.test');
    const again = seededRandom('maria@neighborskitchen.test');
    const other = seededRandom('kenji@neighborskitchen.test');
    const numbers = [first(), first(), first()];

    expect([again(), again(), again()]).toEqual(numbers);
    expect([other(), other(), other()]).not.toEqual(numbers);
    for (const value of numbers) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/geo.test.ts`
Expected: FAIL, cannot find module `../src/services/geo.js`.

- [ ] **Step 3: Write the implementation**

```ts
// backend/src/services/geo.ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/geo.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/geo.ts backend/tests/geo.test.ts
git commit -m "feat(api): distance math and privacy offset for chef locations" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: ZIP code centers from the Census list

**Files:**
- Create: `backend/scripts/build-zip-centroids.mjs`
- Create: `backend/data/zip-centroids.csv` (generated, committed)
- Create: `backend/src/services/zipCodes.ts`
- Test: `backend/tests/zipCodes.test.ts`

**Interfaces:**
- Consumes: `LatLng` from Task 1.
- Produces: `zipCentroid(zip: string): LatLng | null` (accepts `92373`, `92373-1234`, surrounding spaces).

Source file facts: `2025_Gaz_zcta_national.txt` is **pipe-delimited** with the header `GEOID|GEOIDFQ|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG` and 33,791 data rows. Example row: `92373|860Z200US92373|103276295|514517|39.875|0.199|34.011947|-117.159702`.

- [ ] **Step 1: Get the source file (already approved by the owner)**

```bash
SCRATCH=/private/tmp/claude-501/-Users-josephlombera-Documents-claude-code-neighbors-kitchen/d05fc809-874d-4096-ba62-f25a076f11b9/scratchpad
test -f "$SCRATCH/2025_Gaz_zcta_national.txt" || (curl -sSfL -o "$SCRATCH/2025_Gaz_zcta_national.zip" https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip && unzip -o -q "$SCRATCH/2025_Gaz_zcta_national.zip" -d "$SCRATCH")
head -1 "$SCRATCH/2025_Gaz_zcta_national.txt"
```
Expected: `GEOID|GEOIDFQ|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG`

- [ ] **Step 2: Write the build script**

```js
// backend/scripts/build-zip-centroids.mjs
// Builds data/zip-centroids.csv (zip,latitude,longitude) from the US Census Bureau's ZIP code (ZCTA) Gazetteer file.
// Source, public domain: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip
// Usage: node scripts/build-zip-centroids.mjs path/to/2025_Gaz_zcta_national.txt
import fs from 'node:fs';
import path from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/build-zip-centroids.mjs path/to/2025_Gaz_zcta_national.txt');
  process.exit(1);
}

const [header, ...rows] = fs.readFileSync(source, 'utf8').trim().split(/\r?\n/);
// The 2025 file separates columns with "|"; older years used tabs.
const delimiter = header.includes('|') ? '|' : '\t';
const columns = header.split(delimiter).map((name) => name.trim());
const zipIndex = columns.indexOf('GEOID');
const latIndex = columns.indexOf('INTPTLAT');
const lngIndex = columns.indexOf('INTPTLONG');
if ([zipIndex, latIndex, lngIndex].includes(-1)) throw new Error(`Unexpected columns: ${columns.join(', ')}`);

const lines = rows.map((row) => {
  const cells = row.split(delimiter).map((cell) => cell.trim());
  return `${cells[zipIndex]},${Number(cells[latIndex]).toFixed(4)},${Number(cells[lngIndex]).toFixed(4)}`;
});

const target = path.resolve(import.meta.dirname, '../data/zip-centroids.csv');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `zip,latitude,longitude\n${lines.join('\n')}\n`);
console.log(`Wrote ${lines.length} ZIP codes to ${target}`);
```

- [ ] **Step 3: Build the data file and check it**

```bash
cd backend && node scripts/build-zip-centroids.mjs "$SCRATCH/2025_Gaz_zcta_national.txt"
grep -E "^(92373|92262|10001)," data/zip-centroids.csv
ls -la data/zip-centroids.csv
```
Expected: `Wrote 33791 ZIP codes ...`, then `10001,40.7506,-73.9973`, `92262,33.8630,-116.5567`, `92373,34.0119,-117.1597`, and a file of roughly 800 KB.

- [ ] **Step 4: Write the failing test**

```ts
// backend/tests/zipCodes.test.ts
import { describe, expect, it } from 'vitest';
import { distanceMiles } from '../src/services/geo.js';
import { zipCentroid } from '../src/services/zipCodes.js';

describe('zipCentroid', () => {
  it('finds the middle of a ZIP code area', () => {
    const redlands = zipCentroid('92373');
    expect(redlands).toEqual({ latitude: 34.0119, longitude: -117.1597 });
    // Redlands City Hall is in 92373, about 3 miles from the middle of the ZIP code.
    expect(distanceMiles(redlands!, { latitude: 34.0552, longitude: -117.1825 })).toBeLessThan(5);
  });

  it('accepts ZIP+4 codes and extra spaces', () => {
    expect(zipCentroid(' 92373-1234 ')).toEqual(zipCentroid('92373'));
  });

  it('knows ZIP codes across the country', () => {
    expect(zipCentroid('10001')).toEqual({ latitude: 40.7506, longitude: -73.9973 });
    expect(zipCentroid('92262')).not.toBeNull();
  });

  it('returns null for unknown or malformed ZIP codes', () => {
    expect(zipCentroid('00000')).toBeNull();
    expect(zipCentroid('9237')).toBeNull();
    expect(zipCentroid('abcde')).toBeNull();
    expect(zipCentroid('')).toBeNull();
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/zipCodes.test.ts`
Expected: FAIL, cannot find module `../src/services/zipCodes.js`.

- [ ] **Step 6: Write the implementation**

```ts
// backend/src/services/zipCodes.ts
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
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/zipCodes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add backend/scripts/build-zip-centroids.mjs backend/data/zip-centroids.csv backend/src/services/zipCodes.ts backend/tests/zipCodes.test.ts
git commit -m "feat(api): ZIP code centers from the Census Bureau list" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Census address lookup

**Files:**
- Create: `backend/src/services/geocoding.ts`
- Modify: `backend/src/config/env.ts` (add `GEOCODER`)
- Modify: `backend/tests/testEnv.ts` (add `GEOCODER: 'off'`)
- Modify: `backend/.env.example`
- Test: `backend/tests/geocoding.test.ts`

**Interfaces:**
- Consumes: `LatLng` (Task 1), `env` from `config/env.ts`.
- Produces: `geocodeAddress(address: string): Promise<LatLng | null>`; `env.GEOCODER: 'census' | 'off'`.

- [ ] **Step 1: Add the setting**

In `backend/src/config/env.ts`, after `PLATFORM_FEE_PERCENT`:

```ts
  // Address lookups for the map: "census" uses the free US Census Bureau geocoder, "off" skips them (tests)
  GEOCODER: z.enum(['census', 'off']).default('census'),
```

In `backend/tests/testEnv.ts`, add to `testEnv` (after `FRONTEND_URL`):

```ts
  // Tests never call the real address service; tests that need a result mock services/geocoding.
  GEOCODER: 'off',
```

In `backend/.env.example`, insert this directly before the three-line header block `# ----- / # Added in later phases (not used yet) / # -----`:

```
# Address lookups for the map (Phase 7): "census" uses the free US Census Bureau geocoder (no key needed), "off" skips them
GEOCODER=census

```

and delete these two lines further down, which are replaced by it:

```
# Maps / geocoding (Phase 7)
# GOOGLE_MAPS_API_KEY=...
```

- [ ] **Step 2: Write the failing test**

```ts
// backend/tests/geocoding.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress } from '../src/services/geocoding.js';

// The test environment turns lookups off (GEOCODER=off). These tests switch them on and fake the Census service.
const settings = vi.hoisted(() => ({ geocoder: 'census' as 'census' | 'off' }));
vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    env: new Proxy(actual.env, {
      get: (target, key) => (key === 'GEOCODER' ? settings.geocoder : Reflect.get(target, key)),
    }),
  };
});

const ADDRESS = '35 Cajon St, Redlands, CA 92373';
const fetchMock = vi.fn();
const censusAnswer = (matches: unknown[]) =>
  new Response(JSON.stringify({ result: { addressMatches: matches } }), { status: 200 });

beforeEach(() => {
  settings.geocoder = 'census';
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('geocodeAddress', () => {
  it('returns the first match from the Census geocoder', async () => {
    fetchMock.mockResolvedValue(
      censusAnswer([{ coordinates: { x: -117.182488, y: 34.055217 } }, { coordinates: { x: 0, y: 0 } }]),
    );

    const result = await geocodeAddress(ADDRESS);

    expect(result).toEqual({ latitude: 34.055217, longitude: -117.182488 });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(`${url.origin}${url.pathname}`).toBe('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
    expect(url.searchParams.get('address')).toBe(ADDRESS);
    expect(url.searchParams.get('benchmark')).toBe('Public_AR_Current');
    expect(url.searchParams.get('format')).toBe('json');
  });

  it('returns null when the address is not found', async () => {
    fetchMock.mockResolvedValue(censusAnswer([]));

    expect(await geocodeAddress(ADDRESS)).toBeNull();
  });

  it('returns null when the service answers with an error', async () => {
    fetchMock.mockResolvedValue(new Response('Service busy', { status: 503 }));

    expect(await geocodeAddress(ADDRESS)).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it('returns null when the service cannot be reached or takes too long', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));

    expect(await geocodeAddress(ADDRESS)).toBeNull();
  });

  it('puts a time limit on the request', async () => {
    fetchMock.mockResolvedValue(censusAnswer([]));

    await geocodeAddress(ADDRESS);

    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('does not call the service when lookups are off', async () => {
    settings.geocoder = 'off';

    expect(await geocodeAddress(ADDRESS)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call the service for a blank address', async () => {
    expect(await geocodeAddress('   ')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/geocoding.test.ts`
Expected: FAIL, cannot find module `../src/services/geocoding.js`.

- [ ] **Step 4: Write the implementation**

```ts
// backend/src/services/geocoding.ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/geocoding.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/geocoding.ts backend/src/config/env.ts backend/tests/testEnv.ts backend/.env.example backend/tests/geocoding.test.ts
git commit -m "feat(api): look up addresses with the free Census geocoder" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Store kitchen locations and public areas

**Files:**
- Modify: `backend/prisma/schema.prisma` (ChefProfile after `longitude`; Order after `deliveryAddress`)
- Create: `backend/prisma/migrations/<timestamp>_chef_locations/migration.sql` (generated)
- Create: `backend/src/services/locationService.ts`
- Modify: `backend/src/services/kitchenService.ts`
- Test: `backend/tests/kitchenLocation.test.ts`

**Interfaces:**
- Consumes: `approximateLocation`, `AREA_RADIUS_MILES`, `LatLng` (Task 1); `zipCentroid` (Task 2); `geocodeAddress` (Task 3).
- Produces (locationService): `interface KitchenAddress { addressLine1: string; city: string; state: string; zipCode: string }`, `locateKitchen(address: KitchenAddress): Promise<{ latitude: number | null; longitude: number | null; approxLatitude: number | null; approxLongitude: number | null }>`, `areaCenter(chef: { approxLatitude: Prisma.Decimal | null; approxLongitude: Prisma.Decimal | null }): LatLng | null`, `toArea(chef): { latitude: number; longitude: number; radiusMiles: number } | null`. Own kitchen JSON gains `area`.
- Produces (schema): `ChefProfile.approxLatitude`, `ChefProfile.approxLongitude` (`Decimal?`), `Order.deliveryDistanceMiles` (`Decimal?`).

- [ ] **Step 1: Change the schema**

In `backend/prisma/schema.prisma`, model `ChefProfile`, directly after the `longitude` line:

```prisma
  // Public area center: the location moved 0.1-0.3 miles in a random direction (services/geo.ts)
  approxLatitude          Decimal? @map("approx_latitude") @db.Decimal(9, 6)
  approxLongitude         Decimal? @map("approx_longitude") @db.Decimal(9, 6)
```

Model `Order`, directly after the `deliveryAddress` line:

```prisma
  // Straight-line miles from the chef's area center to the delivery address, when it could be located
  deliveryDistanceMiles Decimal?        @map("delivery_distance_miles") @db.Decimal(5, 1)
```

- [ ] **Step 2: Create and apply the migration**

`prisma migrate dev` stops on warnings when run without a terminal, so generate the SQL directly (the dev database is the "before" state):

```bash
cd backend
DIR="prisma/migrations/$(date -u +%Y%m%d%H%M%S)_chef_locations"
mkdir -p "$DIR"
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > "$DIR/migration.sql"
cat "$DIR/migration.sql"
npx prisma migrate deploy && npx prisma generate
```
Expected SQL:

```sql
-- AlterTable
ALTER TABLE "chef_profiles" ADD COLUMN     "approx_latitude" DECIMAL(9,6),
ADD COLUMN     "approx_longitude" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_distance_miles" DECIMAL(5,1);
```
If anything else appears in the SQL, stop and find out why before applying.

- [ ] **Step 3: Write the failing test**

```ts
// backend/tests/kitchenLocation.test.ts
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { distanceMiles } from '../src/services/geo.js';
import { geocodeAddress } from '../src/services/geocoding.js';
import { zipCentroid } from '../src/services/zipCodes.js';
import { API, bearer, kitchenInput, signUp, signUpChefWithKitchen } from './helpers.js';

vi.mock('../src/services/geocoding.js', () => ({ geocodeAddress: vi.fn() }));
const geocode = vi.mocked(geocodeAddress);

const app = createApp();
const CITY_HALL = { latitude: 34.055217, longitude: -117.182488 };
const PALM_SPRINGS = { latitude: 33.8303, longitude: -116.5453 };

beforeEach(() => {
  geocode.mockReset();
  geocode.mockResolvedValue(null);
});

/** What is stored for the user's kitchen: the exact position and the public area center. */
async function storedLocation(userId: string) {
  const chef = await prisma.chefProfile.findUniqueOrThrow({ where: { userId } });
  const point = (lat: typeof chef.latitude, lng: typeof chef.longitude) =>
    lat && lng ? { latitude: lat.toNumber(), longitude: lng.toNumber() } : null;
  return { exact: point(chef.latitude, chef.longitude), area: point(chef.approxLatitude, chef.approxLongitude) };
}

describe('Placing a kitchen on the map', () => {
  it('finds a new kitchen at its street address and shows the chef only the approximate area', async () => {
    geocode.mockResolvedValue(CITY_HALL);
    const customer = await signUp(app);

    const res = await request(app).post(`${API}/chefs`).set(bearer(customer.accessToken)).send(kitchenInput);

    expect(res.status).toBe(201);
    expect(geocode).toHaveBeenCalledWith('742 Evergreen Terrace, Redlands, CA 92373');
    const { exact, area } = await storedLocation(customer.userId);
    expect(exact).toEqual(CITY_HALL);
    const offset = distanceMiles(exact!, area!);
    expect(offset).toBeGreaterThanOrEqual(0.099);
    expect(offset).toBeLessThanOrEqual(0.301);
    expect(res.body.data.chefProfile.area).toEqual({ ...area, radiusMiles: 0.5 });
    expect(res.body.data.chefProfile).not.toHaveProperty('latitude');
    expect(res.body.data.chefProfile).not.toHaveProperty('longitude');
    expect(res.body.data.chefProfile).not.toHaveProperty('approxLatitude');
  });

  it('uses the middle of the ZIP code when the street address is not found', async () => {
    const customer = await signUp(app);

    await request(app).post(`${API}/chefs`).set(bearer(customer.accessToken)).send(kitchenInput);

    expect((await storedLocation(customer.userId)).exact).toEqual(zipCentroid('92373'));
  });

  it('leaves a kitchen off the map when neither the address nor the ZIP code can be found', async () => {
    const customer = await signUp(app);

    const res = await request(app)
      .post(`${API}/chefs`)
      .set(bearer(customer.accessToken))
      .send({ ...kitchenInput, zipCode: '00000' });

    expect(res.status).toBe(201);
    expect(res.body.data.chefProfile.area).toBeNull();
    expect(await storedLocation(customer.userId)).toEqual({ exact: null, area: null });
  });

  it('finds the kitchen again when the address changes', async () => {
    const chef = await signUpChefWithKitchen(app);
    const before = await storedLocation(chef.userId);
    geocode.mockResolvedValue(PALM_SPRINGS);

    const res = await request(app)
      .put(`${API}/chefs/me`)
      .set(bearer(chef.accessToken))
      .send({ addressLine1: '300 N Palm Canyon Dr', city: 'Palm Springs', zipCode: '92262' });

    expect(res.status).toBe(200);
    expect(geocode).toHaveBeenLastCalledWith('300 N Palm Canyon Dr, Palm Springs, CA 92262');
    const after = await storedLocation(chef.userId);
    expect(after.exact).toEqual(PALM_SPRINGS);
    expect(after.area).not.toEqual(before.area);
    expect(res.body.data.chefProfile.area).toEqual({ ...after.area, radiusMiles: 0.5 });
  });

  it('keeps the same area when the apartment line or other details change, or the same address is saved again', async () => {
    const chef = await signUpChefWithKitchen(app);
    const before = await storedLocation(chef.userId);
    geocode.mockClear();

    await request(app)
      .put(`${API}/chefs/me`)
      .set(bearer(chef.accessToken))
      .send({
        bio: 'Now cooking Oaxacan moles every weekend for the neighborhood.',
        addressLine2: 'Unit B',
        addressLine1: '742 Evergreen Terrace',
        city: 'Redlands',
      });

    expect(geocode).not.toHaveBeenCalled();
    expect(await storedLocation(chef.userId)).toEqual(before);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/kitchenLocation.test.ts`
Expected: FAIL: `geocode` is never called and `area` is undefined.

- [ ] **Step 5: Write `locationService.ts`**

```ts
// backend/src/services/locationService.ts
import { Prisma } from '@prisma/client';
import { AREA_RADIUS_MILES, approximateLocation, LatLng } from './geo.js';
import { geocodeAddress } from './geocoding.js';
import { zipCentroid } from './zipCodes.js';

// Where kitchens are, and the approximate areas the public sees.
// Design: docs/superpowers/specs/2026-09-24-phase7a-nearby-chefs-design.md

export interface KitchenAddress {
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
}

interface AreaColumns {
  approxLatitude: Prisma.Decimal | null;
  approxLongitude: Prisma.Decimal | null;
}

/**
 * Finds a kitchen from its street address (falling back to the middle of its ZIP code) and picks
 * its public area center. Everything is null when neither can be found. The apartment line is left
 * out of the lookup on purpose: it does not move the kitchen and can confuse the geocoder.
 */
export async function locateKitchen(address: KitchenAddress) {
  const exact =
    (await geocodeAddress(`${address.addressLine1}, ${address.city}, ${address.state} ${address.zipCode}`)) ??
    zipCentroid(address.zipCode);
  if (!exact) return { latitude: null, longitude: null, approxLatitude: null, approxLongitude: null };
  const area = approximateLocation(exact);
  return {
    latitude: exact.latitude,
    longitude: exact.longitude,
    approxLatitude: area.latitude,
    approxLongitude: area.longitude,
  };
}

/** The public area center, used for every distance the app shows or compares. */
export function areaCenter(chef: AreaColumns): LatLng | null {
  if (chef.approxLatitude === null || chef.approxLongitude === null) return null;
  return { latitude: chef.approxLatitude.toNumber(), longitude: chef.approxLongitude.toNumber() };
}

/** The circle shown on maps: never the chef's real location. */
export function toArea(chef: AreaColumns) {
  const center = areaCenter(chef);
  return center && { ...center, radiusMiles: AREA_RADIUS_MILES };
}
```

- [ ] **Step 6: Use it in `kitchenService.ts`**

Add the import:

```ts
import { locateKitchen, toArea } from './locationService.js';
```

Add below the imports:

```ts
// Changing any of these moves the kitchen on the map (the apartment line does not).
const ADDRESS_FIELDS = ['addressLine1', 'city', 'state', 'zipCode'] as const;
```

In `toOwnKitchen`, after `zipCode: chef.zipCode,` add:

```ts
    // Where neighbors see the kitchen: an approximate area, never the street address.
    area: toArea(chef),
```

In `becomeChef`, after the `ALREADY_CHEF` check and before `try {`, add:

```ts
  const location = await locateKitchen(input);
```

and change the create data to:

```ts
        data: { ...input, ...location, userId, menus: { create: { name: 'Menu' } } },
```

Replace `updateOwnKitchen` with:

```ts
export async function updateOwnKitchen(userId: string, input: KitchenUpdateInput) {
  const current = await requireOwnKitchen(userId);
  const address = {
    addressLine1: input.addressLine1 ?? current.addressLine1,
    city: input.city ?? current.city,
    state: input.state ?? current.state,
    zipCode: input.zipCode ?? current.zipCode,
  };
  const moved = ADDRESS_FIELDS.some((field) => address[field] !== current[field]);
  const location = moved ? await locateKitchen(address) : {};
  const chef = await prisma.chefProfile.update({
    where: { id: current.id },
    data: { ...input, ...location },
    include: ownKitchenInclude,
  });
  return toOwnKitchen(chef);
}
```

- [ ] **Step 7: Run the new test and the existing kitchen tests**

Run: `cd backend && npx vitest run tests/kitchenLocation.test.ts tests/kitchen.test.ts`
Expected: PASS (all).

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/services/locationService.ts backend/src/services/kitchenService.ts backend/tests/kitchenLocation.test.ts
git commit -m "feat(api): place kitchens on the map with a private exact spot and a public area" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Sample data areas

**Files:**
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Consumes: `approximateLocation`, `seededRandom` (Task 1); `zipCentroid` (Task 2).

- [ ] **Step 1: Give sample chefs a stable area**

Add imports at the top of `backend/prisma/seed.ts`:

```ts
import { approximateLocation, seededRandom } from '../src/services/geo.js';
import { zipCentroid } from '../src/services/zipCodes.js';
```

In `seedChef`, replace the line `const profile = { ...details, ...handover, offersPickup: true, isAcceptingOrders: true };` with:

```ts
  // The public area center is picked from the chef's email, so reseeding keeps the same circle on the map.
  const area = approximateLocation({ latitude: details.latitude, longitude: details.longitude }, seededRandom(email));
  const profile = {
    ...details,
    ...handover,
    approxLatitude: area.latitude,
    approxLongitude: area.longitude,
    offersPickup: true,
    isAcceptingOrders: true,
  };
```

- [ ] **Step 2: Fill areas for every other kitchen**

Add above `main()`:

```ts
/** Puts kitchens made outside the seed (for example while trying the app) on the map, without calling the geocoder. */
async function fillMissingAreas() {
  const chefs = await prisma.chefProfile.findMany({
    where: { OR: [{ approxLatitude: null }, { approxLongitude: null }] },
    select: { id: true, latitude: true, longitude: true, zipCode: true },
  });
  let placed = 0;
  for (const chef of chefs) {
    const exact =
      chef.latitude && chef.longitude
        ? { latitude: chef.latitude.toNumber(), longitude: chef.longitude.toNumber() }
        : zipCentroid(chef.zipCode);
    if (!exact) continue;
    const area = approximateLocation(exact, seededRandom(chef.id));
    await prisma.chefProfile.update({
      where: { id: chef.id },
      data: { ...exact, approxLatitude: area.latitude, approxLongitude: area.longitude },
    });
    placed += 1;
  }
  return placed;
}
```

In `main()`, right after the `for (const chef of chefs)` loop, add:

```ts
  const otherKitchens = await fillMissingAreas();
```

and after the `Added ... dish requests.` log line add:

```ts
  console.log(`Placed ${otherKitchens} other kitchens on the map.`);
```

- [ ] **Step 3: Run the seed twice and check the areas**

```bash
cd backend && npm run db:seed && npm run db:seed
cat > scripts/.tmp-check-areas.ts <<'EOF'
import { PrismaClient } from '@prisma/client';
import { distanceMiles } from '../src/services/geo.js';
const prisma = new PrismaClient();
const chefs = await prisma.chefProfile.findMany({ orderBy: { createdAt: 'asc' } });
for (const chef of chefs) {
  const offset = chef.latitude && chef.approxLatitude
    ? distanceMiles(
        { latitude: chef.latitude.toNumber(), longitude: chef.longitude!.toNumber() },
        { latitude: chef.approxLatitude.toNumber(), longitude: chef.approxLongitude!.toNumber() },
      ).toFixed(3)
    : 'no area';
  console.log(chef.kitchenName, chef.approxLatitude?.toString(), chef.approxLongitude?.toString(), offset);
}
await prisma.$disconnect();
EOF
SCRATCH=/private/tmp/claude-501/-Users-josephlombera-Documents-claude-code-neighbors-kitchen/d05fc809-874d-4096-ba62-f25a076f11b9/scratchpad
npx tsx scripts/.tmp-check-areas.ts > "$SCRATCH/areas-1.txt" && npm run db:seed >/dev/null && npx tsx scripts/.tmp-check-areas.ts > "$SCRATCH/areas-2.txt"
cat "$SCRATCH/areas-1.txt" && diff "$SCRATCH/areas-1.txt" "$SCRATCH/areas-2.txt" && echo "STABLE"
rm scripts/.tmp-check-areas.ts
```
Expected: the second seed prints `Placed 0 other kitchens on the map.`; every kitchen line shows an offset between 0.100 and 0.300 (none says `no area`); `STABLE` is printed.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat(seed): stable map areas for sample kitchens" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Search chefs by distance, and the map endpoint

**Files:**
- Modify: `backend/src/validators/catalogSchemas.ts`
- Modify: `backend/src/services/locationService.ts` (add `resolveOrigin`)
- Modify: `backend/src/services/chefService.ts`
- Modify: `backend/src/controllers/catalogController.ts`
- Modify: `backend/src/routes/catalogRoutes.ts`
- Modify: `backend/tests/factories.ts` (`area` option)
- Test: `backend/tests/location.test.ts`

**Interfaces:**
- Consumes: `distanceMiles`, `roundToTenth`, `LatLng` (Task 1); `zipCentroid` (Task 2); `areaCenter`, `toArea` (Task 4).
- Produces: `GET /api/v1/chefs?near|lat&lng&maxDistance` with `distanceMiles: number | null` on every card; `GET /api/v1/chefs/map` returning `{ origin: LatLng | null, chefs: { id, kitchenName, chefName, firstName, city, averageRating, totalReviews, isAcceptingOrders, distanceMiles, area }[] }`; `area` on `GET /api/v1/chefs/:id`; `resolveOrigin(query: { near?: string; lat?: number; lng?: number }): LatLng | null`; `ChefMapQuery` type.

- [ ] **Step 1: Let the test factory give chefs an area**

In `backend/tests/factories.ts`, add to `ChefOptions`:

```ts
  /** Public area center; leave out for a chef who is not on the map. */
  area?: { latitude: number; longitude: number };
```

and in the `prisma.chefProfile.create` data, after `longitude: -117.1825,`:

```ts
      approxLatitude: options.area?.latitude ?? null,
      approxLongitude: options.area?.longitude ?? null,
```

- [ ] **Step 2: Write the failing test**

```ts
// backend/tests/location.test.ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { distanceMiles, roundToTenth } from '../src/services/geo.js';
import { zipCentroid } from '../src/services/zipCodes.js';
import { createChef, createMeal } from './factories.js';

const app = createApp();
const API = '/api/v1';

// Public area centers for test kitchens. ZIP 92373 is south Redlands.
const REDLANDS = { latitude: 34.0571, longitude: -117.1812 };
const RIVERSIDE = { latitude: 33.9806, longitude: -117.3755 };
const PALM_SPRINGS = { latitude: 33.8303, longitude: -116.5453 };

async function kitchenAt(kitchenName: string, area?: { latitude: number; longitude: number }, cuisine = 'Mexican') {
  const owner = await createChef({ kitchenName, area, specialties: [cuisine] });
  await createMeal(owner, { cuisineType: cuisine });
  return owner.chef;
}

const names = (chefs: { kitchenName: string }[]) => chefs.map((chef) => chef.kitchenName);
const milesFrom92373 = (area: { latitude: number; longitude: number }) =>
  roundToTenth(distanceMiles(zipCentroid('92373')!, area));

describe('GET /chefs near a place', () => {
  it('lists chefs nearest first, with how far away each one is', async () => {
    await kitchenAt('Palm Springs Kitchen', PALM_SPRINGS);
    await kitchenAt('Riverside Kitchen', RIVERSIDE);
    await kitchenAt('Redlands Kitchen', REDLANDS);

    const res = await request(app).get(`${API}/chefs`).query({ near: '92373' });

    expect(res.status).toBe(200);
    expect(names(res.body.data)).toEqual(['Redlands Kitchen', 'Riverside Kitchen', 'Palm Springs Kitchen']);
    expect(res.body.data.map((chef: { distanceMiles: number }) => chef.distanceMiles)).toEqual([
      milesFrom92373(REDLANDS),
      milesFrom92373(RIVERSIDE),
      milesFrom92373(PALM_SPRINGS),
    ]);
    expect(res.body.pagination.total).toBe(3);
  });

  it('keeps to the distance limit', async () => {
    await kitchenAt('Palm Springs Kitchen', PALM_SPRINGS);
    await kitchenAt('Riverside Kitchen', RIVERSIDE);
    await kitchenAt('Redlands Kitchen', REDLANDS);

    const res = await request(app).get(`${API}/chefs`).query({ near: '92373', maxDistance: 25 });

    expect(names(res.body.data)).toEqual(['Redlands Kitchen', 'Riverside Kitchen']);
    expect(res.body.pagination.total).toBe(2);
  });

  it('searches from a browser location', async () => {
    await kitchenAt('Redlands Kitchen', REDLANDS);
    await kitchenAt('Palm Springs Kitchen', PALM_SPRINGS);

    const res = await request(app).get(`${API}/chefs`).query({ lat: 33.83, lng: -116.55 });

    expect(names(res.body.data)).toEqual(['Palm Springs Kitchen', 'Redlands Kitchen']);
  });

  it('pages through nearby chefs in distance order', async () => {
    await kitchenAt('Palm Springs Kitchen', PALM_SPRINGS);
    await kitchenAt('Riverside Kitchen', RIVERSIDE);
    await kitchenAt('Redlands Kitchen', REDLANDS);

    const res = await request(app).get(`${API}/chefs`).query({ near: '92373', limit: 1, page: 2 });

    expect(names(res.body.data)).toEqual(['Riverside Kitchen']);
    expect(res.body.pagination).toEqual({ page: 2, limit: 1, total: 3, totalPages: 3 });
  });

  it('combines distance with the other filters', async () => {
    await kitchenAt('Redlands Kitchen', REDLANDS, 'Mexican');
    await kitchenAt('Riverside Sushi', RIVERSIDE, 'Japanese');

    const res = await request(app).get(`${API}/chefs`).query({ near: '92373', cuisine: 'Japanese' });

    expect(names(res.body.data)).toEqual(['Riverside Sushi']);
  });

  it('leaves out chefs without a map area, but still lists them in a normal search', async () => {
    await kitchenAt('Redlands Kitchen', REDLANDS);
    await kitchenAt('Unmapped Kitchen');

    const near = await request(app).get(`${API}/chefs`).query({ near: '92373' });
    const all = await request(app).get(`${API}/chefs`);

    expect(names(near.body.data)).toEqual(['Redlands Kitchen']);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.data.every((chef: { distanceMiles: number | null }) => chef.distanceMiles === null)).toBe(true);
  });

  it('ignores a distance limit when no place is given', async () => {
    await kitchenAt('Palm Springs Kitchen', PALM_SPRINGS);

    const res = await request(app).get(`${API}/chefs`).query({ maxDistance: 5 });

    expect(names(res.body.data)).toEqual(['Palm Springs Kitchen']);
  });

  it('explains an unknown ZIP code', async () => {
    const res = await request(app).get(`${API}/chefs`).query({ near: '00000' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNKNOWN_ZIP');
    expect(res.body.error.message).toBe('We could not find ZIP code 00000');
  });

  it('needs both lat and lng, and not a ZIP code as well', async () => {
    const halfLocation = await request(app).get(`${API}/chefs`).query({ lat: 34.05 });
    const both = await request(app).get(`${API}/chefs`).query({ near: '92373', lat: 34.05, lng: -117.18 });

    expect(halfLocation.status).toBe(422);
    expect(halfLocation.body.error.details).toHaveProperty('lng');
    expect(both.status).toBe(422);
    expect(both.body.error.details).toHaveProperty('near');
  });
});

describe('GET /chefs/map', () => {
  it('returns the area of every matching chef, nearest first, and where the search starts', async () => {
    const redlands = await kitchenAt('Redlands Kitchen', REDLANDS);
    await kitchenAt('Riverside Kitchen', RIVERSIDE);

    const res = await request(app).get(`${API}/chefs/map`).query({ near: '92373', page: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.origin).toEqual(zipCentroid('92373'));
    expect(names(res.body.data.chefs)).toEqual(['Redlands Kitchen', 'Riverside Kitchen']);
    expect(res.body.data.chefs[0]).toEqual({
      id: redlands.id,
      kitchenName: 'Redlands Kitchen',
      chefName: 'Maria D.',
      firstName: 'Maria',
      city: 'Redlands',
      averageRating: null,
      totalReviews: 0,
      isAcceptingOrders: true,
      distanceMiles: milesFrom92373(REDLANDS),
      area: { ...REDLANDS, radiusMiles: 0.5 },
    });
  });

  it('shows every chef that has an area when no place is given', async () => {
    await kitchenAt('Redlands Kitchen', REDLANDS);
    await kitchenAt('Unmapped Kitchen');

    const res = await request(app).get(`${API}/chefs/map`);

    expect(res.body.data.origin).toBeNull();
    expect(names(res.body.data.chefs)).toEqual(['Redlands Kitchen']);
    expect(res.body.data.chefs[0].distanceMiles).toBeNull();
  });

  it('keeps to the distance limit', async () => {
    await kitchenAt('Redlands Kitchen', REDLANDS);
    await kitchenAt('Palm Springs Kitchen', PALM_SPRINGS);

    const res = await request(app).get(`${API}/chefs/map`).query({ near: '92373', maxDistance: 25 });

    expect(names(res.body.data.chefs)).toEqual(['Redlands Kitchen']);
  });

  it('explains an unknown ZIP code', async () => {
    const res = await request(app).get(`${API}/chefs/map`).query({ near: '00000' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNKNOWN_ZIP');
  });
});

describe('The public area on a chef page', () => {
  it('shows the area but never the exact location', async () => {
    const chef = await kitchenAt('Redlands Kitchen', REDLANDS);

    const res = await request(app).get(`${API}/chefs/${chef.id}`);

    expect(res.body.data.chef.area).toEqual({ ...REDLANDS, radiusMiles: 0.5 });
    // The factory's exact location is 34.0556, -117.1825.
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('34.0556');
    expect(body).not.toContain('117.1825');
  });

  it('has no area for a chef who is not on the map', async () => {
    const chef = await kitchenAt('Unmapped Kitchen');

    const res = await request(app).get(`${API}/chefs/${chef.id}`);

    expect(res.body.data.chef.area).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/location.test.ts`
Expected: FAIL (no ordering by distance, `/chefs/map` answers 404 through `/chefs/:id`, `area` undefined).

- [ ] **Step 4: Accept the place in the query schemas**

In `backend/src/validators/catalogSchemas.ts`, add after the `pagination` constant:

```ts
// Searching by distance: from a ZIP code, or from the browser's location (lat + lng).
const placeFields = {
  near: z.string().trim().regex(/^\d{5}$/, 'Enter a 5-digit ZIP code').optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  maxDistance: z.coerce.number().min(1, 'Use at least 1 mile').max(100, 'Use 100 miles or less').optional(),
};

type PlaceQuery = { near?: string; lat?: number; lng?: number };

function checkPlace(value: PlaceQuery, ctx: z.core.$RefinementCtx<PlaceQuery>) {
  if ((value.lat === undefined) !== (value.lng === undefined)) {
    ctx.addIssue({ code: 'custom', path: [value.lat === undefined ? 'lat' : 'lng'], message: 'Send both lat and lng' });
  }
  if (value.near !== undefined && value.lat !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['near'], message: 'Search from a ZIP code or a location, not both' });
  }
}
```

Replace `chefListQuerySchema` with:

```ts
const chefFilters = {
  search: optionalText,
  city: optionalText,
  cuisine: optionalText,
};

export const chefListQuerySchema = z.object({ ...chefFilters, ...placeFields, ...pagination }).superRefine(checkPlace);

/** The map shows every matching chef, so it has no pages. */
export const chefMapQuerySchema = z.object({ ...chefFilters, ...placeFields }).superRefine(checkPlace);
```

and add next to the other type exports:

```ts
export type ChefMapQuery = z.infer<typeof chefMapQuerySchema>;
```

- [ ] **Step 5: Turn a query into a search point**

Append to `backend/src/services/locationService.ts` (add `import { AppError } from '../utils/errors.js';` to its imports):

```ts
/** The point a chef search starts from: the middle of a ZIP code, or the browser's location. */
export function resolveOrigin(query: { near?: string; lat?: number; lng?: number }): LatLng | null {
  if (query.near) {
    const center = zipCentroid(query.near);
    if (!center) {
      throw new AppError(422, 'UNKNOWN_ZIP', `We could not find ZIP code ${query.near}`, { near: 'Check the ZIP code' });
    }
    return center;
  }
  if (query.lat !== undefined && query.lng !== undefined) return { latitude: query.lat, longitude: query.lng };
  return null;
}
```

- [ ] **Step 6: Rank chefs by distance in `chefService.ts`**

Change the imports: `ChefListQuery` import becomes `import { ChefListQuery, ChefMapQuery } from '../validators/catalogSchemas.js';`, and add:

```ts
import { distanceMiles, LatLng, roundToTenth } from './geo.js';
import { areaCenter, resolveOrigin, toArea } from './locationService.js';
```

Replace `toChefCard` with this version, which takes the distance:

```ts
function toChefCard(chef: ChefCardRow, distance: number | null = null) {
  return {
    id: chef.id,
    kitchenName: chef.kitchenName,
    chefName: chefDisplayName(chef.user),
    firstName: chef.user.firstName,
    profilePhotoUrl: chef.user.profilePhotoUrl,
    bio: chef.bio,
    city: chef.city,
    state: chef.state,
    specialties: chef.specialties,
    yearsExperience: chef.yearsExperience,
    averageRating: chef.averageRating?.toNumber() ?? null,
    totalReviews: chef.totalReviews,
    isAcceptingOrders: chef.isAcceptingOrders,
    mealCount: chef._count.meals,
    coverImageUrl: chef.meals[0]?.imageUrl ?? null,
    distanceMiles: distance === null ? null : roundToTenth(distance),
  };
}
```

Replace `listChefs` (from its doc comment to its closing brace) with:

```ts
type ChefFilters = Pick<ChefListQuery, 'search' | 'city' | 'cuisine'>;

/** Chefs a search can show: visible, with something to order, matching the text, city and cuisine filters. */
function chefListWhere({ search, city, cuisine }: ChefFilters): Prisma.ChefProfileWhereInput {
  const filters: Prisma.ChefProfileWhereInput[] = [visibleChefWhere, { meals: { some: orderableMealOwnWhere } }];
  if (search) filters.push(chefSearchWhere(search));
  if (city) filters.push({ city: { equals: city, mode: 'insensitive' } });
  if (cuisine) {
    filters.push({
      OR: [
        { specialties: { hasSome: [cuisine, titleCase(cuisine)] } },
        { meals: { some: { ...orderableMealOwnWhere, cuisineType: { equals: cuisine, mode: 'insensitive' } } } },
      ],
    });
  }
  return { AND: filters };
}

const hasArea = { approxLatitude: { not: null }, approxLongitude: { not: null } } satisfies Prisma.ChefProfileWhereInput;

interface RankedChef {
  id: string;
  distance: number;
}

/**
 * Chefs with a map area, nearest to `origin` first (ties in id order), within `maxDistance` miles when given.
 * Distances are measured to each chef's public area center, never to their real location.
 */
async function rankByDistance(where: Prisma.ChefProfileWhereInput, origin: LatLng, maxDistance?: number) {
  const rows = await prisma.chefProfile.findMany({
    where: { AND: [where, hasArea] },
    select: { id: true, approxLatitude: true, approxLongitude: true },
  });
  return rows
    .map((row): RankedChef => ({ id: row.id, distance: distanceMiles(origin, areaCenter(row)!) }))
    .filter((row) => maxDistance === undefined || row.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}

/** Rows in ranking order. A chef hidden between the two queries is skipped. */
function inRankedOrder<T extends { id: string }>(ranked: RankedChef[], rows: T[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ranked.flatMap(({ id, distance }) => {
    const row = byId.get(id);
    return row ? [{ row, distance }] : [];
  });
}

export async function listChefs(query: ChefListQuery) {
  const { page, limit } = query;
  const where = chefListWhere(query);
  const origin = resolveOrigin(query);

  if (!origin) {
    const [total, chefs] = await prisma.$transaction([
      prisma.chefProfile.count({ where }),
      prisma.chefProfile.findMany({
        where,
        include: chefCardInclude,
        orderBy: recommendedOrder,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    // An arrow function, so map's index is never taken for a distance.
    return { chefs: chefs.map((chef) => toChefCard(chef)), pagination: paginationMeta(page, limit, total) };
  }

  const ranked = await rankByDistance(where, origin, query.maxDistance);
  const onThisPage = ranked.slice((page - 1) * limit, page * limit);
  const cards = await prisma.chefProfile.findMany({
    where: { id: { in: onThisPage.map((chef) => chef.id) } },
    include: chefCardInclude,
  });
  return {
    chefs: inRankedOrder(onThisPage, cards).map(({ row, distance }) => toChefCard(row, distance)),
    pagination: paginationMeta(page, limit, ranked.length),
  };
}

const MAP_LIMIT = 500;

const mapPinSelect = {
  id: true,
  kitchenName: true,
  city: true,
  averageRating: true,
  totalReviews: true,
  isAcceptingOrders: true,
  approxLatitude: true,
  approxLongitude: true,
  user: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ChefProfileSelect;

type MapPinRow = Prisma.ChefProfileGetPayload<{ select: typeof mapPinSelect }>;

function toMapPin(chef: MapPinRow, distance: number | null) {
  return {
    id: chef.id,
    kitchenName: chef.kitchenName,
    chefName: chefDisplayName(chef.user),
    firstName: chef.user.firstName,
    city: chef.city,
    averageRating: chef.averageRating?.toNumber() ?? null,
    totalReviews: chef.totalReviews,
    isAcceptingOrders: chef.isAcceptingOrders,
    distanceMiles: distance === null ? null : roundToTenth(distance),
    area: toArea(chef),
  };
}

/** Every matching chef's public area for the map, nearest first when searching from a place. */
export async function listChefsForMap(query: ChefMapQuery) {
  const where = chefListWhere(query);
  const origin = resolveOrigin(query);

  if (!origin) {
    const chefs = await prisma.chefProfile.findMany({
      where: { AND: [where, hasArea] },
      select: mapPinSelect,
      orderBy: recommendedOrder,
      take: MAP_LIMIT,
    });
    return { origin: null, chefs: chefs.map((chef) => toMapPin(chef, null)) };
  }

  const ranked = (await rankByDistance(where, origin, query.maxDistance)).slice(0, MAP_LIMIT);
  const rows = await prisma.chefProfile.findMany({ where: { id: { in: ranked.map((chef) => chef.id) } }, select: mapPinSelect });
  return { origin, chefs: inRankedOrder(ranked, rows).map(({ row, distance }) => toMapPin(row, distance)) };
}
```

In `getChefProfile`, add after `serviceRadiusMiles: chef.serviceRadiusMiles.toNumber(),`:

```ts
    area: toArea(chef),
```

- [ ] **Step 7: Controller and route**

In `backend/src/controllers/catalogController.ts`, import `chefMapQuerySchema` with the other schemas and add:

```ts
export async function listChefsForMap(req: Request, res: Response) {
  const map = await chefService.listChefsForMap(parseInput(chefMapQuerySchema, req.query));
  res.status(200).json({ success: true, data: map });
}
```

In `backend/src/routes/catalogRoutes.ts`, directly after `chefRoutes.get('/', catalogController.listChefs);`:

```ts
chefRoutes.get('/map', catalogController.listChefsForMap); // before /:id, so "map" is not read as a chef id
```

- [ ] **Step 8: Run the new tests and the existing catalog tests**

Run: `cd backend && npx vitest run tests/location.test.ts tests/chefs.test.ts tests/meals.test.ts`
Expected: PASS (all).

- [ ] **Step 9: Commit**

```bash
git add backend/src/validators/catalogSchemas.ts backend/src/services/locationService.ts backend/src/services/chefService.ts backend/src/controllers/catalogController.ts backend/src/routes/catalogRoutes.ts backend/tests/factories.ts backend/tests/location.test.ts
git commit -m "feat(api): find chefs near a ZIP code or location, and a map of their areas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Refuse deliveries beyond the chef's distance

**Files:**
- Modify: `backend/src/services/orderService.ts`
- Test: `backend/tests/deliveryDistance.test.ts`

**Interfaces:**
- Consumes: `distanceMiles`, `roundToTenth` (Task 1); `geocodeAddress` (Task 3); `areaCenter` (Task 4); `Order.deliveryDistanceMiles` (Task 4).
- Produces: 409 `OUTSIDE_DELIVERY_AREA` with `details.deliveryAddress`; `deliveryDistanceMiles: number | null` in the chef's order view only.

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/deliveryDistance.test.ts
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { MILES_PER_DEGREE_LATITUDE } from '../src/services/geo.js';
import { geocodeAddress } from '../src/services/geocoding.js';
import { API, bearer, type Kitchen, openKitchen, pickupOrder, placeOrder, signUp } from './helpers.js';

vi.mock('../src/services/geocoding.js', () => ({ geocodeAddress: vi.fn() }));
const geocode = vi.mocked(geocodeAddress);

const app = createApp();
const ADDRESS = '1 Orange St, Redlands, CA 92373';

beforeEach(() => {
  geocode.mockReset();
  geocode.mockResolvedValue(null);
});

/** A spot `miles` due north of the kitchen's public area center. */
async function northOfKitchen(kitchen: Kitchen, miles: number) {
  const chef = await prisma.chefProfile.findUniqueOrThrow({ where: { id: kitchen.chefId } });
  return {
    latitude: chef.approxLatitude!.toNumber() + miles / MILES_PER_DEGREE_LATITUDE,
    longitude: chef.approxLongitude!.toNumber(),
  };
}

function deliveryOrder(kitchen: Kitchen) {
  return { ...pickupOrder(kitchen), pickupOrDelivery: 'DELIVERY', deliveryAddress: ADDRESS, contactPhone: '(909) 555-0142' };
}

async function chefOrders(kitchen: Kitchen) {
  const res = await request(app).get(`${API}/chefs/me/orders`).set(bearer(kitchen.accessToken));
  return res.body.data;
}

// Test kitchens deliver up to 10 miles (helpers.kitchenInput) and sit near the middle of ZIP 92373.
describe('Delivery distance', () => {
  it('refuses a delivery address beyond how far the chef delivers', async () => {
    const kitchen = await openKitchen({ offersDelivery: true });
    const customer = await signUp(app);
    geocode.mockResolvedValueOnce(await northOfKitchen(kitchen, 12.4));

    const res = await placeOrder(customer.accessToken, deliveryOrder(kitchen));

    const message =
      "Sam's Kitchen delivers up to 10 miles from their kitchen. This address is about 12.4 miles away. Please choose pickup or another address.";
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: 'OUTSIDE_DELIVERY_AREA', message, details: { deliveryAddress: message } });
    expect(geocode).toHaveBeenLastCalledWith(ADDRESS);
    expect(await prisma.order.count()).toBe(0);
  });

  it('accepts an address right at the limit and tells only the chef how far it is', async () => {
    const kitchen = await openKitchen({ offersDelivery: true });
    const customer = await signUp(app);
    geocode.mockResolvedValueOnce(await northOfKitchen(kitchen, 10));

    const res = await placeOrder(customer.accessToken, deliveryOrder(kitchen));

    expect(res.status).toBe(201);
    expect(res.body.data.order).not.toHaveProperty('deliveryDistanceMiles');
    expect((await chefOrders(kitchen))[0].deliveryDistanceMiles).toBe(10);
  });

  it('refuses an address just past the limit', async () => {
    const kitchen = await openKitchen({ offersDelivery: true });
    const customer = await signUp(app);
    geocode.mockResolvedValueOnce(await northOfKitchen(kitchen, 10.2));

    const res = await placeOrder(customer.accessToken, deliveryOrder(kitchen));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OUTSIDE_DELIVERY_AREA');
  });

  it('lets the order through when the address cannot be found', async () => {
    const kitchen = await openKitchen({ offersDelivery: true });
    const customer = await signUp(app);

    const res = await placeOrder(customer.accessToken, deliveryOrder(kitchen));

    expect(res.status).toBe(201);
    expect((await chefOrders(kitchen))[0].deliveryDistanceMiles).toBeNull();
  });

  it('does not look up addresses for pickup orders', async () => {
    const kitchen = await openKitchen({ offersDelivery: true });
    const customer = await signUp(app);
    geocode.mockClear();

    const res = await placeOrder(customer.accessToken, pickupOrder(kitchen));

    expect(res.status).toBe(201);
    expect(geocode).not.toHaveBeenCalled();
    expect((await chefOrders(kitchen))[0].deliveryDistanceMiles).toBeNull();
  });

  it('skips the check for a kitchen that is not on the map', async () => {
    const kitchen = await openKitchen({ offersDelivery: true });
    await prisma.chefProfile.update({ where: { id: kitchen.chefId }, data: { approxLatitude: null, approxLongitude: null } });
    const customer = await signUp(app);
    geocode.mockClear();

    const res = await placeOrder(customer.accessToken, deliveryOrder(kitchen));

    expect(res.status).toBe(201);
    expect(geocode).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/deliveryDistance.test.ts`
Expected: FAIL: far orders are accepted (201) and `deliveryDistanceMiles` is undefined.

- [ ] **Step 3: Write the implementation**

In `backend/src/services/orderService.ts`, change `import { OrderStatus, Prisma } from '@prisma/client';` to `import { ChefProfile, OrderStatus, Prisma } from '@prisma/client';` and add:

```ts
import { distanceMiles, roundToTenth } from './geo.js';
import { geocodeAddress } from './geocoding.js';
import { areaCenter } from './locationService.js';
```

Add above `placeOrder`:

```ts
/**
 * Miles from the chef's public area to a delivery address, or null when either cannot be placed on
 * the map (the order then goes ahead, and the chef can decline it). Refuses addresses farther than
 * the chef delivers.
 */
async function deliveryDistance(chef: ChefProfile, address: string): Promise<number | null> {
  const kitchenArea = areaCenter(chef);
  if (!kitchenArea) return null;
  const destination = await geocodeAddress(address);
  if (!destination) return null;

  const miles = roundToTenth(distanceMiles(kitchenArea, destination));
  const limit = chef.serviceRadiusMiles.toNumber();
  if (miles > limit) {
    const message = `${chef.kitchenName ?? 'This chef'} delivers up to ${limit} miles from their kitchen. This address is about ${miles} miles away. Please choose pickup or another address.`;
    throw new AppError(409, 'OUTSIDE_DELIVERY_AREA', message, { deliveryAddress: message });
  }
  return miles;
}
```

In `placeOrder`, directly after the `INVALID_TIME` check (before `const order = await prisma.$transaction`):

```ts
  // Looked up before the transaction: never hold database locks while waiting on another service.
  const deliveryDistanceMiles = isDelivery ? await deliveryDistance(chef, input.deliveryAddress ?? '') : null;
```

In the `tx.order.create` data, after `deliveryAddress: isDelivery ? input.deliveryAddress : null,`:

```ts
        deliveryDistanceMiles,
```

In `chefView`, after `canCancel: OPEN_STATUSES.includes(order.status),`:

```ts
    deliveryDistanceMiles: order.deliveryDistanceMiles?.toNumber() ?? null,
```

- [ ] **Step 4: Run the new test and the existing order tests**

Run: `cd backend && npx vitest run tests/deliveryDistance.test.ts tests/orders.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Run the whole backend suite**

Run: `cd backend && npx vitest run && npx tsc --noEmit -p .`
Expected: all test files pass; no type errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/orderService.ts backend/tests/deliveryDistance.test.ts
git commit -m "feat(api): refuse deliveries beyond the chef's delivery distance" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Frontend types, map data call and location helpers

**Files:**
- Modify: `frontend/package.json` (+ lock file) via npm
- Modify: `frontend/src/types/catalog.types.ts`, `frontend/src/types/kitchen.types.ts`, `frontend/src/types/order.types.ts`
- Modify: `frontend/src/services/catalogService.ts`
- Modify: `frontend/src/utils/searchParams.ts`, `frontend/src/utils/searchParams.test.ts`
- Modify: `frontend/src/components/order/KitchenOrderCard.test.tsx` (fixture field)
- Create: `frontend/src/utils/location.ts`
- Test: `frontend/src/utils/location.test.ts`

**Interfaces:**
- Consumes: API shapes from Tasks 4, 6 and 7.
- Produces: types `ChefArea`, `MapPoint`, `ChefMapPin`, `ChefMapData`; `ChefCardData.distanceMiles: number | null`; `ChefDetail.area: ChefArea | null`; `OwnKitchen.area: ChefArea | null`; `KitchenOrder.deliveryDistanceMiles: number | null`; `fetchChefMap(params: URLSearchParams): Promise<ChefMapData>`; `withoutParams(current, ...names)`; from `utils/location`: `SearchPlace`, `DISTANCE_OPTIONS`, `DEFAULT_MAX_DISTANCE`, `MILES_TO_METERS`, `normalizeZip`, `roundCoordinate`, `readSearchPlace`, `searchPlaceParams`, `describePlace`, `formatDistance`, `boundsAround`, `rememberZip`, `recallZip`.

- [ ] **Step 1: Install the map packages**

```bash
cd frontend && npm install leaflet@^1.9.4 react-leaflet@^5.0.0 && npm install --save-dev @types/leaflet@^1.9.20
```
Expected: installs without install-script prompts (none of these packages have install scripts). If npm reports a blocked script, stop and check what it is.

- [ ] **Step 2: Add the types**

In `frontend/src/types/catalog.types.ts`, add before `ChefCardData`:

```ts
/** Where a chef cooks, shown as a circle. Never the exact address. */
export interface ChefArea {
  latitude: number
  longitude: number
  radiusMiles: number
}

export interface MapPoint {
  latitude: number
  longitude: number
}
```

Add to `ChefCardData` (last field):

```ts
  /** Miles from the searched place, when searching near a place. */
  distanceMiles: number | null
```

Add to `ChefDetail` (after `serviceRadiusMiles`):

```ts
  area: ChefArea | null
```

Add at the end of the file:

```ts
export interface ChefMapPin {
  id: string
  kitchenName: string | null
  chefName: string
  firstName: string
  city: string
  averageRating: number | null
  totalReviews: number
  isAcceptingOrders: boolean
  distanceMiles: number | null
  area: ChefArea
}

export interface ChefMapData {
  /** Where the search starts: a ZIP code's middle or the browser's location. */
  origin: MapPoint | null
  chefs: ChefMapPin[]
}
```

In `frontend/src/types/kitchen.types.ts`, change the first import to `import type { ChefArea, MealCardData, MealCategory } from './catalog.types'` and add to `OwnKitchen` after `zipCode: string`:

```ts
  /** The approximate area neighbors see, or null if the address could not be placed on the map. */
  area: ChefArea | null
```

In `frontend/src/types/order.types.ts`, add to `KitchenOrder`:

```ts
  /** Straight-line miles to a delivery address, when it could be placed on the map. */
  deliveryDistanceMiles: number | null
```

In `frontend/src/components/order/KitchenOrderCard.test.tsx`, add to the object returned by `kitchenOrder()` after `canCancel: true,`:

```ts
    deliveryDistanceMiles: null,
```

- [ ] **Step 3: Add the map data call**

In `frontend/src/services/catalogService.ts`, add `ChefMapData` to the type import and add:

```ts
export async function fetchChefMap(params: URLSearchParams): Promise<ChefMapData> {
  const { data } = await api.get<ApiSuccess<ChefMapData>>('/chefs/map', { params })
  return data.data
}
```

- [ ] **Step 4: Write the failing tests**

Append to `frontend/src/utils/searchParams.test.ts` (and add `withoutParams` to its import from `./searchParams`):

```ts
describe('withoutParams', () => {
  it('copies the parameters without the named ones', () => {
    const current = new URLSearchParams('near=92373&view=map&page=2')

    expect(withoutParams(current, 'view', 'page').toString()).toBe('near=92373')
    expect(current.toString()).toBe('near=92373&view=map&page=2')
  })
})
```

Create `frontend/src/utils/location.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  boundsAround,
  describePlace,
  formatDistance,
  normalizeZip,
  readSearchPlace,
  recallZip,
  rememberZip,
  roundCoordinate,
  searchPlaceParams,
} from './location'

describe('normalizeZip', () => {
  it('accepts 5-digit ZIP codes, ZIP+4 codes and extra spaces', () => {
    expect(normalizeZip('92373')).toBe('92373')
    expect(normalizeZip(' 92373-1234 ')).toBe('92373')
  })

  it('rejects anything else', () => {
    expect(normalizeZip('9237')).toBeNull()
    expect(normalizeZip('923735')).toBeNull()
    expect(normalizeZip('abcde')).toBeNull()
    expect(normalizeZip('')).toBeNull()
  })
})

describe('roundCoordinate', () => {
  it('keeps 2 decimals, about half a mile', () => {
    expect(roundCoordinate(34.055216)).toBe(34.06)
    expect(roundCoordinate(-117.182488)).toBe(-117.18)
  })
})

describe('readSearchPlace', () => {
  it('reads a ZIP code', () => {
    expect(readSearchPlace(new URLSearchParams('near=92373'))).toEqual({ kind: 'zip', zip: '92373' })
  })

  it('reads a browser location', () => {
    expect(readSearchPlace(new URLSearchParams('lat=34.05&lng=-117.18'))).toEqual({
      kind: 'here',
      latitude: 34.05,
      longitude: -117.18,
    })
  })

  it('ignores missing or broken values', () => {
    expect(readSearchPlace(new URLSearchParams(''))).toBeNull()
    expect(readSearchPlace(new URLSearchParams('near=abc'))).toBeNull()
    expect(readSearchPlace(new URLSearchParams('lat=34.05'))).toBeNull()
    expect(readSearchPlace(new URLSearchParams('lat=&lng='))).toBeNull()
    expect(readSearchPlace(new URLSearchParams('lat=north&lng=-117.18'))).toBeNull()
  })
})

describe('searchPlaceParams', () => {
  it('writes a ZIP code and clears a browser location', () => {
    expect(searchPlaceParams({ kind: 'zip', zip: '92373' })).toEqual({ near: '92373', lat: null, lng: null })
  })

  it('writes a browser location and clears the ZIP code', () => {
    expect(searchPlaceParams({ kind: 'here', latitude: 34.05, longitude: -117.18 })).toEqual({
      near: null,
      lat: '34.05',
      lng: '-117.18',
    })
  })

  it('clears the place together with its distance limit', () => {
    expect(searchPlaceParams(null)).toEqual({ near: null, lat: null, lng: null, maxDistance: null })
  })
})

describe('describePlace', () => {
  it('names the place in words', () => {
    expect(describePlace({ kind: 'zip', zip: '92373' })).toBe('near 92373')
    expect(describePlace({ kind: 'here', latitude: 34.05, longitude: -117.18 })).toBe('near you')
  })
})

describe('formatDistance', () => {
  it('says how far away a chef is', () => {
    expect(formatDistance(0.4)).toBe('less than a mile away')
    expect(formatDistance(1)).toBe('1 mile away')
    expect(formatDistance(2.14)).toBe('2.1 miles away')
    expect(formatDistance(12)).toBe('12 miles away')
  })
})

describe('boundsAround', () => {
  it('has nothing to fit without points', () => {
    expect(boundsAround([])).toBeNull()
  })

  it('fits every point, including the circles drawn around them', () => {
    const [[south, west], [north, east]] = boundsAround([
      { latitude: 34, longitude: -117.2, radiusMiles: 0.5 },
      { latitude: 33.8, longitude: -116.5 },
    ])!

    expect(south).toBe(33.8)
    expect(east).toBe(-116.5)
    expect(north).toBeCloseTo(34 + 0.5 / 69.09, 6)
    expect(west).toBeLessThan(-117.2)
  })
})

describe('rememberZip and recallZip', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps the last ZIP code in browser storage', () => {
    const saved = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
    })

    rememberZip('92373')

    expect(recallZip()).toBe('92373')
  })

  it('carries on when browser storage is blocked', () => {
    const blocked = () => {
      throw new Error('storage is blocked')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })

    expect(() => rememberZip('92373')).not.toThrow()
    expect(recallZip()).toBe('')
  })
})
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/utils/location.test.ts src/utils/searchParams.test.ts`
Expected: FAIL: `./location` cannot be found and `withoutParams` is not exported.

- [ ] **Step 6: Write the implementations**

Append to `frontend/src/utils/searchParams.ts`:

```ts
/** A copy of `current` without the named parameters. */
export function withoutParams(current: URLSearchParams, ...names: string[]): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const name of names) next.delete(name)
  return next
}
```

Create `frontend/src/utils/location.ts`:

```ts
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
```

- [ ] **Step 7: Run the tests to verify they pass, then type-check**

Run: `cd frontend && npx vitest run src/utils/location.test.ts src/utils/searchParams.test.ts && npx tsc -b`
Expected: PASS; `tsc -b` reports no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/types frontend/src/services/catalogService.ts frontend/src/utils/searchParams.ts frontend/src/utils/searchParams.test.ts frontend/src/utils/location.ts frontend/src/utils/location.test.ts frontend/src/components/order/KitchenOrderCard.test.tsx
git commit -m "feat(web): location helpers, map types and the map data call" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The "Find chefs near you" form

**Files:**
- Create: `frontend/src/components/location/NearMeForm.tsx`
- Create: `frontend/src/components/location/Location.css`
- Test: `frontend/src/components/location/NearMeForm.test.tsx`

**Interfaces:**
- Consumes: `normalizeZip`, `roundCoordinate`, `rememberZip`, `recallZip`, `SearchPlace` (Task 8).
- Produces: `<NearMeForm onChoose={(place: SearchPlace) => void} variant?: 'default' | 'hero' initialZip?: string />`. Buttons are named "Find chefs" and "Use my location"; the input's label is "ZIP code".

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/location/NearMeForm.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NearMeForm from './NearMeForm'

const getCurrentPosition = vi.fn()

beforeEach(() => {
  getCurrentPosition.mockReset()
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
})

afterEach(cleanup)

function renderForm() {
  const onChoose = vi.fn()
  render(<NearMeForm onChoose={onChoose} initialZip="" />)
  return onChoose
}

describe('NearMeForm', () => {
  it('searches from a ZIP code, accepting ZIP+4', () => {
    const onChoose = renderForm()

    fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '92373-1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find chefs' }))

    expect(onChoose).toHaveBeenCalledWith({ kind: 'zip', zip: '92373' })
  })

  it('asks for a 5-digit ZIP code', () => {
    const onChoose = renderForm()

    fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '923' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find chefs' }))

    expect(screen.getByRole('alert').textContent).toBe('Enter a 5-digit ZIP code')
    expect(onChoose).not.toHaveBeenCalled()
  })

  it("uses the browser's location, rounded to about half a mile", () => {
    getCurrentPosition.mockImplementation((found: PositionCallback) =>
      found({ coords: { latitude: 34.055216, longitude: -117.182488 } } as GeolocationPosition),
    )
    const onChoose = renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))

    expect(onChoose).toHaveBeenCalledWith({ kind: 'here', latitude: 34.06, longitude: -117.18 })
  })

  it('asks for a ZIP code when the location is not available', () => {
    getCurrentPosition.mockImplementation((_found: PositionCallback, failed: PositionErrorCallback) =>
      failed({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError),
    )
    const onChoose = renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))

    expect(screen.getByRole('alert').textContent).toBe('We could not get your location. Type your ZIP code instead.')
    expect(onChoose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/location/NearMeForm.test.tsx`
Expected: FAIL, cannot find `./NearMeForm`.

- [ ] **Step 3: Write the component and its styles**

```tsx
// frontend/src/components/location/NearMeForm.tsx
import { useId, useState, type FormEvent } from 'react'
import { normalizeZip, recallZip, rememberZip, roundCoordinate, type SearchPlace } from '../../utils/location'
import './Location.css'

interface NearMeFormProps {
  /** Called with a ZIP code, or the browser's location rounded to about half a mile. */
  onChoose: (place: SearchPlace) => void
  variant?: 'default' | 'hero'
  /** Starts the box with this ZIP code; otherwise the last one typed on this device. */
  initialZip?: string
}

const LOCATION_TIMEOUT_MS = 10_000

export default function NearMeForm({ onChoose, variant = 'default', initialZip }: NearMeFormProps) {
  const id = useId()
  const [zip, setZip] = useState(() => initialZip ?? recallZip())
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const normalized = normalizeZip(zip)
    if (!normalized) {
      setError('Enter a 5-digit ZIP code')
      return
    }
    setError(null)
    rememberZip(normalized)
    onChoose({ kind: 'zip', zip: normalized })
  }

  const locate = () => {
    setError(null)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        onChoose({
          kind: 'here',
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
        })
      },
      () => {
        setLocating(false)
        setError('We could not get your location. Type your ZIP code instead.')
      },
      { timeout: LOCATION_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 },
    )
  }

  return (
    <form className={`near-me near-me--${variant}`} onSubmit={submit} noValidate>
      <p className="near-me-title" id={`${id}-title`}>Find chefs near you</p>
      <div className="near-me-row" role="group" aria-labelledby={`${id}-title`}>
        <label className="visually-hidden" htmlFor={`${id}-zip`}>ZIP code</label>
        <input
          id={`${id}-zip`}
          type="text"
          className="field-input near-me-input"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={10}
          placeholder="ZIP code"
          value={zip}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => setZip(event.target.value)}
        />
        <button type="submit" className={`btn ${variant === 'hero' ? 'btn-light' : 'btn-primary'}`}>
          Find chefs
        </button>
        {canLocate && (
          <button
            type="button"
            className={`btn ${variant === 'hero' ? 'btn-outline-light' : 'btn-outline'}`}
            onClick={locate}
            disabled={locating}
          >
            {locating ? 'Finding you...' : 'Use my location'}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="field-error near-me-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
```

```css
/* frontend/src/components/location/Location.css */
.near-me {
  display: grid;
  gap: 0.5rem;
}

.near-me-title {
  font-weight: 600;
  color: var(--color-text);
}

.near-me-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.near-me-input {
  flex: 0 1 9rem;
  min-width: 7rem;
}

.near-me--hero {
  justify-items: center;
  margin-top: 1.25rem;
}

.near-me--hero .near-me-title {
  color: #fff;
}

.near-me--hero .near-me-row {
  justify-content: center;
}

.near-me--hero .near-me-error {
  color: #fff;
  background: rgba(197, 48, 48, 0.9);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-sm);
}

/* Maps. isolation keeps Leaflet's own layers from sliding over the page header. */
.map-frame {
  height: 260px;
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  isolation: isolate;
  background: var(--color-surface-muted);
}

.map-frame--large {
  height: min(65vh, 520px);
}

.map-note {
  margin-top: 0.5rem;
  color: var(--color-text-subtle);
  font-size: 0.875rem;
}

.leaflet-popup-content .map-popup-title {
  margin: 0 0 0.25rem;
  font-weight: 600;
}

.leaflet-popup-content .map-popup-meta {
  margin: 0;
  color: var(--color-text-muted);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/location/NearMeForm.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/location
git commit -m "feat(web): find chefs near a ZIP code or your location" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Map components

**Files:**
- Create: `frontend/src/components/location/mapConfig.ts`
- Create: `frontend/src/components/location/ChefsMap.tsx`
- Create: `frontend/src/components/location/AreaMap.tsx`

**Interfaces:**
- Consumes: `ChefMapData`, `ChefArea` (Task 8); `boundsAround`, `formatDistance`, `MILES_TO_METERS` (Task 8); `kitchenTitle` from `utils/format`; `Rating`.
- Produces: default exports `ChefsMap({ data }: { data: ChefMapData })` and `AreaMap({ area }: { area: ChefArea })`. Pages must import them with `React.lazy`.

These components only draw what the tested helpers compute (bounds, distance text); they are checked in the browser in Task 12.

- [ ] **Step 1: Shared map settings**

```ts
// frontend/src/components/location/mapConfig.ts
// OpenStreetMap tiles: free, no account. Their credit must stay visible on every map.
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export const AREA_STYLE = { color: '#5a67d8', weight: 2, fillColor: '#667eea', fillOpacity: 0.25 }
export const ORIGIN_STYLE = { color: '#ffffff', weight: 2, fillColor: '#c53030', fillOpacity: 1 }
```

- [ ] **Step 2: The chefs map**

```tsx
// frontend/src/components/location/ChefsMap.tsx
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
```

- [ ] **Step 3: The single-area map**

```tsx
// frontend/src/components/location/AreaMap.tsx
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
```

- [ ] **Step 4: Type-check and lint**

Run: `cd frontend && npx tsc -b && npx eslint src/components/location`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/location
git commit -m "feat(web): chef area maps with OpenStreetMap" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Chefs page, chef cards and the home page

**Files:**
- Modify (rewrite): `frontend/src/pages/ChefsPage.tsx`
- Modify: `frontend/src/pages/BrowsePages.css`
- Modify: `frontend/src/components/chef/ChefCard.tsx`, `frontend/src/components/chef/ChefCard.css`
- Create: `frontend/src/components/chef/ChefCard.test.tsx`
- Modify: `frontend/src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `NearMeForm` (Task 9); `ChefsMap` (Task 10, lazy); `fetchChefMap`, `withoutParams`, location helpers and types (Task 8).

- [ ] **Step 1: Write the failing ChefCard test**

```tsx
// frontend/src/components/chef/ChefCard.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChefCardData } from '../../types/catalog.types'
import ChefCard from './ChefCard'

const maria: ChefCardData = {
  id: 'chef-1',
  kitchenName: "Abuela's Table",
  chefName: 'Maria D.',
  firstName: 'Maria',
  profilePhotoUrl: null,
  bio: null,
  city: 'Redlands',
  state: 'CA',
  specialties: ['Mexican'],
  yearsExperience: 20,
  averageRating: 4.8,
  totalReviews: 4,
  isAcceptingOrders: true,
  mealCount: 4,
  coverImageUrl: null,
  distanceMiles: null,
}

afterEach(cleanup)

function renderCard(chef: ChefCardData) {
  render(
    <MemoryRouter>
      <ChefCard chef={chef} />
    </MemoryRouter>,
  )
}

describe('ChefCard', () => {
  it('shows how far away the chef is when searching near a place', () => {
    renderCard({ ...maria, distanceMiles: 2.1 })

    expect(screen.getByText('2.1 miles away')).toBeTruthy()
  })

  it('shows no distance otherwise', () => {
    renderCard(maria)

    expect(screen.queryByText(/away/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/components/chef/ChefCard.test.tsx`
Expected: FAIL: "2.1 miles away" is not found.

- [ ] **Step 3: Show the distance on chef cards**

In `frontend/src/components/chef/ChefCard.tsx`, import `formatDistance` from `'../../utils/location'` and add after the `chef-card-by` paragraph:

```tsx
        {typeof chef.distanceMiles === 'number' && (
          <p className="chef-card-distance">{formatDistance(chef.distanceMiles)}</p>
        )}
```

Append to `frontend/src/components/chef/ChefCard.css`:

```css
.chef-card-distance {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-brand-strong);
}
```

Run: `cd frontend && npx vitest run src/components/chef/ChefCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 4: Rewrite the Chefs page**

Replace `frontend/src/pages/ChefsPage.tsx` with:

```tsx
import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import ChefCard from '../components/chef/ChefCard'
import PageLoader from '../components/common/PageLoader'
import PaginationNav from '../components/common/PaginationNav'
import SearchForm from '../components/common/SearchForm'
import { EmptyState, ErrorState } from '../components/common/StatusStates'
import NearMeForm from '../components/location/NearMeForm'
import { useAsyncData } from '../hooks/useAsyncData'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchChefMap, fetchChefs, fetchMealFilters } from '../services/catalogService'
import {
  DEFAULT_MAX_DISTANCE,
  describePlace,
  DISTANCE_OPTIONS,
  readSearchPlace,
  searchPlaceParams,
  type SearchPlace,
} from '../utils/location'
import { withoutParams, withUpdatedParams } from '../utils/searchParams'
import './BrowsePages.css'

// Leaflet only loads when someone opens the map.
const ChefsMap = lazy(() => import('../components/location/ChefsMap'))

export default function ChefsPage() {
  usePageTitle('Browse chefs')
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useAsyncData('meal-filters', fetchMealFilters)

  const search = searchParams.get('search') ?? ''
  const city = searchParams.get('city') ?? ''
  const cuisine = searchParams.get('cuisine') ?? ''
  const maxDistance = searchParams.get('maxDistance') ?? ''
  const place = readSearchPlace(searchParams)
  const showMap = searchParams.get('view') === 'map'
  const hasFilters = [...searchParams.keys()].some((key) => key !== 'page' && key !== 'view')

  const update = (changes: Record<string, string | null>) => setSearchParams(withUpdatedParams(searchParams, changes))
  const clearFilters = () => setSearchParams(showMap ? new URLSearchParams({ view: 'map' }) : new URLSearchParams())
  const choosePlace = (next: SearchPlace) =>
    update({ ...searchPlaceParams(next), maxDistance: maxDistance || String(DEFAULT_MAX_DISTANCE) })
  const goToPage = (page: number) => {
    update({ page: String(page) })
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="container browse">
      <header className="browse-header">
        <h1>Local chefs</h1>
        <p>Meet the home cooks in your community and see what they are making this week.</p>
      </header>

      <section className="browse-filters" aria-label="Search and filters">
        <NearMeForm
          key={place?.kind === 'zip' ? place.zip : 'no-zip'}
          initialZip={place?.kind === 'zip' ? place.zip : undefined}
          onChoose={choosePlace}
        />
        {place && (
          <p className="near-me-current">
            Showing chefs {describePlace(place)}.{' '}
            <button type="button" className="text-button" onClick={() => update(searchPlaceParams(null))}>
              Clear location
            </button>
          </p>
        )}
        <SearchForm
          key={search}
          initialValue={search}
          label="Search chefs"
          placeholder="Search by cuisine, dish, kitchen or chef name"
          onSearch={(value) => update({ search: value })}
        />
        <div className="select-row">
          {place && (
            <label className="select-field">
              Distance
              <select value={maxDistance} onChange={(event) => update({ maxDistance: event.target.value })}>
                {DISTANCE_OPTIONS.map((miles) => (
                  <option key={miles} value={miles}>Within {miles} miles</option>
                ))}
                <option value="">Any distance</option>
              </select>
            </label>
          )}
          <label className="select-field">
            City
            <select value={city} onChange={(event) => update({ city: event.target.value })}>
              <option value="">All cities</option>
              {(filters.data?.cities ?? []).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="select-field">
            Cuisine
            <select value={cuisine} onChange={(event) => update({ cuisine: event.target.value })}>
              <option value="">All cuisines</option>
              {(filters.data?.cuisines ?? []).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="view-toggle" role="group" aria-label="Show chefs as">
        <button type="button" className="pill" aria-pressed={!showMap} onClick={() => update({ view: null })}>
          List
        </button>
        <button type="button" className="pill" aria-pressed={showMap} onClick={() => update({ view: 'map' })}>
          Map
        </button>
      </div>

      {showMap ? (
        <ChefMapView params={withoutParams(searchParams, 'view', 'page')} />
      ) : (
        <ChefListView
          params={withoutParams(searchParams, 'view')}
          place={place}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
          onPageChange={goToPage}
        />
      )}
    </div>
  )
}

interface ChefListViewProps {
  params: URLSearchParams
  place: SearchPlace | null
  hasFilters: boolean
  onClearFilters: () => void
  onPageChange: (page: number) => void
}

function ChefListView({ params, place, hasFilters, onClearFilters, onPageChange }: ChefListViewProps) {
  const chefs = useAsyncData(`chefs?${params.toString()}`, () => fetchChefs(params))

  if (!chefs.data && chefs.status === 'error') return <ErrorState message={chefs.error ?? ''} onRetry={chefs.retry} />
  if (!chefs.data) return <PageLoader label="Loading chefs" />

  const { total } = chefs.data.pagination
  return (
    <section
      aria-labelledby="chef-results-heading"
      aria-busy={chefs.status === 'loading'}
      className={chefs.status === 'loading' ? 'is-refreshing' : undefined}
    >
      <div className="results-bar">
        <h2 id="chef-results-heading" className="results-count">
          {total} {total === 1 ? 'chef' : 'chefs'}
          {place && ` ${describePlace(place)}`}
        </h2>
        {hasFilters && (
          <button type="button" className="text-button" onClick={onClearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {chefs.status === 'error' && (
        <div className="alert alert-error results-alert" role="alert">
          {chefs.error}
          <button type="button" className="text-button" onClick={chefs.retry}>Try again</button>
        </div>
      )}

      {chefs.data.items.length === 0 ? (
        <EmptyState
          title="No chefs match your search"
          text={place ? 'Try a larger distance, or clear the filters.' : 'Try another city or cuisine, or clear the filters.'}
        >
          {hasFilters && (
            <button type="button" className="btn btn-primary" onClick={onClearFilters}>
              Clear filters
            </button>
          )}
        </EmptyState>
      ) : (
        <div className="card-grid">
          {chefs.data.items.map((chef) => (
            <ChefCard key={chef.id} chef={chef} />
          ))}
        </div>
      )}

      <PaginationNav pagination={chefs.data.pagination} onPageChange={onPageChange} />
    </section>
  )
}

function ChefMapView({ params }: { params: URLSearchParams }) {
  const map = useAsyncData(`chef-map?${params.toString()}`, () => fetchChefMap(params))

  if (!map.data && map.status === 'error') return <ErrorState message={map.error ?? ''} onRetry={map.retry} />
  if (!map.data) return <PageLoader label="Loading map" />
  if (map.data.chefs.length === 0) {
    return <EmptyState title="No chefs on the map here" text="Try a larger distance, or clear the filters." />
  }
  return (
    <section aria-label="Map of chefs">
      <p className="results-count">
        {map.data.chefs.length} {map.data.chefs.length === 1 ? 'chef' : 'chefs'} on the map
      </p>
      <Suspense fallback={<PageLoader label="Loading map" />}>
        <ChefsMap data={map.data} />
      </Suspense>
    </section>
  )
}
```

Append to `frontend/src/pages/BrowsePages.css`:

```css
.near-me-current {
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.view-toggle {
  display: flex;
  gap: 0.5rem;
  margin: 1rem 0;
}
```

- [ ] **Step 5: Add the ZIP box to the home page**

In `frontend/src/pages/HomePage.tsx`, add imports:

```tsx
import NearMeForm from '../components/location/NearMeForm'
import { DEFAULT_MAX_DISTANCE, searchPlaceParams, type SearchPlace } from '../utils/location'
import { withUpdatedParams } from '../utils/searchParams'
```

Add inside `HomePage`, after `searchMeals`:

```tsx
  const findChefsNear = (place: SearchPlace) => {
    const params = withUpdatedParams(new URLSearchParams(), {
      ...searchPlaceParams(place),
      maxDistance: String(DEFAULT_MAX_DISTANCE),
    })
    navigate(`/chefs?${params}`)
  }
```

and right after the hero `<SearchForm ... />`:

```tsx
          <NearMeForm variant="hero" onChoose={findChefsNear} />
```

- [ ] **Step 6: Run the frontend checks**

Run: `cd frontend && npx vitest run && npx tsc -b && npx eslint .`
Expected: all tests pass; no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ChefsPage.tsx frontend/src/pages/BrowsePages.css frontend/src/components/chef/ChefCard.tsx frontend/src/components/chef/ChefCard.css frontend/src/components/chef/ChefCard.test.tsx frontend/src/pages/HomePage.tsx
git commit -m "feat(web): chefs near you, sorted by distance, with a map view" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Chef page map, chef dashboard, delivery distance on orders, docs and ship

**Files:**
- Modify: `frontend/src/pages/ChefProfilePage.tsx`, `frontend/src/pages/ChefProfilePage.css`
- Modify: `frontend/src/pages/chef/KitchenSettingsPage.tsx`
- Modify: `frontend/src/components/chef/KitchenProfileForm.tsx`
- Modify: `frontend/src/pages/chef/AvailabilityPage.tsx`
- Modify: `frontend/src/components/order/KitchenOrderCard.tsx`, `frontend/src/components/order/KitchenOrderCard.test.tsx`
- Modify: `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `AreaMap` (Task 10, lazy); `ChefDetail.area`, `OwnKitchen.area`, `KitchenOrder.deliveryDistanceMiles`, `formatDistance` (Task 8).

- [ ] **Step 1: Write the failing KitchenOrderCard test**

Add `import type { Handover } from '../../types/order.types'` to the existing type import in `frontend/src/components/order/KitchenOrderCard.test.tsx`, and add inside `describe('KitchenOrderCard', ...)`:

```tsx
  it('shows roughly how far away a delivery is', () => {
    const delivery = {
      ...kitchenOrder('CONFIRMED', 'PREPARING'),
      pickupOrDelivery: 'DELIVERY' as Handover,
      deliveryAddress: '1 Orange St, Redlands, CA 92373',
      deliveryDistanceMiles: 3.2,
    }

    render(<KitchenOrderCard order={delivery} onChanged={vi.fn()} />)

    expect(screen.getByText(/1 Orange St, Redlands, CA 92373/).textContent).toContain('(3.2 miles away)')
  })
```

Run: `cd frontend && npx vitest run src/components/order/KitchenOrderCard.test.tsx`
Expected: FAIL: the text has no distance.

- [ ] **Step 2: Show the distance to the chef**

In `frontend/src/components/order/KitchenOrderCard.tsx`, import `formatDistance` from `'../../utils/location'` and change the delivery paragraph to:

```tsx
      {order.pickupOrDelivery === 'DELIVERY' && (
        <p className="kitchen-order-detail">
          <strong>Deliver to:</strong> {order.deliveryAddress}
          {order.deliveryDistanceMiles !== null && <> ({formatDistance(order.deliveryDistanceMiles)})</>}
        </p>
      )}
```

Run: `cd frontend && npx vitest run src/components/order/KitchenOrderCard.test.tsx`
Expected: PASS.

- [ ] **Step 3: "Where Maria cooks" on the chef page**

In `frontend/src/pages/ChefProfilePage.tsx`:
- change the React import to `import { lazy, Suspense } from 'react'` (add it as the first import line);
- add `const AreaMap = lazy(() => import('../components/location/AreaMap'))` below the imports;
- replace the "Service area" fact

```tsx
            <div>
              <dt>Service area</dt>
              <dd>Within {profile.serviceRadiusMiles} miles of {profile.city}</dd>
            </div>
```

with

```tsx
            {profile.offersDelivery && (
              <div>
                <dt>Delivery</dt>
                <dd>Within {profile.serviceRadiusMiles} miles of their kitchen</dd>
              </div>
            )}
```

- add this section between the closing `</section>` of `chef-menus` and `<ReviewsSection`:

```tsx
      {profile.area && (
        <section className="card chef-area" aria-labelledby="area-heading">
          <h2 id="area-heading">Where {profile.firstName} cooks</h2>
          <Suspense fallback={<div className="map-frame" />}>
            <AreaMap area={profile.area} />
          </Suspense>
          <p className="map-note">
            Shown as an area about a mile across, not an exact address. The pickup address is shared after{' '}
            {profile.firstName} confirms your order.
            {profile.offersDelivery && ` ${profile.firstName} delivers up to ${profile.serviceRadiusMiles} miles.`}
          </p>
        </section>
      )}
```

Append to `frontend/src/pages/ChefProfilePage.css`:

```css
.chef-area {
  margin-top: 2rem;
}

.chef-area h2 {
  margin-bottom: 1rem;
}
```

- [ ] **Step 4: The chef's own location preview and form wording**

Replace `frontend/src/pages/chef/KitchenSettingsPage.tsx` with:

```tsx
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
```

Add to `frontend/src/pages/chef/ChefPages.css`:

```css
.kitchen-location {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.kitchen-location h3 {
  margin-bottom: 0.75rem;
}
```

In `frontend/src/components/chef/KitchenProfileForm.tsx`:
- change the address note text to: `Your street address stays private. Neighbors see an approximate area about a mile across, and pickup details are shared after an order is confirmed.`
- change the label `How far will you serve?` to `How far will you deliver?`
- directly after that `<select>...</select>`, add:

```tsx
          <p className="field-hint">Delivery orders from farther away are turned down automatically.</p>
```

In `frontend/src/pages/chef/AvailabilityPage.tsx`, import `Link` from `'react-router-dom'` and, inside the `{offersDelivery && (...)}` block, add at the end of the delivery-fee field (after its error line):

```tsx
            <p className="field-hint">
              Delivery distance is set on your <Link to="/chef/kitchen" className="text-link">Kitchen profile</Link>.
            </p>
```

- [ ] **Step 5: Run every check**

```bash
cd backend && npx vitest run && npx tsc --noEmit -p .
cd ../frontend && npx vitest run && npx eslint . && cd .. && npm run build
```
Expected: all backend and frontend tests pass; lint clean; build exits 0 and lists separate JS chunks for `ChefsMap` and `AreaMap`.

- [ ] **Step 6: Try it in the browser**

Start the preview `neighbors-kitchen` (restart it if already running, so the API picks up the new migration and code), then check:
1. `/chefs`: type 92373, "Find chefs": the list is sorted with "N miles away"; Palm Springs, Palm Desert and Indio chefs disappear at "Within 25 miles" and come back with "Any distance"; "Clear location" removes the place and the distance filter.
2. Map button: circles appear and fit the view, the red dot marks the search point, a popup links to the chef page, and the OpenStreetMap credit is visible.
3. `/chefs/<Maria's id>`: "Where Maria cooks" shows the circle and the note; "Delivery: Within 8 miles".
4. Log in as Chris, add Maria's meal, checkout with delivery to `73-510 Fred Waring Dr, Palm Desert, CA 92260`: refused, with the message under the address field. Delivery to `35 Cajon St, Redlands, CA 92373`: accepted. As Maria, Orders shows "(... miles away)" on that order. Cancel the test order afterwards.
5. Maria's Kitchen profile: "How far will you deliver?" and the map preview.
6. Home page: the ZIP box opens `/chefs?near=...&maxDistance=25`.
7. Phone width (375px): no sideways scrolling on `/chefs` (list and map) or the chef page.
8. No errors in the browser console or server logs.

- [ ] **Step 7: Update the docs**

README.md:
- Status table row 7: `| 7. Local | Find chefs near you on a map, email notifications | 🚧 Map done, emails next |`
- API table, add:
  - `| GET | /api/v1/chefs?near=92373 or ?lat=&lng=, maxDistance | Chefs nearest first, each with distanceMiles (5-digit ZIP, or a location from the browser) |`
  - `| GET | /api/v1/chefs/map | Every matching chef's approximate area for the map (same filters, no pages) |`
- Pages table: `| Chefs near a ZIP code, as a list or a map | /chefs?near=92373, /chefs?near=92373&view=map |`
- Add a paragraph after "How reviews and dish requests work (Phase 6)":

  **How location works (Phase 7):** chefs' kitchens are placed on the map from their address when they save it (US Census Bureau geocoder, free), or from their ZIP code if the street is not found. Neighbors only ever see an approximate area, a circle about a mile across that contains the kitchen but is not centered on it, and every distance is measured to that circle. Customers search from a ZIP code or their browser location (rounded to about half a mile, never stored). Delivery orders farther than the chef delivers are turned down at checkout. Map tiles © OpenStreetMap contributors; ZIP code locations from the US Census Bureau Gazetteer (public domain, `backend/data/zip-centroids.csv`, rebuilt with `node scripts/build-zip-centroids.mjs`).
- Environment variables: add `GEOCODER` - `census` (default, free US Census geocoder) or `off`.
- Future Integrations: change `Maps (location features)` to `A map tile provider for production traffic (OpenStreetMap's free tiles are for light use)`.

CLAUDE.md, "Key conventions already in place", add:

```
- Location (`services/geo.ts`, `zipCodes.ts`, `geocoding.ts`, `locationService.ts`): `chef_profiles.latitude/longitude` are exact and private; `approx_latitude/approx_longitude` are the public area center (moved 0.1-0.3 mi, re-picked only when the street, city, state or ZIP changes). Every public distance, filter and the delivery check is measured from the area center with `distanceMiles` and rounded with `roundToTenth`; `toArea()` is the only public shape. The Census geocoder is called only when a chef saves an address or a customer places a delivery order, never from public endpoints; tests run with `GEOCODER=off` and mock `services/geocoding.js`. ZIP lookups use the committed `backend/data/zip-centroids.csv`.
```

- [ ] **Step 8: Commit and push**

```bash
git add README.md CLAUDE.md frontend/src
git commit -m "feat(web): chef area maps, delivery distance for chefs, docs for phase 7a" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin claude/neighbors-kitchen-chat-dk4r07
```
Expected: push succeeds; `git status` is clean.
