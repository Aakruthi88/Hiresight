"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, GitFork, Code2, Upload, CheckCircle,
  Loader2, AlertTriangle, X, Search, User,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import CandidateCard, {
  type ResumeData, type GitHubData, type LeetCodeData,
} from "@/components/profile/candidate-card";

type LoadState = "idle" | "loading" | "done" | "error";

function normaliseUsername(raw: string, platform: "github" | "leetcode"): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    if (platform === "github")   return parts[0] ?? trimmed;
    if (platform === "leetcode") return (parts[0] === "u" ? parts[1] : parts[0]) ?? trimmed;
  } catch { /* not a URL */ }
  return trimmed;
}

async function fetchGitHub(rawInput: string): Promise<GitHubData> {
  const username = normaliseUsername(rawInput, "github");
  if (!username) throw new Error("Invalid GitHub username or URL");
  const res = await fetch(`http://localhost:8000/api/github/${encodeURIComponent(username)}`);
  if (!res.ok) { const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` })); throw new Error(err.detail ?? `GitHub error ${res.status}`); }
  const data = await res.json();
  return { username: data.username, repoCount: data.repoCount, totalStars: data.totalStars, topLanguages: data.topLanguages, bio: data.bio ?? undefined, followers: data.followers ?? 0 };
}

async function fetchLeetCode(rawInput: string): Promise<LeetCodeData> {
  const username = normaliseUsername(rawInput, "leetcode");
  if (!username) throw new Error("Invalid LeetCode username or URL");
  const res = await fetch(`http://localhost:8000/api/leetcode/${encodeURIComponent(username)}`);
  if (!res.ok) { const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` })); throw new Error(err.detail ?? `LeetCode error ${res.status}`); }
  const data = await res.json();
  return { username: data.username, totalSolved: data.totalSolved, easy: data.easy, medium: data.medium, hard: data.hard, contestRating: data.contestRating ?? 0 };
}

function Skeleton() {
  return (
    <div className="space-y-3 pt-2">
      {[70, 50, 85, 60].map((w, i) => (
        <div key={i} className="h-5 rounded-full shimmer" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function SourcePanel({
  icon, title, color, border, status, children,
}: {
  icon: React.ReactNode; title: string; color: string;
  border: string; status: LoadState; children: React.ReactNode;
}) {
  const statusIcon = {
    idle:    null,
    loading: <Loader2 className="w-4 h-4 animate-spin text-white/40" />,
    done:    <CheckCircle className="w-4 h-4 text-emerald-400" />,
    error:   <AlertTriangle className="w-4 h-4 text-red-400" />,
  }[status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-3xl p-6 flex flex-col gap-4 border-2 transition-colors duration-500 ${
        status === "done" ? "border-emerald-500/25" : status === "error" ? "border-red-500/20" : border
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
        <p className="font-bold text-base">{title}</p>
        <span className="ml-auto">{statusIcon}</span>
      </div>
      {children}
    </motion.div>
  );
}

/** Fully self-contained profile builder — can be embedded in dashboard or used standalone */
export function ProfileContent({ compact = false }: { compact?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resumeData,   setResumeData]   = useState<ResumeData | null>(null);
  const [githubData,   setGithubData]   = useState<GitHubData | null>(null);
  const [leetcodeData, setLeetcodeData] = useState<LeetCodeData | null>(null);
  const [resumeState,   setResumeState]   = useState<LoadState>("idle");
  const [githubState,   setGithubState]   = useState<LoadState>("idle");
  const [leetcodeState, setLeetcodeState] = useState<LoadState>("idle");
  const [uploadedFile,      setUploadedFile]      = useState<File | null>(null);
  const [githubUsername,    setGithubUsername]     = useState("");
  const [leetcodeUsername,  setLeetcodeUsername]   = useState("");

  const anyLoaded = resumeData || githubData || leetcodeData;

  const processResume = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf")) { toast("PDF files only.", "error"); return; }
    setUploadedFile(file); setResumeState("loading"); setResumeData(null);
    try {
      const form = new FormData(); form.append("file", file);
      const res = await fetch("http://localhost:8000/api/parse-resume", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data: ResumeData = await res.json();
      setResumeData(data); setResumeState("done");
      toast(`Resume parsed — ${data.skills.length} skills found`, "success");
    } catch (e) {
      setResumeState("error"); toast(`Resume failed: ${e instanceof Error ? e.message : e}`, "error");
    }
  }, []);

  const onDrop = useCallback((ev: React.DragEvent) => {
    ev.preventDefault(); const f = ev.dataTransfer.files[0]; if (f) processResume(f);
  }, [processResume]);

  const loadGitHub = async () => {
    if (!githubUsername.trim()) { toast("Enter a GitHub username or profile URL.", "error"); return; }
    setGithubState("loading"); setGithubData(null);
    try {
      const data = await fetchGitHub(githubUsername.trim());
      setGithubData(data); setGithubState("done");
      toast(`GitHub loaded — ${data.repoCount} repos, ${data.topLanguages.length} languages`, "success");
    } catch (e) { setGithubState("error"); toast(`GitHub: ${e instanceof Error ? e.message : "Unknown error"}`, "error"); }
  };

  const loadLeetCode = async () => {
    if (!leetcodeUsername.trim()) { toast("Enter a LeetCode username or profile URL.", "error"); return; }
    setLeetcodeState("loading"); setLeetcodeData(null);
    try {
      const data = await fetchLeetCode(leetcodeUsername.trim());
      setLeetcodeData(data); setLeetcodeState("done");
      toast(`LeetCode loaded — ${data.totalSolved} problems solved`, "success");
    } catch (e) { setLeetcodeState("error"); toast(`LeetCode: ${e instanceof Error ? e.message : "Unknown error"}`, "error"); }
  };

  const content = (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {/* Resume */}
        <SourcePanel icon={<FileText className="w-5 h-5" />} title="Resume" color="bg-violet-500/15 text-violet-400" border="border-violet-500/15" status={resumeState}>
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && processResume(e.target.files[0])} />
          <AnimatePresence mode="wait">
            {resumeState === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onDragOver={e => e.preventDefault()} onDrop={onDrop} onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 py-8 rounded-2xl border-2 border-dashed border-violet-500/20 bg-violet-500/5 cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/8 transition-all text-center"
              >
                <Upload className="w-7 h-7 text-violet-400" />
                <p className="text-sm text-white/60 font-medium">Drop PDF or click to upload</p>
                <p className="text-xs text-white/25">Max 10 MB</p>
              </motion.div>
            )}
            {resumeState === "loading" && (<motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Skeleton /></motion.div>)}
            {(resumeState === "done" || resumeState === "error") && resumeData && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white/80 truncate">{uploadedFile?.name}</p>
                  <button onClick={() => { setResumeState("idle"); setResumeData(null); setUploadedFile(null); }} className="text-white/30 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                </div>
                {resumeData.name && <p className="text-xs text-white/50"><User className="w-3 h-3 inline mr-1" />{resumeData.name}</p>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {resumeData.skills.slice(0, 8).map(s => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300">{s}</span>
                  ))}
                  {resumeData.skills.length > 8 && <span className="text-[10px] text-white/30">+{resumeData.skills.length - 8} more</span>}
                </div>
              </motion.div>
            )}
            {resumeState === "error" && !resumeData && (
              <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400/80 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />Backend not reachable. Is the server running?
              </motion.div>
            )}
          </AnimatePresence>
        </SourcePanel>

        {/* GitHub */}
        <SourcePanel icon={<GitFork className="w-5 h-5" />} title="GitHub" color="bg-cyan-500/15 text-cyan-400" border="border-cyan-500/15" status={githubState}>
          <div className="flex gap-2">
            <input value={githubUsername} onChange={e => { setGithubUsername(e.target.value); if (githubState !== "idle") setGithubState("idle"); }}
              onKeyDown={e => e.key === "Enter" && loadGitHub()}
              placeholder="username or github.com/user"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-500/40 transition-colors"
            />
            <motion.button onClick={loadGitHub} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={githubState === "loading"}
              className="px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/25 transition-colors disabled:opacity-50"
            ><Search className="w-4 h-4" /></motion.button>
          </div>
          <AnimatePresence mode="wait">
            {githubState === "idle" && (<motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-white/25 text-center py-4">Enter a username to fetch public repos</motion.p>)}
            {githubState === "loading" && (<motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Skeleton /></motion.div>)}
            {githubState === "done" && githubData && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {[{ l: "Repos", v: githubData.repoCount, c: "text-cyan-400" }, { l: "Stars", v: githubData.totalStars, c: "text-amber-400" }, { l: "Followers", v: githubData.followers, c: "text-violet-400" }, { l: "Languages", v: githubData.topLanguages.length, c: "text-emerald-400" }].map(({ l, v, c }) => (
                    <div key={l} className="rounded-xl bg-white/5 border border-white/8 p-2 text-center">
                      <p className={`text-lg font-black font-mono ${c}`}>{v}</p>
                      <p className="text-[10px] text-white/35">{l}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {githubData.topLanguages.slice(0, 5).map(l => (<span key={l.name} className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/12 border border-cyan-500/20 text-cyan-300">{l.name}</span>))}
                </div>
              </motion.div>
            )}
            {githubState === "error" && (<motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400/80 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />User not found or API limit hit.</motion.div>)}
          </AnimatePresence>
        </SourcePanel>

        {/* LeetCode */}
        <SourcePanel icon={<Code2 className="w-5 h-5" />} title="LeetCode" color="bg-amber-500/15 text-amber-400" border="border-amber-500/15" status={leetcodeState}>
          <div className="flex gap-2">
            <input value={leetcodeUsername} onChange={e => { setLeetcodeUsername(e.target.value); if (leetcodeState !== "idle") setLeetcodeState("idle"); }}
              onKeyDown={e => e.key === "Enter" && loadLeetCode()}
              placeholder="username or leetcode.com/u/user"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-amber-500/40 transition-colors"
            />
            <motion.button onClick={loadLeetCode} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={leetcodeState === "loading"}
              className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 hover:bg-amber-500/25 transition-colors disabled:opacity-50"
            ><Search className="w-4 h-4" /></motion.button>
          </div>
          <AnimatePresence mode="wait">
            {leetcodeState === "idle" && (<motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-white/25 text-center py-4">Enter username to load profile</motion.p>)}
            {leetcodeState === "loading" && (<motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Skeleton /></motion.div>)}
            {leetcodeState === "done" && leetcodeData && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-amber-400">{leetcodeData.totalSolved}</span>
                  <span className="text-xs text-white/35">problems solved</span>
                </div>
                <div className="space-y-1.5">
                  {[{ l: "Easy", v: leetcodeData.easy, c: "#10b981" }, { l: "Medium", v: leetcodeData.medium, c: "#f59e0b" }, { l: "Hard", v: leetcodeData.hard, c: "#ef4444" }].map(({ l, v, c }) => (
                    <div key={l} className="flex items-center gap-2">
                      <span className="text-xs text-white/40 w-14">{l}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: c }} initial={{ width: 0 }} animate={{ width: `${(v / leetcodeData.totalSolved) * 100}%` }} transition={{ duration: 0.8 }} />
                      </div>
                      <span className="text-xs font-mono font-bold w-8 text-right" style={{ color: c }}>{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-300/70 pt-1">⚡ Contest rating: <span className="font-bold">{leetcodeData.contestRating}</span><span className="text-white/25 ml-1">(estimated)</span></p>
              </motion.div>
            )}
            {leetcodeState === "error" && (<motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400/80 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />User not found or API limit hit.</motion.div>)}
          </AnimatePresence>
        </SourcePanel>
      </div>

      {/* Unified Candidate Card */}
      <AnimatePresence>
        {anyLoaded && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={{ type: "spring", stiffness: 180, damping: 24 }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
              <span className="text-xs font-bold uppercase tracking-widest text-violet-400/70 px-3">Unified Profile</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
            </div>
            <CandidateCard resume={resumeData} github={githubData} leetcode={leetcodeData} />
          </motion.div>
        )}
      </AnimatePresence>

      {!anyLoaded && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="flex flex-col items-center justify-center py-20 text-center gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <User className="w-7 h-7 text-white/20" />
          </div>
          <p className="text-white/30 text-sm max-w-sm">Load at least one source above to generate your unified candidate profile.</p>
        </motion.div>
      )}
    </>
  );

  if (compact) return content;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="flex-1 p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Profile <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Builder</span></h1>
        <p className="text-white/40 text-sm">Combine resume, GitHub, and LeetCode into a unified candidate profile.</p>
      </div>
      {content}
    </motion.div>
  );
}
