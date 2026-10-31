/**
 * Le rang et la séparation des offres incalculables.
 *
 * Ce qui est épinglé ici n'est pas du confort d'affichage. Un rang faux ment deux fois : sur la
 * place de l'offre, et sur le nombre d'offres auxquelles on la compare. Et une annonce sans
 * aucune technologie citée qui se glisserait dans le classement principal reviendrait à noter
 * une correspondance qu'on n'a pas pu mesurer, ce que le projet s'interdit depuis le début.
 */
import { describe, expect, it } from "vitest";
import { offers } from "./offers";
import {
  estNotable,
  rangDe,
  rangEnLettres,
  rangsPour,
  separerNotables,
  tranchePour,
} from "./classement";
import { PROFIL_DEFAUT, PROFIL_VIDE, classementPour, type Profil } from "./profil";

const PAUVRE: Profil = { ...PROFIL_VIDE, competences: ["SQL"] };

describe("le partage entre notable et incalculable", () => {
  it("ne retient que les offres citant au moins une technologie", () => {
    const classement = classementPour(PROFIL_DEFAUT);
    for (const o of offers) {
      const r = classement.get(o.id);
      expect(estNotable(r)).toBe((r?.exigences.length ?? 0) > 0);
    }
  });

  it("ne perd aucune offre en les séparant", () => {
    const { notables, incalculables } = separerNotables(PROFIL_DEFAUT, [...offers]);
    expect(notables.length + incalculables.length).toBe(offers.length);
  });

  it("ne dépend pas du profil : une annonce muette l'est pour tout le monde", () => {
    // Le caractère calculable tient à ce que dit l'annonce, jamais à ce que sait le lecteur.
    // Si ça devenait faux, deux personnes verraient des listes de tailles différentes sans
    // qu'aucune ne puisse comprendre pourquoi.
    const a = separerNotables(PROFIL_VIDE, [...offers]).incalculables.map((o) => o.id);
    const b = separerNotables(PROFIL_DEFAUT, [...offers]).incalculables.map((o) => o.id);
    expect(a).toEqual(b);
  });

  it("en trouve une part importante, ce qui justifie le bloc à part", () => {
    const { incalculables } = separerNotables(PROFIL_DEFAUT, [...offers]);
    expect(incalculables.length).toBeGreaterThan(50);
  });
});

describe("les rangs", () => {
  it("n'attribue de rang qu'aux offres notables", () => {
    const table = rangsPour(PROFIL_DEFAUT);
    const { notables, incalculables } = separerNotables(PROFIL_DEFAUT, [...offers]);
    expect(table.size).toBe(notables.length);
    for (const o of incalculables) expect(rangDe(PROFIL_DEFAUT, o.id)).toBeNull();
  });

  it("numérote de 1 à N sans trou ni doublon", () => {
    const rangs = [...rangsPour(PROFIL_DEFAUT).values()].map((r) => r.rang).sort((a, b) => a - b);
    expect(rangs[0]).toBe(1);
    expect(rangs[rangs.length - 1]).toBe(rangs.length);
    expect(new Set(rangs).size).toBe(rangs.length);
  });

  it("annonce le même dénominateur partout", () => {
    const sur = new Set([...rangsPour(PROFIL_DEFAUT).values()].map((r) => r.sur));
    expect(sur.size).toBe(1);
  });

  it("classe une meilleure note devant une moins bonne", () => {
    const classement = classementPour(PROFIL_DEFAUT);
    const table = rangsPour(PROFIL_DEFAUT);
    for (const [id, r] of table) {
      for (const [autre, s] of table) {
        const ta = classement.get(id)!.total;
        const tb = classement.get(autre)!.total;
        if (ta > tb) expect(r.rang, `${id} vs ${autre}`).toBeLessThan(s.rang);
      }
    }
  });

  it("reste stable d'un appel à l'autre", () => {
    // Deux offres à égalité de total doivent garder le même ordre, sinon la même offre change
    // de rang entre deux visites alors que rien n'a bougé.
    const a = [...rangsPour(PAUVRE).entries()].map(([id, r]) => `${id}:${r.rang}`);
    const b = [...rangsPour(PAUVRE).entries()].map(([id, r]) => `${id}:${r.rang}`);
    expect(a).toEqual(b);
  });

  it("suit le profil : enrichir son profil change les places", () => {
    const vide = rangsPour(PROFIL_VIDE);
    const riche = rangsPour(PROFIL_DEFAUT);
    const bouge = [...riche.entries()].filter(([id, r]) => vide.get(id)?.rang !== r.rang);
    expect(bouge.length).toBeGreaterThan(0);
  });
});

describe("la mise en mots", () => {
  it("écrit la première place correctement en français", () => {
    expect(rangEnLettres({ rang: 1, sur: 191 })).toBe("1re sur 191");
    expect(rangEnLettres({ rang: 3, sur: 191 })).toBe("3e sur 191");
  });

  it("ne qualifie pas une place au-delà de la moitié", () => {
    // Dire « dans les 80 % du bas » serait exact et ne rendrait service à personne.
    expect(tranchePour({ rang: 5, sur: 191 })).toBe("dans les 5 % les mieux placées");
    expect(tranchePour({ rang: 40, sur: 191 })).toBe("dans le premier quart");
    expect(tranchePour({ rang: 180, sur: 191 })).toBeNull();
  });
});
