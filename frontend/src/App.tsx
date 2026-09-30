import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { GuestRoute, ProtectedRoute } from './components/auth/RouteGuards'
import PageLoader from './components/common/PageLoader'
import ScrollToTop from './components/common/ScrollToTop'
import AppLayout from './components/layout/AppLayout'
import PreviewBanner from './components/layout/PreviewBanner'
import AccountPage from './pages/AccountPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import AvailabilityPage from './pages/chef/AvailabilityPage'
import ChefFeedbackPage from './pages/chef/ChefFeedbackPage'
import ChefLayout from './pages/chef/ChefLayout'
import ChefMealsPage from './pages/chef/ChefMealsPage'
import ChefOrdersPage from './pages/chef/ChefOrdersPage'
import ChefOverviewPage from './pages/chef/ChefOverviewPage'
import KitchenSettingsPage from './pages/chef/KitchenSettingsPage'
import KitchenSetupPage from './pages/chef/KitchenSetupPage'
import MealEditorPage from './pages/chef/MealEditorPage'
import ChefProfilePage from './pages/ChefProfilePage'
import ChefsPage from './pages/ChefsPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import MealDetailPage from './pages/MealDetailPage'
import MealsPage from './pages/MealsPage'
import NotFoundPage from './pages/NotFoundPage'
import NotificationsPage from './pages/NotificationsPage'
import OrderDetailPage from './pages/OrderDetailPage'
import OrdersPage from './pages/OrdersPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SignupPage from './pages/SignupPage'
import { refreshSession } from './services/api'

// Development only: this route and its page are left out of the live site's bundle.
const PracticeMailboxPage = import.meta.env.DEV ? lazy(() => import('./pages/dev/PracticeMailboxPage')) : null

function App() {
  // Restore the session from the refresh cookie when the app first loads.
  useEffect(() => {
    void refreshSession()
  }, [])

  return (
    <>
      <ScrollToTop />
      {/* Above the routes, so the home page (which has its own layout) shows it too. */}
      <PreviewBanner />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route element={<AppLayout />}>
          <Route path="/meals" element={<MealsPage />} />
          <Route path="/meals/:id" element={<MealDetailPage />} />
          <Route path="/chefs" element={<ChefsPage />} />
          <Route path="/chefs/:id" element={<ChefProfilePage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
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
            <Route path="orders" element={<ChefOrdersPage />} />
            <Route path="meals" element={<ChefMealsPage />} />
            <Route path="meals/new" element={<MealEditorPage />} />
            <Route path="meals/:id/edit" element={<MealEditorPage />} />
            <Route path="feedback" element={<ChefFeedbackPage />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="kitchen" element={<KitchenSettingsPage />} />
          </Route>
          {PracticeMailboxPage && (
            <Route
              path="/dev/mailbox"
              element={
                <Suspense fallback={<PageLoader label="Loading the practice mailbox" />}>
                  <PracticeMailboxPage />
                </Suspense>
              }
            />
          )}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
