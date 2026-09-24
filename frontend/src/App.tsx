import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { GuestRoute, ProtectedRoute } from './components/auth/RouteGuards'
import ScrollToTop from './components/common/ScrollToTop'
import AppLayout from './components/layout/AppLayout'
import AccountPage from './pages/AccountPage'
import AvailabilityPage from './pages/chef/AvailabilityPage'
import ChefLayout from './pages/chef/ChefLayout'
import ChefMealsPage from './pages/chef/ChefMealsPage'
import ChefOverviewPage from './pages/chef/ChefOverviewPage'
import KitchenSettingsPage from './pages/chef/KitchenSettingsPage'
import KitchenSetupPage from './pages/chef/KitchenSetupPage'
import MealEditorPage from './pages/chef/MealEditorPage'
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
          <Route path="/chef/setup" element={<ProtectedRoute><KitchenSetupPage /></ProtectedRoute>} />
          <Route
            path="/chef"
            element={
              <ProtectedRoute roles={['CHEF']} otherRolesRedirectTo="/chef/setup">
                <ChefLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ChefOverviewPage />} />
            <Route path="meals" element={<ChefMealsPage />} />
            <Route path="meals/new" element={<MealEditorPage />} />
            <Route path="meals/:id/edit" element={<MealEditorPage />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="kitchen" element={<KitchenSettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
