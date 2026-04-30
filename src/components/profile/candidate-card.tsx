"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  GitFork, FileText, Code2, Star, Zap, ArrowRight,
  TrendingUp, Award, GitBranch, BookOpen,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ResumeData {
  name?: string; email?: string; skills: string[];
  experience: { content: string }[]; education: string[];
}
export interface GitHubData {
  username: string; repoCount: number; totalStars: number;
  topLanguages: { name: string; count: number }[];
  bio?: string; followers: number;
}
export interface LeetCodeData {
  username: string; totalSolved: number;
  easy: number; medium: number; hard: number; contestRating: number;
}

interface Props {
  resume: ResumeData | null;
  github: GitHubData | null;
  leetcode: LeetCodeData | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function mergeSkills(resume: ResumeData | null, github: GitHubData | null): { name: string; weight: number }[] {
  const counts: Record<string, number> = {};
  resume?.skills.forEach(s => { counts[s] = (counts[s] ?? 0) + 3; });
  github?.topLanguages.forEach(l => { counts[l.name] = (counts[l.name] ?? 0) + l.count; });
  return Object.entries(counts)
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 30);
}

function buildSignals(resume: ResumeData | null, github: GitHubData | null, leetcode: LeetCodeData | null): string[] {
  const sigs: string[] = [];
  if (github) {
    sigs.push(`${github.repoCount} public repos on GitHub`);
    if (github.totalStars > 0) sigs.push(`${github.totalStars} total GitHub stars earned`);
    if (github.followers > 10) sigs.push(`${github.followers} GitHub followers`);
    if (github.topLanguages[0]) sigs.push(`Primary language: ${github.topLanguages[0].name}`);
  }
  if (leetcode) {
    sigs.push(`${leetcode.totalSolved} LeetCode problems solved`);
    if (leetcode.hard > 0) sigs.push(`${leetcode.hard} hard problems solved`);
    if (leetcode.contestRating > 1500) sigs.push(`Contest rating: ${leetcode.contestRating}`);
  }
  if (resume) {
    if (resume.skills.length > 5) sigs.push(`${resume.skills.length} skills detected from resume`);
    if (resume.experience.length > 0) sigs.push(`${resume.experience.length} experience entries parsed`);
  }
  return sigs.slice(0, 5);
}

// ── Skill Cloud ────────────────────────────────────────────────────────────────
function SkillCloud({ skills }: { skills: { name: string; weight: number }[] }) {
  const max = skills[0]?.weight ?? 1;
  const COLORS = [
    "from-violet-500/20 to-violet-500/10 border-violet-500/30 text-violet-300",
    "from-cyan-500/20 to-cyan-500/10 border-cyan-500/30 text-cyan-300",
    "from-emerald-500/20 to-emerald-500/10 border-emerald-500/30 text-emerald-300",
    "from-amber-500/20 to-amber-500/10 border-amber-500/30 text-amber-300",
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((s, i) => {
        const pct = s.weight / max;
        const size = pct > 0.7 ? "text-base px-4 py-2 font-bold" :
                     pct > 0.4 ? "text-sm px-3 py-1.5 font-semibold" :
                                 "text-xs px-3 py-1 font-medium";
        const col = COLORS[i % COLORS.length];
        return (
          <motion.span
            key={s.name}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03, type: "spring", stiffness: 300, damping: 20 }}
            className={`rounded-full border bg-gradient-to-br cursor-default select-none ${size} ${col}`}
          >
            {s.name}
          </motion.span>
        );
      })}
    </div>
  );
}

// ── Tech Stack Chart ───────────────────────────────────────────────────────────
const BAR_COLORS = ["#6C63FF", "#00D9FF", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl px-3 py-2 text-xs text-white/80 border border-white/10">
      <p className="font-bold">{payload[0].payload.name}</p>
      <p className="text-white/50">{payload[0].value} repos</p>
    </div>
  );
}

