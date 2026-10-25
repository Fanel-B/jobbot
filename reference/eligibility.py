"""Filtre d'éligibilité des offres selon des profils de recherche datés.

PROFILE_STAGE_2027  (ACTIF) :
    stage débutant en 2027, visé au 29/03/2027 (modifiable : un début à plus de
    ~2 mois de cette date reste en "uncertain", il n'est pas rejeté).
    **La date de fin commande tout** (révision du 22/10/2026) : rentrée de Master en septembre
    2027, donc fin impérative au 31/07/2027. Durée minimale 14 semaines — seule borne de durée
    fermée (3 jours de moins => ineligible). Entre 14 semaines et 5 mois => éligible, avec le
    drapeau « durée courte, acceptable » en dessous de 4 mois. Au-delà de 5 mois, la durée ne
    tranche plus : `fin_de_stage()` classe la fin calculée en quatre paliers (31/07 = rien à
    négocier ; août = « dépasse de N semaines, à négocier » ; septembre-octobre = « nécessite de
    raccourcir », malus de classement ; après le 31/10 = ineligible).
    Stage explicitement non rémunéré => ineligible.
PROFILE_ALTERNANCE_2026  (⏸️ EN PAUSE) :
    alternance / apprentissage / professionnalisation, 12 à 24 mois.
    Recherche suspendue : la L3 se termine par un stage, l'alternance est reportée
    à la M1/M2 (reprise de la recherche en janvier 2027). Profil conservé pour ne pas
    réécrire les règles, mais `active=False` : il n'est plus appliqué, donc toute offre
    alternance sort en "rejected" avec une note explicative.

Zone géographique : une seule zone de recherche, Toulouse et alentours, déclarée dans `faits.ZONE`
(`ZONE_PATTERNS` est construit à partir d'elle). Hors zone => ineligible. Localisation absente =>
uncertain.

Type de contrat : le champ `contract_type` fait foi. S'il est **vide**, les termes sont cherchés
dans le titre puis dans la description (règle du 22/10/2026) ; introuvables partout, l'offre est
`uncertain` — une information absente n'est pas un critère violé. `check()` n'interrompt plus
l'évaluation : les autres critères sont toujours examinés, pour que la raison soit complète.

Chaque vérification renvoie un statut :
    "eligible"   : toutes les conditions sont vérifiées
    "ineligible" : au moins une condition est violée
    "uncertain"  : rien de violé mais une info manque (date, durée, zone, contrat) -> à vérifier
    "rejected"   : école / CFA partenaire imposé explicitement (tous profils)

Champs de l'offre lus : contract_type, start_date, end_date, duration, location,
remuneration, salary, description, title, education_required.
"""

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta

from faits import ZONE  # noqa: F401  (re-exporté : `faits.ZONE` est la source de la zone)
import faits


ELIGIBLE, INELIGIBLE, UNCERTAIN, REJECTED = "eligible", "ineligible", "uncertain", "rejected"

# Libellés lisibles des champs où l'on cherche le type de contrat (raisons affichées à Fanel).
LIBELLE_CHAMP_CONTRAT = {"contract_type": "le champ contract_type", "title": "le titre",
                         "description": "la description"}


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
    # Au-delà de la borne dure : « à vérifier » si l'annonce accepte un Bac+3, écartée sinon.
    # Vrai pour la recherche de stage (règle du 22/10/2026) ; faux pour l'alternance, où un
    # contrat de 36 mois n'est pas une alternance qu'on vérifie, il est hors sujet.
    over_max_uncertain_with_bac3: bool = False
    preferred_start: date | None = None  # date de début visée (écart -> uncertain, pas rejeté)
    preferred_tolerance_days: int = 61   # ± tolérance autour de preferred_start
    # Durée minimale en semaines (14 pour un stage : plusieurs programmes, dont ceux d'Airbus,
    # sont calibrés à cette durée). Exprimée en semaines pour rester exacte — 14 semaines ne font
    # pas 3,5 mois pile.
    min_semaines: float | None = None
    # Fenêtre de fin : les seuils sont lus dans `faits.STAGE['fin_paliers']`. Le critère qui
    # commande tout est la date de fin (rentrée de Master en septembre 2027), pas la durée.
    fin_compatible: date | None = None   # fin jusqu'ici : rien à négocier
    fin_negociation: date | None = None  # palier suivant : drapeau « à négocier », sans malus
    fin_raccourcir: date | None = None   # palier suivant : drapeau + malus ; au-delà, écartée


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
    # Durée lue dans `faits.STAGE` : une seule déclaration pour le filtre, le CV, la lettre et le
    # pitch (règle du 22/10/2026). Cible 4 à 6 mois ; au-delà, « à vérifier » si Bac+3 est accepté.
    min_months=faits.STAGE["duree_min"],
    min_semaines=faits.STAGE["duree_min_semaines"],
    max_months=faits.STAGE["duree_max"],
    reject_unpaid=True,
    over_max_uncertain_with_bac3=True,
    preferred_start=date.fromisoformat(faits.STAGE["debut_iso"]),
    fin_compatible=date.fromisoformat(faits.STAGE["fin_paliers"]["compatible"]),
    fin_negociation=date.fromisoformat(faits.STAGE["fin_paliers"]["negociation"]),
    fin_raccourcir=date.fromisoformat(faits.STAGE["fin_paliers"]["raccourcir"]),
)

