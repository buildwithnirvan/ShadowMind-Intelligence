import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PhoneCall, X, ShieldAlert } from 'lucide-react';
import { HELPLINES } from '../constants/resources';

interface Props { onClose: () => void; urgent?: boolean }

/** Always-available "I need help now" panel (header SOS button + chat crisis alert). */
export default function CrisisDialog({ onClose, urgent = false }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Crisis support" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(2,4,8,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
      <div className="card animate-fade-in-scale" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, width: '100%', maxHeight: '92vh', overflowY: 'auto', borderColor: 'var(--accent-border)', boxShadow: '0 0 40px var(--accent-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <ShieldAlert size={26} color="var(--accent-bright)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.25rem' }}>{urgent ? 'You are not alone.' : 'Support is available right now'}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
              {urgent
                ? "What you wrote sounds really painful. Please reach out to someone now. You don't have to carry this by yourself."
                : 'If you are in distress or thinking about harming yourself, talk to a trained person. These lines are free and confidential.'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm" style={{ padding: 6 }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {HELPLINES.map((h) => (
            <a key={h.name} href={`tel:${h.dial}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.7rem 0.9rem', borderRadius: 10, border: '1px solid var(--border-mid)', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ background: 'var(--accent)', borderRadius: '50%', padding: 8, display: 'flex' }}><PhoneCall size={16} color="#fff" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{h.name}</div>
                  {h.note && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{h.note}</div>}
                </div>
                <div style={{ fontWeight: 700, color: 'var(--accent-bright)', whiteSpace: 'nowrap' }}>{h.contact}</div>
              </div>
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <Link to="/safety" onClick={onClose} className="btn btn-primary btn-sm">My safety plan</Link>
          <Link to="/help" onClick={onClose} className="btn btn-ghost btn-sm">More resources</Link>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>I'm safe, close</button>
        </div>
      </div>
    </div>
  );
}
