import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApiClient, SessionIdentity, LoginInput, RegisterInput } from '../../services/auth-api-client.js';
import { localClientStorage } from '../../services/local-storage-service.js';

interface AuthContextType {
  user: SessionIdentity | null;
  isGuest: boolean;
  isLoading: boolean;
  pendingGuestCount: number;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  skipToGuest: () => void;
  importGuestProgress: () => Promise<number>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionIdentity | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pendingGuestCount, setPendingGuestCount] = useState<number>(0);

  const checkGuestCount = useCallback(async () => {
    try {
      const items = await localClientStorage.getAllGuestProgress();
      setPendingGuestCount(items.length);
    } catch {
      setPendingGuestCount(0);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const session = await authApiClient.getSession();
      if (session) {
        setUser(session);
        setIsGuest(false);
        localStorage.removeItem('kura_guest_mode');
      } else {
        setUser(null);
        const savedGuest = localStorage.getItem('kura_guest_mode') === 'true';
        setIsGuest(savedGuest);
      }
    } catch {
      setUser(null);
      const savedGuest = localStorage.getItem('kura_guest_mode') === 'true';
      setIsGuest(savedGuest);
    } finally {
      setIsLoading(false);
      checkGuestCount();
    }
  }, [checkGuestCount]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (input: LoginInput) => {
    const res = await authApiClient.login(input);
    setUser(res.identity);
    setIsGuest(false);
    localStorage.removeItem('kura_guest_mode');
    await checkGuestCount();
  };

  const register = async (input: RegisterInput) => {
    const res = await authApiClient.register(input);
    setUser(res.identity);
    setIsGuest(false);
    localStorage.removeItem('kura_guest_mode');
    await checkGuestCount();
  };

  const logout = async () => {
    await authApiClient.logout();
    await localClientStorage.clearAccountLocalData();
    setUser(null);
    setIsGuest(false);
    localStorage.removeItem('kura_guest_mode');
    await checkGuestCount();
  };

  const skipToGuest = () => {
    setIsGuest(true);
    localStorage.setItem('kura_guest_mode', 'true');
    checkGuestCount();
  };

  const importGuestProgress = async (): Promise<number> => {
    const res = await localClientStorage.importGuestProgressToAccount();
    await checkGuestCount();
    return res.importedCount;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isGuest,
        isLoading,
        pendingGuestCount,
        login,
        register,
        logout,
        skipToGuest,
        importGuestProgress,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
