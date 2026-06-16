import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import { loadProfilePhotoObjectUrl } from '../utils/profilePhoto';
import type { AuthUser } from '../types';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  photoSrc: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);

  const loadPhoto = useCallback(async (photoUrl: string | null | undefined) => {
    if (!photoUrl) {
      setPhotoSrc(null);
      return;
    }
    try {
      const src = await loadProfilePhotoObjectUrl(photoUrl);
      setPhotoSrc(src);
    } catch {
      setPhotoSrc(null);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api<AuthUser>('/auth/me');
      setUser(me);
      await loadPhoto(me.profilePhotoUrl);
    } catch {
      setUser(null);
      setPhotoSrc(null);
    }
  }, [loadPhoto]);

  const login = useCallback(async (email: string, password: string) => {
    await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await refreshMe();
  }, [refreshMe]);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const me = await api<AuthUser>('/auth/me');
        if (!cancelled) {
          setUser(me);
          await loadPhoto(me.profilePhotoUrl);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPhoto]);

  const value = useMemo(
    () => ({
      user,
      loading,
      photoSrc,
      login,
      logout,
      refreshMe,
    }),
    [user, loading, photoSrc, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
