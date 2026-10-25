"""Priorités de campagne : quelles offres attaquer, dans quel ordre, et pourquoi.

Trois systèmes de classement, tous **déterministes** (aucun score inventé) :

  1. `--systeme 1` — score qualité + fraîcheur      (ce que fait déjà `liste_attaque.py`)
  2. `--systeme 2` — adéquation par exigences        (chaque exigence de l'offre est confrontée aux
                                                      atouts réels de Fanel ; ce qui manque est listé)
  3. `--systeme 3` — trois axes pondérés             (cohérence 45 · fraîcheur 25 · accessibilité 15),
                                                     classe les offres pour la campagne en cours.
  4. `--systeme 4` — **le bulletin** : neuf critères notés et **tous affichés** — cohérence 30 ·
                                                     métier 12 · source 8 · fiche 6 · calendrier 8 ·
                                                     dépôt 6 · dossier 4 · diversité 14 ·
                                                     fraîcheur 12 — plus l'**urgence** (« expire
                                                     dans 1 j »), affichée mais jamais notée : elle
                                                     ordonne le message « dernier appel », pas le flux
                                                     du jour.
   À ces neuf critères s'ajoutent les **cinq ajustements** du 22/10/2026 (diplôme, prérequis
   métier, compétences hors référentiel, dates, **date de fin**) : ils sont additifs, leur ligne
   est affichée, et le total du bulletin reste la somme exacte de toutes les lignes.

Filtres appliqués dans tous les cas : stages uniquement (l'alternance est en pause), non rejetées,
publiées ou repérées depuis `--jours` jours (défaut 7). Trois étiquettes dans la sortie : à attaquer
maintenant, plus tard si l'offre demande de l'IA (mise de côté par décision du 18/10/2026), et déjà
postulé (registre local `candidatures_envoyees.json`, plus les doublons d'alerte écartés).

Usage :
    python3 priorites.py                       # système 3, 7 jours, top 15
    python3 priorites.py --systeme 1 --top 10
    python3 priorites.py --systeme 2 --jours 7
"""

import argparse
import json
import re
import sqlite3
import sys
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

# La lecture du registre des candidatures appartient à `candidatures.py` : le bulletin, le rapport
# quotidien et les alertes s'en servent, et une même règle écrite trois fois finit par diverger.
from candidatures import REGISTRE, charger as charger_registre, deja_postule as _partage  # noqa: E402

# (`_cle_texte`, utilisé plus bas pour le dédoublonnage, reste défini dans ce module : il sert à
# comparer deux intitulés entre eux, pas à lire le registre.)

sys.path.insert(0, str(Path(__file__).resolve().parent))

# Les quatre critères d'accessibilité (niveau de diplôme, prérequis métier, bloqueur administratif,
# dates) sont écrits **une seule fois**, dans le moteur de la base (`scoring.py`). Le bulletin les
# importe au lieu de les recopier : deux implémentations d'une même règle finissent toujours par
# diverger, et le site raconterait alors une autre histoire que la note de la base.
import scoring  # noqa: E402

DB = Path.home() / ".hermes" / "data" / "job-search" / "database.sqlite"

