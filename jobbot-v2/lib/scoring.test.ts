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

const CRITERES = ["cohérence", "métier", "source", "fiche", "calendrier", "dépôt", "dossier", "fraîcheur", "diversité"];
const MAXIMA = [30, 12, 8, 6, 8, 6, 4, 12, 14];

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
    ]);
  });

  it("chaque ligne est à son maximum", () => {
    for (const l of r.breakdown) expect(l.points, l.critere).toBe(l.max);
  });

  it("reconnaît les quatre technos, toutes couvertes", () => {
    expect(r.exigences).toEqual(["Python", "React", "SQL", "Git"]);
    expect(r.manquants).toEqual([]);
  });
});

/* ------------------------------------------- forme du bulletin et invariants */

describe("forme du bulletin", () => {
  it("compte neuf critères, dans l'ordre, avec les maxima 30·12·8·6·8·6·4·12·14", () => {
    const r = noter(IDEALE);
    expect(r.breakdown.map((l) => l.critere)).toEqual(CRITERES);
    expect(r.breakdown.map((l) => l.max)).toEqual(MAXIMA);
    expect(MAXIMA.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("l'urgence est affichée mais jamais notée : elle n'entre pas dans le bulletin découpé", () => {
    const r = noter(offre(1, { published_at: ilYA(6.5) }));
    expect(r.raisons).toContain("⏳ dernier appel : expire dans 0 j");
    expect(r.raisons).toHaveLength(10);
    expect(r.breakdown).toHaveLength(9);
  });

  it("invariant : la somme des neuf critères égale la note totale, pour toutes les offres fabriquées", () => {
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
  it("note plancher : 5, quand chaque critère est au minimum et le groupe déjà plafonné", () => {
    const resultats = classer([plancher(20), plancher(21), plancher(22), plancher(23)], MAINTENANT);
    const dernier = resultats[3];
    expect(dernier.id).toBe(23);
    expect(dernier.total).toBe(5);
    expect(dernier.breakdown.map((l) => l.points)).toEqual([0, 0, 2, 1, 0, 2, 0, 0, 0]);
    expect(somme(dernier)).toBe(5);
  });

  it("les trois premières offres du même groupe gardent leurs 14 points de diversité (5 + 14 = 19)", () => {
    const resultats = classer([plancher(20), plancher(21), plancher(22), plancher(23)], MAINTENANT);
    expect(resultats.map((r) => r.total)).toEqual([19, 19, 19, 5]);
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

describe("diversité : plafond de trois offres par groupe", () => {
  it("Airbus, Airbus Protect et ATR forment un seul groupe : la quatrième offre perd ses 14 points", () => {
    const offres = [
      { ...plancher(20), company: "Airbus" },
      { ...plancher(21), company: "Airbus Protect" },
      { ...plancher(22), company: "ATR" },
      { ...plancher(23), company: "Airbus Defence and Space" },
    ];
    const r = classer(offres, MAINTENANT).find((x) => x.id === 23)!;
    expect(ligne(r, "diversité")).toEqual({
      critere: "diversité", points: 0, max: 14, detail: "plafond atteint chez Airbus (et Airbus Protect, ATR, Atlantic)",
    });
  });

  it("le plafond frappe l'offre la moins bien notée du groupe, pas la dernière arrivée", () => {
    const meilleure = { ...IDEALE, id: 99, company: "Airbus" };
    const r = classer([plancher(20), plancher(21), plancher(22), meilleure], MAINTENANT);
    expect(ligne(r.find((x) => x.id === 99)!, "diversité").detail).toBe("Airbus (et Airbus Protect, ATR, Atlantic) — 1ᵉ place");
    expect(ligne(r.find((x) => x.id === 22)!, "diversité").points).toBe(0);
  });

  it("entreprise absente : les offres sans entreprise partagent le groupe « ? » (comme le Python)", () => {
    const resultats = classer([offre(30), offre(31), offre(32), offre(33)], MAINTENANT);
    expect(resultats.map((r) => r.total)).toEqual([38, 38, 38, 24]);
    expect(ligne(resultats[3], "diversité").detail).toBe("plafond atteint chez ?");
  });
});

/* ------------------------------------------- contrat inconnu et lieu vide */

describe("contrat inconnu", () => {
  type AvecContrat = OffreAScorer & { contract_known: boolean };

  it("à égalité de note, l'offre sans contrat passe après les stages : c'est elle qui est plafonnée", () => {
    const offres: AvecContrat[] = [
      { ...plancher(1), contract_known: false },
      { ...plancher(2), contract_known: true },
      { ...plancher(3), contract_known: true },
      { ...plancher(4), contract_known: true },
    ];
    const ordonnees = ordreDuPipeline(offres);
    expect(ordonnees.map((o) => o.id)).toEqual([2, 3, 4, 1]);
    const sansContrat = classer(ordonnees, MAINTENANT).find((r) => r.id === 1)!;
    expect(ligne(sansContrat, "diversité").points).toBe(0);
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
