/**
 * Les pages et les composants lisent les offres par `chargerDonnees()`, jamais par les constantes
 * `offers` et `meta` de `lib/offers.ts`, qui sont le fichier et seulement lui.
 *
 * Importer une de ces constantes dans une page ferait lire `data/offers.json` même quand
 * `OFFERS_SOURCE=db`, sans aucune erreur : l'écran mêlerait deux collectes. Ce test lit les sources.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const INTERDITS = [
  "offers",
  "meta",
  "offresAvecContrat",
  "offresSansContrat",
  "structureBulletin",
  "referenceCollecte",
];

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.(ts|tsx)$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

/** Les noms importés de "@/lib/offers", sans les types. */
function importes(source: string): string[] {
  const noms: string[] = [];
  const re = /import\s*\{([^}]*)\}\s*from\s*"@\/lib\/offers"/g;
  for (const m of source.matchAll(re)) {
    for (const brut of m[1].split(",")) {
      const nom = brut.trim();
      if (nom && !nom.startsWith("type ")) noms.push(nom.split(/\s+as\s+/)[0]);
    }
  }
  return noms;
}

describe("aucune page ne lit les offres du fichier directement", () => {
  const cibles = [...fichiers(join(RACINE, "app")), ...fichiers(join(RACINE, "components"))];

  it("il y a des fichiers à examiner", () => {
    expect(cibles.length).toBeGreaterThan(10);
  });

  it("le détecteur voit bien un import interdit", () => {
    const faux = 'import { offers, type Offer, sourceLabel } from "@/lib/offers";';
    expect(importes(faux).filter((n) => INTERDITS.includes(n))).toEqual(["offers"]);
  });

  for (const chemin of cibles) {
    it(relative(RACINE, chemin).split(sep).join("/"), () => {
      const pris = importes(readFileSync(chemin, "utf8")).filter((n) => INTERDITS.includes(n));
      expect(pris, "passer par chargerDonnees() de lib/donnees.ts").toEqual([]);
    });
  }
});
