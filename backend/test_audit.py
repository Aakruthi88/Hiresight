"""
TalentLens -- Dynamic JD Bias Auditor (CLI)
===========================================
Usage:
  # Pass a text file
  python test_audit.py jd.txt

  # Pass a PDF
  python test_audit.py job_description.pdf

  # Pipe text directly
  echo "We need a rockstar ninja. Degree required." | python test_audit.py

  # Interactive (type/paste JD, then Ctrl+Z on Windows / Ctrl+D on Linux)
  python test_audit.py
"""
import sys, io
# Force UTF-8 output on Windows so box/arrow chars don't crash
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import re
import os
import textwrap
from typing import List

# ─── Try to import pdfplumber for PDF support (optional) ─────────────────────
try:
    import pdfplumber, io
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

# ─── Bias Rules (mirrors main.py — kept in sync manually) ────────────────────
BIAS_RULES = [
    # Gendered / coded masculine language
    (r'\bninja\b',                  'gendered',             'high',   'ninja',                  'skilled engineer'),
    (r'\brockstar\b',               'gendered',             'high',   'rockstar',               'high-performing'),
    (r'\bguru\b',                   'gendered',             'medium', 'guru',                   'expert'),
    (r'\bwizard\b',                 'gendered',             'medium', 'wizard',                 'specialist'),
    (r'\bsuperhero\b',              'gendered',             'medium', 'superhero',              'exceptional contributor'),
    (r'\bdominant\b',               'gendered',             'high',   'dominant',               'leading'),
    (r'\baggressive\b',             'gendered',             'high',   'aggressive',             'driven'),
    (r'\bnurturing\b',              'gendered',             'medium', 'nurturing',              'supportive'),
    (r'\bstrongly driven\b',        'gendered',             'low',    'strongly driven',        'motivated'),
    (r'\bcompetitive nature\b',     'gendered',             'medium', 'competitive nature',     'results-oriented mindset'),
    (r'\bhe or she\b',              'gendered',             'low',    'he or she',              'they'),
    (r'\bhe/she\b',                 'gendered',             'low',    'he/she',                 'they'),
    (r'\bhimself\b',                'gendered',             'low',    'himself',                'themselves'),
    (r'\bherself\b',                'gendered',             'low',    'herself',                'themselves'),
    (r'\bmanpower\b',               'gendered',             'medium', 'manpower',               'workforce'),
    (r'\bmanmade\b',                'gendered',             'low',    'manmade',                'artificial'),
    # Credential inflation
    (r'degree\s+required',          'credential_gate',      'high',   'degree required',        'relevant experience or equivalent'),
    (r"bachelor['\u2019s]*\s+required", 'credential_gate', 'high',   "bachelor's required",    'relevant experience or equivalent'),
    (r"master['\u2019s]*\s+required",   'credential_gate', 'high',   "master's required",      'advanced experience or equivalent'),
    (r'must\s+have\s+a\s+degree',   'credential_gate',      'high',   'must have a degree',     'must have relevant experience'),
    (r'phd\s+required',             'credential_gate',      'medium', 'PhD required',           'advanced expertise or PhD preferred'),
    (r'university\s+degree\s+required', 'credential_gate', 'high',   'university degree required', 'relevant experience or degree'),
    (r'formal\s+(education|qualification)\s+required', 'credential_gate', 'medium', 'formal education required', 'relevant skills and experience'),
    # Experience inflation (young technologies)
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(next\.?js|nextjs)',
     'experience_inflation', 'high', '5+ years Next.js', '2+ years of experience with Next.js (widely adopted ~2020)'),
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(tailwind|tailwindcss)',
     'experience_inflation', 'high', '5+ years Tailwind', '2+ years of experience with Tailwind CSS (released 2017)'),
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(kubernetes|k8s)',
     'experience_inflation', 'medium', '5+ years Kubernetes', '3+ years with Kubernetes'),
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(rust\b)',
     'experience_inflation', 'high', '5+ years Rust', '2+ years of experience with Rust (mainstream ~2019)'),
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(flutter)',
     'experience_inflation', 'high', '5+ years Flutter', '2+ years of experience with Flutter (stable 2018)'),
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(svelte)',
     'experience_inflation', 'high', '5+ years Svelte', '2+ years of experience with Svelte (popular since 2019)'),
    (r'[5-9]\+?\s+years?\s+(of\s+)?experience\s+(with\s+|in\s+)?(openai|chatgpt|gpt-4)',
     'experience_inflation', 'high', '5+ years OpenAI', '1+ years with OpenAI APIs (public since 2020)'),
    (r'10\+?\s+years?\s+(of\s+)?experience',
     'experience_inflation', 'medium', '10+ years experience', '7+ years of experience'),
    # Exclusionary / culture-fit
    (r'culture\s+fit',              'exclusionary', 'high',   'culture fit',            'values alignment'),
    (r'beer\s+fridge',              'exclusionary', 'high',   'beer fridge',            'team social events'),
    (r'ping[-\s]pong',              'exclusionary', 'medium', 'ping-pong',              'recreational facilities'),
    (r'work\s+hard[,\s]+play\s+hard','exclusionary','high',  'work hard play hard',    'high performance with work-life balance'),
    (r'young\s+(and\s+)?dynamic',   'exclusionary', 'high',   'young and dynamic',      'energetic and collaborative'),
    (r'digital\s+native',           'exclusionary', 'medium', 'digital native',         'proficient with modern tools'),
    (r'recent\s+grad(uate)?s?\s+preferred', 'exclusionary', 'medium', 'recent graduates preferred', 'entry-level candidates welcome'),
    (r'must\s+be\s+available\s+24/7','exclusionary','high',  'must be available 24/7', 'able to respond to on-call requirements'),
    (r'startup\s+hustle',           'exclusionary', 'medium', 'startup hustle',         'fast-paced, collaborative environment'),
    (r'brogrammer',                 'exclusionary', 'high',   'brogrammer',             'collaborative engineer'),
    (r'no\s+job[-\s]hoppers?',      'exclusionary', 'high',   'no job hoppers',         'seeking long-term commitment'),
    (r'native\s+english\s+speaker', 'exclusionary', 'high',   'native English speaker', 'strong English communication skills'),
]

