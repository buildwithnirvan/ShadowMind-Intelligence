import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#000', fontFamily: 'var(--font-mono)',
        color: 'var(--red-core)', fontSize: '0.9rem', letterSpacing: '0.1em',
      }}>
        <span>INITIALIZING SHADOW AI<span className="animate-blink">_</span></span>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
