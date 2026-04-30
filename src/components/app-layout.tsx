"use client";

import { Sidebar } from "@/components/sidebar";
import { Menu } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// Pages that render without the sidebar shell
const AUTH_ROUTES = ["/login", "/signup", "/auth"];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Auth pages: full-screen, no sidebar
  if (AUTH_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 glass-card border-x-0 border-t-0 flex items-center px-6 z-40">
        <button onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className="w-6 h-6 text-primary" />
        </button>
        <span className="ml-4 font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
          TalentLens
        </span>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 md:hidden bg-background"
          >
            <div className="p-6 h-full flex flex-col">
              <div className="flex justify-end mb-8">
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-muted-foreground p-2">
                  <Menu className="w-6 h-6 rotate-90" />
                </button>
              </div>
              <Sidebar />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
        {children}
      </main>
    </div>
  );
}

