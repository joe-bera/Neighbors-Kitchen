import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            {/* Placeholder routes - will be implemented */}
            <Route path="/browse-chefs" element={<ComingSoon page="Browse Chefs" />} />
            <Route path="/how-it-works" element={<ComingSoon page="How It Works" />} />
            <Route path="/become-chef" element={<ComingSoon page="Become a Chef" />} />
            <Route path="/login" element={<ComingSoon page="Login" />} />
            <Route path="/register" element={<ComingSoon page="Sign Up" />} />
            <Route path="/chef/:id" element={<ComingSoon page="Chef Profile" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

// Temporary placeholder component
const ComingSoon = ({ page }: { page: string }) => {
  return (
    <div style={{
      textAlign: 'center',
      padding: '4rem 2rem',
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚧</h1>
      <h2 style={{ color: '#2d3748', marginBottom: '0.5rem' }}>{page}</h2>
      <p style={{ color: '#718096' }}>This page is coming soon!</p>
    </div>
  );
};

const NotFound = () => {
  return (
    <div style={{
      textAlign: 'center',
      padding: '4rem 2rem',
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <h1 style={{ fontSize: '5rem', marginBottom: '1rem' }}>404</h1>
      <h2 style={{ color: '#2d3748', marginBottom: '0.5rem' }}>Page Not Found</h2>
      <p style={{ color: '#718096' }}>The page you're looking for doesn't exist.</p>
    </div>
  );
};

export default App;
