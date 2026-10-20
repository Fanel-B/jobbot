#!/usr/bin/env python3
"""Export des offres réelles vers un JSON utilisable par le site JobBot V2.

Le site ne lit **jamais** la base SQLite : ce script produit un fichier autonome
(`offers.json`) qui contient, pour chaque offre, tout ce que les écrans affichent — source, date,
zone, type de contrat, score **expliqué** (décomposition + manquants), signal « formation imposée »
avec son extrait.

    python3 export_site.py                      # écrit dans ./web/public/data/offers.json
    python3 export_site.py --sortie /tmp/o.json
    python3 export_site.py --tout               # inclut les offres écartées par l'éligibilité

Règles tenues (cahier de route, §12) :
  - aucune donnée inventée : un champ manquant sort à `null`, jamais deviné ;
  - le score dépend du profil : il est calculé ici pour le profil de Fanel (`--profil`), et le site
    affichera plus tard le recalcul par utilisateur ;
  - `contract_known: false` pour une offre dont le type de contrat n'est pas renseigné — le site
    l'affiche « contrat non renseigné » au lieu de la cacher ou de la faire passer pour un stage.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SKILL_DIR))

import db  # noqa: E402
import eligibility  # noqa: E402
import priorites  # noqa: E402

DESCRIPTION_MAX = 1500
EXTRAIT_LARGEUR = 110                      # caractères montrés autour du motif « formation imposée »
SANS_CONTRAT_MAX = 40                      # offres sans type de contrat affichées (bloc « à vérifier »)

# Zones géographiques reconnues (le site filtre là-dessus ; le calcul est fait ici, une seule fois).
ZONE_TOULOUSE = re.compile(
    r"toulouse|blagnac|colomiers|lab[eè]ge|balma|haute[- ]garonne|muret|castanet|l'union|fenouillet|"
    r"cornebarrieu|aucamville|beauzelle|cugnaux|tournefeuille|portet[- ]sur[- ]garonne|\b31\s*-|\b31\d{3}\b",
    re.I)
ZONE_IDF = re.compile(
    r"paris|île[- ]de[- ]france|ile[- ]de[- ]france|nanterre|boulogne|saint[- ]denis|cr[eé]teil|"
    r"montrouge|issy|saclay|v[eé]lizy|guyancourt|marne[- ]la[- ]vall[eé]e|\b7[5-9]\d{3}\b|\b9[1-5]\d{3}\b",
    re.I)
ZONE_REMOTE = re.compile(r"t[eé]l[eé]travail|remote|à distance|a distance|home ?office", re.I)


def zone_de(location: str | None) -> str:
    for motif, nom in ((ZONE_TOULOUSE, "toulouse"), (ZONE_IDF, "idf"), (ZONE_REMOTE, "remote")):
        if motif.search(location or ""):
            return nom
    return "autre"


def extrait_formation(offre: dict, motif: str) -> str | None:
    """L'extrait **réel** de l'annonce autour du motif — jamais d'accusation, toujours la citation."""
    texte = " ".join(str(offre.get(k) or "") for k in ("description", "title", "education_required"))
    if not motif or not texte:
        return None
    pos = texte.lower().find(motif.lower())
    if pos < 0:
        return None
    debut = max(0, pos - EXTRAIT_LARGEUR // 2)
    extrait = re.sub(r"\s+", " ", texte[debut:pos + EXTRAIT_LARGEUR]).strip()
    return f"… {extrait} …"


def contrats(offre: dict) -> list[str]:
    brut = offre.get("contract_type") or ""
    return [c.strip().lower() for c in re.split(r"[,/]", brut) if c.strip()]


# Attention aux accents : « dépôt » et « fraîcheur » contiennent ô et î. Une classe de caractères
# trop restrictive les faisait disparaître du bulletin, et le total affiché ne correspondait plus
# à la note calculée par le pipeline.
LIGNE_CRITERE = re.compile(r"^([^\d\s]+)\s+(\d+)\s*/\s*(\d+)\s*(?:\((.*)\))?\s*$")


def _decouper(raisons: list[str]) -> list[dict]:
    """« cohérence 30/30 (2/3 exigences) » → {critere, points, max, detail}. Le détail est gardé.

    Le site affiche la décomposition **et** son explication : c'est la promesse « un score expliqué,
    pas un chiffre opaque ».
    """
    out = []
    for ligne in raisons:
        m = LIGNE_CRITERE.match(ligne.strip())
        if not m:
            continue
        out.append({"critere": m.group(1), "points": int(m.group(2)), "max": int(m.group(3)),
                    "detail": (m.group(4) or "").strip() or None})
    return out


def _competences(offre: dict, manquants: list[str]) -> dict:
    """Ce que l'offre demande : ✅ couvert par le profil, ❌ manquant (jamais de compétence inventée)."""
    exigences = priorites._exigences(offre)
    manquants_bas = {str(m).lower() for m in (manquants or [])}
    couvertes, absentes = [], []
    for e in exigences:
        (absentes if e.lower() in manquants_bas else couvertes).append(e)
    return {"required": exigences, "covered": couvertes, "missing": absentes}


def est_offre_du_site(offre: dict) -> bool:
    """Le site parle d'alternance et de stage : c'est sa raison d'être, pas le CDI d'ESN."""
    types = " ".join(contrats(offre))
    return "stage" in types or "alternance" in types or "apprentissage" in types


def ligne(offre: dict, score: dict | None) -> dict:
    motif = eligibility.partner_school_match(offre) if offre.get("description") else None
    types = contrats(offre)
    return {
        "id": offre.get("id"),
        "source": offre.get("source"),
        "source_offer_id": (offre.get("canonical_url") or "").rstrip("/").split("/")[-1] or None,
        "canonical_url": offre.get("canonical_url"),
        "title": offre.get("title"),
        "company": offre.get("company"),
        "location": offre.get("location"),
        "location_zone": zone_de(offre.get("location")),
        "contract_type": offre.get("contract_type") or None,
        "contract_known": bool(offre.get("contract_type")),
        "contract_kinds": types or None,
        "duration": offre.get("duration") or None,
        "start_date": offre.get("start_date") or None,
        "education_required": offre.get("education_required") or None,
        "description": (offre.get("description") or "")[:DESCRIPTION_MAX] or None,
        "skills_required": json.loads(offre.get("skills_required") or "[]"),
        "training_flag": bool(motif),
        "training_excerpt": extrait_formation(offre, motif) if motif else None,
        "published_at": offre.get("published_at"),
        "first_seen_at": offre.get("first_seen_at"),
        "last_seen_at": offre.get("last_seen_at"),
        "miage_mentioned": bool(offre.get("miage_mentioned")),
        # Score du profil courant : note + décomposition + ce qui manque (jamais un chiffre opaque).
        "score": (score or {}).get("total"),
        "score_breakdown": (score or {}).get("breakdown"),
        "score_reasons": (score or {}).get("reasons"),
        "skills": (score or {}).get("skills"),
    }


def charger(conn: sqlite3.Connection, tout: bool) -> list[dict]:
    """Offres du site + les offres **sans type de contrat renseigné**, plafonnées et marquées.

    Décision de Fanel (19/10/2026) : « je suis bon pour les offres sans contrat **si c'est bien
    présenté** ». Elles sont donc incluses, jamais mélangées aux stages : `contract_known: false`
    et une limite, pour que le site puisse les montrer dans un bloc distinct (« à vérifier ») au
    lieu de les déguiser en offres d'alternance.
    """
    lignes = [dict(r) for r in conn.execute("SELECT * FROM offers")]
    du_site = [o for o in lignes if est_offre_du_site(o)
               and (tout or o.get("status") != "rejected")]
    sans_contrat = sorted(
        (o for o in lignes if not est_offre_du_site(o) and not (o.get("contract_type") or "").strip()),
        key=lambda o: (o.get("published_at") or o.get("first_seen_at") or ""), reverse=True)
    return du_site + sans_contrat[:SANS_CONTRAT_MAX]


def sorties(demandee: Path | None) -> list[Path]:
    """Où écrire l'export.

    Par défaut, le fichier va dans le site **et** dans le dossier de service du
    pipeline. Si le projet du site est présent sur la machine (`~/jobbot-v2`), la
    copie est écrite directement dedans : une seule commande met le site à jour.
    """
    if demandee is not None:
        return [demandee]
    cibles = [SKILL_DIR / "web" / "public" / "data" / "offers.json"]
    site = Path.home() / "jobbot-v2" / "data" / "offers.json"
    if site.parent.is_dir():
        cibles.append(site)
    return cibles


def main() -> int:
    ap = argparse.ArgumentParser(description="Export des offres réelles pour le site JobBot V2.")
    ap.add_argument("--sortie", type=Path, default=None,
                    help="fichier de sortie (par défaut : le site, si présent)")
    ap.add_argument("--tout", action="store_true", help="inclure les offres écartées par l'éligibilité")
    ap.add_argument("--max", type=int, default=400)
    args = ap.parse_args()

    conn = db.init_db(db.DB_PATH)
    offres = charger(conn, args.tout)[:args.max]

    # Score expliqué pour le profil de Fanel : c'est le classement « bulletin » déjà en production.
    # `classer` travaille sur des dates naïves (celles de la base) : on lui donne un `now` naïf.
    # Il renvoie (note, offre, lignes du bulletin, exigences non couvertes).
    maintenant = datetime.now()
    classees = priorites.classer(offres, 4, maintenant)
    scores = {}
    for total, offre, raisons, manquants in classees:
        scores[offre["id"]] = {
            "total": total,
            "breakdown": _decouper(raisons),
            "reasons": raisons,
            "skills": _competences(offre, manquants),
        }

    lignes = sorted((ligne(o, scores.get(o["id"])) for o in offres),
                    key=lambda l: (-(l["score"] or 0), l["title"] or ""))

    sources: dict[str, int] = {}
    for l in lignes:
        sources[l["source"]] = sources.get(l["source"], 0) + 1

    payload = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "count": len(lignes),
            "sources": sources,
            "zones": {z: sum(1 for l in lignes if l["location_zone"] == z)
                      for z in ("toulouse", "idf", "remote", "autre")},
            "sans_contrat_renseigne": sum(1 for l in lignes if not l["contract_known"]),
            "score_profile": "Fanel — L3 MIAGE, Toulouse, alternance + stage",
            "note": "Aucune donnée inventée : un champ absent sort à null.",
        },
        "offers": lignes,
    }

    for cible in sorties(args.sortie):
        cible.parent.mkdir(parents=True, exist_ok=True)
        cible.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    m = payload["meta"]
    print(f"{m['count']} offres exportées → " + ", ".join(str(c) for c in sorties(args.sortie)))
    print(f"  sources : {m['sources']}")
    print(f"  zones   : {m['zones']}")
    print(f"  sans type de contrat renseigné : {m['sans_contrat_renseigne']}")
    print(f"  signal « formation imposée » : {sum(1 for l in lignes if l['training_flag'])}")
    print(f"  avec description : {sum(1 for l in lignes if l['description'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
