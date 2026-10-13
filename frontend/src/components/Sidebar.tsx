import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, BookOpen, Activity, Brain, Stethoscope, HelpCircle,
  User, LogOut, Zap, Settings, Wind, Compass, LineChart, History as HistoryIcon, Menu, X,
  ClipboardList, BrainCircuit, ShieldAlert, Shield, Power
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useExit } from '../context/ExitContext';
import RenderAvatar from './RenderAvatar';
import BrandMark from './BrandMark';
import toast from 'react-hot-toast';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { openExitDialog } = useExit();
  const navigate = useNavigate();
  const [online, setOnline] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Navigation sections strictly formatted per requirement:
  // 1. Chat with Shadow
  // 2. Dashboard (Administrator only)
  // 3. Mood Tracker
  // 4. Meditation
  // 5. Journal
  // 6. CBT Coach
  // 7. Other existing pages retained in logical order
  const sections = [
    {
      title: 'Primary Navigation',
      items: [
        { to: '/chat', icon: MessageSquare, label: 'Chat with Shadow' },
        ...(isAdmin
          ? [{ to: '/admin', icon: LayoutDashboard, label: 'Dashboard' }]
          : []),
        { to: '/mood', icon: Activity, label: 'Mood Tracker' },
        { to: '/meditation', icon: Compass, label: 'Meditation' },
        { to: '/journal', icon: BookOpen, label: 'Journal' },
        { to: '/cbt', icon: BrainCircuit, label: 'CBT Coach' },
      ],
    },
    {
      title: 'Mind & Body',
      items: [
        { to: '/breathe', icon: Wind, label: 'Breathing' },
      ],
    },
    {
      title: 'Check-ins',
      items: [
        { to: '/assessment', icon: ClipboardList, label: 'PHQ-9 / GAD-7' },
        { to: '/safety', icon: ShieldAlert, label: 'My safety plan' },
      ],
    },
    {
      title: 'Insights',
      items: [
        { to: '/analytics', icon: LineChart, label: 'Analytics' },
        { to: '/predictions', icon: Brain, label: 'Outlook' },
        { to: '/history', icon: HistoryIcon, label: 'History' },
      ],
    },
    {
      title: 'Care & Account',
      items: [
        { to: '/doctors', icon: Stethoscope, label: 'Find a professional' },
        { to: '/help', icon: HelpCircle, label: 'Crisis support' },
        { to: '/settings', icon: Settings, label: 'Settings' },
        { to: '/profile', icon: User, label: 'Profile' },
      ],
    },
  ];

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('/health', { signal: AbortSignal.timeout(2500) });
        setOnline(r.ok);
      } catch {
        setOnline(false);
      }
    };
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Signed out. Take care of yourself.');
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="mobile-nav-toggle btn-ghost"
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 99,
          display: 'none',
          padding: '8px',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 48,
          }}
        />
      )}

      <aside
        className={`sidebar-container ${mobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: 'var(--sidebar-width)',
          minHeight: '100vh',
          height: '100vh',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--accent-border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.4)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '1.5rem 1.25rem 1.25rem',
            borderBottom: '1px solid var(--border-dim)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
          }}
        >
          <NavLink
            to="/chat"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
            title="ShadowMind Home"
          >
            <BrandMark size="sm" subtitle="Wellness Intelligence" />
          </NavLink>
        </div>

        {/* Navigation Sections */}
        <nav
          style={{
            flex: 1,
            padding: '1rem 0.75rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {sections.map((sec, idx) => (
            <div key={idx}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.62rem',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.14em',
                  fontWeight: 600,
                  padding: '0 0.75rem 0.4rem',
                  textTransform: 'uppercase',
                }}
              >
                {sec.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {sec.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-body)',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.82rem',
                      letterSpacing: '0.01em',
                      textDecoration: 'none',
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      background: isActive
                        ? 'linear-gradient(90deg, var(--accent-subtle) 0%, rgba(255,255,255,0.02) 100%)'
                        : 'transparent',
                      borderLeft: isActive ? '3px solid var(--accent-bright)' : '3px solid transparent',
                      boxShadow: isActive ? 'inset 0 0 12px var(--accent-subtle)' : 'none',
                      transition: 'var(--transition)',
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          size={16}
                          color={isActive ? 'var(--accent-bright)' : 'currentColor'}
                          style={{
                            filter: isActive ? 'drop-shadow(0 0 6px var(--accent-glow))' : 'none',
                            transition: 'var(--transition)',
                          }}
                        />
                        <span>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User Card & Action Footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border-dim)',
            background: 'linear-gradient(0deg, rgba(0,0,0,0.4) 0%, transparent 100%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '0.75rem',
              padding: '0.45rem 0.6rem',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-dim)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                minWidth: 36,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '1.5px solid var(--accent-border)',
                boxShadow: '0 0 10px var(--accent-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <RenderAvatar user={user} size={18} avatarSize={48} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.full_name || user?.username || 'there'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: online === null ? 'var(--text-muted)' : online ? '#22c55e' : 'var(--accent-bright)',
                    boxShadow: online ? '0 0 8px #22c55e' : '0 0 8px var(--accent-bright)',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.62rem',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {online === null ? 'Connecting…' : online ? 'Connected' : 'Offline mode'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Exit Application & Sign Out */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={openExitDialog}
              className="btn btn-ghost"
              style={{
                width: '100%',
                justifyContent: 'center',
                fontSize: '0.76rem',
                padding: '0.45rem',
                borderRadius: '6px',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                background: 'rgba(239, 68, 68, 0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Power size={13} color="#ef4444" />
              <span>Exit Application</span>
            </button>

            <button
              onClick={handleLogout}
              className="btn btn-ghost"
              style={{
                width: '100%',
                justifyContent: 'center',
                fontSize: '0.76rem',
                padding: '0.45rem',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <LogOut size={13} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
