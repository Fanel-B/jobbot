#!/usr/bin/env python3
"""Collecteur : base SQLite du pipeline → PostgreSQL (Neon) du site JobBot V2.

Choisit les offres de la base SQLite du pipeline avec la règle de `charger()` dans
`reference/export_site.py` (le périmètre de contrat mis à part, voir `CONTRATS_COPIES`) et les écrit
dans la table `offers` de PostgreSQL (schéma : `db/schema.sql`). Chaque copie réussie laisse une
ligne dans `collectes`, écrite dans la même transaction : c'est la date que le site affiche.

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

# Le périmètre du produit, et la seule règle de sélection qui diffère de l'export JSON.
#
# Une offre est copiée si l'un de ces mots apparaît dans son type de contrat, avec le test de
# `est_offre_du_site()` dans `reference/export_site.py` : « stage » retient donc aussi
# « stage ou alternance ». L'export, lui, retient stage, alternance et apprentissage.
#
# On y ajoutera l'alternance (« alternance », « apprentissage ») vers janvier 2027, quand le site
# l'ouvrira de nouveau. Rien d'autre n'est à changer ailleurs dans ce fichier pour ça.
CONTRATS_COPIES = {"stage"}

SQLITE_PAR_DEFAUT = Path.home() / ".hermes" / "data" / "job-search" / "database.sqlite"
# Même plafond que l'export JSON (`DESCRIPTION_MAX = 4000` dans `reference/export_site.py`). Il
# valait 1 500 ici, alors que ce commentaire disait déjà « même plafond » : 105 des 290 offres de la
# collecte du 25 octobre dépassaient 1 500 caractères, et le moteur de note lit la description.
DESCRIPTION_MAX = 4000
SANS_CONTRAT_MAX = 40                     # comme l'export : offres sans contrat gardées, les plus récentes
OFFRES_MAX = 400                          # comme l'export (option --max, 400 par défaut)
APERCU_PAR_DEFAUT = 10                    # lignes montrées par --dry-run

# Colonnes indispensables dans la table SQLite : sans elles, impossible de dédoublonner, de garder
# le numéro du pipeline (`id`, qui sert d'adresse aux fiches du site) ou d'écarter les rejets.
COLONNES_REQUISES = ("id", "canonical_url", "source", "status")
# Colonnes lues si elles existent ; une colonne absente donne NULL (et c'est signalé).
COLONNES_LUES = (
    "id", "status", "canonical_url", "source", "title", "company", "location", "contract_type",
    "duration", "start_date", "education_required", "description", "skills_required",
    "skills_optional", "published_at", "first_seen_at", "last_seen_at", "miage_mentioned",
)

# La zone d'une offre n'est PAS calculée ici : elle l'est par `eligibility.zone_de_lieu`, lue dans
# `reference/` (voir `zone_de` plus bas). Les trois regex qui s'y trouvaient étaient une copie de
# l'ancien `export_site.py`, et une copie de plus à garder synchronisée.
REFERENCE_PAR_DEFAUT = Path(__file__).resolve().parent.parent / "reference"

# Colonnes écrites dans `offers`, dans l'ordre de la requête.
COLONNES_PG = (
    "pipeline_id", "canonical_url", "source", "source_offer_id", "title", "company", "location",
    "location_zone", "contract_type", "contract_known", "duration", "start_date",
    "education_required", "description", "skills_required", "skills_optional", "published_at",
    "first_seen_at", "last_seen_at", "miage_mentioned",
)
# Colonnes JSON : psycopg doit les recevoir enveloppées dans `Jsonb`.
COLONNES_JSON = ("skills_required", "skills_optional")

# La trace de la copie, dans la même transaction que les offres : si la copie échoue, aucune date
# n'est écrite, et le site ne peut pas annoncer une collecte qui n'a pas eu lieu.
# `clock_timestamp()` et non `now()` : `now()` est l'heure du **début** de la transaction.
REQUETE_COLLECTE = """
INSERT INTO collectes (terminee_a, lues, inserees, mises_a_jour, inchangees)
VALUES (clock_timestamp(), %(lues)s, %(inserees)s, %(mises_a_jour)s, %(inchangees)s)
"""
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

_regle_de_zone = None


def _charger_regle_de_zone():
    """`eligibility.zone_de_lieu`, la règle du moteur, lue dans `reference/` (ou `JOBBOT_REFERENCE`).

    `eligibility.py` importe `faits.py` : si ce dernier manque, la règle ne peut pas tourner, et le
    dire vaut mieux qu'une zone devinée. La variable d'environnement sert aux essais sur une copie
    du dossier ; en production, le dossier du dépôt fait foi.
    """
    dossier = Path(os.environ.get("JOBBOT_REFERENCE") or REFERENCE_PAR_DEFAUT)
    if not (dossier / "faits.py").is_file():
        raise RuntimeError(
            f"{dossier / 'faits.py'} est absent : la règle de zone de reference/eligibility.py ne "
            "peut pas s'exécuter sans lui. Il vient du pipeline (voir reference/README.md).")
    sys.path.insert(0, str(dossier))
    try:
        import eligibility               # noqa: PLC0415  (import tardif : --help ne doit pas en dépendre)
    finally:
        sys.path.remove(str(dossier))
    return eligibility.zone_de_lieu


def zone_de(location: str | None) -> str:
    """Zone d'un lieu : la règle de `reference/eligibility.py`, celle de l'export du site."""
    global _regle_de_zone
    if _regle_de_zone is None:
        _regle_de_zone = _charger_regle_de_zone()
    return _regle_de_zone(location)


# ---------------------------------------------------------------- sélection

def contrats(offre: dict) -> list[str]:
    """Copie de `contrats()` dans `reference/export_site.py`."""
    brut = offre.get("contract_type") or ""
    return [c.strip().lower() for c in re.split(r"[,/]", brut) if c.strip()]


def est_offre_copiee(offre: dict) -> bool:
    """`est_offre_du_site()` de l'export, avec `CONTRATS_COPIES` pour seul périmètre."""
    types = " ".join(contrats(offre))
    return any(mot in types for mot in CONTRATS_COPIES)


