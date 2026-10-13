import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, UserPlus, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import BackendStatus from '../components/BackendStatus';
import Atmosphere from '../components/Atmosphere';
import BrandMark from '../components/BrandMark';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      toast.error('Username is required');
      return;
    }
    if (cleanUsername.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }
    if (!password) {
      toast.error('Password is required');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Password confirmation mismatch');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: cleanUsername,
        password,
        confirm_password: confirmPassword,
      });

      // Show success message and redirect user to user login page
      toast.success('Account created successfully! Please log in with your credentials.');
      navigate('/login/user', {
        state: { registeredUsername: cleanUsername, mode: 'user' },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#040711',
        backgroundImage: `
          radial-gradient(circle at 15% 20%, rgba(46, 111, 145, 0.25), transparent 45%),
          radial-gradient(circle at 85% 80%, rgba(232, 117, 34, 0.2), transparent 45%)
        `,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: '2rem 1.5rem',
      }}
    >
      <BackendStatus />
      <Atmosphere density={28} />

      <div
        className="card animate-fade-in-up"
        style={{
          width: '100%',
          maxWidth: '440px',
          position: 'relative',
          zIndex: 1,
          padding: '2.5rem',
          background: 'rgba(10, 22, 38, 0.94)',
          border: '1px solid #1a3047',
          boxShadow: '0 20px 50px rgba(0,0,0,0.7), 0 0 30px rgba(232, 117, 34, 0.12)',
          borderRadius: '16px',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <BrandMark size="lg" />
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '10px' }}>
            User Registration • Create your mental wellness account
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Username Field */}
          <div style={{ marginBottom: '1.1rem' }}>
            <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>
              Username <span style={{ color: 'var(--accent-bright)' }}>*</span>
            </label>
            <input
              className="input-base"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="choose a unique username"
              autoComplete="username"
              required
            />
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '1.1rem' }}>
            <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>
              Password <span style={{ color: 'var(--accent-bright)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="input-base"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="at least 6 characters"
                autoComplete="new-password"
                style={{ paddingRight: '2.5rem' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>
              Confirm Password <span style={{ color: 'var(--accent-bright)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="input-base"
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="re-enter password"
                autoComplete="new-password"
                style={{ paddingRight: '2.5rem' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Action Buttons: Register and Back to Login */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700 }}
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Register'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/login/user')}
              className="btn btn-ghost"
              style={{
                width: '100%',
                padding: '0.7rem',
                fontSize: '0.85rem',
                border: '1px solid var(--border-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <ArrowLeft size={15} /> Back to Login
            </button>
          </div>
        </form>

        {/* Security Note */}
        <div
          style={{
            marginTop: '1.5rem',
            padding: '0.75rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-dim)',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              margin: 0,
            }}
          >
            All registered accounts are initialized with standard user role and secure bcrypt protection.
          </p>
        </div>
      </div>
    </div>
  );
}
