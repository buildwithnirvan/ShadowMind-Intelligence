import { useState } from 'react';
import { Shield, Trash2, Save, Lock, Cpu, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { format } from 'date-fns';
import api from '../services/api';
import RenderAvatar, { getPresetAvatars } from '../components/RenderAvatar';

export default function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    bio: user?.bio || '',
    avatar_url: user?.avatar_url || '',
  });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateMe(form);
      await refreshUser();
      toast.success('PROFILE UPDATED');
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (pwForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success('PASSWORD UPDATED');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Password change failed');
    } finally {
      setPwSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await authApi.deleteAccount();
      logout();
      toast.success('Account deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/export/therapist');
      const blob = new Blob([res.data], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shadowmind_report_${format(new Date(), 'yyyyMMdd')}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Report downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '820px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          Operator identity credentials and account settings
        </p>
      </div>

      {/* Identity card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '3px',
            background: 'var(--red-subtle)', border: '1px solid var(--red-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            <RenderAvatar url={user?.avatar_url} size={28} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.06em' }}>
              {user?.full_name || user?.username}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>@{user?.username}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              SINCE {user ? format(new Date(user.created_at), 'MMM d, yyyy').toUpperCase() : '—'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <span className="badge badge-accent"><Shield size={10} /> Member</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>{user?.email}</span>
        </div>
      </div>

      {/* Edit profile */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.1em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
          EDIT PROFILE
        </h2>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '12px' }}>CHOOSE YOUR AVATAR</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '10px' }}>
              {getPresetAvatars().map(preset => {
                const isSelected = form.avatar_url === preset.id;
                return (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => setForm(f => ({ ...f, avatar_url: preset.id }))}
                    style={{
                      background: preset.bg,
                      border: isSelected ? `2px solid ${preset.color}` : `1px solid ${preset.border}`,
                      padding: '10px 6px 8px',
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? `0 0 12px ${preset.color}44` : 'none',
                      transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                    }}
                  >
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                      <img
                        src={`https://api.dicebear.com/9.x/${preset.style}/svg?seed=${encodeURIComponent(preset.seed)}&size=80&backgroundColor=transparent`}
                        alt={preset.label}
                        width={48}
                        height={48}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-body)', fontWeight: 600, color: isSelected ? preset.color : 'var(--text-secondary)', textAlign: 'center' }}>
                      {preset.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {[
            { label: 'FULL NAME', key: 'full_name', placeholder: 'Your name', type: 'text' },
            { label: 'AVATAR URL (OVERRIDE PRESET)', key: 'avatar_url', placeholder: 'https://...', type: 'url' },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key} style={{ marginBottom: '1rem' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>{label}</label>
              <input className="input-base" type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} />
            </div>
          ))}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>BIO</label>
            <textarea className="input-base" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell Shadow a little about yourself..." rows={3} style={{ resize: 'none' }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Save size={13} /> {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </form>
      </div>

      {/* 100% Local LLaMA AI Engine Status */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(0, 255, 170, 0.03)', borderColor: 'rgba(0, 255, 170, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Cpu size={16} color="#00ffaa" />
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.1em', color: '#00ffaa', textTransform: 'uppercase' }}>
            AI ENGINE: 100% LOCAL LLAMA ACTIVE
          </h2>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
          ShadowMind is configured to run completely using local LLaMA models and clinical CBT heuristics.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
            <CheckCircle size={13} color="#00ffaa" />
            <span>Zero Third-Party API Keys Required</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
            <CheckCircle size={13} color="#00ffaa" />
            <span>Zero API Quota or 429 Rate Limit Errors</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
            <CheckCircle size={13} color="#00ffaa" />
            <span>100% Private, Local Inference & Clinical Datasets</span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
          <Lock size={14} color="var(--text-secondary)" />
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.1em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            CHANGE PASSWORD
          </h2>
        </div>
        <form onSubmit={handlePasswordChange}>
          {[
            { label: 'CURRENT PASSWORD', key: 'current_password' },
            { label: 'NEW PASSWORD', key: 'new_password' },
            { label: 'CONFIRM NEW PASSWORD', key: 'confirm' },
          ].map(({ label, key }) => (
            <div key={key} style={{ marginBottom: '1rem' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>{label}</label>
              <input className="input-base" type="password" value={(pwForm as any)[key]} onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))} placeholder="••••••••" />
            </div>
          ))}
          <button type="submit" className="btn btn-primary" disabled={pwSaving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={13} /> {pwSaving ? 'UPDATING...' : 'UPDATE PASSWORD'}
          </button>
        </form>
      </div>

      {/* Export */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(68,136,255,0.03)', borderColor: 'rgba(68,136,255,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
          <Save size={14} color="#4488ff" />
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.1em', color: '#4488ff', textTransform: 'uppercase' }}>
            THERAPIST COMPANION EXPORT
          </h2>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
          Generate a 30-day comprehensive markdown report of your mood trends, journal summaries, and AI insights to share with your therapist.
        </p>
        <button onClick={handleExport} className="btn" style={{ border: '1px solid #4488ff', color: '#4488ff', background: 'transparent', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Save size={13} /> DOWNLOAD REPORT (.MD)
        </button>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ borderColor: 'rgba(255,0,0,0.4)', background: 'rgba(255,0,0,0.03)' }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.1em', color: 'var(--red-bright)', textTransform: 'uppercase', marginBottom: '1rem' }}>
          DANGER ZONE
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
          Permanently delete your account and all associated data — moods, journals, and chat sessions. This cannot be undone.
        </p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="btn" style={{ border: '1px solid rgba(255,0,0,0.4)', color: 'var(--red-bright)', background: 'transparent', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Trash2 size={13} /> DELETE ACCOUNT
          </button>
        ) : (
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--red-bright)', marginBottom: '0.75rem' }}>
              ARE YOU SURE? THIS IS PERMANENT.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleDelete} className="btn" style={{ background: 'var(--red-core)', color: '#fff', border: 'none' }}>
                YES, DELETE EVERYTHING
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn btn-ghost">CANCEL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
