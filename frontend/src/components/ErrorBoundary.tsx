import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center', background: 'var(--bg-base)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,51,51,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <AlertTriangle size={32} color="#ff3333" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            Temporary Interface Issue
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', marginBottom: '1.75rem', maxWidth: '440px', lineHeight: 1.6 }}>
            ShadowMind encountered a display hiccup while loading this view. Your saved records and personal data remain safe and preserved.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/mood';
              }} 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.65rem 1.25rem' }}
            >
              Return to Mood Space
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.65rem 1.25rem' }}
            >
              <RefreshCw size={15} /> Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
