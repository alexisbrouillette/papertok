import React, { useState, useEffect } from 'react';
import { X, Key, Info, Check, Save, Bell } from 'lucide-react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface SettingsProps {
  currentS2Key: string;
  onClose: () => void;
  onSave: (keys: { geminiKey: string; s2Key: string }) => void;
  onLaunchTestViz?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  currentS2Key,
  onClose,
  onSave,
  onLaunchTestViz
}) => {
  const [s2Key, setS2Key] = useState(currentS2Key);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }).catch(err => console.error('Error checking push subscription:', err));
    }
  }, []);

  const handleSendTestNotification = async () => {
    setIsTestingPush(true);
    setPushStatusMessage(null);
    setError(null);
    const token = localStorage.getItem('papertok_token');

    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send test notification.');
      }
      setPushStatusMessage('Test notification dispatched! Check your device.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsTestingPush(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Push notifications are not supported in this browser.');
      return;
    }

    setIsSubscribing(true);
    setPushStatusMessage(null);
    setError(null);
    const token = localStorage.getItem('papertok_token');

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      if (isSubscribed) {
        // Unsubscribe
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ subscription })
          });
        }
        setIsSubscribed(false);
        setPushStatusMessage('Notifications disabled successfully.');
      } else {
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Notification permission denied by user.');
        }

        // Get VAPID public key from backend
        const keyRes = await fetch('/api/push/vapid-key', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!keyRes.ok) throw new Error('Failed to fetch VAPID key from server.');
        const { publicKey } = await keyRes.json();

        const convertedKey = urlBase64ToUint8Array(publicKey);

        const newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });

        // Send to backend
        const subRes = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ subscription: newSubscription })
        });

        if (!subRes.ok) {
          const subData = await subRes.json();
          throw new Error(subData.error || 'Failed to register subscription on server.');
        }

        setIsSubscribed(true);
        setPushStatusMessage('Notifications enabled successfully!');
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem('papertok_token');
      const response = await fetch('/api/auth/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          geminiKey: '',
          s2Key: s2Key.trim()
        })
      });

      const data = await response.json();
      setIsSaving(false);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save API keys.');
      }

      onSave({
        geminiKey: '',
        s2Key: s2Key.trim()
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      setIsSaving(false);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || 'Failed to save API keys.');
    }
  };

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-modal glass-panel anim-slide-up" onClick={(e) => e.stopPropagation()}>
        <header className="settings-modal-header">
          <h2>Configuration</h2>
          <button className="close-btn" onClick={onClose}>
            <X />
          </button>
        </header>

        <form onSubmit={handleSave} className="settings-form">

          <div className="form-group">
            <label htmlFor="settings-s2-key">Semantic Scholar API Key</label>
            <div className="input-wrapper">
              <Key className="input-icon" />
              <input
                id="settings-s2-key"
                type="password"
                placeholder="Semantic Scholar API Key (optional)"
                value={s2Key}
                onChange={(e) => setS2Key(e.target.value)}
              />
            </div>
            <p className="input-help">
              <Info className="help-icon" />
              For higher rate limits when searching scientific publication databases.
            </p>
          </div>

          <div className="form-group">
            <label>Push Alerts</label>
            <button
              type="button"
              className={`notification-btn ${isSubscribed ? 'active' : ''}`}
              onClick={handleToggleNotifications}
              disabled={isSubscribing}
            >
              <Bell className="btn-icon" />
              <span>
                {isSubscribing
                  ? 'Configuring Alerts...'
                  : isSubscribed
                  ? 'Mute Daily Notifications'
                  : 'Enable Daily Notifications'}
              </span>
            </button>
            
            {isSubscribed && (
              <button
                type="button"
                className="notification-test-btn"
                onClick={handleSendTestNotification}
                disabled={isTestingPush || isSubscribing}
              >
                <span>{isTestingPush ? 'Sending Test...' : '⚡ Send Test Push Notification'}</span>
              </button>
            )}

            <p className="input-help">
              <Info className="help-icon" />
              Get notified overnight when the AI guide refreshes your landmark digests.
            </p>
          </div>

          {error && <div className="settings-error">{error}</div>}
          {pushStatusMessage && (
            <div className="settings-success">
              <Check className="success-icon" />
              <span>{pushStatusMessage}</span>
            </div>
          )}
          {success && (
            <div className="settings-success">
              <Check className="success-icon" />
              <span>Settings saved successfully!</span>
            </div>
          )}

          <button type="submit" className="save-btn" disabled={isSaving || success}>
            {isSaving ? (
              <span>Validating & Saving...</span>
            ) : success ? (
              <span>Saved!</span>
            ) : (
              <>
                <Save className="btn-icon" />
                <span>Save Changes</span>
              </>
            )}
          </button>

          <button 
            type="button" 
            className="clear-cache-btn-dev" 
            onClick={() => {
              localStorage.removeItem('papertok_cached_topic');
              localStorage.removeItem('papertok_cached_papers');
              localStorage.removeItem('papertok_metadata_cache');
              alert('Local cache (papers and paper metadata) has been cleared! Your next search will query API servers live.');
            }}
          >
            Clear Cached Papers & Metadata (Dev Tool)
          </button>

          {onLaunchTestViz && (
            <button 
              type="button" 
              className="test-viz-btn-dev" 
              onClick={() => {
                onClose();
                onLaunchTestViz();
              }}
            >
              📊 Launch Visualization Testing Protocol
            </button>
          )}
        </form>
      </div>

      <style>{`
        .settings-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 20px;
        }

        .settings-modal {
          width: 100%;
          max-width: 440px;
          border-radius: var(--radius-lg);
          padding: 30px;
          display: flex;
          flex-direction: column;
        }

        .settings-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .settings-modal-header h2 {
          font-size: 1.4rem;
          color: var(--text-primary);
          font-family: var(--font-display);
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: rgba(9, 9, 11, 0.05);
          color: var(--text-secondary);
          transition: var(--transition-fast);
        }

        .close-btn:hover {
          background: rgba(9, 9, 11, 0.1);
          color: var(--text-primary);
        }

        .settings-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group label {
          font-family: var(--font-mono);
          color: var(--text-secondary);
          font-size: 0.88rem;
          font-weight: 500;
          margin-bottom: 8px;
          display: block;
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

        .settings-error {
          background: var(--color-error-glow);
          border: 1px solid rgba(190, 18, 60, 0.25);
          color: var(--color-error);
          padding: 10px 14px;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          font-family: var(--font-mono);
        }

        .settings-success {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--color-success-glow);
          border: 1px solid rgba(4, 120, 87, 0.25);
          color: var(--color-success);
          padding: 10px 14px;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          font-family: var(--font-mono);
        }

        .success-icon {
          width: 16px;
          height: 16px;
        }

        .save-btn {
          width: 100%;
          padding: 12px;
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
          font-family: var(--font-display);
        }

        .save-btn:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(27, 73, 49, 0.2);
        }

        .save-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .clear-cache-btn-dev {
          width: 100%;
          padding: 10px;
          border-radius: var(--radius-md);
          background: rgba(190, 18, 60, 0.05);
          border: 1px dashed rgba(190, 18, 60, 0.3);
          color: var(--color-error);
          font-weight: 600;
          font-size: 0.82rem;
          cursor: pointer;
          transition: var(--transition-fast);
          margin-top: 10px;
          text-align: center;
          font-family: var(--font-mono);
        }

        .clear-cache-btn-dev:hover {
          background: rgba(190, 18, 60, 0.1);
          border-color: rgba(190, 18, 60, 0.5);
          color: #9f1239;
        }

        .test-viz-btn-dev {
          width: 100%;
          padding: 10px;
          border-radius: var(--radius-md);
          background: rgba(6, 182, 212, 0.08);
          border: 1px dashed rgba(6, 182, 212, 0.3);
          color: #06b6d4;
          font-weight: 600;
          font-size: 0.82rem;
          cursor: pointer;
          transition: var(--transition-fast);
          margin-top: 10px;
          text-align: center;
          font-family: var(--font-mono);
        }

        .test-viz-btn-dev:hover {
          background: rgba(6, 182, 212, 0.15);
          border-color: rgba(6, 182, 212, 0.5);
          color: #0891b2;
        }

        .notification-btn {
          width: 100%;
          padding: 12px;
          border-radius: var(--radius-md);
          background: rgba(9, 9, 11, 0.03);
          border: 1px solid var(--border-glass);
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.9rem;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          transition: var(--transition-fast);
          margin-bottom: 5px;
          cursor: pointer;
        }

        .notification-btn:hover:not(:disabled) {
          background: rgba(9, 9, 11, 0.08);
          border-color: var(--border-glass-bright);
        }

        .notification-btn.active {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.3);
          color: #10b981;
        }

        .notification-test-btn {
          width: 100%;
          padding: 10px;
          border-radius: var(--radius-md);
          background: rgba(9, 9, 11, 0.02);
          border: 1px dashed var(--border-glass);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.85rem;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
          transition: var(--transition-fast);
          margin-top: 8px;
          cursor: pointer;
        }

        .notification-test-btn:hover:not(:disabled) {
          background: rgba(9, 9, 11, 0.06);
          border-color: var(--border-glass-bright);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};
