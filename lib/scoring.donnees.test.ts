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

  it("invariant : la somme de toutes les lignes égale la note totale, pour chaque offre", () => {
    for (const r of resultats.values()) {
      // Neuf critères notés + les cinq ajustements du 22/10/2026, plus le plafond s'il mord.
      expect(r.breakdown.length, `#${r.id}`).toBeGreaterThanOrEqual(14);
      expect(r.breakdown.length, `#${r.id}`).toBeLessThanOrEqual(15);
      expect(r.breakdown.reduce((s, l) => s + l.points, 0), `#${r.id}`).toBe(r.total);
    }
  });

  it("les critères notés restent dans [0, max] ; les ajustements (max 0) portent un signe, et les maxima totalisent 100", () => {
    for (const r of resultats.values()) {
      for (const l of r.breakdown) {
        if (l.max > 0) {
          expect(l.points, `#${r.id} · ${l.critere}`).toBeGreaterThanOrEqual(0);
          expect(l.points, `#${r.id} · ${l.critere}`).toBeLessThanOrEqual(l.max);
        }
      }
      expect(r.breakdown.reduce((s, l) => s + l.max, 0)).toBe(100);
    }
  });

  it("chaque note reste entre le plancher (0) et le plafond (100)", () => {
    for (const r of resultats.values()) {
      expect(r.total, `#${r.id}`).toBeGreaterThanOrEqual(0);
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

  it("offres sans type de contrat : bulletin du Python, ligne à ligne", () => {
    // L'offre #973, citée ici jusqu'au 6 novembre 2026, a quitté l'export du 7 novembre : on prend
    // toutes les offres sans contrat du fichier, pas une seule dont l'identifiant peut disparaître.
    const sansContrat = offers.filter((o) => !o.contract_known);
    expect(sansContrat.length).toBeGreaterThan(10);
    for (const o of sansContrat) {
      expect(resultat(o.id).raisons, `offre #${o.id}`).toEqual(o.score_reasons);
      expect(resultat(o.id).total, `offre #${o.id}`).toBe(o.score);
    }
  });

  it("effacer le lieu d'une offre sans contrat ne change pas son bulletin (le lieu n'est pas noté)", () => {
    // Le cas d'origine (#716 : ni contrat, ni lieu, ni description) a quitté l'export le 25/10/2026 :
    // sans lieu, aucune zone n'est calculable, donc l'offre n'est pas publiée. On vérifie la même
    // propriété en effaçant le lieu en mémoire, sur toutes les offres sans contrat du fichier.
    // La description, elle, est lue par « cohérence » (6 des 40 offres changent de bulletin quand on
    // l'efface) : l'ancien test ne l'affirmait vrai que pour #973, par hasard de ses données.
    for (const o of offers.filter((x) => !x.contract_known)) {
      const ampute = { ...o, location: null, location_zone: null };
      expect(classer([ampute], MAINTENANT)[0].raisons, `offre #${o.id}`).toEqual(
        classer([o], MAINTENANT)[0].raisons,
      );
    }
  });
});

const lot = [836, 788, 832, 817, 828, 829, 837, 855, 867, 783, 897];
const points = (id: number, critere: string) =>
  resultat(id).breakdown.find((l) => l.critere === critere)?.points ?? 0;
const ligneDe = (id: number, critere: string) =>
  resultat(id).breakdown.find((l) => l.critere === critere)?.detail ?? "";

/**
 * Cas de référence figés sur les vraies annonces (22/10/2026). L'oracle ne prouve que la
 * concordance avec le Python, pas la justesse : ces attendus viennent de la lecture des annonces.
 */
describe("référence : les 11 offres relues à la main", () => {
  it("le lot est complet dans data/offers.json", () => {
    expect(lot.filter((id) => !resultats.has(id))).toEqual([]);
  });

  it("#897 finit premier des 11 offres, à la date de la relecture", () => {
    // La relecture date du 25 octobre 2026 : on classe à l'heure de l'export d'alors. Au 7 novembre,
    // #897 (publiée le 19 octobre) a perdu ses 5 points de fraîcheur (« il y a 19 j ») et #836 la
    // dépasse de un point, 67 contre 66. C'est le calendrier qui a changé, pas le moteur.
    const LE_25_OCTOBRE = maintenantDeLExport("2026-10-25T17:41:17+00:00");
    const classement = classer(ordreDuPipeline(offers), LE_25_OCTOBRE)
      .filter((r) => lot.includes(r.id))
      .sort((a, b) => b.total - a.total || a.id - b.id);
    expect(classement[0].id).toBe(897);
  });

  it("#828 porte un bloqueur d'habilitation, mais sa note reste sous le plafond : 47", () => {
    // Le bloqueur existe (habilitation de sécurité) : la note serait plafonnée à 55 si elle
    // dépassait — elle vaut 47, donc aucune ligne de plafond, et le total reste la somme des
    // lignes. C'est le malus de fin qui la fait passer sous le plafond (fin 01/10/2027 : -8).
    expect(resultat(828).total).toBe(47);
    expect(ligneDe(828, "fin")).toContain("raccourcir");
    expect(ligneDe(828, "plafond")).toBe("");       // absente, pas zéro : le plafond ne mord pas
  });

  it("#832 est plafonnée à 55 par la clause de nationalité", () => {
    expect(resultat(832).total).toBe(55);
    expect(ligneDe(832, "plafond")).toContain("nationalite");
  });

  it("#829 perd sur sa date de début (février 2027)", () => {
    expect(points(829, "dates")).toBe(-10);
    expect(ligneDe(829, "dates")).toContain("2027-02-01");
  });

  it("#867 perd sur sa date lue dans l'annonce (janvier 2027)", () => {
    expect(points(867, "dates")).toBe(-10);
    expect(ligneDe(867, "dates")).toContain("lu dans l'annonce");
  });

  it("#783 et #788 perdent sur le niveau Bac+4/5", () => {
    expect(points(783, "diplôme")).toBe(-8);
    expect(points(788, "diplôme")).toBe(-8);
  });

  it("#837 et #867 portent « compétence exigée hors profil »", () => {
    expect(ligneDe(837, "compétences")).toContain("compétence exigée hors profil");
    expect(ligneDe(867, "compétences")).toContain("compétence exigée hors profil");
  });

  it("les 11 notes restent la somme exacte de leur bulletin", () => {
    for (const id of lot) {
      expect(resultat(id).breakdown.reduce((s, l) => s + l.points, 0), `#${id}`)
        .toBe(resultat(id).total);
    }
  });
});