# Atouts réels de Fanel (profil + projets). Rien d'autre n'entre dans le calcul.
MES_ATOUTS = {
    "python": "Python", "javascript": "JavaScript", "react": "React", "next.js": "Next.js",
    "node.js": "Node.js", "node": "Node.js", "express": "Express", "java": "Java", "kotlin": "Kotlin",
    "php": "PHP", "sql": "SQL", "mysql": "MySQL", "postgresql": "PostgreSQL", "sqlite": "SQLite",
    "git": "Git", "github": "GitHub", "tailwind": "Tailwind", "power bi": "Power BI",
    "power query": "Power Query", "dax": "DAX", "pandas": "Pandas", "matplotlib": "Matplotlib",
    "excel": "Excel", "html": "HTML", "css": "CSS", "api rest": "API REST", "rest": "API REST",
    "javascript/typescript": "JavaScript", "json": "JSON", "scrum": "Scrum", "agile": "Agile",
    # Ajoutés le 20/10/2026 après la mise en ligne de JobBot V2 : c'est elle qui les prouve.
    # TypeScript n'était plus « en cours » depuis PortfolioV2 ; JobBot V2 (site rendu en
    # TypeScript, moteur de scoring porté de Python, 88 tests) en fait une vraie preuve.
    "typescript": "TypeScript", "tests unitaires": "tests unitaires", "vitest": "Vitest",
}
# Familles : une exigence proche compte comme couverte (SQL ↔ MySQL/PostgreSQL/SQLite…).
FAMILLES = {
    "sql": ("mysql", "postgresql", "sqlite", "requêtes sql", "bases de données"),
    "power bi": ("power query", "dax", "tableaux de bord"),
    "javascript": ("react", "node", "next.js", "html", "css", "express"),
    "python": ("pandas", "matplotlib", "scripts python"),
    "excel": ("tableur", "tableaux croisés", "vba"),
}
# Vocabulaire technique cherché dans l'offre (pour savoir ce qui est exigé, y compris hors de son profil).
VOCABULAIRE = (
    "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express", "Java", "Kotlin",
    "PHP", "C++", "C#", ".NET", "SQL", "MySQL", "PostgreSQL", "SQLite", "Power BI", "Power Query",
    "DAX", "Pandas", "Matplotlib", "Excel", "VBA", "Docker", "Kubernetes", "AWS", "Azure", "GCP",
    "Spark", "Fabric", "Snowflake", "Talend", "Git", "Linux", "HTML", "CSS", "Tailwind", "REST",
    "API", "JWT", "tests unitaires", "Scrum", "Agile", "UML", "PowerShell", "Bash", "ML", "IA",
    "intelligence artificielle", "IA générative", "IA generative", "LLM", "NLP", "modèles de langage",
    "réseaux de neurones", "data science", "machine learning", "deep learning", "data visualisation",
    "ETL", "Power Platform", "SharePoint", "SAP", "ServiceNow", "AWS Glue", "Jenkins", "Ansible",
    "Terraform", "Qlik", "Tableau",
)
# Métiers visés par Fanel (profil : « Full Stack Dev ou Data Analyst ») et ce qui s'en approche.
# Chaque famille : (libellé, mots-clés). Le titre pèse double : c'est lui qui annonce le poste.
METIERS = (
    ("développement full stack", ("developpeur", "developpeuse", "developpement", "full stack", "fullstack",
                                  "web", "logiciel", "application", "front-end", "back-end", "backend")),
    ("data / analyse", ("data", "donnees", "business intelligence", "analytics", "reporting", "dashboard",
                        "visualisation", "power bi", "statistique", "tableaux de bord")),
    ("tests / validation", ("test", "ivvq", "validation", "verification", "qualification", "ivq")),
    ("gestion de projet", ("gestion de projet", "coordination", "planning", "pmo", "assistant a la")),
    ("systèmes embarqués", ("embarque", "temps reel", "fpga", "microcontroleur", "assembleur", "c++")),
    ("industrie / mécanique", ("mecanique", "industriel", "industrialisation", "production", "fournisseurs",
                               "logistique", "acoustique", "thermique")),
)
POINTS_METIER = {"développement full stack": 15, "data / analyse": 15, "tests / validation": 9,
                 "gestion de projet": 6, "systèmes embarqués": 3, "industrie / mécanique": 2}

# Coût de dépôt : combien de temps le formulaire prend. Sert à séquencer quand Fanel a peu de temps.
DEPOTS = (
    (2, ("myworkdayjobs", "workday", "taleo", "successfactors", "njoyn", "cgi.com"), "compte + 8 étapes"),
    (4, ("recrutement.cnes", "sii-group", "emploi.sncf", "soprasteria"), "portail du site carrière"),
    (5, ("smartrecruiters", "greenhouse", "lever.co", "recruitee", "teamtailor"), "formulaire court"),
    (3, ("linkedin.com", "indeed"), "alerte — il faut retrouver l'offre d'origine"),
)
# Plafond par groupe. **Retiré le 21/10/2026 sur demande de Fanel** (« on s'en fout du plafond, enlève-moi
# les plafonds »). Historique : il limitait à 3 le nombre d'offres d'un même groupe dans le haut de liste,
# après sa remarque du 18/10 (« la quantité dans un même groupe n'est pas très bien »). Le critère
# « diversité » reste affiché et vaut donc 14/14 pour tout le monde : le bulletin garde ses neuf critères,
# mais plus aucune offre n'est abaissée à cause de son groupe. Pour le rétablir : remettre 3.
PLAFOND_GROUPE = None
GROUPES = {
    "airbus": "Airbus (et Airbus Protect, ATR, Atlantic)",
    "atr": "Airbus (et Airbus Protect, ATR, Atlantic)",
    "thales": "Thales (et Thales Alenia Space)",
    "capgemini": "Capgemini",
    "sopra": "Sopra Steria",
    "sii": "Groupe SII",
    "atos": "Atos",
    "cnes": "CNES",
    "wienerberger": "wienerberger",
    "rte": "RTE",
}

# Domaines d'ATS / sites carrière : on peut y vérifier l'offre et y postuler proprement.
ATS_VERIFIABLES = ("myworkdayjobs", "smartrecruiters", "greenhouse", "lever.co", "recruitee",
                   "teamtailor", "njoyn", "taleo", "successfactors", "cegid", "welcometothejungle",
                   "sii-group", "recrutement.cnes", "soprasteria", "jobs.airbus")
