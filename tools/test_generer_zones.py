"""Le fichier `lib/zones.generees.ts` committé doit être celui que `generer_zones.py` produit aujourd'hui.

Si `reference/faits.py` change (une commune, un département, des points) sans que le fichier
TypeScript soit régénéré, le site et le moteur ne lisent plus les mêmes zones. Ce test échoue alors
avec la commande à lancer. `lib/zones-regle.test.ts` fait la même comparaison côté TypeScript.
"""

import sys
import unittest
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

import generer_zones  # noqa: E402


class ZonesGenerees(unittest.TestCase):
    def test_le_fichier_committe_est_celui_de_faits(self):
        attendu = generer_zones.produire()
        actuel = generer_zones.SORTIE.read_bytes().decode("utf-8").replace("\r\n", "\n")
        self.assertEqual(
            actuel, attendu,
            "lib/zones.generees.ts diverge de reference/faits.py : lancer `python3 tools/generer_zones.py`",
        )

    def test_toutes_les_zones_du_moteur_sont_generees(self):
        faits, eligibility, _ = generer_zones.lire_reference()
        texte = generer_zones.produire()
        for nom in faits.ZONES_ORDRE:
            self.assertIn(f"  {nom}: {{", texte)
        for nom in eligibility.ZONES_ELIGIBLES:
            self.assertIn(f'"{nom}"', texte)


if __name__ == "__main__":
    unittest.main()
