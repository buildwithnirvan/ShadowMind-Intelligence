import { useState } from 'react';
import { User, ShieldCheck } from 'lucide-react';

/**
 * Modern High-Res Avatar Generators (DiceBear Lorelei & Bottts)
 * Professional, cyber-aesthetic, and sleek operator avatars.
 */
export interface AvatarPreset {
  id: string;
  label: string;
  seed: string;
  style: 'lorelei' | 'bottts-neutral' | 'adventurer';
  color: string;
  bg: string;
  border: string;
}

/** 8 sleek operator presets */
export const getPresetAvatars = (): AvatarPreset[] => [
  { id: 'preset:viper',   label: 'Viper (Tactical)',   seed: 'Felix',       style: 'lorelei',        color: '#ff3344', bg: 'rgba(255,51,68,0.14)',   border: 'rgba(255,51,68,0.35)' },
  { id: 'preset:nyx',     label: 'Nyx (Neural)',       seed: 'Aria',        style: 'lorelei',        color: '#38bdf8', bg: 'rgba(56,189,248,0.14)',  border: 'rgba(56,189,248,0.35)' },
  { id: 'preset:cipher',  label: 'Cipher (Cyber)',     seed: 'Marcus',      style: 'bottts-neutral', color: '#4ade80', bg: 'rgba(74,222,128,0.14)',  border: 'rgba(74,222,128,0.35)' },
  { id: 'preset:kael',    label: 'Kael (Architect)',   seed: 'Alexander',   style: 'lorelei',        color: '#c084fc', bg: 'rgba(192,132,252,0.14)', border: 'rgba(192,132,252,0.35)' },
  { id: 'preset:sora',    label: 'Sora (Bio-Mind)',    seed: 'Luna',        style: 'lorelei',        color: '#fb923c', bg: 'rgba(251,146,60,0.14)',  border: 'rgba(251,146,60,0.35)' },
  { id: 'preset:aero',    label: 'Aero (Pilot)',       seed: 'Oliver',      style: 'adventurer',     color: '#2dd4bf', bg: 'rgba(45,212,191,0.14)',  border: 'rgba(45,212,191,0.35)' },
  { id: 'preset:nova',    label: 'Nova (Quantum)',     seed: 'Nova',        style: 'bottts-neutral', color: '#e87522', bg: 'rgba(232,117,34,0.14)',   border: 'rgba(232,117,34,0.35)' },
  { id: 'preset:rowan',   label: 'Rowan (Clinical)',   seed: 'Elena',       style: 'lorelei',        color: '#eab308', bg: 'rgba(234,179,8,0.14)',   border: 'rgba(234,179,8,0.35)' },
];

/** Build the DiceBear URL for a given style & seed */
export function dicebearUrl(seed: string, style: string = 'lorelei', size = 96): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=${size}&backgroundColor=transparent`;
}

interface RenderAvatarProps {
  url?: string;
  user?: { avatar_url?: string; full_name?: string; username?: string } | null;
  /** Icon size in px for fallback */
  size?: number;
  /** Avatar display size in px for SVG fetch */
  avatarSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function RenderAvatar({
  url,
  user,
  size = 20,
  avatarSize = 96,
  className,
  style,
}: RenderAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const effectiveUrl = url ?? user?.avatar_url;

  const baseStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    overflow: 'hidden',
    position: 'relative',
    ...style,
  };

  /* ── No avatar set or image error ── */
  if (!effectiveUrl || imgError) {
    const initials = (user?.full_name || user?.username || 'OP').slice(0, 2).toUpperCase();
    return (
      <div
        style={{
          ...baseStyle,
          background: 'linear-gradient(135deg, rgba(255,51,68,0.2) 0%, rgba(15,18,26,0.9) 100%)',
          border: '1px solid var(--accent-border)',
        }}
        className={className}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: `${Math.max(10, size * 0.65)}px`,
            fontWeight: 700,
            color: 'var(--accent-bright)',
            letterSpacing: '0.05em',
          }}
        >
          {initials}
        </span>
      </div>
    );
  }

  /* ── Preset Operator Avatar ── */
  if (effectiveUrl.startsWith('preset:')) {
    const presets = getPresetAvatars();
    const preset = presets.find(p => p.id === effectiveUrl) || presets[0];
    const svgUrl = dicebearUrl(preset.seed, preset.style, avatarSize);

    return (
      <div
        style={{
          ...baseStyle,
          background: preset.bg,
          border: `1px solid ${preset.border}`,
        }}
        className={className}
        title={preset.label}
      >
        <img
          src={svgUrl}
          alt={preset.label}
          width={avatarSize}
          height={avatarSize}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  /* ── Custom URL (e.g. Google Profile Photo) ── */
  return (
    <div
      style={{
        ...baseStyle,
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid var(--border-mid)',
      }}
      className={className}
    >
      <img
        src={effectiveUrl}
        alt="User Avatar"
        referrerPolicy="no-referrer"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={() => setImgError(true)}
      />
    </div>
  );
}
