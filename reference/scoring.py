"""Scoring déterministe 0-100 des offres d'emploi.

Barème :
    technical_score  35  match skills de l'offre / ma stack
    education_score  25  compatibilité niveau Bac+3 MIAGE
    location_score   15  Toulouse/Haute-Garonne (31)=15, Paris/IDF (75,77,78,91-95)=13, Remote=10,
                         autre (dont Montauban, Montpellier, reste de l'Occitanie)=3
    contract_score   10  alternance=10, stage=8, CDD=5
    miage_score      10  MIAGE explicite=10, compatible=5, rien=0
    source_score      5  qualité de la source

Cinq ajustements (ajoutés le 22/10/2026, chacun visible dans `breakdown` / `reasons`) :
    niveau de diplôme      +7 si Bac+3/licence/L3 demandé, -8 si Bac+4/4-5, Bac+5, Master, cycle
                           ingénieur exigé (une annonce décrit une exigence, jamais le candidat)
    prérequis métier       -4 par prérequis de domaine hors profil (spatial, RF, signal, OCR, VHDL…)
    compétence hors profil -3 par techno exigée absente de `faits.COMPETENCES_CONFIRMEES`, max -9
    bloqueur administratif plafonne le score à 55 (habilitation, secret défense, nationalité…)
    dates                  -10 si début avant le 29/03/2027, +3 si compatible, 0 si date inconnue ;
                           la date est relue dans l'annonce si la colonne `start_date` est vide
    date de fin            -8 si la fin calculée tombe en septembre-octobre (le stage devrait être
                           raccourci), 0 si elle tombe en août (à négocier) ou dans la fenêtre,
                           et `eligibility` écarte l'offre si la fin passe le 31/10/2027

Aucune dépendance externe, aucun appel réseau / LLM : même entrée => même score.
"""

import json
import re
import unicodedata

from eligibility import PALIER_FIN_RACCOURCIR, est_stage, fin_de_stage
from faits import COMPETENCES_CONFIRMEES

MAX_POINTS = {
    "technical_score": 35,
    "education_score": 25,
    "location_score": 15,
    "contract_score": 10,
    "miage_score": 10,
    "source_score": 5,
}

# Référentiel unique : `faits.COMPETENCES_CONFIRMEES`. Ce qui n'y est pas est « hors profil ».
MY_STACK = list(COMPETENCES_CONFIRMEES)

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

# --- Quatre critères ajoutés le 22/10/2026 --------------------------------
# Ce sont des **ajustements** (bonus/malus) au-dessus des six sous-scores : le total est plafonné
# à 100 et ramené à 0 au minimum. Chacun produit une ligne lisible dans `score_offer()["breakdown"]`.

# 1. Niveau de diplôme exigé. Fanel est en L3 MIAGE (Bac+3) et cherche un stage de fin de licence.
NIVEAU_BAC3_BONUS = 7.0        # Bac+3 / licence / L3 demandé : l'offre est calibrée pour lui
NIVEAU_BAC5_MALUS = -8.0       # Bac+4, Bac+4/5, Bac+5, Master, cycle ingénieur : hors calibre

# 2. Prérequis métier non technologiques que le profil ne couvre pas (domaine aéronautique/spatial,
#    électronique, signal). Format : (libellé affiché, variantes normalisées sans accents).
#    Facile à compléter : ajouter une ligne suffit. Un même concept ne compte qu'une fois.
PREREQUIS_METIER = (
    ("mécanique spatiale", ("mecanique spatiale",)),
    ("chaînes RF", ("chaines rf", "chaine rf", "chaine radiofrequence")),
    ("bilans de puissance", ("bilans de puissance", "bilan de puissance")),
    ("aéronautique", ("aeronautique",)),
    ("spatial", ("spatial", "spatiale")),
    ("traitement du signal", ("traitement du signal",)),
    ("OCR", ("ocr",)),
    ("VHDL", ("vhdl",)),
    ("hyperfréquences", ("hyperfrequences", "hyperfrequence")),
)
PREREQUIS_METIER_MALUS = -4.0  # par prérequis distinct trouvé dans l'annonce

# Un terme ne compte que s'il est **présenté comme requis** : dans le titre, dans les compétences
# demandées, ou dans une phrase qui porte un marqueur d'exigence. Sans ce filtre, le couplet
# institutionnel « Aéronautique & Spatial » de Thales plombait toutes ses offres, y compris le
# développement logiciel (constaté le 22/10/2026).
MARQUEURS_EXIGENCE = (
    "maitrise", "connaissance", "competence", "experience", "requis", "exige",
    "notion", "formation", "diplome", "solide", "background", "capacite",
    "appetence", "sensibilite", "pratique",
)

