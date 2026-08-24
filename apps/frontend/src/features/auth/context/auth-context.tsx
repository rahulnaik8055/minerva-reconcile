'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '@/services/auth.service';
import type { LoginInput, RegisterInput, User } from '@/types';

interface AuthContextValue {
  currentUser: User | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    authService
      .getMe()
      .then((user) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch(() => {
        if (!cancelled) setCurrentUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const response = await authService.login(input);
    setCurrentUser(response.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const response = await authService.register(input);
    setCurrentUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // The token may already be invalid; client state is cleared regardless.
    }
    setCurrentUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      login,
      register,
      logout,
      isAuthenticated: currentUser !== null,
      loading,
    }),
    [currentUser, login, register, logout, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
