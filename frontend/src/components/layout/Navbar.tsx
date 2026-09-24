import { Link, useNavigate } from 'react-router-dom'
import { logout } from '../../services/authService'
import { useAuthStore } from '../../store/authStore'
import './Navbar.css'

interface NavbarProps {
  /** 'transparent' sits on top of the purple hero on the home page. */
  variant?: 'solid' | 'transparent'
}

export default function Navbar({ variant = 'solid' }: NavbarProps) {
  const { status, user } = useAuthStore()
  const navigate = useNavigate()
  const onHero = variant === 'transparent'

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <nav className={`navbar navbar--${variant}`} aria-label="Main">
      <Link to="/" className="logo">
        <span className="logo-icon" aria-hidden="true">🍳</span>
        <span className="logo-text">Neighbors Kitchen</span>
      </Link>

      <div className="nav-links">
        {onHero && (
          <>
            <a href="#features" className="nav-link nav-section-link">Features</a>
            <a href="#how-it-works" className="nav-link nav-section-link">How It Works</a>
          </>
        )}

        {status === 'anonymous' && (
          <>
            <Link to="/login" className="nav-link">Log in</Link>
            <Link to="/signup" className={`btn btn-small ${onHero ? 'btn-light' : 'btn-primary'}`}>
              Get Started
            </Link>
          </>
        )}

        {status === 'authenticated' && user && (
          <>
            <Link to="/account" className="nav-link">Hi, {user.firstName}</Link>
            <button
              type="button"
              onClick={handleLogout}
              className={`btn btn-small ${onHero ? 'btn-outline-light' : 'btn-outline'}`}
            >
              Log out
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
