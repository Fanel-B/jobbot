/**
 * Tests du profil.
 *
 * Deux propriétés gouvernent ce fichier :
 *
 * 1. **Le profil de départ ne change rien.** Il reprend `MES_ATOUTS`, donc le site doit afficher
 *    exactement les notes du pipeline tant que personne n'a rien coché. C'est ce qui rend ce
 *    réglage sans risque, et `npm run verifier-scoring` le vérifie de son côté.
 * 2. **La note reste la somme de son bulletin, quel que soit le profil.** La règle 2 ne souffre
 *    aucune exception : elle vaut pour un profil riche comme pour un profil de cinq compétences.
 */
import { describe, expect, it } from "vitest";
import { offers } from "./offers";
import { CATALOGUE } from "./scoring";
import {
  PROFIL_DEFAUT,
  atoutsDuProfil,
  classementPour,
  decoderProfil,
  effetPour,
  encoderProfil,
  PROFIL_VIDE,
  estVide,
  manquantsPour,
  offresPour,
  type Profil,
} from "./profil";

const PAUVRE: Profil = {
  competences: ["JavaScript", "Git", "Excel", "HTML", "CSS"],
  zones: ["toulouse"],
  niveau: "bac+3",
  recherche: ["stage"],
};

const RICHE: Profil = {
  competences: [...PROFIL_DEFAUT.competences, "Docker", "IA", "Linux", "C++"],
  zones: ["toulouse", "idf"],
  niveau: "bac+5",
  recherche: ["stage"],
};

describe("le profil de départ ne change rien", () => {
  it("rend exactement les notes du pipeline", () => {
    const classement = classementPour(PROFIL_DEFAUT);
    const ecarts = offers
      .filter((o) => classement.get(o.id)?.total !== o.score)
      .map((o) => `#${o.id} : ${o.score} vs ${classement.get(o.id)?.total}`);
    expect(ecarts).toEqual([]);
  });

  it("reprend les atouts du moteur, alias compris", () => {
    // « node » et « node.js » désignent la même compétence : les deux clés doivent survivre.
    const cles = atoutsDuProfil(PROFIL_DEFAUT).map(([c]) => c);
    expect(cles).toContain("node");
    expect(cles).toContain("node.js");
    expect(cles.length).toBeGreaterThan(PROFIL_DEFAUT.competences.length);
  });

  it("reconnaît un profil vierge, et lui seul", () => {
    expect(estVide(PROFIL_VIDE)).toBe(true);
    expect(estVide(PROFIL_DEFAUT)).toBe(false);
    expect(estVide(PAUVRE)).toBe(false);
    // Régler sa zone et son niveau sans cocher une compétence ne suffit pas à pouvoir être noté.
    expect(estVide({ ...PROFIL_VIDE, zones: ["toulouse"], recherche: ["stage"] })).toBe(true);
  });
});

describe("la note reste la somme de son bulletin", () => {
  it("pour chaque offre et chacun des trois profils", () => {
    const fautes: string[] = [];
    for (const [nom, p] of [["départ", PROFIL_DEFAUT], ["pauvre", PAUVRE], ["riche", RICHE]] as [
      string,
      Profil,
    ][]) {
      for (const r of classementPour(p).values()) {
        const somme = r.breakdown.reduce((s, l) => s + l.points, 0);
        if (somme !== r.total) fautes.push(`[${nom}] #${r.id} : ${r.total} ≠ ${somme}`);
      }
    }
    expect(fautes).toEqual([]);
  });
});

