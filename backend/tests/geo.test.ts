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
