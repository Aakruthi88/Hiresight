"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, Mail, Lock, Briefcase,
  ChevronRight, Loader2, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

// ─── Input Field (shared primitive) ──────────────────────────────────────────
function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  icon,
  rightSlot,
  error,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-white/50 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={id}
          className={`
            w-full py-3 rounded-xl bg-white/5 border text-white/85 text-sm
            placeholder:text-white/20 outline-none transition-all duration-200
            ${icon ? "pl-10" : "pl-4"}
            ${rightSlot ? "pr-11" : "pr-4"}
            ${error
              ? "border-red-500/60 focus:border-red-500"
              : "border-white/10 focus:border-violet-500/60 focus:bg-white/7"
            }
          `}
        />
        {rightSlot && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
            {rightSlot}
          </span>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-red-400 flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3 shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.includes("@")) e.email    = "Enter a valid email address";
    if (!password)            e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setIsLoading(true);
    try {
      const user = await login(email, password);
      router.push(user.role === "recruiter" ? "/recruiter" : "/analyze");
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Floating orbs */}
      <div className="orb w-96 h-96 bg-violet-600/20 -top-20 -right-20 fixed" />
      <div className="orb w-80 h-80 bg-cyan-500/15 bottom-0 left-0 fixed" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500
            flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.4)]">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black bg-gradient-to-r from-violet-400 to-cyan-400
            bg-clip-text text-transparent">
            TalentLens
          </span>
        </div>

        {/* Card */}
        <div className="glass-card rounded-3xl p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="text-sm text-white/40 mt-1">
              Sign in to continue to TalentLens
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="jane@example.com"
              icon={<Mail className="w-4 h-4" />}
              error={errors.email}
            />
            <Field
              id="password"
              label="Password"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={setPassword}
              placeholder="Your password"
              icon={<Lock className="w-4 h-4" />}
              error={errors.password}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            {/* Server error */}
            <AnimatePresence>
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/25"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{serverError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={!isLoading ? { scale: 1.02 } : {}}
              whileTap={!isLoading ? { scale: 0.98 } : {}}
              className="relative w-full py-3.5 rounded-2xl font-bold text-sm text-white
                overflow-hidden cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed
                shadow-[0_0_36px_rgba(108,99,255,0.3)]"
            >
              <span
                className="absolute inset-0"
                style={{ background: "linear-gradient(135deg, #6C63FF 0%, #00D9FF 100%)" }}
              />
              <span className="absolute inset-0 btn-shimmer" />
              <span className="relative flex items-center justify-center gap-2">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </span>
            </motion.button>
          </form>

          <p className="text-center text-sm text-white/35">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-violet-400 hover:text-violet-300 font-semibold transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          TalentLens · AI-Powered Recruitment Intelligence
        </p>
      </motion.div>
    </div>
  );
}
