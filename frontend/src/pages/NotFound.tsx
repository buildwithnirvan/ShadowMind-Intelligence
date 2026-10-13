import { Link } from 'react-router-dom';
import Atmosphere from '../components/Atmosphere';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-void)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', flexDirection: 'column', gap: '1.25rem', textAlign: 'center',
    }}>
      <Atmosphere density={20} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="brand-logo-text" style={{ fontSize: '5rem', lineHeight: 1 }}>404</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          We couldn't find that page.
        </div>
        <Link to="/mood" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '1.75rem', textDecoration: 'none' }}>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
