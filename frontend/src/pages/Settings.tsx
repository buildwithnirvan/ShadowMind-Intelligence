import { useState, useEffect } from 'react';
import { useTheme, THEME_OPTIONS, Theme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Palette, Bot, Bell, Shield, Database, Check, ChevronRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

type Tab = 'appearance' | 'ai' | 'notifications' | 'privacy' | 'data';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'ai', label: 'AI engine', icon: Bot },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'data', label: 'Data', icon: Database },
];

interface AiStatus { order: string[]; anthropic: boolean; groq: boolean; ollama: boolean; fallback: string }

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('appearance');
  const [notifs, setNotifs] = useState({ daily: true, weekly: true, alerts: false });
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'ai' || aiStatus) return;
    setAiLoading(true);
    api.get('/chat/status').then(r => setAiStatus(r.data)).catch(() => setAiStatus(null)).finally(() => setAiLoading(false));
  }, [tab, aiStatus]);

  const pickTheme = (t: Theme) => { setTheme(t); toast.success(`Theme set to ${THEME_OPTIONS.find(o => o.id === t)?.label}`); };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} aria-pressed={value}
      style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: value ? 'var(--accent)' : 'var(--bg-elevated)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', left: value ? 23 : 3, transition: 'left .2s' }} />
    </button>
  );

  const providerRow = (label: string, connected: boolean, note: string) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-dim)' }}>
      <div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{note}</div>
      </div>
      <span className={`badge ${connected ? 'badge-success' : 'badge-warning'}`}>{connected ? 'Connected' : 'Not configured'}</span>
    </div>
  );

  return (
    <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '920px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configuring preferences for @{user?.username}</p>
      </div>

      <div style={{ display: 'flex', gap: '3px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-dim)', overflowX: 'auto' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className="btn"
            style={{ background: tab === id ? 'var(--accent-subtle)' : 'transparent', borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent', color: tab === id ? 'var(--accent-bright)' : 'var(--text-secondary)', borderRadius: '6px 6px 0 0', padding: '.5rem .9rem', fontSize: '.78rem', gap: '5px', whiteSpace: 'nowrap' }}>
            <Icon size={13} /><span>{label}</span>
          </button>
        ))}
      </div>

      {tab === 'appearance' && (
        <div className="animate-fade-in-up">
          <div className="card">
            <div className="section-label" style={{ marginBottom: '1rem' }}>Theme</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Choose the palette that frames the whole app.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: '8px' }}>
              {THEME_OPTIONS.map(t => {
                const active = theme === t.id;
                return (
                  <button key={t.id} onClick={() => pickTheme(t.id)}
                    style={{ background: active ? `${t.hex}14` : 'var(--bg-elevated)', border: `1px solid ${active ? t.hex : 'var(--border-dim)'}`, borderRadius: '8px', padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all .18s', position: 'relative' }}>
                    {active && <div style={{ position: 'absolute', top: 10, right: 10 }}><Check size={13} color={t.hex} /></div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.hex, boxShadow: `0 0 6px ${t.hex}88` }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: active ? t.hex : 'var(--text-primary)' }}>{t.label}</span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'ai' && (
        <div className="animate-fade-in-up">
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <Bot size={16} color="var(--accent)" />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Chat intelligence</span>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '1.1rem', lineHeight: 1.65 }}>
              Shadow tries each configured AI provider in order and falls back to a built-in offline
              responder if none are reachable, so you always get a thoughtful reply, never an error.
              Providers are set by whoever is running this ShadowMind server.
            </p>
            {aiLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Loader2 size={14} className="animate-spin" /> Checking providers…
              </div>
            ) : aiStatus ? (
              <div>
                {providerRow('Claude (Anthropic)', aiStatus.anthropic, 'Highest quality; used first when configured')}
                {providerRow('Groq (Llama 3.3)', aiStatus.groq, 'Fast cloud fallback')}
                {providerRow('Ollama (local model)', aiStatus.ollama, 'Runs fully on this machine, no data leaves it')}
                {providerRow('Offline responder', true, 'Built-in, always available, used if nothing above is reachable')}
              </div>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Couldn't reach the server to check provider status.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="animate-fade-in-up">
          <div className="card">
            <div className="section-label" style={{ marginBottom: '1rem' }}>Notification preferences</div>
            {[
              { key: 'daily' as const, label: 'Daily mood reminder', desc: 'A gentle prompt to log your mood once a day' },
              { key: 'weekly' as const, label: 'Weekly summary', desc: 'A short recap of your week, every Sunday' },
              { key: 'alerts' as const, label: 'Mood dip alerts', desc: 'Let me check in if your mood drops sharply' },
            ].map(({ key, label, desc }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-dim)' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{desc}</div>
                </div>
                <Toggle value={notifs[key]} onChange={v => { setNotifs(n => ({ ...n, [key]: v })); toast.success('Saved'); }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'privacy' && (
        <div className="animate-fade-in-up">
          <div className="card">
            <div className="section-label" style={{ marginBottom: '1rem' }}>Privacy & security</div>
            {[
              { label: 'Chat processing', value: 'Sent to your configured AI provider, or handled fully offline if none is set', icon: '🔒' },
              { label: 'Data storage', value: "Kept in this server's own MongoDB database", icon: '💾' },
              { label: 'Authentication', value: 'JWT session tokens, bcrypt-hashed passwords', icon: '🛡️' },
              { label: 'Crisis detection', value: 'Runs locally on your message text before anything is sent anywhere', icon: '🤝' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-dim)', gap: 12 }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{item.label}</span>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', maxWidth: '230px', textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="animate-fade-in-up">
          <div className="card">
            <div className="section-label" style={{ marginBottom: '1rem' }}>Data management</div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.65 }}>
              Everything you log lives in this server's database. Export is coming soon.
            </p>
            {['Export moods (JSON)', 'Export journals (JSON)', 'Export full archive'].map(label => (
              <button key={label} onClick={() => toast('Export is coming soon')} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>{label}</span><ChevronRight size={13} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
