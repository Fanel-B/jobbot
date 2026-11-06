/**
 * La mention « plus de 24 heures » du pied de page, et la façon dont elle est rendue.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { depuisEnClair, heuresDepuisCollecte, mentionCollecteAncienne } from "./collecte";

const COLLECTE = "2026-10-25T17:41:17+00:00";
const t = Date.parse(COLLECTE);
const H = 3_600_000;

describe("la mention de collecte ancienne", () => {
  it("se tait pendant les 24 premières heures", () => {
    expect(mentionCollecteAncienne(COLLECTE, t)).toBeNull();
    expect(mentionCollecteAncienne(COLLECTE, t + 23 * H)).toBeNull();
    expect(mentionCollecteAncienne(COLLECTE, t + 24 * H)).toBeNull();
  });

  it("parle au-delà, en heures puis en jours", () => {
    expect(mentionCollecteAncienne(COLLECTE, t + 30 * H)).toBe(
      "Ces offres ont plus de 24 heures : dernière collecte il y a 30 heures.",
    );
    // Le 6 novembre au matin, la collecte du 25 octobre a onze jours.
    expect(mentionCollecteAncienne(COLLECTE, Date.parse("2026-11-06T09:00:00Z"))).toBe(
      "Ces offres ont plus de 24 heures : dernière collecte il y a 11 jours.",
    );
  });

  it("ne devine rien sur une date illisible", () => {
    expect(heuresDepuisCollecte("pas une date", t)).toBeNull();
    expect(mentionCollecteAncienne("pas une date", t + 100 * H)).toBeNull();
    expect(depuisEnClair(47.9)).toBe("il y a 47 heures");
    expect(depuisEnClair(48)).toBe("il y a 2 jours");
  });
});

describe("l'heure courante n'est jamais lue au pré-rendu", () => {
  const composant = readFileSync(new URL("../components/AgeCollecte.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

  it("le composant attend la requête avant de lire l'horloge", () => {
    const attente = composant.indexOf("await connection()");
    const horloge = composant.indexOf("Date.now()");
    expect(attente).toBeGreaterThan(0);
    expect(horloge).toBeGreaterThan(attente);
  });

  it("le layout le place sous un Suspense et ne lit pas l'horloge lui-même", () => {
    expect(layout).toMatch(/<Suspense fallback=\{null\}>\s*<AgeCollecte generatedAt=\{meta\.generated_at\} \/>/);
    expect(layout).not.toMatch(/Date\.now\(\)|new Date\(\)/);
  });
});
