// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetPassword } from '../services/accountService'
import ResetPasswordPage from './ResetPasswordPage'

vi.mock('../services/accountService', () => ({ resetPassword: vi.fn() }))
const reset = vi.mocked(resetPassword)

function LoginStub() {
  const location = useLocation()
  return <p>Login page: {(location.state as { message?: string } | null)?.message}</p>
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

function submit(password: string, again: string) {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('New password again'), { target: { value: again } })
  fireEvent.click(screen.getByRole('button', { name: 'Save new password' }))
}

/** What the API client throws for an error answer. */
function apiError(code: string, message: string) {
  return Object.assign(new Error(message), { isAxiosError: true, response: { status: 400, data: { success: false, error: { code, message } } } })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ResetPasswordPage', () => {
  it('saves the new password and sends the person to log in', async () => {
    reset.mockResolvedValue(undefined)
    renderAt('/reset-password?token=abc123')

    submit('Tacos5ever', 'Tacos5ever')

    await screen.findByText('Login page: Your password was changed. Log in with your new password.')
    expect(reset).toHaveBeenCalledWith('abc123', 'Tacos5ever')
  })

  it('asks again when the two passwords differ', async () => {
    renderAt('/reset-password?token=abc123')

    submit('Tacos5ever', 'Tacos6ever')

    await screen.findByText('The passwords do not match')
    expect(reset).not.toHaveBeenCalled()
  })

  it('explains an expired link and offers a new one', async () => {
    reset.mockRejectedValue(apiError('INVALID_RESET_LINK', 'This link has expired or was already used. Ask for a new one.'))
    renderAt('/reset-password?token=abc123')

    submit('Tacos5ever', 'Tacos5ever')

    await screen.findByText('This link has expired or was already used. Ask for a new one.')
    expect(screen.getByRole('link', { name: 'Ask for a new link' }).getAttribute('href')).toBe('/forgot-password')
  })

  it('explains a link without its token', () => {
    renderAt('/reset-password')

    screen.getByText('This link is not complete. Open it from the email again, or ask for a new one.')
    screen.getByRole('link', { name: 'Ask for a new link' })
  })
})
