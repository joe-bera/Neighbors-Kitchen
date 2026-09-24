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
