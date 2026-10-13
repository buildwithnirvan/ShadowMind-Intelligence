/** Single source of truth for crisis helplines shown across the app (India first). */
export interface Helpline { name: string; contact: string; dial: string; note?: string; region: 'IN' | 'US' }

export const HELPLINES: Helpline[] = [
  { name: 'Tele-MANAS (Govt. of India)', contact: '14416', dial: '14416', note: 'Free · 24/7 · 20+ languages · also 1800-891-4416', region: 'IN' },
  { name: 'Vandrevala Foundation', contact: '+91 9999 666 555', dial: '+919999666555', note: '24/7 · call or WhatsApp', region: 'IN' },
  { name: 'iCall (TISS)', contact: '+91 9152987821', dial: '+919152987821', note: 'Mon–Sat, 10am–8pm · non-emergency counselling', region: 'IN' },
  { name: 'Emergency services', contact: '112', dial: '112', note: 'Police, ambulance, fire', region: 'IN' },
  { name: '988 Suicide & Crisis Lifeline', contact: '988', dial: '988', note: 'United States · call or text', region: 'US' },
];
