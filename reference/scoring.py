"""Scoring déterministe 0-100 des offres d'emploi.

Barème :
    technical_score  35  match skills de l'offre / ma stack
    education_score  25  compatibilité niveau Bac+3 MIAGE
    location_score   15  Toulouse/Haute-Garonne (31)=15, Paris/IDF (75,77,78,91-95)=13, Remote=10,
                         autre (dont Montauban, Montpellier, reste de l'Occitanie)=3
    contract_score   10  alternance=10, stage=8, CDD=5
    miage_score      10  MIAGE explicite=10, compatible=5, rien=0
    source_score      5  qualité de la source

Aucune dépendance externe, aucun appel réseau / LLM : même entrée => même score.
"""

import json
import re
import unicodedata

MAX_POINTS = {
    "technical_score": 35,
    "education_score": 25,
    "location_score": 15,
    "contract_score": 10,
    "miage_score": 10,
    "source_score": 5,
}

MY_STACK = [
    "Python", "JavaScript", "React", "Next.js", "Node.js", "Express",
    "PostgreSQL", "MySQL", "JWT", "Pandas", "Matplotlib", "Power BI",
    "Git", "GitHub", "Docker", "Linux", "Tailwind CSS", "Chart.js",
    "SQL", "HTML", "CSS", "API REST",
]

# Variantes d'écriture -> nom canonique (clés déjà normalisées par _norm_skill)
SKILL_ALIASES = {
    "js": "javascript", "ecmascript": "javascript",
    "reactjs": "react", "react.js": "react",
    "nextjs": "next.js", "next": "next.js",
    "nodejs": "node.js", "node": "node.js",
    "expressjs": "express", "express.js": "express",
    "postgres": "postgresql", "psql": "postgresql",
    "powerbi": "power bi",
    "tailwind": "tailwind css", "tailwindcss": "tailwind css",
    "chartjs": "chart.js",
    "html5": "html", "css3": "css",
    "rest": "api rest", "rest api": "api rest", "api restful": "api rest",
    "restful api": "api rest", "restful": "api rest", "apis rest": "api rest",
    "json web token": "jwt",
    "github actions": "github",
}

# Score technique quand l'offre ne cite aucune techno : neutre plutôt que 0, pour ne pas
# enterrer les offres mal renseignées (la confiance, elle, baisse).
TECH_NEUTRAL = 20.0

# Poids required vs optional dans le score technique
REQUIRED_WEIGHT = 0.8
OPTIONAL_WEIGHT = 0.2

LOCATION_POINTS = [
    (("toulouse", "haute-garonne", "blagnac", "labege", "colomiers"), 15),
    (("paris", "ile-de-france", "idf", "la defense",
      # 92
      "suresnes", "boulogne", "nanterre", "courbevoie", "puteaux", "levallois", "neuilly",
      "issy-les-moulineaux", "issy les moulineaux", "rueil", "colombes", "asnieres",
      "clichy", "montrouge", "malakoff", "clamart", "meudon", "sevres", "chatillon",
      "gennevilliers", "saint-cloud", "saint cloud",
      # 93
      "saint-denis", "saint denis", "montreuil", "aubervilliers", "pantin", "bobigny",
      "noisy-le-grand", "noisy le grand", "bagnolet", "saint-ouen", "saint ouen",
      # 94
      "vincennes", "creteil", "ivry", "vitry", "villejuif", "fontenay-sous-bois",
      "charenton", "saint-mande", "saint-maur", "maisons-alfort", "arcueil", "rungis",
      # 95 / 91 / 78 / 77
      "cergy", "argenteuil", "pontoise", "sarcelles", "massy", "palaiseau", "saclay",
      "evry", "orsay", "versailles", "saint-quentin-en-yvelines", "guyancourt",
      "velizy", "saint-germain-en-laye", "marne-la-vallee", "melun", "meaux",
      "champs-sur-marne", "serris"), 13),
    (("remote", "teletravail", "full remote", "a distance", "distanciel"), 10),
]
LOCATION_DEFAULT = 3
IDF_SCORE = 13
TOULOUSE_SCORE = 15
# Département d'Île-de-France : "92 - Suresnes" (France Travail) ou code postal "92150" (LBA)
IDF_DEPT_RE = re.compile(r"(?:^|\D)(?:75|77|78|91|92|93|94|95)(?:\s*-\s|\d{3}\b)")
HAUTE_GARONNE_RE = re.compile(r"(?:^|\D)31(?:\s*-\s|\d{3}\b)")

CONTRACT_POINTS = [
    (("alternance", "apprentissage", "apprenti", "contrat pro", "professionnalisation", "work-study"), 10),
    (("stage", "stagiaire", "internship", "intern"), 8),
    (("cdd", "fixed-term"), 5),
]

# Qualité des sources (clé = identifiant normalisé de la source)
SOURCE_POINTS = {
    # Sites carrière d'entreprise (adapters/careers_adapter.py) : la source la plus fiable.
    # Tout nouveau slug ajouté à COMPANIES doit être ajouté ici, sinon il tombe à 1 point.
    "career_page": 5, "company": 5, "site_entreprise": 5, "careers": 5,
    "airbus": 5, "sopra-steria": 5, "sopra_steria": 5, "capgemini": 5, "thales": 5,
    "renault": 5, "atos": 5, "cnes": 5, "orange": 5, "sii": 5, "accenture": 5,
    "france_travail": 4, "apec": 4, "welcome_to_the_jungle": 4, "wttj": 4,
    "jobteaser": 4, "hellowork": 3, "indeed": 3, "linkedin": 3,
    "labonnealternance": 4, "1jeune1solution": 3,
}
SOURCE_DEFAULT = 1