PROFILES = (PROFILE_ALTERNANCE_2026, PROFILE_STAGE_2027)
ACTIVE_PROFILES = tuple(p for p in PROFILES if p.active)



@dataclass
class EligibilityResult:
    profile: str
    status: str
    reasons: list = field(default_factory=list)
    # Drapeaux non bloquants, affichés à Fanel (« dépasse de N semaines, à négocier »,
    # « durée courte (14 semaines), acceptable ») : une offre signalée reste candidatable.
    flags: list = field(default_factory=list)

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
# Une seule déclaration : la liste des communes vit dans `faits.ZONE`, les expressions régulières
# sont construites ici. `faits.py` et `eligibility.py` ne peuvent donc plus se contredire
# (règle du 22/10/2026 : la source unique se lit, elle ne se recopie pas).


def _motif_zone(terme: str) -> str:
    """Motif d'une commune : « haute-garonne » reconnaît aussi « haute garonne »."""
    corps = re.escape(_norm(terme)).replace(r"\-", r"[-\s]?")
    return rf"\b{corps}\b"


ZONE_LABEL = faits.ZONE["libelle"]
ZONE_PATTERNS = tuple([_motif_zone(v) for v in faits.ZONE["villes"]] + [
    # Libellés France Travail « 31 - Commune » et codes postaux 31xxx : Haute-Garonne entière.
    r"\b31\s*-\s*[a-z]", r"\b31\d{3}\b",
])
REMOTE_PATTERNS = (r"\bteletravail\b", r"\bremote\b", r"\ba distance\b", r"\bhome ?office\b")
REASON_OUT_OF_ZONE = f"hors zone {ZONE_LABEL}"
# Régions qui *contiennent* la zone de recherche. Une annonce localisée « Occitanie » seule n'est ni
# dans la zone (Montpellier y est aussi) ni hors zone (Toulouse y est) : la rejeter reviendrait à
# jeter une offre toulousaine possible sur une information manquante. On la garde à vérifier.
# La règle ne vaut que si **aucune ville** n'est nommée : « Rodez, Occitanie » ou
# « Montpellier, Occitanie » nomment une ville précise, hors zone, et restent inéligibles.
# Sans cette règle, l'alerte Safran ne rend rien : ses mails ne donnent que la région (21/10/2026).
REGIONS_QUI_CONTIENNENT_LA_ZONE = tuple(_motif_zone(r) for r in faits.ZONE["regions_englobantes"])
MOTS_SANS_VILLE = re.compile(
    r"\b(?:occitanie|france|franche|region|regions|metropole|hors|remote|fr)\b|[^a-z0-9]+")


def _reste_une_ville(loc: str) -> bool:
    """Vrai s'il reste autre chose que la région et le pays après retrait des mots génériques.

    « Occitanie » -> False (lieu régional seul) · « Occitanie, France » -> False ·
    « Rodez, Occitanie » -> True (la ville est nommée, donc on sait où c'est).
    """
    return bool(re.sub(r"\s+", "", MOTS_SANS_VILLE.sub(" ", loc)).strip())


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
        if any(re.search(p, loc) for p in REGIONS_QUI_CONTIENNENT_LA_ZONE) and not _reste_une_ville(loc):
            return UNCERTAIN, (f"lieu au niveau régional seulement ({offer.get('location')!r}) : "
                               f"{ZONE_LABEL} possible, ville à vérifier sur l'annonce")
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

def _terme_contrat(profile: Profile, value) -> str | None:
    """Terme de contrat du profil présent dans un texte, ou None."""
    texte = _norm(value)
    for t in profile.contract_terms:
        if re.search(rf"\b{re.escape(t)}\b", texte):
            return t
    return None


def _matches_contract(profile: Profile, contract_type) -> bool:
    return _terme_contrat(profile, contract_type) is not None


def _fmt(n: float) -> str:
    return f"{n:g}"