CATEGORY_LABEL = {
    'gendered':             'Gendered Language',
    'credential_gate':      'Credential Inflation',
    'experience_inflation': 'Experience Inflation',
    'exclusionary':         'Exclusionary / Culture-fit',
}

SEVERITY_WEIGHT = {'high': 3, 'medium': 2, 'low': 1}

SEVERITY_COLOR = {     # ANSI codes
    'high':   '\033[91m',  # red
    'medium': '\033[93m',  # yellow
    'low':    '\033[94m',  # blue
}
RESET  = '\033[0m'
BOLD   = '\033[1m'
GREEN  = '\033[92m'
CYAN   = '\033[96m'
DIM    = '\033[2m'

# Disable ANSI if terminal doesn't support it (e.g. bare cmd.exe)
if not sys.stdout.isatty() or os.name == 'nt':
    # Keep colours — modern Windows Terminal supports them;
    # but strip if TERM is unset (redirected output)
    import os as _os
    if not _os.environ.get('WT_SESSION') and not _os.environ.get('TERM'):
        SEVERITY_COLOR = {'high':'','medium':'','low':''}
        RESET=BOLD=GREEN=CYAN=DIM=''

# ─── Core Engine ──────────────────────────────────────────────────────────────

def _context(text: str, match: re.Match, window: int = 70) -> str:
    s = max(0, match.start() - window)
    e = min(len(text), match.end() + window)
    snip = text[s:e].replace('\n', ' ').strip()
    if s > 0:    snip = '…' + snip
    if e < len(text): snip = snip + '…'
    return snip

def run_audit(jd_text: str):
    flags = []
    rewritten = jd_text
    seen: set = set()

    for pattern, category, severity, canonical, suggestion in BIAS_RULES:
        if pattern in seen:
            continue
        compiled = re.compile(pattern, re.IGNORECASE)
        matches = list(compiled.finditer(jd_text))
        if not matches:
            continue
        seen.add(pattern)
        m = matches[0]
        flags.append({
            'phrase':     m.group(0),
            'category':   category,
            'severity':   severity,
            'suggestion': suggestion,
            'context':    _context(jd_text, m),
            'count':      len(matches),
        })
        rewritten = compiled.sub(suggestion, rewritten)

    bias_score = sum(SEVERITY_WEIGHT.get(f['severity'], 1) for f in flags)
    return flags, bias_score, rewritten

# ─── Input helpers ────────────────────────────────────────────────────────────

def read_pdf(path: str) -> str:
    if not PDF_SUPPORT:
        print(f"{SEVERITY_COLOR['high']}[ERROR]{RESET} pdfplumber not installed. "
              "Run: pip install pdfplumber")
        sys.exit(1)
    with pdfplumber.open(path) as pdf:
        return "\n".join(p.extract_text() for p in pdf.pages if p.extract_text())

