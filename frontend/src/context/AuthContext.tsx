import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, type User } from "../api/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  googleEnabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  const refresh = async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    Promise.all([
      refresh(),
      authApi.config().then((c) => setGoogleEnabled(c.google_enabled)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const me = await authApi.login(email, password);
    setUser(me);
  };

  const register = async (email: string, password: string) => {
    const me = await authApi.register(email, password);
    setUser(me);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, googleEnabled, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
