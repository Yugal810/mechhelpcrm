import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import logo from '../assets/MechHelp_Logo.png';
import './Login.css';

export const UpdatePassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for the password recovery event
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setMessage('You can now update your password.');
        }
      }
    );
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      if (error) throw error;
      
      setMessage('Password updated successfully! Redirecting...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to update password.');
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
              <h2>Set New Password</h2>
              <p>Please enter your new password below.</p>
            </div>

            {error && <div className="login-error-alert">{error}</div>}
            {message && <div className="login-error-alert" style={{ backgroundColor: '#dcfce7', color: '#166534', borderLeftColor: '#16a34a' }}>{message}</div>}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="login-input"
                  minLength="6"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="login-input"
                  minLength="6"
                />
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
