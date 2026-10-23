/**
 * Tests du bulletin sur les offres réelles de `data/offers.json` (lecture seule, aucun réseau).
 *
 * Les notes de ce fichier ont été écrites par le pipeline Python : elles servent d'oracle, offre par
 * offre. Les offres retenues ici sont celles où il manque des informations (contrat, lieu,
 * description, date de début), là où un portage a le plus de chances de diverger.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type LigneBulletin, type OffreAScorer, classer, maintenantDeLExport, ordreDuPipeline } from "./scoring";

type OffreExportee = OffreAScorer & {
  contract_type: string | null;
  contract_known: boolean;
  location: string | null;
  location_zone: string | null;
  score: number;
  score_reasons: string[];
  score_breakdown: LigneBulletin[];
};

const { meta, offers } = JSON.parse(
  readFileSync(new URL("../data/offers.json", import.meta.url), "utf8"),
) as { meta: { generated_at: string }; offers: OffreExportee[] };

const MAINTENANT = maintenantDeLExport(meta.generated_at);
const resultats = new Map(classer(ordreDuPipeline(offers), MAINTENANT).map((r) => [r.id, r]));

function resultat(id: number) {
  const r = resultats.get(id);
  if (!r) throw new Error(`offre #${id} absente du calcul`);
  return r;
}

function parId(id: number): OffreExportee {
  const o = offers.find((x) => x.id === id);
  if (!o) throw new Error(`offre #${id} absente de data/offers.json`);
  return o;
}

describe("toutes les offres de data/offers.json", () => {
  it("chaque offre exportée est notée, une seule fois", () => {
    expect(offers.length).toBeGreaterThan(0);
    expect(resultats.size).toBe(offers.length);
  });

  it("invariant : la somme des neuf critères égale la note totale, pour chaque offre", () => {
    for (const r of resultats.values()) {
      expect(r.breakdown, `#${r.id}`).toHaveLength(9);
      expect(r.breakdown.reduce((s, l) => s + l.points, 0), `#${r.id}`).toBe(r.total);
    }
  });

  it("aucun critère ne sort de [0, max], et les maxima totalisent 100", () => {
    for (const r of resultats.values()) {
      for (const l of r.breakdown) {
        expect(l.points, `#${r.id} · ${l.critere}`).toBeGreaterThanOrEqual(0);
        expect(l.points, `#${r.id} · ${l.critere}`).toBeLessThanOrEqual(l.max);
      }
      expect(r.breakdown.reduce((s, l) => s + l.max, 0)).toBe(100);
    }
  });

  it("chaque note reste entre le plancher (5) et le plafond (100)", () => {
    for (const r of resultats.values()) {
      expect(r.total, `#${r.id}`).toBeGreaterThanOrEqual(5);
      expect(r.total, `#${r.id}`).toBeLessThanOrEqual(100);
    }
  });

  it("chaque note est celle du pipeline Python", () => {
    const ecarts = offers.filter((o) => resultat(o.id).total !== o.score).map((o) => o.id);
    expect(ecarts).toEqual([]);
  });

  it("le décompte « x/y exigences » de la cohérence correspond aux technos reconnues et non couvertes", () => {
    for (const r of resultats.values()) {
      const detail = r.breakdown[0].detail ?? "";
      const couvertes = r.exigences.length - r.manquants.length;
      expect(detail.startsWith(`${couvertes}/${r.exigences.length} exigences`), `#${r.id} : ${detail}`).toBe(true);
    }
  });
});

describe("informations manquantes dans les offres réelles", () => {
  it("description absente : fiche vide (1/6) partout, et bulletin identique à celui du Python", () => {
    const sansDescription = offers.filter((o) => !o.description);
    expect(sansDescription.length).toBeGreaterThan(0);
    for (const o of sansDescription) {
      const r = resultat(o.id);
      expect(r.breakdown[3], `#${o.id}`).toEqual({
        critere: "fiche", points: 1, max: 6, detail: "fiche vide — ouvrir la page avant de postuler",
      });
      expect(r.breakdown, `#${o.id}`).toEqual(o.score_breakdown);
    }
  });

  it("date de début absente : calendrier 3/8 « à confirmer » partout, jamais une date supposée", () => {
    const sansDebut = offers.filter((o) => !o.start_date);
    expect(sansDebut.length).toBeGreaterThan(0);
    for (const o of sansDebut) {
      expect(resultat(o.id).breakdown[4], `#${o.id}`).toEqual({
        critere: "calendrier", points: 3, max: 8, detail: "date de début inconnue — à confirmer",
      });
    }
  });

  it("contrat inconnu : bulletin identique à celui du Python", () => {
    const sansContrat = offers.filter((o) => !o.contract_known);
    expect(sansContrat.length).toBeGreaterThan(0);
    for (const o of sansContrat) expect(resultat(o.id).breakdown, `#${o.id}`).toEqual(o.score_breakdown);
  });

  it("lieu vide : bulletin identique à celui du Python", () => {
    const sansLieu = offers.filter((o) => !o.location);
    expect(sansLieu.length).toBeGreaterThan(0);
    for (const o of sansLieu) expect(resultat(o.id).breakdown, `#${o.id}`).toEqual(o.score_breakdown);
  });

  it("effacer le contrat et le lieu d'une offre complète ne change pas son bulletin (ils ne sont pas notés)", () => {
    const complete = parId(832);
    const amputee = { ...complete, contract_type: null, contract_known: false, location: null, location_zone: null };
    const avant = classer([complete], MAINTENANT)[0];
    const apres = classer([amputee], MAINTENANT)[0];
    expect(apres.raisons).toEqual(avant.raisons);
    expect(apres.total).toBe(avant.total);
  });

  it("offre #716 (ni contrat, ni lieu, ni description) : bulletin du Python, ligne à ligne", () => {
    const o = parId(716);
    expect(o.contract_known).toBe(false);
    expect(o.location).toBeNull();
    expect(o.description).toBeNull();
    expect(resultat(716).raisons).toEqual(o.score_reasons);
    expect(resultat(716).total).toBe(o.score);
  });
});
