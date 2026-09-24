import { describe, expect, it } from 'vitest'
import { withUpdatedParams } from './searchParams'

describe('withUpdatedParams', () => {
  it('sets new values, removes empty ones and goes back to the first page', () => {
    const current = new URLSearchParams('search=taco&cuisine=Mexican&page=3')

    const next = withUpdatedParams(current, { category: 'DINNER', search: '' })

    expect(next.toString()).toBe('cuisine=Mexican&category=DINNER')
  })

  it('keeps the other filters when only the page changes', () => {
    const current = new URLSearchParams('search=taco')

    expect(withUpdatedParams(current, { page: '2' }).toString()).toBe('search=taco&page=2')
  })

  it('leaves page 1 out of the address because it is the default', () => {
    const current = new URLSearchParams('search=taco&page=2')

    expect(withUpdatedParams(current, { page: '1' }).toString()).toBe('search=taco')
  })

  it('does not change the original parameters', () => {
    const current = new URLSearchParams('search=taco')

    withUpdatedParams(current, { search: 'pho' })

    expect(current.toString()).toBe('search=taco')
  })
})
