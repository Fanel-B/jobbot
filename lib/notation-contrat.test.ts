/**
 * Le contrat de données de la notation T4 : le palier, la comparaison exacte des ratios, la note sur
 * 100, et les incohérences qu'une notation mal formée doit déclencher. Données synthétiques.
 */
import { describe, expect, it } from "vitest";
import { comparerRatios, incoherences, noteSur100, palierDe, type NotationOffre } from "./notation-contrat";
import { offreDomaine, offreNonEvaluee, offreOutils, qualiteExemple } from "./notation-exemples";

const compat = (couvertes: number, exigees: number) => {
  const c = offreOutils(1, couvertes, exigees).compatibilite;
  if (c.etat !== "evaluee") throw new Error("inattendu");
  return c;
};

describe("palierDe : des tranches de 10 calculées en entiers", () => {
  const cas: [number, number, number][] = [
    [0, 3, 0],
    [1, 3, 30],
    [2, 3, 60],
    [3, 3, 100],
    [1, 10, 10],
    [3, 10, 30],
    [7, 10, 70],
    [29, 100, 20],
    [3, 4, 70],
    [1, 1, 100],
    [0, 1, 0],
    [9, 10, 90],
  ];
  it.each(cas)("%i sur %i : palier %i", (couvertes, exigees, palier) => {
    expect(palierDe(compat(couvertes, exigees))).toBe(palier);
  });
});

describe("comparerRatios : exact, par produit en croix", () => {
  it("deux fractions égales sont égales", () => {
    expect(comparerRatios(compat(2, 4), compat(1, 2))).toBe(0);
    expect(comparerRatios(compat(3, 9), compat(1, 3))).toBe(0);
  });
  it("le signe dit le plus grand", () => {
    expect(comparerRatios(compat(2, 3), compat(3, 5))).toBeGreaterThan(0);
    expect(comparerRatios(compat(3, 5), compat(2, 3))).toBeLessThan(0);
  });
  it("sépare des ratios que les flottants confondraient presque", () => {
    expect(comparerRatios(compat(1, 3), compat(333_333, 1_000_000))).toBeGreaterThan(0);
  });
});

describe("noteSur100 : le ratio arrondi, absente pour un domaine seul", () => {
  it("arrondit à l'entier", () => {
    expect(noteSur100(compat(2, 3))).toBe(67);
    expect(noteSur100(compat(1, 3))).toBe(33);
    expect(noteSur100(compat(0, 3))).toBe(0);
    expect(noteSur100(compat(3, 3))).toBe(100);
  });
  it("est nulle pour une offre domaine seul, quel que soit le profil", () => {
    for (const couverte of [true, false]) {
      const c = offreDomaine(1, couverte).compatibilite;
      if (c.etat !== "evaluee") throw new Error("inattendu");
      expect(noteSur100(c)).toBeNull();
    }
  });
});

