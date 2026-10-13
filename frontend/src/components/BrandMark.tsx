import React from 'react';

export interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  subtitle?: string;
  showLogo?: boolean;
  showText?: boolean;
  layout?: 'row' | 'column';
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export default function BrandMark({
  size = 'md',
  subtitle,
  showLogo = true,
  showText = true,
  layout,
  align,
  className = '',
}: BrandMarkProps) {
  // Sizing matrix
  const isLarge = size === 'lg' || size === 'xl';
  const effectiveLayout = layout || (isLarge ? 'column' : 'row');
  const effectiveAlign = align || (effectiveLayout === 'column' ? 'center' : 'left');

  const logoDims = {
    sm: 32,
    md: 44,
    lg: 68,
    xl: 96,
  }[size];

  const fontSize = {
    sm: '1.05rem',
    md: '1.35rem',
    lg: '2.2rem',
    xl: '2.8rem',
  }[size];

  const gap = {
    sm: '10px',
    md: '12px',
    lg: '14px',
    xl: '18px',
  }[size];

  return (
    <div
      className={`brand-mark-container ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: effectiveLayout,
        alignItems: effectiveAlign === 'center' ? 'center' : effectiveAlign === 'right' ? 'flex-end' : 'flex-start',
        justifyContent: effectiveAlign === 'center' ? 'center' : effectiveAlign === 'right' ? 'flex-end' : 'flex-start',
        gap,
        textAlign: effectiveAlign,
        userSelect: 'none',
      }}
    >
      {showLogo && (
        <div
          className="shadowmind-logo-wrapper"
          style={{
            width: logoDims,
            height: logoDims,
            borderRadius: '50%',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 18px rgba(232, 117, 34, 0.45), 0 0 32px rgba(46, 111, 145, 0.4)',
            border: '1.5px solid rgba(255, 255, 255, 0.22)',
            overflow: 'hidden',
            flexShrink: 0,
            background: '#040711',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          <img
            src="/assets/shadowmind-blackhole.png"
            alt="ShadowMind Logo"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              filter: 'contrast(1.08) brightness(1.05)',
            }}
          />
        </div>
      )}

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: effectiveAlign === 'center' ? 'center' : 'flex-start' }}>
          <div
            className="brand-logo-text neon-flicker"
            style={{
              fontSize,
              lineHeight: 1.1,
              fontFamily: 'var(--font-logo)',
              fontWeight: 800,
              letterSpacing: '0.04em',
              background: 'linear-gradient(135deg, #ffffff 40%, #f28c28 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: 'none',
            }}
          >
            ShadowMind
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: size === 'xl' ? '0.85rem' : size === 'lg' ? '0.78rem' : '0.68rem',
                color: 'var(--text-muted)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
                marginTop: 4,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
