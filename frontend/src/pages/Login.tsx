import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Eye, EyeOff, Shield, User, Lock, KeyRound, Sparkles, X,
  AlertCircle, ArrowRight, ShieldCheck, Cpu
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import BackendStatus from '../components/BackendStatus';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { adminLogin, userLogin } = useAuth();

  // Regular user login state
  const [username, setUsername] = useState(location.state?.registeredUsername || '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState('');

  // Admin login modal state
  const [showAdminModal, setShowAdminModal] = useState(
    location.pathname.includes('/admin') || location.state?.openAdminModal === true
  );
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPw, setShowAdminPw] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    if (location.pathname.endsWith('/admin')) {
      setShowAdminModal(true);
    }
  }, [location.pathname]);

  const handleUserSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setUserError('');
    if (!username.trim() || !password) {
      setUserError('Please enter both your username/email and password.');
      toast.error('Enter username and password');
      return;
    }
    setUserLoading(true);
    try {
      const userDoc = await userLogin(username.trim(), password);
      toast.success(`Welcome back, ${userDoc.full_name || userDoc.username}`);
      navigate('/chat');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Invalid username or password';
      setUserError(msg);
      toast.error(msg);
    } finally {
      setUserLoading(false);
    }
  };

  const handleAdminSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAdminError('');
    if (!adminUsername.trim() || !adminPassword) {
      setAdminError('Administrator username and password are required.');
      return;
    }
    setAdminLoading(true);
    try {
      const userDoc = await adminLogin(adminUsername.trim(), adminPassword);
      toast.success(`Administrator ${userDoc.username} authenticated`);
      setShowAdminModal(false);
      navigate('/admin');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Invalid administrator credentials';
      setAdminError(msg);
      toast.error(msg);
    } finally {
      setAdminLoading(false);
    }
  };

  const closeAdminModal = () => {
    setShowAdminModal(false);
    setAdminError('');
    setAdminUsername('');
    setAdminPassword('');
  };

  const fillQuickDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    toast.success(`Loaded credentials for ${u}`);
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: '#05070B',
        backgroundImage: `
          radial-gradient(circle at 18% 25%, rgba(39, 184, 255, 0.14), transparent 45%),
          radial-gradient(circle at 82% 75%, rgba(255, 138, 36, 0.12), transparent 45%)
        `,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        color: '#F3F5F7',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Top Floating Controls */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          padding: '1.25rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <BackendStatus />
        </div>

        {/* Admin Login Secondary Button */}
        <div style={{ pointerEvents: 'auto' }}>
          <button
            onClick={() => {
              setShowAdminModal(true);
              setAdminError('');
            }}
            id="btn-admin-login-modal-open"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              background: 'rgba(13, 23, 35, 0.75)',
              border: '1px solid #1D3041',
              borderRadius: '999px',
              padding: '0.45rem 1rem',
              color: '#9AAABD',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(12px)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#FF8A24';
              e.currentTarget.style.color = '#F3F5F7';
              e.currentTarget.style.boxShadow = '0 0 14px rgba(255, 138, 36, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#1D3041';
              e.currentTarget.style.color = '#9AAABD';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Shield size={13} color="#FF8A24" />
            <span>Admin Login</span>
          </button>
        </div>
      </div>

      {/* Main Full-Viewport 2-Column Experience */}
      <div
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          position: 'relative',
          zIndex: 1,
          overflowY: 'auto',
        }}
      >
        {/* ── LEFT COLUMN: Branding Section (~50% width) ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '3.5rem 3rem',
            position: 'relative',
            borderRight: '1px solid #1D3041',
            background: 'linear-gradient(180deg, rgba(10, 16, 25, 0.6) 0%, rgba(5, 7, 11, 0.9) 100%)',
            textAlign: 'center',
          }}
        >
          {/* Subtle Ambient Cosmic Light */}
          <div
            style={{
              position: 'absolute',
              top: '25%',
              left: '20%',
              width: '280px',
              height: '280px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(39, 184, 255, 0.16) 0%, transparent 70%)',
              filter: 'blur(45px)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '20%',
              right: '20%',
              width: '280px',
              height: '280px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 138, 36, 0.15) 0%, transparent 70%)',
              filter: 'blur(45px)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 2, maxWidth: '520px', width: '100%' }}>
            {/* The Attached Black-Hole Logo (Prominent, maintaining aspect ratio) */}
            <div
              style={{
                width: 170,
                height: 170,
                margin: '0 auto 2rem',
                borderRadius: '50%',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 35px rgba(255, 138, 36, 0.4), 0 0 50px rgba(39, 184, 255, 0.35)',
                border: '1.5px solid rgba(255, 255, 255, 0.22)',
                overflow: 'hidden',
                background: '#05070B',
              }}
            >
              <img
                src="/assets/shadowmind-blackhole.png"
                alt="ShadowMind Black Hole"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>

            {/* Brand Name */}
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.6rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                lineHeight: 1.1,
                margin: '0 0 0.6rem',
                background: 'linear-gradient(135deg, #F3F5F7 40%, #FFB347 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ShadowMind
            </h1>

            {/* Existing Tagline */}
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.86rem',
                color: '#27B8FF',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 600,
                marginBottom: '1.75rem',
              }}
            >
              AI FOR A HEALTHIER YOU
            </div>

            <p
              style={{
                fontSize: '0.92rem',
                color: '#9AAABD',
                lineHeight: 1.6,
                margin: '0 auto 2rem',
                maxWidth: '440px',
              }}
            >
              An intelligent, confidential wellness sanctuary providing empathetic conversational support,
              cognitive reframing, and clinical wellness telemetry.
            </p>

            {/* Subtle Pill Indicators */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'rgba(39, 184, 255, 0.08)',
                  border: '1px solid rgba(39, 184, 255, 0.25)',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#27B8FF',
                }}
              >
                <Sparkles size={12} />
                <span>Empathetic AI</span>
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'rgba(255, 138, 36, 0.08)',
                  border: '1px solid rgba(255, 138, 36, 0.25)',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#FF8A24',
                }}
              >
                <Cpu size={12} />
                <span>CBT Framework</span>
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#22C55E',
                }}
              >
                <ShieldCheck size={12} />
                <span>Encrypted Haven</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Login Section (~50% width) ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '3.5rem 2.5rem',
            background: 'rgba(10, 16, 25, 0.7)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '430px',
              background: '#0D1723',
              border: '1px solid #1D3041',
              borderRadius: '16px',
              padding: '2.5rem 2.2rem',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.65)',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#F3F5F7',
                  letterSpacing: '-0.02em',
                  margin: '0 0 0.35rem',
                }}
              >
                Sign In
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#9AAABD', margin: 0 }}>
                Enter your credentials to enter your sanctuary
              </p>
            </div>

            {/* Quick Demo Fill Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '1.35rem',
              }}
            >
              <button
                type="button"
                onClick={() => fillQuickDemo('operator', 'operator123')}
                style={{
                  flex: 1,
                  background: 'rgba(39, 184, 255, 0.08)',
                  border: '1px solid rgba(39, 184, 255, 0.3)',
                  borderRadius: '7px',
                  padding: '5px 10px',
                  color: '#27B8FF',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
              >
                ⚡ Fill Demo User
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdminModal(true);
                  setAdminUsername('nirvan');
                  setAdminPassword('admin123');
                }}
                style={{
                  flex: 1,
                  background: 'rgba(255, 138, 36, 0.08)',
                  border: '1px solid rgba(255, 138, 36, 0.3)',
                  borderRadius: '7px',
                  padding: '5px 10px',
                  color: '#FF8A24',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
              >
                🛡️ Demo Admin
              </button>
            </div>

            {userError && (
              <div
                style={{
                  padding: '0.75rem 0.9rem',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '0.78rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{userError}</span>
              </div>
            )}

            <form onSubmit={handleUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    color: '#9AAABD',
                    marginBottom: '0.4rem',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                  }}
                >
                  USERNAME OR EMAIL
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-username"
                    name="username"
                    className="input-base"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="operator or user@example.com"
                    required
                    autoComplete="username"
                    style={{
                      width: '100%',
                      paddingLeft: '2.5rem',
                      paddingTop: '0.7rem',
                      paddingBottom: '0.7rem',
                      fontSize: '0.86rem',
                    }}
                  />
                  <User
                    size={16}
                    color="#647589"
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    color: '#9AAABD',
                    marginBottom: '0.4rem',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                  }}
                >
                  PASSWORD
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    name="password"
                    className="input-base"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    style={{
                      width: '100%',
                      paddingLeft: '2.5rem',
                      paddingRight: '2.5rem',
                      paddingTop: '0.7rem',
                      paddingBottom: '0.7rem',
                      fontSize: '0.86rem',
                    }}
                  />
                  <Lock
                    size={16}
                    color="#647589"
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#647589',
                      padding: 0,
                      display: 'flex',
                    }}
                    title={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Primary Login Button in Orange */}
              <button
                type="submit"
                id="btn-user-submit"
                disabled={userLoading}
                className="btn"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  marginTop: '0.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#FF8A24',
                  color: '#ffffff',
                  boxShadow: '0 2px 14px rgba(255, 138, 36, 0.35)',
                  border: 'none',
                  borderRadius: '8px',
                }}
              >
                {userLoading ? 'Signing In…' : 'Sign In'}
                {!userLoading && <ArrowRight size={15} />}
              </button>
            </form>

            <div style={{ margin: '1.35rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '1px', background: '#1D3041' }} />
              <span style={{ fontSize: '0.68rem', color: '#647589', fontFamily: 'var(--font-mono)' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: '#1D3041' }} />
            </div>

            <GoogleSignInButton />

            {/* Register Option */}
            <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#9AAABD' }}>
              Don't have an account yet?{' '}
              <Link
                to="/register"
                id="link-register"
                style={{
                  color: '#FF8A24',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Login Modal Panel */}
      {showAdminModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 7, 11, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.25rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAdminModal();
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#0D1723',
              border: '1px solid #1D3041',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 24px rgba(255, 138, 36, 0.15)',
              position: 'relative',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '10px',
                    background: 'rgba(255, 138, 36, 0.12)',
                    border: '1px solid rgba(255, 138, 36, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Shield size={20} color="#FF8A24" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#F3F5F7' }}>
                    Administrator Login
                  </h2>
                  <p style={{ fontSize: '0.7rem', color: '#FF8A24', fontFamily: 'var(--font-mono)', margin: '2px 0 0' }}>
                    RESTRICTED ACCESS PORTAL
                  </p>
                </div>
              </div>
              <button
                onClick={closeAdminModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#647589',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#9AAABD', marginBottom: '1.25rem', lineHeight: 1.45 }}>
              Enter administrator credentials to access the ShadowMind administrative telemetry console.
            </p>

            {adminError && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '0.78rem',
                  marginBottom: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{adminError}</span>
              </div>
            )}

            <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    color: '#9AAABD',
                    marginBottom: '0.35rem',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                  }}
                >
                  ADMINISTRATOR USERNAME
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="admin-username-input"
                    name="admin_username"
                    className="input-base"
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="nirvan"
                    autoFocus
                    required
                    autoComplete="off"
                    style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.84rem' }}
                  />
                  <KeyRound
                    size={15}
                    color="#FF8A24"
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    color: '#9AAABD',
                    marginBottom: '0.35rem',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                  }}
                >
                  PASSWORD
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="admin-password-input"
                    name="admin_password"
                    className="input-base"
                    type={showAdminPw ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="new-password"
                    style={{ width: '100%', paddingLeft: '2.4rem', paddingRight: '2.4rem', fontSize: '0.84rem' }}
                  />
                  <Lock
                    size={15}
                    color="#FF8A24"
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPw(!showAdminPw)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#647589',
                      padding: 0,
                      display: 'flex',
                    }}
                  >
                    {showAdminPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={closeAdminModal}
                  className="btn btn-ghost"
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    fontSize: '0.82rem',
                    border: '1px solid #1D3041',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-admin-modal-submit"
                  disabled={adminLoading}
                  className="btn"
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    background: '#FF8A24',
                    color: '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {adminLoading ? 'Verifying…' : 'Admin Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