describe("le profil change vraiment le classement", () => {
  it("retirer des compétences fait baisser la note moyenne", () => {
    const moyenne = (p: Profil) => {
      const n = [...classementPour(p).values()].map((r) => r.total);
      return n.reduce((a, b) => a + b, 0) / n.length;
    };
    expect(moyenne(PAUVRE)).toBeLessThan(moyenne(PROFIL_DEFAUT));
    expect(moyenne(RICHE)).toBeGreaterThan(moyenne(PROFIL_DEFAUT));
  });

  it("un profil plus pauvre laisse plus de compétences à travailler", () => {
    const avecManquants = (p: Profil) =>
      offers.filter((o) => manquantsPour(p, o.id).length > 0).length;
    expect(avecManquants(PAUVRE)).toBeGreaterThan(avecManquants(PROFIL_DEFAUT));
  });

  it("une famille ne joue que si son représentant est dans le profil", () => {
    // Sans SQL coché, « bases de données » n'est plus couvert par la famille SQL.
    const sansSql: Profil = { ...PROFIL_DEFAUT, competences: PROFIL_DEFAUT.competences.filter((c) => c !== "SQL") };
    const cles = atoutsDuProfil(sansSql).map(([c]) => c);
    expect(cles).not.toContain("sql");
  });

  it("offresPour rend des offres de la même forme, renotées", () => {
    const liste = offresPour(PAUVRE);
    expect(liste).toHaveLength(offers.length);
    const une = liste.find((o) => o.id === offers[0].id)!;
    expect(une.canonical_url).toBe(offers[0].canonical_url);
    expect(une.score).toBe(classementPour(PAUVRE).get(une.id)!.total);
  });
});

describe("le simulant part du profil, pas du réglage d'usine", () => {
  it("mesure l'écart depuis la note de ce profil", () => {
    const cible = offers.find((o) => manquantsPour(PAUVRE, o.id).length > 0)!;
    const effet = effetPour(PAUVRE, cible.id, manquantsPour(PAUVRE, cible.id))!;
    expect(effet.totalAvant).toBe(classementPour(PAUVRE).get(cible.id)!.total);
    expect(effet.manquantsApres).toEqual([]);
    expect(effet.bulletinApres.reduce((s, l) => s + l.points, 0)).toBe(effet.totalApres);
  });

  it("renvoie null sur une offre inconnue plutôt qu'un effet inventé", () => {
    expect(effetPour(PAUVRE, -1, ["Docker"])).toBeNull();
  });
});

describe("le cookie est relu sans jamais faire confiance à son contenu", () => {
  it("fait l'aller-retour sans se déformer", () => {
    expect(decoderProfil(encoderProfil(PAUVRE))).toEqual(PAUVRE);
  });

  it("écarte ce qui n'est pas au catalogue au lieu de l'accepter", () => {
    const trafique = JSON.stringify({ c: ["JavaScript", "Sorcellerie"], z: ["lune"], n: "bac+42", r: ["cdi"] });
    const relu = decoderProfil(trafique);
    expect(relu.competences).toEqual(["JavaScript"]);
    expect(relu.zones).toEqual([]);
    expect(relu.niveau).toBe(PROFIL_VIDE.niveau);
    // « cdi » n'est pas un type de recherche reconnu : on l'écarte sans rien inventer à la place.
    expect(relu.recherche).toEqual([]);
  });

  it("retombe sur un profil vierge devant un cookie illisible ou absent", () => {
    // Autrefois ce cas rendait MES_ATOUTS : un visiteur sans cookie héritait des 31 compétences
    // de Fanel et lisait des notes calculées sur le profil de quelqu'un d'autre.
    for (const brut of [undefined, "", "{pas du json", "null"]) {
      expect(decoderProfil(brut), String(brut)).toEqual(PROFIL_VIDE);
    }
  });

  it("ne note rien tant qu'aucune compétence n'est confirmée", () => {
    // L'invariant qui justifie tout le parcours d'arrivée : un profil vide ne couvre aucune
    // exigence, donc aucune note affichée ne peut prétendre dire quoi que ce soit.
    const classement = classementPour(PROFIL_VIDE);
    for (const r of classement.values()) {
      expect(r.exigences.every((e) => r.manquants.includes(e)), String(r.id)).toBe(true);
    }
  });

  it("ne propose que des compétences que le moteur sait reconnaître", () => {
    const noms = new Set(CATALOGUE.map((c) => c.nom));
    for (const c of PROFIL_DEFAUT.competences) expect(noms.has(c), c).toBe(true);
  });
});
