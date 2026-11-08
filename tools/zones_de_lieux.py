#!/usr/bin/env python3
"""Rend, pour une liste de lieux, la zone et les points du moteur : `zone_de_lieu` et `location_score`.

    echo '["Saint-Denis 93200", "Rive Gauche"]' | python3 tools/zones_de_lieux.py
    -> [["idf", 13.0], ["autre", 3.0]]

Entrée : un tableau JSON de lieux (chaînes ou null) sur l'entrée standard, en UTF-8. Sortie : un tableau
de [zone, points] dans le même ordre. C'est le moteur lui-même (`reference/eligibility.py` et
`reference/scoring.py`), pas une copie : `lib/zones-regle.test.ts` s'en sert pour comparer le portage
TypeScript à la règle sur plusieurs centaines de lieux, sans qu'aucune liste ne soit recopiée.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "reference"))

import eligibility  # noqa: E402
import scoring  # noqa: E402


def main() -> int:
    lieux = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    rendu = [[eligibility.zone_de_lieu(lieu), scoring.location_score({"location": lieu})] for lieu in lieux]
    sys.stdout.buffer.write(json.dumps(rendu, ensure_ascii=False).encode("utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
