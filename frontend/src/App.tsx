import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { GuestRoute, ProtectedRoute } from './components/auth/RouteGuards'
import ScrollToTop from './components/common/ScrollToTop'
import AppLayout from './components/layout/AppLayout'
import AccountPage from './pages/AccountPage'
import ChefProfilePage from './pages/ChefProfilePage'
import ChefsPage from './pages/ChefsPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import MealDetailPage from './pages/MealDetailPage'
import MealsPage from './pages/MealsPage'
import NotFoundPage from './pages/NotFoundPage'
import SignupPage from './pages/SignupPage'
import { refreshSession } from './services/api'

function App() {
  // Restore the session from the refresh cookie when the app first loads.
  useEffect(() => {
    void refreshSession()
  }, [])

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route element={<AppLayout />}>
          <Route path="/meals" element={<MealsPage />} />
          <Route path="/meals/:id" element={<MealDetailPage />} />
          <Route path="/chefs" element={<ChefsPage />} />
          <Route path="/chefs/:id" element={<ChefProfilePage />} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
