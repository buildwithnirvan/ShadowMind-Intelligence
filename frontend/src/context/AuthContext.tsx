import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  userLogin: (username: string, password: string) => Promise<User>;
  adminLogin: (username: string, password: string) => Promise<User>;
  register: (data: { username: string; password: string; confirm_password?: string; email?: string; full_name?: string }) => Promise<void>;
  googleLogin: (data: { credential?: string; token?: string; email?: string; name?: string; picture?: string; google_id?: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'shadowmind_token';
const USER_KEY = 'shadowmind_user';
const WELCOME_DISMISSED_KEY = 'shadowmind_welcome_dismissed';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Critical: automatic login across application restart is strictly disabled.
    // Clean up any lingering localStorage credentials so restarting the application
    // never restores an old session automatically.
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    // Active session is strictly maintained in sessionStorage for the lifetime of
    // the application window. Reopening the app produces a clean new session.
    const sessionToken = sessionStorage.getItem(TOKEN_KEY);
    const sessionUser = sessionStorage.getItem(USER_KEY);

    if (sessionToken && sessionUser) {
      try {
        setToken(sessionToken);
        setUser(JSON.parse(sessionUser));
      } catch {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      }
    } else {
      setToken(null);
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  const saveActiveSession = (accessToken: string, userData: User) => {
    setToken(accessToken);
    setUser(userData);

    // Store strictly in sessionStorage for the active window session
    sessionStorage.setItem(TOKEN_KEY, accessToken);
    sessionStorage.setItem(USER_KEY, JSON.stringify(userData));

    // Reset welcome dismissed flag so role-based welcome popup displays for the newly authenticated session
    sessionStorage.removeItem(WELCOME_DISMISSED_KEY);

    // Explicitly guarantee localStorage has no persistent credentials
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const login = async (identifier: string, password: string): Promise<User> => {
    const res = await authApi.login({ username: identifier, email: identifier, password });
    const { access_token, user: userData } = res.data;
    saveActiveSession(access_token, userData);
    return userData;
  };

  const userLogin = async (username: string, password: string): Promise<User> => {
    const res = await authApi.userLogin({ username, password });
    const { access_token, user: userData } = res.data;
    saveActiveSession(access_token, userData);
    return userData;
  };

  const adminLogin = async (username: string, password: string): Promise<User> => {
    const res = await authApi.adminLogin({ username, password });
    const { access_token, user: userData } = res.data;
    saveActiveSession(access_token, userData);
    return userData;
  };

  const register = async (data: { username: string; password: string; confirm_password?: string; email?: string; full_name?: string }): Promise<void> => {
    // Send registration request without auto-authenticating the session
    await authApi.register(data);
  };

  const googleLogin = async (data: { credential?: string; token?: string; email?: string; name?: string; picture?: string; google_id?: string }) => {
    const res = await authApi.googleLogin(data);
    const { access_token, user: userData } = res.data;
    saveActiveSession(access_token, userData);
  };

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(WELCOME_DISMISSED_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const refreshUser = async () => {
    try {
      const res = await authApi.me();
      setUser(res.data);
      sessionStorage.setItem(USER_KEY, JSON.stringify(res.data));
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        userLogin,
        adminLogin,
        register,
        googleLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