def retenir(offres: list[dict]) -> list[dict]:
    """La règle de `charger()` (export, sans `--tout`), puis le plafond `--max` de son `main()`.

    Les offres du périmètre, sauf les rejetées ; plus les offres **sans type de contrat**, les
    `SANS_CONTRAT_MAX` plus récentes, quel que soit leur statut, exactement comme l'export.
    """
    du_site = [o for o in offres if est_offre_copiee(o) and o.get("status") != "rejected"]
    sans_contrat = sorted(
        (o for o in offres if not est_offre_copiee(o) and not (o.get("contract_type") or "").strip()),
        key=lambda o: (o.get("published_at") or o.get("first_seen_at") or ""), reverse=True)
    return (du_site + sans_contrat[:SANS_CONTRAT_MAX])[:OFFRES_MAX]


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


def _liste_json(brut, champ: str) -> tuple[list, str | None]:
    """Une liste JSON stockée en texte dans SQLite. Absente ou vide : liste vide."""
    if brut is None or (isinstance(brut, str) and not brut.strip()):
        return [], None
    try:
        valeur = json.loads(brut) if isinstance(brut, str) else brut
    except (TypeError, ValueError):
        return [], f"{champ} illisible"
    if not isinstance(valeur, list):
        return [], f"{champ} n'est pas une liste"
    return valeur, None


def transformer(offre: dict, anomalies: Counter) -> tuple[dict | None, str | None]:
    """Une ligne SQLite → une ligne `offers`, ou (None, raison) si elle doit être ignorée."""
    url = _texte(offre.get("canonical_url"))
    if url is None:
        return None, "sans canonical_url"
    source = _texte(offre.get("source"))
    if source is None:
        return None, "sans source"

    try:
        pipeline_id = int(offre.get("id"))
    except (TypeError, ValueError):
        return None, "sans id du pipeline"

    competences, erreur = _liste_json(offre.get("skills_required"), "skills_required")
    if erreur:
        return None, erreur
    # Souhaitées : lues par le moteur (`priorites._exigences`) au même titre que les exigées.
    optionnelles, erreur = _liste_json(offre.get("skills_optional"), "skills_optional")
    if erreur:
        return None, erreur

    contrat = _texte(offre.get("contract_type"))
    # Tronquée sur le texte brut, comme l'export JSON (pas de `strip()` : mêmes 4 000 caractères).
    description = str(offre.get("description") or "")
    description = description if description.strip() else None
    return {
        "pipeline_id": pipeline_id,
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
        "skills_optional": optionnelles,
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

def lire_sqlite(chemin: Path) -> tuple[list[dict], list[str]]:
    """Lit toutes les offres, en lecture seule. Renvoie (offres, colonnes absentes).

    Tous les statuts : c'est `retenir()` qui choisit ensuite, comme `charger()` dans l'export.
    """
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
        requete = f"SELECT {', '.join(lues)} FROM offers ORDER BY id"
        offres = [dict(r) for r in conn.execute(requete)]
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


def ecrire_postgres(lignes: list[dict], url: str, lues: int) -> tuple[int, int, int]:
    """Écrit les lignes **et** la trace de la copie dans une seule transaction.

    Renvoie (insérées, mises à jour, inchangées). `lues` est le nombre d'offres lues dans SQLite.
    """
    import psycopg                       # importé ici : --dry-run ne doit pas en dépendre
    from psycopg.types.json import Jsonb

    inserees = mises_a_jour = inchangees = 0
    with psycopg.connect(url, connect_timeout=15, application_name="jobbot-collecteur") as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.offers') IS NOT NULL"
                        " AND to_regclass('public.collectes') IS NOT NULL")
            if not cur.fetchone()[0]:
                raise RuntimeError("table « offers » ou « collectes » absente : "
                                   "appliquer d'abord db/migration-t6.sql")
            if lignes:
                parametres = [{**l, **{c: Jsonb(l[c]) for c in COLONNES_JSON}} for l in lignes]
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
            # Même curseur, même transaction : la date n'existe que si les offres sont écrites.
            # Une copie qui ne change rien est quand même une copie réussie, et elle est datée.
            cur.execute(REQUETE_COLLECTE, {"lues": lues, "inserees": inserees,
                                           "mises_a_jour": mises_a_jour, "inchangees": inchangees})
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
        offres, absentes = lire_sqlite(args.sqlite.expanduser())
    except (OSError, RuntimeError, sqlite3.Error) as erreur:
        print(f"Erreur de lecture SQLite : {erreur}", file=sys.stderr)
        return 1

    anomalies: Counter = Counter()
    retenues = retenir(offres)
    lignes, ignorees = preparer(retenues, anomalies)
    print(f"{len(offres)} offres lues dans {args.sqlite}, {len(retenues)} retenues "
          f"(contrats : {', '.join(sorted(CONTRATS_COPIES))}, et sans contrat renseigné)")

    if args.dry_run:
        print("Mode --dry-run : aucune connexion à PostgreSQL, rien n'est écrit.")
        _apercu(lignes, args.apercu)
        _resume(len(offres), ignorees, anomalies, absentes, None, len(lignes))
        return 0

    try:
        ecrit = ecrire_postgres(lignes, url, len(offres))
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
