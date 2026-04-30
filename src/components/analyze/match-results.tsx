"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
  Download,
  ArrowRight,
  Lightbulb,
  Zap,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface MatchResponse {
  overall_score: number;
  matched_skills: string[];
  partial_skills: string[];
  missing_skills: string[];
  explanation: string;
  blind_scored?: boolean;
  pii_count?: number;
  redacted_fields?: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(pct: number) {
  if (pct >= 75) return { hex: "#10b981", tw: "emerald", label: "Strong Match" };
  if (pct >= 50) return { hex: "#f59e0b", tw: "amber",   label: "Moderate Match" };
  return               { hex: "#ef4444", tw: "red",     label: "Weak Match" };
}

function buildExplanationBullets(explanation: string, result: MatchResponse): string[] {
  // If the backend sends one long string, split on ". " to get sentences.
  const fromBackend = explanation
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
    .map((s) => (s.endsWith(".") ? s : s + "."));

  // Supplement with derived bullets so we always have 3-4 items.
  const extra: string[] = [];
  if (result.matched_skills.length > 0 && fromBackend.length < 2) {
    extra.push(
      `${result.matched_skills.length} skills matched directly, indicating strong alignment with core requirements.`
    );
  }
  if (result.partial_skills.length > 0) {
    extra.push(
      `${result.partial_skills.length} skill${result.partial_skills.length > 1 ? "s" : ""} were identified as conceptual matches via semantic similarity — these count for partial credit.`
    );
  }
  if (result.missing_skills.length > 0) {
    extra.push(
      `${result.missing_skills.length} required skill${result.missing_skills.length > 1 ? "s" : ""} (e.g. ${result.missing_skills.slice(0, 2).join(", ")}) were absent, lowering the overall score.`
    );
  }

  const merged = [...fromBackend, ...extra];
  return merged.slice(0, 5);
}

// ─── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(eased * target);
      if (next !== ref.current) {
        ref.current = next;
        setValue(next);
      }
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}

