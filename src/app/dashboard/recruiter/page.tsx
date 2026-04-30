"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Briefcase, 
  Users, 
  TrendingUp, 
  FileText, 
  CalendarDays, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  X,
  RotateCcw,
  ShieldAlert,
  Info,
  ChevronRight,
  ClipboardCopy,
  ChevronDown
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { ToastContainer, toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";

// ── Types ──────────────────────────────────────────────────────────────────────
interface JD {
  jd_id: string;
  title: string;
  description: string;
  created_at: string;
  applicant_count: number;
  top_score: number;
}

interface BiasFlag {
  phrase: string;
  category: string;
  suggestion: string;
  severity: string;
  context: string;
}

interface AuditResult {
  bias_flags: BiasFlag[];
  bias_score: number;
  rewritten_jd: string;
  summary: string;
}

// ── Constants from Bias Auditor ───────────────────────────────────────────────
const CAT_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  gendered:             { label: "Gendered Language",       color: "text-orange-300",  bg: "bg-orange-500/10",  border: "border-orange-500/25" },
  credential_gate:      { label: "Credential Inflation",    color: "text-red-300",     bg: "bg-red-500/10",     border: "border-red-500/25"    },
  experience_inflation: { label: "Experience Inflation",    color: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-500/25"  },
  exclusionary:         { label: "Exclusionary Language",   color: "text-pink-300",    bg: "bg-pink-500/10",    border: "border-pink-500/25"   },
};

const SEV_DOT: Record<string, string> = {
  high:   "bg-red-400",
  medium: "bg-amber-400",
  low:    "bg-sky-400",
};

const SEV_COLOR: Record<string, string> = {
  high:   "text-red-400",
  medium: "text-amber-400",
  low:    "text-sky-400",
};

// ── Components ─────────────────────────────────────────────────────────────────

function BiasGauge({ score }: { score: number }) {
  const pct = Math.min(score / 30, 1);
  const color = pct > 0.6 ? "#ef4444" : pct > 0.3 ? "#f59e0b" : "#10b981";
  const label = pct > 0.6 ? "High Bias" : pct > 0.3 ? "Moderate Bias" : "Low Bias";
  const radius = 40, circ = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg className="-rotate-90 absolute inset-0" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={radius} strokeWidth="6" stroke="rgba(255,255,255,0.06)" fill="none" />
          <motion.circle
            cx="44" cy="44" r={radius}
            strokeWidth="6" stroke={color} fill="none" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - pct * circ }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="relative text-center">
          <p className="text-xl font-black" style={{ color }}>{score}</p>
          <p className="text-[8px] text-white/35 uppercase tracking-widest">score</p>
        </div>
      </div>
      <div>
        <p className="font-bold text-sm" style={{ color }}>{label}</p>
        <p className="text-xs text-white/35">Bias Score</p>
      </div>
    </div>
  );
}

// ── New Components for Candidate Ranking ──────────────────────────────────────

