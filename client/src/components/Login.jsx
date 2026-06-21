import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, User, AlertCircle, Sparkles } from 'lucide-react';

const Login = ({ onToggleMode }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setSubmitting(true);

    const result = await login(username, password);
    if (!result.success) {
      setError(result.error);
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card glass-card fade-in">
      <div className="auth-logo">
        <Sparkles className="form-icon" style={{ position: 'static', color: 'var(--primary)' }} />
        <span>AuraMedia</span>
      </div>
      <p className="auth-subtitle">Log in to process and enrich your media files</p>

      {error && (
        <div className="alert-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Username</label>
          <div className="form-input-wrapper">
            <User className="form-icon" size={18} />
            <input
              type="text"
              className="form-input"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <div className="form-input-wrapper">
            <KeyRound className="form-icon" size={18} />
            <input
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <button type="submit" className="auth-btn" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Sign In'}
        </button>
      </form>

      <div className="auth-footer">
        Don't have an account?{' '}
        <button className="auth-toggle" onClick={onToggleMode} disabled={submitting}>
          Sign Up
        </button>
      </div>
    </div>
  );
};

export default Login;
