import React, { useState } from 'react';
import { User, Lock, Sparkles, AlertCircle, ArrowRight, UserPlus, LogIn } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (token: string, username: string) => void;
}

type TabType = 'login' | 'register';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent double submission
    
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (activeTab === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const endpoint = activeTab === 'login' ? '/api/auth/login' : '/api/auth/register';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed. Please try again.');
      }

      // Give browser password manager time to capture credentials before unmounting
      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess(data.token, data.username);
      }, 500);
    } catch (err) {
      setIsLoading(false);
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || 'Network error. Please try again.');
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="login-screen-container anim-slide-up">
      <div className="login-card glass-panel">
        <div className="brand-logo">
          <div className="logo-icon">
            <Sparkles className="logo-sparkle" />
          </div>
          <h1>PaperTok</h1>
          <p className="subtitle">Learn and track your reading journey</p>
        </div>

        {/* Tabs */}
        <div className="tab-container">
          <button
            className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => handleTabChange('login')}
            type="button"
          >
            <LogIn className="tab-icon" />
            <span>Sign In</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => handleTabChange('register')}
            type="button"
          >
            <UserPlus className="tab-icon" />
            <span>Register</span>
          </button>
        </div>

         <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-wrapper">
              <User className="input-icon" />
              <input
                id="username"
                name="username"
                autoComplete="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" />
              <input
                id="password"
                name="password"
                autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {activeTab === 'register' && (
            <div className="form-group anim-fade-in">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {error && (
            <div className="error-message">
              <AlertCircle className="error-icon" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? (
              <span className="spinner-loader">Please wait...</span>
            ) : (
              <>
                <span>{activeTab === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="btn-icon" />
              </>
            )}
          </button>
        </form>
      </div>

      <style>{`
        .login-screen-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
          background: radial-gradient(circle at top right, rgba(27, 73, 49, 0.05), transparent 45%),
                      radial-gradient(circle at bottom left, rgba(72, 46, 29, 0.04), transparent 45%);
        }

        .login-card {
          width: 100%;
          max-width: 440px;
          border-radius: var(--radius-lg);
          padding: 40px 30px;
          text-align: center;
        }

        .brand-logo {
          margin-bottom: 25px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .logo-icon {
          width: 54px;
          height: 54px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 14px;
          box-shadow: 0 8px 20px rgba(27, 73, 49, 0.15);
        }

        .logo-sparkle {
          width: 26px;
          height: 26px;
          color: white;
          animation: pulse-glow 2s infinite ease-in-out;
        }

        .brand-logo h1 {
          font-size: 2.1rem;
          color: var(--text-primary);
          margin-bottom: 4px;
          font-weight: 800;
          letter-spacing: -0.025em;
          font-family: var(--font-display);
        }

        .subtitle {
          color: var(--text-muted);
          font-size: 0.9rem;
          font-family: var(--font-mono);
        }

        .tab-container {
          display: flex;
          background: rgba(9, 9, 11, 0.03);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-md);
          padding: 4px;
          margin-bottom: 28px;
        }

        .tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          border: none;
          background: none;
          color: var(--text-muted);
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          border-radius: calc(var(--radius-md) - 2px);
          transition: var(--transition-fast);
          font-family: var(--font-mono);
        }

        .tab-btn:hover {
          color: var(--text-primary);
        }

        .tab-btn.active {
          background: var(--bg-darkest);
          color: var(--text-primary);
          border: 1px solid var(--border-glass);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
        }

        .tab-icon {
          width: 16px;
          height: 16px;
        }

        .auth-form {
          text-align: left;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-secondary);
          font-family: var(--font-mono);
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          width: 16px;
          height: 16px;
          color: var(--text-muted);
        }

        .input-wrapper input {
          width: 100%;
          padding: 12px 14px 12px 40px;
          border-radius: var(--radius-md);
          background: rgba(9, 9, 11, 0.02);
          border: 1px solid var(--border-glass);
          color: var(--text-primary);
          font-size: 0.92rem;
          transition: var(--transition-fast);
          font-family: var(--font-mono);
        }

        .input-wrapper input:focus {
          border-color: var(--color-primary);
          background: rgba(9, 9, 11, 0.04);
          box-shadow: 0 0 0 3px var(--color-primary-glow);
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--color-error-glow);
          border: 1px solid rgba(190, 18, 60, 0.2);
          color: var(--color-error);
          padding: 12px 16px;
          border-radius: var(--radius-md);
          margin-bottom: 20px;
          font-size: 0.82rem;
          font-family: var(--font-mono);
        }

        .error-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .submit-button {
          width: 100%;
          padding: 13px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          color: var(--text-dark);
          font-weight: 700;
          font-size: 0.95rem;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(27, 73, 49, 0.12);
          transition: var(--transition-fast);
          cursor: pointer;
          border: none;
          font-family: var(--font-display);
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-1.5px);
          box-shadow: 0 6px 16px rgba(27, 73, 49, 0.2);
          filter: brightness(1.08);
        }

        .submit-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .spinner-loader {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .anim-fade-in {
          animation: fadeIn 0.25s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
