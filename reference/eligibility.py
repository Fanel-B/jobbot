"""Filtre d'éligibilité des offres selon des profils de recherche datés.

PROFILE_STAGE_2027  (ACTIF) :
    stage débutant en 2027, visé au 29/03/2027 (modifiable : un début à plus de
    ~2 mois de cette date reste en "uncertain", il n'est pas rejeté).
    Durée 4-5 mois attendue ; 6 mois => uncertain sauf mention Bac+3, > 6 mois => ineligible.
    Stage explicitement non rémunéré => ineligible.
PROFILE_ALTERNANCE_2026  (⏸️ EN PAUSE) :
    alternance / apprentissage / professionnalisation, 12 à 24 mois.
    Recherche suspendue : la L3 se termine par un stage, l'alternance est reportée
    à la M1/M2 (reprise de la recherche en janvier 2027). Profil conservé pour ne pas
    réécrire les règles, mais `active=False` : il n'est plus appliqué, donc toute offre
    alternance sort en "rejected" avec une note explicative.

Zone géographique : une seule zone de recherche, Toulouse et alentours
(`ZONE_PATTERNS`). Hors zone => ineligible. Localisation absente => uncertain.

Chaque vérification renvoie un statut :
    "eligible"   : toutes les conditions sont vérifiées
    "ineligible" : au moins une condition est violée
    "uncertain"  : rien de violé mais une info manque (date, durée, zone) -> à vérifier
    "rejected"   : école / CFA partenaire imposé explicitement (tous profils)

Champs de l'offre lus : contract_type, start_date, end_date, duration, location,
remuneration, salary, description, title, education_required.
"""

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta


ELIGIBLE, INELIGIBLE, UNCERTAIN, REJECTED = "eligible", "ineligible", "uncertain", "rejected"


@dataclass(frozen=True)
class Profile:
    name: str
    contract_terms: tuple
    start_before: date | None = None     # début strictement avant
    start_year: int | None = None        # début dans cette année
    min_months: float | None = None      # durée minimale (incluse)
    max_months: float | None = None      # durée maximale (incluse)
    # Durée dans ]max_months, conditional_max_months] : eligible si Bac+3 accepté, sinon uncertain
    conditional_max_months: float | None = None
    asap_ok: bool = False                # "dès que possible" accepté comme date de début
    reject_unpaid: bool = False          # rejet si non rémunéré explicitement
    active: bool = True                  # False = profil en pause, plus appliqué
    preferred_start: date | None = None  # date de début visée (écart -> uncertain, pas rejeté)
    preferred_tolerance_days: int = 61   # ± tolérance autour de preferred_start


PROFILE_ALTERNANCE_2026 = Profile(
    name="PROFILE_ALTERNANCE_2026",
    contract_terms=("alternance", "alternant", "apprentissage", "apprenti",
                    "contrat pro", "professionnalisation", "work-study"),
    start_before=date(2026, 11, 1),
    min_months=12,
    max_months=12,
    conditional_max_months=24,
    asap_ok=True,
    active=False,   # ⏸️ PAUSE voulue : L3 = stage, alternance reportée M1/M2 (reprise janvier 2027)
)

PROFILE_STAGE_2027 = Profile(
    name="PROFILE_STAGE_2027",
    contract_terms=("stage", "stagiaire", "internship", "intern"),
    start_year=2027,
    min_months=4,
    max_months=5,
    conditional_max_months=6,
    reject_unpaid=True,
    preferred_start=date(2027, 3, 29),   # visé, modifiable
)

PROFILES = (PROFILE_ALTERNANCE_2026, PROFILE_STAGE_2027)
ACTIVE_PROFILES = tuple(p for p in PROFILES if p.active)



@dataclass
class EligibilityResult:
    profile: str
    status: str
    reasons: list = field(default_factory=list)

    @property
    def eligible(self) -> bool:
        return self.status == ELIGIBLE

    def _downgrade(self, status: str, reason: str) -> None:
        """rejected > ineligible > uncertain > eligible."""
        rank = {ELIGIBLE: 0, UNCERTAIN: 1, INELIGIBLE: 2, REJECTED: 3}
        if rank[status] > rank[self.status]:
            self.status = status
        self.reasons.append(reason)


def _norm(s) -> str:
    s = unicodedata.normalize("NFKD", str(s or ""))
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


# --- Parsing de dates ------------------------------------------------------

