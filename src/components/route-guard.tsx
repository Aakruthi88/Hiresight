"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "@/components/ui/toast";

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRole: "candidate" | "recruiter" | "any";
}

export function RouteGuard({ children, allowedRole }: RouteGuardProps) {
  const { user, role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/auth");
      } else if (allowedRole !== "any" && role !== allowedRole) {
        toast("Access denied", "error");
        router.push("/auth");
      }
    }
  }, [user, role, isLoading, allowedRole, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black/20 backdrop-blur-sm fixed inset-0 z-[999]">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-violet-500/20 rounded-full" />
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
        </div>
      </div>
    );
  }

  // Prevent flash of content before redirect
  if (!user || (allowedRole !== "any" && role !== allowedRole)) {
    return null;
  }

  return <>{children}</>;
}