function RankingCard({ candidate, rank, isPiiBlind, name, onViewProfile }: {
  candidate: any; rank: number; isPiiBlind: boolean; name: string; onViewProfile: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(rank === 1);
  const isTopCandidate = rank === 1;

  // Match score ring constants
  const radius = 30, circ = 2 * Math.PI * radius;
  const pct = candidate.match_score / 100;
  const scoreColor = candidate.match_score >= 80 ? "#10b981" : candidate.match_score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (rank - 1) * 0.05, duration: 0.4, ease: "easeOut" }}
      className={cn(
        "p-5 rounded-3xl glass-card transition-all duration-300 relative group",
        isTopCandidate ? "border-violet-500/40 shadow-[0_0_30px_rgba(108,99,255,0.15)]" : "hover:bg-white/10"
      )}
    >
      {isTopCandidate && (
        <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-[10px] font-black text-black uppercase tracking-widest shadow-lg">
          🏆 Top Candidate
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm",
            rank === 1 ? "bg-amber-500/20 text-amber-400" : 
            rank === 2 ? "bg-slate-400/20 text-slate-300" : 
            rank === 3 ? "bg-orange-700/20 text-orange-400" : "bg-white/5 text-white/40"
          )}>
            #{rank}
          </div>
          <div>
            <h4 className="font-bold text-white text-lg">{name}</h4>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-[10px] text-white/30">
                <CalendarDays className="w-3 h-3" /> Submitted: {new Date(candidate.submitted_at).toLocaleDateString()}
              </span>
              {candidate.blind_scored && (
                <span className="flex items-center gap-1 text-[10px] text-violet-400 font-bold">
                   🔒 Blind Scored
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="-rotate-90 absolute inset-0" viewBox="0 0 70 70">
            <circle cx="35" cy="35" r={radius} strokeWidth="5" stroke="rgba(255,255,255,0.06)" fill="none" />
            <motion.circle
              cx="35" cy="35" r={radius}
              strokeWidth="5" stroke={scoreColor} fill="none" strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: circ - pct * circ }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </svg>
          <div className="text-center">
            <p className="text-sm font-black text-white">{candidate.match_score}%</p>
          </div>
        </div>
      </div>

      {/* Skills Summary */}
      <div className="space-y-3 mb-4">
        {candidate.matched_skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-1 shrink-0" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mr-1">Matched:</span>
            {candidate.matched_skills.map((s: string) => (
              <span key={s} className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px]">{s}</span>
            ))}
          </div>
        )}
        {candidate.partial_skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <AlertCircle className="w-3 h-3 text-amber-400 mt-1 shrink-0" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mr-1">Partial:</span>
            {candidate.partial_skills.map((s: any) => (
              <span key={s.skill} className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px]">
                {s.skill} → <span className="opacity-60">{s.explanation}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Explainable AI Section */}
      <div className="border-t border-white/5 pt-3">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-[10px] font-bold text-violet-400 hover:text-violet-300 uppercase tracking-widest transition-colors"
        >
          Why #{rank}? <ChevronDown className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-180")} />
        </button>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-3"
            >
              <ul className="space-y-2">
                {candidate.explanation.map((item: any, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className={cn(
                      "w-1 h-1 rounded-full mt-1.5 shrink-0",
                      item.type === "strength" ? "bg-emerald-400" : 
                      item.type === "gap" ? "bg-amber-400" : "bg-cyan-400"
                    )} />
                    <p className="text-[11px] text-white/60 leading-relaxed">{item.text}</p>
                  </li>
                ))}
              </ul>
              <button 
                onClick={onViewProfile}
                className="mt-4 w-full py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white/60 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                View Full Profile <ChevronRight className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function SlideOver({ isOpen, onClose, title, subtitle, children }: {
  isOpen: boolean; onClose: () => void; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-xl h-full glass-card border-y-0 border-r-0 flex flex-col shadow-2xl"
          >
            <div className="p-8 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-white">{title}</h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-sm text-white/40">{subtitle}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function BiasAuditContent({ initialJd }: { initialJd: string }) {
  const [jd, setJd] = useState(initialJd);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);

  const handleAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/audit-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description: jd }),
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (initialJd) handleAudit(); }, [initialJd]);

  return (
    <div className="space-y-6">
      <textarea 
        value={jd} onChange={e => setJd(e.target.value)}
        className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white/80 focus:border-violet-500/50 outline-none resize-none"
      />
      <button 
        onClick={handleAudit} disabled={loading}
        className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-400 text-white font-bold text-sm"
      >
        {loading ? "Scanning..." : "Re-Run Audit"}
      </button>

      {result && (
        <div className="space-y-6 pt-4 border-t border-white/10">
          <BiasGauge score={result.bias_score} />
          <div className="space-y-3">
            {result.bias_flags.map((f, i) => <FlagCard key={i} flag={f} index={i} />)}
          </div>
          <div className="p-5 rounded-2xl bg-white/5 border border-white/8">
            <h4 className="text-xs font-bold text-emerald-400 mb-3 uppercase tracking-widest">Optimized version</h4>
            <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{result.rewritten_jd}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Recruiter Dashboard ───────────────────────────────────────────────────

export default function RecruiterDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ full_name: string } | null>(null);
  const [jds, setJds] = useState<JD[]>([]);
  const [selectedJd, setSelectedJd] = useState<JD | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal State
  const [newJdTitle, setNewJdTitle] = useState("");
  const [newJdDesc, setNewJdDesc] = useState("");
  const [auditEnabled, setAuditEnabled] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [posting, setPosting] = useState(false);

  // ── Route Guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("tl_token");
    const role = localStorage.getItem("tl_role");
    const authData = localStorage.getItem("talentlens_auth");
    
    // Support both the specific keys in the prompt and the existing talentlens_auth
    let currentUser = null;
    if (authData) {
      const parsed = JSON.parse(authData);
      currentUser = parsed;
      // If prompt keys are missing, populate them for consistency
      if (!token) localStorage.setItem("tl_token", parsed.access_token);
      if (!role) localStorage.setItem("tl_role", parsed.role);
    }

    if ((!token && !authData) || (role !== "recruiter" && currentUser?.role !== "recruiter")) {
      router.replace("/auth");
      return;
    }

    setUser(currentUser);
    fetchData();
  }, []);

  // ── CANDIDATE RANKING STATE ──────────────────────────────────────────────
  const [rankings, setRankings] = useState<any[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [isPiiBlind, setIsPiiBlind] = useState(true);
  const [isAuditPanelOpen, setIsAuditPanelOpen] = useState(false);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

  useEffect(() => {
    if (selectedJd) {
      fetchRankings(selectedJd.jd_id);
    }
  }, [selectedJd]);

  const fetchRankings = async (id: string) => {
    setRankingLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/recruiter/jd/${id}/ranking`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setRankings(data.ranking || []);
      } else {
        // Mock data for ranking
        setRankings([
          {
            user_id: "usr_1",
            full_name: "Alex Rivera",
            match_score: 92,
            submitted_at: "2026-04-20T10:00:00Z",
            blind_scored: true,
            matched_skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Framer Motion"],
            partial_skills: [{ skill: "Node.js", explanation: "Some backend exp" }, { skill: "AWS", explanation: "Basic S3/EC2 knowledge" }],
            missing_skills: ["GraphQL"],
            explanation: [
              { type: "strength", text: "Matched 5/6 core requirements (83%)" },
              { type: "strength", text: "Strong portfolio with high-quality animations" },
              { type: "signal", text: "Active contributor to open-source UI libraries" },
              { type: "gap", text: "Limited experience with large-scale GraphQL schemas" }
            ],
            profile_data: { 
              github: { repoCount: 45, totalStars: 120, topLanguages: [{ name: "TypeScript", count: 20 }, { name: "React", count: 15 }] }, 
              leetcode: { totalSolved: 320, contestRating: 1850 } 
            }
          },
          {
            user_id: "usr_2",
            full_name: "Jordan Smith",
            match_score: 85,
            submitted_at: "2026-04-21T14:30:00Z",
            blind_scored: false,
            matched_skills: ["React", "TypeScript", "Node.js"],
            partial_skills: [{ skill: "AWS", explanation: "Infrastructure basic" }],
            missing_skills: ["Next.js", "GraphQL"],
            explanation: [
              { type: "strength", text: "Deep React internals knowledge" },
              { type: "gap", text: "Missing Next.js experience (willing to learn)" },
              { type: "signal", text: "Previous experience at a high-growth startup" }
            ],
            profile_data: { 
              github: { repoCount: 12, totalStars: 15, topLanguages: [{ name: "JavaScript", count: 8 }, { name: "CSS", count: 4 }] }, 
              leetcode: { totalSolved: 150, contestRating: 1420 } 
            }
          }
        ]);
      }
    } catch (err) {
      console.error("Ranking fetch error:", err);
    } finally {
      setRankingLoading(false);
    }
  };

  const getCandidateName = (fullName: string, index: number) => {
    if (!isPiiBlind) return fullName;
    return `Candidate ${String.fromCharCode(65 + index)}`;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/recruiter/jds", {
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        setJds(data);
      } else {
        // Mock data fallback for visualization
        setJds([
          { jd_id: "1", title: "Senior Frontend Engineer", description: "Looking for a React expert...", created_at: new Date().toISOString(), applicant_count: 12, top_score: 94 },
          { jd_id: "2", title: "AI Product Manager", description: "Lead our LLM initiatives...", created_at: new Date(Date.now() - 86400000 * 2).toISOString(), applicant_count: 8, top_score: 88 },
          { jd_id: "3", title: "Backend Systems Architect", description: "Scale our infrastructure...", created_at: new Date(Date.now() - 86400000 * 5).toISOString(), applicant_count: 24, top_score: 91 },
        ]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = async () => {
    if (!newJdDesc.trim()) {
      toast("Please enter a description first.", "error");
      return;
    }
    setAuditing(true);
    try {
      const res = await fetch("http://localhost:8000/api/audit-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description: newJdDesc }),
      });
      if (res.ok) {
        const data = await res.json();
        setAuditResult(data);
        toast("Audit complete!", "success");
      }
    } catch (err) {
      toast("Audit failed. Using original text.", "error");
    } finally {
      setAuditing(false);
    }
  };

  const handlePostJD = async () => {
    if (!newJdTitle || !newJdDesc) {
      toast("Title and description are required.", "error");
      return;
    }
    setPosting(true);
    try {
      const res = await fetch("http://localhost:8000/api/recruiter/jd", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ title: newJdTitle, description: newJdDesc }),
      });
      if (res.ok) {
        toast("Job Description posted successfully!", "success");
        setIsModalOpen(false);
        setNewJdTitle("");
        setNewJdDesc("");
        setAuditResult(null);
        fetchData();
      }
    } catch (err) {
      toast("Failed to post JD.", "error");
    } finally {
      setPosting(false);
    }
  };

  // Stats
  const activeJdCount = jds.length;
  const totalApplicants = jds.reduce((sum, jd) => sum + jd.applicant_count, 0);
  const avgTopScore = jds.length > 0 
    ? Math.round(jds.reduce((sum, jd) => sum + (jd.top_score || 0), 0) / jds.length) 
    : 0;

  return (
    <>
      <ToastContainer />
      <PageWrapper>
        {/* ── TOP BAR ───────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Welcome, <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">{user?.full_name || "Recruiter"}</span>
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="px-3 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold uppercase tracking-wider">
                  Recruiter Portal
                </span>
                <p className="text-white/40 text-xs font-medium">Manage job postings and evaluate talent</p>
              </div>
            </div>
          </div>

          {/* Stats Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="glass-card rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-400">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-black text-white">{activeJdCount}</p>
                <p className="text-xs text-white/40 font-medium">Active JDs</p>
              </div>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="glass-card rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-black text-white">{totalApplicants}</p>
                <p className="text-xs text-white/40 font-medium">Total Applicants</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="glass-card rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-black text-white">{avgTopScore}%</p>
                <p className="text-xs text-white/40 font-medium">Avg Top Match Score</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── MAIN LAYOUT ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)] min-h-[500px]">
          
          {/* LEFT PANEL (1/3) */}
          <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest">Your Job Descriptions</h2>
              <span className="text-[10px] text-white/30 font-mono">{jds.length} total</span>
            </div>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-400 
                text-white font-bold text-sm shadow-lg shadow-violet-500/20 
                hover:shadow-violet-500/30 transition-all flex items-center justify-center gap-2 group"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
              Post New JD
            </button>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-24 glass-card rounded-2xl shimmer" />
                ))
              ) : jds.length === 0 ? (
                <div className="p-8 text-center glass-card rounded-2xl border-dashed border-white/10">
                  <FileText className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <p className="text-xs text-white/30 italic">No job postings yet</p>
                </div>
              ) : (
                jds.map((jd) => (
                  <motion.div
                    key={jd.jd_id}
                    layout
                    onClick={() => setSelectedJd(jd)}
                    className={cn(
                      "p-4 rounded-2xl glass-card cursor-pointer transition-all duration-300",
                      selectedJd?.jd_id === jd.jd_id 
                        ? "border-l-[4px] border-l-violet-500 bg-white/10" 
                        : "hover:bg-white/5 border-l-[4px] border-l-transparent"
                    )}
                  >
                    <h3 className="font-bold text-sm text-white truncate mb-1">{jd.title}</h3>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <Users className="w-3 h-3" /> {jd.applicant_count} applicants
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <CalendarDays className="w-3 h-3" /> {new Date(jd.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT PANEL (2/3) */}
          <div className="lg:col-span-2 glass-card rounded-3xl overflow-hidden relative">
            <AnimatePresence mode="wait">
              {selectedJd ? (
                <motion.div 
                  key={selectedJd.jd_id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-6 h-full flex flex-col"
                >
                  {/* --- HEADER --- */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">{selectedJd.title}</h2>
                      <p className="text-xs text-white/40">
                        Posted on {new Date(selectedJd.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setIsAuditPanelOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-bold hover:bg-violet-500/20 transition-all"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        Bias Audit
                      </button>
                      
                      <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">PII Blind</span>
                        <button 
                          onClick={() => setIsPiiBlind(!isPiiBlind)}
                          className={cn(
                            "w-8 h-4 rounded-full relative transition-colors duration-300",
                            isPiiBlind ? "bg-violet-500" : "bg-white/10"
                          )}
                        >
                          <motion.div 
                            animate={{ x: isPiiBlind ? 16 : 2 }}
                            className="w-3 h-3 bg-white rounded-full absolute top-0.5" 
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* --- CANDIDATE RANKING --- */}
                  <div className="flex-1 overflow-y-auto space-y-4 pt-6 pr-2 custom-scrollbar">
                    {rankingLoading ? (
                      Array(3).fill(0).map((_, i) => (
                        <div key={i} className="h-40 glass-card rounded-2xl shimmer" />
                      ))
                    ) : rankings.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                        <Users className="w-10 h-10 text-white/10 mb-4" />
                        <h3 className="text-lg font-bold text-white/40">No candidates yet</h3>
                      </div>
                    ) : (
                      rankings.map((candidate, idx) => (
                        <RankingCard 
                          key={candidate.user_id}
                          candidate={candidate}
                          rank={idx + 1}
                          isPiiBlind={isPiiBlind}
                          name={getCandidateName(candidate.full_name, idx)}
                          onViewProfile={() => {
                            setSelectedCandidate(candidate);
                            setIsProfilePanelOpen(true);
                          }}
                        />
                      ))
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center p-12 text-center"
                >
                  <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                    <Briefcase className="w-10 h-10 text-white/10" />
                  </div>
                  <h3 className="text-xl font-bold text-white/60 mb-2">Select a JD to view candidates</h3>
                  <p className="text-sm text-white/30 max-w-xs mx-auto">
                    Choose a position from the left panel to see its applicant pool and match intelligence.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── SLIDE OVER: BIAS AUDIT ──────────────────────────────────────── */}
        <SlideOver 
          isOpen={isAuditPanelOpen} 
          onClose={() => setIsAuditPanelOpen(false)}
          title="JD Bias Audit"
          subtitle={`Auditing: ${selectedJd?.title}`}
        >
          {selectedJd && <BiasAuditContent initialJd={selectedJd.description} />}
        </SlideOver>

        {/* ── SLIDE OVER: PROFILE VIEW ────────────────────────────────────── */}
        <SlideOver 
          isOpen={isProfilePanelOpen} 
          onClose={() => setIsProfilePanelOpen(false)}
          title={isPiiBlind ? "Candidate Profile" : selectedCandidate?.full_name}
          subtitle={isPiiBlind ? "PII Redacted for unbiased review" : "Full applicant dossier"}
        >
          {selectedCandidate && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/5 border border-white/8">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">GitHub Stats</p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-lg font-black text-white">{selectedCandidate.profile_data?.github?.repoCount ?? 0}</p>
                      <p className="text-[10px] text-white/40">Repos</p>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div>
                      <p className="text-lg font-black text-white">{selectedCandidate.profile_data?.github?.totalStars ?? 0}</p>
                      <p className="text-[10px] text-white/40">Stars</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/8">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">LeetCode</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-black text-white">{selectedCandidate.profile_data?.leetcode?.totalSolved ?? 0}</p>
                      <p className="text-[10px] text-white/40">Solved</p>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div>
                      <p className="text-lg font-black text-amber-400">{selectedCandidate.profile_data?.leetcode?.contestRating ?? 0}</p>
                      <p className="text-[10px] text-white/40">Rating</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* GitHub Languages */}
              {selectedCandidate.profile_data?.github?.topLanguages?.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Top GitHub Languages</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCandidate.profile_data.github.topLanguages.map((l: any) => (
                      <span key={l.name} className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-medium">
                        {l.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">Core Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCandidate.matched_skills.map((s: string) => (
                    <span key={s} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
                      {s}
                    </span>
                  ))}
                  {selectedCandidate.partial_skills.map((s: any) => (
                    <span key={s.skill} className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold">
                      {s.skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SlideOver>

        {/* ── POST NEW JD MODAL ───────────────────────────────────────────── */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-4xl glass-card rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Post New Job Description</h2>
                      <p className="text-xs text-white/40">Draft and audit your JD for maximum inclusivity</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 rounded-full hover:bg-white/5 text-white/30 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block ml-1">Position Title</label>
                      <input 
                        type="text"
                        value={newJdTitle}
                        onChange={(e) => setNewJdTitle(e.target.value)}
                        placeholder="e.g. Senior Full Stack Engineer"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block ml-1">JD Content</label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Audit for Bias First</span>
                          <button 
                            onClick={() => setAuditEnabled(!auditEnabled)}
                            className={cn(
                              "w-8 h-4 rounded-full relative transition-colors duration-300",
                              auditEnabled ? "bg-violet-500" : "bg-white/10"
                            )}
                          >
                            <motion.div 
                              animate={{ x: auditEnabled ? 16 : 2 }}
                              className="w-3 h-3 bg-white rounded-full absolute top-0.5" 
                            />
                          </button>
                        </div>
                      </div>
                      <textarea 
                        value={newJdDesc}
                        onChange={(e) => {
                          setNewJdDesc(e.target.value);
                          if (auditResult) setAuditResult(null);
                        }}
                        placeholder="Paste your job description here..."
                        className="w-full h-48 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 outline-none transition-all resize-none font-mono leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Audit Results Inline */}
                  <AnimatePresence>
                    {auditEnabled && (
                      <div className="pt-4 border-t border-white/5">
                        {!auditResult && !auditing ? (
                          <button 
                            onClick={handleAudit}
                            className="w-full py-2.5 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-bold hover:bg-violet-500/20 transition-all"
                          >
                            Run Bias Audit
                          </button>
                        ) : auditing ? (
                          <div className="flex items-center justify-center py-8 gap-3">
                            <RotateCcw className="w-5 h-5 text-violet-400 animate-spin" />
                            <p className="text-sm text-white/40 font-medium">Scanning for bias patterns...</p>
                          </div>
                        ) : auditResult && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                          >
                            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                              <BiasGauge score={auditResult.bias_score} />
                              <div className="flex-1 max-w-xs ml-4">
                                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                                  <Info className="w-3 h-3" /> Summary
                                </p>
                                <p className="text-[11px] text-white/60 leading-relaxed">{auditResult.summary}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                  <ShieldAlert className="w-3 h-3 text-amber-400" /> Detected Flags
                                </h4>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                  {auditResult.bias_flags.map((flag, idx) => (
                                    <FlagCard key={idx} flag={flag} index={idx} />
                                  ))}
                                  {auditResult.bias_flags.length === 0 && (
                                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                                      <p className="text-[10px] text-emerald-300">Inclusivity check passed!</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3 text-violet-400" /> AI-Rewritten
                                  </h4>
                                  <button 
                                    onClick={() => {
                                      setNewJdDesc(auditResult.rewritten_jd);
                                      toast("Using rewritten version", "info");
                                    }}
                                    className="text-[10px] font-bold text-violet-400 hover:text-violet-300 underline"
                                  >
                                    Use this version
                                  </button>
                                </div>
                                <div className="p-3 rounded-xl bg-white/5 border border-white/8 text-[11px] text-white/70 leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar font-sans">
                                  {auditResult.rewritten_jd}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-white/10 flex items-center justify-end gap-3">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-bold hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handlePostJD}
                    disabled={posting}
                    className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-400 text-white text-sm font-bold hover:shadow-lg hover:shadow-violet-500/20 transition-all flex items-center gap-2"
                  >
                    {posting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
                    Post JD
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </PageWrapper>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </>
  );
}