FUITE_TARD = ("asap", "immediat")
# Exigences qui, pour l'instant, mettent une offre de côté : Fanel a décidé de laisser l'IA de
# côté jusqu'à ce que son propre projet IA existe (décision du 18/10/2026).
TERMES_IA = ("IA", "intelligence artificielle", "IA générative", "IA generative", "LLM", "NLP",
             "modèles de langage", "réseaux de neurones", "machine learning", "deep learning",
             "data science", "ML")
# Lien mission ↔ projet : c'est ce qui donne une candidature crédible (et une lettre qui tient debout).
PROJETS = (
    ("TechScope — pipeline Python de détection d'anomalies (12 anomalies sur 113 lignes)",
     ("anomalie", "détection", "logs", "qualité de données", "data quality", "pipeline", "fiabilité",
      "investigation", "surveillance", "monitoring")),
    ("Biblio-Tech — application web full stack (Next.js, Node, API, JWT, IoT simulé)",
     ("web", "front", "react", "next", "javascript", "application", "interface", "api", "full stack",
      "fullstack", "développement logiciel", "site")),
    # Ajouté le 20/10/2026 : JobBot V2 est en ligne. Ce qui le rend crédible sur une offre, ce n'est
    # pas « un site », c'est le TypeScript, le portage d'un moteur Python et les tests qui le tiennent.
    ("JobBot V2 — site Next.js/TypeScript, moteur de scoring porté de Python, 88 tests, PostgreSQL",
     ("typescript", "tests", "test unitaire", "postgresql", "déploiement", "mise en production",
      "modèle de données", "algorithme", "veille", "collecte", "automatisé", "qualité de code")),
    ("Analyse Insertion Pro MIAGE — analyse de données emploi, tableaux de bord",
     ("données", "data", "tableaux de bord", "dashboard", "power bi", "analyse", "statistique",
      "reporting", "kpi", "indicateurs", "visualisation")),
    ("Générateur de documents / automatisation (scripts Python, traitement de fichiers)",
     ("automatisation", "automatiser", "script", "traitement de données", "extraction", "génération")),
)


def _norm(txt: str) -> str:
    txt = unicodedata.normalize("NFKD", (txt or "").lower())
    return "".join(c for c in txt if not unicodedata.combining(c))


def _exigences(offre) -> list:
    """Technos réellement citées par l'offre (titre + description + compétences listées).

    Correspondance **mot entier** obligatoire : sans ça, « IA » matchait « sp**atia**l »,
    « GIT » matchait « di**git**al » et « SQL » matchait « My**SQL** » — le classement était faussé
    (défaut corrigé le 18/10/2026).
    """
    texte = _norm(" ".join(str(offre[k] or "") for k in
                           ("title", "description", "skills_required", "skills_optional")))
    trouvees = []
    for mot in VOCABULAIRE:
        motif = r"(?<![a-z0-9])" + re.escape(_norm(mot)) + r"(?![a-z0-9])"
        if re.search(motif, texte) and mot not in trouvees:
            trouvees.append(mot)
    return trouvees


def _couverte(exigence: str) -> str | None:
    """Renvoie le nom de l'atout qui couvre cette exigence, sinon None.

    Les clés courtes (« ml », « ia », « sql ») se comparent **en mot entier**. Sans cela « ml » est
    « couvert » par HTML — le « ml » de HT**ML** — et une annonce qui demande du machine learning
    s'affiche comme une compétence maîtrisée : faux positif mesuré le 25/10/2026 sur #795, #817 et
    #921, qui affichaient ✅ face à « ML » sur une page publique.
    """
    e = exigence.lower().strip()

    def couvre(cle: str) -> bool:
        if cle == e:
            return True
        if " " in cle:                      # « power bi », « api rest » : la clé est une locution
            return cle in e or e in cle
        # Mot entier, dans les deux sens : « ml » ne doit pas être absorbé par HT«ml», ni « java »
        # par JavaScript. C'est la règle sûre, et elle n'enlève aucune couverture réelle.
        return (re.search(rf"(?<![a-z0-9]){re.escape(cle)}(?![a-z0-9])", e) is not None
                or re.search(rf"(?<![a-z0-9]){re.escape(e)}(?![a-z0-9])", cle) is not None)

    for cle, nom in MES_ATOUTS.items():
        if couvre(cle):
            return nom
    for cle, proches in FAMILLES.items():
        if any(p in e for p in (cle, *proches)):
            nom = MES_ATOUTS.get(cle)
            if nom:
                return f"{nom} (famille)"
    return None


def _projet(titre: str, description: str) -> str | None:
    texte = _norm(f"{titre} {description}")
    for nom, mots in PROJETS:
        if any(_norm(m) in texte for m in mots):
            return nom
    return None


