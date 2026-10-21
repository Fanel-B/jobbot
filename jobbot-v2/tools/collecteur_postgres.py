#!/usr/bin/env python3
"""Collecteur : base SQLite du pipeline → PostgreSQL (Neon) du site JobBot V2.

Lit les offres à examiner (`status = 'to_review'`) de la base SQLite du pipeline et les écrit dans
la table `offers` de PostgreSQL (schéma : `db/schema.sql`).

    python3 tools/collecteur_postgres.py --dry-run          # montre ce qui serait écrit, sans connexion
    python3 tools/collecteur_postgres.py                    # écrit dans la base désignée par DATABASE_URL
    python3 tools/collecteur_postgres.py --sqlite /chemin/database.sqlite

Règles tenues :
  - la chaîne de connexion vient **uniquement** de la variable d'environnement `DATABASE_URL` :
    aucune option en ligne de commande (elle finirait dans l'historique du shell), aucune lecture
    de fichier, et elle n'est jamais affichée — même dans un message d'erreur ;
  - **idempotent** : l'écriture est un « insérer ou mettre à jour » sur `canonical_url` ;
    relancer le collecteur ne crée aucun doublon, et une offre inchangée n'est pas réécrite ;
  - `--dry-run` ne se connecte pas à PostgreSQL et n'importe même pas `psycopg` ;
  - aucune donnée inventée : un champ absent ou illisible sort à NULL, et le résumé le signale ;
  - **aucune note** n'est écrite : la note dépend de qui regarde, le site la calcule à la lecture.

Les champs dérivés (zone, contrat renseigné, identifiant de source, description tronquée) sont
calculés exactement comme dans `reference/export_site.py`, pour que la base et `data/offers.json`
disent la même chose.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

SQLITE_PAR_DEFAUT = Path.home() / ".hermes" / "data" / "job-search" / "database.sqlite"
STATUT_PAR_DEFAUT = "to_review"
DESCRIPTION_MAX = 1500                    # même plafond que l'export JSON (export_site.py)
APERCU_PAR_DEFAUT = 10                    # lignes montrées par --dry-run

# Colonnes indispensables dans la table SQLite : sans elles, impossible de dédoublonner.
COLONNES_REQUISES = ("canonical_url", "source", "status")
# Colonnes lues si elles existent ; une colonne absente donne NULL (et c'est signalé).
COLONNES_LUES = (
    "canonical_url", "source", "title", "company", "location", "contract_type", "duration",
    "start_date", "education_required", "description", "skills_required", "published_at",
    "first_seen_at", "last_seen_at", "miage_mentioned",
)

# Zones géographiques : copie conforme de `reference/export_site.py` (à garder synchronisée).
ZONE_TOULOUSE = re.compile(
    r"toulouse|blagnac|colomiers|lab[eè]ge|balma|haute[- ]garonne|muret|castanet|l'union|fenouillet|"
    r"cornebarrieu|aucamville|beauzelle|cugnaux|tournefeuille|portet[- ]sur[- ]garonne|\b31\s*-|\b31\d{3}\b",
    re.I)
ZONE_IDF = re.compile(
    r"paris|île[- ]de[- ]france|ile[- ]de[- ]france|nanterre|boulogne|saint[- ]denis|cr[eé]teil|"
    r"montrouge|issy|saclay|v[eé]lizy|guyancourt|marne[- ]la[- ]vall[eé]e|\b7[5-9]\d{3}\b|\b9[1-5]\d{3}\b",
    re.I)
ZONE_REMOTE = re.compile(r"t[eé]l[eé]travail|remote|à distance|a distance|home ?office", re.I)

# Colonnes écrites dans `offers`, dans l'ordre de la requête.
COLONNES_PG = (
    "canonical_url", "source", "source_offer_id", "title", "company", "location", "location_zone",
    "contract_type", "contract_known", "duration", "start_date", "education_required",
    "description", "skills_required", "published_at", "first_seen_at", "last_seen_at",
    "miage_mentioned",
)
# Colonnes simplement remplacées par la dernière valeur collectée lors d'une mise à jour.
# `first_seen_at` et `last_seen_at` sont traitées à part : on garde la plus ancienne première
# collecte et la plus récente dernière collecte, pour qu'une relance avec une base plus ancienne
# ne recule jamais les dates.
COLONNES_REMPLACEES = tuple(c for c in COLONNES_PG
                            if c not in ("canonical_url", "first_seen_at", "last_seen_at"))


def _requete_upsert() -> str:
    valeurs = ", ".join(f"%({c})s" for c in COLONNES_PG)
    maj = ",\n    ".join(f"{c} = EXCLUDED.{c}" for c in COLONNES_REMPLACEES)
    avant = ", ".join(f"offers.{c}" for c in COLONNES_REMPLACEES)
    apres = ", ".join(f"EXCLUDED.{c}" for c in COLONNES_REMPLACEES)
    # LEAST / GREATEST ignorent les NULL en PostgreSQL : une date connue n'est jamais effacée.
    # La clause WHERE évite de réécrire une ligne identique : elle compte alors « inchangée ».
    # `xmax = 0` n'est vrai que pour une ligne qui vient d'être insérée (et non mise à jour).
    return f"""
