import React, { useState } from 'react';
import { Search, Compass, Clock, Sparkles, Settings, ArrowRight, LogOut, CheckCircle } from 'lucide-react';

interface SearchScreenProps {
  onSearch: (query: string) => void;
  onUpdateTopic: (topic: string) => Promise<void>;
  searchHistory: string[];
  onClearHistory: () => void;
  onOpenSettings: () => void;
  username: string;
  onSignOut: () => void;
  currentTopic: string;
  onBackToMap?: () => void;
}

const SUGGESTIONS = [
  'Transformer Neural Networks',
  'CRISPR-Cas9 Gene Editing',
  'Quantum Computing & Algorithms',
  'Graph Neural Networks',
  'Nuclear Fusion Energy',
  'Perovskite Solar Cells'
];

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onSearch,
  onUpdateTopic,
  searchHistory,
  onClearHistory,
  onOpenSettings,
  username,
  onSignOut,
  currentTopic,
  onBackToMap
}) => {
  const [query, setQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleInitialSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleUpdateTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsUpdating(true);
    setSuccessMessage('');
    try {
      await onUpdateTopic(query.trim());
      setSuccessMessage(`Research focus updated to "${query.trim()}"! Your tomorrow's digest will be generated based on this new topic.`);
      setQuery('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const isNewUser = !currentTopic;

  return (
    <div className="search-container anim-slide-up">
      {/* Top Navbar */}
      <header className="search-header">
        <div className="logo-compact">
          <div className="logo-icon-small">
            <Sparkles className="logo-sparkle-small" />
          </div>
          <span className="brand-name">PaperTok</span>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span className="user-greeting">Hi, {username}</span>
          <button type="button" className="settings-btn glass-panel" onClick={onOpenSettings} title="Settings">
            <Settings className="settings-icon" />
          </button>
          <button type="button" className="signout-btn glass-panel" onClick={onSignOut} title="Sign Out">
            <LogOut className="signout-icon" />
          </button>
        </div>
      </header>

      {/* Hero / Main Area */}
      <main className="search-main">
        {isNewUser ? (
          /* ── NEW USER FLOW: First Setup ── */
          <>
            <div className="search-hero">
              <h1 className="hero-title">
                Uncover the <span className="gradient-text">Foundations</span>
              </h1>
              <p className="hero-desc">
                Enter a research field or interest, and we'll extract the 5 landmark papers that defined it.
              </p>
            </div>

            <form onSubmit={handleInitialSearchSubmit} className="search-form">
              <div className="search-input-wrapper glass-panel">
                <Search className="search-bar-icon" />
                <textarea
                  placeholder="Explain your research interest or paste your abstract/draft..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (query.trim()) {
                        onSearch(query.trim());
                      }
                    }
                  }}
                  rows={3}
                />
                <button type="submit" className="search-submit" disabled={!query.trim()}>
                  <ArrowRight className="search-arrow" />
                </button>
              </div>
            </form>
          </>
        ) : (
          /* ── RETURNING USER FLOW: Simplified Edit ── */
          <>
            <div className="search-hero returning">
              <h1 className="hero-title">Your Research Focus</h1>
              <p className="hero-desc">
                Keep learning about your current interest, or change it below to guide your tomorrow's paper feed.
              </p>
            </div>

            {/* Current Topic Display Card */}
            <div className="current-interest-card glass-panel">
              <div className="current-interest-header">
                <span className="current-interest-label">CURRENT INTEREST</span>
                <span className="active-badge">Active</span>
              </div>
              <h2 className="current-interest-value">{currentTopic}</h2>
              {onBackToMap && (
                <button 
                  type="button" 
                  className="view-map-btn" 
                  onClick={onBackToMap}
                >
                  📖 View Current Reading Map
                </button>
              )}
            </div>

            {/* Update Form */}
            <form onSubmit={handleUpdateTopicSubmit} className="search-form">
              <div className="form-group-label">Change Research Focus</div>
              <div className="search-input-wrapper glass-panel">
                <Search className="search-bar-icon" />
                <textarea
                  placeholder="Describe a new research topic or paste your draft..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (query.trim()) {
                        handleUpdateTopicSubmit(e);
                      }
                    }
                  }}
                  rows={2}
                />
                <button type="submit" className="search-submit" disabled={!query.trim() || isUpdating}>
                  <ArrowRight className="search-arrow" />
                </button>
              </div>
              
              <div className="form-notice">
                <span>✏️ Changes will apply to tomorrow's paper digest. New papers for the updated topic will unlock tomorrow at 7:00 AM.</span>
              </div>
            </form>

            {/* Success Toast */}
            {successMessage && (
              <div className="success-banner glass-panel anim-slide-up">
                <CheckCircle size={20} className="success-icon" />
                <p className="success-text">{successMessage}</p>
              </div>
            )}
          </>
        )}

        {/* Suggestions (always visible) */}
        <section className="search-suggestions-sec">
          <h3 className="section-title">
            <Compass className="sec-icon" />
            <span>Popular Topics</span>
          </h3>
          <div className="suggestions-grid">
            {SUGGESTIONS.map((topic, idx) => (
              <button
                key={idx}
                type="button"
                className="suggestion-tag glass-panel"
                onClick={() => onSearch(topic)}
              >
                <span>{topic}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Search History (always visible if history exists) */}
        {searchHistory && searchHistory.length > 0 && (
          <section className="search-history-sec">
            <div className="history-header">
              <h3 className="section-title">
                <Clock className="sec-icon" />
                <span>Recent Searches</span>
              </h3>
              <button type="button" className="clear-history-btn" onClick={onClearHistory}>
                Clear
              </button>
            </div>
            <div className="history-list">
              {searchHistory.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="history-item glass-panel"
                  onClick={() => onSearch(item)}
                >
                  <Clock className="history-item-icon" />
                  <span className="history-text">{item}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <style>{`
        .search-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          max-width: var(--max-width-feed);
          margin: 0 auto;
          padding: 20px;
        }

        .search-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
          padding-top: 10px;
        }

        .logo-compact {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-icon-small {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .logo-sparkle-small {
          width: 16px;
          height: 16px;
          color: white;
        }

        .brand-name {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1.25rem;
          color: var(--text-primary);
        }

        .settings-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          transition: var(--transition-fast);
        }

        .settings-btn:hover {
          background: var(--bg-glass-hover);
          transform: rotate(45deg);
        }

        .settings-icon {
          width: 18px;
          height: 18px;
          color: var(--text-secondary);
        }

        .streak-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 99px;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--color-warning);
          border-color: rgba(133, 77, 14, 0.2);
          background: var(--color-warning-glow);
          font-family: var(--font-mono);
        }

        .streak-icon {
          width: 14px;
          height: 14px;
          fill: var(--color-warning);
          filter: drop-shadow(0 0 4px rgba(133, 77, 14, 0.3));
          animation: pulse-glow 1.5s infinite alternate ease-in-out;
        }

        .user-greeting {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 500;
          margin-right: 4px;
          font-family: var(--font-mono);
        }

        @media (max-width: 480px) {
          .user-greeting {
            display: none;
          }
        }

        .signout-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          transition: var(--transition-fast);
        }

        .signout-btn:hover {
          background: rgba(244, 63, 94, 0.1);
          border-color: rgba(244, 63, 94, 0.3);
        }

        .signout-btn:hover .signout-icon {
          color: var(--color-error);
        }

        .signout-icon {
          width: 16px;
          height: 16px;
          color: var(--text-secondary);
          transition: var(--transition-fast);
        }

        .search-main {
          display: flex;
          flex-direction: column;
          gap: 24px;
          flex-grow: 1;
        }

        .search-hero {
          text-align: center;
          margin-bottom: 12px;
        }

        .search-hero.returning {
          text-align: left;
        }

        .hero-title {
          font-size: 2.2rem;
          font-weight: 800;
          line-height: 1.15;
          margin-bottom: 12px;
          font-family: var(--font-display);
        }

        .gradient-text {
          background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-desc {
          font-size: 0.95rem;
          color: var(--text-muted);
          max-width: 400px;
          margin: 0 auto;
          line-height: 1.5;
        }

        .search-hero.returning .hero-desc {
          margin: 0;
        }

        .current-interest-card {
          padding: 20px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-glass-bright);
          background: rgba(27, 73, 49, 0.05);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .view-map-btn {
          margin-top: 12px;
          width: 100%;
          padding: 12px;
          border-radius: var(--radius-md);
          background: var(--color-primary);
          color: var(--text-dark);
          font-weight: 700;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: var(--transition-fast);
          box-shadow: 0 4px 12px rgba(27, 73, 49, 0.1);
          cursor: pointer;
        }

        .view-map-btn:hover {
          background: var(--color-secondary);
          transform: translateY(-1px);
        }

        .current-interest-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .current-interest-label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--color-primary);
          font-family: var(--font-mono);
        }

        .active-badge {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
          background: var(--color-secondary-glow);
          color: var(--color-secondary);
          border: 1px solid rgba(22, 163, 74, 0.2);
        }

        .current-interest-value {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text-primary);
          font-family: var(--font-display);
        }

        .form-group-label {
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 10px;
          font-family: var(--font-mono);
        }

        .search-form {
          width: 100%;
        }

        .search-input-wrapper {
          display: flex;
          align-items: flex-start;
          padding: 12px 12px 12px 18px;
          border-radius: var(--radius-lg);
          transition: var(--transition-fast);
          gap: 6px;
        }

        .search-input-wrapper:focus-within {
          border-color: var(--color-primary);
          box-shadow: 0 0 20px rgba(27, 73, 49, 0.08);
        }

        .search-bar-icon {
          width: 20px;
          height: 20px;
          color: var(--text-muted);
          flex-shrink: 0;
          margin-top: 12px;
        }

        .search-input-wrapper textarea {
          width: 100%;
          border: none;
          background: transparent;
          color: var(--text-primary);
          padding: 10px;
          font-size: 0.95rem;
          line-height: 1.5;
          resize: none;
          height: 64px;
          font-family: var(--font-sans);
        }

        .search-input-wrapper textarea::placeholder {
          color: var(--text-muted);
        }

        .search-submit {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: var(--color-primary);
          display: flex;
          justify-content: center;
          align-items: center;
          color: var(--text-dark);
          transition: var(--transition-fast);
          flex-shrink: 0;
          align-self: flex-end;
        }

        .search-submit:hover:not(:disabled) {
          background: var(--color-secondary);
          transform: translateX(2px);
        }

        .search-submit:disabled {
          background: rgba(9, 9, 11, 0.05);
          color: var(--text-muted);
          cursor: not-allowed;
        }

        .search-arrow {
          width: 20px;
          height: 20px;
        }

        .form-notice {
          margin-top: 8px;
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.4;
        }

        .success-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-radius: var(--radius-md);
          background: var(--color-secondary-glow);
          border: 1px solid rgba(22, 163, 74, 0.2);
          margin-top: 10px;
        }

        .success-icon {
          color: var(--color-secondary);
          flex-shrink: 0;
        }

        .success-text {
          margin: 0;
          font-size: 0.85rem;
          color: var(--text-primary);
          line-height: 1.4;
        }

        .search-suggestions-sec {
          margin-top: 20px;
        }

        .section-title {
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          font-family: var(--font-mono);
        }

        .sec-icon {
          width: 16px;
          height: 16px;
        }

        .suggestions-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .suggestion-tag {
          padding: 10px 18px;
          border-radius: var(--radius-md);
          font-size: 0.88rem;
          color: var(--text-secondary);
          transition: var(--transition-fast);
          font-family: var(--font-mono);
        }

        .suggestion-tag:hover {
          background: var(--bg-glass-hover);
          border-color: var(--color-primary);
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        .search-history-sec {
          margin-top: 10px;
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .clear-history-btn {
          font-size: 0.8rem;
          color: var(--color-error);
          opacity: 0.8;
          transition: var(--transition-fast);
          font-family: var(--font-mono);
        }

        .clear-history-btn:hover {
          opacity: 1;
          text-decoration: underline;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .history-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 18px;
          border-radius: var(--radius-md);
          text-align: left;
          font-size: 0.9rem;
          color: var(--text-secondary);
          transition: var(--transition-fast);
          font-family: var(--font-mono);
        }

        .history-item:hover {
          background: var(--bg-glass-hover);
          border-color: var(--border-glass-bright);
          color: var(--text-primary);
        }

        .history-item-icon {
          width: 14px;
          height: 14px;
          color: var(--text-muted);
        }

        .history-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
};