# 3. Bloqueurs administratifs : l'offre est techniquement bonne mais inaccessible (nationalité,
#    habilitation, enquête). On ne la supprime pas : on plafonne le score et on l'affiche en clair.
BLOQUEURS_ADMIN = (
    "habilitation de securite",
    "habilitation",
    "secret defense",
    "nationalite francaise",
    "enquete administrative",
    "etre de nationalite",
)
PLAFOND_ADMIN = 55

# 4. Compatibilité des dates : Fanel est disponible à partir du 29 mars 2027 (fin de la L3).
DISPONIBILITE = "2027-03-29"
DATE_INCOMPATIBLE_MALUS = -10.0
FIN_TARDIVE_MALUS = -8.0
# 5. Date de fin (22/10/2026) : la rentrée de Master est en septembre 2027, donc le stage doit
# finir au 31/07, août à la rigueur. Une annonce plus longue reste candidatable — on annonce
# l'écart et on demande à raccourcir — mais elle ne doit **jamais** dépasser au classement une
# offre équivalente qui tient dans la fenêtre : d'où ce malus, du même ordre que celui du niveau
# de diplôme (-8), appliqué au palier « septembre-octobre ».
DATE_COMPATIBLE_BONUS = 3.0

# 5. Compétence exigée absente du référentiel (`faits.COMPETENCES_CONFIRMEES`). #837 exige C++,
#    #867 exige Vue.js : l'offre demandait une techno que Fanel n'a pas, et le score l'ignorait.
#    -3 par compétence distincte, plafonné à -9 : au-delà, l'offre est déjà disqualifiée par ailleurs.
COMPETENCE_MALUS = -3.0
COMPETENCE_PLAFOND = -9.0
# Termes techniques **hors référentiel** cherchés dans le titre et dans les phrases d'exigence de la
# description. Volontairement limité aux technos non ambiguës (pas de « R », « Go », « Tableau »).
TECH_HORS_PROFIL = (
    ("C++", r"(?<![a-z0-9])c\+\+(?![a-z0-9])"),
    ("C#", r"(?<![a-z0-9])c#"),
    (".NET", r"\.net\b"),
    ("Vue.js", r"(?<![a-z0-9])vue(?:\.?js)?(?![a-z0-9])"),
    ("Angular", r"(?<![a-z0-9])angular(?![a-z0-9])"),
    ("Kubernetes", r"(?<![a-z0-9])(?:kubernetes|k8s)(?![a-z0-9])"),
    ("GitLab", r"(?<![a-z0-9])gitlab(?![a-z0-9])"),
    ("Spark", r"(?<![a-z0-9])spark(?![a-z0-9])"),
    ("AWS", r"(?<![a-z0-9])aws(?![a-z0-9])"),
    ("Azure", r"(?<![a-z0-9])azure(?![a-z0-9])"),
    ("GCP", r"(?<![a-z0-9])(?:gcp|google cloud)(?![a-z0-9])"),
    ("Scala", r"(?<![a-z0-9])scala(?![a-z0-9])"),
    ("Rust", r"(?<![a-z0-9])rust(?![a-z0-9])"),
    ("Django", r"(?<![a-z0-9])django(?![a-z0-9])"),
    ("Flask", r"(?<![a-z0-9])flask(?![a-z0-9])"),
    ("FastAPI", r"(?<![a-z0-9])fastapi(?![a-z0-9])"),
    ("Spring", r"(?<![a-z0-9])spring(?:\s*boot)?(?![a-z0-9])"),
    ("MongoDB", r"(?<![a-z0-9])mongo(?:db)?(?![a-z0-9])"),
    ("Oracle", r"(?<![a-z0-9])oracle(?![a-z0-9])"),
    ("GraphQL", r"(?<![a-z0-9])graphql(?![a-z0-9])"),
    ("NumPy", r"(?<![a-z0-9])numpy(?![a-z0-9])"),
    ("Airflow", r"(?<![a-z0-9])airflow(?![a-z0-9])"),
    ("dbt", r"(?<![a-z0-9])dbt(?![a-z0-9])"),
    ("Qlik", r"(?<![a-z0-9])qlik(?![a-z0-9])"),
    ("VBA", r"(?<![a-z0-9])vba(?![a-z0-9])"),
    ("Terraform", r"(?<![a-z0-9])terraform(?![a-z0-9])"),
    ("Ansible", r"(?<![a-z0-9])ansible(?![a-z0-9])"),
    ("Jenkins", r"(?<![a-z0-9])jenkins(?![a-z0-9])"),
    ("PowerShell", r"(?<![a-z0-9])powershell(?![a-z0-9])"),
    ("Bash", r"(?<![a-z0-9])bash(?![a-z0-9])"),
    ("UML", r"(?<![a-z0-9])uml(?![a-z0-9])"),
    ("MATLAB", r"(?<![a-z0-9])matlab(?![a-z0-9])"),
    ("COBOL", r"(?<![a-z0-9])cobol(?![a-z0-9])"),
    ("Fortran", r"(?<![a-z0-9])fortran(?![a-z0-9])"),
    ("VHDL", r"(?<![a-z0-9])vhdl(?![a-z0-9])"),
    ("FPGA", r"(?<![a-z0-9])fpga(?![a-z0-9])"),
    ("Assembleur", r"(?<![a-z0-9])assembleur(?![a-z0-9])"),
    ("Hadoop", r"(?<![a-z0-9])hadoop(?![a-z0-9])"),
    ("Kafka", r"(?<![a-z0-9])kafka(?![a-z0-9])"),
    ("Elasticsearch", r"(?<![a-z0-9])elasticsearch(?![a-z0-9])"),
    ("Redis", r"(?<![a-z0-9])redis(?![a-z0-9])"),
    ("Laravel", r"(?<![a-z0-9])laravel(?![a-z0-9])"),
    ("Symfony", r"(?<![a-z0-9])symfony(?![a-z0-9])"),
    ("Talend", r"(?<![a-z0-9])talend(?![a-z0-9])"),
    ("Snowflake", r"(?<![a-z0-9])snowflake(?![a-z0-9])"),
)

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


