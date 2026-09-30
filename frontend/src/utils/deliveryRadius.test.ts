import { describe, expect, it } from 'vitest'
import { radiusOptions } from './deliveryRadius'

describe('radiusOptions', () => {
  it('offers the usual distances', () => {
    expect(radiusOptions()).toEqual([2, 5, 10, 15, 25])
    expect(radiusOptions(10)).toEqual([2, 5, 10, 15, 25])
  })

  it("adds the kitchen's own distance when it is not one of them", () => {
    expect(radiusOptions(8)).toEqual([2, 5, 8, 10, 15, 25])
    expect(radiusOptions(7.5)).toEqual([2, 5, 7.5, 10, 15, 25])
    expect(radiusOptions(30)).toEqual([2, 5, 10, 15, 25, 30])
  })
})
