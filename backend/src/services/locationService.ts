import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors.js';
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
