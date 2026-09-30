import { describe, expect, it } from 'vitest'
import { withLinksInNewTab } from './practiceMailbox'

describe('withLinksInNewTab', () => {
  it('makes the links in an email preview open in a new tab', () => {
    expect(withLinksInNewTab('<html><head><title>Hi</title></head><body><a href="x">x</a></body></html>')).toBe(
      '<html><head><base target="_blank"><title>Hi</title></head><body><a href="x">x</a></body></html>',
    )
  })

  it('works for an email without a head', () => {
    expect(withLinksInNewTab('<p>Hi</p>')).toBe('<base target="_blank"><p>Hi</p>')
  })
})
