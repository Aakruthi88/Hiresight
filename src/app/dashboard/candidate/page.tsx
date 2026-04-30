"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Send, CheckCircle2, Clock, Lock,
  TrendingUp, FileText, LayoutGrid, User,
  CalendarDays, Loader2, ChevronRight, Zap, GitFork, Code2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast, ToastContainer } from "@/components/ui/toast";
import { AnalyzeContent, type MatchResponse, type ResumeData } from "@/components/analyze/analyze-content";
import { ProfileContent } from "@/components/profile/profile-content";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface JD {
  jd_id: string;
  title: string;
  description: string;
  created_at: string;
  recruiter_id: string;
}

interface Application {
  application_id: string;
  jd_id: string;
  jd_title: string;
  match_score: number;
  submitted_at: string;
  blind_scored: boolean;
}

const API = "http://localhost:8000";
type Tab = "apply" | "applications" | "profile";

// ─── Count-up animation ───────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start: number;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, suffix = "" }: {
  label: string; value: number; icon: React.ReactNode;
  color: string; suffix?: string;
}) {
  const display = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-3xl p-5 flex items-center gap-4"
    >
      <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center shrink-0", color)}>{icon}</div>
      <div>
        <p className="text-2xl font-black tabular-nums text-white">
          {display}{suffix}
        </p>
        <p className="text-xs text-white/40 font-medium mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? "text-emerald-400 bg-emerald-500/12 border-emerald-500/25"
              : score >= 50 ? "text-amber-400 bg-amber-500/12 border-amber-500/25"
              :               "text-red-400 bg-red-500/12 border-red-500/25";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border", color)}>
      {score}%
    </span>
  );
}

