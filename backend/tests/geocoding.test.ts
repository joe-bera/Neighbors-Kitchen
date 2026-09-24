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
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tries again without the dash in house numbers written like 73-510', async () => {
    fetchMock
      .mockResolvedValueOnce(censusAnswer([]))
      .mockResolvedValueOnce(censusAnswer([{ coordinates: { x: -116.372, y: 33.7204 } }]));

    const result = await geocodeAddress('73-510 Fred Waring Dr, Palm Desert, CA 92260');

    expect(result).toEqual({ latitude: 33.7204, longitude: -116.372 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retried = new URL(String(fetchMock.mock.calls[1][0]));
    expect(retried.searchParams.get('address')).toBe('73510 Fred Waring Dr, Palm Desert, CA 92260');
  });

  it('does not try again when the service itself failed', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));

    expect(await geocodeAddress('73-510 Fred Waring Dr, Palm Desert, CA 92260')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