// ─── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const radius = 58;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(score, 0), 100);
  const { hex, label } = scoreColor(pct);
  const displayValue = useCountUp(pct, 1400);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center w-40 h-40">
        {/* Glow backdrop */}
        <div
          className="absolute inset-0 rounded-full opacity-20 blur-2xl"
          style={{ background: hex }}
        />
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128">
          {/* Track */}
          <circle cx="64" cy="64" r={radius} strokeWidth="8" stroke="rgba(255,255,255,0.06)" fill="none" />
          {/* Progress */}
          <motion.circle
            cx="64" cy="64" r={radius}
            strokeWidth="8"
            stroke={hex}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 10px ${hex})` }}
          />
        </svg>
        {/* Number */}
        <div className="relative text-center select-none">
          <span className="text-4xl font-black tabular-nums" style={{ color: hex }}>
            {displayValue}
          </span>
          <span className="text-lg font-bold" style={{ color: hex }}>%</span>
          <p className="text-[10px] text-white/35 font-medium mt-0.5 uppercase tracking-widest">Match</p>
        </div>
      </div>
      {/* Label badge */}
      <div
        className="px-4 py-1 rounded-full text-xs font-bold border"
        style={{ color: hex, borderColor: `${hex}40`, background: `${hex}15` }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── Skill Card ────────────────────────────────────────────────────────────────
interface SkillCardConfig {
  variant: "matched" | "partial" | "missing";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  skills: string[];
  glow: string;
  border: string;
  tagBg: string;
  tagText: string;
  tagBorder: string;
  headerColor: string;
}

function SkillColumn({ cfg, colIndex }: { cfg: SkillCardConfig; colIndex: number }) {
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: true, margin: "-60px" });

  const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06, delayChildren: colIndex * 0.12 } },
  };
  const pill = {
    hidden:  { opacity: 0, scale: 0.75, y: 8 },
    visible: { opacity: 1, scale: 1,    y: 0,
               transition: { type: "spring" as const, stiffness: 380, damping: 22 } },
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: colIndex * 0.12, ease: [0.16, 1, 0.3, 1] }}
      className={`
        relative rounded-3xl p-5 flex flex-col gap-4
        backdrop-blur-md bg-white/5 border overflow-hidden
        ${cfg.border}
      `}
      style={{ boxShadow: `0 0 40px -10px ${cfg.glow}` }}
    >
      {/* Corner glow */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 blur-2xl pointer-events-none"
        style={{ background: cfg.glow }}
      />

      {/* Header */}
      <div className="flex items-center gap-2">
        <span className={cfg.headerColor}>{cfg.icon}</span>
        <div>
          <p className="text-sm font-bold text-white">{cfg.title}</p>
          <p className="text-[10px] text-white/35">{cfg.subtitle}</p>
        </div>
        <span className={`ml-auto text-xs font-mono font-bold px-2 py-0.5 rounded-full ${cfg.tagBg} ${cfg.tagText}`}>
          {cfg.skills.length}
        </span>
      </div>

      <div className="h-px bg-white/8" />

      {/* Pills */}
      {cfg.skills.length === 0 ? (
        <p className="text-xs text-white/25 italic text-center py-4">None in this category</p>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="flex flex-wrap gap-2"
        >
          {cfg.skills.map((skill) => (
            <motion.span
              key={skill}
              variants={pill}
              title={skill}
              className={`
                inline-flex items-center gap-1 px-3 py-1.5 rounded-full
                text-xs font-semibold border cursor-default select-none
                transition-all duration-200 hover:scale-105
                ${cfg.tagBg} ${cfg.tagText} ${cfg.tagBorder}
              `}
            >
              {/* For partial skills, split the "X (conceptually similar to Y)" format */}
              {cfg.variant === "partial" ? (
                <>
                  <span>{skill.split(" (")[0]}</span>
                  {skill.includes(" (") && (
                    <span className="opacity-50 font-normal">
                      ≈ {skill.split("similar to ")[1]?.replace(")", "") ?? ""}
                    </span>
                  )}
                </>
              ) : (
                skill
              )}
            </motion.span>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Why This Score ─────────────────────────────────────────────────────────────
function WhyThisScore({ bullets }: { bullets: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-3xl backdrop-blur-md bg-white/5 border border-white/10 overflow-hidden"
    >
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
          <Lightbulb className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Why This Score?</p>
          <p className="text-[11px] text-white/35">
            {open ? "Click to collapse" : "Expand for a breakdown of how this score was calculated"}
          </p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="w-5 h-5 text-white/40" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-3">
              <div className="h-px bg-white/8 mb-4" />
              {bullets.map((bullet, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, ease: "easeOut" }}
                  className="flex gap-3 items-start"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0" />
                  <p className="text-sm text-white/60 leading-relaxed">{bullet}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Action Bar ────────────────────────────────────────────────────────────────
function ActionBar({ result, jobDescription }: { result: MatchResponse; jobDescription?: string }) {
  const handleDownload = () => {
    const { overall_score, matched_skills, partial_skills, missing_skills, explanation } = result;
    const lines = [
      "TalentLens — Match Report",
      "=".repeat(40),
      `Overall Score: ${overall_score}%`,
      "",
      "MATCHED SKILLS:",
      ...matched_skills.map((s) => `  ✓ ${s}`),
      "",
      "PARTIAL MATCHES:",
      ...partial_skills.map((s) => `  ~ ${s}`),
      "",
      "MISSING SKILLS:",
      ...missing_skills.map((s) => `  ✗ ${s}`),
      "",
      "EXPLANATION:",
      explanation,
      "",
      `Generated: ${new Date().toLocaleString()}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `talentlens-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build query param to pre-fill /recruiter with JD text
  const auditHref = jobDescription
    ? `/recruiter?jd=${encodeURIComponent(jobDescription.slice(0, 800))}`
    : "/recruiter";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col sm:flex-row gap-3"
    >
      {/* Download */}
      <motion.button
        onClick={handleDownload}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl
          bg-white/8 border border-white/15 text-white/80 text-sm font-semibold
          hover:bg-white/14 hover:border-white/25 hover:text-white transition-all duration-200"
      >
        <Download className="w-4 h-4" />
        Download Report
      </motion.button>

      {/* Audit JD */}
      <Link href={auditHref} className="flex-1">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="relative w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl
            text-white text-sm font-bold overflow-hidden cursor-pointer
            shadow-[0_0_30px_rgba(108,99,255,0.25)]"
        >
          <span
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg, #6C63FF 0%, #00D9FF 100%)" }}
          />
          <span className="absolute inset-0 btn-shimmer" />
          <Zap className="relative w-4 h-4" />
          <span className="relative">Audit the JD for Bias</span>
          <ArrowRight className="relative w-4 h-4" />
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
export default function MatchResults({
  result,
  jobDescription,
  blindScored,
}: {
  result: MatchResponse;
  jobDescription?: string;
  blindScored?: boolean;
}) {
  const { overall_score, matched_skills, partial_skills, missing_skills, explanation } = result;
  const piiCount = result.pii_count ?? 0;
  const redactedFields = result.redacted_fields ?? [];
  const bullets = buildExplanationBullets(explanation, result);

  const columns: SkillCardConfig[] = [
    {
      variant: "matched",
      icon: <CheckCircle2 className="w-5 h-5" />,
      title: "Matched Skills",
      subtitle: "Direct keyword or semantic match",
      skills: matched_skills,
      glow: "#10b981",
      border: "border-emerald-500/20",
      tagBg: "bg-emerald-500/12",
      tagText: "text-emerald-300",
      tagBorder: "border border-emerald-500/25",
      headerColor: "text-emerald-400",
    },
    {
      variant: "partial",
      icon: <AlertCircle className="w-5 h-5" />,
      title: "Partial Matches",
      subtitle: "Conceptually similar via AI",
      skills: partial_skills,
      glow: "#f59e0b",
      border: "border-amber-500/20",
      tagBg: "bg-amber-500/12",
      tagText: "text-amber-200",
      tagBorder: "border border-amber-500/25",
      headerColor: "text-amber-400",
    },
    {
      variant: "missing",
      icon: <XCircle className="w-5 h-5" />,
      title: "Missing Skills",
      subtitle: "Required by JD but not found",
      skills: missing_skills,
      glow: "#ef4444",
      border: "border-red-500/20",
      tagBg: "bg-red-500/12",
      tagText: "text-red-300",
      tagBorder: "border border-red-500/25",
      headerColor: "text-red-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Blind Scoring Banner ──────────────────────────────────────────── */}
      <AnimatePresence>
        {blindScored && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-2xl border border-violet-500/40
              bg-gradient-to-r from-violet-500/12 via-violet-500/8 to-cyan-500/10
              shadow-[0_0_32px_rgba(139,92,246,0.15)]"
          >
            {/* ── Top row: icon · title · big number ── */}
            <div className="flex items-center gap-4 px-5 py-4">
              {/* Pulsing shield icon */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full bg-violet-500/30 animate-ping opacity-40" />
                <div className="relative w-10 h-10 rounded-full flex items-center justify-center
                  bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-violet-500/40">
                  <ShieldCheck className="w-5 h-5 text-violet-300" />
                </div>
              </div>

              {/* Title + subtitle */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-violet-200">Blind Scoring Active</p>
                <p className="text-xs text-violet-300/65 mt-0.5">
                  Candidate evaluated on skills only — identity hidden from scoring
                </p>
              </div>

              {/* Big numeric PII count */}
              <div className="shrink-0 text-right">
                <motion.p
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25, type: "spring", stiffness: 380, damping: 18 }}
                  className="text-4xl font-black tabular-nums leading-none"
                  style={{
                    background: "linear-gradient(135deg, #a78bfa 0%, #67e8f9 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {piiCount}
                </motion.p>
                <p className="text-[10px] text-violet-300/50 font-semibold uppercase tracking-wider mt-0.5">
                  PII items redacted
                </p>
              </div>
            </div>

            {/* ── Bottom row: redacted category chips ── */}
            {redactedFields.length > 0 && (
              <>
                <div className="h-px bg-violet-500/20 mx-5" />
                <div className="px-5 py-3 flex flex-wrap gap-2 items-center">
                  <span className="text-[10px] text-violet-300/40 font-semibold uppercase tracking-wider mr-1">
                    Fields redacted:
                  </span>
                  {redactedFields.map((field, i) => (
                    <motion.span
                      key={field}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.07, type: "spring", stiffness: 400, damping: 22 }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                        text-[10px] font-bold uppercase tracking-wider
                        bg-violet-500/20 border border-violet-500/35 text-violet-200"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block shrink-0" />
                      {field.replace(/_/g, " ")}
                    </motion.span>
                  ))}
                </div>
              </>
            )}

            {/* Zero-redaction message */}
            {piiCount === 0 && (
              <div className="px-5 pb-3">
                <p className="text-xs text-violet-300/40 italic">
                  No identifiable PII found in this profile — scoring proceeded on capabilities alone.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>


      {/* ── Row 1: Score ring + stat strip ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-center gap-8"
      >
        <ScoreRing score={overall_score} />

        {/* Stats strip */}
        <div className="flex-1 w-full space-y-5">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Analysis Complete</h3>
            <p className="text-sm text-white/45 leading-relaxed max-w-lg">{explanation}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Matched",  count: matched_skills.length, color: "#10b981", bg: "bg-emerald-500/8  border-emerald-500/20" },
              { label: "Partial",  count: partial_skills.length,  color: "#f59e0b", bg: "bg-amber-500/8   border-amber-500/20"  },
              { label: "Missing",  count: missing_skills.length,  color: "#ef4444", bg: "bg-red-500/8     border-red-500/20"    },
            ].map(({ label, count, color, bg }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1, ease: "easeOut" }}
                className={`rounded-2xl border p-3 text-center ${bg}`}
              >
                <p className="text-2xl font-black font-mono" style={{ color }}>{count}</p>
                <p className="text-[11px] text-white/40 mt-0.5 font-medium">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Row 2: Three skill columns ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((cfg, i) => (
          <SkillColumn key={cfg.variant} cfg={cfg} colIndex={i} />
        ))}
      </div>

      {/* ── Row 3: Why This Score (collapsible) ───────────────────────── */}
      <WhyThisScore bullets={bullets} />

      {/* ── Row 4: Action bar ──────────────────────────────────────────── */}
      <ActionBar result={result} jobDescription={jobDescription} />
    </div>
  );
}
