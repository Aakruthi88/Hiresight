import io
import os
import re
import asyncio
import hashlib
import httpx
import pdfplumber
import spacy
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from jose import JWTError, jwt
from supabase import create_client, Client

# ── Load environment variables ──────────────────────────────────────────────────
load_dotenv()  # reads backend/.env

SUPABASE_URL         = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_JWT_SECRET  = os.getenv("SUPABASE_JWT_SECRET", "")

app = FastAPI(title="TalentLens API")

def hash_password(password: str) -> str:
    """Simple SHA256 hashing with a static salt for dev simplicity."""
    salt = "talentlens_v1_salt"
    return hashlib.sha256((password + salt).encode()).hexdigest()

def create_jwt(user_id: str, email: str, role: str):
    """Generate a JWT compatible with our custom auth flow."""
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iss": "talentlens-custom-auth"
    }
    return jwt.encode(payload, SUPABASE_JWT_SECRET, algorithm="HS256")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Supabase client (service-role key — server-side only) ──────────────────────
_supabase: Optional[Client] = None

def get_supabase() -> Client:
    """Return a cached Supabase client, or raise a clear error if not configured."""
    global _supabase
    if _supabase is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env",
            )
        _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase

# ── JWT bearer scheme ──────────────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)

# Load NLP Models
print("Loading spaCy and SentenceTransformer models...")
try:
    nlp = spacy.load("en_core_web_sm")
