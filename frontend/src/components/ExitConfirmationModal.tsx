import React from 'react';
import { LogOut, AlertTriangle, X, ShieldAlert, ArrowRight } from 'lucide-react';
import { useExit } from '../context/ExitContext';

export default function ExitConfirmationModal() {
  const { isExitOpen, isExited, closeExitDialog, confirmExit, resetExited } = useExit();

  if (isExited) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: '#040810',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'var(--font-body)',
        }}
      >
        <div
          style={{
            maxWidth: '460px',
            width: '100%',
            background: 'rgba(11, 22, 38, 0.95)',
            border: '1px solid #1e3a5f',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}
          >
            <LogOut size={26} color="#ef4444" />
          </div>
          <h2
            style={{
              fontSize: '1.3rem',
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: '0.75rem',
            }}
          >
            Session Terminated
          </h2>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: '1.75rem',
            }}
          >
            You have exited ShadowMind AI. All transient session keys have been securely purged.
            You may now safely close this window or return to the login screen.
          </p>
          <button
            onClick={resetExited}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem 1.25rem',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <span>Return to Login</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (!isExitOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        background: 'rgba(3, 7, 18, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeExitDialog();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-dialog-title"
    >
      <div
        style={{
          maxWidth: '500px',
          width: '100%',
          background: 'linear-gradient(180deg, #0d1a2d 0%, #08111e 100%)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.12)',
          overflow: 'hidden',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Header accent strip */}
        <div
          style={{
            height: '4px',
            background: 'linear-gradient(90deg, #ef4444 0%, #f97316 50%, #ef4444 100%)',
          }}
        />

        <div style={{ padding: '1.75rem' }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.14)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 0 16px rgba(239, 68, 68, 0.25)',
                }}
              >
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.62rem',
                    color: '#ef4444',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: '2px',
                  }}
                >
                  Exit Confirmation
                </span>
                <h3
                  id="exit-dialog-title"
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  Are you sure you want to exit ShadowMind AI?
                </h3>
              </div>
            </div>

            <button
              onClick={closeExitDialog}
              className="btn-ghost"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>

          {/* Message body */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '1.1rem 1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <p
              style={{
                fontSize: '0.86rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              You're about to close ShadowMind AI. Your current session will end, and you will need to log in again the next time you open the application.
            </p>
            <p
              style={{
                fontSize: '0.86rem',
                color: '#ffffff',
                fontWeight: 600,
                lineHeight: 1.65,
                marginTop: '0.85rem',
                marginBottom: 0,
              }}
            >
              Do you want to exit now?
            </p>
          </div>

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <button
              onClick={closeExitDialog}
              type="button"
              className="btn btn-ghost"
              style={{
                padding: '0.65rem 1.25rem',
                fontSize: '0.84rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid var(--border-dim)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Cancel
            </button>

            <button
              onClick={confirmExit}
              type="button"
              style={{
                padding: '0.65rem 1.35rem',
                fontSize: '0.84rem',
                fontWeight: 600,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <LogOut size={15} />
              <span>Exit Application</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
