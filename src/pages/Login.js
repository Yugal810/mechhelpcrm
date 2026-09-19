import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.js';
import logo from '../assets/MechHelp_Logo.png';
import './Login.css';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card-container">
        
        {/* Left Side: Branding & Info */}
        <div className="login-left-panel">
          <div className="login-logo-container">
            <img src={logo} alt="MechHelp Logo" className="login-brand-logo" />
          </div>
          <div className="login-left-content">
            <div className="quote-container">
              <h2 className="quote-text">
                Drive Your <br />
                <span className="text-highlight">Business Forward.</span>
              </h2>
            </div>
          </div>

          <div className="login-left-footer">
            <h2>Seamlessly manage<br/>your garage operations</h2>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="login-right-panel">
          <div className="login-form-wrapper">
            <div className="login-header">
              <h2>Log In</h2>
              <p>Welcome back! Please enter your details.</p>
            </div>

            {error && (
              <div className="login-error-alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="login-input"
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
                  <Link to="/forgot-password" style={{ fontSize: '0.85rem', color: '#ea580c', textDecoration: 'none', fontWeight: 600 }}>Forgot Password?</Link>
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="login-input"
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
