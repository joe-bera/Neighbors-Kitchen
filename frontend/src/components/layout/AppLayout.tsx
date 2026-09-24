import { Outlet } from 'react-router-dom'
import Footer from './Footer'
import Navbar from './Navbar'

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
