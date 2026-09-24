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
