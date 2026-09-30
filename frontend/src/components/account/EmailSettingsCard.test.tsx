// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateEmailSettings } from '../../services/accountService'
import EmailSettingsCard from './EmailSettingsCard'

vi.mock('../../services/accountService', () => ({ updateEmailSettings: vi.fn() }))
const save = vi.mocked(updateEmailSettings)

const allOn = { rateReminders: true, dishRequestNews: true, kitchenFeedback: true }
const switchNamed = (name: string) => screen.getByRole('switch', { name }) as HTMLInputElement

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('EmailSettingsCard', () => {
  it('shows customers two switches, and chefs a third for their kitchen', () => {
    const { unmount } = render(<EmailSettingsCard initial={allOn} isChef={false} />)
    expect(screen.getAllByRole('switch').map((toggle) => toggle.closest('label')?.textContent)).toEqual([
      'Rate-your-meal reminders',
      'Answers to my dish requests',
    ])
    unmount()

    render(<EmailSettingsCard initial={allOn} isChef />)
    expect(switchNamed('New reviews and dish requests').checked).toBe(true)
  })

  it('saves just the switch that was flipped', async () => {
    save.mockResolvedValue({ ...allOn, rateReminders: false })
    render(<EmailSettingsCard initial={allOn} isChef={false} />)

    fireEvent.click(switchNamed('Rate-your-meal reminders'))

    await screen.findByText('Saved.')
    expect(save).toHaveBeenCalledWith({ rateReminders: false })
    expect(switchNamed('Rate-your-meal reminders').checked).toBe(false)
  })

  it('puts the switch back when saving fails', async () => {
    save.mockRejectedValue(new Error('offline'))
    render(<EmailSettingsCard initial={allOn} isChef={false} />)

    fireEvent.click(switchNamed('Answers to my dish requests'))

    await screen.findByRole('alert')
    expect(switchNamed('Answers to my dish requests').checked).toBe(true)
  })
})
