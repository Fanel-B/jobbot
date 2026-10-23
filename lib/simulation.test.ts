/**
 * Tests du simulant « et si j'apprenais X ? ».
 *
 * Deux exigences gouvernent ce fichier :
 *
 * 1. **Ne rien casser.** Sans compétence simulée, le calcul doit rendre exactement ce que rend le
 *    pipeline. C'est `npm run verifier-scoring` qui en fait foi sur chaque offre ; ici on vérifie
 *    que le chemin par défaut du simulant est bien ce chemin-là.
 * 2. **La note reste la somme de son bulletin.** C'est la règle 2, et c'était le bug le plus grave
 *    trouvé avant ce dépôt : un total qui ne s'explique pas par ses lignes est un mensonge. Une
 *    note simulée n'y échappe pas — elle est recalculée, jamais obtenue en ajoutant un delta.
 */
import { describe, expect, it } from "vitest";
import { offers } from "./offers";
import {
  classementSimule,
  competencesSimulables,
  ecrireSimulation,
  effetGlobal,
  effetSurOffre,
  lireSimulation,
  manquantsDe,
  volumeSuffisant,
} from "./simulation";

/** Quelques offres qui ont de quoi simuler, pour ne pas dépendre d'un identifiant en dur. */
const avecManquants = offers.filter((o) => manquantsDe(o.id).length > 0);

describe("le chemin par défaut ne bouge pas", () => {
  it("sans compétence simulée, la note est celle du pipeline", () => {
    const base = classementSimule([]);
    const ecarts = offers
      .filter((o) => base.get(o.id)?.total !== o.score)
      .map((o) => `#${o.id} : ${o.score} vs ${base.get(o.id)?.total}`);
    expect(ecarts).toEqual([]);
  });

  it("une liste vide, des espaces ou des doublons mènent au même classement", () => {
    const base = classementSimule([]);
    for (const variante of [[], [""], ["   "], ["", "  "]]) {
      const autre = classementSimule(variante);
      expect(autre.get(offers[0].id)?.total).toBe(base.get(offers[0].id)?.total);
    }
  });

  it("l'ordre de saisie ne change pas le résultat", () => {
    const a = classementSimule(["Docker", "Linux"]);
    const b = classementSimule(["Linux", "Docker"]);
    for (const o of offers.slice(0, 40)) {
      expect(a.get(o.id)?.total, `offre #${o.id}`).toBe(b.get(o.id)?.total);
    }
  });
});

describe("la note simulée reste la somme de son bulletin", () => {
  it("sur chaque offre, pour plusieurs combinaisons de compétences", () => {
    const combinaisons = [
      [],
      ["IA"],
      ["Docker"],
      ["IA", "intelligence artificielle", "IA générative", "IA generative"],
      ["Docker", "Linux", "C++"],
    ];
    const fautifs: string[] = [];
    for (const ajouts of combinaisons) {
      for (const r of classementSimule(ajouts).values()) {
        const somme = r.breakdown.reduce((s, l) => s + l.points, 0);
        if (somme !== r.total) {
          fautifs.push(`[${ajouts.join("+") || "aucun"}] #${r.id} : total ${r.total} ≠ somme ${somme}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("le bulletin rendu par effetSurOffre somme bien à la note d'après", () => {
    const o = avecManquants[0];
    const effet = effetSurOffre(o.id, manquantsDe(o.id))!;
    expect(effet).not.toBeNull();
    const somme = effet.bulletinApres.reduce((s, l) => s + l.points, 0);
    expect(somme).toBe(effet.totalApres);
  });
});

describe("l'effet d'une compétence sur une offre", () => {
  it("couvrir toutes les exigences manquantes ne laisse plus rien à travailler", () => {
    const o = avecManquants[0];
    const effet = effetSurOffre(o.id, manquantsDe(o.id))!;
    expect(effet.manquantsApres).toEqual([]);
  });

  it("fait monter la cohérence, jamais descendre", () => {
    for (const o of avecManquants.slice(0, 30)) {
      const effet = effetSurOffre(o.id, manquantsDe(o.id))!;
      const ligne = effet.lignesQuiBougent.find((l) => l.critere === "cohérence");
      if (ligne) expect(ligne.apres, `offre #${o.id}`).toBeGreaterThan(ligne.avant);
    }
  });

  it("une compétence que l'offre ne demande pas ne touche pas sa cohérence", () => {
    // « Kubernetes » n'est pas dans les exigences de cette offre : sa couverture ne bouge pas.
    const o = avecManquants.find((x) => !manquantsDe(x.id).includes("Kubernetes"))!;
    const avant = classementSimule([]).get(o.id)!;
    const apres = classementSimule(["Kubernetes"]).get(o.id)!;
    const ligne = (r: typeof avant) => r.breakdown.find((l) => l.critere === "cohérence")!.points;
    expect(ligne(apres)).toBe(ligne(avant));
  });

  it("renvoie null pour une offre inconnue plutôt que d'inventer un effet", () => {
    expect(effetSurOffre(-1, ["Docker"])).toBeNull();
  });
});

describe("les compétences proposées", () => {
  it("sont regroupées par famille : une seule entrée pour l'IA", () => {
    const labels = competencesSimulables(10).map((c) => c.label);
    expect(labels).toContain("IA / intelligence artificielle");
    // Les formes brutes ne doivent pas apparaître comme des compétences concurrentes.
    for (const forme of ["IA", "intelligence artificielle", "IA générative"]) {
      expect(labels, `« ${forme} » proposée séparément de sa famille`).not.toContain(forme);
    }
  });

  it("portent toutes les écritures employées par les annonces", () => {
    const ia = competencesSimulables(10).find((c) => c.label === "IA / intelligence artificielle")!;
    expect(ia.formes.length).toBeGreaterThan(1);
    expect(ia.demandee).toBeGreaterThan(0);
  });

  it("sont triées par nombre d'offres décroissant", () => {
    const comptes = competencesSimulables(8).map((c) => c.demandee);
    expect([...comptes].sort((a, b) => b - a)).toEqual(comptes);
  });
});

describe("l'effet d'ensemble", () => {
  it("ne compte jamais plus de franchissements que d'offres qui montent", () => {
    for (const c of competencesSimulables(5)) {
      const e = effetGlobal(c);
      expect(e.franchissent, c.label).toBeLessThanOrEqual(e.montent);
      expect(e.montent).toBeLessThanOrEqual(offers.length);
    }
  });

  it("la collecte est assez grosse pour qu'un comptage ait un sens", () => {
    expect(volumeSuffisant()).toBe(true);
  });
});

describe("la simulation voyage dans l'URL", () => {
  it("se lit et se réécrit sans se déformer", () => {
    expect(lireSimulation("IA,Docker")).toEqual(["IA", "Docker"]);
    expect(lireSimulation(" IA , Docker ")).toEqual(["IA", "Docker"]);
    expect(lireSimulation("IA,IA")).toEqual(["IA"]);
    expect(lireSimulation(undefined)).toEqual([]);
    expect(lireSimulation("")).toEqual([]);
    expect(ecrireSimulation(["IA", "Docker"])).toBe("IA,Docker");
    expect(ecrireSimulation([])).toBeUndefined();
  });

  it("borne le nombre de compétences pour qu'une URL forgée ne fasse pas ramer la page", () => {
    const beaucoup = Array.from({ length: 50 }, (_, i) => `competence${i}`);
    expect(lireSimulation(beaucoup.join(",")).length).toBeLessThanOrEqual(8);
  });
});
