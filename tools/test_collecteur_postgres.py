"""Tests du collecteur, sans PostgreSQL ni secret : une base SQLite de test et un faux `psycopg`.

    python3 -m unittest discover -s tools -v

Un sixième point, du chantier zone (novembre 2026) : la zone d'une offre vient de la règle du moteur
(`reference/eligibility.zone_de_lieu`), et non d'une copie de regex.

Ils vérifient les cinq points de la migration T6 :
  1. `pipeline_id` reprend le numéro du pipeline, et le schéma le déclare unique ;
  2. la description est coupée à 4 000 caractères, comme l'export JSON ;
  3. `skills_optional` est lu dans SQLite et écrit dans PostgreSQL ;
  4. la ligne de `collectes` est écrite dans la même transaction que les offres ;
  5. le périmètre : la règle `charger()` de l'export, limitée aux contrats de `CONTRATS_COPIES`.
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
import tempfile
import types
import unittest
from collections import Counter
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent
sys.path.insert(0, str(ICI))

import collecteur_postgres as c  # noqa: E402
import comparer_zones  # noqa: E402

COLONNES_SQLITE = (
    "id", "status", "canonical_url", "source", "title", "company", "location", "contract_type",
    "duration", "start_date", "education_required", "description", "skills_required",
    "skills_optional", "published_at", "first_seen_at", "last_seen_at", "miage_mentioned",
)


def offre(id_: int, contrat: str | None, statut: str = "to_review", **autres) -> dict:
    base = {
        "id": id_, "status": statut, "canonical_url": f"https://exemple.fr/offres/{id_}",
        "source": "linkedin", "title": f"Offre {id_}", "company": "ACME", "location": "Toulouse",
        "contract_type": contrat, "duration": None, "start_date": None, "education_required": None,
        "description": "Développement web.", "skills_required": '["Python"]',
        "skills_optional": "[]", "published_at": f"2026-10-{10 + id_ % 15:02d}",
        "first_seen_at": "2026-10-20 10:00:00", "last_seen_at": "2026-10-25 10:00:00",
        "miage_mentioned": 0,
    }
    base.update(autres)
    return base


def base_sqlite(dossier: Path, offres: list[dict]) -> Path:
    chemin = dossier / "database.sqlite"
    conn = sqlite3.connect(chemin)
    conn.execute(f"CREATE TABLE offers ({', '.join(COLONNES_SQLITE)})")
    conn.executemany(
        f"INSERT INTO offers VALUES ({', '.join('?' for _ in COLONNES_SQLITE)})",
        [tuple(o[k] for k in COLONNES_SQLITE) for o in offres])
    conn.commit()
    conn.close()
    return chemin


# ------------------------------------------------------------------ faux psycopg

class FauxCurseur:
    def __init__(self, journal: list, echec_upsert: bool):
        self.journal = journal
        self.echec_upsert = echec_upsert
        self._resultats: list = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, requete, parametres=None):
        self.journal.append(("execute", requete, parametres))
        self._resultats = [(True,)]

    def executemany(self, requete, parametres, returning=False):
        if self.echec_upsert:
            raise RuntimeError("panne simulée pendant l'écriture des offres")
        self.journal.append(("executemany", requete, list(parametres)))
        # Toutes insérées : une ligne `(True,)` par offre.
        self._resultats = [(True,) for _ in parametres]

    def fetchone(self):
        return self._resultats.pop(0) if self._resultats else None

    def nextset(self):
        return bool(self._resultats)


class FausseConnexion:
    def __init__(self, journal: list, echec_upsert: bool):
        self.journal = journal
        self.echec_upsert = echec_upsert

    def __enter__(self):
        return self

    def __exit__(self, type_exc, *exc):
        # Comme psycopg 3 : validation en sortie normale, annulation sur exception.
        self.journal.append(("rollback",) if type_exc else ("commit",))
        return False

    def cursor(self):
        return FauxCurseur(self.journal, self.echec_upsert)


def installer_faux_psycopg(journal: list, echec_upsert: bool = False) -> None:
    module = types.ModuleType("psycopg")
    module.connect = lambda *a, **k: (journal.append(("connect",)), FausseConnexion(journal, echec_upsert))[1]
    module_types = types.ModuleType("psycopg.types")
    module_json = types.ModuleType("psycopg.types.json")

    class Jsonb:
        def __init__(self, valeur):
            self.valeur = valeur

    module_json.Jsonb = Jsonb
    sys.modules.update({"psycopg": module, "psycopg.types": module_types,
                        "psycopg.types.json": module_json})


def retirer_faux_psycopg() -> None:
    for nom in ("psycopg", "psycopg.types", "psycopg.types.json"):
        sys.modules.pop(nom, None)


def preparer_depuis(offres: list[dict]) -> list[dict]:
    with tempfile.TemporaryDirectory() as d:
        lues, _ = c.lire_sqlite(base_sqlite(Path(d), offres))
    lignes, _ = c.preparer(c.retenir(lues), Counter())
    return lignes


# ------------------------------------------------------------------ 1. pipeline_id

class PipelineId(unittest.TestCase):
    def test_le_numero_du_pipeline_est_copie(self):
        lignes = preparer_depuis([offre(913, "Stage"), offre(422, "Stage")])
        self.assertEqual(sorted(l["pipeline_id"] for l in lignes), [422, 913])
        self.assertIn("pipeline_id", c.COLONNES_PG)

    def test_une_offre_sans_numero_est_ignoree(self):
        ligne, raison = c.transformer(offre(1, "Stage", id=None), Counter())
        self.assertIsNone(ligne)
        self.assertEqual(raison, "sans id du pipeline")

    def test_le_schema_et_la_migration_le_declarent_unique(self):
        for fichier in ("db/schema.sql", "db/migration-t6.sql"):
            sql = (RACINE / fichier).read_text(encoding="utf-8")
            self.assertRegex(sql, r"ADD COLUMN IF NOT EXISTS pipeline_id bigint", fichier)
            self.assertRegex(sql, r"CREATE UNIQUE INDEX IF NOT EXISTS offers_pipeline_id_key "
                                  r"ON offers \(pipeline_id\)", fichier)


# ------------------------------------------------------------------ 2. description

class Description(unittest.TestCase):
    def test_coupee_a_4000_comme_l_export(self):
        self.assertEqual(c.DESCRIPTION_MAX, 4000)
        export = (RACINE / "reference" / "export_site.py").read_text(encoding="utf-8")
        self.assertIn(f"DESCRIPTION_MAX = {c.DESCRIPTION_MAX}", export)
        lignes = preparer_depuis([offre(1, "Stage", description="x" * 5000)])
        self.assertEqual(len(lignes[0]["description"]), 4000)

    def test_une_description_de_3000_caracteres_reste_entiere(self):
        # 1 500, l'ancien plafond, aurait coupé celle-ci : c'était le cas de 105 offres sur 290.
        lignes = preparer_depuis([offre(1, "Stage", description="y" * 3000)])
        self.assertEqual(len(lignes[0]["description"]), 3000)


# ------------------------------------------------------------------ 3. skills_optional

class CompetencesSouhaitees(unittest.TestCase):
    def test_lues_dans_sqlite_et_ecrites(self):
        lignes = preparer_depuis([offre(1, "Stage", skills_optional='["Docker", "Kubernetes"]')])
        self.assertEqual(lignes[0]["skills_optional"], ["Docker", "Kubernetes"])
        self.assertIn("skills_optional", c.COLONNES_PG)
        self.assertIn("skills_optional", c.COLONNES_JSON)

    def test_absentes_donnent_une_liste_vide(self):
        lignes = preparer_depuis([offre(1, "Stage", skills_optional=None)])
        self.assertEqual(lignes[0]["skills_optional"], [])

    def test_illisibles_ecartent_l_offre_comme_pour_les_exigees(self):
        ligne, raison = c.transformer(offre(1, "Stage", skills_optional="pas du json"), Counter())
        self.assertIsNone(ligne)
        self.assertEqual(raison, "skills_optional illisible")

    def test_la_colonne_existe_dans_le_schema_et_la_migration(self):
        for fichier in ("db/schema.sql", "db/migration-t6.sql"):
            sql = (RACINE / fichier).read_text(encoding="utf-8")
            self.assertIn("ADD COLUMN IF NOT EXISTS skills_optional jsonb NOT NULL DEFAULT '[]'::jsonb",
                          sql, fichier)


# ------------------------------------------------------------------ 4. collectes

class Collectes(unittest.TestCase):
    def tearDown(self):
        retirer_faux_psycopg()

    def test_ecrite_dans_la_meme_transaction_apres_les_offres(self):
        journal: list = []
        installer_faux_psycopg(journal)
        lignes = preparer_depuis([offre(1, "Stage"), offre(2, "Stage")])
        resultat = c.ecrire_postgres(lignes, "postgresql://faux", lues=7)

        self.assertEqual(resultat, (2, 0, 0))
        etapes = [e[0] for e in journal]
        self.assertEqual(etapes.count("connect"), 1, "une seule connexion, donc une seule transaction")
        i_offres = etapes.index("executemany")
        i_collecte = next(i for i, e in enumerate(journal)
                          if e[0] == "execute" and "INSERT INTO collectes" in e[1])
        self.assertLess(i_offres, i_collecte)
        self.assertEqual(journal[-1], ("commit",))
        self.assertEqual(journal[i_collecte][2],
                         {"lues": 7, "inserees": 2, "mises_a_jour": 0, "inchangees": 0})
        self.assertIn("clock_timestamp()", journal[i_collecte][1])

    def test_aucune_date_si_les_offres_echouent(self):
        journal: list = []
        installer_faux_psycopg(journal, echec_upsert=True)
        lignes = preparer_depuis([offre(1, "Stage")])
        with self.assertRaises(RuntimeError):
            c.ecrire_postgres(lignes, "postgresql://faux", lues=1)
        self.assertFalse(any(e[0] == "execute" and "collectes" in e[1] and "INSERT" in e[1]
                             for e in journal))
        self.assertEqual(journal[-1], ("rollback",))

    def test_une_copie_sans_changement_est_datee_aussi(self):
        journal: list = []
        installer_faux_psycopg(journal)
        c.ecrire_postgres([], "postgresql://faux", lues=0)
        self.assertTrue(any(e[0] == "execute" and "INSERT INTO collectes" in e[1] for e in journal))

    def test_la_table_existe_dans_le_schema_et_la_migration(self):
        for fichier in ("db/schema.sql", "db/migration-t6.sql"):
            sql = (RACINE / fichier).read_text(encoding="utf-8")
            bloc = re.search(r"CREATE TABLE IF NOT EXISTS collectes \((.*?)\n\);", sql, re.S)
            self.assertIsNotNone(bloc, fichier)
            colonnes = re.findall(r"^\s+(\w+)\s", bloc.group(1), re.M)
            self.assertEqual(colonnes, ["id", "terminee_a", "lues", "inserees",
                                        "mises_a_jour", "inchangees"], fichier)


# ------------------------------------------------------------------ 5. périmètre

class Perimetre(unittest.TestCase):
    def test_le_perimetre_tient_dans_une_constante(self):
        self.assertEqual(c.CONTRATS_COPIES, {"stage"})

    def test_stages_retenus_alternance_seule_ecartee(self):
        lignes = preparer_depuis([
            offre(1, "Stage"),
            offre(2, "Stage, Alternance"),          # « stage ou alternance » : retenue
            offre(3, "Alternance"),                 # hors périmètre jusqu'en janvier 2027
            offre(4, "Apprentissage"),
            offre(5, "CDI"),
            offre(6, "Stage", statut="rejected"),   # rejetée : écartée, comme dans l'export
            offre(7, "Stage", statut="applied"),    # tous les statuts sauf « rejected »
        ])
        self.assertEqual(sorted(l["pipeline_id"] for l in lignes), [1, 2, 7])

    def test_offres_sans_contrat_gardees_comme_dans_l_export(self):
        # 45 sans contrat, dont une rejetée : l'export ne regarde pas leur statut, garde les 40
        # plus récentes. On le reproduit tel quel.
        offres = [offre(100 + i, None, published_at=f"2026-09-{1 + i % 28:02d} 0{i % 10}:00",
                        statut="rejected" if i == 44 else "to_review") for i in range(45)]
        offres.append(offre(1, "Stage"))
        lignes = preparer_depuis(offres)
        sans = [l for l in lignes if not l["contract_known"]]
        self.assertEqual(len(sans), c.SANS_CONTRAT_MAX)
        attendues = sorted(offres[:45], key=lambda o: o["published_at"], reverse=True)[:40]
        self.assertEqual({l["pipeline_id"] for l in sans}, {o["id"] for o in attendues})

    def test_meme_regle_que_charger_de_l_export(self):
        # Le test de l'export, recopié à l'identique, avec « stage » pour seul mot.
        export = (RACINE / "reference" / "export_site.py").read_text(encoding="utf-8")
        self.assertIn('return "stage" in types or "alternance" in types or "apprentissage" in types',
                      export)
        self.assertIn("SANS_CONTRAT_MAX = 40", export)
        self.assertIn('default=400', export)
        # Le collecteur a son propre plafond (700) ; celui de l'export JSON reste 400.
        self.assertEqual((c.SANS_CONTRAT_MAX, c.OFFRES_MAX), (40, 700))

    def test_plafond_global_de_700(self):
        lignes = preparer_depuis([offre(i, "Stage") for i in range(1, 751)])
        self.assertEqual(len(lignes), 700)

    def test_le_plafond_ne_coupe_rien_au_volume_actuel(self):
        # 399 offres retenues le 9 novembre : toutes doivent passer, sans exception.
        lignes = preparer_depuis([offre(i, "Stage") for i in range(1, 400)])
        self.assertEqual(len(lignes), 399)


# ------------------------------------------------------------------ 6. zone

# Les cas de lieux du diff d'étape B (test_pipeline.py du pipeline) : la règle se lit dans
# `reference/`, ces cas disent ce qu'elle doit rendre. « autre » veut dire « aucune zone reconnue ».
CAS_DE_LIEUX = (
    ("Saint-Denis", "autre", "nom ambigu seul"),
    ("Saint Denis", "autre", "variante avec une espace"),
    ("Saint Ouen", "autre", "variante avec une espace"),
    ("93 - Saint-Denis", "idf", "confirmé par le département"),
    ("Saint-Denis 93200", "idf", "confirmé par le code postal"),
    ("Saint Denis 93200", "idf", "code postal, variante avec une espace"),
    ("Saint-Denis, Île-de-France", "idf", "confirmé par la région nommée"),
    ("Saint-Denis, La Réunion", "autre", "l'homonyme que la règle doit écarter"),
    ("Vitry-sur-Seine", "idf", "nom complet d'une commune d'Île-de-France"),
    ("Montigny-lès-Metz", "autre", "homonyme hors zone, non confirmé"),
    ("Toulouse", "toulouse", "commune de la zone toulousaine"),
    ("Toulouse (télétravail)", "toulouse", "la ville tranche, pas le mode de travail"),
    ("Montpellier, Occitanie", "occitanie", "la ville tranche, pas la région"),
    ("12 - Rodez", "occitanie", "département d'Occitanie"),
    ("Occitanie", "autre", "région seule : rien de certain"),
    ("Paris", "idf", "Paris"),
    ("Île-de-France", "idf", "la région seule vaut l'Île-de-France"),
    ("Télétravail", "remote", "mode de travail"),
    ("Rive Gauche", "autre", "« auch » n'est pas dans « Rive Gauche »"),
    ("Albigny", "autre", "« albi » n'est pas dans « Albigny »"),
    ("Lyon", "autre", "hors zone"),
    (None, "autre", "lieu absent"),
    ("", "autre", "lieu vide"),
)


class ZoneDuCollecteur(unittest.TestCase):
    def test_cas_de_lieux_du_diff(self):
        for lieu, attendu, pourquoi in CAS_DE_LIEUX:
            with self.subTest(lieu=lieu, pourquoi=pourquoi):
                self.assertEqual(c.zone_de(lieu), attendu)

    def test_la_zone_decide_de_la_colonne_ecrite(self):
        lignes = preparer_depuis([offre(1, "Stage", location="Montpellier, Occitanie"),
                                  offre(2, "Stage", location="Saint-Denis, La Réunion")])
        zones = {l["pipeline_id"]: l["location_zone"] for l in lignes}
        self.assertEqual(zones, {1: "occitanie", 2: "autre"})

    def test_aucune_copie_de_regex_dans_le_collecteur(self):
        source = (ICI / "collecteur_postgres.py").read_text(encoding="utf-8")
        for nom in ("ZONE_TOULOUSE", "ZONE_IDF", "ZONE_REMOTE"):
            self.assertNotIn(nom, source)
        self.assertIn("eligibility.zone_de_lieu", source)

    def test_la_regle_manquante_est_dite_et_non_devinee(self):
        import os
        ancien = os.environ.get("JOBBOT_REFERENCE")
        avec_regle = c._regle_de_zone
        try:
            with tempfile.TemporaryDirectory() as vide:
                os.environ["JOBBOT_REFERENCE"] = vide
                c._regle_de_zone = None
                with self.assertRaisesRegex(RuntimeError, "faits.py est absent"):
                    c.zone_de("Toulouse")
        finally:
            c._regle_de_zone = avec_regle
            if ancien is None:
                os.environ.pop("JOBBOT_REFERENCE", None)
            else:
                os.environ["JOBBOT_REFERENCE"] = ancien

    def test_la_comparaison_au_fichier_voit_un_desaccord(self):
        offres = [{"location": "Toulouse", "location_zone": "toulouse"},
                  {"location": "Montpellier", "location_zone": "toulouse"}]   # ancienne règle
        desaccords, zones = comparer_zones.comparer(offres)
        self.assertEqual(sum(desaccords.values()), 1)
        self.assertEqual(list(desaccords), [("Montpellier", "toulouse", "occitanie")])
        self.assertEqual(zones["occitanie"], 1)

    def test_la_comparaison_est_a_zero_sur_un_export_coherent(self):
        offres = [{"location": lieu, "location_zone": attendu} for lieu, attendu, _ in CAS_DE_LIEUX]
        desaccords, _ = comparer_zones.comparer(offres)
        self.assertEqual(sum(desaccords.values()), 0)


if __name__ == "__main__":
    unittest.main()
