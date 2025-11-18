import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3 className="footer-title">
            <span className="footer-logo">🍳</span> Neighbors Kitchen
          </h3>
          <p className="footer-description">
            Connecting local chefs with neighbors who crave delicious, home-cooked meals.
          </p>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">For Customers</h4>
          <ul className="footer-links">
            <li><Link to="/browse-chefs">Find Chefs</Link></li>
            <li><Link to="/how-it-works">How It Works</Link></li>
            <li><Link to="/categories">Browse Categories</Link></li>
            <li><Link to="/about">About Us</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">For Chefs</h4>
          <ul className="footer-links">
            <li><Link to="/become-chef">Become a Chef</Link></li>
            <li><Link to="/chef-resources">Chef Resources</Link></li>
            <li><Link to="/pricing">Pricing</Link></li>
            <li><Link to="/faq">FAQ</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">Support</h4>
          <ul className="footer-links">
            <li><Link to="/contact">Contact Us</Link></li>
            <li><Link to="/help">Help Center</Link></li>
            <li><Link to="/terms">Terms of Service</Link></li>
            <li><Link to="/privacy">Privacy Policy</Link></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-container">
          <p className="footer-copyright">
            © 2025 Neighbors Kitchen. Built with ❤️ for the community.
          </p>
          <div className="footer-social">
            <a href="#" className="social-link">Twitter</a>
            <a href="#" className="social-link">Instagram</a>
            <a href="#" className="social-link">Facebook</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
