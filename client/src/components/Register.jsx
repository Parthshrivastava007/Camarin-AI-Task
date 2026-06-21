import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, User, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

const Register = ({ onToggleMode }) => {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setSubmitting(true);

    const result = await register(username, password);
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
      <p className="auth-subtitle">Create a secure account to begin processing images</p>

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
              placeholder="Minimum 3 characters"
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
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Confirm Password</label>
          <div className="form-input-wrapper">
            <CheckCircle2 className="form-icon" size={18} />
            <input
              type="password"
              className="form-input"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <button type="submit" className="auth-btn" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <div className="auth-footer">
        Already have an account?{' '}
        <button className="auth-toggle" onClick={onToggleMode} disabled={submitting}>
          Sign In
        </button>
      </div>
    </div>
  );
};

export default Register;
