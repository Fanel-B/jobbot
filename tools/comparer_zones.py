#!/usr/bin/env python3
"""Compare, sur tous les lieux d'un export, la zone du collecteur et `location_zone` du fichier.

    python3 tools/comparer_zones.py                         # data/offers.json
    python3 tools/comparer_zones.py /chemin/export.json     # un autre export

Pour chaque offre, la zone que le collecteur écrirait dans Neon (`collecteur_postgres.zone_de`, qui
exécute `reference/eligibility.zone_de_lieu`) est comparée à la `location_zone` que le pipeline a
écrite dans l'export. **Zéro désaccord est exigé** après chaque resynchronisation de `reference/`
(voir DEPLOIEMENT.md) : un désaccord veut dire que la base et le fichier afficheraient deux zones
différentes pour la même offre.

Code de sortie : 0 s'il n'y a aucun désaccord, 1 sinon, 2 si la règle ne peut pas s'exécuter.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import collecteur_postgres as collecteur  # noqa: E402

PAR_DEFAUT = Path(__file__).resolve().parent.parent / "data" / "offers.json"


def comparer(offres: list[dict]) -> tuple[Counter, Counter]:
    """(lieux en désaccord avec leur couple (attendu, calculé), zones vues)."""
    desaccords: Counter = Counter()
    zones: Counter = Counter()
    for offre in offres:
        calcule = collecteur.zone_de(offre.get("location"))
        zones[calcule] += 1
        if calcule != offre.get("location_zone"):
            desaccords[(offre.get("location"), offre.get("location_zone"), calcule)] += 1
    return desaccords, zones


def main(argv: list[str]) -> int:
    chemin = Path(argv[1]) if len(argv) > 1 else PAR_DEFAUT
    offres = json.loads(chemin.read_text(encoding="utf-8"))["offers"]
    try:
        desaccords, zones = comparer(offres)
    except RuntimeError as erreur:
        print(f"Impossible de comparer : {erreur}", file=sys.stderr)
        return 2

    lieux = len({o.get("location") for o in offres})
    print(f"Export : {chemin}")
    print(f"Offres comparées : {len(offres)} ({lieux} lieux distincts)")
    print("Zones du collecteur : " + ", ".join(f"{z} {n}" for z, n in sorted(zones.items())))
    total = sum(desaccords.values())
    print(f"Désaccords : {total}")
    for (lieu, attendu, calcule), n in desaccords.most_common(40):
        print(f"  {n:>3} × {lieu!r} : fichier {attendu!r}, collecteur {calcule!r}")
    return 0 if total == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
