import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">🍳</span>
          <span className="logo-text">Neighbors Kitchen</span>
        </Link>

        <ul className="navbar-menu">
          <li className="navbar-item">
            <Link to="/browse-chefs" className="navbar-link">
              Find Chefs
            </Link>
          </li>
          <li className="navbar-item">
            <Link to="/how-it-works" className="navbar-link">
              How It Works
            </Link>
          </li>
          <li className="navbar-item">
            <Link to="/become-chef" className="navbar-link">
              Become a Chef
            </Link>
          </li>
          <li className="navbar-item">
            <Link to="/login" className="navbar-link">
              Login
            </Link>
          </li>
          <li className="navbar-item">
            <Link to="/register" className="navbar-link navbar-link-primary">
              Sign Up
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
