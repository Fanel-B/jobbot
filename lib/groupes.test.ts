/**
 * Le regroupement ne doit jamais faire mentir le total.
 *
 * Deux invariants comptent ici, et ils ne se voient pas à l'oeil sur un écran :
 *
 * 1. La somme des deux sous-totaux vaut le total. Si elle ne le vaut pas, la page affiche une
 *    addition fausse, ce qui est exactement la promesse que le produit prétend tenir.
 * 2. Chaque critère produit par le moteur est rangé. Un critère ajouté côté Python et oublié ici
 *    tomberait dans « l'annonce » par défaut : le total resterait juste, mais un critère
 *    personnel serait présenté comme une propriété de l'annonce. Le test le signale par son nom.
 *
 * Les deux sont vérifiés sur les 290 offres réelles, pas sur un exemple fabriqué.
 */
import { describe, expect, it } from "vitest";
import { offers } from "./offers";
import {
  CRITERES_ANNONCE,
  CRITERES_CONSTANTS,
  CRITERES_TOI,
  enDeuxGroupes,
  estConstant,
  groupeDe,
} from "./groupes";
import { PROFIL_DEFAUT, classementPour } from "./profil";

const bulletins = offers
  .map((o) => classementPour(PROFIL_DEFAUT).get(o.id)?.breakdown)
  .filter((b): b is NonNullable<typeof b> => Boolean(b && b.length));

describe("la partition des critères", () => {
  it("couvre tout ce que le moteur produit", () => {
    const vus = new Set<string>();
    for (const b of bulletins) for (const l of b) vus.add(l.critere);

    const orphelins = [...vus].filter((c) => groupeDe(c) === null).sort();
    expect(orphelins).toEqual([]);
  });

  it("ne range aucun critère dans les deux groupes", () => {
    const doublons = CRITERES_TOI.filter((c) =>
      (CRITERES_ANNONCE as readonly string[]).includes(c),
    );
    expect(doublons).toEqual([]);
  });

  it("ne cite aucun critère que le moteur ne produit jamais", () => {
    const vus = new Set<string>();
    for (const b of bulletins) for (const l of b) vus.add(l.critere);

    const fantomes = [...CRITERES_TOI, ...CRITERES_ANNONCE].filter((c) => !vus.has(c));
    expect(fantomes).toEqual([]);
  });
});

describe("l'addition tient sur les 290 offres", () => {
  it("fait du total la somme des deux sous-totaux", () => {
    for (const b of bulletins) {
      const r = enDeuxGroupes(b);
      expect(r.toi.points + r.annonce.points, JSON.stringify(b.map((l) => l.critere))).toBe(
        r.total,
      );
      expect(r.toi.max + r.annonce.max).toBe(r.max);
    }
  });

  it("ne perd ni ne duplique aucune ligne", () => {
    for (const b of bulletins) {
      const r = enDeuxGroupes(b);
      expect(r.toi.lignes.length + r.annonce.lignes.length).toBe(b.length);
    }
  });

  it("retrouve le total que le moteur a calculé", () => {
    // La garantie qui compte : le chiffre affiché reste celui du moteur Python, celui que
    // `npm run verifier-scoring` compare. Regrouper n'est pas recalculer.
    for (const o of offers) {
      const r = classementPour(PROFIL_DEFAUT).get(o.id);
      if (!r?.breakdown?.length) continue;
      expect(enDeuxGroupes(r.breakdown).total, String(o.id)).toBe(r.total);
    }
  });
});

describe("les critères qui ne départagent rien", () => {
  it("rendent bien une valeur unique sur toute la collecte", () => {
    // C'est la mesure qui justifie de les griser. Si l'un d'eux se mettait à varier, la mention
    // « ne départage aucune offre » deviendrait fausse et ce test tomberait.
    for (const critere of CRITERES_CONSTANTS) {
      const valeurs = new Set<number>();
      for (const b of bulletins) {
        const l = b.find((x) => x.critere === critere);
        if (l) valeurs.add(l.points);
      }
      expect([...valeurs], `${critere} varie`).toHaveLength(1);
    }
  });

  it("se reconnaissent, et eux seuls", () => {
    expect(estConstant("diversité")).toBe(true);
    expect(estConstant("dossier")).toBe(true);
    expect(estConstant("cohérence")).toBe(false);
  });
});
