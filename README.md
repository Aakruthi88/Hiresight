# 🔍 TalentLens — AI-Powered Recruitment Intelligence

> Semantic resume matching, bias auditing, PII anonymization, and candidate profile analysis — all in one platform.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi)
![spaCy](https://img.shields.io/badge/spaCy-en__core__web__sm-09A3D5?logo=spacy)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📌 Overview

**TalentLens** is a full-stack AI recruitment tool built with **Next.js 15** (frontend) and **FastAPI** (backend). It helps recruiters evaluate candidates fairly and efficiently using:

- **Semantic resume-to-JD matching** via sentence embeddings
- **PII anonymization** (blind scoring) to reduce identity bias
- **JD bias auditing** to detect and rewrite exclusionary language
- **Candidate profiling** with GitHub & LeetCode integrations

---

## 🗂️ Project Structure

```
HIRESIGHT/
├── backend/                   # FastAPI Python backend
│   ├── main.py                # All API routes, NLP logic, models
│   ├── test_match.py          # Tests for /api/match
│   └── test_audit.py          # Tests for /api/audit-jd
│
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── analyze/           # Resume Analyzer page
│   │   │   └── page.tsx
│   │   ├── recruiter/         # JD Bias Auditor page
│   │   │   └── page.tsx
│   │   └── profile/           # Candidate Profile Builder
│   │       └── page.tsx
│   │
│   └── components/
│       ├── analyze/
│       │   └── match-results.tsx   # Score ring, skill columns, blind banner
│       ├── profile/
│       │   └── candidate-card.tsx
│       ├── sidebar.tsx
│       ├── app-layout.tsx
│       ├── page-wrapper.tsx
│       └── ui/
│           └── toast.tsx
│
├── package.json
└── README.md
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| **Animations** | Framer Motion |
| **Backend** | FastAPI (Python 3.11+) |
| **NLP / NER** | spaCy `en_core_web_sm` |
| **Embeddings** | `sentence-transformers` — `all-MiniLM-L6-v2` |
| **Similarity** | `scikit-learn` cosine similarity |
| **PDF Parsing** | `pdfplumber` |
| **HTTP Client** | `httpx` (async) |

---

## 🚀 Getting Started

### 1. Frontend

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

App runs at → **http://localhost:3000**

---

### 2. Backend

```bash
cd backend

# Install Python dependencies
pip install fastapi uvicorn spacy pdfplumber sentence-transformers \
            scikit-learn numpy httpx pydantic

# Download spaCy English model
python -m spacy download en_core_web_sm

# Start the API server (with hot-reload)
python main.py
```

API runs at → **http://localhost:8000**  
Interactive docs → **http://localhost:8000/docs**

---

## 🌐 Pages

### `/` — Landing Page
Animated hero section with feature highlights and CTA to enter the app.

### `/analyze` — Resume Analyzer ⭐
- Upload a candidate PDF resume
- Paste a job description (up to 3000 chars)
- Get a **semantic match score** (0–100%) with:
  - ✅ Matched skills
  - 🟡 Partial / conceptual matches (via embedding similarity)
  - ❌ Missing skills
  - "Why This Score?" collapsible explanation
  - Download report as `.txt`
  - "Audit the JD for Bias" shortcut

#### 🔒 Blind Scoring Mode
Toggle **"Enable Blind Scoring 🔒"** before running analysis to:
- Strip all PII from the candidate profile before embedding
- Show a **"Blind Scoring Active"** banner in results with:
  - Large animated **PII count** (e.g. `3` items redacted)
  - Animated category chips: `• name` `• email` `• phone`
- Scoring becomes purely capability-based — no identity signals reach the model

### `/recruiter` — JD Bias Auditor
- Paste any job description
- Detect bias across 4 categories:
  1. **Gendered / masculine-coded language** (ninja, rockstar, aggressive…)
  2. **Credential gatekeeping** (degree required, must have a degree…)
  3. **Experience inflation** (5+ years of Next.js, 5+ years of Flutter…)
  4. **Exclusionary culture-fit language** (culture fit, beer fridge, brogrammer…)
- Each flag includes: matched phrase, severity (high/medium/low), suggested replacement, and surrounding context snippet
- **Rewritten JD** with all flags auto-corrected
- Weighted **Bias Score** displayed
- Pre-filled from the Analyze page via URL query param

### `/profile` — Candidate Profile Builder
- Enter a **GitHub username** → pulls repos, languages, stars, bio
- Enter a **LeetCode username** → pulls solved counts (easy/medium/hard) + contest rating
- Visual candidate card with skill breakdown

---

## 🔌 API Reference

Base URL: `http://localhost:8000`

---

### `POST /api/parse-resume`
Parse a PDF resume into structured data.

**Request:** `multipart/form-data` — field `file` (PDF)

**Response:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "9876543210",
  "skills": ["Python", "React", "Docker"],
  "experience": [{ "content": "..." }],
  "education": ["B.Tech Computer Science — 2022"]
}
```

---

### `POST /api/match`
Semantic resume-to-JD matching with optional blind scoring.

**Request:**
```json
{
  "resume_data": {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "skills": ["Python", "React"],
    "experience": [],
    "education": []
  },
  "job_description": "We need a Python and JavaScript developer...",
  "anonymize": false
}
```

**Response:**
```json
{
  "overall_score": 72,
  "matched_skills": ["Python (matched with Python)"],
  "partial_skills": ["JavaScript (conceptually similar to React)"],
  "missing_skills": ["Docker"],
  "explanation": "Candidate matches 1 core JD requirements...",
  "blind_scored": false,
  "pii_count": 0,
  "redacted_fields": []
}
```

> When `anonymize: true`:
> - All PII is stripped from name, email, phone, skills, experience, and education before embedding
> - `blind_scored` → `true`
> - `pii_count` → total items redacted (e.g. `3`)
> - `redacted_fields` → e.g. `["email", "name", "phone"]`

---

### `POST /api/anonymize`
Strip PII from raw resume text using regex + spaCy NER.

**Request:**
```json
{
  "resume_text": "John Doe\njohn@email.com\n+91 9876543210\n...",
  "strip_institutions": false
}
```

**Response:**
```json
{
  "anonymized_text": "[NAME_REDACTED]\n[EMAIL_REDACTED]\n[PHONE_REDACTED]\n...",
  "redacted_fields": ["email", "name", "phone"],
  "pii_count": 3
}
```

**Placeholder legend:**

| Placeholder | What it replaces |
|---|---|
| `[NAME_REDACTED]` | spaCy `PERSON` entity |
| `[EMAIL_REDACTED]` | Email address |
| `[PHONE_REDACTED]` | Phone number |
| `[ADDRESS_REDACTED]` | Physical address / PIN / ZIP code |
| `[YEAR_REDACTED]` | Graduation / batch year (education context) |
| `[PRONOUN_REDACTED]` | Gendered pronouns (he/she/him/her/his/hers) |
| `[INSTITUTION_REDACTED]` | ORG / FAC / GPE entity (if `strip_institutions: true`) |

---

### `POST /api/audit-jd`
Audit a job description for hiring bias.

**Request:**
```json
{
  "job_description": "We are looking for a rockstar ninja developer..."
}
```

**Response:**
```json
{
  "bias_flags": [
    {
      "phrase": "rockstar",
      "category": "gendered",
      "suggestion": "high-performing",
      "severity": "high",
      "context": "…looking for a rockstar ninja developer…"
    }
  ],
  "bias_score": 6,
  "rewritten_jd": "We are looking for a high-performing skilled engineer developer...",
  "summary": "Found 2 potential bias indicators (2 high, 0 medium severity)..."
}
```

**Bias categories detected:**

| Category | Examples |
|---|---|
| `gendered` | ninja, rockstar, guru, aggressive, dominant, manpower |
| `credential_gate` | degree required, bachelor's required, must have a degree |
| `experience_inflation` | 5+ years of Next.js, 5+ years of Flutter, 10+ years of experience |
| `exclusionary` | culture fit, beer fridge, brogrammer, young and dynamic, native English speaker |

---

### `GET /api/github/{username}`
Proxy GitHub API — avoids browser rate limits and CORS.

**Response:**
```json
{
  "username": "octocat",
  "repoCount": 32,
  "totalStars": 142,
  "topLanguages": [{ "name": "Python", "count": 12 }],
  "bio": "...",
  "followers": 980,
  "avatarUrl": "https://...",
  "name": "The Octocat"
}
```

---

### `GET /api/leetcode/{username}`
Proxy LeetCode data via alfa-leetcode-api.

**Response:**
```json
{
  "username": "user123",
  "totalSolved": 312,
  "easy": 110,
  "medium": 165,
  "hard": 37,
  "contestRating": 1842
}
```

---

### `GET /health`
Health check.

```json
{ "status": "healthy", "nlp_loaded": true, "transformer_loaded": true }
```

---

## 🧠 How Semantic Matching Works

1. **Skills extraction** — both the resume and JD are scanned against a curated `SKILLS_DB` of 37+ technologies using regex word-boundary matching.
2. **Embedding** — skills are encoded with `all-MiniLM-L6-v2` (384-dim vectors, fast on CPU).
3. **Cosine similarity matrix** — every JD skill is compared against every candidate skill.
4. **Classification:**
   - `sim > 0.80` → **Matched** (strong)
   - `sim > 0.55` → **Partial** (conceptual)
   - `sim ≤ 0.55` → **Missing**
5. **Score** = mean of all match values × 100

---

## 🔒 PII Anonymization — How It Works

The anonymization engine in `anonymize_text()` runs multiple passes in order:

1. **spaCy NER** — detects `PERSON` entities (and optionally `ORG`, `FAC`, `GPE`, `LOC`)
2. **Email regex** — RFC-style pattern
3. **Phone regex** — international + local formats
4. **Address regex** — street/avenue/road/nagar/sector patterns + pincode/ZIP
5. **Graduation year** — context-aware (looks for "graduated", "class of", "batch of" before capturing a 4-digit year); also scans education section lines for bare years
6. **Gendered pronouns** — he/she/him/her/his/hers/himself/herself

All replacements are made in reverse character-offset order to keep positions valid.

---

## 📋 Bias Rules Engine

The auditor uses a hand-crafted rule set in `BIAS_RULES` — a list of `(regex, category, severity, canonical_phrase, replacement)` tuples:

- **44 rules** across 4 categories
- Each rule fires at most once per JD (de-duplicated by pattern)
- Bias score = sum of severity weights (`high=3`, `medium=2`, `low=1`)
- The rewritten JD applies all replacements cumulatively

---

## 🔐 Authentication

TalentLens uses **Supabase Auth** for identity management and **JWT verification** for protected routes.

### Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run `backend/supabase_migration.sql` in the Supabase SQL Editor
3. Fill in `backend/.env`:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

> **Where to find these:** Supabase Dashboard → Settings → API

---

### Auth Endpoints

#### `POST /api/auth/signup`
Register a new user.

**Request:**
```json
{
  "email": "jane@example.com",
  "password": "securepassword",
  "role": "candidate",
  "full_name": "Jane Smith"
}
```

- `role` must be `"candidate"` or `"recruiter"` — any other value returns HTTP 422
- Creates a Supabase Auth user, then inserts a row in `public.profiles`

**Response:**
```json
{
  "user_id": "uuid-here",
  "email": "jane@example.com",
  "role": "candidate",
  "access_token": "eyJ..."
}
```

---

#### `POST /api/auth/login`
Sign in an existing user.

**Request:**
```json
{ "email": "jane@example.com", "password": "securepassword" }
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user_id": "uuid-here",
  "email": "jane@example.com",
  "role": "candidate",
  "full_name": "Jane Smith"
}
```

Frontend redirects based on `role`:
- `"candidate"` → `/analyze`
- `"recruiter"` → `/recruiter`

---

#### `GET /api/auth/me`
Return the current user's profile. Requires `Authorization: Bearer <access_token>`.

**Response:**
```json
{
  "id": "uuid",
  "email": "jane@example.com",
  "role": "candidate",
  "full_name": "Jane Smith",
  "created_at": "2026-04-25T..."
}
```

---

### Backend Auth Helpers

| Helper | Description |
|---|---|
| `get_current_user` | FastAPI `Depends()` — verifies Bearer JWT, fetches role from profiles |
| `require_role("recruiter")` | Dependency factory — raises 403 if wrong role |
| `_verify_jwt(token)` | Decodes Supabase JWT using `SUPABASE_JWT_SECRET` via `python-jose` |
| `get_supabase()` | Returns cached Supabase client (service-role key) |

**Usage example on a protected route:**
```python
@app.get("/api/protected")
async def my_route(user = Depends(require_role("recruiter"))):
    return {"message": f"Hello recruiter {user.email}"}
