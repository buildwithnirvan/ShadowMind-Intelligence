const COLORS = ['#ff4a55', '#f5b841', '#4aa3df', '#3ecf8e', '#ff4a55', '#f5b841', '#4aa3df'];

/** Joyce's wall of lights, as a restrained strand across the top of auth pages. */
export default function ChristmasLights({ count = 18 }: { count?: number }) {
  return (
    <div className="lights" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="bulb" style={{ ['--c' as string]: COLORS[i % COLORS.length], animationDelay: `${(i * 0.37) % 3}s` }} />
      ))}
    </div>
  );
}