def _jours(offre, now) -> float:
    """Ancienneté en jours. En base, `published_at` est tantôt complet, tantôt une simple date.

    `now` peut porter un fuseau ou non : `classer()` échouait avec un `TypeError` quand un appelant
    passait un datetime conscient (constaté le 24/10/2026), parce que les dates lues en base sont
    naïves. On ramène l'instant à un UTC naïf, ce que fait déjà `main()`.
    """
    if now.tzinfo is not None:
        now = now.astimezone(timezone.utc).replace(tzinfo=None)
    d = (offre["published_at"] or offre["first_seen_at"] or "")[:19]
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return max(0.0, (now - datetime.strptime(d[:len(fmt) + 2].strip(), fmt))
                       .total_seconds() / 86400.0)
        except ValueError:
            continue
    return 99.0


def _fraicheur(jours: float) -> int:
    return 25 if jours <= 1 else 22 if jours <= 2 else 19 if jours <= 3 else 15 if jours <= 5 \
        else 10 if jours <= 7 else 0


def _duree_mois(offre) -> float | None:
    m = re.search(r"(\d+)\s*mois", _norm(offre["duration"] or ""))
    return float(m.group(1)) if m else None


def _accessibilite(offre) -> tuple:
    points, raisons = 0, []
    mois = _duree_mois(offre)
    if mois is None:
        points += 2                      # durée inconnue : on ne pénalise pas, mais c'est à vérifier
    elif mois >= 10:
        raisons.append(f"⚠️ durée {int(mois)} mois, inhabituelle pour un stage")
    elif mois >= 4:
        points += 6
        raisons.append(f"durée {int(mois)} mois ✓")
    else:
        raisons.append(f"durée {int(mois)} mois ✗ (< 4 mois, non conventionnable)")
    if any(v in _norm(offre["location"] or "") for v in ("toulouse", "blagnac", "labege", "colomiers",
                                                        "saint-martin", "haute-garonne", "31")):
        points += 5
        raisons.append("Toulouse et alentours")
    if offre["miage_mentioned"]:
        points += 2
        raisons.append("MIAGE cité")
    if offre["source"] and offre["source"] not in ("linkedin", "indeed", "email"):
        points += 2
        raisons.append(f"source directe ({offre['source']})")
    return min(15, points), raisons


def _metier(o) -> tuple:
    """Famille de métier de l'offre (le titre pèse double). Sert à mesurer l'alignement avec les
    deux postes visés par Fanel : Full Stack Dev et Data Analyst."""
    titre, desc = _norm(o.get("title") or ""), _norm(o.get("description") or "")
    scores = {}
    for libelle, mots in METIERS:
        scores[libelle] = sum(2 for m in mots if _norm(m) in titre) + sum(1 for m in mots if _norm(m) in desc)
    libelle = max(scores, key=lambda k: (scores[k], -[l for l, _m in METIERS].index(k)))
    if scores[libelle] == 0:
        return None, 0
    return libelle, POINTS_METIER.get(libelle, 0)


def _fiabilite_source(o) -> tuple:
    """Peut-on vérifier l'offre et postuler proprement ? Site carrière de l'entreprise > agrégateur
    > alerte LinkedIn (que nos serveurs ne peuvent même pas ouvrir : réponse 999)."""
    url = (o.get("canonical_url") or "").lower()
    source = (o.get("source") or "").lower()
    if any(d in url for d in ATS_VERIFIABLES):
        return 12, "site carrière vérifiable"
    if source in ("linkedin", "indeed") or "linkedin.com" in url:
        return 3, "alerte non vérifiable"
    return 7, f"source {source or 'inconnue'}"


def _qualite_fiche(o) -> tuple:
    """La fiche est-elle exploitable ? Sans description, ni CV ni lettre ne peuvent être ajustés
    sérieusement — il faut ouvrir la page avant de postuler."""
    desc = o.get("description") or ""
    exigs = _exigences(o)
    if len(desc) >= 500 and len(exigs) >= 2:
        return 10, f"fiche complète ({len(exigs)} technos)"
    if len(desc) >= 200:
        return 6, "fiche partielle"
    return 2, "fiche vide — ouvrir la page avant de postuler"


def _calendrier(o) -> tuple:
    """Compatibilité avec la disponibilité de Fanel : il est en cours jusqu'à fin mars 2027.
    Un stage qui démarre en décembre, janvier ou février n'est pas prenable, même parfait."""
    debut = _norm(o.get("start_date") or "")
    if not debut or any(f in debut for f in FUITE_TARD):
        return 4, "date de début inconnue — à confirmer"
    mois = re.match(r"(20\d\d)-(\d\d)", debut)
    if not mois:
        return 4, f"date de début « {o.get('start_date')} » à confirmer"
    annee, m = int(mois.group(1)), int(mois.group(2))
    if (annee, m) < (2027, 3):
        return 0, f"⚠️ démarre le {o.get('start_date')} — tu es encore en cours"
    if (annee, m) <= (2027, 9):
        return 10, f"début {o.get('start_date')} compatible"
    return 6, f"début {o.get('start_date')} tardif pour la rentrée M1"


