import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { updateEmailSettings } from './accountService'

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