INSERT INTO offers ({", ".join(COLONNES_PG)})
VALUES ({valeurs})
ON CONFLICT (canonical_url) DO UPDATE SET
    {maj},
    first_seen_at = LEAST(offers.first_seen_at, EXCLUDED.first_seen_at),
    last_seen_at = GREATEST(offers.last_seen_at, EXCLUDED.last_seen_at),
    updated_at = now()
WHERE ({avant}) IS DISTINCT FROM ({apres})
   OR offers.first_seen_at IS DISTINCT FROM LEAST(offers.first_seen_at, EXCLUDED.first_seen_at)
   OR offers.last_seen_at IS DISTINCT FROM GREATEST(offers.last_seen_at, EXCLUDED.last_seen_at)
RETURNING (xmax = 0) AS inseree
"""


# ---------------------------------------------------------------- transformation

def zone_de(location: str | None) -> str:
    for motif, nom in ((ZONE_TOULOUSE, "toulouse"), (ZONE_IDF, "idf"), (ZONE_REMOTE, "remote")):
        if motif.search(location or ""):
            return nom
    return "autre"


def _texte(valeur) -> str | None:
    """Une chaîne vide ou faite d'espaces est un champ absent, pas une valeur."""
    if valeur is None:
        return None
    texte = str(valeur).strip()
    return texte or None


def _horodatage(valeur, champ: str, anomalies: Counter) -> datetime | None:
    """« 2026-10-19 » ou « 2026-10-19 17:10:31 » → datetime sans fuseau (comme la base SQLite)."""
    texte = _texte(valeur)
    if texte is None:
        return None
    try:
        moment = datetime.fromisoformat(texte.replace("Z", "+00:00"))
    except ValueError:
        anomalies[f"{champ} illisible → NULL"] += 1
        return None
    if moment.tzinfo is not None:
        # La colonne est sans fuseau : on ramène une date avec fuseau en UTC, sans rien supposer.
        moment = moment.astimezone(timezone.utc).replace(tzinfo=None)
    return moment


def _jour(valeur, champ: str, anomalies: Counter) -> date | None:
    texte = _texte(valeur)
    if texte is None:
        return None
    try:
        return date.fromisoformat(texte)
    except ValueError:
        pass
    try:
        return datetime.fromisoformat(texte).date()
    except ValueError:
        anomalies[f"{champ} illisible → NULL"] += 1
        return None


def transformer(offre: dict, anomalies: Counter) -> tuple[dict | None, str | None]:
    """Une ligne SQLite → une ligne `offers`, ou (None, raison) si elle doit être ignorée."""
    url = _texte(offre.get("canonical_url"))
    if url is None:
        return None, "sans canonical_url"
    source = _texte(offre.get("source"))
    if source is None:
        return None, "sans source"

    brut = offre.get("skills_required")
    if brut is None or (isinstance(brut, str) and not brut.strip()):
        competences: list = []
    else:
        try:
            competences = json.loads(brut) if isinstance(brut, str) else brut
        except (TypeError, ValueError):
            return None, "skills_required illisible"
        if not isinstance(competences, list):
            return None, "skills_required n'est pas une liste"

    contrat = _texte(offre.get("contract_type"))
    # Tronquée sur le texte brut, comme l'export JSON (pas de `strip()` : mêmes 1 500 caractères).
    description = str(offre.get("description") or "")
    description = description if description.strip() else None
    return {
        "canonical_url": url,
        "source": source,
        "source_offer_id": url.rstrip("/").split("/")[-1] or None,
        "title": _texte(offre.get("title")),
        "company": _texte(offre.get("company")),
        "location": _texte(offre.get("location")),
        "location_zone": zone_de(offre.get("location")),
        "contract_type": contrat,
        "contract_known": contrat is not None,
        "duration": _texte(offre.get("duration")),
        "start_date": _jour(offre.get("start_date"), "start_date", anomalies),
        "education_required": _texte(offre.get("education_required")),
        "description": description[:DESCRIPTION_MAX] if description else None,
        "skills_required": competences,
        "published_at": _horodatage(offre.get("published_at"), "published_at", anomalies),
        "first_seen_at": _horodatage(offre.get("first_seen_at"), "first_seen_at", anomalies),
        "last_seen_at": _horodatage(offre.get("last_seen_at"), "last_seen_at", anomalies),
        "miage_mentioned": bool(offre.get("miage_mentioned")),
    }, None


