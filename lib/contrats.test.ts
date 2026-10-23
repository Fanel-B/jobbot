/**
 * Tests des familles de contrat, sur les offres réelles de `data/offers.json`.
 *
 * Le défaut d'origine : `["stage (d'après l'alerte)"].includes("stage")` vaut **faux**, parce que
 * `includes` sur un tableau teste l'égalité exacte de l'élément. Deux annonces ne ressortaient donc
 * dans aucun filtre de contrat — ni « Stage », ni « Alternance », ni « Type non renseigné ».
 *
 * Corriger ces deux offres ne suffirait pas : le test qui compte est l'**invariant de partition**,
 * qui tue toute la classe de bugs. Tant qu'il passe, aucune annonce ne peut tomber entre deux
 * filtres, quel que soit le vocabulaire qu'une source emploiera demain.
 */
import { describe, expect, it } from "vitest";
import {
  FAMILLES_CONTRAT,
  compterFamilles,
  familleContrat,
  filtrerParContrat,
  normaliserContrat,
  offers,
  type FamilleContrat,
  type Offer,
} from "@/lib/offers";

/** Une offre minimale, pour tester la classification sans dépendre de l'export. */
function offreFictive(partiel: Partial<Offer>): Offer {
  return {
    contract_known: true,
    contract_type: null,
    contract_kinds: null,
    training_flag: false,
    training_excerpt: null,
    ...partiel,
  } as Offer;
}

describe("normaliserContrat", () => {
  it("retire la casse, les accents, la ponctuation et les parenthèses", () => {
    expect(normaliserContrat("Stage (d'après l'alerte)")).toBe("stage");
    expect(normaliserContrat("  STAGE  ")).toBe("stage");
    expect(normaliserContrat("Contrat de professionnalisation")).toBe(
      "contrat de professionnalisation",
    );
    expect(normaliserContrat("Alternance / Apprentissage")).toBe("alternance apprentissage");
  });

  it("ne confond pas une sous-chaîne avec un mot", () => {
    // « stagiaire » est bien un stage, « stagflation » n'en est pas un.
    expect(familleContrat(offreFictive({ contract_kinds: ["stagiaire"] }))).toBe("stage");
    expect(familleContrat(offreFictive({ contract_kinds: ["stagflation"] }))).toBe("autre");
  });
});

describe("familleContrat", () => {
  it("classe les deux offres qui échappaient à tous les filtres", () => {
    for (const id of [480, 428]) {
      const o = offers.find((x) => x.id === id);
      expect(o, `offre #${id} absente de data/offers.json`).toBeDefined();
      expect(o!.contract_kinds).toEqual(["stage (d'après l'alerte)"]);
      expect(familleContrat(o!)).toBe("stage");
    }
  });

  it("rend ces deux offres de nouveau accessibles par le filtre « stage »", () => {
    const ids = filtrerParContrat(offers, "stage").map((o) => o.id);
    expect(ids).toContain(480);
    expect(ids).toContain(428);
  });

  it("garde « non renseigné » distinct : une annonce sans contrat n'est jamais un stage", () => {
    const o = offreFictive({ contract_known: false, contract_kinds: ["stage"] });
    expect(familleContrat(o)).toBe("non-renseigne");
  });

  it("fait primer l'alternance quand une annonce cite les deux types", () => {
    const o = offreFictive({ contract_kinds: ["stage", "alternance"] });
    expect(familleContrat(o)).toBe("alternance");
  });

  it("reconnaît les formulations d'alternance employées par les sources", () => {
    for (const forme of [
      "Alternance",
      "apprentissage",
      "Contrat d'apprentissage",
      "Contrat de professionnalisation",
      "Alternant (12 mois)",
    ]) {
      expect(familleContrat(offreFictive({ contract_kinds: [forme] })), forme).toBe("alternance");
    }
  });
});

describe("invariant de partition sur data/offers.json", () => {
  const parFamille = new Map<FamilleContrat, Set<number>>(
    FAMILLES_CONTRAT.map((f) => [f, new Set(filtrerParContrat(offers, f).map((o) => o.id))]),
  );

  it("les quatre filtres couvrent toutes les offres, sans exception", () => {
    const couvertes = new Set<number>();
    for (const ids of parFamille.values()) for (const id of ids) couvertes.add(id);

    const orphelines = offers.filter((o) => !couvertes.has(o.id));
    expect(
      orphelines.map((o) => `#${o.id} ${JSON.stringify(o.contract_kinds)}`),
      "ces offres ne ressortent dans aucun filtre de contrat",
    ).toEqual([]);
    expect(couvertes.size).toBe(offers.length);
  });

  it("deux filtres différents ne renvoient jamais la même offre", () => {
    for (const a of FAMILLES_CONTRAT) {
      for (const b of FAMILLES_CONTRAT) {
        if (a === b) continue;
        const communes = [...parFamille.get(a)!].filter((id) => parFamille.get(b)!.has(id));
        expect(communes, `offres présentes à la fois dans « ${a} » et « ${b} »`).toEqual([]);
      }
    }
  });

  it("les comptes affichés sur les filtres sont ceux des listes filtrées", () => {
    const comptes = compterFamilles(offers);
    let somme = 0;
    for (const f of FAMILLES_CONTRAT) {
      expect(comptes[f], `compte de la famille « ${f} »`).toBe(parFamille.get(f)!.size);
      somme += comptes[f];
    }
    expect(somme).toBe(offers.length);
  });

  it("une valeur de filtre inconnue ne filtre rien plutôt que de vider la page", () => {
    expect(filtrerParContrat(offers, undefined)).toHaveLength(offers.length);
    expect(filtrerParContrat(offers, "tous")).toHaveLength(offers.length);
    expect(filtrerParContrat(offers, "nimportequoi")).toHaveLength(offers.length);
  });
});
