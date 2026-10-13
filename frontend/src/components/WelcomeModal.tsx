import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Shield, Sparkles, Terminal, Activity, ArrowRight,
  Bot, Cpu, Lock, CheckCircle2, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const WELCOME_DISMISSED_KEY = 'shadowmind_welcome_dismissed';

export default function WelcomeModal() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Only display if user is fully authenticated and hasn't dismissed popup in this session
    if (isAuthenticated && user) {
      const isDismissed = sessionStorage.getItem(WELCOME_DISMISSED_KEY);
      if (!isDismissed) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    } else {
      setIsOpen(false);
    }
  }, [isAuthenticated, user]);

  if (!isOpen || !isAuthenticated || !user) {
    return null;
  }

  const isAdmin = user.role === 'admin';

  const handleDismissUser = () => {
    sessionStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    setIsOpen(false);
    navigate('/chat');
  };

  const handleDismissAdmin = () => {
    sessionStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    setIsOpen(false);
    navigate('/admin');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // B. ADMINISTRATOR WELCOME POPUP
  // ─────────────────────────────────────────────────────────────────────────────
  if (isAdmin) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99980,
          background: 'rgba(3, 7, 18, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          animation: 'fadeIn 0.25s ease-out',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-welcome-title"
      >
        <div
          style={{
            maxWidth: '620px',
            width: '100%',
            background: 'linear-gradient(180deg, #07111f 0%, #030812 100%)',
            border: '1px solid #1a3a60',
            borderRadius: '16px',
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 35px rgba(46, 111, 145, 0.25)',
            overflow: 'hidden',
            fontFamily: 'var(--font-body)',
            position: 'relative',
          }}
        >
          {/* Glowing Circuit Top Border */}
          <div
            style={{
              height: '3px',
              background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #e87522 100%)',
              boxShadow: '0 0 12px rgba(56, 189, 248, 0.8)',
            }}
          />

          <div style={{ padding: '2rem 2.25rem' }}>
            {/* Console Status Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '1.25rem',
                borderBottom: '1px solid rgba(26, 58, 96, 0.6)',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={15} color="#38bdf8" />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    letterSpacing: '0.14em',
                    color: '#38bdf8',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  ADMINISTRATIVE NODE // RBAC SECURE
                </span>
              </div>

              {/* System-status indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  padding: '3px 10px',
                  borderRadius: '12px',
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 8px #22c55e',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: '#22c55e',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                  }}
                >
                  System Status: Ready
                </span>
              </div>
            </div>

            {/* Header Icon + Identity */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '1.5rem' }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#040711',
                  border: '1.5px solid rgba(255, 255, 255, 0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(56, 189, 248, 0.4), 0 0 24px rgba(232, 117, 34, 0.35)',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <img src="/shadowmind-logo.png" alt="ShadowMind" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              <div>
                <h2
                  id="admin-welcome-title"
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    margin: 0,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.3,
                  }}
                >
                  ShadowMind AI — Administrative Intelligence Console
                </h2>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginTop: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Identity: <strong style={{ color: '#ffffff' }}>{user.username}</strong>
                  </span>
                  <span style={{ color: 'var(--border-dim)' }}>•</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      background: 'rgba(232, 117, 34, 0.18)',
                      border: '1px solid rgba(232, 117, 34, 0.4)',
                      color: 'var(--accent-bright)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                    }}
                  >
                    Access Level: Administrator
                  </span>
                </div>
              </div>
            </div>

            {/* Structured Message Panel */}
            <div
              style={{
                background: 'rgba(10, 24, 42, 0.7)',
                border: '1px solid rgba(26, 58, 96, 0.7)',
                borderRadius: '12px',
                padding: '1.25rem 1.4rem',
                marginBottom: '1.75rem',
                fontFamily: 'var(--font-body)',
              }}
            >
              <p
                style={{
                  fontSize: '0.92rem',
                  color: '#ffffff',
                  fontWeight: 600,
                  margin: '0 0 0.85rem 0',
                }}
              >
                Welcome, Administrator.
              </p>
              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.65,
                  margin: '0 0 0.85rem 0',
                }}
              >
                Your administrative environment is ready.
              </p>
              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.65,
                  margin: '0 0 1rem 0',
                }}
              >
                Monitor platform activity, review aggregated user engagement and mental wellness analytics, and oversee application operations through the administrative console.
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(26, 58, 96, 0.5)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                }}
              >
                <span style={{ color: '#22c55e' }}>● System Status: Ready</span>
                <span style={{ color: 'var(--text-muted)' }}>|</span>
                <span style={{ color: 'var(--accent-bright)' }}>Access Level: Administrator</span>
              </div>
            </div>

            {/* Action Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                onClick={handleDismissAdmin}
                type="button"
                className="btn btn-primary"
                style={{
                  padding: '0.75rem 1.6rem',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  boxShadow: '0 4px 18px rgba(2, 132, 199, 0.4)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Open Admin Console</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // A. REGULAR USER WELCOME POPUP
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99980,
        background: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.25s ease-out',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-welcome-title"
    >
      <div
        style={{
          maxWidth: '580px',
          width: '100%',
          background: 'linear-gradient(180deg, #0a1424 0%, #060d19 100%)',
          border: '1px solid var(--accent-border)',
          borderRadius: '20px',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 35px var(--accent-subtle)',
          overflow: 'hidden',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Subtle accent glow top strip */}
        <div
          style={{
            height: '3px',
            background: 'linear-gradient(90deg, var(--accent-glow) 0%, var(--accent-bright) 50%, var(--accent-glow) 100%)',
            boxShadow: '0 0 12px var(--accent-glow)',
          }}
        />

        <div style={{ padding: '2.25rem' }}>
          {/* Neural / Brain Icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '1.25rem',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#040711',
                border: '1.5px solid rgba(255, 255, 255, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 24px rgba(232, 117, 34, 0.4), 0 0 35px rgba(46, 111, 145, 0.35)',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img src="/shadowmind-logo.png" alt="ShadowMind" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-dim)',
                  padding: '2px 10px',
                  borderRadius: '20px',
                  marginBottom: '6px',
                }}
              >
                <Sparkles size={12} color="var(--accent-bright)" />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.64rem',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.04em',
                  }}
                >
                  Signed in as <strong style={{ color: 'var(--accent-bright)' }}>{user.username}</strong>
                </span>
              </div>

              <h2
                id="user-welcome-title"
                style={{
                  fontSize: '1.45rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Welcome to ShadowMind AI!
              </h2>
            </div>
          </div>

          {/* Message Content */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '14px',
              padding: '1.35rem 1.5rem',
              marginBottom: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
            }}
          >
            <p
              style={{
                fontSize: '0.94rem',
                color: '#ffffff',
                lineHeight: 1.6,
                margin: 0,
                fontWeight: 600,
              }}
            >
              Welcome to ShadowMind AI — Your Personal AI-Powered Mental Wellness Companion.
            </p>

            <p
              style={{
                fontSize: '0.86rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              Your AI assistant is ready to help you understand your emotions, identify behavioral patterns, manage stress, and improve your mental well-being.
            </p>

            <p
              style={{
                fontSize: '0.86rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              Explore AI conversations, mood tracking, guided meditation, journaling, and CBT coaching to build healthier thinking habits and improve your emotional well-being.
            </p>
          </div>

          {/* Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleDismissUser}
              type="button"
              className="btn btn-primary"
              style={{
                padding: '0.75rem 1.75rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--accent-bright) 0%, #c2570e 100%)',
                boxShadow: '0 4px 18px var(--accent-glow)',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Enter ShadowMind AI</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