def _groupe(o) -> str:
    """Groupe d'entreprises : Airbus regroupe Airbus, Airbus Protect, ATR et Atlantic ; Thales
    regroupe Thales et Thales Alenia Space. Sert au plafond par groupe."""
    nom = _cle_texte(o.get("company"))
    for cle, groupe in GROUPES.items():
        if cle in nom:
            return groupe
    return nom or "?"


def _urgence(o, jours: float) -> tuple:
    """Jours restants avant que l'offre sorte de la fenêtre de candidature de Fanel (7 jours).

    **Affiché, jamais noté** : l'urgence sert à ordonner le message « dernier appel », pas le flux
    du jour. Notée, elle ferait remonter les vieilles offres devant les nouvelles — exactement ce
    que Fanel ne veut pas.
    """
    reste = 7.0 - jours
    if reste <= 1:
        return f"⏳ dernier appel : expire dans {max(reste, 0):.0f} j"
    if reste <= 2:
        return f"⏳ expire dans {reste:.0f} j"
    return f"fenêtre : {reste:.0f} j restants"


def _cout_depot(o) -> tuple:
    """Temps de dépôt estimé selon l'ATS. Un dossier à 5 minutes se fait dans une pause ; un
    Workday à 8 étapes demande une vraie demi-heure."""
    url = (o.get("canonical_url") or "").lower()
    for points, motif, libelle in DEPOTS:
        if any(m in url for m in motif):
            return points, libelle
    return 4, "formulaire du site"


def _dossier_pret(o, actions: dict) -> tuple:
    """Où en est **notre** travail sur cette offre : préparée, CV généré… Un dossier à moitié fait
    coûte moins cher à finir que de partir de zéro (critère ajouté le 18/10/2026, encore vide en
    base : 2 offres seulement ont une action enregistrée)."""
    n = actions.get(o.get("id"), 0)
    if n >= 2:
        return 4, "dossier déjà bien avancé"
    if n == 1:
        return 2, "dossier entamé"
    return 0, "rien de fait"


# Plafond administratif : même valeur que `scoring.PLAFOND_ADMIN`. Une offre bloquée (habilitation,
# secret défense, nationalité…) ne peut dépasser 55/100, **dans aucun des quatre systèmes** : une
# offre impossible ne doit arriver en tête d'aucune liste. Le plafond ne retire pas de points
# forfaitaires, il borne la note.
PLAFOND_ADMIN = scoring.PLAFOND_ADMIN
PLAFOND_BULLETIN = 100


def _ajustements(o) -> dict:
    """Les cinq critères du 22/10/2026, calculés par `scoring.py` (règles et pièges uniques).

    Renvoie des points **entiers** et les textes tels que le moteur de la base les écrit, pour que
    le bulletin affiché par le site dise exactement la même chose que la note de la base.
    """
    pts_niveau, txt_niveau = scoring.niveau_diplome(o)
    pts_metier, termes = scoring.prerequis_metier(o)
    bloqueurs = scoring.bloqueurs_admin(o)
    pts_dates, txt_dates = scoring.dates_score(o)
    pts_comp, comps = scoring.competences_hors_profil(o)
    # 5e critère : la date de fin, qui commande tout (rentrée de Master en septembre 2027).
    # Au-delà du 31/07/2027 la fin se négocie ou se raccourcit, et le dépassement se voit ici.
    pts_fin, txt_fin = scoring.fin_score(o)
    niveau, metier, dates = int(round(pts_niveau)), int(round(pts_metier)), int(round(pts_dates))
    competences, fin = int(round(pts_comp)), int(round(pts_fin))
    txt_prerequis = (f"prérequis métier hors profil : {', '.join(termes)} ({metier:+d})"
                     if termes else "prérequis métier : aucun hors profil (0)")
    if len(comps) == 1:
        txt_competences = f"compétence exigée hors profil : {comps[0]} ({competences:+d})"
    elif comps:
        txt_competences = (f"compétences exigées hors profil : {', '.join(comps)} "
                           f"({competences:+d})")
    else:
        txt_competences = "compétences exigées : toutes dans le référentiel (0)"
    return {
        "niveau": niveau, "metier": metier, "dates": dates, "competences": competences,
        "fin": fin,
        "txt_niveau": txt_niveau, "txt_prerequis": txt_prerequis, "txt_dates": txt_dates,
        "txt_competences": txt_competences, "txt_fin": txt_fin,
        "bloqueurs": bloqueurs,
        "total": niveau + metier + dates + competences + fin,
    }


