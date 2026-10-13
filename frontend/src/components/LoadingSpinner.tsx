interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

export default function LoadingSpinner({
  message = 'LOADING',
  size = 'md',
  fullPage = false,
}: LoadingSpinnerProps) {
  const logoDim = size === 'sm' ? 24 : size === 'lg' ? 56 : 38;
  const ringDim = size === 'sm' ? 36 : size === 'lg' ? 76 : 54;
  const fontSize = size === 'sm' ? '0.65rem' : size === 'lg' ? '0.85rem' : '0.72rem';

  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
      <div style={{ position: 'relative', width: ringDim, height: ringDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Orbital spinner ring */}
        <svg
          width={ringDim}
          height={ringDim}
          viewBox="0 0 50 50"
          style={{ position: 'absolute', inset: 0, animation: 'spin 1.4s linear infinite' }}
        >
          <circle
            cx="25" cy="25" r="21"
            fill="none"
            stroke="#27B8FF"
            strokeWidth="3"
            strokeDasharray="65 45"
            strokeLinecap="round"
            opacity="0.85"
          />
          <circle
            cx="25" cy="25" r="21"
            fill="none"
            stroke="#FF8A24"
            strokeWidth="3"
            strokeDasharray="35 75"
            strokeLinecap="round"
            opacity="0.95"
          />
        </svg>

        {/* Central Black-Hole Logo */}
        <div
          style={{
            width: logoDim,
            height: logoDim,
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: '0 0 14px rgba(255, 138, 36, 0.4), 0 0 18px rgba(39, 184, 255, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: '#05070B',
          }}
        >
          <img
            src="/assets/shadowmind-blackhole.png"
            alt="ShadowMind"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      </div>

      {message && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize,
            color: 'var(--text-secondary)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {message}
          <span style={{ animation: 'blink 1s step-end infinite', color: '#FF8A24' }}>_</span>
        </span>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
      `}</style>
    </div>
  );

  if (fullPage) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 7, 11, 0.88)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        {inner}
      </div>
    );
  }

  return inner;
}
