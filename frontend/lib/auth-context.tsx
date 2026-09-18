"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { clearToken, getMe, getToken, login as apiLogin, setToken, type LoginRequest, type UserMe } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthContextValue {
  user: UserMe | null;
  isLoading: boolean;
  login: (creds: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // On mount, check if we have a valid token
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    getMe()
      .then((u) => {
        setUser(u);
      })
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(
    async (creds: LoginRequest) => {
      const res = await apiLogin(creds);
      setToken(res.access_token);
      const me = await getMe();
      setUser(me);
    },
    []
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
