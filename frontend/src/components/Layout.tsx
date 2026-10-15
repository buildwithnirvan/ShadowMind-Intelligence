import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import Atmosphere from './Atmosphere';
import { useAuth } from '../context/AuthContext';
import RenderAvatar from './RenderAvatar';
import { ShieldAlert, Sparkles, Activity } from 'lucide-react';

const ROUTE_NAMES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Administrative analytics and platform console' },
  '/chat': { title: 'Chat with Shadow', subtitle: 'Empathetic AI conversational sanctuary' },
  '/mood': { title: 'Mood Tracker', subtitle: 'Emotion tracking and longitudinal wellness patterns' },
  '/meditation': { title: 'Meditation Sanctuary', subtitle: 'Guided mindfulness sessions & soundscapes' },
  '/journal': { title: 'Reflective Journal', subtitle: 'Expressive journaling with neural cognitive synthesis' },
  '/cbt': { title: 'CBT Cognitive Coach', subtitle: 'Identify triggers, reframe thoughts, and build coping strategies' },
  '/breathe': { title: 'Breathing Exercises', subtitle: 'A guided somatic pacer to regulate your nervous system' },
  '/analytics': { title: 'Wellness Analytics', subtitle: 'Biomarkers, sentiment trajectories, and behavioral trends' },
  '/predictions': { title: 'Outlook & Signals', subtitle: 'Gentle, early predictive signals from your recent logs' },
  '/history': { title: 'Chronological History', subtitle: 'A unified historical timeline of all logged interactions' },
  '/doctors': { title: 'Clinical Care Directory', subtitle: 'Licensed therapists and professional clinical networks' },
  '/assessment': { title: 'Clinical Screenings', subtitle: 'Standardized PHQ-9 & GAD-7 screening questionnaires' },
  '/safety': { title: 'Personal Safety Plan', subtitle: 'Your personalized crisis response architecture' },
  '/help': { title: 'Emergency Crisis Support', subtitle: 'Immediate, confidential professional resources 24/7' },
  '/settings': { title: 'System Settings', subtitle: 'Appearance, audio preferences, and security protocols' },
  '/profile': { title: 'Operator Profile', subtitle: 'Identity credentials, avatar selection, and export controls' },
};

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const route = ROUTE_NAMES[location.pathname] || { title: 'ShadowMind', subtitle: 'Cognitive Wellness Companion' };
  const isChat = location.pathname === '/chat';

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative', background: 'var(--bg-void)' }}>
      <Atmosphere density={24} />
      <Sidebar />
      <div
        className="app-main"
        style={{
          flex: 1,
          marginLeft: 'var(--sidebar-width)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
          transition: 'margin-left 0.3s ease',
        }}
      >
        {!isChat && (
          <header
            style={{
              flexShrink: 0,
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderBottom: '1px solid var(--border-dim)',
              padding: '1rem 2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
              zIndex: 10,
            }}
          >
            <div
              style={{
                maxWidth: '1400px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1.5rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h1
                  className="page-title"
                  style={{
                    fontSize: '1.35rem',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '-0.01em',
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {route.title}
                </h1>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    margin: '3px 0 0',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {route.subtitle}
                </p>
              </div>

              {/* Right Side Header Controls: System Health, Quick Help, Profile */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '5px 11px',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    borderRadius: '999px',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    color: '#4ade80',
                  }}
                  title="ShadowMind Core Neural Processing Online"
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#22c55e',
                      boxShadow: '0 0 8px #22c55e',
                    }}
                  />
                  <span>NEURAL ONLINE</span>
                </div>

                <Link
                  to="/help"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: '#fca5a5',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                  }}
                  title="24/7 Crisis Support"
                >
                  <ShieldAlert size={14} color="#f87171" />
                  <span>Support</span>
                </Link>

                <Link
                  to="/profile"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    textDecoration: 'none',
                    padding: '4px 10px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-dim)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <RenderAvatar user={user} size={15} avatarSize={24} />
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      maxWidth: '120px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user?.username || 'Operator'}
                  </span>
                </Link>
              </div>
            </div>
          </header>
        )}

        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            padding: isChat ? 0 : '1.75rem 2rem',
            overflow: isChat ? 'hidden' : 'auto',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            className="layout-content-container"
            style={{
              maxWidth: isChat ? '100%' : '1400px',
              width: '100%',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              height: isChat ? '100%' : undefined,
            }}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