MONTHS_FR = {
    "janvier": 1, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11, "decembre": 12,
    "january": 1, "february": 2, "march": 3, "april": 4, "june": 6, "july": 7,
    "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    "janv": 1, "fev": 2, "avr": 4, "juil": 7, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}
ASAP_TERMS = ("asap", "des que possible", "immediat", "immediatement", "au plus vite")


def parse_date(value) -> date | str | None:
    """date -> date ; 'ASAP' -> 'asap' ; illisible -> None.

    Formats : ISO (2026-09-01), JJ/MM/AAAA, MM/AAAA, 'septembre 2026', '1er mars 2027'.
    Un mois sans jour est ramené au 1er du mois.
    """
    if value is None:
        return None
    if isinstance(value, date):
        return value
    s = _norm(value)
    if not s:
        return None
    if any(t in s for t in ASAP_TERMS):
        return "asap"
    if m := re.search(r"(\d{4})-(\d{1,2})(?:-(\d{1,2}))?", s):
        return date(int(m[1]), int(m[2]), int(m[3] or 1))
    if m := re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", s):
        return date(int(m[3]), int(m[2]), int(m[1]))
    if m := re.search(r"\b(\d{1,2})/(\d{4})\b", s):
        return date(int(m[2]), int(m[1]), 1)
    if m := re.search(r"(?:(\d{1,2})(?:er)?\s+)?([a-z]+)\.?\s+(\d{4})", s):
        month = MONTHS_FR.get(m[2])
        if month:
            return date(int(m[3]), month, int(m[1] or 1))
    return None


# --- Parsing de durée ------------------------------------------------------

_UNIT_MONTHS = {"mois": 1, "month": 1, "months": 1, "an": 12, "ans": 12, "annee": 12,
                "annees": 12, "year": 12, "years": 12, "semaine": 12 / 52, "semaines": 12 / 52,
                "week": 12 / 52, "weeks": 12 / 52}
_UNIT_RE = r"(mois|months?|ans?|annees?|years?|semaines?|weeks?)"


def parse_duration(value) -> tuple[float, float] | None:
    """Durée -> (min_mois, max_mois) ; illisible -> None.

    Accepte un nombre (mois), '6 mois', '1 an', '24 weeks', '4 à 6 mois', '4-6 months'.
    """
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return (float(value), float(value))
    s = _norm(value)
    if m := re.search(rf"(\d+(?:[.,]\d+)?)\s*(?:a|-|to|ou)\s*(\d+(?:[.,]\d+)?)\s*{_UNIT_RE}", s):
        k = _UNIT_MONTHS[m[3]]
        return (float(m[1].replace(",", ".")) * k, float(m[2].replace(",", ".")) * k)
    if m := re.search(rf"(\d+(?:[.,]\d+)?)\s*{_UNIT_RE}", s):
        v = float(m[1].replace(",", ".")) * _UNIT_MONTHS[m[2]]
        return (v, v)
    if re.fullmatch(r"\d+(?:[.,]\d+)?", s):
        v = float(s.replace(",", "."))
        return (v, v)
    return None


def _months_between(start: date, end: date) -> float:
    # Fin incluse : 01/03 -> 31/08 = 6 mois
    return round(((end - start).days + 1) / 30.44, 1)


def offer_duration(offer: dict) -> tuple[tuple[float, float] | None, str]:
    """Durée explicite (champ duration), sinon déduite de start_date/end_date."""
    d = parse_duration(offer.get("duration"))
    if d:
        return d, f"durée {offer.get('duration')!r}"
    start, end = parse_date(offer.get("start_date")), parse_date(offer.get("end_date"))
    if isinstance(start, date) and isinstance(end, date) and end > start:
        m = _months_between(start, end)
        return (m, m), f"durée déduite des dates ({m} mois)"
    return None, ""


# --- Rémunération ----------------------------------------------------------

UNPAID_PATTERNS = (
    r"\bnon[\s-]remuner", r"\bnon[\s-]gratifi", r"\bsans (?:gratification|remuneration)",
    r"\bpas de (?:gratification|remuneration)", r"\bunpaid\b", r"\bbenevol",
)


def is_unpaid(offer: dict) -> bool:
    text = _norm(" ".join(str(offer.get(k) or "") for k in
                          ("remuneration", "salary", "description", "title")))
    return any(re.search(p, text) for p in UNPAID_PATTERNS)


# --- Niveau Bac+3 accepté -------------------------------------------------

BAC3_PATTERNS = (
    r"\bbac\s*\+\s*3\b", r"\bdes (?:la |le niveau )?l3\b", r"\bl3\b", r"\blicence 3\b",
    r"\bpoursuite (?:possible )?en master\b", r"\bpoursuite d'etudes en master\b",
)
_BAC_RANGE_RE = re.compile(r"\bbac\s*\+\s*(\d)\s*(?:a|-|/|ou)\s*(?:bac\s*)?\+?\s*(\d)\b")


def accepts_bac3(offer: dict) -> bool:
    """True si l'offre accepte explicitement un niveau Bac+3 (y compris 'Bac+2 à Bac+5')."""
    text = _norm(" ".join(str(offer.get(k) or "") for k in
                          ("education_required", "description", "title")))
    if any(re.search(p, text) for p in BAC3_PATTERNS):
        return True
    return any(int(lo) <= 3 <= int(hi) for lo, hi in _BAC_RANGE_RE.findall(text))


# --- École / CFA partenaire imposé ----------------------------------------

# Offres d'écoles qui recrutent des alternants pour leurs propres formations.
# Rejet uniquement sur mention explicite (texte normalisé : minuscules, sans accents).
PARTNER_SCHOOL_PATTERNS = (
    r"\biscod\b", r"\bpigier\b", r"\bynov\b", r"\bmy ?digital ?school\b", r"\bsup de co\b",
    r"\bepitech\b", r"\besd\b", r"\bopen ?classrooms\b", r"\bipi\b", r"\bdawan\b",
    r"\becole partenaire\b", r"\bformation incluse\b", r"\bintegrer notre ecole\b",
    r"\bnotre centre de formation\b", r"\bcfa partenaire obligatoire\b",
)
REASON_PARTNER_SCHOOL = "école/CFA partenaire imposé"


def partner_school_match(offer: dict) -> str | None:
    """Renvoie le motif trouvé si l'offre impose explicitement une école / un CFA partenaire."""
    text = _norm(" ".join(str(offer.get(k) or "") for k in
                          ("title", "company", "description", "education_required")))
    for p in PARTNER_SCHOOL_PATTERNS:
        m = re.search(p, text)
        if m:
            return m[0]
    return None


# --- Zone géographique : Toulouse et alentours -----------------------------

ZONE_LABEL = "Toulouse et alentours"
ZONE_PATTERNS = (
    r"\btoulouse\b", r"\bhaute[-\s]?garonne\b", r"\bcolomiers\b", r"\bblagnac\b",
    r"\blabege\b", r"\bbalma\b", r"\bsaint[-\s]?orens\b", r"\bramonville\b",
    r"\bmuret\b", r"\bcastanet[-\s]?tolosan\b", r"\bl'union\b", r"\bfenouillet\b",
    r"\bcornebarrieu\b", r"\baucamville\b", r"\bbeauzelle\b", r"\bcugnaux\b",
    r"\btournefeuille\b", r"\bplaisance[-\s]?du[-\s]?touch\b",
    r"\bportet[-\s]?sur[-\s]?garonne\b", r"\bpoucharramet\b",
    # Libellés France Travail « 31 - Commune » et codes postaux 31xxx : Haute-Garonne entière.
    r"\b31\s*-\s*[a-z]", r"\b31\d{3}\b",
)
REMOTE_PATTERNS = (r"\bteletravail\b", r"\bremote\b", r"\ba distance\b", r"\bhome ?office\b")
REASON_OUT_OF_ZONE = f"hors zone {ZONE_LABEL}"


def _in_zone(text: str) -> bool:
    return any(re.search(p, text) for p in ZONE_PATTERNS)


def zone_status(offer: dict) -> tuple[str, str]:
    """Statut lié à la zone de recherche -> (statut, raison).

    Le champ `location` fait foi. S'il est vide, on regarde le titre (beaucoup d'annonces
    mettent la ville dans le titre). Localisation absente et introuvable ailleurs : uncertain,
    on ne rejette pas sur une info manquante.
    """
    loc = _norm(offer.get("location"))
    if loc:
        if _in_zone(loc):
            return ELIGIBLE, f"zone OK ({ZONE_LABEL})"
        if any(re.search(p, loc) for p in REMOTE_PATTERNS):
            return UNCERTAIN, f"télétravail sans zone précisée ({offer.get('location')!r})"
        return INELIGIBLE, f"{REASON_OUT_OF_ZONE} : {offer.get('location')!r}"
    title = _norm(offer.get("title"))
    if _in_zone(title):
        return ELIGIBLE, f"zone OK d'après le titre ({ZONE_LABEL})"
    return UNCERTAIN, f"localisation inconnue : {offer.get('location')!r}"


# --- Notes (avertissements sans effet sur le statut) ---------------------

NOTE_UNKNOWN_COMPANY = "⚠️ Entreprise non identifiée — vérifier"
NOTE_ALTERNANCE_PAUSED = "⏸️ Alternance : recherche en pause (reprise en janvier 2027 pour la M1/M2)"


def offer_notes(offer: dict) -> list:
    """Avertissements à afficher avec l'offre. Ne rejette rien : ces offres restent à vérifier.

    Entreprise absente : souvent une annonce d'école / d'organisme de formation qui ne nomme
    pas l'école (sinon elle serait rejetée par partner_school_match).
    """
    notes = []
    if not str(offer.get("company") or "").strip():
        notes.append(NOTE_UNKNOWN_COMPANY)
    return notes


# --- Vérification ----------------------------------------------------------

def _matches_contract(profile: Profile, contract_type) -> bool:
    ct = _norm(contract_type)
    return any(re.search(rf"\b{re.escape(t)}\b", ct) for t in profile.contract_terms)


def _fmt(n: float) -> str:
    return f"{n:g}"


def check(offer: dict, profile: Profile) -> EligibilityResult:
    res = EligibilityResult(profile.name, ELIGIBLE)

    school = partner_school_match(offer)
    if school:
        res._downgrade(REJECTED, f"{REASON_PARTNER_SCHOOL} ({school!r})")
        return res

    if not _matches_contract(profile, offer.get("contract_type")):
        res._downgrade(INELIGIBLE, f"type de contrat incompatible : {offer.get('contract_type')!r}")
        return res

    # Zone de recherche (une seule zone : Toulouse et alentours)
    z_status, z_reason = zone_status(offer)
    if z_status == ELIGIBLE:
        res.reasons.append(z_reason)
    else:
        res._downgrade(z_status, z_reason)

    # Date de début
    start = parse_date(offer.get("start_date"))
    if start is None:
        res._downgrade(UNCERTAIN, f"date de début inconnue ou illisible : {offer.get('start_date')!r}")
    elif start == "asap":
        if not profile.asap_ok:
            res._downgrade(UNCERTAIN, "début 'dès que possible' : année de début non garantie")
    else:
        if profile.start_before and start >= profile.start_before:
            res._downgrade(INELIGIBLE, f"début {start} pas avant {profile.start_before}")
        if profile.start_year and start.year != profile.start_year:
            res._downgrade(INELIGIBLE, f"début {start} hors année {profile.start_year}")
        if profile.preferred_start:
            lo = profile.preferred_start - timedelta(days=profile.preferred_tolerance_days)
            hi = profile.preferred_start + timedelta(days=profile.preferred_tolerance_days)
            if not (lo <= start <= hi):
                res._downgrade(UNCERTAIN,
                               f"début {start} éloigné du {profile.preferred_start} (date modifiable)")

    # Durée
    if profile.min_months is not None or profile.max_months is not None:
        dur, src = offer_duration(offer)
        if dur is None:
            res._downgrade(UNCERTAIN, "durée non précisée")
        else:
            lo, hi = dur
            wanted = (f"{_fmt(profile.min_months)} mois" if profile.min_months == profile.max_months
                      else f"{_fmt(profile.min_months)}-{_fmt(profile.max_months)} mois")
            # Arrondi au mois : 11.9 mois déduits des dates comptent pour 12
            lo_r, hi_r = round(lo), round(hi)
            hard_max = profile.conditional_max_months or profile.max_months
            if hard_max is not None and lo_r > hard_max:
                res._downgrade(INELIGIBLE, f"{src} > {_fmt(hard_max)} mois")
            elif profile.min_months is not None and hi_r < profile.min_months:
                res._downgrade(INELIGIBLE, f"{src} < {wanted}")
            elif profile.max_months is None or lo_r <= profile.max_months:
                res.reasons.append(f"{src} compatible ({wanted})")
            elif accepts_bac3(offer):
                res.reasons.append(f"{src} > {wanted} mais Bac+3 / L3 / poursuite Master acceptée")
            else:
                res._downgrade(UNCERTAIN, f"{src} > {wanted} sans mention Bac+3 : à vérifier")

    # Rémunération
    if profile.reject_unpaid and is_unpaid(offer):
        res._downgrade(INELIGIBLE, "stage explicitement non rémunéré")

    if res.status == ELIGIBLE and not res.reasons:
        res.reasons.append("contrat et dates compatibles")
    return res


def paused_profile_for(offer: dict) -> Profile | None:
    """Profil en pause dont le type de contrat correspond (sert à expliquer le rejet)."""
    for p in PROFILES:
        if not p.active and _matches_contract(p, offer.get("contract_type")):
            return p
    return None


def matches_active_contract(offer: dict) -> bool:
    """True si le type de contrat de l'offre correspond à au moins un profil actif."""
    return any(_matches_contract(p, offer.get("contract_type")) for p in ACTIVE_PROFILES)


def check_all(offer: dict, include_paused: bool = False) -> list[EligibilityResult]:
    """Évaluation par les profils actifs (par défaut).

    include_paused=True rejoue aussi les profils en pause (diagnostic, tests).
    """
    profiles = PROFILES if include_paused else ACTIVE_PROFILES
    return [check(offer, p) for p in profiles]


def is_eligible(offer: dict, include_uncertain: bool = True) -> bool:
    """True si l'offre passe au moins un profil actif."""
    ok = {ELIGIBLE, UNCERTAIN} if include_uncertain else {ELIGIBLE}
    return any(r.status in ok for r in check_all(offer))
