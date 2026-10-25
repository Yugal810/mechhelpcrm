import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import logoImg from '../components/vehicleSpecs/MechHelp_Logo.png';
import { Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const { user, login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // If already logged in, redirect away from login
  useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await login(email, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('Invalid email or password. Please verify your credentials.');
        } else {
          setErrorMsg(error.message || 'An error occurred during sign in.');
        }
      } else {
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate with Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotMsg(null);

    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }

    try {
      setForgotLoading(true);
      const { error } = await resetPassword(forgotEmail);
      if (error) {
        setForgotError(error.message || 'Failed to send reset link.');
      } else {
        setForgotMsg('Password reset link sent! Check your inbox.');
      }
    } catch (err: any) {
      setForgotError(err.message || 'Error requesting password reset.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-canvas">
      <div className="login-card-container animate-fade-in">
        {/* Left Column - Brand & Hero */}
        <div className="login-left-panel">
          <div className="login-brand-header">
            <img src={logoImg} alt="MechHelp Logo" className="login-brand-logo" />
          </div>

          <div className="login-hero-headline-wrapper">
            <h1 className="login-hero-headline">
              Drive Your<br />
              <span className="login-hero-highlight">Business</span><br />
              <span className="login-hero-highlight">Forward.</span>
            </h1>
          </div>

          <div className="login-hero-footer">
            <p className="login-hero-tagline">
              Seamlessly manage<br />
              your garage operations
            </p>
          </div>
        </div>

        {/* Right Column - Login Form */}
        <div className="login-right-panel">
          {!showForgotModal ? (
            <div className="login-form-box">
              <div className="login-form-header">
                <h2 className="login-form-title">Log In</h2>
                <p className="login-form-subtitle">Welcome back! Please enter your details.</p>
              </div>

              {errorMsg && (
                <div className="login-alert login-alert-error" role="alert">
                  <AlertCircle size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="login-alert login-alert-success" role="alert">
                  <CheckCircle2 size={15} />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="login-inputs-form" noValidate>
                {/* Email Field */}
                <div className="login-field-group">
                  <label className="login-field-label" htmlFor="login-email">
                    EMAIL
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    className="login-field-input"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                {/* Password Field */}
                <div className="login-field-group">
                  <div className="login-field-label-row">
                    <label className="login-field-label" htmlFor="login-password">
                      PASSWORD
                    </label>
                    <button
                      type="button"
                      className="login-forgot-link"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotError(null);
                        setForgotMsg(null);
                        setShowForgotModal(true);
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="login-password-input-wrapper">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      className="login-field-input login-password-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="login-password-toggle-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  className="login-submit-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            </div>
          ) : (
            /* Forgot Password Sub-View */
            <div className="login-form-box">
              <button
                type="button"
                className="login-back-button"
                onClick={() => setShowForgotModal(false)}
              >
                <ArrowLeft size={16} />
                <span>Back to sign in</span>
              </button>

              <div className="login-form-header" style={{ marginTop: '1rem' }}>
                <h2 className="login-form-title">Reset Password</h2>
                <p className="login-form-subtitle">Enter your email and we'll send you a link to reset your password.</p>
              </div>

              {forgotError && (
                <div className="login-alert login-alert-error" role="alert">
                  <AlertCircle size={15} />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotMsg && (
                <div className="login-alert login-alert-success" role="alert">
                  <CheckCircle2 size={15} />
                  <span>{forgotMsg}</span>
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="login-inputs-form">
                <div className="login-field-group">
                  <label className="login-field-label" htmlFor="forgot-email">
                    EMAIL
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    className="login-field-input"
                    placeholder="Enter your email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    disabled={forgotLoading}
                  />
                </div>

                <button
                  type="submit"
                  className="login-submit-button"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? 'Sending link...' : 'Send Reset Link'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
