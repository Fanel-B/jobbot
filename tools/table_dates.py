#!/usr/bin/env python3
"""Table de chaînes de dates, calculée avec le vrai `parse_date` de `reference/eligibility.py`.

    python3 tools/table_dates.py > lib/dates.table.json

`lib/dates.test.ts` compare `parseDate` (lib/dates.ts) à cette table, entrée par entrée. Chaque
valeur attendue vient de Python, jamais de ce que le TypeScript devrait rendre.

`parse_date` est extrait du source plutôt qu'importé : `eligibility.py` importe `faits.py`, qui
n'est pas dans `reference/` tant que le pipeline ne l'a pas fourni en entier. Le jour où il y est,
l'import direct marchera ; l'extraction rend le même code (de `_norm` à `parse_duration` exclu).

Valeurs attendues :
  "AAAA-MM-JJ"   une date lue
  "asap"         « dès que possible »
  null           texte illisible
  "ValueError"   Python lève (date impossible, comme « 2026-13-01 ») : la version publiée de
                 `note_date` plante alors sur cette offre. Le TypeScript la refuse (null).
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

SOURCE = Path(__file__).resolve().parent.parent / "reference" / "eligibility.py"

# Chaque entrée est une vraie forme vue dans les annonces, ou un piège identifié.
ENTREES = [
    # ISO et variantes numériques
    "2027-03-29", "2026-09-01", "2027-03", "2027-3-5", "2027-03-29T09:00:00", "2027-03-29 00:00:00",
    "29/03/2027", "1/3/2027", "03/2027", "3/2027", "le 29/03/2027", "à partir du 01/04/2027",
    # mois en toutes lettres, avec ou sans jour, accents, casse
    "septembre 2026", "Septembre 2026", "SEPTEMBRE 2026", "février 2028", "Février 2028", "août 2027",
    "Aout 2027", "décembre 2026", "1er mars 2027", "1er Mars 2027", "15 mars 2027", "5 juin 2027",
    "début novembre 2027", "fin août 2027", "à partir de novembre 2027", "mi-juin 2027",
    # abréviations
    "sept. 2027", "sept 2027", "Sept. 2027", "janv. 2027", "janv 2027", "fev 2027", "avr. 2027",
    "juil. 2027", "15 juil. 2027", "oct. 2027", "nov. 2027", "nov 2027", "dec 2026", "déc. 2026",
    # anglais
    "March 2027", "march 2027", "1 March 2027", "June 2027", "January 2027", "December 2026",
    "September 2027", "August 2027",
    # « may » est absent de la table de Python : il ne se lit pas
    "May 2027", "1 May 2027", "mai 2027", "1er mai 2027",
    # dès que possible : testé avant toute date
    "asap", "ASAP", "As soon as possible asap", "dès que possible", "Dès que possible", "immédiat",
    "immédiatement", "au plus vite", "ASAP - mars 2027", "dès que possible (avril 2027)",
    # illisible ou absent
    "", "   ", "à convenir", "A convenir", "selon profil", "2027", "T3 2027", "été 2027",
    "printemps 2027", "bientôt", "n/a", "non précisé", "septembre", "mars", "sans objet 2027",
    # mois inconnu suivi d'une année
    "foo 2027", "mai. 2027", "sep 2027", "mars. 2027",
    # dates qui n'existent pas : Python lève ValueError
    "2026-13-01", "2027-02-30", "2027-04-31", "31/04/2027", "29/02/2027", "01/13/2027", "00/2027",
    "13/2027", "0/2027", "2027-00-10", "2027-05-00", "0000-01-01", "29 février 2027", "31 avril 2027",
    "0 mars 2027", "32 mars 2027",
    # dates qui existent de justesse
    "29/02/2028", "29 février 2028", "2028-02-29", "31/12/2027", "2027-12-31", "1/1/2027",
    # années à quatre chiffres atypiques
    "0099-01-01", "9999-12-31", "mars 0099", "1900-01-01",
]


def charger_parse_date():
    source = SOURCE.read_text(encoding="utf-8").split("\n")
    debut = next(i for i, ligne in enumerate(source) if ligne.startswith("def _norm"))
    fin = next(i for i, ligne in enumerate(source) if ligne.startswith("# --- Parsing de durée"))
    espace = {"re": re, "unicodedata": unicodedata, "date": date}
    exec("\n".join(source[debut:fin]), espace)  # noqa: S102  (source du dépôt, jamais une entrée)
    return espace["parse_date"]


def attendu(parse_date, entree):
    try:
        lue = parse_date(entree)
    except ValueError:
        return "ValueError"
    if isinstance(lue, date):
        return lue.isoformat()
    return lue            # "asap" ou None


def main() -> int:
    parse_date = charger_parse_date()
    table = [{"entree": e, "attendu": attendu(parse_date, e)} for e in ENTREES]
    # None (champ absent) : le seul cas où l'entrée n'est pas une chaîne.
    table.append({"entree": None, "attendu": attendu(parse_date, None)})
    json.dump({"source": "reference/eligibility.py, parse_date", "table": table},
              sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