def check(offer: dict, profile: Profile) -> EligibilityResult:
    res = EligibilityResult(profile.name, ELIGIBLE)

    # École / CFA partenaire imposé : rejet définitif, mais on continue l'évaluation pour que la
    # raison affichée soit complète (règle du 22/10/2026 : plus aucune sortie anticipée).
    school = partner_school_match(offer)
    if school:
        res._downgrade(REJECTED, f"{REASON_PARTNER_SCHOOL} ({school!r})")

    # Type de contrat. Le champ déclaré fait foi. Quand il est **vide**, on le cherche dans le titre
    # puis dans la description : beaucoup d'annonces annoncent « Stage » dans leur titre et laissent
    # le champ vide. Une information absente n'est pas un critère violé -> `uncertain`, jamais
    # `ineligible`. Et la fonction ne s'interrompt plus : les autres critères sont toujours évalués.
    declare = str(offer.get("contract_type") or "").strip()
    champ = terme = None
    if not declare:
        for nom_champ in ("title", "description"):
            terme = _terme_contrat(profile, offer.get(nom_champ))
            if terme:
                champ = nom_champ
                break
    if declare and _matches_contract(profile, declare):
        pass
    elif champ:
        res.reasons.append(f"contrat lu dans {LIBELLE_CHAMP_CONTRAT[champ]} ({terme!r})")
    elif declare:
        res._downgrade(INELIGIBLE, f"type de contrat incompatible : {declare!r}")
    else:
        res._downgrade(UNCERTAIN, "type de contrat inconnu : champ vide, et ni le titre ni la "
                                  "description ne nomment ce contrat")

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
            lo_w, hi_w = lo * SEMAINES_PAR_MOIS, hi * SEMAINES_PAR_MOIS
            lo_r, hi_r = round(lo), round(hi)   # arrondi au mois (profil alternance)
            hard_max = profile.conditional_max_months or profile.max_months
            # Seule borne de durée réellement fermée : moins de 14 semaines (décision du
            # 22/10/2026). Comparaison en semaines : 14 semaines ne font pas 3,5 mois pile.
            if profile.min_semaines is not None and hi_w < profile.min_semaines:
                res._downgrade(INELIGIBLE, f"{src} < {profile.min_semaines:.0f} semaines ({wanted})")
            elif profile.min_semaines is None and profile.min_months is not None and hi_r < profile.min_months:
                res._downgrade(INELIGIBLE, f"{src} < {wanted}")
            elif profile.max_months is None or lo <= profile.max_months:
                res.reasons.append(f"{src} compatible ({wanted})")
                if profile.min_months is not None and lo < profile.min_months:
                    res.flags.append(f"durée courte ({lo_w:.0f} semaines), acceptable")
            elif profile.over_max_uncertain_with_bac3:
                # Au-delà de la durée maximale (5 mois), ce n'est plus la durée qui tranche :
                # la date de fin décide (critère dédié ci-dessous). On note l'écart, sans rejeter.
                res.reasons.append(f"{src} > {wanted} : la date de fin décide")
            elif hard_max is not None and lo_r > hard_max:
                res._downgrade(INELIGIBLE, f"{src} > {_fmt(hard_max)} mois")
            elif accepts_bac3(offer):
                # Bande conditionnelle (13-24 mois d'un profil alternance) : le Bac+3 sauve la mise.
                res.reasons.append(f"{src} > {wanted} mais Bac+3 / L3 / poursuite Master acceptée")
            else:
                res._downgrade(UNCERTAIN, f"{src} > {wanted} sans mention Bac+3 : à vérifier")

    # Date de fin : le critère qui commande tout (22/10/2026). Une annonce plus longue que la
    # fenêtre reste candidatable — l'écart est affiché, et au-delà d'août il est pénalisé au
    # classement (`scoring.FIN_TARDIVE_MALUS`) pour qu'elle ne dépasse jamais une offre qui tient.
    if profile.fin_compatible:
        fin = fin_de_stage(offer, profile)
        if fin.fin is not None and fin.palier == PALIER_FIN_HORS_PORTEE:
            res._downgrade(INELIGIBLE, fin.drapeau)
        elif fin.drapeau:
            res.reasons.append(fin.drapeau)
            res.flags.append(fin.drapeau)
        elif fin.fin is not None:
            res.reasons.append(f"fin {fin.fin:%d/%m/%Y} : dans la fenêtre")

    # Rémunération
    if profile.reject_unpaid and is_unpaid(offer):
        res._downgrade(INELIGIBLE, "stage explicitement non rémunéré")

    if res.status == ELIGIBLE and not res.reasons:
        res.reasons.append("contrat et dates compatibles")
    return res


SEMAINES_PAR_MOIS = 4.345
PALIER_FIN_COMPATIBLE = "compatible"
PALIER_FIN_NEGOCIATION = "negociation"
PALIER_FIN_RACCOURCIR = "raccourcir"
PALIER_FIN_HORS_PORTEE = "hors_portee"


