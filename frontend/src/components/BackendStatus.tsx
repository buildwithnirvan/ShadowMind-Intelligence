import { useState, useEffect } from 'react';

export default function BackendStatus() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('/health', { signal: AbortSignal.timeout(2000) });
        setOnline(r.ok);
      } catch {
        setOnline(false);
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: '1.5rem',
      right: '1.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--border-dim)',
      borderRadius: '20px',
      zIndex: 10,
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: online === null ? 'var(--text-muted)' : online ? '#44dd88' : 'var(--accent-bright)',
        boxShadow: online ? '0 0 6px #44dd8888' : undefined
      }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {online === null ? 'Checking API...' : online ? 'Backend Online' : 'Backend Offline'}
      </span>
    </div>
  );
}