def _lignes_ajustements(a: dict) -> list:
    """Les cinq lignes **additives** du bulletin. Leur maximum est 0 : ce sont des ajustements
    (bonus/malus), pas des critères notés sur un budget — mais leurs points entrent dans la note,
    et le total affiché reste la somme exacte de toutes les lignes. La ligne « fin » porte le
    dépassement de la date de fin (« nécessite de raccourcir de N semaines »), pour qu'une offre
    à négocier ne se présente jamais au niveau d'une offre qui tient dans la fenêtre."""
    return [
        f"diplôme {a['niveau']}/0 ({a['txt_niveau']})",
        f"prérequis {a['metier']}/0 ({a['txt_prerequis']})",
        f"compétences {a['competences']}/0 ({a['txt_competences']})",
        f"dates {a['dates']}/0 ({a['txt_dates']})",
        f"fin {a['fin']}/0 ({a['txt_fin']})",
    ]


def _ligne_plafond(a: dict, brut: int, note: int, plafond: int) -> str:
    """La ligne qui porte le plafond, quand il mord.

    Ce n'est **pas** un malus : elle ne fait que constater l'écart entre la somme des critères et la
    note bornée. Sans elle, le total affiché par le site cesserait d'être la somme de son bulletin.
    """
    ecart = note - brut
    if a["bloqueurs"]:
        return (f"plafond {ecart}/0 (⛔ bloqueur administratif : {a['bloqueurs'][0]} — "
                f"note plafonnée à {plafond})")
    return f"plafond {ecart}/0 (note plafonnée à {plafond})"


