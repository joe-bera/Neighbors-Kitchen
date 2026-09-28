import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { requestPasswordReset, resetPassword, updateEmailSettings } from './accountService'

const API = 'http://api.test/api/v1'
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('updateEmailSettings', () => {
  it('sends only the changed setting and returns all of them', async () => {
    let body: unknown = null
    server.use(
      http.put(`${API}/users/me/email-settings`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { emailSettings: { rateReminders: false, dishRequestNews: true, kitchenFeedback: true } } })
      }),
    )

    expect(await updateEmailSettings({ rateReminders: false })).toEqual({ rateReminders: false, dishRequestNews: true, kitchenFeedback: true })
    expect(body).toEqual({ rateReminders: false })
  })
})

describe('password recovery', () => {
  it('asks for a reset link and returns the answer to show', async () => {
    let body: unknown = null
    server.use(
      http.post(`${API}/auth/forgot-password`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: null, message: "If there's an account for that email, we sent a link to reset the password." })
      }),
    )

    expect(await requestPasswordReset('jane@example.com')).toBe("If there's an account for that email, we sent a link to reset the password.")
    expect(body).toEqual({ email: 'jane@example.com' })
  })

  it('sends the token and the new password', async () => {
    let body: unknown = null
    server.use(
      http.post(`${API}/auth/reset-password`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: null, message: 'Your password was changed. Log in with your new password.' })
      }),
    )

    await resetPassword('abc123', 'Tacos5ever')

    expect(body).toEqual({ token: 'abc123', password: 'Tacos5ever' })
  })
})
