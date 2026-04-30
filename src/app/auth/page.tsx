"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast, ToastContainer } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// ── Tab type ─────────────────────────────────────────────────────────────────
type AuthMode = "signin" | "signup";

// ── Animated pill tab switcher ───────────────────────────────────────────────
function TabSwitcher({
  mode,
  onChange,
}: {
  mode: AuthMode;
  onChange: (m: AuthMode) => void;
}) {
  return (
    <div className="relative flex w-full rounded-2xl bg-white/5 border border-white/8 p-1">
      {/* Animated pill indicator */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="absolute inset-y-1 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#5A52E0] shadow-lg shadow-[#6C63FF]/25"
        style={{ width: "calc(50% - 4px)", left: mode === "signin" ? 4 : "calc(50% + 0px)" }}
      />

      {(["signin", "signup"] as AuthMode[]).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            "relative z-10 flex-1 py-2.5 text-sm font-semibold tracking-wide rounded-xl transition-colors duration-200",
            mode === tab ? "text-white" : "text-white/40 hover:text-white/60"
          )}
        >
          {tab === "signin" ? "Sign In" : "Sign Up"}
        </button>
      ))}
    </div>
  );
}

// ── Password input with visibility toggle ────────────────────────────────────
function PasswordInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30
          focus:outline-none focus:border-[#6C63FF]/60 focus:ring-1 focus:ring-[#6C63FF]/40
          transition-all duration-200 text-sm"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── Role selector cards ──────────────────────────────────────────────────────
function RoleSelector({
  role,
  onChange,
}: {
  role: "candidate" | "recruiter";
  onChange: (r: "candidate" | "recruiter") => void;
}) {
  const roles = [
    {
      value: "candidate" as const,
      emoji: "🎯",
      title: "I'm a Candidate",
      subtitle: "Find roles that match my skills",
    },
    {
      value: "recruiter" as const,
      emoji: "💼",
      title: "I'm a Recruiter",
      subtitle: "Discover top talent for my team",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {roles.map((r) => {
        const isSelected = role === r.value;
        return (
          <motion.button
            key={r.value}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(r.value)}
            className={cn(
              "relative p-4 rounded-2xl border text-left transition-all duration-300 group",
              isSelected
                ? "bg-[#6C63FF]/10 border-[#6C63FF]/50 shadow-[0_0_25px_rgba(108,99,255,0.15)]"
                : "bg-white/[0.03] border-white/8 hover:border-white/15 hover:bg-white/[0.05]"
            )}
          >
            {/* Glow ring on selected */}
            {isSelected && (
              <motion.div
                layoutId="role-glow"
                className="absolute inset-0 rounded-2xl border-2 border-[#6C63FF]/60"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}

            <span className="text-2xl block mb-2">{r.emoji}</span>
            <p
              className={cn(
                "text-sm font-semibold transition-colors",
                isSelected ? "text-white" : "text-white/50"
              )}
            >
              {r.title}
            </p>
            <p
              className={cn(
                "text-xs mt-0.5 transition-colors",
                isSelected ? "text-white/60" : "text-white/25"
              )}
            >
              {r.subtitle}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Main Auth Page ───────────────────────────────────────────────────────────
export default function AuthPage() {
  const router = useRouter();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"candidate" | "recruiter">("candidate");

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("candidate");
  };

  const handleModeChange = (m: AuthMode) => {
    setMode(m);
    resetForm();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signin") {
        const user = await login(email, password);
        toast("Welcome back! Redirecting…", "success");
        setTimeout(() => {
          router.push(
            user.role === "recruiter"
              ? "/dashboard/recruiter"
              : "/dashboard/candidate"
          );
        }, 600);
      } else {
        if (!fullName.trim()) {
          toast("Please enter your full name", "error");
          setLoading(false);
          return;
        }
        const user = await signup(email, password, role, fullName.trim());
        
        if (!user.access_token) {
          toast("Account created! Now please sign in.", "success");
          setMode("signin");
          setPassword("");
          setLoading(false);
          return;
        }

        toast("Account created! Redirecting…", "success");
        setTimeout(() => {
          router.push(
            user.role === "recruiter"
              ? "/dashboard/recruiter"
              : "/dashboard/candidate"
          );
        }, 600);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Form variants for AnimatePresence ──────────────────────────────────────
  const formVariants = {
    initial: { opacity: 0, y: 12, filter: "blur(4px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -12, filter: "blur(4px)" },
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden">
      {/* Animated floating orbs — same as landing page */}
      <div className="orb w-[500px] h-[500px] bg-[#6C63FF]/20 top-[-120px] left-[-120px]" />
      <div
        className="orb w-[600px] h-[600px] bg-[#00D9FF]/10 bottom-[-150px] right-[-150px]"
        style={{ animationDelay: "-5s" }}
      />
      <div
        className="orb w-[350px] h-[350px] bg-[#6C63FF]/10 top-[30%] right-[5%]"
        style={{ animationDelay: "-10s" }}
      />

      {/* Toast container */}
      <ToastContainer />

      {/* Central glass card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-card rounded-3xl p-8 md:p-10 border border-white/[0.08] shadow-2xl shadow-black/40">
          {/* Logo + tagline */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6C63FF] to-[#00D9FF] flex items-center justify-center mb-4 shadow-lg shadow-[#6C63FF]/25"
            >
              <Briefcase className="w-7 h-7 text-white" />
            </motion.div>

            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#6C63FF] to-[#00D9FF]">
              TalentLens
            </h1>
            <p className="text-sm text-white/40 mt-1">
              AI-powered recruitment, reimagined
            </p>
          </div>

          {/* Tab switcher */}
          <div className="mb-6">
            <TabSwitcher mode={mode} onChange={handleModeChange} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {mode === "signin" ? (
                <motion.div
                  key="signin-form"
                  variants={formVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="signin-email"
                      className="block text-xs font-medium text-white/50 mb-1.5 ml-1"
                    >
                      Email
                    </label>
                    <input
                      id="signin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30
                        focus:outline-none focus:border-[#6C63FF]/60 focus:ring-1 focus:ring-[#6C63FF]/40
                        transition-all duration-200 text-sm"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="signin-password"
                      className="block text-xs font-medium text-white/50 mb-1.5 ml-1"
                    >
                      Password
                    </label>
                    <PasswordInput
                      id="signin-password"
                      value={password}
                      onChange={setPassword}
                      placeholder="••••••••"
                    />
                  </div>

                  {/* Forgot password link */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-[#6C63FF]/70 hover:text-[#6C63FF] transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Submit */}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className={cn(
                      "relative w-full py-3.5 rounded-xl font-semibold text-sm text-white overflow-hidden",
                      "bg-gradient-to-r from-[#6C63FF] to-[#5A52E0]",
                      "shadow-lg shadow-[#6C63FF]/25 hover:shadow-[#6C63FF]/40",
                      "transition-shadow duration-300",
                      "disabled:opacity-60 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-2"
                    )}
                  >
                    <span className="btn-shimmer absolute inset-0" />
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="signup-form"
                  variants={formVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  {/* Full Name */}
                  <div>
                    <label
                      htmlFor="signup-name"
                      className="block text-xs font-medium text-white/50 mb-1.5 ml-1"
                    >
                      Full Name
                    </label>
                    <input
                      id="signup-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ada Lovelace"
                      required
                      autoComplete="name"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30
                        focus:outline-none focus:border-[#6C63FF]/60 focus:ring-1 focus:ring-[#6C63FF]/40
                        transition-all duration-200 text-sm"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="signup-email"
                      className="block text-xs font-medium text-white/50 mb-1.5 ml-1"
                    >
                      Email
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30
                        focus:outline-none focus:border-[#6C63FF]/60 focus:ring-1 focus:ring-[#6C63FF]/40
                        transition-all duration-200 text-sm"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="signup-password"
                      className="block text-xs font-medium text-white/50 mb-1.5 ml-1"
                    >
                      Password
                    </label>
                    <PasswordInput
                      id="signup-password"
                      value={password}
                      onChange={setPassword}
                      placeholder="Min 6 characters"
                    />
                  </div>

                  {/* Role selector */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-2 ml-1">
                      I want to…
                    </label>
                    <RoleSelector role={role} onChange={setRole} />
                  </div>

                  {/* Submit */}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className={cn(
                      "relative w-full py-3.5 rounded-xl font-semibold text-sm text-white overflow-hidden",
                      "bg-gradient-to-r from-[#6C63FF] to-[#5A52E0]",
                      "shadow-lg shadow-[#6C63FF]/25 hover:shadow-[#6C63FF]/40",
                      "transition-shadow duration-300",
                      "disabled:opacity-60 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-2"
                    )}
                  >
                    <span className="btn-shimmer absolute inset-0" />
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Footer separator */}
          <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
            <p className="text-xs text-white/25">
              By continuing you agree to our Terms of Service
            </p>
          </div>
        </div>

        {/* Subtle reflection glow underneath */}
        <div className="absolute -bottom-4 inset-x-8 h-8 rounded-full bg-[#6C63FF]/10 blur-2xl" />
      </motion.div>
    </div>
  );
}