@dataclass
class FinStage:
    """Fin calculée d'un stage et son palier dans la fenêtre de Fanel."""
    fin: date | None
    # Pas de palier par défaut : `FinStage(None)` est une **absence** de calcul (début ou durée
    # inconnus), pas une fin compatible. Un défaut « compatible » ferait lire « rien à négocier »
    # à qui oublie de tester `fin` — le portage TypeScript, lui, renvoie une chaîne vide ici.
    palier: str = ""
    depassement_semaines: int = 0
    drapeau: str = ""


def _ajouter_mois(d: date, mois: float) -> date:
    """Ajoute des mois (fractionnaires acceptés) à une date, sans dépendance externe."""
    return d + timedelta(days=int(round(mois * 30.4375)))


def fin_de_stage(offer: dict, profile: Profile | None = None) -> FinStage:
    """Date de fin du stage, et le palier de la fenêtre — le critère qui commande tout.

    La rentrée de Master de Fanel est en septembre 2027 : c'est la **fin** qui compte, pas la
    durée. Un stage de 4 mois démarrant en juin a une durée parfaitement conforme et finit en
    octobre — c'est ce cas que le critère de durée seul ne voyait pas.

    On prend la durée la plus **courte** annoncée par l'annonce : c'est la lecture sans écart,
    donc la plus favorable, et elle ne fabrique pas un dépassement que l'annonce ne demande pas.
    Quatre paliers : fin au 31/07 ou avant = rien à négocier ; août = drapeau « à négocier » ;
    septembre-octobre = drapeau « à raccourcir » + malus de classement ; après le 31/10 = hors de
    portée, l'offre est écartée.
    """
    p = profile or PROFILE_STAGE_2027
    if not (p.fin_compatible and p.fin_negociation and p.fin_raccourcir):
        return FinStage(None)
    debut = parse_date(offer.get("start_date"))
    if not isinstance(debut, date):
        # Début inconnu (ou « dès que possible ») : on ne fabrique pas une fin. Le critère de
        # durée parle, et l'incertitude sur le début est déjà signalée par ailleurs.
        return FinStage(None)
    dur, _src = offer_duration(offer)
    if not dur:
        return FinStage(None)
    fin = _ajouter_mois(debut, dur[0])
    if fin <= p.fin_compatible:
        return FinStage(fin, PALIER_FIN_COMPATIBLE)
    semaines = max(1, int(round((fin - p.fin_compatible).days / 7)))
    if fin <= p.fin_negociation:
        return FinStage(fin, PALIER_FIN_NEGOCIATION, semaines,
                        f"fin {fin:%d/%m/%Y} : dépasse de {semaines} semaine(s), à négocier")
    if fin <= p.fin_raccourcir:
        return FinStage(fin, PALIER_FIN_RACCOURCIR, semaines,
                        f"fin {fin:%d/%m/%Y} : nécessite de raccourcir de {semaines} semaine(s)")
    return FinStage(fin, PALIER_FIN_HORS_PORTEE, semaines,
                    f"fin {fin:%d/%m/%Y} au-delà du {p.fin_raccourcir:%d/%m/%Y} : hors de portée, "
                    "rien à négocier")


def contrat_inconnu(offer: dict, profile: Profile | None = None) -> bool:
    """Type de contrat introuvable partout : ni le champ, ni le titre, ni la description.

    Décision du 22/10/2026 : ces offres **restent** dans la base en `uncertain` (« à vérifier »,
    l'information manque, elle n'est pas contredite) mais **sortent des alertes** : sur les 127
    offres à champ vide de la base, aucune n'annonce un stage, et 76 d'entre elles auraient
    gonflé la liste quotidienne avec des CDI parisiens. Une alerte doit rester rare pour rester
    lue (argument de Fanel sur la notification immédiate).
    """
    p = profile or PROFILE_STAGE_2027
    for champ in ("contract_type", "title", "description"):
        if _terme_contrat(p, offer.get(champ)):
            return False
    return not str(offer.get("contract_type") or "").strip()


def est_stage(offer: dict, profile: Profile | None = None) -> bool:
    """Le contrat de stage est-il annoncé ? Champ déclaré, sinon titre, sinon description.

    Sert au critère de date de fin du scoring : la fenêtre du 31/07 concerne les stages, pas
    les alternances (profil en pause) ni les CDI. Offre sans aucune mention de stage : False —
    c'est alors `check()` qui décide, avec le statut « incertain » et non un malus.
    """
    p = profile or PROFILE_STAGE_2027
    for champ in ("contract_type", "title", "description"):
        if _terme_contrat(p, offer.get(champ)):
            return True
    return False


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
