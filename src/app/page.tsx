"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  Sparkles, 
  Brain, 
  Info, 
  Scale, 
  Link as LinkIcon,
  LogIn
} from "lucide-react";

import { cn } from "@/lib/utils";
import { isAuthenticated } from "@/lib/auth";

const TypewriterTitle = () => {
  const text = "Your Resume Isn't the Problem. The System Is.";
  const [displayText, setDisplayText] = useState("");
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayText(text.slice(0, i));
      i++;
      if (i > text.length) {
        clearInterval(interval);
        setTimeout(() => setIsFinished(true), 1000);
      }
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-[120px] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
        <span className={cn(!isFinished && "typewriter-cursor")}>{displayText}</span>
      </h1>
      <AnimatePresence>
        {isFinished && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl text-muted-foreground max-w-2xl"
          >
            TalentLens sees your skills the way a great recruiter would — not the way a keyword filter does.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

const ComparisonCards = () => {
  return (
    <div className="relative flex flex-col md:flex-row gap-8 items-center justify-center py-12">
      {/* ATS Card */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 3, duration: 0.8 }}
        className="glass-card p-6 rounded-3xl w-72 border-destructive/20 relative group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <XCircle className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold text-destructive uppercase tracking-widest">ATS REJECTED</span>
        </div>
        <div className="space-y-3 opacity-50">
          <div className="h-4 bg-white/10 rounded w-full" />
          <div className="h-4 bg-white/10 rounded w-3/4" />
          <div className="h-4 bg-white/10 rounded w-1/2" />
        </div>
        <div className="mt-6 pt-4 border-t border-white/10 text-sm text-muted-foreground font-mono">
          Reason: Keywords &quot;Cloud&quot; not found
        </div>
      </motion.div>

      {/* Connection Line / VS */}
      <motion.div 
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 3.5 }}
        className="z-10 bg-background border border-white/10 rounded-full p-4 font-bold text-sm"
      >
        VS
      </motion.div>

      {/* TalentLens Card */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 4, duration: 0.8 }}
        className="glass-card p-6 rounded-3xl w-72 border-success/30 relative shadow-[0_0_40px_rgba(0,217,255,0.1)]"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold text-success uppercase tracking-widest">TalentLens MATCHED</span>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-success/20 rounded w-full animate-pulse" />
          <div className="h-4 bg-secondary/20 rounded w-full" />
          <div className="h-4 bg-primary/20 rounded w-full" />
        </div>
        <div className="mt-6 pt-4 border-t border-white/10 text-sm text-success font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Identified Semantic Fit: 98%
        </div>
      </motion.div>
    </div>
  );
};

const FeatureStrip = () => {
  const features = [
    {
      icon: <Brain className="w-6 h-6" />,
      name: "Semantic Skill Matching",
      desc: "FastAPI = REST API. We get it.",
      color: "text-primary",
      glow: "group-hover:shadow-[0_0_20px_rgba(108,99,255,0.3)]",
    },
    {
      icon: <Info className="w-6 h-6" />,
      name: "Explainable Scoring",
      desc: "Know exactly why you matched or didn't.",
      color: "text-secondary",
      glow: "group-hover:shadow-[0_0_20px_rgba(0,217,255,0.3)]",
    },
    {
      icon: <Scale className="w-6 h-6" />,
      name: "Bias Auditor",
      desc: "Fair job descriptions. Better talent pools.",
      color: "text-success",
      glow: "group-hover:shadow-[0_0_20px_rgba(0,255,157,0.3)]",
    },
    {
      icon: <LinkIcon className="w-6 h-6" />,
      name: "Multi-Source Profiles",
      desc: "GitHub, LeetCode, resume — one candidate view.",
      color: "text-warning",
      glow: "group-hover:shadow-[0_0_20px_rgba(255,107,107,0.3)]",
    },
  ];

  return (
    <section className="w-full py-24 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 mb-12">
        <motion.h2 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="text-2xl font-bold tracking-tight text-white/50 uppercase"
        >
          Core Capabilities
        </motion.h2>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-12 px-4 md:px-[calc((100vw-1152px)/2)] scrollbar-hide">
        {features.map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ scale: 1.05, translateY: -5 }}
            className={cn(
              "glass-card min-w-[300px] md:min-w-[350px] p-8 rounded-[2rem] flex flex-col gap-4 group transition-all duration-300",
              feature.glow
            )}
          >
            <div className={cn("w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center transition-colors group-hover:bg-white/10", feature.color)}>
              {feature.icon}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1">{feature.name}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default function Home() {
  const [authStatus, setAuthStatus] = useState<{ loggedIn: boolean; role: string }>({ loggedIn: false, role: "" });

  useEffect(() => {
    const token = localStorage.getItem("tl_token");
    const role = localStorage.getItem("tl_role");
    if (token) {
      setAuthStatus({ loggedIn: true, role: role || "candidate" });
    }
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* ── Top Right Auth Link ── */}
      <div className="absolute top-8 right-8 z-50">
        {authStatus.loggedIn ? (
          <motion.a 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            href={`/dashboard/${authStatus.role}`} 
            className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-xs transition-all flex items-center gap-2 group backdrop-blur-md shadow-xl"
          >
            Go to Dashboard <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.a>
        ) : (
          <motion.a 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            href="/auth" 
            className="text-white/40 hover:text-white font-bold text-xs transition-all tracking-widest uppercase flex items-center gap-2"
          >
            Sign In
          </motion.a>
        )}
      </div>

      {/* Animated Orbs */}
      <div className="orb w-[400px] h-[400px] bg-primary/20 top-[-100px] left-[-100px]" />
      <div className="orb w-[500px] h-[500px] bg-secondary/10 bottom-[-100px] right-[-100px]" style={{ animationDelay: "-5s" }} />
      <div className="orb w-[300px] h-[300px] bg-success/10 top-[20%] right-[10%]" style={{ animationDelay: "-10s" }} />

      <section className="relative h-screen flex flex-col items-center justify-center pt-20">
        <div className="z-10 w-full max-w-6xl mx-auto flex flex-col items-center">
          <TypewriterTitle />
          
          <ComparisonCards />

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 5, duration: 0.5 }}
            className="flex flex-col md:flex-row gap-4 mt-8"
          >
            <a href="/auth" className="px-8 py-4 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center gap-2 group">
              Analyze My Resume 
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="/auth" className="px-8 py-4 rounded-2xl border-2 border-secondary text-secondary font-bold hover:bg-secondary/10 transition-all">
              Audit a Job Description
            </a>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 flex flex-col items-center gap-2 text-muted-foreground opacity-50"
        >
          <span className="text-xs uppercase tracking-widest font-semibold">Scroll to explore</span>
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </section>

      <FeatureStrip />
    </div>
  );
}

