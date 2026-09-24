import { describe, expect, it } from 'vitest'
import { pickOnePerChef } from './featured'

const meal = (id: string, chefId: string) => ({ id, chef: { id: chefId } })

describe('pickOnePerChef', () => {
  it('takes the first meal from each chef, in order, up to the limit', () => {
    const meals = [meal('m1', 'maria'), meal('m2', 'maria'), meal('k1', 'kenji'), meal('a1', 'aisha'), meal('t1', 'tony')]

    expect(pickOnePerChef(meals, 3).map((item) => item.id)).toEqual(['m1', 'k1', 'a1'])
  })

  it('returns fewer meals when there are not enough chefs', () => {
    const meals = [meal('m1', 'maria'), meal('m2', 'maria'), meal('k1', 'kenji')]

    expect(pickOnePerChef(meals, 4).map((item) => item.id)).toEqual(['m1', 'k1'])
  })
})
