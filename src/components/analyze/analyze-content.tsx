"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Sparkles, Brain, X,
  CheckCircle, AlertTriangle, ShieldCheck, EyeOff,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import MatchResults from "@/components/analyze/match-results";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ResumeData {
  name?: string;
  email?: string;
  phone?: string;
  skills: string[];
  experience: { content: string }[];
  education: string[];
  github_url?: string;
  leetcode_url?: string;
}

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

interface AnalyzeContentProps {
  /** Pre-fill the JD textarea (used when launched from a JD card) */
  initialJd?: string;
  /** Called with full match result + resume data after analysis succeeds */
  onMatchComplete?: (result: MatchResponse, resumeData: ResumeData, blindScored: boolean, piiCount: number) => void;
  /** If true, hide the outer PageWrapper padding (dashboard embeds it in its own padding) */
  compact?: boolean;
}

// ─── Skill Pill ───────────────────────────────────────────────────────────────
function SkillPill({ skill, index }: { skill: string; index: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 20 }}
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
        bg-violet-500/15 text-violet-300 border border-violet-500/30
        hover:bg-violet-500/25 hover:border-violet-400/50 transition-colors cursor-default"
    >
      {skill}
    </motion.span>
  );
}

function SkeletonRow({ width }: { width: string }) {
  return <div className="h-7 rounded-full shimmer" style={{ width }} />;
}

