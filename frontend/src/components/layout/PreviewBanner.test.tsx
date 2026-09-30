// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import PreviewBanner from './PreviewBanner'

/** What the server adds to the page on the preview site. */
function markAsPreview() {
  const meta = document.createElement('meta')
  meta.name = 'nk-preview'
  meta.content = 'true'
  document.head.append(meta)
}

afterEach(() => {
  cleanup()
  document.head.querySelector('meta[name="nk-preview"]')?.remove()
})

describe('PreviewBanner', () => {
  it('tells visitors the preview takes practice orders only', () => {
    markAsPreview()

    render(<PreviewBanner />)

    expect(screen.getByRole('note').textContent).toBe('Preview: practice orders only. No food is made and no one is charged.')
  })

  it('shows nothing on the real site or in development', () => {
    const { container } = render(<PreviewBanner />)

    expect(container.innerHTML).toBe('')
  })
})