def preparer(offres: list[dict], anomalies: Counter) -> tuple[list[dict], Counter]:
    """Transforme et dédoublonne par `canonical_url` (on garde la collecte la plus récente)."""
    ignorees: Counter = Counter()
    retenues: dict[str, dict] = {}
    for offre in offres:
        ligne, raison = transformer(offre, anomalies)
        if ligne is None:
            ignorees[raison] += 1
            continue
        deja = retenues.get(ligne["canonical_url"])
        if deja is not None:
            ignorees["doublon de canonical_url dans SQLite"] += 1
            if (ligne["last_seen_at"] or datetime.min) <= (deja["last_seen_at"] or datetime.min):
                continue
        retenues[ligne["canonical_url"]] = ligne
    return list(retenues.values()), ignorees


# ---------------------------------------------------------------- lecture SQLite

def lire_sqlite(chemin: Path, statut: str) -> tuple[list[dict], list[str]]:
    """Lit les offres au statut demandé, en lecture seule. Renvoie (offres, colonnes absentes)."""
    if not chemin.is_file():
        raise FileNotFoundError(f"base SQLite introuvable : {chemin}")
    # `mode=ro` : le collecteur ne peut pas modifier la base du pipeline, même par erreur.
    conn = sqlite3.connect(f"{chemin.resolve().as_uri()}?mode=ro", uri=True)
    try:
        conn.row_factory = sqlite3.Row
        presentes = {r["name"] for r in conn.execute("PRAGMA table_info(offers)")}
        if not presentes:
            raise RuntimeError("la base SQLite n'a pas de table « offers »")
        manquantes = [c for c in COLONNES_REQUISES if c not in presentes]
        if manquantes:
            raise RuntimeError("colonnes indispensables absentes de « offers » : " + ", ".join(manquantes))
        lues = [c for c in COLONNES_LUES if c in presentes]
        absentes = [c for c in COLONNES_LUES if c not in presentes]
        ordre = " ORDER BY id" if "id" in presentes else ""
        requete = f"SELECT {', '.join(lues)} FROM offers WHERE status = ?{ordre}"
        offres = [dict(r) for r in conn.execute(requete, (statut,))]
    finally:
        conn.close()
    return offres, absentes


# ---------------------------------------------------------------- écriture PostgreSQL

def _masquer(message: str, url: str) -> str:
    """Retire d'un message d'erreur tout ce qui pourrait révéler la chaîne de connexion."""
    secrets = {url}
    try:
        morceaux = urlsplit(url)
        for valeur in (morceaux.password, morceaux.username, morceaux.hostname, morceaux.netloc):
            if valeur:
                secrets.update({valeur, unquote(valeur)})
    except ValueError:
        pass
    for secret in sorted(secrets, key=len, reverse=True):
        if len(secret) >= 3:
            message = message.replace(secret, "***")
    return message


def ecrire_postgres(lignes: list[dict], url: str) -> tuple[int, int, int]:
    """Écrit les lignes dans une seule transaction. Renvoie (insérées, mises à jour, inchangées)."""
    import psycopg                       # importé ici : --dry-run ne doit pas en dépendre
    from psycopg.types.json import Jsonb

    inserees = mises_a_jour = inchangees = 0
    with psycopg.connect(url, connect_timeout=15, application_name="jobbot-collecteur") as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.offers') IS NOT NULL")
            if not cur.fetchone()[0]:
                raise RuntimeError("la table « offers » n'existe pas : appliquer d'abord db/schema.sql")
            if not lignes:
                return 0, 0, 0
            parametres = [{**l, "skills_required": Jsonb(l["skills_required"])} for l in lignes]
            # Un jeu de résultats par ligne : une ligne renvoyée = insérée ou mise à jour,
            # aucune ligne renvoyée = conflit sans changement (clause WHERE du DO UPDATE).
            cur.executemany(_requete_upsert(), parametres, returning=True)
            while True:
                resultat = cur.fetchone()
                if resultat is None:
                    inchangees += 1
                elif resultat[0]:
                    inserees += 1
                else:
                    mises_a_jour += 1
                if not cur.nextset():
                    break
        # La sortie du bloc `with psycopg.connect` valide la transaction (ou l'annule sur erreur).
    return inserees, mises_a_jour, inchangees