describe("incoherences : une notation mal formée est refusée, une bien formée passe", () => {
  const valides: [string, NotationOffre][] = [
    ["outils", offreOutils(1, 2, 3)],
    ["outils, aucune couverte", offreOutils(2, 0, 4)],
    ["domaine seul, profil sans IA", offreDomaine(3, false)],
    ["domaine seul, profil avec IA", offreDomaine(4, true)],
    ["non évaluée", offreNonEvaluee(5, "profil_non_renseigne")],
  ];
  it.each(valides)("%s : aucune incohérence", (_nom, n) => {
    expect(incoherences(n)).toEqual([]);
  });

  it("couvertes au-dessus de exigees", () => {
    const n = offreOutils(1, 2, 3);
    if (n.compatibilite.etat === "evaluee") n.compatibilite.couvertes = 4;
    expect(incoherences(n)).toContain("couvertes doit être un entier entre 0 et exigees");
  });
  it("exigees à zéro : une compatibilité évaluée a au moins une exigence", () => {
    const n = offreOutils(1, 0, 0);
    expect(incoherences(n)).toContain("exigees doit être un entier d'au moins 1");
  });
  it("manquantes qui ne compte pas exigees moins couvertes", () => {
    const n = offreOutils(1, 1, 3);
    if (n.compatibilite.etat === "evaluee" && !n.compatibilite.domaine_seul) n.compatibilite.manquantes = ["Seul"];
    expect(incoherences(n)).toContain("manquantes doit contenir exactement exigees moins couvertes éléments");
  });
  it("domaine seul avec plus d'une exigence", () => {
    const n = offreDomaine(1, true);
    if (n.compatibilite.etat === "evaluee") n.compatibilite.exigees = 2;
    expect(incoherences(n)).toContain("une offre domaine seul a exactement 1 exigence");
  });
  it("à vérifier sans aucune raison, et raisons hors du statut à vérifier", () => {
    const n = offreOutils(1, 1, 1);
    n.eligibilite = { statut: "a_verifier", reserves: [], a_verifier: [], motif_rejet: null };
    expect(incoherences(n)).toContain("à vérifier sans aucune raison");
    n.eligibilite = { statut: "eligible", reserves: [], a_verifier: ["lieu_inconnu"], motif_rejet: null };
    expect(incoherences(n)).toContain("des raisons à vérifier hors statut à vérifier");
  });
  it("rejetée sans motif, et motif hors du statut rejetée", () => {
    const n = offreOutils(1, 1, 1);
    n.eligibilite = { statut: "rejetee", reserves: [], a_verifier: [], motif_rejet: null };
    expect(incoherences(n)).toContain("rejetée sans motif");
    n.eligibilite = { statut: "eligible", reserves: [], a_verifier: [], motif_rejet: "hors_zone" };
    expect(incoherences(n)).toContain("motif de rejet hors statut rejetée");
  });
  it("réserves en double", () => {
    const n = offreOutils(1, 1, 1);
    n.eligibilite = { statut: "eligible", reserves: ["duree_inconnue", "duree_inconnue"], a_verifier: [], motif_rejet: null };
    expect(incoherences(n)).toContain("réserves en double");
  });
  it("qualité : couverture et note interne hors bornes", () => {
    const n = offreOutils(1, 1, 1, { qualite: { ...qualiteExemple(), couverture: 1.2, note_interne: 140 } });
    expect(incoherences(n)).toEqual(
      expect.arrayContaining(["la couverture de qualité est entre 0 et 1", "la note interne de qualité est entre 0 et 100"]),
    );
  });
  it("qualité : une dimension non évaluée porte une valeur, une évaluée porte une cause", () => {
    const n = offreOutils(1, 1, 1);
    n.qualite.dimensions = [
      { cle: "texte", etat: "non_evaluee", valeur: 0, cause: "texte_non_capture" },
      { cle: "contenu", etat: "evaluee", valeur: 50, cause: "non_extraite" },
      { cle: "tracabilite", etat: "evaluee", valeur: null, cause: null },
    ];
    const p = incoherences(n);
    expect(p).toContain("dimension texte non évaluée avec une valeur");
    expect(p).toContain("dimension contenu évaluée avec une cause d'absence");
    expect(p).toContain("dimension tracabilite évaluée sans valeur entre 0 et 100");
  });
  it("fermee_le sur une offre ouverte, ou mal écrite", () => {
    const n = offreOutils(1, 1, 1, { fermee_le: "2026-11-12" });
    expect(incoherences(n)).toContain("fermee_le renseignée sur une offre non fermée");
    const m = offreOutils(2, 1, 1, { fermee: true, fermee_le: "12/11/2026" });
    expect(incoherences(m)).toContain("fermee_le doit être AAAA-MM-JJ");
    expect(incoherences(offreOutils(3, 1, 1, { fermee: true, fermee_le: "2026-11-12" }))).toEqual([]);
    expect(incoherences(offreOutils(4, 1, 1, { fermee: true }))).toEqual([]);
  });
});