function TechChart({ data }: { data: { name: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data.slice(0, 8)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.slice(0, 8).map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── LeetCode Difficulty Bars ───────────────────────────────────────────────────
function DiffBar({ label, val, total, color }: { label: string; val: number; total: number; color: string }) {
  const pct = total > 0 ? (val / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/50">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{val}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-violet-400">{icon}</span>
        <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="h-px bg-white/8" />
      {children}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};
const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { ease: [0.16, 1, 0.3, 1] as const, duration: 0.5 } },
};

export default function CandidateCard({ resume, github, leetcode }: Props) {
  const router = useRouter();
  const skills  = mergeSkills(resume, github);
  const signals = buildSignals(resume, github, leetcode);
  const name    = resume?.name ?? github?.username ?? leetcode?.username ?? "Candidate";
  const totalSources = [resume, github, leetcode].filter(Boolean).length;

  const handleUseProfile = () => {
    if (!resume?.skills.length) return;
    const encoded = encodeURIComponent(resume.skills.join(", "));
    router.push(`/analyze?skills=${encoded}`);
  };

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {/* ── Header card ─────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="glass-card rounded-3xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-black text-white">{name}</h2>
            {resume?.email && <p className="text-sm text-white/40 mt-0.5">{resume.email}</p>}
            {github?.bio  && <p className="text-sm text-white/50 mt-1 max-w-md">{github.bio}</p>}
            <div className="flex gap-3 mt-3 flex-wrap">
              {resume   && <span className="flex items-center gap-1.5 text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-full"><FileText className="w-3 h-3" />Resume</span>}
              {github   && <span className="flex items-center gap-1.5 text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full"><GitFork className="w-3 h-3" />GitHub</span>}
              {leetcode && <span className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full"><Code2 className="w-3 h-3" />LeetCode</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-violet-400">{totalSources}<span className="text-lg text-white/30">/3</span></p>
            <p className="text-xs text-white/35">sources loaded</p>
          </div>
        </div>
      </motion.div>

      {/* ── Two column grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Skills Cloud */}
          {skills.length > 0 && (
            <motion.div variants={fadeUp} className="glass-card rounded-3xl p-6 space-y-4">
              <Section title="Skills Cloud" icon={<Zap className="w-4 h-4" />}>
                <SkillCloud skills={skills} />
              </Section>
            </motion.div>
          )}

          {/* Tech Stack Chart */}
          {github && github.topLanguages.length > 0 && (
            <motion.div variants={fadeUp} className="glass-card rounded-3xl p-6 space-y-4">
              <Section title="Tech Stack (GitHub)" icon={<TrendingUp className="w-4 h-4" />}>
                <TechChart data={github.topLanguages} />
              </Section>
            </motion.div>
          )}

          {/* Experience Timeline */}
          {resume && resume.experience.length > 0 && (
            <motion.div variants={fadeUp} className="glass-card rounded-3xl p-6 space-y-4">
              <Section title="Experience" icon={<BookOpen className="w-4 h-4" />}>
                <div className="relative pl-5 space-y-3">
                  <div className="absolute left-0 top-1 bottom-1 w-px bg-gradient-to-b from-violet-500/50 to-transparent" />
                  {resume.experience.slice(0, 8).map((exp, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="relative"
                    >
                      <div className="absolute -left-5 top-1.5 w-2 h-2 rounded-full bg-violet-500 border border-violet-400/50" />
                      <p className="text-sm text-white/65 leading-relaxed">{exp.content}</p>
                    </motion.div>
                  ))}
                </div>
              </Section>
            </motion.div>
          )}
        </div>

        {/* RIGHT (1/3) */}
        <div className="space-y-5">

          {/* Strongest Signals */}
          {signals.length > 0 && (
            <motion.div variants={fadeUp} className="glass-card rounded-3xl p-6 space-y-4">
              <Section title="Strongest Signals" icon={<Star className="w-4 h-4" />}>
                <div className="space-y-2">
                  {signals.map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-start gap-2 p-2.5 rounded-xl bg-white/5 border border-white/8"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                      <p className="text-xs text-white/65 leading-relaxed">{s}</p>
                    </motion.div>
                  ))}
                </div>
              </Section>
            </motion.div>
          )}

          {/* GitHub Stats */}
          {github && (
            <motion.div variants={fadeUp} className="glass-card rounded-3xl p-6 space-y-4">
              <Section title="GitHub Stats" icon={<GitBranch className="w-4 h-4" />}>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Repos",     val: github.repoCount,   color: "text-violet-400" },
                    { label: "Stars",     val: github.totalStars,  color: "text-amber-400"  },
                    { label: "Followers", val: github.followers,   color: "text-cyan-400"   },
                    { label: "Languages", val: github.topLanguages.length, color: "text-emerald-400" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="rounded-2xl bg-white/5 border border-white/8 p-3 text-center">
                      <p className={`text-xl font-black font-mono ${color}`}>{val}</p>
                      <p className="text-[10px] text-white/35 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </motion.div>
          )}

          {/* LeetCode Stats */}
          {leetcode && (
            <motion.div variants={fadeUp} className="glass-card rounded-3xl p-6 space-y-4">
              <Section title="LeetCode" icon={<Award className="w-4 h-4" />}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-2xl font-black text-white">{leetcode.totalSolved}</p>
                  <p className="text-xs text-white/40">problems solved</p>
                </div>
                <div className="space-y-2.5">
                  <DiffBar label="Easy"   val={leetcode.easy}   total={leetcode.totalSolved} color="#10b981" />
                  <DiffBar label="Medium" val={leetcode.medium} total={leetcode.totalSolved} color="#f59e0b" />
                  <DiffBar label="Hard"   val={leetcode.hard}   total={leetcode.totalSolved} color="#ef4444" />
                </div>
                {leetcode.contestRating > 0 && (
                  <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <p className="text-xs text-amber-300 font-semibold">Contest Rating: {leetcode.contestRating}</p>
                  </div>
                )}
              </Section>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      {resume && resume.skills.length > 0 && (
        <motion.div variants={fadeUp}>
          <motion.button
            onClick={handleUseProfile}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="relative w-full flex items-center justify-center gap-3 py-4 rounded-2xl
              text-white font-bold overflow-hidden shadow-[0_0_40px_rgba(108,99,255,0.2)]"
          >
            <span className="absolute inset-0" style={{ background: "linear-gradient(135deg,#6C63FF,#00D9FF)" }} />
            <span className="absolute inset-0 btn-shimmer" />
            <Zap className="relative w-5 h-5" />
            <span className="relative">Use This Profile to Match a JD</span>
            <ArrowRight className="relative w-5 h-5" />
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
