import { useState, type MouseEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const onHero = variant === 'transparent'

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  // On phones the links live in a drop-down menu; close it once something in it is chosen.
  const closeMenuAfterChoice = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('a, button')) setMenuOpen(false)
  }

  return (
    <nav className={`navbar navbar--${variant}`} aria-label="Main">
      <Link to="/" className="logo">
        <span className="logo-icon" aria-hidden="true">🍳</span>
        <span className="logo-text">Neighbors Kitchen</span>
      </Link>

      <button
        type="button"
        className="nav-toggle"
        aria-expanded={menuOpen}
        aria-controls="main-menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="visually-hidden">{menuOpen ? 'Close menu' : 'Open menu'}</span>
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          {menuOpen ? (
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
      </button>

      <div id="main-menu" className={`nav-links ${menuOpen ? 'is-open' : ''}`} onClick={closeMenuAfterChoice}>
        <NavLink to="/meals" className="nav-link">Meals</NavLink>
        <NavLink to="/chefs" className="nav-link">Chefs</NavLink>
        {onHero && <a href="#how-it-works" className="nav-link nav-section-link">How It Works</a>}
        {user?.role === 'CHEF' && <NavLink to="/chef" className="nav-link">Dashboard</NavLink>}

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
            <NavLink to="/account" className="nav-link">Hi, {user.firstName}</NavLink>
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