except:
    import os
    os.system("python -m spacy download en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

# all-MiniLM-L6-v2 is fast and efficient for CPU usage
model = SentenceTransformer('all-MiniLM-L6-v2')
print("Models loaded successfully.")

# Basic skills list for matching
SKILLS_DB = [
    "Python", "JavaScript", "TypeScript", "React", "Next.js", "FastAPI", "SQL", 
    "AWS", "Docker", "Kubernetes", "Machine Learning", "NLP", "PyTorch", "TensorFlow",
    "Tailwind CSS", "Node.js", "Express", "Go", "Rust", "Java", "C++", "C#", "Unity",
    "PostgreSQL", "MongoDB", "Redis", "GCP", "Azure", "Flutter", "Swift", "Kotlin",
    "REST API", "GraphQL", "Microservices", "CI/CD", "Git", "Terraform", "Ansible"
]

class ResumeData(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: List[str] = []
    experience: List[dict] = []
    education: List[str] = []
    github_url: Optional[str] = None
    leetcode_url: Optional[str] = None

class MatchRequest(BaseModel):
    resume_data: dict
    job_description: str
    anonymize: bool = False          # when True, strip PII before embedding

class MatchResponse(BaseModel):
    overall_score: int
    matched_skills: List[str]
    partial_skills: List[str]
    missing_skills: List[str]
    explanation: str
    blind_scored: bool = False       # echoes back whether PII was stripped
    pii_count: int = 0               # total PII replacements made (blind mode only)
    redacted_fields: List[str] = [] # categories of PII found (blind mode only)

# ── PII Anonymization Models ───────────────────────────────────────────────────
class AnonymizeRequest(BaseModel):
    resume_text: str
    strip_institutions: bool = False  # optional: also redact ORG/FAC entities

class AnonymizeResponse(BaseModel):
    anonymized_text: str
    redacted_fields: List[str]        # which PII categories were found
    pii_count: int                    # total individual replacements made

# ── Bias Audit Models ──────────────────────────────────────────────────────────
class BiasFlag(BaseModel):
    phrase: str
    category: str          # gendered | credential_gate | experience_inflation | exclusionary
    suggestion: str
    severity: str          # high | medium | low
    context: str           # surrounding sentence snippet

class AuditRequest(BaseModel):
    job_description: str

class AuditResponse(BaseModel):
    bias_flags: List[BiasFlag]
    bias_score: int
    rewritten_jd: str
    summary: str

# ── Bias Rules Database ────────────────────────────────────────────────────────
# Each rule: (regex_pattern, category, severity, canonical_phrase, replacement)
BIAS_RULES = [
    # ── Gendered / coded masculine language ───────────────────────────────────
    (r'\bninja\b',             'gendered', 'high',   'ninja',             'skilled engineer'),
    (r'\brockstar\b',          'gendered', 'high',   'rockstar',          'high-performing'),
    (r'\bguru\b',              'gendered', 'medium', 'guru',              'expert'),
    (r'\bwizard\b',            'gendered', 'medium', 'wizard',            'specialist'),
    (r'\bsuperhero\b',         'gendered', 'medium', 'superhero',         'exceptional contributor'),
    (r'\bdominant\b',          'gendered', 'high',   'dominant',          'leading'),
    (r'\baggressive\b',        'gendered', 'high',   'aggressive',        'driven'),
    (r'\bnurturing\b',         'gendered', 'medium', 'nurturing',         'supportive'),
    (r'\bstrongly driven\b',   'gendered', 'low',    'strongly driven',   'motivated'),
    (r'\bcompetitive nature\b', 'gendered','medium', 'competitive nature','results-oriented mindset'),
    (r'\bhe or she\b',         'gendered', 'low',    'he or she',         'they'),
    (r'\bhe/she\b',            'gendered', 'low',    'he/she',            'they'),
    (r'\bhimself\b',           'gendered', 'low',    'himself',           'themselves'),
    (r'\bherself\b',           'gendered', 'low',    'herself',           'themselves'),
    (r'\bmanpower\b',          'gendered', 'medium', 'manpower',          'workforce'),
    (r'\bmanmade\b',           'gendered', 'low',    'manmade',           'artificial'),

    # ── Credential inflation ───────────────────────────────────────────────────
    (r'degree\s+required',     'credential_gate', 'high',   'degree required',   'relevant experience or equivalent'),
    (r'bachelor[''s]*\s+required', 'credential_gate', 'high', "bachelor's required", 'relevant experience or equivalent'),
    (r'master[''s]*\s+required',   'credential_gate', 'high', "master's required",   'advanced experience or equivalent'),
    (r'must\s+have\s+a\s+degree', 'credential_gate', 'high', 'must have a degree', 'must have relevant experience'),
    (r'phd\s+required',           'credential_gate', 'medium', 'PhD required',    'advanced expertise or PhD preferred'),
    (r'university\s+degree\s+required', 'credential_gate', 'high', 'university degree required', 'relevant experience or degree'),
    (r'formal\s+(education|qualification)\s+required', 'credential_gate', 'medium',
     'formal education required', 'relevant skills and experience'),

    # ── Experience inflation: high year counts for young technologies ──────────
    # Technologies launched < 5 years before 2024 or widely adopted recently
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(next\.?js|nextjs)',
     'experience_inflation', 'high',
     '5+ years of experience with Next.js',
     '2+ years of experience with Next.js (framework launched 2016, widely adopted ~2020)'),
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(tailwind|tailwindcss)',
     'experience_inflation', 'high',
     '5+ years of experience with Tailwind CSS',
     '2+ years of experience with Tailwind CSS (released 2017)'),
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(kubernetes|k8s)',
     'experience_inflation', 'medium',
     '5+ years with Kubernetes',
     '3+ years with Kubernetes'),
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(rust\b)',
     'experience_inflation', 'high',
     '5+ years of experience with Rust',
     '2+ years of experience with Rust (mainstream adoption ~2019)'),
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(flutter)',
     'experience_inflation', 'high',
     '5+ years of experience with Flutter',
     '2+ years of experience with Flutter (stable release 2018)'),
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(svelte)',
     'experience_inflation', 'high',
     '5+ years of experience with Svelte',
     '2+ years of experience with Svelte (released 2016, popular since 2019)'),
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(openai|chatgpt|gpt-4)',
     'experience_inflation', 'high',
     '5+ years of experience with OpenAI/GPT',
     '1+ years of experience with OpenAI APIs (publicly available since 2020)'),
    (r'10\+?\s+years?\s+(of\s+)?experience',
     'experience_inflation', 'medium',
     '10+ years of experience',
     '7+ years of experience (consider whether a decade is truly necessary)'),

    # ── Culture-fit / exclusionary language ───────────────────────────────────
    (r'culture\s+fit',             'exclusionary', 'high',   'culture fit',            'values alignment'),
    (r'beer\s+fridge',             'exclusionary', 'high',   'beer fridge',            'team social events'),
    (r'ping[- ]pong',              'exclusionary', 'medium', 'ping-pong',              'recreational facilities'),
    (r'work\s+hard[,\s]+play\s+hard', 'exclusionary', 'high', 'work hard play hard',  'high performance with work-life balance'),
    (r'young\s+(and\s+)?dynamic',  'exclusionary', 'high',   'young and dynamic',      'energetic and collaborative'),
    (r'digital\s+native',          'exclusionary', 'medium', 'digital native',         'proficient with modern tools'),
    (r'recent\s+grad(uate)?s?\s+preferred', 'exclusionary', 'medium',
     'recent graduates preferred', 'entry-level candidates welcome'),
    (r'must\s+be\s+available\s+24/7', 'exclusionary', 'high',
     'must be available 24/7',    'able to respond to on-call requirements with fair notice'),
    (r'startup\s+hustle',          'exclusionary', 'medium', 'startup hustle',         'fast-paced, collaborative environment'),
    (r'ninja[- ]like\s+skills',    'exclusionary', 'high',   'ninja-like skills',      'exceptional technical ability'),
    (r'brogrammer',                'exclusionary', 'high',   'brogrammer',             'collaborative engineer'),
    (r'no\s+job[- ]hoppers?',      'exclusionary', 'high',   'no job hoppers',         'seeking long-term commitment'),
    (r'native\s+english\s+speaker', 'exclusionary', 'high',  'native English speaker', 'strong written and verbal English communication skills'),
]

def _get_context(text: str, match: re.Match, window: int = 60) -> str:
    """Return the surrounding sentence fragment for a match."""
    start = max(0, match.start() - window)
    end   = min(len(text), match.end() + window)
    snippet = text[start:end].replace('\n', ' ').strip()
    if start > 0:
        snippet = '…' + snippet
    if end < len(text):
        snippet = snippet + '…'
    return snippet


# ── PII Anonymization Engine ───────────────────────────────────────────────────
_EMAIL_RE   = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+', re.I)
_PHONE_RE   = re.compile(
    r'(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?){2,4}\d{4}', re.I
)
_YEAR_EDU_RE = re.compile(
    r'(?i)(?:graduated?|class\s+of|batch\s+of|passout|year\s*:?\s*)'  # education context
    r'[^\d]{0,15}((?:19|20)\d{2})'  # capture the 4-digit year
)
_STANDALONE_YEAR_RE = re.compile(
    r'\b((?:19|20)\d{2})\b'           # bare year — used only in education sections
)
_GITHUB_RE = re.compile(r'github\.com/([\w.-]+)', re.I)
_LEETCODE_RE = re.compile(r'leetcode\.com/(?:u/)?([\w.-]+)', re.I)
_PRONOUN_RE = re.compile(
    r'\b(he|she|him|her|his|hers|himself|herself)\b', re.I
)
_ADDRESS_RE = re.compile(
    r'\b\d{1,5}\s+[A-Za-z0-9\s,\.]{5,60}(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|'
    r'boulevard|blvd|court|ct|way|place|pl|nagar|colony|sector|phase|layout)\b',
    re.I
)
_PINCODE_RE = re.compile(r'\b[1-9]\d{5}\b|\b\d{5}(?:-\d{4})?\b')   # Indian PIN / US ZIP


