/**
 * Le périmètre du produit est le stage seul (CONTRATS_COPIES du collecteur) jusqu'en janvier 2027.
 * Le site ne doit pas parler d'alternance là où personne n'en trouvera.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compterFamilles, offers } from "./offers";

const lire = (chemin: string) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");

describe("le site ne promet pas d'alternance qu'il n'a pas", () => {
  it("la collecte de référence n'en contient aucune", () => {
    expect(compterFamilles(offers).alternance).toBe(0);
  });

  it("le filtre « Alternance » n'apparaît que s'il y en a, ou s'il est déjà choisi", () => {
    const page = lire("app/offres/page.tsx");
    expect(page).toMatch(/comptesCollecte\.alternance > 0 \|\| p\.type === "alternance" \? \(\s*<Filtre/);
  });

  it("l'accroche, le pied de page et les métadonnées parlent de stage", () => {
    expect(lire("app/page.tsx")).not.toMatch(/Stages et alternances/);
    const layout = lire("app/layout.tsx");
    expect(layout).not.toMatch(/Alternance et stage|d&apos;alternance et de stage/);
  });

  it("la page profil garde ses réglages de recherche", () => {
    expect(lire("app/profil/page.tsx")).toContain('const RECHERCHES: TypeRecherche[] = ["stage", "alternance"]');
  });
});
