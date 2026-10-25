/**
 * Tests unitaires du bulletin (`lib/scoring.ts`) sur des offres fabriquées à la main.
 *
 * Chaque valeur attendue est déduite de `reference/priorites.py` (système 4), la source de vérité :
 * mêmes paliers, mêmes arrondis (`round` de Python : égalité vers le pair), mêmes libellés.
 * Aucun réseau, aucune base : tout est dans ce fichier.
 */
import { describe, expect, it } from "vitest";
import {
  type LigneBulletin,
  type OffreAScorer,
  type Resultat,
  classer,
  decouper,
  exigences,
  maintenantDeLExport,
  ordreDuPipeline,
  scoreOffre,
  bloqueursAdmin,
  type OffreAEvaluer,
} from "./scoring";

/* ------------------------------------------------------------------ outils */

/** Heure murale naïve du calcul : 20/10/2026 à 12:00 (lue comme UTC, comme les dates de la base). */
const MAINTENANT = Date.UTC(2026, 9, 20, 12, 0, 0);

/** Une offre dont **tous** les champs sont absents : on n'ajoute que ce que le test exige. */
function offre(id: number, champs: Partial<OffreAScorer> = {}): OffreAScorer {
  return {
    id, source: null, canonical_url: null, title: null, company: null, description: null,
    skills_required: null, start_date: null, published_at: null, first_seen_at: null, ...champs,
  };
}

function noter(o: OffreAScorer, actions?: Map<number, number>): Resultat {
  return classer([o], MAINTENANT, actions)[0];
}

function ligne(r: Resultat, critere: string): LigneBulletin {
  const l = r.breakdown.find((x) => x.critere === critere);
  if (!l) throw new Error(`critère « ${critere} » absent du bulletin de #${r.id}`);
  return l;
}

/** Date naïve « AAAA-MM-JJ HH:MM:SS », `jours` jours avant MAINTENANT. */
function ilYA(jours: number): string {
  return new Date(MAINTENANT - jours * 86_400_000).toISOString().slice(0, 19).replace("T", " ");
}

function somme(r: Resultat): number {
  return r.breakdown.reduce((s, l) => s + l.points, 0);
}

const CRITERES = ["cohérence", "métier", "source", "fiche", "calendrier", "dépôt", "dossier",
  "fraîcheur", "diversité", "diplôme", "prérequis", "compétences", "dates", "fin"];
// Les cinq derniers sont les ajustements du 22/10/2026 — les quatre critères d'accessibilité puis
// la date de fin : maximum 0, leurs points sont signés et entrent dans la note. Le « plafond », s'il
// mord, est une ligne supplémentaire ajoutée après.
const MAXIMA = [30, 12, 8, 6, 8, 6, 4, 12, 14, 0, 0, 0, 0, 0];

// Plus de 500 caractères, quatre technos reconnues (Python, React, SQL, Git), toutes couvertes.
const DESCRIPTION_LONGUE = ("Au sein de l'équipe produit, vous concevez et maintenez une application web interne : "
  + "interfaces React, services Python, requêtes SQL et revue de code sous Git. ").repeat(4);

/** L'offre « idéale » : chaque critère au maximum. */
const IDEALE = offre(2, {
  source: "smartrecruiters",
  canonical_url: "https://jobs.smartrecruiters.com/Acme/123",
  title: "Stage Développeur Full Stack Python React",
  company: "Acme",
  description: DESCRIPTION_LONGUE,
  start_date: "2027-04-01",
  published_at: "2026-10-20 08:00:00",
});
const DOSSIER_AVANCE = new Map([[2, 2]]);

/** L'offre « plancher » : chaque critère au minimum possible avant la diversité (total 5). */
function plancher(id: number): OffreAScorer {
  return offre(id, {
    company: "Airbus",
    title: "Stage Docker",                                     // une exigence, non couverte
    canonical_url: "https://www.linkedin.com/jobs/workday/1",  // alerte (source 2) + Workday (dépôt 2)
    start_date: "2026-12-01",                                  // encore en cours : calendrier 0
  });
}

/* ------------------------------------------------------- l'offre idéale */

describe("offre idéale : chaque critère à son plafond", () => {
  const r = noter(IDEALE, DOSSIER_AVANCE);

  it("obtient la note plafond de 100", () => {
    expect(r.total).toBe(100);
  });

  it("écrit le bulletin complet, ligne à ligne, comme le Python", () => {
    expect(r.raisons).toEqual([
      "cohérence 30/30 (4/4 exigences + Biblio-Tech)",
      "métier 12/12 (développement full stack)",
      "source 8/8 (site carrière vérifiable)",
      "fiche 6/6 (fiche complète (4 technos))",
      "calendrier 8/8 (début 2027-04-01 compatible)",
      "dépôt 6/6 (formulaire court)",
      "dossier 4/4 (dossier déjà bien avancé)",
      "fraîcheur 12/12 (il y a 0 j)",
      "fenêtre : 7 j restants",
      "diversité 14/14 (acme — 1ᵉ place)",
      "diplôme 0/0 (niveau de diplôme : non précisé (0))",
      "prérequis 0/0 (prérequis métier : aucun hors profil (0))",
      "compétences 0/0 (compétences exigées : toutes dans le référentiel (0))",
      "dates 3/0 (début 2027-04-01 : compatible avec une disponibilité fin mars 2027 (+3))",
      // La durée n'est pas renseignée : la fin n'est pas calculable, et rien n'est pénalisé.
      "fin 0/0 (fin de stage : non calculable (début ou durée absents) (0))",
      "plafond -3/0 (note plafonnée à 100)",
    ]);
  });

  it("chaque ligne notée est à son maximum ; les ajustements portent leur signe", () => {
    for (const l of r.breakdown) {
      if (l.max > 0) expect(l.points, l.critere).toBe(l.max);
    }
    // Le bonus « dates » (+3) pousse la somme à 103 : la ligne de plafond la ramène à 100.
    expect(ligne(r, "dates").points).toBe(3);
    expect(ligne(r, "plafond")).toEqual({
      critere: "plafond", points: -3, max: 0, detail: "note plafonnée à 100",
    });
    expect(somme(r)).toBe(100);
  });

  it("reconnaît les quatre technos, toutes couvertes", () => {
    expect(r.exigences).toEqual(["Python", "React", "SQL", "Git"]);
    expect(r.manquants).toEqual([]);
  });
});

