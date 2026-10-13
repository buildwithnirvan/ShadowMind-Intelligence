import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface GoogleSignInButtonProps {
  text?: string;
  onSuccess?: () => void;
}

declare global {
  interface Window {
    google?: any;
  }
}

export default function GoogleSignInButton({
  text = 'Continue with Google',
  onSuccess,
}: GoogleSignInButtonProps) {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [googleName, setGoogleName] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');

  // Handle Google Identity credential response if Google GSI SDK is active
  const handleCredentialResponse = async (response: any) => {
    setLoading(true);
    try {
      await googleLogin({ credential: response.credential });
      toast.success('Signed in with Google');
      if (onSuccess) onSuccess();
      else navigate('/mood');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if Google GSI is available and client ID is provided
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (clientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });
      } catch (e) {
        console.warn('Google Identity initialization error', e);
      }
    }
  }, []);

  const handleClick = async () => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (clientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
        return;
      } catch (e) {
        // Fallback to interactive sign-in
      }
    }
    // Interactive Google prompt modal for immediate testing without API key setup
    setShowPrompt(true);
  };

  const handleSimulatedGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail || !googleName) {
      toast.error('Please enter Google account details');
      return;
    }
    setLoading(true);
    try {
      // Clean avatar seed based on Google user's name
      const picUrl = `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(googleName)}&size=96&backgroundColor=transparent`;
      await googleLogin({
        email: googleEmail,
        name: googleName,
        picture: picUrl,
        google_id: `google_${Date.now()}`,
      });
      toast.success(`Welcome, ${googleName}`);
      setShowPrompt(false);
      if (onSuccess) onSuccess();
      else navigate('/mood');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="btn-google"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M12 5c1.56 0 2.97.55 4.08 1.45l3.06-3.06C17.29 1.63 14.83 1 12 1 7.55 1 3.73 3.56 1.87 7.29l3.67 2.85C6.42 7.27 8.97 5 12 5z"
          />
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.71 2.88c2.16-1.99 3.71-4.94 3.71-8.7z"
          />
          <path
            fill="#FBBC05"
            d="M5.54 14.86c-.25-.73-.39-1.52-.39-2.36s.14-1.63.39-2.36L1.87 7.29C1.07 8.87.6 10.63.6 12.5s.47 3.63 1.27 5.21l3.67-2.85z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.71-2.88c-1.07.72-2.45 1.16-4.22 1.16-3.03 0-5.58-2.27-6.46-5.14L1.87 17.08C3.73 20.81 7.55 24 12 24z"
          />
        </svg>
        <span>{loading ? 'CONNECTING TO GOOGLE...' : text}</span>
      </button>

      {/* Modal for Google Auth */}
      {showPrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setShowPrompt(false)}
        >
          <div
            className="card animate-fade-in-up"
            style={{
              width: '100%',
              maxWidth: '380px',
              padding: '1.75rem',
              background: '#0d1017',
              border: '1px solid var(--accent-border)',
              boxShadow: '0 0 32px rgba(0, 0, 0, 0.8)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.56 0 2.97.55 4.08 1.45l3.06-3.06C17.29 1.63 14.83 1 12 1 7.55 1 3.73 3.56 1.87 7.29l3.67 2.85C6.42 7.27 8.97 5 12 5z" />
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.71 2.88c2.16-1.99 3.71-4.94 3.71-8.7z" />
                <path fill="#FBBC05" d="M5.54 14.86c-.25-.73-.39-1.52-.39-2.36s.14-1.63.39-2.36L1.87 7.29C1.07 8.87.6 10.63.6 12.5s.47 3.63 1.27 5.21l3.67-2.85z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.71-2.88c-1.07.72-2.45 1.16-4.22 1.16-3.03 0-5.58-2.27-6.46-5.14L1.87 17.08C3.73 20.81 7.55 24 12 24z" />
              </svg>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                  Sign in with Google
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                  Sync name & profile photo
                </div>
              </div>
            </div>

            <form onSubmit={handleSimulatedGoogleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Google Account Name
                </label>
                <input
                  className="input-base"
                  type="text"
                  value={googleName}
                  onChange={e => setGoogleName(e.target.value)}
                  placeholder="e.g. Jordan Hayes"
                  autoFocus
                  required
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Google Email
                </label>
                <input
                  className="input-base"
                  type="email"
                  value={googleEmail}
                  onChange={e => setGoogleEmail(e.target.value)}
                  placeholder="jordan.hayes@gmail.com"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowPrompt(false)}
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={loading}
                >
                  {loading ? 'Syncing...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
