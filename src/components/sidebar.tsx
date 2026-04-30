"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  FileEdit,
  UserCircle,
  ChevronLeft,
  Briefcase,
  LogOut,
  LogIn,
  PlusCircle,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, role, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  // Define nav items based on role
  const navItems = role === "recruiter" 
    ? [
        { href: "/dashboard/recruiter", label: "Dashboard", icon: LayoutDashboard },
        { href: "/dashboard/recruiter", label: "Post JD", icon: PlusCircle },
        { href: "/recruiter", label: "Bias Auditor", icon: FileEdit },
      ]
    : [
        { href: "/dashboard/candidate", label: "Dashboard", icon: LayoutDashboard },
        { href: "/analyze", label: "Find Jobs", icon: Search },
        { href: "/profile", label: "My Profile", icon: UserCircle },
      ];

  const initials = user?.full_name
    ? user.full_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? "80px" : "280px" }}
      className={cn(
        "relative flex flex-col h-screen glass-card border-y-0 border-l-0 transition-all duration-300 z-50",
        "hidden md:flex"
      )}
    >
      {/* ── Logo ── */}
      <div className="flex items-center justify-between p-6 h-20">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 font-bold text-xl tracking-tight"
          >
            <Briefcase className="w-8 h-8 text-violet-500" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400">
              TalentLens
            </span>
          </motion.div>
        )}
        {isCollapsed && <Briefcase className="w-8 h-8 text-violet-500 mx-auto" />}
      </div>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-24 bg-violet-600 text-white rounded-full p-1 border border-white/20 shadow-lg z-50 hover:scale-110 transition-transform"
      >
        <ChevronLeft className={cn("w-4 h-4 transition-transform", isCollapsed && "rotate-180")} />
      </button>

      {/* ── User Profile at Top ── */}
      <div className="px-4 mb-4">
        {user && !isCollapsed && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-lg">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user.full_name}</p>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                role === "recruiter" ? "bg-cyan-500/20 text-cyan-400" : "bg-violet-500/20 text-violet-400"
              )}>
                {role}
              </span>
            </div>
          </motion.div>
        )}
        {user && isCollapsed && (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white mx-auto shadow-lg">
            {initials}
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive
                  ? "bg-violet-600 text-white shadow-[0_0_20px_rgba(108,99,255,0.3)]"
                  : "text-white/40 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className={cn("w-5 h-5 min-w-[20px]", isActive ? "text-white" : "group-hover:text-violet-400")} />
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-medium whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
              {isActive && !isCollapsed && (
                <motion.div layoutId="active" className="absolute left-0 w-1 h-6 bg-white rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Auth Actions at Bottom ── */}
      <div className="p-4 border-t border-white/5 mt-auto">
        {user ? (
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-4 w-full py-3 px-4 rounded-xl text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group",
              isCollapsed && "justify-center px-0"
            )}
          >
            <LogOut className="w-5 h-5" />
            {!isCollapsed && <span className="font-bold text-sm">Logout</span>}
          </button>
        ) : (
          <Link
            href="/auth"
            className={cn(
              "flex items-center gap-4 w-full py-3 px-4 rounded-xl bg-violet-600 text-white font-bold text-sm hover:shadow-[0_0_20px_rgba(108,99,255,0.4)] transition-all",
              isCollapsed && "justify-center px-0"
            )}
          >
            <LogIn className="w-5 h-5" />
            {!isCollapsed && <span>Sign In</span>}
          </Link>
        )}
      </div>
    </motion.div>
  );
}


