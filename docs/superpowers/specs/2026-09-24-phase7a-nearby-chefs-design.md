# Phase 7a: Find chefs near you (design)

Date: 2026-09-24. Approved in chat by the project owner (Master Joseph) the same day.
Phase 7 is split in two: 7a (this document, the map and distances) and 7b (email notifications, designed separately).

## In plain words

- Customers type a ZIP code or tap "Use my location" on the Chefs page (or the new box on the home page). Chefs are listed nearest first with "2.1 miles away", and can be filtered to 5, 10, 25 or 50 miles, or any distance.
- A **Map** button on the Chefs page shows every matching chef as a shaded circle. Each chef's page has a small "Where Maria cooks" map.
- Chefs never have their exact address shown. The circle is about 1 mile across and their home is inside it, never at the center.
- Chefs already choose how far they serve on their Kitchen profile. That setting is relabeled **How far will you deliver?** and now blocks delivery orders from farther away at checkout, with a suggestion to choose pickup. If an address cannot be found on the map, the order still goes through and the chef can decline it. (Correction, 2026-09-24: the design discussed in chat said chefs could not change this yet; they can, so no new setting is added.)
- Chefs see roughly how far away each delivery customer is.

## Decisions (owner, 2026-09-24)

| Question | Decision |
|---|---|
| Block delivery orders beyond the chef's delivery distance? | Yes. If the address cannot be located, allow the order. |
| Map provider | OpenStreetMap tiles via Leaflet: free, no account. Revisit at launch (Phase 8) if traffic grows. |
| Address lookup | US Census Bureau geocoder: free, no account, US addresses. |
| ZIP code lookup | Bundle the Census Bureau's public ZIP code (ZCTA) centroid list, built from `2025_Gaz_zcta_national.zip` on census.gov (about 1 MB download). |
| Meals page by distance | Not in this phase. |

## Privacy model

- `chef_profiles.latitude/longitude` hold the exact geocoded position. They never leave the server.
- New `approx_latitude/approx_longitude` hold a public **area center**: the exact position moved 0.1 to 0.3 miles in a random direction, chosen once each time the address changes and then stored. The public area is a circle of radius `AREA_RADIUS_MILES = 0.5` around it, so the home is always inside the circle (at least 0.2 miles from its edge) and never at its center.
- Every distance the app computes (list sorting, the distance filter, "2.1 miles away", the delivery check, the distance shown to chefs) is measured from the area center. Because that point is fixed per address, repeating searches from different places cannot narrow down the home any further than the public circle.
- Customer ZIP codes are looked up in the bundled list and never sent to another service. "Use my location" coordinates are rounded to 2 decimals (about half a mile) in the browser before they are sent, and are not stored.
- Chef street addresses and customer delivery addresses are sent to the Census geocoder (a US government service) only when a chef saves their kitchen address or a customer places a delivery order. Public endpoints never call an outside service.
- Unchanged: the pickup address is only shown after the chef confirms an order, and public responses never include `addressLine1/2`, `zipCode`, `latitude`, `longitude`.

## Data changes (one migration)

- `chef_profiles.approx_latitude DECIMAL(9,6) NULL`, `chef_profiles.approx_longitude DECIMAL(9,6) NULL`
- `orders.delivery_distance_miles DECIMAL(5,1) NULL` (only for delivery orders whose address was located)
- Seed: sample chefs keep their coordinates; their area centers come from a deterministic random generator seeded by the chef's email, so reseeding gives the same circles. The seed also fills area centers for any other chef that lacks one (from the exact position, or the ZIP code centroid), without calling the geocoder.

## Backend

New modules in `backend/src/services/`:

