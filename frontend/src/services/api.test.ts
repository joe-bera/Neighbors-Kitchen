import { delay, http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../store/authStore'
import type { User } from '../types/user.types'
import { api, refreshSession } from './api'

const API = 'http://api.test/api/v1'

const jane: User = {
  id: 'user-1',
  email: 'jane@example.com',
  role: 'CUSTOMER',
  firstName: 'Jane',
  lastName: 'Doe',
  phone: null,
  profilePhotoUrl: null,
  emailVerified: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const refreshSucceeds = () =>
  HttpResponse.json({ success: true, data: { user: jane, accessToken: 'fresh-token' } })

const unauthorized = (code: string, message: string) =>
  HttpResponse.json({ success: false, error: { code, message } }, { status: 401 })

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
beforeEach(() => useAuthStore.setState({ user: null, accessToken: null, status: 'loading' }))

describe('refreshSession', () => {
  it('stores the new session when the refresh cookie is valid', async () => {
    server.use(http.post(`${API}/auth/refresh-token`, refreshSucceeds))

    const token = await refreshSession()

    expect(token).toBe('fresh-token')
    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      accessToken: 'fresh-token',
      user: { email: 'jane@example.com' },
    })
  })

  it('marks the visitor as logged out when there is no valid session', async () => {
    server.use(
      http.post(`${API}/auth/refresh-token`, () => unauthorized('INVALID_REFRESH_TOKEN', 'Please log in again')),
    )

    const token = await refreshSession()

    expect(token).toBeNull()
    expect(useAuthStore.getState().status).toBe('anonymous')
  })

  it('sends a single refresh request when several callers ask at the same time', async () => {
    let calls = 0
    server.use(
      http.post(`${API}/auth/refresh-token`, async () => {
        calls += 1
        await delay(20)
        return refreshSucceeds()
      }),
    )

    const tokens = await Promise.all([refreshSession(), refreshSession(), refreshSession()])

    expect(calls).toBe(1)
    expect(tokens).toEqual(['fresh-token', 'fresh-token', 'fresh-token'])
  })
})

describe('api client', () => {
  it('sends the access token with each request', async () => {
    useAuthStore.setState({ user: jane, accessToken: 'current-token', status: 'authenticated' })
    let authorization: string | null = null
    server.use(
      http.get(`${API}/users/me`, ({ request }) => {
        authorization = request.headers.get('Authorization')
        return HttpResponse.json({ success: true, data: { user: jane } })
      }),
    )

    await api.get('/users/me')

    expect(authorization).toBe('Bearer current-token')
  })

  it('refreshes an expired access token and retries the request with the new one', async () => {
    useAuthStore.setState({ user: jane, accessToken: 'expired-token', status: 'authenticated' })
    server.use(
      http.post(`${API}/auth/refresh-token`, refreshSucceeds),
      http.get(`${API}/users/me`, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh-token'
          ? HttpResponse.json({ success: true, data: { user: jane } })
          : unauthorized('TOKEN_EXPIRED', 'Your session has expired'),
      ),
    )

    const res = await api.get('/users/me')

    expect(res.status).toBe(200)
    expect(useAuthStore.getState().accessToken).toBe('fresh-token')
  })

  it('retries only once if the new token is also rejected', async () => {
    useAuthStore.setState({ user: jane, accessToken: 'expired-token', status: 'authenticated' })
    let refreshCalls = 0
    server.use(
      http.post(`${API}/auth/refresh-token`, () => {
        refreshCalls += 1
        return refreshSucceeds()
      }),
      http.get(`${API}/users/me`, () => unauthorized('TOKEN_EXPIRED', 'Your session has expired')),
    )

    await expect(api.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } })
    expect(refreshCalls).toBe(1)
  })

  it('logs the visitor out when the session cannot be refreshed', async () => {
    useAuthStore.setState({ user: jane, accessToken: 'expired-token', status: 'authenticated' })
    server.use(
      http.post(`${API}/auth/refresh-token`, () => unauthorized('INVALID_REFRESH_TOKEN', 'Please log in again')),
      http.get(`${API}/users/me`, () => unauthorized('TOKEN_EXPIRED', 'Your session has expired')),
    )

    await expect(api.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } })
    expect(useAuthStore.getState().status).toBe('anonymous')
  })

  it('does not try to refresh after other 401 errors, such as a wrong password', async () => {
    let refreshCalls = 0
    server.use(
      http.post(`${API}/auth/refresh-token`, () => {
        refreshCalls += 1
        return refreshSucceeds()
      }),
      http.post(`${API}/auth/login`, () => unauthorized('INVALID_CREDENTIALS', 'Incorrect email or password')),
    )

    await expect(api.post('/auth/login', { email: 'jane@example.com', password: 'nope' })).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(refreshCalls).toBe(0)
  })
})
