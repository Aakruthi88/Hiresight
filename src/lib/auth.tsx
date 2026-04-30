"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  user_id: string;
  email: string;
  role: "candidate" | "recruiter";
  full_name: string;
  access_token: string;
  refresh_token?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (
    email: string,
    password: string,
    role: "candidate" | "recruiter",
    full_name: string
  ) => Promise<AuthUser>;
  logout: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "talentlens_auth";
const API = "http://localhost:8000";

// ── Centralized Auth Utilities (New) ──────────────────────────────────────────
const PREFIX = "tl_";

export const saveAuth = (token: string, role: string, userId: string, fullName: string) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${PREFIX}token`, token);
  localStorage.setItem(`${PREFIX}role`, role);
  localStorage.setItem(`${PREFIX}userId`, userId);
  localStorage.setItem(`${PREFIX}fullName`, fullName);
  
  // Keep legacy key synced for existing components
  const legacyData = {
    access_token: token,
    role: role,
    user_id: userId,
    full_name: fullName
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyData));
};

export const getAuth = () => {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(`${PREFIX}token`);
  const role = localStorage.getItem(`${PREFIX}role`);
  const userId = localStorage.getItem(`${PREFIX}userId`);
  const fullName = localStorage.getItem(`${PREFIX}fullName`);
  
  if (token) return { token, role, userId, fullName };

  // Fallback to legacy key
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      return {
        token: data.access_token,
        role: data.role,
        userId: data.user_id,
        fullName: data.full_name
      };
    } catch { return null; }
  }
  return null;
};

export const clearAuth = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${PREFIX}token`);
  localStorage.removeItem(`${PREFIX}role`);
  localStorage.removeItem(`${PREFIX}userId`);
  localStorage.removeItem(`${PREFIX}fullName`);
  localStorage.removeItem(STORAGE_KEY);
};

export const isAuthenticated = () => {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(`${PREFIX}token`) || !!localStorage.getItem(STORAGE_KEY);
};

export const getAuthHeaders = () => {
  if (typeof window === "undefined") return {};
  const auth = getAuth();
  return auth?.token ? { Authorization: `Bearer ${auth.token}` } : {};
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persist = (u: AuthUser | null) => {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
    setUser(u);
  };

// ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail ?? "Login failed");
    }
    const data = await res.json();
    const authUser: AuthUser = {
      user_id:       data.user_id,
      email:         data.email,
      role:          data.role,
      full_name:     data.full_name,
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
    };
    
    // Use new saveAuth utility
    saveAuth(data.access_token, data.role, data.user_id, data.full_name);
    setUser(authUser);
    return authUser;
  }, []);

  // ── Signup ─────────────────────────────────────────────────────────────────
  const signup = useCallback(
    async (
      email: string,
      password: string,
      role: "candidate" | "recruiter",
      full_name: string
    ): Promise<AuthUser> => {
      const res = await fetch(`${API}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role, full_name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Sign-up failed" }));
        throw new Error(err.detail ?? "Sign-up failed");
      }
      const data = await res.json();
      const authUser: AuthUser = {
        user_id:      data.user_id,
        email:        data.email,
        role:         data.role,
        full_name:    full_name,
        access_token: data.access_token,
      };
      
      // Use new saveAuth utility
      saveAuth(data.access_token, data.role, data.user_id, full_name);
      setUser(authUser);
      return authUser;
    },
    []
  );

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
