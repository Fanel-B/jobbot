#!/usr/bin/env python3
"""Génère `lib/zones.generees.ts` depuis `reference/faits.py`, la déclaration unique des zones.

    python3 tools/generer_zones.py              # écrit lib/zones.generees.ts
    python3 tools/generer_zones.py --verifier   # code 1 si le fichier diverge de faits.py
    python3 tools/generer_zones.py --stdout     # affiche ce qui serait écrit (utilisé par le test)

Pourquoi un script : les communes, les départements et les points de chaque zone vivent dans
`reference/faits.py` (décision de Fanel du 06/11/2026, une seule déclaration). Le site TypeScript
les recopiait à la main dans trois listes qui ne se parlaient pas, et c'est ainsi que « Rive Gauche »
valait des points d'Occitanie. Ici rien n'est recopié : le fichier TypeScript est **produit** par
Python à partir du module que le pipeline lit lui-même.

Garde-fous :
  · `lib/zones.test.ts` exécute `--stdout` et échoue si le fichier committé diverge ;
  · `tools/test_generer_zones.py` fait la même comparaison côté Python (étape « python3 -m unittest »
    de la CI) ;
  · la règle de lecture de ces listes (`_motif_zone`, `_zone_du_texte`...) est portée dans
    `lib/eligibilite.ts` et vérifiée sur chaque offre par `npm run verifier-eligibility`.

Seules les listes sont générées ici. Les motifs (expressions régulières) sont construits côté
TypeScript, comme `eligibility.py` les construit côté Python.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
REFERENCE = RACINE / "reference"
SORTIE = RACINE / "lib" / "zones.generees.ts"

# Ordre des champs d'une zone dans le fichier produit, et leur forme : une liste ou un scalaire.
CHAMPS_LISTES = ("villes", "departements", "regions_englobantes", "region_propre", "ambigus")
LARGEUR = 100


def lire_reference():
    """(faits, eligibility, scoring) importés depuis `reference/`, exactement comme le pipeline."""
    sys.path.insert(0, str(REFERENCE))
    import eligibility  # noqa: E402
    import faits  # noqa: E402
    import scoring  # noqa: E402

    return faits, eligibility, scoring


def chaine(valeur: str) -> str:
    """Une chaîne TypeScript entre guillemets, accents conservés (le fichier est en UTF-8)."""
    return json.dumps(valeur, ensure_ascii=False)


def liste(valeurs, indentation: int) -> str:
    """Une liste, sur une ligne si elle tient, sinon repliée à `LARGEUR` colonnes."""
    elements = [chaine(v) for v in valeurs]
    if not elements:
        return "[]"
    une_ligne = "[" + ", ".join(elements) + "]"
    if indentation + len(une_ligne) + 1 <= LARGEUR:
        return une_ligne
    marge = " " * (indentation + 2)
    lignes, courante = [], marge
    for element in elements:
        morceau = element + ","
        if courante.strip() and len(courante) + len(morceau) + 1 > LARGEUR:
            lignes.append(courante.rstrip())
            courante = marge
        courante += morceau + " "
    lignes.append(courante.rstrip())
    return "[\n" + "\n".join(lignes) + "\n" + " " * indentation + "]"


def produire() -> str:
    faits, eligibility, scoring = lire_reference()
    noms = tuple(faits.ZONES_ORDRE)

    # Un nom d'ordre qui n'est pas déclaré, ou une zone déclarée hors ordre, est une erreur de faits.py :
    # on s'arrête plutôt que de générer un fichier à moitié juste.
    if set(noms) != set(faits.ZONES):
        raise SystemExit(f"faits.ZONES_ORDRE {noms} ne cite pas exactement faits.ZONES {tuple(faits.ZONES)}")
    eligibles = tuple(eligibility.ZONES_ELIGIBLES)
    if not set(eligibles) <= set(noms):
        raise SystemExit(f"eligibility.ZONES_ELIGIBLES {eligibles} cite une zone inconnue de faits.py")

    sortie = [
        "/**",
        " * GÉNÉRÉ par `tools/generer_zones.py` depuis `reference/faits.py`. NE PAS MODIFIER À LA MAIN.",
        " *",
        " * Régénérer : `python3 tools/generer_zones.py`. `lib/zones.test.ts` échoue si ce fichier diverge de",
        " * `faits.py` : une zone s'ajoute ou se corrige là-bas, puis ici par le script, jamais l'inverse.",
        " * La règle qui lit ces listes est dans `lib/eligibilite.ts` (`zoneDe`).",
        " */",
        "",
        f"export const ZONES_ORDRE = [{', '.join(chaine(n) for n in noms)}] as const;",
        "export type NomZoneFaits = (typeof ZONES_ORDRE)[number];",
        "",
        "/** Les zones où l'on accepte une offre (le télétravail n'en fait pas partie), `eligibility.ZONES_ELIGIBLES`. */",
        f"export const ZONES_ELIGIBLES: readonly NomZoneFaits[] = [{', '.join(chaine(n) for n in eligibles)}];",
        "",
        "/** Points d'un lieu qui ne se range dans aucune zone, `scoring.LOCATION_DEFAULT`. */",
        f"export const POINTS_LIEU_AUTRE = {int(scoring.LOCATION_DEFAULT)};",
        "",
        "export interface ZoneFaits {",
        "  libelle: string;",
        "  points: number;",
        "  villes: readonly string[];",
        "  departements: readonly string[];",
        "  regions_englobantes: readonly string[];",
        "  region_propre: readonly string[];",
        "  ambigus: readonly string[];",
        "}",
        "",
        "export const ZONES_FAITS: Record<NomZoneFaits, ZoneFaits> = {",
    ]
    for nom in noms:
        zone = faits.ZONES[nom]
        sortie.append(f"  {nom}: {{")
        sortie.append(f"    libelle: {chaine(zone['libelle'])},")
        sortie.append(f"    points: {int(zone['points'])},")
        for champ in CHAMPS_LISTES:
            sortie.append(f"    {champ}: {liste(zone.get(champ, ()), 4)},")
        sortie.append("  },")
    sortie.append("};")
    return "\n".join(sortie) + "\n"


def main(argv: list[str]) -> int:
    contenu = produire()
    if "--stdout" in argv:
        sys.stdout.buffer.write(contenu.encode("utf-8"))
        return 0
    if "--verifier" in argv:
        actuel = SORTIE.read_bytes().decode("utf-8").replace("\r\n", "\n") if SORTIE.exists() else None
        if actuel == contenu:
            print(f"{SORTIE.relative_to(RACINE)} est à jour avec reference/faits.py")
            return 0
        print(f"{SORTIE.relative_to(RACINE)} diverge de reference/faits.py : lancer "
              f"`python3 tools/generer_zones.py`", file=sys.stderr)
        return 1
    SORTIE.write_bytes(contenu.encode("utf-8"))
    print(f"écrit : {SORTIE.relative_to(RACINE)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
