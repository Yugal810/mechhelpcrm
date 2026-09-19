import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.js';
import logo from '../assets/MechHelp_Logo.png';
import './Login.css';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const { resetPasswordForEmail } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/update-password`;
      await resetPasswordForEmail(email, redirectUrl);
      setMessage('Password reset link sent! Check your email.');
    } catch (err) {
      setError(err.message || 'Failed to send reset link.');
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
              <h2>Reset Password</h2>
              <p>Enter your email to receive a reset link.</p>
            </div>

            {error && <div className="login-error-alert">{error}</div>}
            {message && <div className="login-error-alert" style={{ backgroundColor: '#dcfce7', color: '#166534', borderLeftColor: '#16a34a' }}>{message}</div>}

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
                />
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              
              <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <Link to="/login" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' }}>
                  &larr; Back to Log In
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
