import React, { useState } from 'react';
import { Key, Sparkles, AlertCircle, Info, ArrowRight } from 'lucide-react';

interface KeyGateProps {
  onKeysSaved: (keys: { geminiKey: string; s2Key: string }) => void;
}

export const KeyGate: React.FC<KeyGateProps> = ({ onKeysSaved }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [s2Key, setS2Key] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geminiKey.trim()) {
      setError('Gemini API Key is required.');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const token = localStorage.getItem('papertok_token');
      const response = await fetch('/api/auth/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          geminiKey: geminiKey.trim(),
          s2Key: s2Key.trim()
        })
      });

      const data = await response.json();
      setIsValidating(false);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save API keys.');
      }

      onKeysSaved({
        geminiKey: geminiKey.trim(),
        s2Key: s2Key.trim()
      });
    } catch (err) {
      setIsValidating(false);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || 'Failed to validate API keys.');
    }
  };

  return (
    <div className="key-gate-container anim-slide-up">
      <div className="key-gate-card glass-panel">
        <div className="brand-logo">
          <div className="logo-icon">
            <Sparkles className="logo-sparkle" />
          </div>
          <h1>PaperTok</h1>
          <p className="subtitle">Swipe through scientific breakthroughs</p>
        </div>

        <form onSubmit={handleSubmit} className="key-form">
          <div className="form-group">
            <label htmlFor="gemini-key">
              <span className="label-text">Gemini API Key</span>
              <span className="required-tag">Required</span>
            </label>
            <div className="input-wrapper">
              <Key className="input-icon" />
              <input
                id="gemini-key"
                type="password"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                disabled={isValidating}
              />
            </div>
            <p className="input-help">
              <Info className="help-icon" />
              Used to summarize papers & power the interactive chat. Get a free key at{' '}
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                Google AI Studio
              </a>.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="s2-key">
              <span className="label-text">Semantic Scholar API Key</span>
              <span className="optional-tag">Optional</span>
            </label>
            <div className="input-wrapper">
              <Key className="input-icon" />
              <input
                id="s2-key"
                type="password"
                placeholder="Optional API Key"
                value={s2Key}
                onChange={(e) => setS2Key(e.target.value)}
                disabled={isValidating}
              />
            </div>
            <p className="input-help">
              <Info className="help-icon" />
              Bypasses public rate limits for paper citation lookups. You can request a free key from Semantic Scholar.
            </p>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle className="error-icon" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="submit-button" disabled={isValidating}>
            {isValidating ? (
              <span className="spinner-loader">Validating Key...</span>
            ) : (
              <>
                <span>Enter PaperTok</span>
                <ArrowRight className="btn-icon" />
              </>
            )}
          </button>
        </form>
      </div>

      <style>{`
        .key-gate-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }

        .key-gate-card {
          width: 100%;
          max-width: 460px;
          border-radius: var(--radius-lg);
          padding: 40px 30px;
          text-align: center;
        }

        .brand-logo {
          margin-bottom: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .logo-icon {
          width: 60px;
          height: 60px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 16px;
          box-shadow: 0 8px 24px rgba(27, 73, 49, 0.15);
        }

        .logo-sparkle {
          width: 30px;
          height: 30px;
          color: white;
          animation: pulse-glow 2s infinite ease-in-out;
        }

        .brand-logo h1 {
          font-size: 2.2rem;
          color: var(--text-primary);
          margin-bottom: 4px;
          font-family: var(--font-display);
        }

        .subtitle {
          color: var(--text-muted);
          font-size: 0.95rem;
          font-family: var(--font-mono);
        }

        .key-form {
          text-align: left;
        }

        .form-group {
          margin-bottom: 24px;
        }

        .form-group label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          font-family: var(--font-mono);
        }

        .label-text {
          color: var(--text-secondary);
        }

        .required-tag {
          font-size: 0.75rem;
          color: var(--color-accent);
          background: var(--color-accent-glow);
          padding: 2px 8px;
          border-radius: 99px;
        }

        .optional-tag {
          font-size: 0.75rem;
          color: var(--text-muted);
          background: rgba(9, 9, 11, 0.05);
          padding: 2px 8px;
          border-radius: 99px;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          width: 18px;
          height: 18px;
          color: var(--text-muted);
        }

        .input-wrapper input {
          width: 100%;
          padding: 14px 14px 14px 44px;
          border-radius: var(--radius-md);
          background: rgba(9, 9, 11, 0.03);
          border: 1px solid var(--border-glass);
          color: var(--text-primary);
          font-size: 0.95rem;
          transition: var(--transition-fast);
          font-family: var(--font-mono);
        }

        .input-wrapper input:focus {
          border-color: var(--color-primary);
          background: rgba(9, 9, 11, 0.05);
          box-shadow: 0 0 0 3px var(--color-primary-glow);
        }

        .input-help {
          margin-top: 8px;
          font-size: 0.8rem;
          color: var(--text-muted);
          line-height: 1.4;
          display: flex;
          align-items: flex-start;
          gap: 6px;
          font-family: var(--font-mono);
        }

        .help-icon {
          width: 14px;
          height: 14px;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .link {
          color: var(--color-primary);
          text-decoration: none;
          transition: var(--transition-fast);
        }

        .link:hover {
          color: var(--color-secondary);
          text-decoration: underline;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--color-error-glow);
          border: 1px solid rgba(190, 18, 60, 0.25);
          color: var(--color-error);
          padding: 12px 16px;
          border-radius: var(--radius-md);
          margin-bottom: 24px;
          font-size: 0.85rem;
          font-family: var(--font-mono);
        }

        .error-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .submit-button {
          width: 100%;
          padding: 14px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          color: var(--text-dark);
          font-weight: 700;
          font-size: 1rem;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(27, 73, 49, 0.12);
          transition: var(--transition-fast);
          font-family: var(--font-display);
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(27, 73, 49, 0.2);
          filter: brightness(1.1);
        }

        .submit-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner-loader {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>
    </div>
  );
};