def _cles_referentiel(competences) -> set[str]:
    """Clés normalisées du référentiel, « Node.js/Express » et « Power BI (Power Query, DAX) »
    compris : on éclate les libellés composés pour que chaque techno se compare seule."""
    cles = set()
    for c in competences:
        for part in re.split(r"[/,()]", str(c)):
            part = part.strip()
            if part:
                cles.add(_norm_skill(part))
    return cles


CONFIRMEES_NORM = _cles_referentiel(COMPETENCES_CONFIRMEES)


def competence_confirmee(skill) -> bool:
    """La techno est-elle dans le référentiel confirmé de Fanel (`faits.COMPETENCES_CONFIRMEES`) ?"""
    return _norm_skill(str(skill or "")) in CONFIRMEES_NORM


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


def niveau_diplome(offer: dict) -> tuple[float, str]:
    """Critère 1 — le diplôme demandé est-il celui de Fanel (Bac+3) ou au-dessus ?

    Source : `education_required` quand il est renseigné, sinon **toute** la `description` (les
    annonces bilingues répètent l'exigence en anglais en bas de page) et le titre.

    Une annonce décrit une **exigence**, jamais le candidat : « Bac+5 en cours » reste donc un
    Bac+5 exigé (-8). La règle qui rendait ce cas neutre a été supprimée le 22/10/2026.

    Pièges tenus :
      - BTS/DUT/BUT/DEUST ne comptent qu'en **capitales** (le mot « but » ne déclenche rien) ;
      - « Ingénieur » seul dans un titre de poste n'est **pas** un niveau : seuls « diplôme
        d'ingénieur », « cycle ingénieur » (fin / dernière année de cycle) valent Bac+5 ;
      - « Bac+3 à Bac+5 » / « Bac+3 ou Bac+5 » → Bac+3, le niveau le plus accessible (+7) ;
      - « Bac+4/5 », « Bac+4-5 », « Bac+4 et 5 » → Bac+4, au-dessus du niveau de Fanel (-8).
    """
    brut = str(offer.get("education_required") or "")
    texte = brut if brut.strip() else " ".join(
        str(offer.get(k) or "") for k in ("title", "description"))
    edu = _norm(texte)
    if not edu.strip():
        return 0.0, "niveau de diplôme : non précisé (0)"
    niveaux = [int(n) for n in re.findall(r"bac\s*\+\s*(\d)", edu)]
    cycle_ingenieur = bool(re.search(r"(?:diplome\s+d\W{0,2}ingenieur|cycle\s+ingenieur)", edu))
    if niveaux:
        lvl = min(niveaux)          # « Bac+3 à Bac+5 » → 3 ; « Bac+4/5 » → 4
    elif re.search(r"\b(l3|licence|bachelor)\b", edu):
        lvl = 3
    elif cycle_ingenieur or re.search(r"\b(master|m1|m2|msc)\b", edu):
        lvl = 5
    elif re.search(r"\b(BTS|DUT|BUT|DEUST)\b", texte):   # capitales uniquement
        lvl = 2
    else:
        return 0.0, "niveau de diplôme : non précisé (0)"
    if lvl <= 2:
        return 0.0, "niveau de diplôme : Bac+2 (0)"
    if lvl == 3:
        return NIVEAU_BAC3_BONUS, f"niveau de diplôme : Bac+3 demandé ({NIVEAU_BAC3_BONUS:+.0f})"
    if lvl == 4:
        return NIVEAU_BAC5_MALUS, f"niveau de diplôme : Bac+4 exigé ({NIVEAU_BAC5_MALUS:+.0f})"
    return NIVEAU_BAC5_MALUS, f"niveau de diplôme : Bac+5 exigé ({NIVEAU_BAC5_MALUS:+.0f})"


