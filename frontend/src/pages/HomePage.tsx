import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();

  const featuredChefs = [
    {
      id: 1,
      name: 'Chef Maria Garcia',
      specialty: 'Authentic Mexican Cuisine',
      rating: 4.9,
      image: '👩‍🍳',
      orders: 150,
    },
    {
      id: 2,
      name: 'Chef James Chen',
      specialty: 'Traditional Chinese Dishes',
      rating: 4.8,
      image: '👨‍🍳',
      orders: 200,
    },
    {
      id: 3,
      name: 'Chef Amira Hassan',
      specialty: 'Mediterranean Delights',
      rating: 5.0,
      image: '👩‍🍳',
      orders: 175,
    },
  ];

  const categories = [
    { name: 'Italian', icon: '🍝' },
    { name: 'Mexican', icon: '🌮' },
    { name: 'Asian', icon: '🍜' },
    { name: 'Mediterranean', icon: '🥙' },
    { name: 'Vegan', icon: '🥗' },
    { name: 'Desserts', icon: '🍰' },
  ];

  const howItWorks = [
    {
      step: 1,
      title: 'Browse Local Chefs',
      description: 'Discover talented chefs in your neighborhood and explore their menus',
      icon: '🔍',
    },
    {
      step: 2,
      title: 'Pre-Order Your Meal',
      description: 'Choose your favorite dishes and schedule pickup or delivery',
      icon: '📱',
    },
    {
      step: 3,
      title: 'Enjoy Homemade Food',
      description: 'Pick up fresh, delicious meals prepared by local culinary experts',
      icon: '😋',
    },
  ];

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Delicious Home-Cooked Meals from <span className="gradient-text">Your Neighbors</span>
          </h1>
          <p className="hero-subtitle">
            Connect with talented local chefs and enjoy authentic, homemade dishes delivered right to your door
          </p>
          <div className="hero-buttons">
            <Button size="large" onClick={() => navigate('/browse-chefs')}>
              Find Chefs Near You
            </Button>
            <Button variant="outline" size="large" onClick={() => navigate('/become-chef')}>
              Become a Chef
            </Button>
          </div>
        </div>
        <div className="hero-image">
          <div className="hero-emoji">🍳</div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="categories-section">
        <h2 className="section-title">Browse by Category</h2>
        <div className="categories-grid">
          {categories.map((category) => (
            <Card key={category.name} hover onClick={() => navigate('/browse-chefs')}>
              <div className="category-card">
                <span className="category-icon">{category.icon}</span>
                <span className="category-name">{category.name}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured Chefs Section */}
      <section className="featured-section">
        <h2 className="section-title">Featured Chefs</h2>
        <p className="section-subtitle">Meet some of our top-rated local chefs</p>
        <div className="chefs-grid">
          {featuredChefs.map((chef) => (
            <Card key={chef.id} hover onClick={() => navigate(`/chef/${chef.id}`)}>
              <div className="chef-card">
                <div className="chef-image">{chef.image}</div>
                <h3 className="chef-name">{chef.name}</h3>
                <p className="chef-specialty">{chef.specialty}</p>
                <div className="chef-stats">
                  <span className="chef-rating">⭐ {chef.rating}</span>
                  <span className="chef-orders">{chef.orders}+ orders</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="section-cta">
          <Button onClick={() => navigate('/browse-chefs')}>View All Chefs</Button>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works">
        <h2 className="section-title">How It Works</h2>
        <div className="steps-grid">
          {howItWorks.map((item) => (
            <div key={item.step} className="step-card">
              <div className="step-number">{item.step}</div>
              <div className="step-icon">{item.icon}</div>
              <h3 className="step-title">{item.title}</h3>
              <p className="step-description">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2 className="cta-title">Ready to Start Your Culinary Journey?</h2>
          <p className="cta-subtitle">
            Join thousands of food lovers discovering amazing home-cooked meals
          </p>
          <div className="cta-buttons">
            <Button size="large" onClick={() => navigate('/register')}>
              Get Started
            </Button>
            <Button variant="secondary" size="large" onClick={() => navigate('/become-chef')}>
              I'm a Chef
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