// ─── JD Card ──────────────────────────────────────────────────────────────────
function JDCard({ jd, onAnalyze }: { jd: JD; onAnalyze: (jd: JD) => void }) {
  const posted = new Date(jd.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="glass-card rounded-2xl p-5 border border-white/[0.06] hover:border-violet-500/20 transition-all duration-300 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm leading-snug truncate group-hover:text-violet-300 transition-colors">
            {jd.title}
          </h3>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[11px] text-white/35">
              <CalendarDays className="w-3 h-3" /> {posted}
            </span>
          </div>
          <p className="text-xs text-white/30 mt-2 line-clamp-2 leading-relaxed">
            {jd.description.slice(0, 160)}{jd.description.length > 160 ? "…" : ""}
          </p>
        </div>
        <motion.button
          onClick={() => onAnalyze(jd)}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
            bg-violet-500/15 border border-violet-500/25 text-violet-300
            hover:bg-violet-500/25 hover:border-violet-500/40 transition-all"
        >
          <Zap className="w-3.5 h-3.5" />
          Analyze Match
          <ChevronRight className="w-3 h-3" />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
        active
          ? "text-white bg-violet-500/20 border border-violet-500/30 shadow-[0_0_15px_rgba(108,99,255,0.15)]"
          : "text-white/40 hover:text-white/70 border border-transparent hover:border-white/10 hover:bg-white/5"
      )}
    >
      {icon}
      {label}
      {active && (
        <motion.div layoutId="tab-indicator" className="absolute inset-0 rounded-xl ring-1 ring-violet-500/40" />
      )}
    </button>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function CandidateDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // ── Route guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "candidate") {
      router.replace("/auth");
    }
  }, [user, authLoading, router]);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [jds, setJds]               = useState<JD[]>([]);
  const [applications, setApps]     = useState<Application[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── Tab & flow state ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab]   = useState<Tab>("apply");
  const [selectedJd, setSelectedJd] = useState<JD | null>(null);

  // Match result captured from AnalyzeContent
  const [pendingMatch, setPendingMatch] = useState<{
    result: MatchResponse;
    resumeData: ResumeData;
    blindScored: boolean;
    piiCount: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [githubUsername, setGithubUsername] = useState("");
  const [leetcodeUsername, setLeetcodeUsername] = useState("");

  // Ref to scroll to analyzer when a JD is selected
  const analyzeRef = useRef<HTMLDivElement>(null);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const headers = { Authorization: `Bearer ${user.access_token}` };

    Promise.all([
      fetch(`${API}/api/candidate/jds`, { headers }).then(r => r.json()),
      fetch(`${API}/api/candidate/applications`, { headers }).then(r => r.json()),
    ])
      .then(([jdData, appData]) => {
        setJds(Array.isArray(jdData) ? jdData : []);
        setApps(Array.isArray(appData) ? appData : []);
      })
      .catch(() => toast("Failed to load dashboard data", "error"))
      .finally(() => setDataLoading(false));
  }, [user]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalApps   = applications.length;
  const avgScore    = totalApps > 0 ? Math.round(applications.reduce((s, a) => s + a.match_score, 0) / totalApps) : 0;
  const totalSkills = applications.reduce((s, a) => s + (a.match_score > 0 ? 1 : 0), 0); // proxy: distinct non-zero apps

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAnalyzeJd = (jd: JD) => {
    setSelectedJd(jd);
    setPendingMatch(null);
    setActiveTab("apply");
    setTimeout(() => analyzeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const handleMatchComplete = (result: MatchResponse, resumeData: ResumeData, blindScored: boolean, piiCount: number) => {
    setPendingMatch({ result, resumeData, blindScored, piiCount });
    
    // Auto-populate social usernames from extracted URLs
    if (resumeData.github_url) {
      const ghUser = resumeData.github_url.split("/").filter(Boolean).pop();
      if (ghUser) setGithubUsername(ghUser);
    }
    if (resumeData.leetcode_url) {
      const lcUser = resumeData.leetcode_url.split("/").filter(Boolean).pop();
      if (lcUser) setLeetcodeUsername(lcUser);
    }
  };

  const handleSubmitApplication = async () => {
    if (!pendingMatch || !selectedJd || !user) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/candidate/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({
          jd_id:           selectedJd.jd_id,
          resume_data:     pendingMatch.resumeData,
          match_result:    pendingMatch.result,
          blind_scored:    pendingMatch.blindScored,
          pii_count:       pendingMatch.piiCount,
          github_username: githubUsername.trim() || null,
          leetcode_username: leetcodeUsername.trim() || null,
          profile_data:    null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Submit failed" }));
        throw new Error(err.detail ?? "Submit failed");
      }
      toast("Application submitted! Recruiter can now see your profile.", "success");
      setPendingMatch(null);
      setSelectedJd(null);
      // Refresh applications
      const appsRes = await fetch(`${API}/api/candidate/applications`, {
        headers: { Authorization: `Bearer ${user.access_token}` },
      });
      if (appsRes.ok) setApps(await appsRes.json());
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Submit failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  const firstName = user.full_name?.split(" ")[0] || user.email.split("@")[0];

  return (
    <>
      <ToastContainer />
      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8">

        {/* ── Greeting bar ─────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Welcome back, <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">{firstName}</span> 👋
              </h1>
              <p className="text-white/40 text-sm mt-1">Your career intelligence hub</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-violet-500/15 border border-violet-500/30 text-violet-300">
              <User className="w-3 h-3" /> Candidate
            </span>
          </div>
        </motion.div>

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        {dataLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="glass-card rounded-3xl p-5 h-20 shimmer" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Applications Submitted" value={totalApps} icon={<Send className="w-5 h-5" />} color="bg-violet-500/15 text-violet-400" />
            <StatCard label="Avg Match Score" value={avgScore} suffix="%" icon={<TrendingUp className="w-5 h-5" />} color="bg-cyan-500/15 text-cyan-400" />
            <StatCard label="Active Submissions" value={totalSkills} icon={<CheckCircle2 className="w-5 h-5" />} color="bg-emerald-500/15 text-emerald-400" />
          </div>
        )}

        {/* ── Tab bar ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <TabBtn active={activeTab === "apply"} onClick={() => setActiveTab("apply")}
            icon={<Briefcase className="w-4 h-4" />} label="Find & Apply" />
          <TabBtn active={activeTab === "applications"} onClick={() => setActiveTab("applications")}
            icon={<LayoutGrid className="w-4 h-4" />} label={`My Applications${totalApps > 0 ? ` (${totalApps})` : ""}`} />
          <TabBtn active={activeTab === "profile"} onClick={() => setActiveTab("profile")}
            icon={<User className="w-4 h-4" />} label="My Profile" />
        </div>

        {/* ── Tab content ───────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">

          {/* TAB 1 — Find & Apply */}
          {activeTab === "apply" && (
            <motion.div key="apply" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">

              {/* JD list */}
              <div>
                <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
                  Available Positions
                </h2>
                {dataLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map(i => <div key={i} className="glass-card rounded-2xl h-24 shimmer" />)}
                  </div>
                ) : jds.length === 0 ? (
                  <div className="glass-card rounded-2xl p-10 text-center text-white/30 text-sm">
                    No job descriptions posted yet. Check back soon!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jds.map((jd, i) => (
                      <motion.div key={jd.jd_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <JDCard jd={jd} onAnalyze={handleAnalyzeJd} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Analyzer — shown when a JD is selected */}
              <AnimatePresence>
                {selectedJd && (
                  <motion.div
                    ref={analyzeRef}
                    key="analyzer"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {/* Selected JD header */}
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-violet-500/10 border border-violet-500/25">
                      <Zap className="w-4 h-4 text-violet-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-violet-300">Analyzing for: <span className="text-white">{selectedJd.title}</span></p>
                        <p className="text-xs text-white/35 mt-0.5">Upload your resume and run analysis below</p>
                      </div>
                      <button onClick={() => { setSelectedJd(null); setPendingMatch(null); }}
                        className="text-white/30 hover:text-white/60 transition-colors text-xs font-medium"
                      >Clear ✕</button>
                    </div>

                    {/* Embedded analyzer */}
                    <AnalyzeContent
                      compact
                      initialJd={selectedJd.description}
                      onMatchComplete={handleMatchComplete}
                    />

                    {/* Submit application button — appears after analysis */}
                    <AnimatePresence>
                      {pendingMatch && (
                        <motion.div
                          initial={{ opacity: 0, y: 12, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-5"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                              <p className="text-sm font-semibold text-emerald-300">Analysis complete — ready to apply!</p>
                              <p className="text-xs text-white/40 mt-0.5">
                                Your match score: <span className="font-bold text-white">{pendingMatch.result.overall_score}%</span>
                                {pendingMatch.blindScored && " · 🔒 Identity hidden"}
                              </p>
                            </div>
                            <motion.button
                              onClick={handleSubmitApplication}
                              disabled={submitting}
                              whileHover={{ scale: submitting ? 1 : 1.03 }}
                              whileTap={{ scale: submitting ? 1 : 0.97 }}
                              className="relative flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white overflow-hidden disabled:opacity-60"
                              style={{ background: "linear-gradient(135deg, #6C63FF 0%, #00D9FF 100%)" }}
                            >
                              <span className="absolute inset-0 btn-shimmer" />
                              {submitting ? <Loader2 className="w-4 h-4 animate-spin relative" /> : <Send className="w-4 h-4 relative" />}
                              <span className="relative">{submitting ? "Submitting…" : "Submit Application"}</span>
                            </motion.button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1 flex items-center gap-2">
                                <GitFork className="w-3 h-3" /> GitHub Username (Optional)
                              </label>
                              <input 
                                type="text"
                                value={githubUsername}
                                onChange={e => setGithubUsername(e.target.value)}
                                placeholder="e.g. janesmith"
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-violet-500/50 outline-none transition-all placeholder:text-white/10"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1 flex items-center gap-2">
                                <Code2 className="w-3 h-3" /> LeetCode Username (Optional)
                              </label>
                              <input 
                                type="text"
                                value={leetcodeUsername}
                                onChange={e => setLeetcodeUsername(e.target.value)}
                                placeholder="e.g. janesmith_dev"
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-violet-500/50 outline-none transition-all placeholder:text-white/10"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* TAB 2 — My Applications */}
          {activeTab === "applications" && (
            <motion.div key="applications" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">Application History</h2>
              {dataLoading ? (
                <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="glass-card rounded-2xl h-16 shimmer" />)}</div>
              ) : applications.length === 0 ? (
                <div className="glass-card rounded-2xl p-12 text-center space-y-3">
                  <FileText className="w-10 h-10 text-white/15 mx-auto" />
                  <p className="text-white/30 text-sm">No applications yet. Head to <button onClick={() => setActiveTab("apply")} className="text-violet-400 hover:underline">Find & Apply</button> to get started.</p>
                </div>
              ) : (
                <div className="glass-card rounded-2xl overflow-hidden">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_100px_130px_80px] gap-4 px-5 py-3 border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-widest text-white/25">
                    <span>Position</span>
                    <span className="text-center">Score</span>
                    <span>Submitted</span>
                    <span className="text-center">Blind</span>
                  </div>
                  {applications.map((app, i) => (
                    <motion.div
                      key={app.application_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="grid grid-cols-[1fr_100px_130px_80px] gap-4 px-5 py-4 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{app.jd_title}</p>
                      </div>
                      <div className="text-center">
                        <ScoreBadge score={app.match_score} />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-white/35">
                        <Clock className="w-3 h-3 shrink-0" />
                        {new Date(app.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <div className="text-center">
                        {app.blind_scored
                          ? <Lock className="w-4 h-4 text-violet-400 mx-auto" aria-label="Blind scored" />
                          : <span className="text-white/20 text-xs">—</span>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3 — My Profile */}
          {activeTab === "profile" && (
            <motion.div key="profile" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-6">Profile Builder</h2>
              <ProfileContent compact />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </>
  );
}