def prerequis_metier(offer: dict) -> tuple[float, list[str]]:
    """Critère 2 — prérequis de domaine que le profil ne couvre pas (spatial, RF, signal…).

    Un concept ne compte **qu'une fois** (ses variantes singulier/pluriel sont groupées) et
    seulement s'il est présenté comme requis : titre, compétences demandées, ou phrase portant un
    marqueur d'exigence (« maîtrise de… », « connaissance des… »).
    """
    titre = _norm(offer.get("title"))
    competences = _norm(" ".join(str(offer.get(k) or "") for k in
                                 ("skills_required", "skills_optional", "education_required")))
    description = _norm(offer.get("description"))
    phrases = [p for p in re.split(r"[.\n;!?]", description) if p.strip()]
    # Passages déjà expliqués par un concept plus précis, par zone de texte (titre / compétences /
    # description) : « mécanique spatiale » couvre « spatial », on ne compte pas deux fois.
    occupe = {"titre": [], "competences": [], "description": []}
    zones = (("titre", [titre], False), ("competences", [competences], False),
             ("description", phrases, True))
    trouves = []
    for libelle, variantes in PREREQUIS_METIER:
        motif = r"(?<![a-z0-9])(?:" + "|".join(re.escape(v) for v in variantes) + r")(?![a-z0-9])"
        vu = False
        for zone, textes, filtre in zones:
            for texte in textes:
                if filtre and not any(m in texte for m in MARQUEURS_EXIGENCE):
                    continue
                for m in re.finditer(motif, texte):
                    if any(d <= m.start() and m.end() <= f for d, f in occupe[zone]):
                        continue
                    occupe[zone].append(m.span())
                    vu = True
        if vu:
            trouves.append(libelle)
    return PREREQUIS_METIER_MALUS * len(trouves), trouves


def bloqueurs_admin(offer: dict) -> list[str]:
    """Critère 3 — bloqueurs administratifs (habilitation, secret défense, nationalité…)."""
    texte = _norm(" ".join(str(offer.get(k) or "") for k in
                           ("title", "description", "education_required")))
    return [b for b in BLOQUEURS_ADMIN if b in texte]


def competences_hors_profil(offer: dict) -> tuple[float, list[str]]:
    """Critère 5 — compétences **exigées** par l'annonce et absentes du référentiel confirmé.

    Trois sources, dans cet ordre : les compétences déclarées de l'offre (`skills_required`,
    `skills_optional`), le titre, puis les phrases de la description qui portent un marqueur
    d'exigence (« maîtrise de… », « compétences sur… »). Un simple décor de l'annonce ne compte pas.

    -3 par compétence distincte, plafonné à -9.
    """
    trouvees: list[str] = []

    def ajouter(nom: str) -> None:
        nom = str(nom or "").strip()
        if nom and nom not in trouvees:
            trouvees.append(nom)

    for champ in ("skills_required", "skills_optional"):
        for skill in _as_list(offer.get(champ)):
            if not competence_confirmee(skill):
                ajouter(skill)
    # Titre entier, puis les phrases d'exigence de la description (toute la description, y compris
    # la version anglaise en bas de page : les annonces bilingues répètent l'exigence).
    textes = [_norm(offer.get("title"))]
    for phrase in re.split(r"[.\n;!?]", str(offer.get("description") or "")):
        p = _norm(phrase)
        if p.strip() and any(m in p for m in MARQUEURS_EXIGENCE):
            textes.append(p)
    for libelle, motif in TECH_HORS_PROFIL:
        if any(re.search(motif, t) for t in textes):
            ajouter(libelle)
    malus = max(COMPETENCE_PLAFOND, COMPETENCE_MALUS * len(trouvees)) + 0.0
    return malus, trouvees