- `geo.ts` (pure functions): `distanceMiles(a, b)` (haversine, Earth radius 3958.8 mi), `approximateLocation(exact, random = Math.random)`, `AREA_RADIUS_MILES`, `roundToTenth(miles)`.
- `zipCodes.ts`: `zipCentroid(zip)` returns `{ latitude, longitude } | null`; accepts `92373` or `92373-1234`. Reads `backend/data/zip-centroids.csv` once, on first use. The CSV (`zip,latitude,longitude`, about 34,000 rows) is committed and built by `backend/scripts/build-zip-centroids.mjs` from the Gazetteer text file.
- `geocoding.ts`: `geocodeAddress(oneLineAddress)` calls `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress` (`benchmark=Public_AR_Current`, `format=json`) with a 6-second timeout and returns the first match, or `null` when there is no match, the service fails, or times out (logged with `console.warn`). A new setting `GEOCODER` (`census` default, `off`) turns network lookups off; the test environment uses `off`, and tests that need a result mock this module.
- `locationService.ts`: `locateKitchen({ addressLine1, city, state, zipCode })` tries the street address and falls back to the ZIP centroid, then picks the area center; `resolveOrigin(query)` turns `near` or `lat`/`lng` into a search point; `toArea(chef)` shapes the public `area`. Kept apart from `geocoding.ts` so tests can mock the network lookup alone.

Changes:

- **Kitchen setup and edits** (`kitchenService.ts`): `becomeChef` locates the address before saving and stores exact plus area coordinates (all `null` if even the ZIP is unknown). `updateOwnKitchen` locates again only when `addressLine1`, `city`, `state` or `zipCode` actually changes. The chef's own kitchen response adds `area`.
- **Delivery distance setting**: unchanged in the API. `serviceRadiusMiles` (1 to 50) is already set through kitchen setup and `PUT /chefs/me`.
- **Public chef data** (`chefService.ts`):
  - `GET /api/v1/chefs` accepts `near` (5-digit ZIP) or `lat` + `lng`, and `maxDistance` (1 to 100 miles; no limit when absent). With a location, only chefs that have an area are included, sorted nearest first (ties in id order). Pagination still applies: matching chefs' area centers are loaded, distances computed in code, the page of ids sliced, then the cards for that page loaded. Every card gets `distanceMiles` (a number rounded to 0.1, or `null` without a location). `maxDistance` is ignored without a location. An unknown ZIP returns 422 `UNKNOWN_ZIP`; `lat` without `lng` (or the reverse), or `near` together with `lat`/`lng`, returns 422.
  - New `GET /api/v1/chefs/map` (registered before `/chefs/:id`): same filters, no pagination, at most 500 chefs. Returns `{ origin, chefs }`, where `origin` is the search point (or `null`) and each chef has `id, kitchenName, chefName, city, averageRating, totalReviews, isAcceptingOrders, distanceMiles, area`.
  - `GET /api/v1/chefs/:id` adds `area`.
  - `area` is always `{ latitude, longitude, radiusMiles: 0.5 }` or `null`.
- **Placing a delivery order** (`orderService.ts`): after the existing checks and before the database transaction, the delivery address is geocoded. If it is found and the chef has an area, the distance is compared with `serviceRadiusMiles`. If it is too far: 409 `OUTSIDE_DELIVERY_AREA`, message "Abuela's Table delivers up to 8 miles from their kitchen. This address is about 11.3 miles away. Please choose pickup or another address.", and `details.deliveryAddress` set to the same text so checkout shows it under the address field. Otherwise the rounded distance is saved as `deliveryDistanceMiles`. Pickup orders are not geocoded. The chef's view of an order includes `deliveryDistanceMiles`.

## Frontend

