import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

interface ExitContextType {
  isExitOpen: boolean;
  isExited: boolean;
  openExitDialog: () => void;
  closeExitDialog: () => void;
  confirmExit: () => void;
  resetExited: () => void;
}

const ExitContext = createContext<ExitContextType | null>(null);

export function ExitProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const [isExitOpen, setIsExitOpen] = useState(false);
  const [isExited, setIsExited] = useState(false);
  const isTerminatingRef = useRef(false);

  const openExitDialog = useCallback(() => {
    if (isTerminatingRef.current) return;
    setIsExitOpen(true);
  }, []);

  const closeExitDialog = useCallback(() => {
    setIsExitOpen(false);
  }, []);

  const confirmExit = useCallback(() => {
    if (isTerminatingRef.current) return;
    isTerminatingRef.current = true;
    setIsExitOpen(false);

    // 1. Clear session and transient credentials
    try {
      logout();
      sessionStorage.clear();
      localStorage.removeItem('shadowmind_token');
      localStorage.removeItem('shadowmind_user');
      localStorage.removeItem('shadowmind_welcome_dismissed');
    } catch {
      // Ignore storage errors on exit
    }

    // 2. Notify Electron main process if running inside Electron desktop container
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && typeof electronAPI.exitApp === 'function') {
      try {
        electronAPI.exitApp();
        return;
      } catch {
        // Fall back to window close
      }
    }

    // 3. Attempt clean window close for desktop window / tab
    try {
      window.close();
    } catch {
      // Browser may restrict window.close() for windows not opened by script
    }

    // 4. Mark application exited state
    setIsExited(true);
  }, [logout]);

  const resetExited = useCallback(() => {
    isTerminatingRef.current = false;
    setIsExited(false);
    window.location.href = '/login';
  }, []);

  // Intercept window close / reload when authenticated
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // If already terminating cleanly via Exit confirmation, do not interrupt
      if (isTerminatingRef.current) return;

      if (isAuthenticated) {
        // Intercept normal close / unload event with confirmation prompt
        const confirmationMessage =
          "You're about to close ShadowMind AI. Your current session will end, and you will need to log in again the next time you open the application. Do you want to exit now?";
        e.preventDefault();
        e.returnValue = confirmationMessage;
        return confirmationMessage;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthenticated]);

  // Support Electron IPC clear-session if running in Electron
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && typeof electronAPI.onClearSession === 'function') {
      electronAPI.onClearSession(() => {
        try {
          logout();
          sessionStorage.clear();
          localStorage.removeItem('shadowmind_token');
          localStorage.removeItem('shadowmind_user');
        } catch {
          // ignore
        }
      });
    }
  }, [logout]);

  return (
    <ExitContext.Provider
      value={{
        isExitOpen,
        isExited,
        openExitDialog,
        closeExitDialog,
        confirmExit,
        resetExited,
      }}
    >
      {children}
    </ExitContext.Provider>
  );
}

export function useExit() {
  const ctx = useContext(ExitContext);
  if (!ctx) {
    throw new Error('useExit must be used within ExitProvider');
  }
  return ctx;
}
