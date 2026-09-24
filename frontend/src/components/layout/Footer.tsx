import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h4>Neighbors Kitchen</h4>
          <p>Connecting local chefs with their community</p>
        </div>
        <div className="footer-section">
          <h4>For Customers</h4>
          <ul>
            <li><Link to="/meals">Browse meals</Link></li>
            <li><Link to="/chefs">Browse chefs</Link></li>
            <li><Link to="/#how-it-works">How It Works</Link></li>
            <li><Link to="/signup">Create an account</Link></li>
          </ul>
        </div>
        <div className="footer-section">
          <h4>For Chefs</h4>
          <ul>
            <li><Link to="/signup?role=chef">Become a Chef</Link></li>
            <li><Link to="/login">Chef log in</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Neighbors Kitchen. All rights reserved.</p>
      </div>
    </footer>
  )
}
