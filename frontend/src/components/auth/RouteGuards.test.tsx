// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, it } from 'vitest'
import { useAuthStore } from '../../store/authStore'
import { ProtectedRoute } from './RouteGuards'

function Address() {
  const location = useLocation()
  return <p>At {location.pathname + location.search + location.hash}</p>
}

afterEach(cleanup)

describe('ProtectedRoute', () => {
  it('sends visitors to log in, keeping the #section they asked for', () => {
    useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null })

    render(
      <MemoryRouter initialEntries={['/account#email-settings']}>
        <Routes>
          <Route path="/account" element={<ProtectedRoute><p>Account</p></ProtectedRoute>} />
          <Route path="/login" element={<Address />} />
        </Routes>
      </MemoryRouter>,
    )

    screen.getByText('At /login?redirect=%2Faccount%23email-settings')
  })
})
