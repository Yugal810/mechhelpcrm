import React, { useState } from 'react';
import { useAuth } from '../store/AuthContext.js';

export const Settings = () => {
  const { user, updateUserData } = useAuth();
  
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    
    try {
      const updates = {};
      if (email !== user?.email) updates.email = email;
      
      if (password) {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        updates.password = password;
      }
      
      if (Object.keys(updates).length === 0) {
        setMessage("No changes to save.");
        setLoading(false);
        return;
      }
      
      await updateUserData(updates);
      
      setMessage("Profile updated successfully!");
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Account Settings</h1>
          <p style={{ color: '#6b7280' }}>Update your email and password</p>
        </div>
      </div>
      
      <div className="surface-panel" style={{ padding: '2rem', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {error && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>{error}</div>}
        {message && <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>{message}</div>}
        
        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
              required
            />
          </div>
          
          <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '10px 0' }} />
          
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', fontWeight: '600' }}>Change Password</h3>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '16px' }}>Leave blank if you don't want to change it.</p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>New Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                placeholder="••••••••"
                minLength="6"
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                placeholder="••••••••"
                minLength="6"
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button 
              type="submit" 
              disabled={loading}
              style={{ backgroundColor: '#ea580c', color: 'white', padding: '10px 24px', borderRadius: '6px', border: 'none', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
