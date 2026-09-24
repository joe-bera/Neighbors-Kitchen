import { describe, expect, it } from 'vitest'
import { getSafeRedirect } from './safeRedirect'

describe('getSafeRedirect', () => {
  it.each([
    ['/account', '/account'],
    ['/chefs?city=Redlands#menu', '/chefs?city=Redlands#menu'],
  ])('keeps the in-app path %s', (input, expected) => {
    expect(getSafeRedirect(input, '/fallback')).toBe(expected)
  })

  it.each([
    null,
    '',
    'account',
    '//evil.example',
    '/\\evil.example',
    'https://evil.example/account',
    'javascript:alert(1)',
  ])('uses the fallback instead of %s', (input) => {
    expect(getSafeRedirect(input, '/fallback')).toBe('/fallback')
  })
})
