import { useState, useEffect, useCallback } from 'react';
import { ClientAuthService, SafeUser } from '../services/auth-service.js';

export function useAuth() {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const current = await ClientAuthService.getMe();
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (loginId: string, pass: string) => {
    const result = await ClientAuthService.login(loginId, pass);
    setUser(result.user);
    return result;
  };

  const register = async (params: {
    handle: string;
    email: string;
    password: string;
    displayName?: string;
  }) => {
    const result = await ClientAuthService.register(params);
    setUser(result.user);
    return result;
  };

  const logout = async () => {
    await ClientAuthService.logout();
    setUser(null);
  };

  const verifyEmail = async (code: string) => {
    await ClientAuthService.verifyEmail(code);
    await refreshUser();
  };

  const resendCode = async () => {
    await ClientAuthService.resendCode();
  };

  return {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
    verifyEmail,
    resendCode,
    refreshUser,
  };
}
