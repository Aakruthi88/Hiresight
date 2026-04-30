-- ============================================================
-- TalentLens — Supabase Database Setup  (idempotent / re-runnable)
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times — all objects use IF NOT EXISTS /
-- DROP … IF EXISTS guards so nothing errors on a second run.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 0. Shared helper: auto-update updated_at on any table
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- 1. profiles  (mirrors auth.users — stores role + display name)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT        NOT NULL UNIQUE,
    password_hash TEXT      NOT NULL,
    role        TEXT        NOT NULL CHECK (role IN ('candidate', 'recruiter')),
    full_name   TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "profiles: select own"              ON public.profiles;
DROP POLICY IF EXISTS "profiles: update own"              ON public.profiles;
DROP POLICY IF EXISTS "profiles: recruiters can read all" ON public.profiles;

CREATE POLICY "profiles: select own"
    ON public.profiles FOR SELECT
    USING ((auth.jwt() ->> 'sub')::uuid = id);

CREATE POLICY "profiles: update own"
    ON public.profiles FOR UPDATE
    USING ((auth.jwt() ->> 'sub')::uuid = id);

-- Recruiters can read every profile (needed for candidate search)
CREATE POLICY "profiles: recruiters can read all"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (auth.jwt() ->> 'sub')::uuid AND p.role = 'recruiter'
        )
    );
-- Note: INSERT is handled server-side with the service key (bypasses RLS).


-- ══════════════════════════════════════════════════════════════
-- 2. resumes  (parsed resume storage per candidate)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.resumes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    filename    TEXT,
    raw_text    TEXT,
    parsed_data JSONB,          -- { name, email, skills, experience, education }
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resumes: select own" ON public.resumes;
DROP POLICY IF EXISTS "resumes: insert own" ON public.resumes;
DROP POLICY IF EXISTS "resumes: delete own" ON public.resumes;

CREATE POLICY "resumes: select own"
    ON public.resumes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "resumes: insert own"
    ON public.resumes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "resumes: delete own"
    ON public.resumes FOR DELETE
    USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
-- 3. match_results  (history of every /api/match run)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.match_results (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    resume_id        UUID        REFERENCES public.resumes(id) ON DELETE SET NULL,
    job_description  TEXT        NOT NULL,
    overall_score    INT         NOT NULL,
    matched_skills   JSONB       DEFAULT '[]',
    partial_skills   JSONB       DEFAULT '[]',
    missing_skills   JSONB       DEFAULT '[]',
    explanation      TEXT,
    blind_scored     BOOLEAN     DEFAULT FALSE,
    pii_count        INT         DEFAULT 0,
    redacted_fields  JSONB       DEFAULT '[]',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_results: select own" ON public.match_results;
DROP POLICY IF EXISTS "match_results: insert own" ON public.match_results;

CREATE POLICY "match_results: select own"
    ON public.match_results FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "match_results: insert own"
    ON public.match_results FOR INSERT
    WITH CHECK (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
-- 4. job_descriptions  (recruiter-owned JD postings)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.job_descriptions (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    recruiter_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title         TEXT        NOT NULL,
    description   TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS jd_updated_at ON public.job_descriptions;
CREATE TRIGGER jd_updated_at
    BEFORE UPDATE ON public.job_descriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_jd_recruiter ON public.job_descriptions(recruiter_id);

ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jd: recruiter select own"  ON public.job_descriptions;
DROP POLICY IF EXISTS "jd: recruiter insert"      ON public.job_descriptions;
DROP POLICY IF EXISTS "jd: recruiter update own"  ON public.job_descriptions;
DROP POLICY IF EXISTS "jd: recruiter delete own"  ON public.job_descriptions;
DROP POLICY IF EXISTS "jd: candidates read all"   ON public.job_descriptions;

CREATE POLICY "jd: recruiter select own"
    ON public.job_descriptions FOR SELECT
    USING (auth.uid() = recruiter_id);

CREATE POLICY "jd: recruiter insert"
    ON public.job_descriptions FOR INSERT
    WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "jd: recruiter update own"
    ON public.job_descriptions FOR UPDATE
    USING (auth.uid() = recruiter_id);

CREATE POLICY "jd: recruiter delete own"
    ON public.job_descriptions FOR DELETE
    USING (auth.uid() = recruiter_id);

-- Candidates can browse all posted JDs
CREATE POLICY "jd: candidates read all"
    ON public.job_descriptions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'candidate'
        )
    );


-- ══════════════════════════════════════════════════════════════
-- 5. applications  (candidate match results per JD)
--    UNIQUE (candidate_id, jd_id) → enables upsert without dupes
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.applications (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    jd_id            UUID        NOT NULL REFERENCES public.job_descriptions(id) ON DELETE CASCADE,

    -- Match result (mirrors /api/match response)
    match_score      INT         NOT NULL DEFAULT 0,
    matched_skills   JSONB       NOT NULL DEFAULT '[]',
    partial_skills   JSONB       NOT NULL DEFAULT '[]',
    missing_skills   JSONB       NOT NULL DEFAULT '[]',
    explanation      TEXT,

    -- Blind-scoring metadata
    blind_scored     BOOLEAN     NOT NULL DEFAULT FALSE,
    pii_count        INT         NOT NULL DEFAULT 0,

    -- Optional enrichment
    github_username  TEXT,
    leetcode_username TEXT,
    profile_data     JSONB,      -- { github, leetcode, … }
    resume_data      JSONB,      -- raw parsed resume snapshot

    submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_candidate_jd UNIQUE (candidate_id, jd_id)
);

DROP TRIGGER IF EXISTS applications_updated_at ON public.applications;
CREATE TRIGGER applications_updated_at
    BEFORE UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_app_jd        ON public.applications(jd_id);
CREATE INDEX IF NOT EXISTS idx_app_candidate ON public.applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_app_score     ON public.applications(jd_id, match_score DESC);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications: candidate select own"   ON public.applications;
DROP POLICY IF EXISTS "applications: candidate insert"       ON public.applications;
DROP POLICY IF EXISTS "applications: candidate update own"   ON public.applications;
DROP POLICY IF EXISTS "applications: recruiter read by jd"  ON public.applications;

-- Candidates manage their own rows
CREATE POLICY "applications: candidate select own"
    ON public.applications FOR SELECT
    USING (auth.uid() = candidate_id);

CREATE POLICY "applications: candidate insert"
    ON public.applications FOR INSERT
    WITH CHECK (auth.uid() = candidate_id);

CREATE POLICY "applications: candidate update own"
    ON public.applications FOR UPDATE
    USING (auth.uid() = candidate_id);

-- Recruiters read applications only for JDs they own
CREATE POLICY "applications: recruiter read by jd"
    ON public.applications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.job_descriptions jd
            WHERE jd.id = applications.jd_id
              AND jd.recruiter_id = auth.uid()
        )
    );


-- ============================================================
-- Done. Verify with:
--   SELECT * FROM public.profiles          LIMIT 5;
--   SELECT * FROM public.job_descriptions  LIMIT 5;
--   SELECT * FROM public.applications      LIMIT 5;
-- ============================================================