def get_jd() -> str:
    """Return JD text from file arg, piped stdin, or interactive prompt."""
    if len(sys.argv) > 1:
        path = sys.argv[1]
        if not os.path.exists(path):
            print(f"{SEVERITY_COLOR['high']}[ERROR]{RESET} File not found: {path}")
            sys.exit(1)
        if path.lower().endswith('.pdf'):
            return read_pdf(path)
        with open(path, 'r', encoding='utf-8', errors='replace') as fh:
            return fh.read()

    if not sys.stdin.isatty():           # piped input
        return sys.stdin.read()

    # Interactive fallback
    print(f"{CYAN}{BOLD}TalentLens Bias Auditor{RESET}")
    print(f"{DIM}Paste your job description below.")
    print(f"When done, press Enter twice then Ctrl+Z (Windows) / Ctrl+D (Linux/Mac).{RESET}\n")
    lines = []
    try:
        while True:
            lines.append(input())
    except EOFError:
        pass
    return "\n".join(lines)

# ─── Pretty Printer ───────────────────────────────────────────────────────────

def hr(char='-', width=70):
    print(f"{DIM}{char * width}{RESET}")

def print_report(jd_text: str, flags: list, bias_score: int, rewritten: str):
    total    = len(flags)
    high_n   = sum(1 for f in flags if f['severity'] == 'high')
    medium_n = sum(1 for f in flags if f['severity'] == 'medium')
    low_n    = sum(1 for f in flags if f['severity'] == 'low')

    # ── Header ────────────────────────────────────────────────────────────────
    print()
    hr('=')
    print(f"  {BOLD}{CYAN}TalentLens -- JD Bias Audit Report{RESET}")
    hr('=')
    print(f"  Input length : {len(jd_text):,} characters")
    print(f"  Flags found  : {BOLD}{total}{RESET}  "
          f"({SEVERITY_COLOR['high']}{high_n} high{RESET} · "
          f"{SEVERITY_COLOR['medium']}{medium_n} medium{RESET} · "
          f"{SEVERITY_COLOR['low']}{low_n} low{RESET})")
    print(f"  Bias score   : {BOLD}{bias_score}{RESET}  (weighted: high=3, medium=2, low=1)")
    hr()

    if total == 0:
        print(f"\n  {GREEN}✓ No bias patterns detected. This JD looks inclusive!{RESET}\n")
    else:
        # ── Flags by category ─────────────────────────────────────────────────
        by_cat: dict = {}
        for f in flags:
            by_cat.setdefault(f['category'], []).append(f)

        for cat, cat_flags in by_cat.items():
            label = CATEGORY_LABEL.get(cat, cat)
            print(f"\n  {BOLD}{label}{RESET}  ({len(cat_flags)} flag{'s' if len(cat_flags)>1 else ''})")
            hr('·')
            for f in cat_flags:
                sev_color = SEVERITY_COLOR.get(f['severity'], '')
                times = f"  ×{f['count']}" if f['count'] > 1 else ""
                print(f"  {sev_color}[{f['severity'].upper():6}]{RESET}  "
                      f"{BOLD}\"{f['phrase']}\"{RESET}{DIM}{times}{RESET}")
                print(f"           -> {GREEN}{f['suggestion']}{RESET}")
                # Wrap context to 65 chars
                ctx_wrapped = textwrap.fill(f['context'], width=65,
                                            initial_indent='           ',
                                            subsequent_indent='             ')
                print(f"{DIM}{ctx_wrapped}{RESET}")
                print()

        # ── Summary ───────────────────────────────────────────────────────────
        hr()
        cats_found = list(dict.fromkeys(f['category'] for f in flags))
        impacts = {
            'gendered':             'may discourage women and non-binary candidates',
            'credential_gate':      'may exclude skilled career-switchers and self-taught engineers',
            'experience_inflation': 'artificially narrows the talent pool',
            'exclusionary':         'may deter candidates from diverse backgrounds',
        }
        print(f"\n  {BOLD}Summary{RESET}")
        for c in cats_found:
            print(f"  • {CATEGORY_LABEL.get(c, c)}: {impacts.get(c, '')}")
        print()

        # ── Rewritten JD ──────────────────────────────────────────────────────
        hr()
        print(f"\n  {BOLD}Rewritten JD (suggestions applied){RESET}")
        hr('·')
        for line in rewritten.splitlines():
            if line.strip():
                print(f"  {line}")
        print()

    hr('=')
    print()

# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == '__main__':
    jd_text = get_jd().strip()
    if not jd_text:
        print("No input received. Exiting.")
        sys.exit(0)

    flags, bias_score, rewritten = run_audit(jd_text)
    print_report(jd_text, flags, bias_score, rewritten)
