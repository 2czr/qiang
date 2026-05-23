"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface AdminPermissions {
  canPin: boolean;
  canDelete: boolean;
  canViewUser: boolean;
  canManageRole: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  role: string;
  status: string;
  permissions: AdminPermissions | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname: string, deviceId?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const savedToken = localStorage.getItem("session_token");
    if (!savedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(savedToken);
      } else {
        localStorage.removeItem("session_token");
        setUser(null);
        setToken(null);
      }
    } catch {
      if (savedToken) setToken(savedToken);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "登录失败");
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("session_token", data.token);
  };

  const register = async (username: string, password: string, nickname: string, deviceId?: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, nickname, device_id: deviceId || "" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "注册失败");
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("session_token", data.token);
  };

  const logout = () => {
    localStorage.removeItem("session_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

/** 带认证的fetch - 每次从localStorage读取token，避免闭包陷阱 */
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const t = localStorage.getItem("session_token");
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {};

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
    // Merge caller's headers
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((v, k) => { headers[k] = v; });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([k, v]) => { headers[k] = v; });
      } else {
        Object.assign(headers, options.headers as Record<string, string>);
      }
    }
  }

  if (t) {
    headers["Authorization"] = `Bearer ${t}`;
  }

  return fetch(url, { ...options, headers });
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