```

---

### Frontend Auth Flow

| File | Purpose |
|---|---|
| `src/lib/auth.tsx` | `AuthProvider` + `useAuth()` hook — persists token in `localStorage` |
| `src/app/login/page.tsx` | Premium login page with inline validation |
| `src/app/signup/page.tsx` | Signup with animated Candidate / Recruiter role selector |
| `src/components/sidebar.tsx` | Shows avatar + role badge + logout button when signed in |
| `src/components/app-layout.tsx` | Bypasses sidebar layout for `/login` and `/signup` |

---

### Supabase Database Schema

Defined in `backend/supabase_migration.sql`:

| Table | Purpose |
|---|---|
| `public.profiles` | One row per user: `id`, `email`, `role`, `full_name` |
| `public.resumes` | Parsed resume data per candidate (optional) |
| `public.match_results` | History of every `/api/match` run (optional) |

All tables have **Row Level Security (RLS)** enabled:
- Users can only read/update their own rows
- Service-role key (backend) bypasses RLS for inserts during signup
- Recruiters can read all profiles (for future candidate search)

---

## 🛣️ Roadmap

- [x] Semantic resume-to-JD matching
- [x] JD bias auditing (44 rules, 4 categories)
- [x] PII anonymization + blind scoring
- [x] GitHub & LeetCode profile integrations
- [x] Supabase auth (signup / login / JWT verification)
- [x] Role-based access helpers (`get_current_user`, `require_role`)
- [x] Frontend login + signup pages with role selector
- [x] Sidebar user avatar + logout
- [ ] Protected dashboard routes with middleware redirect
- [ ] Resume history & match result storage in Supabase
- [ ] Batch resume upload & ranking
- [ ] LLM-powered narrative explanation of match scores
- [ ] Export match report as PDF
- [ ] Email verification flow

---

## 📄 License

MIT © 2026 TalentLens
