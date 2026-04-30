"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, AlertCircle, CheckCircle2, ShieldAlert,
  Info, ChevronDown, ClipboardCopy, RotateCcw,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { ToastContainer, toast } from "@/components/ui/toast";

// ── Types ──────────────────────────────────────────────────────────────────────
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

// ── Category meta ──────────────────────────────────────────────────────────────
const CAT_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  gendered:             { label: "Gendered Language",       color: "text-orange-300",  bg: "bg-orange-500/10",  border: "border-orange-500/25" },
  credential_gate:      { label: "Credential Inflation",    color: "text-red-300",     bg: "bg-red-500/10",     border: "border-red-500/25"    },
  experience_inflation: { label: "Experience Inflation",    color: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-500/25"  },
  exclusionary:         { label: "Exclusionary Language",   color: "text-pink-300",    bg: "bg-pink-500/10",    border: "border-pink-500/25"   },
};

const SEV_COLOR: Record<string, string> = {
  high:   "text-red-400",
  medium: "text-amber-400",
  low:    "text-sky-400",
};

const SEV_DOT: Record<string, string> = {
  high:   "bg-red-400",
  medium: "bg-amber-400",
  low:    "bg-sky-400",
};

// ── Bias Score Gauge ───────────────────────────────────────────────────────────
function BiasGauge({ score }: { score: number }) {
  // cap visual at 30 for a clear gauge
  const pct = Math.min(score / 30, 1);
  const color = pct > 0.6 ? "#ef4444" : pct > 0.3 ? "#f59e0b" : "#10b981";
  const label = pct > 0.6 ? "High Bias" : pct > 0.3 ? "Moderate Bias" : "Low Bias";
  const radius = 40, circ = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="-rotate-90 absolute inset-0" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={radius} strokeWidth="7" stroke="rgba(255,255,255,0.06)" fill="none" />
          <motion.circle
            cx="44" cy="44" r={radius}
            strokeWidth="7" stroke={color} fill="none" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - pct * circ }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="relative text-center">
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="text-2xl font-black" style={{ color }}
          >{score}</motion.p>
          <p className="text-[9px] text-white/35 uppercase tracking-widest">score</p>
        </div>
      </div>
      <div>
        <p className="font-bold text-sm" style={{ color }}>{label}</p>
        <p className="text-xs text-white/35 mt-0.5">weighted severity score</p>
        <p className="text-xs text-white/25 mt-1">
          {score === 0 ? "No issues detected" : `${score} bias points found`}
        </p>
      </div>
    </div>
  );
}