# ---------------------------------------------------------------- affichage

def _apercu(lignes: list[dict], nombre: int) -> None:
    print(f"\nAperçu ({min(nombre, len(lignes))} sur {len(lignes)}) :")
    for l in lignes[:nombre]:
        contrat = l["contract_type"] or "contrat non renseigné"
        print(f"  - [{l['source']}] {l['title'] or '(sans titre)'} — {l['company'] or '?'}"
              f" · {l['location_zone']} · {contrat}")
        print(f"    {l['canonical_url']}")


def _resume(lues: int, ignorees: Counter, anomalies: Counter, absentes: list[str],
            ecrit: tuple[int, int, int] | None, a_ecrire: int) -> None:
    print("\nRésumé")
    print(f"  offres lues       : {lues}")
    if ecrit is None:
        print(f"  à écrire          : {a_ecrire} (insertion ou mise à jour : inconnu sans connexion)")
    else:
        inserees, mises_a_jour, inchangees = ecrit
        print(f"  insérées          : {inserees}")
        print(f"  mises à jour      : {mises_a_jour}")
        print(f"  inchangées        : {inchangees}")
    print(f"  ignorées          : {sum(ignorees.values())}")
    for raison, n in sorted(ignorees.items()):
        print(f"    · {raison} : {n}")
    if anomalies:
        print("  champs mis à NULL :")
        for raison, n in sorted(anomalies.items()):
            print(f"    · {raison} : {n}")
    if absentes:
        print("  colonnes absentes de SQLite (écrites à NULL) : " + ", ".join(absentes))


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Copie les offres de la base SQLite du pipeline vers PostgreSQL (DATABASE_URL).")
    ap.add_argument("--sqlite", type=Path, default=SQLITE_PAR_DEFAUT,
                    help=f"base SQLite du pipeline (par défaut : {SQLITE_PAR_DEFAUT})")
    ap.add_argument("--statut", default=STATUT_PAR_DEFAUT,
                    help=f"statut des offres à copier (par défaut : {STATUT_PAR_DEFAUT})")
    ap.add_argument("--dry-run", action="store_true",
                    help="montrer ce qui serait écrit, sans se connecter à PostgreSQL")
    ap.add_argument("--apercu", type=int, default=APERCU_PAR_DEFAUT,
                    help="nombre d'offres montrées par --dry-run")
    args = ap.parse_args()

    # Vérifié avant toute lecture : inutile de travailler pour rien si l'écriture est impossible.
    url = None
    if not args.dry_run:
        url = os.environ.get("DATABASE_URL", "").strip()
        if not url:
            print("Erreur : la variable d'environnement DATABASE_URL n'est pas définie "
                  "(voir db/README.md). Utiliser --dry-run pour essayer sans base.", file=sys.stderr)
            return 2

    try:
        offres, absentes = lire_sqlite(args.sqlite.expanduser(), args.statut)
    except (OSError, RuntimeError, sqlite3.Error) as erreur:
        print(f"Erreur de lecture SQLite : {erreur}", file=sys.stderr)
        return 1

    anomalies: Counter = Counter()
    lignes, ignorees = preparer(offres, anomalies)
    print(f"{len(offres)} offres au statut « {args.statut} » lues dans {args.sqlite}")

    if args.dry_run:
        print("Mode --dry-run : aucune connexion à PostgreSQL, rien n'est écrit.")
        _apercu(lignes, args.apercu)
        _resume(len(offres), ignorees, anomalies, absentes, None, len(lignes))
        return 0

    try:
        ecrit = ecrire_postgres(lignes, url)
    except ImportError:
        print("Erreur : psycopg n'est pas installé (pip install -r db/requirements.txt).", file=sys.stderr)
        return 1
    except Exception as erreur:          # psycopg.Error et RuntimeError : message toujours masqué
        print(f"Erreur PostgreSQL ({type(erreur).__name__}) : {_masquer(str(erreur), url)}",
              file=sys.stderr)
        print("Rien n'a été écrit : la transaction a été annulée.", file=sys.stderr)
        return 1

    _resume(len(offres), ignorees, anomalies, absentes, ecrit, len(lignes))
    return 0


if __name__ == "__main__":
    sys.exit(main())
