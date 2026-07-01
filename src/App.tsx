import { useState, useEffect } from 'react';
import { KeyGate } from './components/KeyGate';
import { SearchScreen } from './components/SearchScreen';
import { Settings } from './components/Settings';
import { DigestMap } from './components/DigestMap';
import { LoginScreen } from './components/LoginScreen';
import { type FoundationalPaper, generateFoundationalPapers } from './services/gemini';
import { AlertCircle } from 'lucide-react';

type Screen = 'login' | 'key-gate' | 'search' | 'map';

function App() {
  const [token, setToken] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [streak, setStreak] = useState<number>(0);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [s2ApiKey, setS2ApiKey] = useState<string>('');
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [activeTopic, setActiveTopic] = useState<string>('');
  const [papers, setPapers] = useState<FoundationalPaper[]>([]);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [debugDayOffset, setDebugDayOffset] = useState<number>(0);

  const handleSignOut = () => {
    localStorage.removeItem('papertok_token');
    localStorage.removeItem('papertok_username');
    setToken('');
    setUsername('');
    setGeminiApiKey('');
    setS2ApiKey('');
    setStreak(0);
    setCurrentScreen('login');
  };

  const refreshStreak = async (savedToken: string) => {
    try {
      const res = await fetch('/api/progress', {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });
      if (res.ok) {
        const progressData = await res.json();
        setStreak(progressData.streak?.currentStreak || 0);
      }
    } catch (err) {
      console.error('Failed to refresh streak:', err);
    }
  };

  // Load configuration and history on startup
  useEffect(() => {
    const savedToken = localStorage.getItem('papertok_token') || '';
    const savedUsername = localStorage.getItem('papertok_username') || '';
    const savedHistory = localStorage.getItem('papertok_history');

    if (savedHistory) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSearchHistory(JSON.parse(savedHistory));
      } catch (err) {
        console.error('Failed to parse history:', err);
      }
    }

    if (!savedToken) {
      setCurrentScreen('login');
      return;
    }

    setToken(savedToken);
    setUsername(savedUsername);

    const fetchUserData = async () => {
      try {
        const keysRes = await fetch('/api/auth/keys', {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        });
        if (!keysRes.ok) {
          throw new Error('Session expired or invalid.');
        }
        const keysData = await keysRes.json();
        setGeminiApiKey(keysData.geminiKey || '');
        setS2ApiKey(keysData.s2Key || '');

        await refreshStreak(savedToken);

        if (!keysData.geminiKey && !keysData.hasSystemKey) {
          setCurrentScreen('key-gate');
        } else {
          const cachedTopic = localStorage.getItem('papertok_cached_topic') || '';
          const cachedPapersStr = localStorage.getItem('papertok_cached_papers') || '';
          const historyList = savedHistory ? JSON.parse(savedHistory) : [];
          const fallbackTopic = Array.isArray(historyList) && historyList[0] ? historyList[0] : '';
          const activeTopicToLoad = cachedTopic || fallbackTopic;

          if (activeTopicToLoad) {
            if (cachedPapersStr && activeTopicToLoad === cachedTopic) {
              try {
                const cachedPapers = JSON.parse(cachedPapersStr);
                setActiveTopic(activeTopicToLoad);
                setPapers(cachedPapers);
                setCurrentScreen('map');
                return;
              } catch (e) {
                console.error('Failed to parse cached papers:', e);
              }
            }
            setActiveTopic(activeTopicToLoad);
            handleSearch(activeTopicToLoad);
            return;
          }
          setCurrentScreen('search');
        }
      } catch (err) {
        console.error('Session validation failed on mount:', err);
        handleSignOut();
      }
    };

    fetchUserData();
  }, []);

  const handleLoginSuccess = async (newToken: string, newUsername: string) => {
    localStorage.setItem('papertok_token', newToken);
    localStorage.setItem('papertok_username', newUsername);
    setToken(newToken);
    setUsername(newUsername);

    try {
      const keysRes = await fetch('/api/auth/keys', {
        headers: { 'Authorization': `Bearer ${newToken}` }
      });
      const keysData = await keysRes.json();
      setGeminiApiKey(keysData.geminiKey || '');
      setS2ApiKey(keysData.s2Key || '');

      await refreshStreak(newToken);

      if (!keysData.geminiKey && !keysData.hasSystemKey) {
        setCurrentScreen('key-gate');
      } else {
        const cachedTopic = localStorage.getItem('papertok_cached_topic') || '';
        const cachedPapersStr = localStorage.getItem('papertok_cached_papers') || '';
        const savedHistoryStr = localStorage.getItem('papertok_history');
        const historyList = savedHistoryStr ? JSON.parse(savedHistoryStr) : [];
        const fallbackTopic = Array.isArray(historyList) && historyList[0] ? historyList[0] : '';
        const activeTopicToLoad = cachedTopic || fallbackTopic;

        if (activeTopicToLoad) {
          if (cachedPapersStr && activeTopicToLoad === cachedTopic) {
            try {
              const cachedPapers = JSON.parse(cachedPapersStr);
              setActiveTopic(activeTopicToLoad);
              setPapers(cachedPapers);
              setCurrentScreen('map');
              return;
            } catch (e) {
              console.error('Failed to parse cached papers:', e);
            }
          }
          setActiveTopic(activeTopicToLoad);
          handleSearch(activeTopicToLoad);
          return;
        }
        setCurrentScreen('search');
      }
    } catch (err) {
      console.error('Failed to fetch keys on login success:', err);
      setCurrentScreen('key-gate');
    }
  };

  const handleKeysSaved = (keys: { geminiKey: string; s2Key: string }) => {
    setGeminiApiKey(keys.geminiKey);
    setS2ApiKey(keys.s2Key);
    setCurrentScreen('search');
  };

  const handleSearch = async (query: string, bypassCache = false, dayOffset = 0) => {
    if (!query || query.trim() === '') return;
    
    // If selecting the currently active topic and we already have papers, just return to the map instantly
    if (activeTopic.toLowerCase() === query.trim().toLowerCase() && papers.length > 0 && dayOffset === 0 && !bypassCache) {
      setCurrentScreen('map');
      return;
    }

    // 1. Update history
    const historyList = Array.isArray(searchHistory) ? searchHistory : [];
    const filteredHistory = historyList.filter((item) => item && typeof item === 'string' && item.toLowerCase() !== query.toLowerCase());
    const newHistory = [query, ...filteredHistory].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('papertok_history', JSON.stringify(newHistory));

    // 2. Set active state
    setActiveTopic(query);
    setError(null);

    // Resolve the progression offset based on completed digests in history
    let targetOffset = dayOffset;
    try {
      const token = localStorage.getItem('papertok_token');
      const res = await fetch('/api/progress', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const readList = data.readPapers || [];
        const papersForThisTopic = readList.filter((r: any) => r.topic.toLowerCase() === query.toLowerCase());
        targetOffset = Math.floor(papersForThisTopic.length / 5);
      }
    } catch (err) {
      console.error('Failed to pre-fetch progress for day offset calculation:', err);
    }
    setDebugDayOffset(targetOffset);

    // Check if the SQLite database has this day offset already generated in its history (instant load)
    if (!bypassCache) {
      try {
        const token = localStorage.getItem('papertok_token');
        const historyRes = await fetch(`/api/digest/history?topic=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          const historyList = historyData.history || [];
          if (historyList[targetOffset]) {
            const targetPapers = historyList[targetOffset].papers;
            localStorage.setItem('papertok_cached_topic', query);
            localStorage.setItem('papertok_cached_papers', JSON.stringify(targetPapers));
            setPapers(targetPapers);
            setCurrentScreen('map');
            return; // cache hit from database!
          }
        }
      } catch (err) {
        console.error('Failed to check database history cache:', err);
      }
    }

    // Check if we have cached results for this query in local storage (case-insensitive) - only on day 0
    const cachedTopic = localStorage.getItem('papertok_cached_topic');
    const cachedPapersStr = localStorage.getItem('papertok_cached_papers');

    if (!bypassCache && targetOffset === 0 && cachedTopic && cachedPapersStr && cachedTopic.toLowerCase() === query.toLowerCase()) {
      try {
        const cachedPapers = JSON.parse(cachedPapersStr);
        setPapers(cachedPapers);
        setCurrentScreen('map');
        return; // loaded from local storage cache!
      } catch {
        console.error('Failed to parse cached papers, calling API...');
      }
    }

    // If cache missed, clear papers, show map screen with loading spinner, and fetch from API
    setPapers([]);
    setCurrentScreen('map');

    // 3. Request papers from Gemini
    try {
      setLoadingProgress(0);
      setLoadingStatus('Connecting to Gemini AI...');
      const generatedPapers = await generateFoundationalPapers(
        query,
        geminiApiKey,
        (progress, statusText) => {
          setLoadingProgress(progress);
          setLoadingStatus(statusText);
        },
        bypassCache,
        targetOffset
      );
      // Save cache - only on day 0
      if (targetOffset === 0) {
        localStorage.setItem('papertok_cached_topic', query);
        localStorage.setItem('papertok_cached_papers', JSON.stringify(generatedPapers));
      }
      setPapers(generatedPapers);
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || 'Failed to generate literature papers. Please verify your Gemini API key or search term and try again.');
    }
  };

  const handleUpdateTopic = async (newTopic: string) => {
    const historyList = Array.isArray(searchHistory) ? searchHistory : [];
    const filteredHistory = historyList.filter((item) => item && typeof item === 'string' && item.toLowerCase() !== newTopic.toLowerCase());
    const newHistory = [newTopic, ...filteredHistory].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('papertok_history', JSON.stringify(newHistory));
    
    setActiveTopic(newTopic);
    localStorage.setItem('papertok_cached_topic', newTopic);

    if (token) {
      try {
        await fetch('/api/progress/enqueue', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ topic: newTopic })
        });
        console.log(`[App] Successfully enqueued background generation for "${newTopic}"`);
      } catch (e) {
        console.error('Failed to enqueue new digest:', e);
      }
    }
  };

  const handleClearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('papertok_history');
  };

  const handleBackToSearch = () => {
    setCurrentScreen('search');
    setError(null);
    if (token) {
      refreshStreak(token);
    }
  };

  return (
    <div className="app-container">
      {/* Dynamic Screen Routing */}
      {currentScreen === 'login' && (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}

      {currentScreen === 'key-gate' && (
        <KeyGate onKeysSaved={handleKeysSaved} />
      )}

      {currentScreen === 'search' && (
        <SearchScreen
          onSearch={handleSearch}
          onUpdateTopic={handleUpdateTopic}
          searchHistory={searchHistory}
          onClearHistory={handleClearHistory}
          onOpenSettings={() => setShowSettings(true)}
          username={username}
          onSignOut={handleSignOut}
          currentTopic={activeTopic}
          onBackToMap={() => setCurrentScreen('map')}
        />
      )}

      {currentScreen === 'map' && (
        <>
          {error ? (
            <div className="error-screen-container anim-slide-up">
              <div className="error-card glass-panel">
                <AlertCircle className="error-card-icon" />
                <h3>Search Failed</h3>
                <p>{error}</p>
                <div className="error-actions">
                  <button className="error-btn-secondary" onClick={handleBackToSearch}>
                    Back to Search
                  </button>
                  <button className="error-btn-primary" onClick={() => handleSearch(activeTopic)}>
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <DigestMap
              topic={activeTopic}
              papers={papers}
              s2ApiKey={s2ApiKey}
              geminiApiKey={geminiApiKey}
              onBack={handleBackToSearch}
              loadingProgress={loadingProgress}
              loadingStatus={loadingStatus}
              streak={streak}
              onOpenSettings={() => setShowSettings(true)}
              onSignOut={handleSignOut}
              onStreakUpdated={setStreak}
              debugDayOffset={debugDayOffset}
              onAdvanceDay={async () => {
                const nextOffset = debugDayOffset + 1;
                setDebugDayOffset(nextOffset);
                localStorage.removeItem('papertok_cached_papers'); // clear local client cache
                await handleSearch(activeTopic, true, nextOffset); // request fresh papers bypassCache=true
              }}
            />
          )}
        </>
      )}

      {/* Global Settings Modal */}
      {showSettings && (
        <Settings
          currentS2Key={s2ApiKey}
          onClose={() => setShowSettings(false)}
          onSave={handleKeysSaved}
        />
      )}

      <style>{`
        .app-container {
          min-height: 100vh;
          width: 100%;
        }

        .error-screen-container {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }

        .error-card {
          width: 100%;
          max-width: 440px;
          padding: 40px 30px;
          border-radius: var(--radius-lg);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          border-color: rgba(244, 63, 94, 0.2);
          box-shadow: 0 8px 32px rgba(244, 63, 94, 0.1);
        }

        .error-card-icon {
          width: 48px;
          height: 48px;
          color: var(--color-error);
        }

        .error-card h3 {
          font-size: 1.5rem;
          color: var(--text-primary);
        }

        .error-card p {
          color: var(--text-secondary);
          font-size: 0.92rem;
          line-height: 1.5;
        }

        .error-actions {
          display: flex;
          gap: 12px;
          width: 100%;
          margin-top: 10px;
        }

        .error-btn-primary {
          flex: 1;
          padding: 12px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          color: white;
          font-weight: 600;
          font-size: 0.9rem;
          transition: var(--transition-fast);
        }

        .error-btn-primary:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }

        .error-btn-secondary {
          flex: 1;
          padding: 12px;
          border-radius: var(--radius-md);
          background: rgba(9, 9, 11, 0.03);
          border: 1px solid var(--border-glass);
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.9rem;
          transition: var(--transition-fast);
        }

        .error-btn-secondary:hover {
          background: rgba(9, 9, 11, 0.06);
          border-color: var(--border-glass-bright);
        }
      `}</style>
    </div>
  );
}

export default App;