def _date_debut_annonce(offer: dict) -> str | None:
    """Date de début lue dans le texte de l'annonce, quand la colonne `start_date` est vide.

    Réutilise `adapters.base.extract_start_date` (aucun détecteur réécrit ici). La date de
    publication sert de repère pour les mois cités sans année.
    """
    from adapters.base import extract_start_date
    from datetime import date as _date
    ref = None
    pub = str(offer.get("published_at") or "")[:10]
    try:
        ref = _date.fromisoformat(pub)
    except ValueError:
        ref = None
    trouvee = extract_start_date(offer.get("description") or "", ref=ref)
    return trouvee if re.match(r"\d{4}-\d{2}-\d{2}$", trouvee or "") else None


def dates_score(offer: dict) -> tuple[float, str]:
    """Critère 4 — début compatible avec une disponibilité au 29 mars 2027 ? Date inconnue = 0.

    La colonne `start_date` fait foi ; quand elle est vide, la date est relue **dans l'annonce**
    (point 5 du 22/10/2026 : #867 CNES dit « débuter en janvier 2027 », #829 ATR « février 2027 »,
    et ces deux offres passaient pour « date inconnue »).
    """
    brut = str(offer.get("start_date") or "").strip()
    lue_dans_annonce = False
    if not re.match(r"\d{4}-\d{2}-\d{2}", brut):
        depuis_texte = _date_debut_annonce(offer)
        if depuis_texte:
            brut, lue_dans_annonce = depuis_texte, True
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", brut)
    if not m:
        return 0.0, "dates : début inconnu (0)"
    jour = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    source = " (lu dans l'annonce)" if lue_dans_annonce else ""
    if jour >= DISPONIBILITE:
        return DATE_COMPATIBLE_BONUS, (f"début {brut}{source} : compatible avec une disponibilité "
                                       f"fin mars 2027 ({DATE_COMPATIBLE_BONUS:+.0f})")
    return DATE_INCOMPATIBLE_MALUS, (f"début {brut}{source} : incompatible avec une disponibilité "
                                     f"fin mars 2027 ({DATE_INCOMPATIBLE_MALUS:+.0f})")


