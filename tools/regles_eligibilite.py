#!/usr/bin/env python3
"""Rend, pour une liste de cas, ce que le moteur répond : durée, rémunération, lecture du contrat.

    echo '{"fonction": "parse_duration", "cas": ["4 à 6 mois", 12, null]}' | python3 tools/regles_eligibilite.py
    -> [[4.0, 6.0], [12.0, 12.0], null]

Entrée : un objet JSON `{"fonction": ..., "cas": [...]}` sur l'entrée standard, en UTF-8. Sortie : un
tableau JSON de même longueur. C'est le moteur lui-même (`reference/eligibility.py`), pas une copie :
`lib/regles-eligibilite.test.ts` s'en sert pour comparer le portage TypeScript (`lib/regles-eligibilite.ts`)
sans recopier aucune règle. Même principe que `tools/zones_de_lieux.py`.

Fonctions :
  parse_duration    cas : valeur (texte, nombre, null)  -> [min, max] en mois, ou null
  offer_duration    cas : offre                          -> {"mois": [min, max], "origine": "champ" | "dates"} ou null
  is_unpaid         cas : offre                          -> booléen
  lecture_contrat   cas : offre                          -> {"genre": "declare" | "lu" | "incompatible" | "inconnu", ...}
                    passe par `eligibility.check` lui-même et lit la raison qu'il écrit sur le contrat
  contrat_inconnu   cas : offre                          -> booléen
  est_stage         cas : offre                          -> booléen
  faits_stage       cas : ignorés                        -> les valeurs de `faits.STAGE` et les termes du profil de stage
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "reference"))

import eligibility  # noqa: E402
import faits  # noqa: E402

PROFIL = eligibility.PROFILE_STAGE_2027
# Un profil qui ne contraint que le contrat : `check` écrit alors la raison du contrat comme à l'ordinaire,
# et on la lit. Les autres critères (zone, début, durée) écrivent d'autres raisons, qu'on ignore.
PROFIL_CONTRAT = eligibility.Profile(name="CONTRAT_SEUL", contract_terms=PROFIL.contract_terms)

RAISON_LU = re.compile(r"^contrat lu dans (le titre|la description) \('(.*)'\)$")


def lecture_contrat(offre: dict) -> dict:
    for raison in eligibility.check(offre, PROFIL_CONTRAT).reasons:
        if m := RAISON_LU.match(raison):
            return {"genre": "lu", "champ": "title" if m[1] == "le titre" else "description", "terme": m[2]}
        if raison.startswith("type de contrat incompatible"):
            return {"genre": "incompatible"}
        if raison.startswith("type de contrat inconnu"):
            return {"genre": "inconnu"}
    return {"genre": "declare"}


def duree(valeur) -> list | None:
    d = eligibility.parse_duration(valeur)
    return None if d is None else list(d)


def offer_duration(offre: dict) -> dict | None:
    duree, origine = eligibility.offer_duration(offre)
    if duree is None:
        return None
    return {"mois": list(duree), "origine": "dates" if origine.startswith("durée déduite") else "champ"}


def faits_stage(_cas: list) -> dict:
    stage = faits.STAGE
    return {
        "debut_iso": stage["debut_iso"],
        "fin_max_iso": stage["fin_max_iso"],
        "duree_min": stage["duree_min"],
        "duree_max": stage["duree_max"],
        "termes": list(PROFIL.contract_terms),
    }


FONCTIONS = {
    "parse_duration": lambda cas: [duree(v) for v in cas],
    "offer_duration": lambda cas: [offer_duration(o) for o in cas],
    "is_unpaid": lambda cas: [eligibility.is_unpaid(o) for o in cas],
    "lecture_contrat": lambda cas: [lecture_contrat(o) for o in cas],
    "contrat_inconnu": lambda cas: [eligibility.contrat_inconnu(o) for o in cas],
    "est_stage": lambda cas: [eligibility.est_stage(o) for o in cas],
    "faits_stage": faits_stage,
}


def main() -> int:
    demande = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    fonction = FONCTIONS.get(demande["fonction"])
    if fonction is None:
        sys.stderr.write(f"fonction inconnue : {demande['fonction']!r}\n")
        return 2
    sys.stdout.buffer.write(json.dumps(fonction(demande["cas"]), ensure_ascii=False).encode("utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
