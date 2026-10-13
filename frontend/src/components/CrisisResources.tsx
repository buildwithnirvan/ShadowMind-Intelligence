import { useState } from 'react';
import { AlertTriangle, X, Phone } from 'lucide-react';
import { HELPLINES } from '../constants/resources';

export default function CrisisResources({ inline = false }: { inline?: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed && !inline) return null;

  return (
    <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-sm)', padding: '1.1rem 1.4rem', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '0.9rem' }}>
        <AlertTriangle size={17} color="var(--accent-bright)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--accent-bright)', marginBottom: '2px' }}>Support is available</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            If you're in crisis or feeling unsafe, please reach out. You're not alone.
          </p>
        </div>
        {!inline && (
          <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
            <X size={14} />
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {HELPLINES.map((r) => (
          <a key={r.name} href={`tel:${r.dial}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.name}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-bright)', fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Phone size={11} /> {r.contact}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
