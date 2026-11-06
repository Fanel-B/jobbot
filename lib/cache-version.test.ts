/**
 * Les caches de classement par profil (`classementPour` dans lib/profil.ts, `cacheRangs` dans
 * lib/classement.ts) doivent changer quand les données changent.
 *
 * Indexés par le profil seul, ils resservaient après une copie du collecteur le classement
 * calculé sur les offres d'avant : une offre retirée gardait son rang, une nouvelle n'en avait
 * pas, et le dénominateur « sur 191 » restait faux. Ce test simule une copie qui retire une
 * offre, avec le même profil, et vérifie que tout est recalculé.
 */
import { describe, expect, it } from "vitest";
import { rangsPour } from "./classement";
import { donneesFichier, type Donnees } from "./offers";
import { PROFIL_DEFAUT, classementPour, cleClassement } from "./profil";

const AVANT = donneesFichier();

/** La collecte suivante : la même, moins l'offre la mieux classée, avec une autre version. */
function copieSuivante(d: Donnees, retiree: number): Donnees {
  const offers = d.offers.filter((o) => o.id !== retiree);
  return {
    offers,
    meta: { ...d.meta, generated_at: "2026-11-06T09:00:00+00:00", count: offers.length },
    version: "db:2026-11-06T09:00:00+00:00:" + offers.length,
  };
}

describe("les caches de classement suivent la version des données", () => {
  const profil = PROFIL_DEFAUT;
  const rangsAvant = rangsPour(AVANT, profil);
  const premiere = [...rangsAvant.entries()].find(([, r]) => r.rang === 1)![0];
  const APRES = copieSuivante(AVANT, premiere);

  it("la clé contient la version", () => {
    expect(cleClassement(AVANT, profil)).not.toBe(cleClassement(APRES, profil));
  });

  it("une offre retirée par la copie n'est plus classée", () => {
    expect(classementPour(AVANT, profil).has(premiere)).toBe(true);
    expect(classementPour(APRES, profil).has(premiere)).toBe(false);
  });

  it("les rangs sont recalculés : l'offre retirée sort, le dénominateur baisse", () => {
    const rangsApres = rangsPour(APRES, profil);
    expect(rangsApres.has(premiere)).toBe(false);
    const un = [...rangsApres.values()][0];
    expect(un.sur).toBe([...rangsAvant.values()][0].sur - 1);
    // La deuxième d'avant devient la première.
    const deuxieme = [...rangsAvant.entries()].find(([, r]) => r.rang === 2)![0];
    expect(rangsApres.get(deuxieme)?.rang).toBe(1);
  });

  it("à version égale, le cache resert le même calcul", () => {
    expect(classementPour(AVANT, profil)).toBe(classementPour(AVANT, profil));
    expect(rangsPour(AVANT, profil)).toBe(rangsPour(AVANT, profil));
  });
});
