import './App.css'

function App() {
  return (
    <div className="app">
      {/* Hero Section */}
      <header className="hero">
        <nav className="navbar">
          <div className="logo">
            <span className="logo-icon">🍳</span>
            <span className="logo-text">Neighbors Kitchen</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <button className="btn-primary">Get Started</button>
          </div>
        </nav>

        <div className="hero-content">
          <h1>Discover Amazing Home-Cooked Meals from Local Chefs</h1>
          <p className="hero-subtitle">
            Connect with talented chefs in your neighborhood. Order delicious,
            authentic meals made with love, right in your community.
          </p>
          <div className="hero-buttons">
            <button className="btn-large btn-primary">Browse Chefs</button>
            <button className="btn-large btn-secondary">Become a Chef</button>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section id="features" className="features">
        <h2>Why Choose Neighbors Kitchen?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">👨‍🍳</div>
            <h3>Local Chefs</h3>
            <p>Discover talented chefs in your neighborhood with diverse culinary backgrounds</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🍽️</div>
            <h3>Fresh Meals</h3>
            <p>Enjoy freshly prepared, home-cooked meals made with quality ingredients</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📅</div>
            <h3>Pre-Order</h3>
            <p>Browse menus and pre-order meals for pickup or delivery at your convenience</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⭐</div>
            <h3>Reviews & Ratings</h3>
            <p>Read authentic reviews from neighbors and build trust in your community</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💳</div>
            <h3>Secure Payments</h3>
            <p>Safe and easy payment processing with transparent pricing</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🌍</div>
            <h3>Community Driven</h3>
            <p>Support local talent and build connections with your neighbors</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Find Local Chefs</h3>
            <p>Browse chef profiles and menus in your neighborhood</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Place Your Order</h3>
            <p>Select your favorite meals and schedule pickup or delivery</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Enjoy Your Meal</h3>
            <p>Pick up your freshly prepared meal and enjoy delicious home cooking</p>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>Leave a Review</h3>
            <p>Share your experience and help others discover great local chefs</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <h2>Ready to Get Started?</h2>
        <p>Join our community of food lovers and talented chefs today!</p>
        <div className="cta-buttons">
          <button className="btn-large btn-primary">Find Chefs Near You</button>
          <button className="btn-large btn-secondary">Become a Chef</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Neighbors Kitchen</h4>
            <p>Connecting local chefs with their community</p>
          </div>
          <div className="footer-section">
            <h4>For Customers</h4>
            <ul>
              <li><a href="#browse">Browse Chefs</a></li>
              <li><a href="#how-it-works">How It Works</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>For Chefs</h4>
            <ul>
              <li><a href="#become-chef">Become a Chef</a></li>
              <li><a href="#chef-resources">Resources</a></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Company</h4>
            <ul>
              <li><a href="#about">About Us</a></li>
              <li><a href="#contact">Contact</a></li>
              <li><a href="#terms">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024 Neighbors Kitchen. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
