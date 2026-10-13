import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Theme = 'hawkins' | 'upside-down' | 'lab';

export const THEME_OPTIONS: { id: Theme; label: string; desc: string; hex: string }[] = [
  { id: 'hawkins', label: 'Hawkins', desc: 'Night-blue with neon red. The default.', hex: '#ff4a55' },
  { id: 'upside-down', label: 'Upside Down', desc: 'Cold, misty blue.', hex: '#5db7f2' },
  { id: 'lab', label: 'Hawkins Lab', desc: 'Warm amber, like the Christmas lights.', hex: '#f5b841' },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Kept for API compatibility: the brand palette no longer changes with mood score. */
  applyWellnessTheme: (score: number) => void;
  wellnessLabel: (score: number) => { label: string; cssClass: string; color: string };
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function wellnessLabel(score: number): { label: string; cssClass: string; color: string } {
  if (score >= 7.5) return { label: 'Thriving', cssClass: 'wellness-high', color: '#3ecf8e' };
  if (score >= 5.0) return { label: 'Coping', cssClass: 'wellness-mid', color: '#f5b841' };
  if (score >= 2.5) return { label: 'Struggling', cssClass: 'wellness-low', color: '#f97316' };
  return { label: 'Needs support', cssClass: 'wellness-crisis', color: '#ff4a55' };
}

const isTheme = (v: string | null): v is Theme => v === 'hawkins' || v === 'upside-down' || v === 'lab';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('shadowmind_theme');
    return isTheme(saved) ? saved : 'hawkins';   // old themes (jarvis, matrix…) migrate to Hawkins
  });

  const applyClass = useCallback((t: Theme) => {
    Array.from(document.body.classList).filter(c => c.startsWith('theme-')).forEach(c => document.body.classList.remove(c));
    document.body.classList.add(`theme-${t}`);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem('shadowmind_theme', t);
    applyClass(t);
  }, [applyClass]);

  const applyWellnessTheme = useCallback(() => { /* intentionally a no-op */ }, []);

  useEffect(() => { applyClass(theme); }, [theme, applyClass]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, applyWellnessTheme, wellnessLabel }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