def anonymize_text(
    text: str,
    strip_institutions: bool = False,
) -> tuple[str, list[str], int]:
    """
    Replace PII in *text* with typed placeholders.
    Returns (anonymized_text, redacted_fields, pii_count).

    Placeholder legend
    ------------------
    [NAME_REDACTED]          spaCy PERSON entity
    [EMAIL_REDACTED]         e-mail address
    [PHONE_REDACTED]         phone number
    [ADDRESS_REDACTED]       physical address fragment
    [YEAR_REDACTED]          graduation / batch year
    [PRONOUN_REDACTED]       gendered pronoun → neutral
    [INSTITUTION_REDACTED]   ORG / FAC / GPE entity (if strip_institutions=True)
    """
    redacted_fields: set[str] = set()
    count = 0
    out   = text

    # 1. spaCy NER — names (and optionally institutions / locations)
    doc = nlp(text)
    # Build replacement spans sorted by start position (reverse so offsets stay valid)
    ner_replacements: list[tuple[int, int, str]] = []
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            ner_replacements.append((ent.start_char, ent.end_char, "[NAME_REDACTED]"))
            redacted_fields.add("name")
        elif strip_institutions and ent.label_ in {"ORG", "FAC", "GPE", "LOC"}:
            ner_replacements.append((ent.start_char, ent.end_char, "[INSTITUTION_REDACTED]"))
            redacted_fields.add("institution")

    # Apply NER replacements in reverse order
    for start, end, placeholder in sorted(ner_replacements, key=lambda x: -x[0]):
        out    = out[:start] + placeholder + out[end:]
        count += 1

    # 2. E-mail
    new_out, n = _EMAIL_RE.subn("[EMAIL_REDACTED]", out)
    if n:
        out = new_out; count += n; redacted_fields.add("email")

    # 3. Phone
    new_out, n = _PHONE_RE.subn("[PHONE_REDACTED]", out)
    if n:
        out = new_out; count += n; redacted_fields.add("phone")

    # 4. Physical address
    new_out, n = _ADDRESS_RE.subn("[ADDRESS_REDACTED]", out)
    if n:
        out = new_out; count += n; redacted_fields.add("address")

    # 5. Pincode / ZIP
    new_out, n = _PINCODE_RE.subn("[ADDRESS_REDACTED]", out)
    if n:
        out = new_out; count += n; redacted_fields.add("address")

    # 6. Graduation years — context-aware first, then bare years in edu sections
    def _replace_year(m: re.Match) -> str:
        # group(1) is the captured year inside the lookahead pattern
        full = m.group(0)
        year = m.group(1)
        return full.replace(year, "[YEAR_REDACTED]")

    new_out, n = _YEAR_EDU_RE.subn(_replace_year, out)
    if n:
        out = new_out; count += n; redacted_fields.add("graduation_year")

    # Also strip bare years that appear near education keywords
    edu_sections: list[str] = []
    in_edu = False
    for line in out.splitlines():
        low = line.lower()
        if any(k in low for k in ["education", "qualification", "university", "college", "degree", "b.tech", "m.tech", "b.e", "m.e"]):
            in_edu = True
        if in_edu:
            new_line, n2 = _STANDALONE_YEAR_RE.subn("[YEAR_REDACTED]", line)
            if n2:
                count += n2
                redacted_fields.add("graduation_year")
            edu_sections.append(new_line)
        else:
            edu_sections.append(line)
    out = "\n".join(edu_sections)

    # 7. Gendered pronouns
    new_out, n = _PRONOUN_RE.subn("[PRONOUN_REDACTED]", out)
    if n:
        out = new_out; count += n; redacted_fields.add("pronoun")

    return out, sorted(redacted_fields), count


def _severity_weight(severity: str) -> int:
    return {'high': 3, 'medium': 2, 'low': 1}.get(severity, 1)