- Packages: `leaflet`, `react-leaflet` (v5, React 19), `@types/leaflet` (dev). Map components are lazy-loaded (`React.lazy`) together with `leaflet/dist/leaflet.css`, so pages without a map stay small.
- `utils/location.ts`: ZIP validation, reading and writing `near` / `lat` / `lng` / `maxDistance` / `view` in the URL, rounding browser coordinates, `formatDistance` ("less than a mile away", "2.1 miles away"). The last ZIP typed is remembered in localStorage to prefill the ZIP box (wrapped in try/catch).
- `components/location/NearMeForm.tsx`: ZIP box plus "Use my location" (browser geolocation, 10-second timeout). If location access fails, the form asks for a ZIP code instead.
- `components/location/ChefsMap.tsx`: OpenStreetMap tiles with the required "© OpenStreetMap contributors" credit, one circle per chef, a popup with the kitchen name, rating and a link, a dot for the searcher's location, and a view that fits all circles.
- `components/location/AreaMap.tsx`: a small map of one chef's circle.
- **Chefs page**: NearMeForm above the filters; a distance filter once a location is set (default 25 miles when starting from a ZIP or location); a heading like "8 chefs near 92373"; List/Map toggle (`view=map`). Cards show the distance.
- **Home page**: a "Find chefs near you" ZIP box that opens `/chefs?near=ZIP&maxDistance=25`.
- **Chef page**: a "Where Maria cooks" card with AreaMap, "Shown as an area for privacy. The pickup address is shared after Maria confirms your order." and, for delivery, "Delivers up to 8 miles".
- **Kitchen setup and Kitchen profile form** (`KitchenProfileForm`): "How far will you serve?" becomes "How far will you deliver?" with the hint "Delivery orders from farther away are turned down automatically." The privacy note under the address becomes "Your street address stays private. Neighbors see an approximate area about a mile across, and pickup details are shared after an order is confirmed."
- **Chef dashboard, Kitchen profile**: "How neighbors see your location" with AreaMap, or a note if the address could not be placed.
- **Chef dashboard, Hours & delivery**: the delivery checkbox keeps "I deliver (within N miles)" and adds a link to the Kitchen profile to change the distance.
- **Chef dashboard, Orders**: delivery orders show "about 3.2 miles away" when known.
- **Checkout**: no change needed. It already shows "within N miles of City" and displays `details.deliveryAddress` errors under the address field.

## Testing

Backend (Vitest + Supertest, real test database, geocoder mocked with `vi.mock`):
- `geo.test.ts`: known distances (Redlands to Riverside about 11 miles), zero distance, offsets always between 0.1 and 0.3 miles, a fixed random source gives a fixed result.
- `zipCodes.test.ts`: known ZIP, ZIP+4, unknown ZIP.
- `geocoding.test.ts` (stubbed `fetch`): match, no match, HTTP error, timeout, `GEOCODER=off` never calls fetch, ZIP fallback.
- `location.test.ts`: near-ZIP sorting and distances, `maxDistance`, `lat`/`lng`, unknown ZIP, half coordinates, chefs without an area left out of near searches but still in normal lists, `/chefs/map` shape, `area` on `/chefs/:id`, and privacy: no exact coordinates anywhere, and the area center stays within 0.3 miles of the exact position.
- Kitchen: setup stores coordinates, ZIP fallback, the address change locates again, other edits do not call the geocoder.
- Orders: too far returns 409 with details; in range saves and returns the distance to the chef; unknown address is allowed with no distance; pickup never geocodes.

Frontend (Vitest): `utils/location` helpers; NearMeForm (jsdom: ZIP submit, invalid ZIP, geolocation success rounds coordinates, geolocation failure message); ChefCard distance line. Maps are checked in the browser.

Browser walkthrough: Chefs near 92373 (sorted, distances, filter), Map view (circles and popups), chef page map, Maria's delivery distance on her Kitchen profile, checkout blocked for a far address and allowed for a near one, Kitchen profile map, phone width.

## Out of scope and later

- Meals page sorted or filtered by distance.
- Choosing a production map tile provider and a Content Security Policy that allows it (Phase 8). OpenStreetMap's tile servers are meant for light use.
- Driving distance or drive time (straight-line distance only).
- Deployment must ship `backend/data/zip-centroids.csv` with the API (Phase 8).
