/**
 * Tests de la description du bulletin.
 *
 * Le site a longtemps annoncé « neuf critères ». Le pipeline en a ajouté — diplôme exigé,
 * prérequis métier, dates, bloqueurs administratifs — et la phrase est restée, devenue fausse,
 * sans que rien ne la signale. Ces tests verrouillent la propriété qui compte : ce que le site
 * raconte du bulletin se déduit des données, et ne peut plus se périmer en silence.
 */
import { describe, expect, it } from "vitest";
import { enLettres, offers, structureBulletin } from "./offers";

describe("la structure du bulletin est lue dans les données", () => {
  it("sépare les critères notés des lignes d'ajustement", () => {
    expect(structureBulletin.notes.length).toBeGreaterThan(0);
    expect(structureBulletin.ajustements.length).toBeGreaterThan(0);
    // Aucun nom ne peut être des deux côtés.
    const croisement = structureBulletin.notes.filter((n) =>
      structureBulletin.ajustements.includes(n),
    );
    expect(croisement).toEqual([]);
  });

  it("les critères notés ont un maximum, les ajustements n'en ont pas", () => {
    const maxParCritere = new Map<string, number>();
    for (const o of offers) {
      for (const b of o.score_breakdown ?? []) {
        if (!maxParCritere.has(b.critere)) maxParCritere.set(b.critere, b.max);
      }
    }
    for (const n of structureBulletin.notes) expect(maxParCritere.get(n), n).toBeGreaterThan(0);
    for (const a of structureBulletin.ajustements) expect(maxParCritere.get(a), a).toBe(0);
  });

  it("la somme des maximums annoncée est celle de chaque offre", () => {
    const sommes = new Set(
      offers.map((o) => (o.score_breakdown ?? []).reduce((s, b) => s + b.max, 0)),
    );
    expect([...sommes]).toEqual([structureBulletin.total]);
  });

  it("les ajustements peuvent retirer des points — c'est ce qui les distingue", () => {
    const negatifs = offers.flatMap((o) =>
      (o.score_breakdown ?? []).filter((b) => b.max === 0 && b.points < 0),
    );
    expect(negatifs.length).toBeGreaterThan(0);
  });
});

describe("enLettres", () => {
  it("écrit les nombres utiles aux phrases du site", () => {
    expect(enLettres(9)).toBe("neuf");
    expect(enLettres(5)).toBe("cinq");
    expect(enLettres(14)).toBe("quatorze");
  });

  it("retombe sur le chiffre au-delà de sa table, plutôt que de rendre « undefined »", () => {
    expect(enLettres(42)).toBe("42");
  });
});