MIAGE_COMPATIBLE_TERMS = (
    "informatique de gestion", "systemes d'information", "systeme d'information",
    "master informatique", "licence informatique", "formation informatique",
    "ecole d'ingenieur ou universite", "universite", "msi", "sio",
    "data", "developpement",
)


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def _norm(s) -> str:
    return _strip_accents(str(s or "")).lower().strip()


def _norm_skill(s: str) -> str:
    key = re.sub(r"\s+", " ", _norm(s))
    return SKILL_ALIASES.get(key, key)


def _as_list(v) -> list:
    """Accepte une liste, une chaîne JSON ou une chaîne séparée par virgules."""
    if v is None:
        return []
    if isinstance(v, (list, tuple, set)):
        return [x for x in v if str(x).strip()]
    s = str(v).strip()
    if not s:
        return []
    if s.startswith("["):
        try:
            return [x for x in json.loads(s) if str(x).strip()]
        except json.JSONDecodeError:
            pass
    return [x.strip() for x in re.split(r"[,;/|]", s) if x.strip()]


MY_STACK_NORM = {_norm_skill(s) for s in MY_STACK}


def _offer_text(offer: dict) -> str:
    return _norm(" ".join(str(offer.get(k) or "") for k in
                          ("title", "education_required", "description", "location", "contract_type")))


# --- Sous-scores -----------------------------------------------------------

def technical_score(offer: dict) -> float:
    req = {_norm_skill(s) for s in _as_list(offer.get("skills_required"))}
    opt = {_norm_skill(s) for s in _as_list(offer.get("skills_optional"))} - req
    if not req and not opt:
        return TECH_NEUTRAL
    req_ratio = len(req & MY_STACK_NORM) / len(req) if req else None
    opt_ratio = len(opt & MY_STACK_NORM) / len(opt) if opt else None
    if req_ratio is None:
        ratio = opt_ratio
    elif opt_ratio is None:
        ratio = req_ratio
    else:
        ratio = REQUIRED_WEIGHT * req_ratio + OPTIONAL_WEIGHT * opt_ratio
    return round(MAX_POINTS["technical_score"] * ratio, 2)


def education_score(offer: dict) -> float:
    """Profil : Bac+3 MIAGE (candidat en poursuite Master)."""
    edu = _norm(offer.get("education_required"))
    if not edu:
        return 15.0  # non précisé : neutre
    levels = [int(n) for n in re.findall(r"bac\s*\+\s*(\d)", edu)]
    if "doctorat" in edu or "phd" in edu:
        return 0.0
    in_progress = any(t in edu for t in ("en cours", "preparation", "prepare", "poursuite", "integrer"))
    if levels:
        lvl = min(levels)  # "Bac+3 à Bac+5" => on retient le plus accessible
    elif re.search(r"\b(licence|bachelor|l3|but)\b", edu):
        lvl = 3
    elif re.search(r"\b(master|m1|m2|ingenieur)\b", edu):
        lvl = 5
    elif re.search(r"\b(bts|dut|deust)\b", edu):
        lvl = 2
    else:
        return 15.0
    if lvl <= 2:
        return 20.0
    if lvl == 3:
        return 25.0
    # Bac+4/5 : compatible si formation en cours (alternance / stage de Master)
    if in_progress or lvl == 4:
        return 20.0
    return 8.0  # Bac+5 diplômé exigé


def location_score(offer: dict) -> float:
    loc = _norm(offer.get("location"))
    best = LOCATION_DEFAULT
    for terms, pts in LOCATION_POINTS:
        if any(t in loc for t in terms):
            best = max(best, pts)
    if IDF_DEPT_RE.search(loc):
        best = max(best, IDF_SCORE)
    if HAUTE_GARONNE_RE.search(loc):
        best = max(best, TOULOUSE_SCORE)
    return float(best)


def contract_score(offer: dict) -> float:
    ct = _norm(offer.get("contract_type"))
    for terms, pts in CONTRACT_POINTS:
        if any(re.search(rf"\b{re.escape(t)}\b", ct) for t in terms):
            return float(pts)
    return 0.0


def miage_score(offer: dict) -> float:
    text = _offer_text(offer)
    if offer.get("miage_mentioned") or re.search(r"\bmiage\b", text):
        return 10.0
    if any(t in text for t in MIAGE_COMPATIBLE_TERMS):
        return 5.0
    return 0.0


def source_score(offer: dict) -> float:
    key = re.sub(r"[\s\-]+", "_", _norm(offer.get("source")))
    return float(SOURCE_POINTS.get(key, SOURCE_DEFAULT))


SCORERS = {
    "technical_score": technical_score,
    "education_score": education_score,
    "location_score": location_score,
    "contract_score": contract_score,
    "miage_score": miage_score,
    "source_score": source_score,
}


def confidence(offer: dict) -> float:
    """Part des champs utiles au scoring effectivement renseignés (0-1)."""
    fields = ("title", "company", "location", "contract_type", "education_required",
              "skills_required", "source")
    filled = sum(1 for f in fields if _as_list(offer.get(f)) or (offer.get(f) and not isinstance(offer.get(f), list)))
    return round(filled / len(fields), 2)


def score_offer(offer: dict) -> dict:
    """Renvoie les sous-scores, le score total (int 0-100) et la confiance."""
    result = {name: fn(offer) for name, fn in SCORERS.items()}
    total = sum(result.values())
    result["score"] = int(round(min(100.0, max(0.0, total))))
    result["confidence"] = confidence(offer)
    return result


def matched_skills(offer: dict) -> list:
    skills = _as_list(offer.get("skills_required")) + _as_list(offer.get("skills_optional"))
    return sorted({s for s in skills if _norm_skill(s) in MY_STACK_NORM})


assert sum(MAX_POINTS.values()) == 100