// ── Flag Card ──────────────────────────────────────────────────────────────────
function FlagCard({ flag, index }: { flag: BiasFlag; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = CAT_META[flag.category] ?? { label: flag.category, color: "text-white/60", bg: "bg-white/5", border: "border-white/10" };

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl border ${meta.border} ${meta.bg} overflow-hidden`}
    >
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        {/* severity dot */}
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEV_DOT[flag.severity] ?? "bg-white/30"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-white">&quot;{flag.phrase}&quot;</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.border} ${meta.color} ${meta.bg}`}>
              {meta.label}
            </span>
            <span className={`text-[10px] font-mono uppercase ml-auto ${SEV_COLOR[flag.severity]}`}>
              {flag.severity}
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1">
            → <span className="text-emerald-300 font-medium">{flag.suggestion}</span>
          </p>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="ctx"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <p className="text-xs text-white/30 italic border-l-2 border-white/10 pl-3">
                …{flag.context}…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Rewritten JD Panel ─────────────────────────────────────────────────────────
function RewrittenPanel({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card rounded-3xl p-6 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          AI-Rewritten JD
        </h3>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-white/8 hover:bg-white/15
            border border-white/10 text-white/60 hover:text-white transition-all"
        >
          <ClipboardCopy className="w-3.5 h-3.5" />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="h-px bg-white/8" />
      <pre className="text-xs text-white/65 leading-relaxed whitespace-pre-wrap font-sans max-h-56 overflow-y-auto pr-1
        scrollbar-thin scrollbar-thumb-white/10">
        {text}
      </pre>
    </motion.div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────
function AuditSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[80, 65, 90, 55].map((w, i) => (
        <div key={i} className="h-16 rounded-2xl shimmer" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function RecruiterPage() {
  const [jd, setJd] = useState(
    `We are looking for a rockstar ninja developer who is aggressive and dominant.\nThe ideal candidate will be a culture fit with our young and dynamic team.\nWe have a beer fridge and embrace the work hard, play hard mentality.\n\nRequirements:\n- Degree required (Computer Science or related)\n- 5+ years experience with Next.js\n- Must be a native English speaker\n- No job hoppers — we value loyalty`
  );
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Pre-fill from /analyze "Audit JD" link (?jd=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("jd");
    if (prefill) setJd(decodeURIComponent(prefill));
  }, []);

  const handleAudit = async () => {
    if (!jd.trim()) { toast("Please paste a job description first.", "error"); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("http://localhost:8000/api/audit-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description: jd }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: AuditResult = await res.json();
      setResult(data);
      toast(
        data.bias_flags.length === 0
          ? "No bias detected — this JD looks great!"
          : `Found ${data.bias_flags.length} bias flag${data.bias_flags.length > 1 ? "s" : ""}. Review below.`,
        data.bias_flags.length === 0 ? "success" : "info"
      );
      // scroll to results
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: unknown) {
      toast(`Audit failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Group flags by category
  const byCategory = result
    ? result.bias_flags.reduce<Record<string, BiasFlag[]>>((acc, f) => {
        (acc[f.category] = acc[f.category] ?? []).push(f);
        return acc;
      }, {})
    : {};

  return (
    <>
      <ToastContainer />
      <PageWrapper>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold mb-1"
            >
              JD{" "}
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Bias Auditor
              </span>
            </motion.h1>
            <p className="text-white/40 text-sm">
              Scan job descriptions for gendered, exclusionary, and inflated language.
            </p>
          </div>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            onClick={handleAudit}
            disabled={loading}
            whileHover={!loading ? { scale: 1.04 } : {}}
            whileTap={!loading ? { scale: 0.97 } : {}}
            className="relative flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm
              text-white overflow-hidden shadow-[0_0_30px_rgba(0,217,255,0.25)]
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="absolute inset-0" style={{ background: "linear-gradient(135deg, #6C63FF, #00D9FF)" }} />
            <span className="absolute inset-0 btn-shimmer" />
            {loading
              ? <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="relative"><RotateCcw className="w-4 h-4" /></motion.span><span className="relative">Auditing…</span></>
              : <><Sparkles className="relative w-4 h-4" /><span className="relative">AI Optimize</span></>
            }
          </motion.button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT — JD Input */}
          <motion.div
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="glass-card rounded-3xl p-6 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-white/70">Input JD Content</h2>
              <span className="text-xs text-white/25 font-mono">{jd.length} chars</span>
            </div>
            <textarea
              value={jd}
              onChange={e => { setJd(e.target.value); setResult(null); }}
              placeholder="Paste your job description here…"
              className="flex-1 min-h-[520px] w-full resize-none rounded-2xl
                bg-white/5 border border-white/10 text-white/75 text-sm font-mono
                placeholder:text-white/20 leading-relaxed p-4
                outline-none focus:border-violet-500/40 focus:bg-white/7
                transition-all duration-200"
            />
          </motion.div>

          {/* RIGHT — Results */}
          <motion.div
            ref={resultsRef}
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
            className="flex flex-col gap-4"
          >
            {/* Bias Analysis card */}
            <div className="glass-card rounded-3xl p-6 space-y-5">
              <h2 className="font-bold text-sm text-white/70 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Bias Analysis
              </h2>

              <AnimatePresence mode="wait">
                {/* Idle state */}
                {!loading && !result && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-12 text-center gap-3"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    <p className="text-sm text-white/40">
                      Paste a JD on the left and click{" "}
                      <span className="text-violet-300 font-semibold">AI Optimize</span>
                    </p>
                  </motion.div>
                )}

                {/* Loading */}
                {loading && (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <AuditSkeleton />
                  </motion.div>
                )}

                {/* Results */}
                {result && !loading && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="space-y-5"
                  >
                    {/* Score gauge */}
                    <BiasGauge score={result.bias_score} />

                    {/* Summary */}
                    <div className="flex gap-2 p-3 rounded-xl bg-white/5 border border-white/8">
                      <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-white/55 leading-relaxed">{result.summary}</p>
                    </div>

                    {/* Clean result */}
                    {result.bias_flags.length === 0 && (
                      <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <p className="text-sm text-emerald-300 font-semibold">
                          No bias patterns detected — this JD looks inclusive!
                        </p>
                      </div>
                    )}

                    {/* Flags grouped by category */}
                    {Object.entries(byCategory).map(([cat, flags]) => {
                      const meta = CAT_META[cat] ?? { label: cat, color: "text-white/60" };
                      return (
                        <div key={cat} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className={`w-4 h-4 ${meta.color}`} />
                            <p className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>
                              {meta.label}
                            </p>
                            <span className="ml-auto text-xs text-white/30 font-mono">{flags.length}</span>
                          </div>
                          {flags.map((f, i) => <FlagCard key={`${f.phrase}-${i}`} flag={f} index={i} />)}
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Rewritten JD (only when results ready) */}
            <AnimatePresence>
              {result && !loading && result.rewritten_jd && (
                <RewrittenPanel text={result.rewritten_jd} />
              )}
            </AnimatePresence>

            {/* Readability score placeholder (static for now) */}
            {!result && !loading && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glass-card rounded-3xl p-6"
              >
                <h2 className="font-bold text-sm text-white/70 mb-3">Readability Score</h2>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-black font-mono text-white/80">B+</span>
                  <span className="text-white/35 mb-1 text-sm">Run an audit for full analysis</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </PageWrapper>
    </>
  );
}