function AnalyzingOverlay() {
  return (
    <motion.div
      key="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center
        bg-[#0A0A0F]/90 backdrop-blur-xl"
    >
      <div className="relative flex items-center justify-center mb-8">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-violet-500/40"
            style={{ width: 120 + i * 60, height: 120 + i * 60 }}
            animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.2, 0.5] }}
            transition={{ duration: 2, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="w-20 h-20 rounded-full border-2 border-transparent border-t-violet-500 border-r-cyan-400"
        />
        <Brain className="absolute w-9 h-9 text-violet-400" />
      </div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-2"
      >
        Analyzing Match
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-white/50 text-sm"
      >
        Running semantic embeddings &amp; skill extraction…
      </motion.p>
      <div className="flex gap-2 mt-6">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-violet-500"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main exportable component ────────────────────────────────────────────────
export function AnalyzeContent({ initialJd = "", onMatchComplete, compact = false }: AnalyzeContentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging]     = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing]       = useState(false);
  const [resumeData, setResumeData]     = useState<ResumeData | null>(null);
  const [jobDescription, setJobDescription] = useState(initialJd);
  const [isAnalyzing, setIsAnalyzing]   = useState(false);
  const [matchResult, setMatchResult]   = useState<MatchResponse | null>(null);
  const [blindScoring, setBlindScoring] = useState(false);

  const MAX_JD_CHARS = 3000;
  const canAnalyze = resumeData !== null && jobDescription.trim().length > 30 && !isAnalyzing;

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf")) { toast("Only PDF files are supported.", "error"); return; }
    if (file.size > 10 * 1024 * 1024) { toast("File exceeds 10 MB limit.", "error"); return; }
    setUploadedFile(file); setResumeData(null); setMatchResult(null); setIsParsing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("http://localhost:8000/api/parse-resume", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: ResumeData = await res.json();
      setResumeData(data);
      toast(`Resume parsed — ${data.skills.length} skills detected.`, "success");
    } catch (err: unknown) {
      toast(`Parsing failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
      setUploadedFile(null);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleAnalyze = async () => {
    if (!canAnalyze || !resumeData) return;
    setIsAnalyzing(true); setMatchResult(null);
    try {
      const res = await fetch("http://localhost:8000/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_data: resumeData, job_description: jobDescription, anonymize: blindScoring }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: MatchResponse = await res.json();
      setMatchResult(data);
      toast(blindScoring ? "Blind analysis complete — identity hidden from scoring." : "Analysis complete!", "success");
      onMatchComplete?.(data, resumeData, blindScoring, data.pii_count ?? 0);
    } catch (err: unknown) {
      toast(`Analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const inner = (
    <>
      <AnimatePresence>{isAnalyzing && <AnalyzingOverlay />}</AnimatePresence>

      {/* Blind Scoring Toggle */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-5">
        <button
          id="blind-scoring-toggle"
          onClick={() => setBlindScoring((v) => !v)}
          className={`group relative flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-300 cursor-pointer select-none ${
            blindScoring
              ? "bg-violet-500/15 border-violet-500/50 shadow-[0_0_28px_rgba(139,92,246,0.2)]"
              : "bg-white/4 border-white/12 hover:border-violet-500/30 hover:bg-violet-500/8"
          }`}
        >
          <div
            className={`relative rounded-full transition-colors duration-300 shrink-0 ${blindScoring ? "bg-gradient-to-r from-violet-500 to-cyan-500" : "bg-white/15"}`}
            style={{ height: "22px", width: "40px" }}
          >
            <motion.div
              className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-md"
              animate={{ left: blindScoring ? "20px" : "3px" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </div>
          <div className="flex items-center gap-2">
            {blindScoring
              ? <ShieldCheck className="w-4 h-4 text-violet-400" />
              : <EyeOff className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />}
            <span className={`text-sm font-semibold transition-colors duration-200 ${blindScoring ? "text-violet-300" : "text-white/55 group-hover:text-white/75"}`}>
              Enable Blind Scoring 🔒
            </span>
          </div>
          {blindScoring && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="ml-auto text-[10px] font-bold uppercase tracking-wider text-violet-300 bg-violet-500/20 border border-violet-500/30 px-2 py-0.5 rounded-full"
            >Active</motion.span>
          )}
        </button>
        <AnimatePresence>
          {blindScoring && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 10 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30">
                <ShieldCheck className="w-4 h-4 text-violet-400 shrink-0" />
                <p className="text-xs text-violet-200/80 leading-relaxed">
                  Candidate evaluated on skills only — identity hidden from scoring
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Resume Upload */}
        <motion.div
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="glass-card rounded-3xl p-6 flex flex-col gap-5"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-violet-400" />
            <h2 className="font-bold text-lg">Resume Upload</h2>
          </div>
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => !isParsing && fileInputRef.current?.click()}
            animate={isDragging ? { scale: 1.01 } : { scale: 1 }}
            className={`relative rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 select-none dashed-pulse ${
              isDragging
                ? "border-violet-400 bg-violet-500/10 shadow-[0_0_40px_rgba(139,92,246,0.15)]"
                : uploadedFile
                  ? "border-violet-500/40 bg-violet-500/5"
                  : "border-white/15 bg-white/3 hover:border-violet-500/50 hover:bg-violet-500/5"
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
              onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
            <AnimatePresence mode="wait">
              {!uploadedFile && !isParsing && (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white/80">Drop your resume here</p>
                    <p className="text-xs text-white/35 mt-1">or click to browse · PDF only · max 10 MB</p>
                  </div>
                </motion.div>
              )}
              {isParsing && (
                <motion.div key="parsing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full space-y-3">
                  <p className="text-sm text-violet-300 font-medium mb-4 flex items-center gap-2 justify-center">
                    <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block">⟳</motion.span>
                    Parsing resume…
                  </p>
                  <SkeletonRow width="70%" /><SkeletonRow width="50%" /><SkeletonRow width="85%" /><SkeletonRow width="60%" />
                </motion.div>
              )}
              {uploadedFile && !isParsing && (
                <motion.div key="uploaded" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="font-semibold text-white/90 text-sm">{uploadedFile.name}</p>
                  <p className="text-xs text-white/35">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setResumeData(null); setMatchResult(null); }}
                    className="mt-1 text-xs text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-1"
                  ><X className="w-3 h-3" /> Remove</button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <AnimatePresence>
            {resumeData && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                {(resumeData.name || resumeData.email) && (
                  <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/8 space-y-1">
                    {resumeData.name && <p className="text-sm font-semibold text-white/80">{resumeData.name}</p>}
                    {resumeData.email && <p className="text-xs text-white/40">{resumeData.email}</p>}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Detected Skills ({resumeData.skills.length})</p>
                  {resumeData.skills.length === 0 ? (
                    <div className="flex items-center gap-2 text-yellow-400/70 text-xs">
                      <AlertTriangle className="w-4 h-4" />No skills detected from the skills database.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {resumeData.skills.map((skill, i) => <SkillPill key={skill} skill={skill} index={i} />)}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Right: Job Description */}
        <motion.div
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          className="glass-card rounded-3xl p-6 flex flex-col gap-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h2 className="font-bold text-lg">Job Description</h2>
            </div>
            <span className={`text-xs font-mono transition-colors ${jobDescription.length > MAX_JD_CHARS * 0.9 ? "text-red-400" : "text-white/30"}`}>
              {jobDescription.length} / {MAX_JD_CHARS}
            </span>
          </div>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value.slice(0, MAX_JD_CHARS))}
            placeholder={"Paste the job description here…\n\ne.g. We are looking for a Senior React Engineer with experience in TypeScript, Node.js, and cloud infrastructure..."}
            className="flex-1 min-h-[280px] w-full resize-none rounded-2xl bg-white/5 border border-white/10 text-white/80 text-sm placeholder:text-white/20 leading-relaxed p-4 outline-none focus:border-violet-500/50 focus:bg-white/7 transition-all duration-200 font-sans backdrop-blur-sm"
          />
          <motion.button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            whileHover={canAnalyze ? { scale: 1.02 } : {}}
            whileTap={canAnalyze ? { scale: 0.98 } : {}}
            className={`relative w-full py-4 rounded-2xl font-bold text-sm overflow-hidden transition-all duration-300 ${
              canAnalyze
                ? "text-white cursor-pointer shadow-[0_0_40px_rgba(108,99,255,0.3)]"
                : "text-white/30 cursor-not-allowed bg-white/5 border border-white/10"
            }`}
          >
            {canAnalyze && (
              <>
                <span className="absolute inset-0" style={{ background: "linear-gradient(135deg, #6C63FF 0%, #00D9FF 100%)" }} />
                <span className="absolute inset-0 btn-shimmer" />
              </>
            )}
            <span className="relative flex items-center justify-center gap-2">
              <Brain className="w-4 h-4" />
              {canAnalyze ? "Analyze Match" : "Upload resume & add job description"}
            </span>
          </motion.button>
          {!resumeData && <p className="text-center text-xs text-white/25">Upload a resume on the left to enable analysis</p>}
        </motion.div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {matchResult && (
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="mt-6"
          >
            <MatchResults result={matchResult} jobDescription={jobDescription} blindScored={matchResult.blind_scored} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  if (compact) return inner;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex-1 p-6 md:p-10"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">
          Resume <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Analyzer</span>
        </h1>
        <p className="text-white/40 text-sm">Upload a resume and paste a job description to get a semantic match score.</p>
      </div>
      {inner}
    </motion.div>
  );
}