def audit_jd(jd_text: str):
    """
    Run every BIAS_RULES pattern against jd_text.
    Returns (flags, rewritten_jd, summary).
    """
    flags: List[BiasFlag] = []
    rewritten = jd_text
    seen_patterns: set = set()  # avoid double-flagging the same rule

    for pattern, category, severity, canonical_phrase, suggestion in BIAS_RULES:
        compiled = re.compile(pattern, re.IGNORECASE)
        matches = list(compiled.finditer(jd_text))
        if not matches or pattern in seen_patterns:
            continue
        seen_patterns.add(pattern)

        # Use the first match for context; flag once per rule
        first_match = matches[0]
        ctx = _get_context(jd_text, first_match)
        flags.append(BiasFlag(
            phrase=first_match.group(0),
            category=category,
            suggestion=suggestion,
            severity=severity,
            context=ctx,
        ))

        # Apply rewrite: replace all occurrences of this pattern in the running text
        rewritten = compiled.sub(suggestion, rewritten)

    # ── Build summary ─────────────────────────────────────────────────────────
    categories_found = list(dict.fromkeys(f.category for f in flags))  # ordered unique
    category_labels = {
        'gendered':             'gendered / gender-coded language',
        'credential_gate':      'credential gatekeeping',
        'experience_inflation': 'inflated experience requirements',
        'exclusionary':         'exclusionary culture-fit language',
    }

    impacts = {
        'gendered':             'may discourage women and non-binary candidates',
        'credential_gate':      'may exclude skilled career-switchers and self-taught engineers',
        'experience_inflation': 'artificially narrows the talent pool for newer technologies',
        'exclusionary':         'may deter candidates from diverse cultural, age, or lifestyle backgrounds',
    }

    high_count   = sum(1 for f in flags if f.severity == 'high')
    medium_count = sum(1 for f in flags if f.severity == 'medium')
    total        = len(flags)

    if total == 0:
        summary = (
            "No significant bias patterns were detected. This JD appears inclusive and equitable. "
            "Continue to review for implicit assumptions not covered by automated checks."
        )
    else:
        impact_parts = [impacts[c] for c in categories_found if c in impacts]
        summary = (
            f"Found {total} potential bias indicator{'s' if total != 1 else ''} "
            f"({high_count} high, {medium_count} medium severity). "
            f"This JD contains {', '.join(category_labels[c] for c in categories_found if c in category_labels)}. "
            f"These patterns {'; '.join(impact_parts)}. "
            "The rewritten version below applies suggested replacements — review before publishing."
        )

    # Weighted bias score (more meaningful than raw count)
    bias_score = sum(_severity_weight(f.severity) for f in flags)

    return flags, bias_score, rewritten, summary

def extract_text_from_pdf(pdf_bytes):
    try:
        all_text = []
        links = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                txt = page.extract_text()
                if txt: all_text.append(txt)
                # Extract hyperlinks from annotations (links behind text)
                if page.annots:
                    for annot in page.annots:
                        if isinstance(annot, dict):
                            uri = annot.get("uri") or (annot.get("A") and annot.get("A").get("URI"))
                            if uri: links.append(uri)
        
        full_text = "\n".join(all_text)
        if links:
            # Append links to text so regex parsers catch them too
            full_text += "\n" + "\n".join(links)
        return full_text
    except Exception as e:
        print(f"Error extracting PDF: {e}")
        return ""

def extract_contact_info(text):
    email = re.search(r'[\w\.-]+@[\w\.-]+', text)
    phone = re.search(r'(\+?\d{1,3}[-\.\s]??\d{3}[-\.\s]??\d{3}[-\.\s]??\d{4}|\d{10})', text)
    return email.group(0) if email else None, phone.group(0) if phone else None

def extract_name(doc):
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            if ent.start < 50: 
                return ent.text
    return None

def extract_skills(text):
    skills_found = []
    for skill in SKILLS_DB:
        if re.search(rf'\b{re.escape(skill)}\b', text, re.I):
            skills_found.append(skill)
    return list(set(skills_found))

@app.post("/api/parse-resume", response_model=ResumeData)
async def parse_resume(file: UploadFile = File(...)):
    contents = await file.read()
    text = extract_text_from_pdf(contents)
    if not text: return ResumeData()
    
    doc = nlp(text)
    name = extract_name(doc)
    email, phone = extract_contact_info(text)
    skills = extract_skills(text)
    
    experience = []
    education = []
    lines = text.split('\n')
    current_section = None
    
    for line in lines:
        line = line.strip()
        if not line or len(line) < 3: continue
        lower_line = line.lower()
        if any(k in lower_line for k in ['experience', 'employment', 'work history']):
            current_section = 'experience'
            continue
        elif any(k in lower_line for k in ['education', 'university', 'college']):
            current_section = 'education'
            continue
            
        if current_section == 'experience' and len(experience) < 10:
            experience.append({"content": line})
        elif current_section == 'education' and len(education) < 5:
            education.append(line)

    gh_match = _GITHUB_RE.search(text)
    lc_match = _LEETCODE_RE.search(text)
    github_url = f"https://github.com/{gh_match.group(1)}" if gh_match else None
    leetcode_url = f"https://leetcode.com/{lc_match.group(1)}" if lc_match else None

    return {
        "name": name, "email": email, "phone": phone,
        "skills": skills, "experience": experience, "education": education,
        "github_url": github_url, "leetcode_url": leetcode_url
    }

@app.post("/api/anonymize", response_model=AnonymizeResponse)
async def anonymize_resume(data: AnonymizeRequest):
    """
    Strip PII from raw resume text using regex + spaCy NER.
    Returns the cleaned text along with a list of redacted field categories
    and a total replacement count.
    """
    text = data.resume_text.strip()
    if not text:
        return AnonymizeResponse(
            anonymized_text="",
            redacted_fields=[],
            pii_count=0,
        )
    anon_text, fields, pii_count = anonymize_text(
        text, strip_institutions=data.strip_institutions
    )
    return AnonymizeResponse(
        anonymized_text=anon_text,
        redacted_fields=fields,
        pii_count=pii_count,
    )


