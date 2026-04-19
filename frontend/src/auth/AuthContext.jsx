import { createContext, useContext, useState, useCallback } from 'react';
import * as authApi from '../api/auth.js';

const TOKEN_KEY = 'pp_token';
const USER_KEY  = 'pp_user';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  });

  const isLoggedIn = !!token;

  /**
   * Calls POST /api/auth/login.
   * Returns true on success, throws on failure so Login.jsx can show the error message.
   */
  const login = useCallback(async (username, password) => {
    const res = await authApi.login(username, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY,  JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