/* ------------------------------------------- forme du bulletin et invariants */

describe("forme du bulletin", () => {
  it("compte neuf critères notés puis les cinq ajustements, maxima 30·12·8·6·8·6·4·12·14·0·0·0·0·0", () => {
    const r = noter(IDEALE);
    expect(r.breakdown.map((l) => l.critere)).toEqual(CRITERES);
    expect(r.breakdown.map((l) => l.max)).toEqual(MAXIMA);
    expect(MAXIMA.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("l'urgence est affichée mais jamais notée : elle n'entre pas dans le bulletin découpé", () => {
    const r = noter(offre(1, { published_at: ilYA(6.5) }));
    expect(r.raisons).toContain("⏳ dernier appel : expire dans 0 j");
    expect(r.raisons).toHaveLength(15);
    expect(r.breakdown).toHaveLength(14);
  });

  it("invariant : la somme de toutes les lignes égale la note totale, pour toutes les offres fabriquées", () => {
    const offres = [
      IDEALE, plancher(20), plancher(21), plancher(22), plancher(23), offre(1),
      offre(3, { title: "Stage Python SQL Git Docker" }),
      offre(4, { title: "Stage Python Docker Kubernetes", description: "Supervision des logs." }),
      offre(5, { title: "Stage Développeur web", published_at: ilYA(2.5), start_date: "2027-10-01" }),
      offre(6, { source: "indeed", description: "x".repeat(300), published_at: "2026-10-19" }),
    ];
    const resultats = classer(offres, MAINTENANT, new Map([[2, 2], [6, 1]]));
    expect(resultats).toHaveLength(offres.length);
    for (const r of resultats) expect(somme(r), `#${r.id}`).toBe(r.total);
  });

  it("les résultats sortent triés du plus prioritaire au moins", () => {
    const resultats = classer([offre(1), IDEALE, plancher(20)], MAINTENANT);
    const totaux = resultats.map((r) => r.total);
    expect(totaux).toEqual([...totaux].sort((a, b) => b - a));
    expect(resultats[0].id).toBe(2);
  });
});

/* ------------------------------------------------------------------- bornes */

describe("bornes de la note", () => {
  it("note plancher : 9, quand chaque critère est au minimum et que le début est incompatible", () => {
    const resultats = classer([plancher(20), plancher(21), plancher(22), plancher(23)], MAINTENANT);
    const dernier = resultats[3];
    expect(dernier.id).toBe(23);
    expect(dernier.total).toBe(9);
    // Neuf critères (19) puis les ajustements : diplôme 0, prérequis 0, compétences 0, dates -10,
    // fin 0 (aucune date annoncée : on ne pénalise pas un champ vide).
    expect(dernier.breakdown.map((l) => l.points)).toEqual([0, 0, 2, 1, 0, 2, 0, 0, 14, 0, 0, 0, -10, 0]);
    expect(somme(dernier)).toBe(9);
  });

  it("les quatre offres du même groupe gardent leurs 14 points de diversité : plus aucun plafond", () => {
    const resultats = classer([plancher(20), plancher(21), plancher(22), plancher(23)], MAINTENANT);
    expect(resultats.map((r) => r.total)).toEqual([9, 9, 9, 9]);
  });

  it("note plafond : 100 exactement, jamais au-delà, même avec plus d'exigences et un projet en prime", () => {
    const encorePlus = { ...IDEALE, description: DESCRIPTION_LONGUE + " Node.js, Express, HTML, CSS, Tailwind." };
    expect(noter(encorePlus, DOSSIER_AVANCE).total).toBe(100);
  });
});

/* ---------------------------------------------------------------- cohérence */

describe("cohérence : décompte des exigences couvertes", () => {
  it("3 exigences couvertes sur 4 : 30 × 0,75 = 22,5 arrondi à 22 (égalité vers le pair, comme Python)", () => {
    const r = noter(offre(3, { title: "Stage Python SQL Git Docker" }));
    expect(r.exigences).toEqual(["Python", "SQL", "Docker", "Git"]);
    expect(r.manquants).toEqual(["Docker"]);
    expect(ligne(r, "cohérence")).toEqual({ critere: "cohérence", points: 22, max: 30, detail: "3/4 exigences" });
  });

  it("dénominateur plancher de 3 : une seule exigence couverte ne donne pas 30 mais 10", () => {
    const r = noter(offre(1, { title: "Stage Python" }));
    expect(ligne(r, "cohérence")).toMatchObject({ points: 10, detail: "1/1 exigences" });
  });

  it("deux exigences couvertes sur deux : 2/3 du maximum, soit 20", () => {
    expect(ligne(noter(offre(1, { title: "Stage Python SQL" })), "cohérence").points).toBe(20);
  });

  it("toutes les exigences couvertes (4/4), sans projet : 30", () => {
    const r = noter(offre(1, { title: "Stage Python SQL Git Excel" }));
    expect(ligne(r, "cohérence")).toMatchObject({ points: 30, detail: "4/4 exigences" });
  });

  it("aucune exigence couverte, sans projet : 0", () => {
    const r = noter(offre(1, { title: "Stage Docker Kubernetes AWS" }));
    expect(r.manquants).toEqual(["Docker", "Kubernetes", "AWS"]);
    expect(ligne(r, "cohérence")).toMatchObject({ points: 0, detail: "0/3 exigences" });
  });

  it("une exigence de la même famille compte comme couverte (VBA → Excel)", () => {
    const r = noter(offre(1, { title: "Stage VBA Docker AWS" }));
    expect(r.exigences).toEqual(["VBA", "Docker", "AWS"]);
    expect(r.manquants).toEqual(["Docker", "AWS"]);
    expect(ligne(r, "cohérence")).toMatchObject({ points: 10, detail: "1/3 exigences" });
  });
});

describe("cohérence : le projet de Fanel crédité", () => {
  it("le projet ajoute 0,15 et apparaît dans le détail : 1/3 + TechScope → 14 (14,4999… en flottant)", () => {
    const r = noter(offre(4, { title: "Stage Python Docker Kubernetes", description: "Supervision des logs." }));
    expect(ligne(r, "cohérence")).toEqual({
      critere: "cohérence", points: 14, max: 30, detail: "1/3 exigences + TechScope",
    });
  });

  it("sans le mot qui rattache au projet, la même offre retombe à 10", () => {
    const r = noter(offre(4, { title: "Stage Python Docker Kubernetes", description: "Supervision des serveurs." }));
    expect(ligne(r, "cohérence")).toMatchObject({ points: 10, detail: "1/3 exigences" });
  });

  it("le projet est cherché dans le titre aussi : « web » crédite Biblio-Tech", () => {
    const r = noter(offre(5, { title: "Stage Développeur web" }));
    expect(ligne(r, "cohérence").detail).toBe("0/0 exigences + Biblio-Tech");
  });

  it("plafonnement : 4/4 exigences + projet ne dépasse pas 30", () => {
    expect(ligne(noter(IDEALE), "cohérence")).toMatchObject({ points: 30, max: 30 });
  });

  it("le premier projet de la liste l'emporte (TechScope avant Analyse Insertion Pro)", () => {
    const r = noter(offre(1, { title: "Stage data", description: "Monitoring des flux." }));
    expect(ligne(r, "cohérence").detail).toBe("0/0 exigences + TechScope");
  });
});

/* -------------------------------------------------------------- exigences */

describe("exigences reconnues dans l'offre", () => {
  it("correspondance en mot entier : ni IA dans « spatial », ni Git dans « digital », ni SQL dans « MySQL »", () => {
    const o = offre(1, { description: "Projet spatial et digital sous MySQL, modèles de langage." });
    expect(exigences(o)).toEqual(["MySQL", "modèles de langage"]);
  });

  it("lit aussi les compétences listées (`skills_required`) et suit l'ordre du vocabulaire", () => {
    const o = offre(1, { title: "Stage", skills_required: ["Docker", "Python"] });
    expect(exigences(o)).toEqual(["Python", "Docker"]);
  });

  it("une techno citée deux fois ne compte qu'une fois", () => {
    expect(exigences(offre(1, { title: "Python", description: "Python, encore Python." }))).toEqual(["Python"]);
  });
});

/* -------------------------------------------------- informations manquantes */

describe("offre sans aucune information : calculable, sans donnée inventée", () => {
  const r = noter(offre(1));

  it("le bulletin est celui du Python pour une offre vide (note 38)", () => {
    expect(r.raisons).toEqual([
      "cohérence 10/30 (0/0 exigences)",
      "métier 0/12 (indéterminé)",
      "source 5/8 (source inconnue)",
      "fiche 1/6 (fiche vide — ouvrir la page avant de postuler)",
      "calendrier 3/8 (date de début inconnue — à confirmer)",
      "dépôt 5/6 (formulaire du site)",
      "dossier 0/4 (rien de fait)",
      "fraîcheur 0/12 (il y a 99 j)",
      "⏳ dernier appel : expire dans 0 j",
      "diversité 14/14 (? — 1ᵉ place)",
      "diplôme 0/0 (niveau de diplôme : non précisé (0))",
      "prérequis 0/0 (prérequis métier : aucun hors profil (0))",
      "compétences 0/0 (compétences exigées : toutes dans le référentiel (0))",
      "dates 0/0 (dates : début inconnu (0))",
      "fin 0/0 (date de fin : offre non concernée (contrat non-stage) (0))",
    ]);
    expect(r.total).toBe(38);
    expect(somme(r)).toBe(38);
  });

  it("sans exigence reconnue, la cohérence vaut la base fixe de 0,35 du Python : 10,5 arrondi à 10", () => {
    expect(r.exigences).toEqual([]);
    expect(ligne(r, "cohérence").points).toBe(10);
  });
});

describe("description absente", () => {
  it("fiche vide (1/6), mais le titre suffit au métier et au projet", () => {
    const r = noter(offre(5, { title: "Stage Développeur web" }));
    expect(ligne(r, "fiche")).toMatchObject({ points: 1, detail: "fiche vide — ouvrir la page avant de postuler" });
    expect(ligne(r, "métier")).toMatchObject({ points: 12, detail: "développement full stack" });
    expect(ligne(r, "cohérence").points).toBe(15);
  });

  it("une description `null` et une description vide donnent exactement le même bulletin", () => {
    const sansDescription = noter(offre(5, { title: "Stage Développeur web", description: null }));
    const descriptionVide = noter(offre(5, { title: "Stage Développeur web", description: "" }));
    expect(descriptionVide.raisons).toEqual(sansDescription.raisons);
  });
});

describe("fiche : longueur de la description", () => {
  it("199 caractères : fiche vide (1)", () => {
    expect(ligne(noter(offre(1, { description: "x".repeat(199) })), "fiche").points).toBe(1);
  });

  it("200 caractères : fiche partielle (6 × 6 / 10 = 3,6 → 4)", () => {
    expect(ligne(noter(offre(1, { description: "x".repeat(200) })), "fiche"))
      .toMatchObject({ points: 4, detail: "fiche partielle" });
  });

  it("500 caractères sans deux technos reconnues : reste partielle", () => {
    expect(ligne(noter(offre(1, { description: "x".repeat(500) })), "fiche").points).toBe(4);
  });

  it("500 caractères et deux technos : fiche complète (6)", () => {
    expect(ligne(noter(offre(1, { description: "x".repeat(500) + " Python SQL" })), "fiche"))
      .toMatchObject({ points: 6, detail: "fiche complète (2 technos)" });
  });

  it("la longueur se compte en caractères comme `len` de Python, pas en unités UTF-16", () => {
    // 150 émojis : 150 pour Python, 300 pour `String.length` — la fiche doit rester vide.
    expect(ligne(noter(offre(1, { description: "😀".repeat(150) })), "fiche").points).toBe(1);
  });
});

describe("date de publication absente ou illisible", () => {
  it("sans `published_at`, la date de repérage (`first_seen_at`) prend le relais", () => {
    const r = noter(offre(1, { first_seen_at: "2026-10-20 11:00:00" }));
    expect(ligne(r, "fraîcheur")).toMatchObject({ points: 12, detail: "il y a 0 j" });
  });

  it("sans aucune date, l'ancienneté vaut 99 j (valeur du Python) et la fraîcheur 0", () => {
    const r = noter(offre(1));
    expect(ligne(r, "fraîcheur")).toMatchObject({ points: 0, detail: "il y a 99 j" });
  });

  it("une date illisible ne bascule pas sur `first_seen_at` : 99 j, comme le `or` du Python", () => {
    const r = noter(offre(1, { published_at: "hier", first_seen_at: "2026-10-20 11:00:00" }));
    expect(ligne(r, "fraîcheur")).toMatchObject({ points: 0, detail: "il y a 99 j" });
  });

  it("une date seule (sans heure) est lue à minuit : 1,5 j → 22/25 → 11, « il y a 2 j »", () => {
    const r = noter(offre(1, { published_at: "2026-10-19" }));
    expect(ligne(r, "fraîcheur")).toMatchObject({ points: 11, detail: "il y a 2 j" });
    expect(r.raisons).toContain("fenêtre : 6 j restants");
  });

  it("une date ISO avec « T » est relue comme une date seule", () => {
    const r = noter(offre(1, { published_at: "2026-10-19T12:00:00" }));
    expect(ligne(r, "fraîcheur")).toMatchObject({ points: 11, detail: "il y a 2 j" });
  });

  it("une date dans le futur compte pour 0 j, jamais en négatif", () => {
    const r = noter(offre(1, { published_at: "2026-10-25 11:00:00" }));
    expect(ligne(r, "fraîcheur")).toMatchObject({ points: 12, detail: "il y a 0 j" });
  });
});

/* ---------------------------------------------------------------- fraîcheur */

describe("fraîcheur : paliers sur 12", () => {
  const paliers: [number, number][] = [[1, 12], [2, 11], [3, 9], [5, 7], [7, 5], [7 + 1 / 86400, 0]];
  it.each(paliers)("publiée il y a %f j → %i/12", (jours, points) => {
    expect(ligne(noter(offre(1, { published_at: ilYA(jours) })), "fraîcheur").points).toBe(points);
  });

  it("urgence : à 5,5 j il reste 1,5 j, affiché « expire dans 2 j »", () => {
    expect(noter(offre(1, { published_at: ilYA(5.5) })).raisons).toContain("⏳ expire dans 2 j");
  });
});

/* --------------------------------------------------------------- calendrier */

describe("calendrier : date de début", () => {
  const cas: [string | null, number, string][] = [
    [null, 3, "date de début inconnue — à confirmer"],
    ["ASAP", 3, "date de début inconnue — à confirmer"],
    ["Immédiat", 3, "date de début inconnue — à confirmer"],
    ["printemps 2027", 3, "date de début « printemps 2027 » à confirmer"],
    ["2027-02-15", 0, "⚠️ démarre le 2027-02-15 — tu es encore en cours"],
    ["2027-03-01", 8, "début 2027-03-01 compatible"],
    ["2027-09-30", 8, "début 2027-09-30 compatible"],
    ["2027-10-01", 5, "début 2027-10-01 tardif pour la rentrée M1"],
  ];
  it.each(cas)("début %s → %i/8", (debut, points, detail) => {
    expect(ligne(noter(offre(1, { start_date: debut })), "calendrier")).toMatchObject({ points, detail });
  });
});

/* ---------------------------------------------------------- source et dépôt */

describe("source et coût de dépôt", () => {
  it("site carrière vérifiable + Workday : source 8, dépôt 2 (compte + 8 étapes)", () => {
    const r = noter(offre(1, { canonical_url: "https://acme.wd3.myworkdayjobs.com/x" }));
    expect(ligne(r, "source")).toMatchObject({ points: 8, detail: "site carrière vérifiable" });
    expect(ligne(r, "dépôt")).toMatchObject({ points: 2, detail: "compte + 8 étapes" });
  });

  it("alerte LinkedIn : source 2, dépôt 4 (retrouver l'offre d'origine)", () => {
    const r = noter(offre(1, { source: "linkedin", canonical_url: "https://www.linkedin.com/jobs/view/1" }));
    expect(ligne(r, "source")).toMatchObject({ points: 2, detail: "alerte non vérifiable" });
    expect(ligne(r, "dépôt")).toMatchObject({ points: 4, detail: "alerte — il faut retrouver l'offre d'origine" });
  });

  it("portail du CNES : source 8, dépôt 5 (4 × 6 / 5 = 4,8 → 5)", () => {
    const r = noter(offre(1, { canonical_url: "https://recrutement.cnes.fr/x" }));
    expect(ligne(r, "source").points).toBe(8);
    expect(ligne(r, "dépôt")).toMatchObject({ points: 5, detail: "portail du site carrière" });
  });

  it("autre source nommée : 7/12 → 5/8, le nom de la source est repris tel quel", () => {
    const r = noter(offre(1, { source: "hellowork", canonical_url: "https://hellowork.com/x" }));
    expect(ligne(r, "source")).toMatchObject({ points: 5, detail: "source hellowork" });
  });
});

/* ------------------------------------------------------------------ métier */

describe("métier", () => {
  const cas: [string, number, string][] = [
    ["Stage test et validation", 7, "tests / validation"],
    ["Stage gestion de projet", 5, "gestion de projet"],
    ["Stage logiciel embarqué temps réel", 2, "systèmes embarqués"],
    ["Stage mécanique", 2, "industrie / mécanique"],
  ];
  it.each(cas)("« %s » → %i/12 (%s)", (titre, points, detail) => {
    expect(ligne(noter(offre(1, { title: titre })), "métier")).toMatchObject({ points, detail });
  });

  it("à égalité, la première famille de la liste l'emporte (full stack avant data)", () => {
    expect(ligne(noter(offre(1, { title: "data web" })), "métier").detail).toBe("développement full stack");
  });

  it("le titre pèse double face à la description", () => {
    const r = noter(offre(1, { title: "Stage Data Analyst", description: "Outil web interne." }));
    expect(ligne(r, "métier")).toMatchObject({ points: 12, detail: "data / analyse" });
  });
});

/* ------------------------------------------------------------------ dossier */

describe("dossier", () => {
  it("une action enregistrée : 2/4 (dossier entamé)", () => {
    expect(ligne(noter(offre(7), new Map([[7, 1]])), "dossier")).toMatchObject({ points: 2, detail: "dossier entamé" });
  });

  it("les actions d'une autre offre ne comptent pas", () => {
    expect(ligne(noter(offre(7), new Map([[8, 5]])), "dossier").points).toBe(0);
  });
});

/* ---------------------------------------------------------------- diversité */

describe("diversité : plus aucun plafond de groupe (décision du 21/10/2026)", () => {
  it("Airbus, Airbus Protect, ATR et Airbus Defence forment un seul groupe : la quatrième garde ses 14 points", () => {
    const offres = [
      { ...plancher(20), company: "Airbus" },
      { ...plancher(21), company: "Airbus Protect" },
      { ...plancher(22), company: "ATR" },
      { ...plancher(23), company: "Airbus Defence and Space" },
    ];
    const r = classer(offres, MAINTENANT).find((x) => x.id === 23)!;
    expect(ligne(r, "diversité")).toEqual({
      critere: "diversité", points: 14, max: 14, detail: "Airbus (et Airbus Protect, ATR, Atlantic) — 4ᵉ place",
    });
  });

  it("le comptage des places suit toujours la note : la meilleure du groupe est première", () => {
    const meilleure = { ...IDEALE, id: 99, company: "Airbus" };
    const r = classer([plancher(20), plancher(21), plancher(22), meilleure], MAINTENANT);
    expect(ligne(r.find((x) => x.id === 99)!, "diversité").detail).toBe("Airbus (et Airbus Protect, ATR, Atlantic) — 1ᵉ place");
    expect(ligne(r.find((x) => x.id === 22)!, "diversité").points).toBe(14);
  });

  it("entreprise absente : les offres sans entreprise partagent le groupe « ? », sans plafond non plus", () => {
    const resultats = classer([offre(30), offre(31), offre(32), offre(33)], MAINTENANT);
    expect(resultats.map((r) => r.total)).toEqual([38, 38, 38, 38]);
    expect(ligne(resultats[3], "diversité").detail).toBe("? — 4ᵉ place");
  });
});

/* ------------------------------------------- contrat inconnu et lieu vide */

describe("contrat inconnu", () => {
  type AvecContrat = OffreAScorer & { contract_known: boolean };

  it("à égalité de note, le départage se fait par identifiant — et plus personne n'est plafonné", () => {
    const offres: AvecContrat[] = [
      { ...plancher(1), contract_known: false },
      { ...plancher(2), contract_known: true },
      { ...plancher(3), contract_known: true },
      { ...plancher(4), contract_known: true },
    ];
    const ordonnees = ordreDuPipeline(offres);
    expect(ordonnees.map((o) => o.id)).toEqual([2, 3, 4, 1]);
    const resultats = classer(ordonnees, MAINTENANT);
    // Le sans-contrat arrive en dernier à l'entrée, mais à égalité de note c'est son identifiant qui
    // décide : il passe premier du groupe, sans perdre ses 14 points.
    const sansContrat = resultats.find((r) => r.id === 1)!;
    expect(ligne(sansContrat, "diversité")).toMatchObject({
      points: 14, detail: "Airbus (et Airbus Protect, ATR, Atlantic) — 1ᵉ place",
    });
    expect(resultats.map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });

  it("les offres sans contrat sont rangées de la plus récente à la plus ancienne", () => {
    const offres: AvecContrat[] = [
      { ...offre(1, { published_at: "2026-10-15" }), contract_known: false },
      { ...offre(2, { first_seen_at: "2026-10-19 08:00:00" }), contract_known: false },
      { ...offre(3), contract_known: false },
    ];
    expect(ordreDuPipeline(offres).map((o) => o.id)).toEqual([2, 1, 3]);
  });
});

/* ------------------------------------------------ découpage et heure du calcul */

describe("découpage d'une ligne du bulletin", () => {
  it("lit les critères accentués (cohérence, fraîcheur, dépôt, diversité)", () => {
    expect(decouper([
      "cohérence 24/30 (2/2 exigences)",
      "fraîcheur 12/12 (il y a 0 j)",
      "dépôt 6/6 (formulaire court)",
      "diversité 14/14 (? — 1ᵉ place)",
    ])).toEqual([
      { critere: "cohérence", points: 24, max: 30, detail: "2/2 exigences" },
      { critere: "fraîcheur", points: 12, max: 12, detail: "il y a 0 j" },
      { critere: "dépôt", points: 6, max: 6, detail: "formulaire court" },
      { critere: "diversité", points: 14, max: 14, detail: "? — 1ᵉ place" },
    ]);
  });

  it("garde les parenthèses imbriquées du détail et ignore les lignes d'urgence", () => {
    expect(decouper(["fiche 6/6 (fiche complète (4 technos))", "⏳ expire dans 2 j", "fenêtre : 5 j restants"]))
      .toEqual([{ critere: "fiche", points: 6, max: 6, detail: "fiche complète (4 technos)" }]);
  });

  it("un critère sans détail a un détail `null`, pas une chaîne inventée", () => {
    expect(decouper(["dossier 0/4"])).toEqual([{ critere: "dossier", points: 0, max: 4, detail: null }]);
  });
});

describe("heure du calcul", () => {
  it("repart de `generated_at`, décalé du fuseau du pipeline (UTC par défaut)", () => {
    expect(maintenantDeLExport("2026-10-20T02:33:48+00:00")).toBe(Date.UTC(2026, 9, 20, 2, 33, 48));
    expect(maintenantDeLExport("2026-10-20T02:33:48+00:00", 2)).toBe(Date.UTC(2026, 9, 20, 4, 33, 48));
  });
});

/* ==========================================================================
 * `scoreOffre` — les quatre critères ajoutés le 22/10/2026
 *
 * Ces valeurs sont recopiées de `scoring.py` (source de vérité) : +7 Bac+3, -8 Bac+5, -4 par
 * prérequis métier, plafond 55 sur bloqueur administratif, -10 / +3 / 0 sur les dates.
 * ========================================================================== */

function offreScore(champs: Partial<OffreAEvaluer> = {}): OffreAEvaluer {
  return {
    id: 1, source: "thales", canonical_url: "https://example.test/offres/critere",
    title: "Stage développeur web", company: "Acme", location: "Toulouse",
    contract_type: "Stage", education_required: null, description: "",
    skills_required: ["Python", "SQL"], skills_optional: [],
    miage_mentioned: false, start_date: null, published_at: null, first_seen_at: null,
    ...champs,
  };
}

describe("scoreOffre — niveau de diplôme exigé", () => {
  it("Bac+3 demandé → bonus +7", () => {
    const r = scoreOffre(offreScore({ education_required: "Bac+3 validé (licence)" }));
    expect(r.niveau_diplome).toBe(7);
    expect(r.reasons).toContain("niveau de diplôme : Bac+3 demandé (+7)");
  });

  it("Master 2 exigé → malus -8", () => {
    const r = scoreOffre(offreScore({ education_required: "Master 2 exigé" }));
    expect(r.niveau_diplome).toBe(-8);
    expect(r.reasons.join(" ")).toContain("Bac+5 exigé");
  });

  it("diplôme d'ingénieur exigé → malus -8", () => {
    expect(scoreOffre(offreScore({ education_required: "Diplôme d'ingénieur exigé" })).niveau_diplome)
      .toBe(-8);
  });

  it("BUT en capitales (Bac+2) et le mot « but » restent neutres", () => {
    expect(scoreOffre(offreScore({ education_required: "BUT Informatique" })).niveau_diplome).toBe(0);
    expect(scoreOffre(offreScore({ education_required: "Le but est de progresser" })).niveau_diplome).toBe(0);
  });

  it("« Ingénieur » dans le titre n'est pas un niveau de diplôme", () => {
    expect(scoreOffre(offreScore({ title: "Ingénieur Développement Logiciel" })).niveau_diplome).toBe(0);
  });

  it("Bac+5 en cours → -8 : une annonce décrit une exigence, pas le candidat", () => {
    expect(scoreOffre(offreScore({ education_required: "Bac+5 en cours (M1)" })).niveau_diplome).toBe(-8);
  });

  it("Bac+4/5 → -8 (le minimum est 4, au-dessus de la L3)", () => {
    expect(scoreOffre(offreScore({ education_required: "Niveau BAC+4/5 requis" })).niveau_diplome).toBe(-8);
    expect(scoreOffre(offreScore({ education_required: "Bac+4 et 5" })).niveau_diplome).toBe(-8);
  });

  it("Bac+3 à Bac+5 → +7 (le niveau le plus accessible est Bac+3)", () => {
    expect(scoreOffre(offreScore({ education_required: "Bac+3 à Bac+5" })).niveau_diplome).toBe(7);
  });

  it("« dernière année de cycle ingénieur » → -8", () => {
    expect(scoreOffre(offreScore({
      education_required: "Étudiant(e) en Master 2 (ou dernière année de cycle ingénieur)",
    })).niveau_diplome).toBe(-8);
  });

  it("« Master's degree » / « MSc » en anglais → -8 (toute l'annonce est lue)", () => {
    expect(scoreOffre(offreScore({
      description: "Requirements: Master's degree in Computer Science.",
    })).niveau_diplome).toBe(-8);
    expect(scoreOffre(offreScore({ description: "MSc in Data Science required." })).niveau_diplome)
      .toBe(-8);
  });
});

describe("scoreOffre — compétence exigée hors profil", () => {
  it("C++ déclaré → -3 et ligne explicite", () => {
    const r = scoreOffre(offreScore({ skills_required: ["C++"] }));
    expect(r.competences_hors_profil).toBe(-3);
    expect(r.reasons).toContain("compétence exigée hors profil : C++ (-3)");
  });

  it("deux technos absentes → -6 ; plafond à -9 au-delà de trois", () => {
    expect(scoreOffre(offreScore({ skills_required: ["C++", "Vue.js"] })).competences_hors_profil)
      .toBe(-6);
    expect(scoreOffre(offreScore({ skills_required: ["C++", "Vue.js", "Spark", "GitLab"] }))
      .competences_hors_profil).toBe(-9);
  });

  it("les technos du référentiel ne coûtent rien, celles qui en sont sorties coûtent -3", () => {
    // Docker a été retiré du référentiel le 22/10/2026 (il n'est prouvé par aucun projet des CV
    // maîtres) : une annonce qui l'exige est pénalisée, comme le fait `scoring.py`.
    expect(scoreOffre(offreScore({ skills_required: ["Python", "TypeScript", "Java"] }))
      .competences_hors_profil).toBe(0);
    expect(scoreOffre(offreScore({ skills_required: ["Docker"] }))
      .competences_hors_profil).toBe(-3);
  });
});

describe("scoreOffre — dates", () => {
  it("début février 2027 → -10 ; début avril 2027 → +3 ; inconnu → 0", () => {
    expect(scoreOffre(offreScore({ start_date: "2027-02-01" })).dates).toBe(-10);
    expect(scoreOffre(offreScore({ start_date: "2027-04-01" })).dates).toBe(3);
    expect(scoreOffre(offreScore({ start_date: null, description: "Aucune date." })).dates).toBe(0);
  });

  it("date lue dans l'annonce quand la colonne est vide → -10, avec la source dans la ligne", () => {
    const r = scoreOffre(offreScore({
      start_date: null,
      description: "Le stage pourrait débuter en Janvier 2027, au sein de l'équipe.",
    }));
    expect(r.dates).toBe(-10);
    expect(r.reasons.join(" ")).toContain("(lu dans l'annonce)");
  });
});

describe("scoreOffre — prérequis métier hors profil", () => {
  it("deux concepts requis → -8, une ligne par concept groupé", () => {
    const r = scoreOffre(offreScore({
      description: "Vous maîtrisez la mécanique spatiale et le traitement du signal.",
    }));
    expect(r.prerequis_metier).toBe(-8);
    expect(r.reasons.join("\n"))
      .toContain("prérequis métier hors profil : mécanique spatiale, traitement du signal");
  });

  it("le couplet institutionnel « Aéronautique & Spatial » ne compte pas", () => {
    const r = scoreOffre(offreScore({
      description: "Thales, leader de l'Aéronautique & Spatial et de la Cyber.",
    }));
    expect(r.prerequis_metier).toBe(0);
  });

  it("un prérequis cité sans marqueur d'exigence ne compte pas", () => {
    expect(scoreOffre(offreScore({ description: "Nos équipes travaillent sur le spatial." }))
      .prerequis_metier).toBe(0);
  });
});

describe("scoreOffre — bloqueurs administratifs", () => {
  it("habilitation de sécurité → score plafonné à 55, ligne visible", () => {
    const r = scoreOffre(offreScore({
      title: "Développeur Full-Stack React / Node.js",
      skills_required: ["React", "Node.js", "PostgreSQL", "Git", "Docker"],
      education_required: "Bac+3", miage_mentioned: true,
      description: "Ce poste nécessite une habilitation de sécurité.",
    }));
    expect(r.plafond).toBe(55);
    expect(r.score).toBeLessThanOrEqual(55);
    expect(r.bloqueur_admin).toBe(true);
    expect(r.reasons).toContain("⛔ bloqueur administratif : habilitation de securite — score plafonné à 55");
    expect(r.breakdown.find((l) => l.critere === "plafond administratif")?.points).toBe(55);
  });

  it("nationalité française → bloqueur aussi", () => {
    expect(bloqueursAdmin(offreScore({ description: "Le candidat doit posséder la nationalité française." })))
      .toEqual(["nationalite francaise"]);
  });

  it("sans bloqueur, pas de plafond", () => {
    expect(scoreOffre(offreScore()).plafond).toBeNull();
  });
});

describe("scoreOffre — compatibilité des dates", () => {
  it("début février 2027 → -10 et ligne explicite", () => {
    const r = scoreOffre(offreScore({ start_date: "2027-02-01" }));
    expect(r.dates).toBe(-10);
    expect(r.reasons).toContain(
      "début 2027-02-01 : incompatible avec une disponibilité fin mars 2027 (-10)");
  });

  it("début avril 2027 → +3", () => {
    expect(scoreOffre(offreScore({ start_date: "2027-04-01" })).dates).toBe(3);
  });

  it("date inconnue → neutre", () => {
    expect(scoreOffre(offreScore({ start_date: null })).dates).toBe(0);
  });
});

describe("scoreOffre — contrat du moteur", () => {
  it("chaque nouveau critère a sa ligne dans la décomposition", () => {
    const r = scoreOffre(offreScore({
      education_required: "Bac+3", start_date: "2027-02-01",
      description: "Ce poste nécessite une habilitation de sécurité.",
    }));
    expect(r.breakdown.map((l) => l.critere)).toEqual(expect.arrayContaining([
      "niveau de diplôme", "prérequis métier", "dates", "plafond administratif",
    ]));
  });

  it("déterministe : deux appels donnent le même objet", () => {
    const o = offreScore({ education_required: "Bac+3", start_date: "2027-02-01" });
    expect(scoreOffre(o)).toEqual(scoreOffre(o));
  });
});

/* --------------------------------- les quatre critères dans le bulletin (classer) */

/**
 * Le bulletin (`classer`) porte les mêmes quatre critères que `scoreOffre` : les lignes sont dans
 * `score_breakdown`, leur somme est la note affichée, et le plafond administratif borne à 55.
 * L'offre de base reprend l'offre idéale, pour que seuls les critères testés fassent bouger la note.
 */
describe("classer — les quatre critères du 22/10/2026 dans le bulletin", () => {
  function offreBilan(id: number, champs: Partial<OffreAEvaluer> = {}): OffreAEvaluer {
    return { ...IDEALE, id, ...champs };
  }

  it("Bac+3 demandé → ligne diplôme +7", () => {
    const r = noter(offreBilan(101, { education_required: "Bac+3 validé (licence)" }));
    expect(ligne(r, "diplôme")).toEqual({
      critere: "diplôme", points: 7, max: 0,
      detail: "niveau de diplôme : Bac+3 demandé (+7)",
    });
    expect(somme(r)).toBe(r.total);
  });

  it("Master exigé → ligne diplôme -8", () => {
    const r = noter(offreBilan(102, { education_required: "Master 2 exigé" }));
    expect(ligne(r, "diplôme").points).toBe(-8);
    expect(ligne(r, "diplôme").detail).toBe("niveau de diplôme : Bac+5 exigé (-8)");
    expect(somme(r)).toBe(r.total);
  });

  it("prérequis métier hors profil → -4 par concept requis", () => {
    const r = noter(offreBilan(103, {
      description: DESCRIPTION_LONGUE + " Vous maîtrisez la mécanique spatiale et le traitement du signal.",
    }));
    expect(ligne(r, "prérequis")).toMatchObject({
      points: -8, max: 0,
      detail: "prérequis métier hors profil : mécanique spatiale, traitement du signal (-8)",
    });
    expect(somme(r)).toBe(r.total);
  });

  it("habilitation de sécurité → note plafonnée à 55, ligne de plafond explicite", () => {
    const r = noter(offreBilan(104, {
      description: DESCRIPTION_LONGUE + " Ce poste nécessite une habilitation de sécurité.",
    }));
    expect(r.total).toBe(55);
    expect(ligne(r, "plafond").detail).toBe(
      "⛔ bloqueur administratif : habilitation de securite — note plafonnée à 55");
    // La ligne de plafond ne retire pas de points forfaitaires : elle ramène la somme à 55.
    expect(somme(r)).toBe(55);
  });

  it("début février 2027 → ligne dates -10", () => {
    const r = noter(offreBilan(105, { start_date: "2027-02-01" }));
    expect(ligne(r, "dates")).toEqual({
      critere: "dates", points: -10, max: 0,
      detail: "début 2027-02-01 : incompatible avec une disponibilité fin mars 2027 (-10)",
    });
  });

  it("début avril 2027 → ligne dates +3", () => {
    const r = noter(offreBilan(106, { start_date: "2027-04-01" }));
    expect(ligne(r, "dates").points).toBe(3);
    expect(ligne(r, "dates").detail).toBe(
      "début 2027-04-01 : compatible avec une disponibilité fin mars 2027 (+3)");
  });

  it("à égalité de note, le classement départage par identifiant", () => {
    const offres = [offreBilan(303), offreBilan(301), offreBilan(302)];
    expect(classer(offres, MAINTENANT).map((r) => r.id)).toEqual([301, 302, 303]);
  });
});