@app.post("/api/match", response_model=MatchResponse)
async def match_candidate(data: MatchRequest):
    """
    Computes semantic similarity between a candidate's profile and a JD.
    Uses SentenceTransformers to find conceptual matches beyond keyword equality.
    When anonymize=True the candidate's skills text is PII-stripped before
    embedding so scoring is purely capability-based (blind scoring).
    """
    jd_text = data.job_description
    candidate_skills = data.resume_data.get("skills", [])

    # ── Blind scoring: strip PII from full profile before embedding ───────────
    total_pii_count: int = 0
    all_redacted_fields: set = set()

    if data.anonymize:
        # Run anonymization on every text field in the candidate profile
        profile_fields = [
            data.resume_data.get("name", "") or "",
            data.resume_data.get("email", "") or "",
            data.resume_data.get("phone", "") or "",
        ]
        # Add skill strings and education lines
        profile_fields += candidate_skills
        profile_fields += [e.get("content", "") for e in data.resume_data.get("experience", [])]
        profile_fields += data.resume_data.get("education", [])

        cleaned_skills = []
        for field_text in profile_fields:
            if not field_text:
                continue
            anon, fields, n = anonymize_text(field_text)
            total_pii_count += n
            all_redacted_fields.update(fields)

        # Re-clean just the skills for embedding
        cleaned_skills = []
        for skill in candidate_skills:
            anon, _, _ = anonymize_text(skill)
            cleaned_skills.append(anon)
        candidate_skills = cleaned_skills
    
    # 1. Extract skills from JD using the same logic
    jd_skills = extract_skills(jd_text)
    
    if not jd_skills or not candidate_skills:
        return {
            "overall_score": 0,
            "matched_skills": [],
            "partial_skills": [],
            "missing_skills": jd_skills,
            "explanation": "Insufficient data to perform semantic matching."
        }
    
    # 2. Semantic Matching via Embeddings
    candidate_embeddings = model.encode(candidate_skills)
    jd_embeddings = model.encode(jd_skills)
    
    # similarities[i][j] is similarity between jd_skills[i] and candidate_skills[j]
    similarities = cosine_similarity(jd_embeddings, candidate_embeddings)
    
    matched = []
    partial = []
    missing = []
    scores = []
    
    for i, jd_skill in enumerate(jd_skills):
        max_sim = np.max(similarities[i])
        best_match_idx = np.argmax(similarities[i])
        best_match_name = candidate_skills[best_match_idx]
        
        if max_sim > 0.80: # Strong match
            matched.append(f"{jd_skill} (matched with {best_match_name})")
            scores.append(1.0)
        elif max_sim > 0.55: # Partial/Conceptual match
            partial.append(f"{jd_skill} (conceptually similar to {best_match_name})")
            scores.append(max_sim)
        else: # Missing
            missing.append(jd_skill)
            scores.append(0.0)
            
    # Calculate weighted score (can be refined)
    overall_score = int(np.mean(scores) * 100) if scores else 0
    
    # 3. Generate summary explanation
    explanation = f"Candidate matches {len(matched)} core JD requirements."
    if partial:
        explanation += f" Found {len(partial)} conceptual matches where direct keywords were missing."
    if missing:
        explanation += f" The following areas may need upskilling: {', '.join(missing[:3])}."
        
    return {
        "overall_score":    overall_score,
        "matched_skills":   matched,
        "partial_skills":   partial,
        "missing_skills":   missing,
        "explanation":      explanation,
        "blind_scored":     data.anonymize,
        "pii_count":        total_pii_count,
        "redacted_fields":  sorted(all_redacted_fields),
    }

@app.post("/api/audit-jd", response_model=AuditResponse)
async def audit_job_description(data: AuditRequest):
    """
    Audits a job description for bias across four categories:
    gendered language, credential gatekeeping, experience inflation,
    and exclusionary culture-fit phrases.
    Returns flags with suggestions, a weighted bias score,
    a fully rewritten JD, and a plain-English summary.
    """
    jd = data.job_description.strip()
    if not jd:
        return AuditResponse(
            bias_flags=[],
            bias_score=0,
            rewritten_jd="",
            summary="No job description provided.",
        )

    flags, bias_score, rewritten_jd, summary = audit_jd(jd)

    return AuditResponse(
        bias_flags=flags,
        bias_score=bias_score,
        rewritten_jd=rewritten_jd,
        summary=summary,
    )


# ── GitHub Proxy ──────────────────────────────────────────────────────────────
@app.get("/api/github/{username}")
async def github_proxy(username: str):
    return await _fetch_github_stats(username)


# ── LeetCode Proxy ─────────────────────────────────────────────────────────────
@app.get("/api/leetcode/{username}")
async def leetcode_proxy(username: str):
    return await _fetch_leetcode_stats(username)


@app.get("/health")
def health_check():
    return {"status": "healthy", "nlp_loaded": nlp is not None, "transformer_loaded": model is not None}

if __name__ == "__main__":
    import uvicorn
    # Using string format for app to enable reload
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


# ════════════════════════════════════════════════════════════════════
# ── Auth — Pydantic models ───────────────────────────────────────────────────────────
# ════════════════════════════════════════════════════════════════════

VALID_ROLES = {"candidate", "recruiter"}

class SignUpRequest(BaseModel):
    email: str
    password: str
    role: str          # "candidate" | "recruiter"
    full_name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenPayload(BaseModel):
    user_id: str
    email: str
    role: str


# ── Auth — Helpers ─────────────────────────────────────────────────────────────────

