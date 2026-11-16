import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

const USER_STORAGE_KEY = 'sale_tro_user';
const TOKEN_STORAGE_KEY = 'sale_tro_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Validate session with backend if token exists
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!savedToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const res = await api.getMe();
        if (isMounted && res?.user) {
          setUser(res.user);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
        }
      } catch (err) {
        // If 401 Unauthorized, token is expired or invalid
        if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('token'))) {
          if (isMounted) {
            setUser(null);
            setToken(null);
            localStorage.removeItem(USER_STORAGE_KEY);
            localStorage.removeItem(TOKEN_STORAGE_KEY);
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.login({ username, password });
    if (res?.token && res?.user) {
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
      return res.user;
    }
    throw new Error(res?.error || 'Đăng nhập không thành công');
  }, []);

  const register = useCallback(async (data) => {
    const res = await api.register(data);
    if (res?.token && res?.user) {
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
      return res.user;
    }
    throw new Error(res?.error || 'Đăng ký không thành công');
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  const isAdmin = Boolean(user && user.role === 'admin');
  const isSale = Boolean(user && (user.role === 'user' || user.role === 'sale'));
  const isUser = isSale;
  const isGuest = !user;

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login,
      logout,
      register,
      isAdmin,
      isSale,
      isUser,
      isGuest,
      isLoginModalOpen,
      openLoginModal,
      closeLoginModal,
    }),
    [user, token, isLoading, login, logout, register, isAdmin, isSale, isUser, isGuest, isLoginModalOpen, openLoginModal, closeLoginModal]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