def fin_score(offer: dict) -> tuple[float, str]:
    """Critère 5 — la date de fin calculée entre-t-elle dans la fenêtre de Fanel ?

    `fin_de_stage()` (dans `eligibility.py`) est la seule implémentation de la règle : le filtre
    et le classement lisent la même. Fin non calculable (début ou durée absents) => 0, sans
    conclusion : on ne pénalise pas une offre parce qu'une source a laissé un champ vide.
    """
    if not est_stage(offer):
        # La fenêtre du 31/07/2027 est celle du stage : une alternance ou un CDI n'y est pas
        # soumis (le profil alternance est en pause, et sa durée se juge autrement).
        return 0.0, "date de fin : offre non concernée (contrat non-stage) (0)"
    fin = fin_de_stage(offer)
    if fin.fin is None:
        return 0.0, "fin de stage : non calculable (début ou durée absents) (0)"
    if fin.palier == PALIER_FIN_RACCOURCIR:
        return FIN_TARDIVE_MALUS, f"{fin.drapeau} ({FIN_TARDIVE_MALUS:+.0f})"
    if fin.drapeau:
        return 0.0, f"{fin.drapeau} (0)"
    return 0.0, f"fin {fin.fin:%d/%m/%Y} : dans la fenêtre (0)"


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
    """Renvoie les sous-scores, les quatre ajustements, le score total (int 0-100) et la confiance.

    Le total = somme des six sous-scores (100 points) + niveau de diplôme + prérequis métier +
    dates, puis plafonné à `PLAFOND_ADMIN` si un bloqueur administratif est détecté, borné 0-100.
    `breakdown` / `reasons` portent la décomposition affichée à l'utilisateur.
    """
    result = {name: fn(offer) for name, fn in SCORERS.items()}
    base = sum(result.values())

    pts_niveau, txt_niveau = niveau_diplome(offer)
    malus_metier, termes = prerequis_metier(offer)
    bloqueurs = bloqueurs_admin(offer)
    pts_dates, txt_dates = dates_score(offer)
    malus_comp, comps = competences_hors_profil(offer)
    pts_fin, txt_fin = fin_score(offer)

    # `+ 0.0` évite d'afficher « -0 » quand un malus vaut zéro (0.0 * -4 = -0.0).
    result["niveau_diplome"] = pts_niveau + 0.0
    result["prerequis_metier"] = malus_metier + 0.0
    result["dates"] = pts_dates + 0.0
    result["competences_hors_profil"] = malus_comp + 0.0
    result["date_de_fin"] = pts_fin + 0.0
    result["competences_absentes"] = comps
    result["bloqueur_admin"] = bool(bloqueurs)
    result["plafond"] = PLAFOND_ADMIN if bloqueurs else None

    total = base + pts_niveau + malus_metier + pts_dates + malus_comp + pts_fin
    if bloqueurs:
        total = min(total, float(PLAFOND_ADMIN))
    score = int(round(min(100.0, max(0.0, total))))
    result["score"] = score
    result["confidence"] = confidence(offer)

    txt_metier = (f"prérequis métier hors profil : {', '.join(termes)} ({malus_metier:+.0f})"
                  if termes else "prérequis métier : aucun hors profil (0)")
    if len(comps) == 1:
        txt_competences = f"compétence exigée hors profil : {comps[0]} ({malus_comp:+.0f})"
    elif comps:
        txt_competences = (f"compétences exigées hors profil : {', '.join(comps)} "
                           f"({malus_comp:+.0f})")
    else:
        txt_competences = "compétences exigées : toutes dans le référentiel (0)"
    raisons = [
        f"technique {result['technical_score']:.2f}/35",
        f"diplôme {result['education_score']:.0f}/25",
        f"lieu {result['location_score']:.0f}/15",
        f"contrat {result['contract_score']:.0f}/10",
        f"MIAGE {result['miage_score']:.0f}/10",
        f"source {result['source_score']:.0f}/5",
        txt_niveau,
        txt_metier,
        txt_competences,
        txt_dates,
        txt_fin,
    ]
    if bloqueurs:
        raisons.append(f"⛔ bloqueur administratif : {bloqueurs[0]} — score plafonné à {PLAFOND_ADMIN}")
    else:
        raisons.append("administratif : aucun bloqueur")
    raisons.append(f"TOTAL {score}/100")
    result["reasons"] = raisons

    breakdown = [
        {"critere": "technique", "points": result["technical_score"], "max": 35,
         "detail": "compétences de l'offre couvertes par la stack"},
        {"critere": "diplôme", "points": result["education_score"], "max": 25,
         "detail": "compatibilité Bac+3 MIAGE"},
        {"critere": "lieu", "points": result["location_score"], "max": 15,
         "detail": "Toulouse / IDF / remote"},
        {"critere": "contrat", "points": result["contract_score"], "max": 10,
         "detail": "stage / alternance"},
        {"critere": "MIAGE", "points": result["miage_score"], "max": 10,
         "detail": "MIAGE explicite ou formation compatible"},
        {"critere": "source", "points": result["source_score"], "max": 5,
         "detail": "qualité de la source"},
        {"critere": "niveau de diplôme", "points": pts_niveau, "max": 8,
         "detail": txt_niveau.split(" : ", 1)[-1]},
        {"critere": "prérequis métier", "points": malus_metier, "max": 0,
         "detail": txt_metier.split(" : ", 1)[-1]},
        {"critere": "compétence hors profil", "points": malus_comp, "max": 0,
         "detail": txt_competences.split(" : ", 1)[-1]},
        {"critere": "dates", "points": pts_dates, "max": 3,
         "detail": txt_dates.split(" : ", 1)[-1]},
        {"critere": "date de fin", "points": pts_fin, "max": 0,
         "detail": txt_fin.split(" : ", 1)[-1]},
    ]
    if bloqueurs:
        breakdown.append({"critere": "plafond administratif", "points": float(PLAFOND_ADMIN),
                          "max": 100,
                          "detail": f"score plafonné à {PLAFOND_ADMIN} ({bloqueurs[0]})"})
    result["breakdown"] = breakdown
    return result


def matched_skills(offer: dict) -> list:
    skills = _as_list(offer.get("skills_required")) + _as_list(offer.get("skills_optional"))
    return sorted({s for s in skills if _norm_skill(s) in MY_STACK_NORM})


assert sum(MAX_POINTS.values()) == 100