def _verify_jwt(token: str) -> dict:
    """
    Decode and verify a Supabase-issued JWT.
    Returns the raw claims dict on success.
    Raises HTTP 401 on any failure.
    """
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_JWT_SECRET is not set in backend/.env",
        )
    try:
        claims = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},   # Supabase does not set aud by default
        )
        return claims
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> TokenPayload:
    """
    FastAPI dependency — extracts and verifies the Bearer token.
    Fetches the matching profile row to get the user's role.
    Returns a TokenPayload(user_id, email, role).
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims  = _verify_jwt(credentials.credentials)
    user_id = claims.get("sub")
    email   = claims.get("email", "")

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token: missing sub")

    # Fetch role from profiles table
    sb = get_supabase()
    try:
        res = sb.table("profiles").select("role").eq("id", user_id).single().execute()
        role = res.data.get("role", "unknown") if res.data else "unknown"
    except Exception:
        role = "unknown"

    return TokenPayload(user_id=user_id, email=email, role=role)


def require_role(required_role: str):
    """
    Dependency factory — wraps get_current_user and enforces a specific role.
    Usage:  Depends(require_role("recruiter"))
    """
    async def _check(current_user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied for your role (need: {required_role}, have: {current_user.role})",
            )
        return current_user
    return _check


# ── Auth — Routes ──────────────────────────────────────────────────────────────────

@app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
async def signup(data: SignUpRequest):
    """
    Register a new user in the custom profiles table.
    Bypasses Supabase Auth rate limits.
    """
    # ── 1. Role validation ────────────────────────────────────────────────────────
    if data.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{data.role}'. Must be one of: {sorted(VALID_ROLES)}",
        )

    sb = get_supabase()

    # ── 2. Check if user exists ──────────────────────────────────────────────────
    existing = sb.table("profiles").select("id").eq("email", data.email).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists."
        )

    # ── 3. Create Profile (The new "User") ───────────────────────────────────────
    pwd_hash = hash_password(data.password)
    try:
        res = sb.table("profiles").insert({
            "email":     data.email,
            "password_hash": pwd_hash,
            "role":      data.role,
            "full_name": data.full_name,
        }).execute()
        
        if not res.data:
            raise Exception("Failed to insert profile row")
        
        user_id = res.data[0]["id"]
    except Exception as exc:
        print(f"Signup Error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signup failed: {exc}. Ensure migration.sql was run."
        )

    # ── 4. Generate Token ────────────────────────────────────────────────────────
    access_token = create_jwt(user_id, data.email, data.role)

    return {
        "user_id":      user_id,
        "email":        data.email,
        "role":         data.role,
        "access_token": access_token,
    }


@app.post("/api/auth/login")
async def login(data: LoginRequest):
    """
    Authenticate an existing user.
    Returns access_token, refresh_token, role, email, user_id, full_name.
    Frontend should redirect based on role:
      candidate  → /dashboard/candidate
      recruiter  → /dashboard/recruiter
    """
    sb = get_supabase()

    # ── 1. Fetch user by email ───────────────────────────────────────────────────
    res = sb.table("profiles").select("*").eq("email", data.email).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_record = res.data[0]
    
    # ── 2. Verify password ───────────────────────────────────────────────────────
    if hash_password(data.password) != user_record.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── 3. Generate Token ────────────────────────────────────────────────────────
    user_id = user_record["id"]
    role    = user_record["role"]
    email   = user_record["email"]
    
    access_token = create_jwt(user_id, email, role)

    return {
        "access_token":  access_token,
        "refresh_token": "not-used-in-custom-auth",
        "user_id":       user_id,
        "email":         email,
        "role":          role,
        "full_name":     user_record.get("full_name", ""),
    }


@app.get("/api/auth/me")
async def get_me(current_user: TokenPayload = Depends(get_current_user)):
    """
    Return the full profile of the authenticated user.
    Requires: Authorization: Bearer <access_token>
    """
    sb = get_supabase()
    try:
        res = (
            sb.table("profiles")
            .select("id, email, role, full_name, created_at")
            .eq("id", current_user.user_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
        return res.data
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ════════════════════════════════════════════════════════════════════════════════
# ── Recruiter Routes ─────────────────────────────────────────────────────────
# ════════════════════════════════════════════════════════════════════════════════

class JDCreateRequest(BaseModel):
    title:       str
    description: str

class ApplyRequest(BaseModel):
    jd_id:             str
    resume_data:       dict
    match_result:      dict
    github_username:   Optional[str] = None
    leetcode_username: Optional[str] = None
    profile_data:      Optional[dict] = None
    blind_scored:      bool = False
    pii_count:         int  = 0


def _build_candidate_summary(app: dict, rank: int) -> str:
    """Pure-Python explainable AI summary built from stored match data."""
    score     = app.get("match_score", 0)
    matched   = app.get("matched_skills") or []
    partial   = app.get("partial_skills")  or []
    missing   = app.get("missing_skills")  or []
    github    = app.get("github_username", "")
    blind     = app.get("blind_scored", False)
    pii_count = app.get("pii_count", 0)

    def clean(lst):
        return [s.split("(")[0].strip() for s in lst[:5]]

    matched_clean = clean(matched)
    partial_clean = clean(partial)
    missing_clean = clean(missing)
    total_jd      = len(matched) + len(partial) + len(missing) or 1

    reasons = []
    reasons.append({
        "type": "strength", 
        "text": f"Matched {len(matched)}/{total_jd} required skills" + (f" including {', '.join(matched_clean[:3])}" if matched_clean else "") + "."
    })
    
    if partial_clean:
        reasons.append({"type": "strength", "text": f"Partial match on {', '.join(partial_clean[:2])}."})
    
    if github:
        reasons.append({"type": "signal", "text": f"Active GitHub profile (@{github}) adds open-source signal."})
    
    if blind and pii_count:
        reasons.append({"type": "signal", "text": f"Identity-blind evaluation ({pii_count} PII fields redacted)."})
    
    if missing_clean:
        reasons.append({"type": "gap", "text": f"Missing: {', '.join(missing_clean[:3])}."})
    
    reasons.append({"type": "signal", "text": f"Overall fit score: {score}%."})
    
    return reasons


# ── POST /api/recruiter/jd ────────────────────────────────────────────────────
@app.post("/api/recruiter/jd", status_code=status.HTTP_201_CREATED)
async def create_jd(
    data: JDCreateRequest,
    current_user: TokenPayload = Depends(require_role("recruiter")),
):
    """Insert a new job description owned by the current recruiter."""
    sb = get_supabase()
    try:
        res = (
            sb.table("job_descriptions")
            .insert({"recruiter_id": current_user.user_id, "title": data.title, "description": data.description})
            .execute()
        )
        row = res.data[0] if res.data else {}
        return {"jd_id": row.get("id"), "title": row.get("title"), "created_at": row.get("created_at")}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ── GET /api/recruiter/jds ────────────────────────────────────────────────────
@app.get("/api/recruiter/jds")
async def list_recruiter_jds(
    current_user: TokenPayload = Depends(require_role("recruiter")),
):
    """Return all JDs created by this recruiter with applicant counts."""
    sb = get_supabase()
    try:
        jd_res = (
            sb.table("job_descriptions")
            .select("id, title, description, created_at")
            .eq("recruiter_id", current_user.user_id)
            .order("created_at", desc=True)
            .execute()
        )
        jds = jd_res.data or []
        if jds:
            jd_ids = [j["id"] for j in jds]
            app_res = sb.table("applications").select("jd_id, match_score").in_("jd_id", jd_ids).execute()
            count_map: dict = {}
            score_map: dict = {}
            for row in (app_res.data or []):
                jid = row["jd_id"]
                score = row.get("match_score", 0)
                count_map[jid] = count_map.get(jid, 0) + 1
                score_map[jid] = max(score_map.get(jid, 0), score)
            for jd in jds:
                jd["applicant_count"] = count_map.get(jd["id"], 0)
                jd["top_score"] = score_map.get(jd["id"], 0)
                jd["jd_id"] = jd.pop("id")
        return jds
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ── GET /api/recruiter/jd/{jd_id}/candidates ──────────────────────────────────
@app.get("/api/recruiter/jd/{jd_id}/candidates")
async def get_jd_candidates(
    jd_id: str,
    current_user: TokenPayload = Depends(require_role("recruiter")),
):
    """Return all applicants for a JD sorted by match_score DESC."""
    sb = get_supabase()
    try:
        jd_res = sb.table("job_descriptions").select("id, recruiter_id").eq("id", jd_id).single().execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"JD not found: {exc}")
    if not jd_res.data or jd_res.data.get("recruiter_id") != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This JD does not belong to you")
    try:
        app_res = (
            sb.table("applications")
            .select("id, candidate_id, match_score, matched_skills, partial_skills, "
                    "missing_skills, explanation, blind_scored, pii_count, "
                    "submitted_at, github_username, profile_data")
            .eq("jd_id", jd_id)
            .order("match_score", desc=True)
            .execute()
        )
        apps = app_res.data or []
        for a in apps:
            a["application_id"] = a.pop("id", None)
        return apps
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ── GET /api/recruiter/jd/{jd_id}/ranking ─────────────────────────────────────
@app.get("/api/recruiter/jd/{jd_id}/ranking")
async def get_jd_ranking(
    jd_id: str,
    current_user: TokenPayload = Depends(require_role("recruiter")),
):
    """Ranked candidates with explainable AI summaries (no LLM call needed)."""
    sb = get_supabase()
    try:
        jd_res = sb.table("job_descriptions").select("id, recruiter_id, title").eq("id", jd_id).single().execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"JD not found: {exc}")
    if not jd_res.data or jd_res.data.get("recruiter_id") != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This JD does not belong to you")
    try:
        app_res = (
            sb.table("applications")
            .select("id, candidate_id, match_score, matched_skills, partial_skills, "
                    "missing_skills, explanation, blind_scored, pii_count, "
                    "submitted_at, github_username, leetcode_username, profile_data, "
                    "profiles(full_name)")
            .eq("jd_id", jd_id)
            .order("match_score", desc=True)
            .execute()
        )
        apps = app_res.data or []
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    ranked = []
    for i, app in enumerate(apps, start=1):
        summary = _build_candidate_summary(app, i)
        row = dict(app)
        row["rank"]             = i
        row["application_id"]   = row.pop("id", None)
        row["explanation"]      = summary
        row["why_ranked_here"]  = summary
        if i == 1:
            row["why_top_candidate"] = summary
        
        # Extract full_name from the joined profiles table
        profile = row.pop("profiles", {})
        row["full_name"] = profile.get("full_name") if profile else "Candidate"
        
        ranked.append(row)

    return {"jd_id": jd_id, "jd_title": jd_res.data.get("title", ""), "total": len(ranked), "ranking": ranked}


# ── Helper: Internal Fetching Logic ───────────────────────────────────────────

async def _fetch_github_stats(username: str):
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "TalentLens-App",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        user_res, repos_res = await asyncio.gather(
            client.get(f"https://api.github.com/users/{username}", headers=headers),
            client.get(f"https://api.github.com/users/{username}/repos", headers=headers,
                       params={"per_page": "100", "sort": "updated"}),
        )

    if not user_res.is_success:
        return None

    user  = user_res.json()
    repos = repos_res.json() if repos_res.is_success else []

    lang_counts: dict = {}
    total_stars = 0
    for repo in repos:
        lang = repo.get("language")
        if lang:
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
        total_stars += repo.get("stargazers_count", 0)

    top_languages = [
        {"name": name, "count": count}
        for name, count in sorted(lang_counts.items(), key=lambda x: -x[1])[:10]
    ]

    return {
        "username":     username,
        "repoCount":    len(repos),
        "totalStars":   total_stars,
        "topLanguages": top_languages,
        "bio":          user.get("bio"),
        "followers":    user.get("followers", 0),
        "avatarUrl":    user.get("avatar_url"),
        "name":         user.get("name"),
    }

async def _fetch_leetcode_stats(username: str):
    BASE = "https://alfa-leetcode-api.onrender.com"
    headers = {"User-Agent": "TalentLens-App"}

    async with httpx.AsyncClient(timeout=20.0) as client:
        results = await asyncio.gather(
            client.get(f"{BASE}/{username}/solved",  headers=headers),
            client.get(f"{BASE}/{username}/contest", headers=headers),
            return_exceptions=True,
        )

    solved_res, contest_res = results

    # --- Parse solved counts ---
    easy = medium = hard = total_solved = 0
    if isinstance(solved_res, httpx.Response) and solved_res.is_success:
        d = solved_res.json()
        easy         = d.get("easySolved",   d.get("easy",   0))
        medium       = d.get("mediumSolved", d.get("medium", 0))
        hard         = d.get("hardSolved",   d.get("hard",   0))
        total_solved = d.get("solvedProblem", d.get("totalSolved", easy + medium + hard))
    else:
        return None

    # --- Parse contest rating ---
    contest_rating = 0
    if isinstance(contest_res, httpx.Response) and contest_res.is_success:
        c = contest_res.json()
        contest_rating = c.get("contestRating", c.get("rating", 0))
        if contest_rating:
            contest_rating = round(contest_rating)

    return {
        "username":      username,
        "totalSolved":   total_solved,
        "easy":          easy,
        "medium":        medium,
        "hard":          hard,
        "contestRating": contest_rating,
    }


# ════════════════════════════════════════════════════════════════════════════════
# ── Candidate Routes ─────────────────────────────────────────────────────────
# ════════════════════════════════════════════════════════════════════════════════

# ── GET /api/candidate/jds ─────────────────────────────────────────────────────
@app.get("/api/candidate/jds")
async def browse_jds():
    """Return all posted JDs so candidates can browse and pick one to apply to."""
    sb = get_supabase()
    try:
        res = (
            sb.table("job_descriptions")
            .select("id, title, description, created_at, recruiter_id")
            .order("created_at", desc=True)
            .execute()
        )
        jds = res.data or []
        for j in jds:
            j["jd_id"] = j.pop("id")
        return jds
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ── POST /api/candidate/apply ──────────────────────────────────────────────────
@app.post("/api/candidate/apply", status_code=status.HTTP_201_CREATED)
async def apply_to_jd(
    data: ApplyRequest,
    current_user: TokenPayload = Depends(require_role("candidate")),
):
    """
    Submit (or update) a match result for a job description.
    Upserts on (candidate_id, jd_id) so re-running the analyzer
    on the same JD updates the existing row instead of duplicating.
    """
    sb = get_supabase()
    # Verify JD exists
    try:
        sb.table("job_descriptions").select("id").eq("id", data.jd_id).single().execute()
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"JD '{data.jd_id}' not found")

    # ── 1. Fetch Technical Stats ────────────────────────────────────────────────
    profile_stats = data.profile_data or {}
    
    # Auto-fetch if usernames are provided but stats aren't
    if data.github_username and not profile_stats.get("github"):
        try:
            gh_stats = await _fetch_github_stats(data.github_username)
            if gh_stats:
                profile_stats["github"] = gh_stats
        except: pass

    if data.leetcode_username and not profile_stats.get("leetcode"):
        try:
            lc_stats = await _fetch_leetcode_stats(data.leetcode_username)
            if lc_stats:
                profile_stats["leetcode"] = lc_stats
        except: pass

    mr = data.match_result
    try:
        res = (
            sb.table("applications")
            .upsert(
                {
                    "candidate_id":    current_user.user_id,
                    "jd_id":           data.jd_id,
                    "match_score":     mr.get("overall_score", 0),
                    "matched_skills":  mr.get("matched_skills", []),
                    "partial_skills":  mr.get("partial_skills", []),
                    "missing_skills":  mr.get("missing_skills", []),
                    "explanation":     mr.get("explanation", ""),
                    "blind_scored":    data.blind_scored,
                    "pii_count":       data.pii_count,
                    "github_username": data.github_username,
                    "leetcode_username": data.leetcode_username,
                    "profile_data":    profile_stats,
                    "resume_data":     data.resume_data,
                },
                on_conflict="candidate_id,jd_id",
            )
            .execute()
        )
        row = res.data[0] if res.data else {}
        return {"application_id": row.get("id"), "submitted_at": row.get("submitted_at")}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ── GET /api/candidate/applications ───────────────────────────────────────────
@app.get("/api/candidate/applications")
async def my_applications(
    current_user: TokenPayload = Depends(require_role("candidate")),
):
    """Return all applications submitted by this candidate, with JD titles."""
    sb = get_supabase()
    try:
        res = (
            sb.table("applications")
            .select("id, jd_id, match_score, submitted_at, blind_scored, job_descriptions(title)")
            .eq("candidate_id", current_user.user_id)
            .order("submitted_at", desc=True)
            .execute()
        )
        result = []
        for a in (res.data or []):
            jd_info = a.get("job_descriptions") or {}
            result.append({
                "application_id": a.get("id"),
                "jd_id":          a.get("jd_id"),
                "jd_title":       jd_info.get("title", "Untitled"),
                "match_score":    a.get("match_score"),
                "submitted_at":   a.get("submitted_at"),
                "blind_scored":   a.get("blind_scored"),
            })
        return result
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