def _cle_texte(s) -> str:
    """Normalisation **stricte** pour comparer deux intitulés : minuscules, sans accents, toute
    ponctuation réduite à une espace (sinon `STAGE/Ingénieur Web (F/H)` et `STAGE– Ingénieur Web -
    F/H` passent pour deux postes différents)."""
    texte = unicodedata.normalize("NFD", str(s or "").lower())
    texte = "".join(ch for ch in texte if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", texte).strip()


def _cle_doublon(o) -> tuple:
    """Clé de dédoublonnage : entreprise + début du titre, normalisés."""
    return (_cle_texte(o["company"])[:14], _cle_texte(o["title"])[:50])


def _dedoublonner(offres) -> tuple:
    """Un même poste arrive presque toujours deux fois : le site direct **et** l'alerte LinkedIn
    (16 postes en double constatés le 18/10/2026). On garde la fiche la plus exploitable et on
    signale l'autre, sinon on croit avoir deux occasions là où il n'y en a qu'une.
    """
    groupes = {}
    for o in offres:
        groupes.setdefault(_cle_doublon(o), []).append(o)

    def richesse(o):
        return (len(_exigences(o)), o["source"] != "linkedin", o["score"] or 0)

    gardees, doublons = [], {}
    for groupe in groupes.values():
        groupe.sort(key=richesse, reverse=True)
        gardees.append(groupe[0])
        if len(groupe) > 1:
            doublons[groupe[0]["id"]] = [(x["id"], x["source"]) for x in groupe[1:]]
    return gardees, doublons


def _deja_postule(o, registre) -> dict | None:
    """L'offre correspond-elle à une candidature déjà envoyée ?

    L'appariement est **celui de `candidatures.py`**, partagé avec `reports.py` et
    `freshness.select_alerts` : ne jamais reproposer un poste déjà traité, dans aucun canal.
    """
    return _partage(o, registre)


def _appliquer_diversite(resultats) -> list:
    """Deuxième passe du bulletin : le **plafond par groupe**. Une offre d'une entreprise déjà
    retenue trois fois perd ses points de diversité, ce qui laisse la place à d'autres employeurs.

    Le plafond ne supprime rien : l'offre reste dans la liste, simplement plus bas.
    """
    # Départage par identifiant : sans lui, l'ordre des offres à égalité de note dépendrait de l'ordre
    # d'entrée (base d'un côté, JSON de l'autre) et les « nᵉ place » du critère diversité divergeraient
    # entre le pipeline et le site — constaté le 21/10/2026 après le retrait du plafond.
    ordonnes = sorted(resultats, key=lambda r: (-r[0], r[1]["id"]))
    vus = {}
    finaux = []
    for prio, o, raisons, _manquants, bulletin in ordonnes:
        groupe = bulletin["groupe"]
        if PLAFOND_GROUPE is None or vus.get(groupe, 0) < PLAFOND_GROUPE:
            vus[groupe] = vus.get(groupe, 0) + 1
            points, pourquoi = 14, f"{groupe} — {vus[groupe]}ᵉ place"
        else:
            points, pourquoi = 0, f"plafond atteint chez {groupe}"
        bulletin["diversite"] = points
        raisons.append(f"diversité {points}/14 ({pourquoi})")
        # Les quatre lignes du 22/10/2026, puis le plafond s'il mord. `prio` contient déjà les
        # ajustements : la note finale est la somme des lignes, bornée à 55 en cas de bloqueur.
        ajust = bulletin.get("ajust") or {}
        raisons.extend(_lignes_ajustements(ajust))
        brut = prio + points
        plafond = PLAFOND_ADMIN if ajust.get("bloqueurs") else PLAFOND_BULLETIN
        note = min(brut, plafond)
        if note != brut:
            raisons.append(_ligne_plafond(ajust, brut, note, plafond))
        finaux.append((note, o, raisons, _manquants, bulletin))
    # Re-tri : la passe de diversité a changé les totaux, la liste doit repartir du meilleur.
    return sorted(finaux, key=lambda r: (-r[0], r[1]["id"]))


def classer(offres, systeme: int, now, actions: dict | None = None) -> list:
    """Renvoie [(priorité, offre, raisons, manquants)] trié du plus prioritaire au moins."""
    actions = actions or {}
    resultats = []
    for o in offres:
        exigs = _exigences(o)
        couvertes = [(_couverte(x) or x, x) for x in exigs if _couverte(x)]
        manquants = [x for x in exigs if not _couverte(x)]
        # Un dénominateur plancher de 3 évite qu'une annonce pauvre en technos reconnues obtienne
        # une cohérence parfaite sur une seule exigence (biais corrigé le 18/10/2026).
        base = len(couvertes) / max(3, len(exigs)) if exigs else 0.35
        jours = _jours(o, now)
        lien = _projet(o["title"] or "", o["description"] or "")
        # Les quatre critères d'accessibilité s'appliquent à **tous** les systèmes : une offre hors
        # calibre (Bac+5, prérequis spatial, démarrage trop tôt, habilitation) ne doit arriver en
        # tête d'aucune liste, et pas seulement du bulletin.
        ajust = _ajustements(o)
        if systeme == 1:
            prio = (o["score"] or 0) + {True: 10, False: 0}[jours <= 2] \
                + (6 if 3 <= jours <= 7 else 0) + ajust["total"]
            raisons = [f"score {o['score']}/100", f"publiée il y a {jours:.0f} j"]
        elif systeme == 2:
            prio = round(60 * base + _fraicheur(jours) + 0.15 * (o["score"] or 0)) + ajust["total"]
            raisons = [(f"{len(couvertes)}/{len(exigs)} exigences couvertes" if exigs
                        else "annonce sans technos exploitables"),
                       f"publiée il y a {jours:.0f} j"] + ([lien] if lien else [])
        else:
            coherence = round(45 * min(1.0, base + (0.15 if lien else 0)))
            acces, raisons_acc = _accessibilite(o)
            prio = coherence + _fraicheur(jours) + acces
            raisons = [f"cohérence {coherence}/45 ({len(couvertes)}/{len(exigs)} exigences"
                       + (f" + {lien.split(' — ')[0]}" if lien else "") + ")",
                       f"fraîcheur {_fraicheur(jours)}/25 (il y a {jours:.0f} j)"] + raisons_acc
            if systeme == 4:
                # Système 4 « bulletin » : neuf critères notés, tous affichés, plus les quatre
                # ajustements du 22/10/2026 et l'urgence (affichée mais jamais notée). Aucune offre
                # n'est éliminée ni réduite à un chiffre.
                metier, pts_metier = _metier(o)
                pts_source, pourquoi_source = _fiabilite_source(o)
                pts_fiche, pourquoi_fiche = _qualite_fiche(o)
                pts_cal, pourquoi_cal = _calendrier(o)
                pts_cout, pourquoi_cout = _cout_depot(o)
                pts_dos, pourquoi_dos = _dossier_pret(o, actions)
                coherence = round(30 * min(1.0, base + (0.15 if lien else 0)))
                metier12 = round(12 * pts_metier / 15)
                source8 = round(8 * pts_source / 12)
                fiche6 = round(6 * pts_fiche / 10)
                cal8 = round(8 * pts_cal / 10)
                cout6 = round(6 * pts_cout / 5)
                frais12 = round(12 * _fraicheur(jours) / 25)
                prio = (coherence + metier12 + source8 + fiche6 + cal8 + cout6 + frais12 + pts_dos
                        + ajust["total"])
                raisons = [f"cohérence {coherence}/30 ({len(couvertes)}/{len(exigs)} exigences"
                           + (f" + {lien.split(' — ')[0]}" if lien else "") + ")",
                           f"métier {metier12}/12 ({metier or 'indéterminé'})",
                           f"source {source8}/8 ({pourquoi_source})",
                           f"fiche {fiche6}/6 ({pourquoi_fiche})",
                           f"calendrier {cal8}/8 ({pourquoi_cal})",
                           f"dépôt {cout6}/6 ({pourquoi_cout})",
                           f"dossier {pts_dos}/4 ({pourquoi_dos})",
                           f"fraîcheur {frais12}/12 (il y a {jours:.0f} j)",
                           _urgence(o, jours)]
                # Les lignes d'ajustement et le plafond sont posés après la diversité (deuxième
                # passe) : la note du bulletin reste la somme exacte de **toutes** ses lignes.
                bulletin = {"groupe": _groupe(o), "diversite": 0, "ajust": ajust}
                resultats.append((prio, dict(o), raisons, manquants, bulletin))
                continue
        # Systèmes 1 à 3 : l'accessibilité est affichée et le plafond administratif s'applique aussi.
        raisons.append(f"accessibilité {ajust['total']:+d} (diplôme {ajust['niveau']:+d}, "
                       f"prérequis {ajust['metier']:+d}, dates {ajust['dates']:+d}, "
                       f"compétences {ajust['competences']:+d})")
        if ajust["bloqueurs"] and prio > PLAFOND_ADMIN:
            prio = PLAFOND_ADMIN
            raisons.append(f"⛔ bloqueur administratif : {ajust['bloqueurs'][0]} — "
                           f"priorité plafonnée à {PLAFOND_ADMIN}")
        resultats.append((prio, dict(o), raisons, manquants))
    if systeme == 4:
        return [(p, o, r, m) for p, o, r, m, _b in _appliquer_diversite(resultats)]
    # Départage par identifiant : à égalité, l'ordre ne doit pas dépendre de l'ordre d'entrée.
    return sorted(resultats, key=lambda r: (-r[0], r[1]["id"]))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Priorités de campagne (3 systèmes de classement).")
    ap.add_argument("--systeme", type=int, default=3, choices=(1, 2, 3, 4))
    ap.add_argument("--jours", type=int, default=7, help="fenêtre en jours (défaut 7)")
    ap.add_argument("--top", type=int, default=15)
    ap.add_argument("--avec-ia", action="store_true",
                    help="ne pas mettre de côté les offres demandant de l'IA (tout dans un seul bloc)")
    args = ap.parse_args(argv if argv is not None else sys.argv[1:])

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    seuil = (now - timedelta(days=args.jours)).strftime("%Y-%m-%d %H:%M:%S")
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    offres = [dict(r) for r in conn.execute(
        "SELECT * FROM offers WHERE status IN ('eligible', 'to_review') "
        "AND contract_type LIKE '%tage%' AND COALESCE(published_at, first_seen_at) >= ?", (seuil,))]
    tout = list(conn.execute("SELECT * FROM offers WHERE status IN ('eligible', 'to_review') "
                             "AND contract_type LIKE '%tage%'"))
    # Où en est notre travail sur chaque offre (prép faite, CV généré…) : sert au critère « dossier ».
    actions = {r[0]: r[1] for r in conn.execute(
        "SELECT offer_id, COUNT(*) FROM offer_actions GROUP BY offer_id")}
    conn.close()

    registre = charger_registre()
    avant = len(offres)
    offres, doublons = _dedoublonner(offres)
    classees = classer(offres, args.systeme, now, actions=actions)

    # Décision du 18/10/2026 : l'IA est mise de côté tant que le projet de Fanel n'existe pas, et
    # une offre déjà postulée n'est jamais reproposée. Rien n'est supprimé : tout est étiqueté.
    deja, sans_ia, avec_ia = [], [], []
    for r in classees:
        if _deja_postule(r[1], registre):
            deja.append(r)
        elif [x for x in r[3] if x in TERMES_IA]:
            avec_ia.append(r)
        elif not args.avec_ia:
            sans_ia.append(r)
        else:
            sans_ia.append(r)
    if args.avec_ia:
        sans_ia = sans_ia + avec_ia
        avec_ia = []
    print(f"Système {args.systeme} · fenêtre {args.jours} jours · "
          f"{len(classees)} postes distincts dans la fenêtre sur {len(tout)} offres en base "
          f"({avant - len(offres)} doublons d'alerte écartés · {len(avec_ia)} postes IA mis de côté · "
          f"{len(deja)} déjà postulés)")
    print()
    blocs = (("À ATTAQUER MAINTENANT", sans_ia), ("PLUS TARD · demande de l'IA", avec_ia),
             ("DÉJÀ POSTULÉ · ne pas refaire", deja))
    for titre_bloc, bloc in blocs:
        if not bloc:
            continue
        print(f"===== {titre_bloc} ({len(bloc)}) =====")
        for rang, (prio, o, raisons, manquants) in enumerate(bloc[:args.top], 1):
            if doublons.get(o["id"]):
                raisons = raisons + ["vue aussi sur " + ", ".join(
                    f"#{i} ({s})" for i, s in doublons[o["id"]])]
            print(f"{rang:>2}. [{prio:>3}] #{o['id']} {o['company']} · {(o['title'] or '')[:62]}")
            if args.systeme == 4 and len(raisons) >= 10:
                # Le bulletin se lit sur deux lignes : ce qui vient de l'offre, puis ce qui vient de
                # nous et du temps.
                print("     " + " · ".join(raisons[:5]))
                print("     " + " · ".join(raisons[5:]))
            else:
                print(f"     {' · '.join(raisons)}")
            if manquants:
                print(f"     à vérifier avant de postuler : {', '.join(manquants[:6])}")
            print(f"     {o['canonical_url']}")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
