import { MOOD_LABELS } from '../types';

interface MoodPickerProps {
  value: string;
  onChange: (label: string) => void;
}

const MOOD_COLORS: Record<string, string> = {
  anxious: '#f97316',
  angry: '#ef4444',
  sad: '#38bdf8',
  depressed: '#8b5cf6',
  numb: '#64748b',
  neutral: '#94a3b8',
  calm: '#06b6d4',
  content: '#22c55e',
  happy: '#eab308',
  euphoric: '#f28c28',
  stressed: '#f59e0b',
  overwhelmed: '#dc2626',
  hopeful: '#38bdf8',
  grateful: '#10b981',
  focused: '#6366f1',
};

export default function MoodPicker({ value, onChange }: MoodPickerProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {MOOD_LABELS.map((label) => {
        const selected = value === label;
        const color = MOOD_COLORS[label] || 'var(--accent)';
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(label)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              border: `1px solid ${selected ? color : 'rgba(255,255,255,0.1)'}`,
              background: selected ? `${color}25` : 'rgba(255,255,255,0.03)',
              color: selected ? '#ffffff' : 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              fontWeight: selected ? 700 : 500,
              fontSize: '0.78rem',
              letterSpacing: '0.02em',
              cursor: 'pointer',
              transition: 'var(--transition)',
              boxShadow: selected ? `0 0 14px ${color}40, inset 0 0 8px ${color}20` : 'none',
              transform: selected ? 'scale(1.04)' : 'scale(1)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: color,
                boxShadow: selected ? `0 0 8px ${color}` : 'none',
              }}
            />
            {label.charAt(0).toUpperCase() + label.slice(1)}
          </button>
        );
      })}
    </div>
  );
}
