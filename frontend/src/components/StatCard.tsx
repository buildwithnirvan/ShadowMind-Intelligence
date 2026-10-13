import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub?: string;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  color = 'var(--accent)',
  trend,
  trendValue,
}: StatCardProps) {
  return (
    <div
      className="card animate-fade-in-up"
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '1.35rem 1.5rem',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '90px',
          height: '90px',
          background: `radial-gradient(circle, ${color}33 0%, transparent 70%)`,
          pointerEvents: 'none',
          borderRadius: '50%',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            letterSpacing: '0.12em',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: `${color}18`,
            border: `1px solid ${color}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 12px ${color}22`,
          }}
        >
          <Icon size={18} color={color} />
        </div>
      </div>

      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.1rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          {sub && (
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}
            >
              {sub}
            </div>
          )}
          {trendValue && (
            <span
              className={`badge ${
                trend === 'up' ? 'badge-success' : trend === 'down' ? 'badge-red' : 'badge-accent'
              }`}
              style={{ fontSize: '0.65rem', padding: '2px 8px' }}
            >
              {trendValue}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
