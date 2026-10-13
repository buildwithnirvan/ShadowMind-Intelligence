import { useEffect, useRef } from 'react';

/** Slow-drifting "spores" like the Upside Down, plus vignette and film grain. Subtle by design. */
export default function Atmosphere({ density = 38 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0, w = 0, h = 0;
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const spores = Array.from({ length: density }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + 0.4,
      vy: -(Math.random() * 0.18 + 0.04), vx: (Math.random() - 0.5) * 0.12, a: Math.random() * 0.35 + 0.1, p: Math.random() * 6.28,
    }));

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of spores) {
        s.x += s.vx + Math.sin(s.p += 0.004) * 0.08;
        s.y += s.vy;
        if (s.y < -5) { s.y = h + 5; s.x = Math.random() * w; }
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${s.a})`;
        ctx.arc(s.x, s.y, s.r, 0, 6.28);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [density]);

  return (
    <>
      <div className="atmosphere"><canvas ref={ref} style={{ width: '100%', height: '100%', opacity: 0.55 }} /></div>
      <div className="grain" />
    </>
  );
}
