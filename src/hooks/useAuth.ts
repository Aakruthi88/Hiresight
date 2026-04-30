"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth, clearAuth } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      setIsLoading(false);
      return;
    }

    // Verify token with backend
    fetch("http://localhost:8000/api/auth/me", {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Invalid token");
        return res.json();
      })
      .then(data => {
        // Merge localStorage data with fresh data from /me
        setUser({ 
          ...auth, 
          ...data,
          full_name: data.full_name || auth.fullName 
        });
      })
      .catch(() => {
        clearAuth();
        setUser(null);
        // Only redirect if we were actually trying to be authenticated
        if (window.location.pathname.includes("/dashboard")) {
          router.push("/auth");
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router]);

  const logout = () => {
    clearAuth();
    setUser(null);
    router.push("/");
  };

  return { 
    user, 
    role: user?.role, 
    isLoading, 
    logout 
  };
}
