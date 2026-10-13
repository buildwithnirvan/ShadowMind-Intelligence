import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useEffect, useRef } from 'react';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const toastFired = useRef(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role !== 'admin' && !toastFired.current) {
      toast.error('Access denied: Administrator privileges required.');
      toastFired.current = true;
    }
  }, [isLoading, isAuthenticated, user]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#050a14',
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent-bright)',
          fontSize: '0.9rem',
          letterSpacing: '0.1em',
        }}
      >
        <span>VERIFYING ADMINISTRATIVE ACCESS<span className="animate-blink">_</span></span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login/admin" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
}
