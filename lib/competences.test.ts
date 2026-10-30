/**
 * La partition du catalogue en familles doit être exacte.
 *
 * Ces tests ne vérifient pas un goût de rangement, ils vérifient qu'aucune compétence ne se perd :
 * une entrée du vocabulaire absente des familles n'apparaîtrait jamais dans le formulaire et
 * deviendrait impossible à cocher — donc une offre qui la demande resterait éternellement
 * « manquante » sans moyen d'y remédier. C'est exactement le genre de défaut qui ne se voit pas.
 */
import { describe, expect, it } from "vitest";
import { CATALOGUE } from "./scoring";
import {
  FAMILLES,
  competencesFantomes,
  competencesOrphelines,
  competencesRangees,
  familleDe,
  membresDe,
} from "./competences";

describe("partition du catalogue", () => {
  it("range chaque compétence du catalogue", () => {
    // Le message nomme les coupables : « 2 orphelines » n'aide personne à réparer.
    expect(competencesOrphelines()).toEqual([]);
  });

  it("n'invente aucune compétence que le moteur ne connaît pas", () => {
    expect(competencesFantomes()).toEqual([]);
  });

  it("ne range aucune compétence deux fois", () => {
    const rangees = competencesRangees();
    const doublons = rangees.filter((n, i) => rangees.indexOf(n) !== i);
    expect(doublons).toEqual([]);
  });

  it("couvre le catalogue exactement", () => {
    expect(competencesRangees().length).toBe(CATALOGUE.length);
  });
});

describe("forme des familles", () => {
  it("donne à chacune un identifiant unique", () => {
    const ids = FAMILLES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("pose une question, pas un intitulé de rubrique", () => {
    // Le parcours d'arrivée demande « de quoi as-tu besoin ? ». Une famille dont l'entrée n'est
    // pas une question casserait ce ton sans qu'on s'en aperçoive en relisant le code.
    for (const f of FAMILLES) {
      expect(f.question.endsWith("?"), f.id).toBe(true);
    }
  });

  it("affiche au moins une compétence sans déplier", () => {
    for (const f of FAMILLES) {
      expect(f.principales.length, f.id).toBeGreaterThan(0);
    }
  });

  it("retrouve la famille de n'importe quelle compétence rangée", () => {
    for (const f of FAMILLES) {
      for (const nom of membresDe(f)) {
        expect(familleDe(nom)?.id, nom).toBe(f.id);
      }
    }
  });

  it("ne retrouve rien pour une compétence inconnue", () => {
    expect(familleDe("Cobol sur bande perforée")).toBeNull();
  });
});
