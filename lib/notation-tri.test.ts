/**
 * La clé de tri à 7 niveaux, celle des non classables et celle des offres fermées.
 *
 * Tests de table : chaque ligne dit « `a` passe avant `b`, et c'est CE niveau qui les départage ».
 * Un niveau qui ne servirait jamais, ou qui servirait à la place d'un autre, fait échouer une ligne.
 * Données synthétiques : aucune offre réelle.
 */
import { describe, expect, it } from "vitest";
import type { NotationOffre } from "./notation-contrat";
import { melanger, offreDomaine, offreNonEvaluee, offreOutils, qualiteExemple } from "./notation-exemples";
import {
  NIVEAUX_TRI,
  NIVEAUX_TRI_FERMEE,
  NIVEAUX_TRI_NON_CLASSABLE,
  blocDe,
  comparerOffres,
  niveauDecisif,
  trierOffres,
} from "./notation-tri";

type Ligne = [nom: string, avant: NotationOffre, apres: NotationOffre, niveau: string];

function verifier([, avant, apres, niveau]: Ligne) {
  expect(niveauDecisif(avant, apres), "niveau décisif").toBe(niveau);
  expect(comparerOffres(avant, apres), "avant doit précéder").toBeLessThan(0);
  expect(comparerOffres(apres, avant), "apres doit suivre").toBeGreaterThan(0);
  expect(trierOffres([apres, avant]).map((o) => o.id)).toEqual([avant.id, apres.id]);
}

describe("les sept niveaux de la clé des classables, un à un", () => {
  const lignes: Ligne[] = [
    // 1. palier
    ["palier : 7 sur 10 avant 6 sur 10", offreOutils(1, 7, 10), offreOutils(2, 6, 10), "palier"],
    ["palier : 10 sur 10 avant 9 sur 10", offreOutils(3, 10, 10), offreOutils(4, 9, 10), "palier"],
    ["palier : 1 sur 10 avant 0 sur 10", offreOutils(5, 1, 10), offreOutils(6, 0, 10), "palier"],
    ["palier : 2 sur 3 (60) avant 1 sur 2 (50)", offreOutils(7, 2, 3), offreOutils(8, 1, 2), "palier"],
    ["le palier passe avant la source : 40 en titre avant 30 en texte", offreOutils(9, 4, 10, { source_lecture: "titre" }), offreOutils(10, 3, 10), "palier"],
    ["le palier passe avant le domaine : domaine à 100 avant des outils à 90", offreDomaine(11, true), offreOutils(12, 9, 10), "palier"],
    // 2. source de lecture
    ["source : texte avant titre, même palier", offreOutils(13, 1, 2), offreOutils(14, 1, 2, { source_lecture: "titre" }), "source_lecture"],
    ["source : le texte passe avant le titre même à ratio plus faible", offreOutils(15, 5, 10), offreOutils(16, 59, 100, { source_lecture: "titre" }), "source_lecture"],
    // 3. domaine seul après outil
    ["domaine seul : des outils à 100 avant le domaine à 100", offreOutils(17, 1, 1), offreDomaine(18, true), "domaine_seul"],
    ["domaine seul : même à zéro, les outils d'abord", offreOutils(19, 0, 3), offreDomaine(20, false), "domaine_seul"],
    // 4. ratio exact
    ["ratio exact : 2 sur 3 avant 3 sur 5 (même palier 60)", offreOutils(21, 2, 3), offreOutils(22, 3, 5), "ratio_exact"],
    ["ratio exact : 3 sur 4 avant 7 sur 10 (même palier 70)", offreOutils(23, 3, 4), offreOutils(24, 7, 10), "ratio_exact"],
    // 5. nombre de technologies
    ["nombre : 4 sur 4 avant 1 sur 1", offreOutils(25, 4, 4), offreOutils(26, 1, 1), "nombre_technologies"],
    ["nombre : 4 sur 8 avant 1 sur 2 (ratios égaux)", offreOutils(27, 4, 8), offreOutils(28, 1, 2), "nombre_technologies"],
    // 6. fraîcheur
    ["fraîcheur : 2 jours avant 9 jours", offreOutils(29, 2, 4, { age_jours: 2 }), offreOutils(30, 2, 4, { age_jours: 9 }), "fraicheur"],
    ["fraîcheur : un âge connu avant un âge inconnu", offreOutils(31, 2, 4, { age_jours: 400 }), offreOutils(32, 2, 4, { age_jours: null }), "fraicheur"],
    ["fraîcheur : 0 jour avant 1 jour", offreOutils(33, 2, 4, { age_jours: 0 }), offreOutils(34, 2, 4, { age_jours: 1 }), "fraicheur"],
    // 7. numéro
    ["numéro : le plus grand d'abord, tout le reste égal", offreOutils(36, 2, 4), offreOutils(35, 2, 4), "numero"],
  ];
  it.each(lignes)("%s", (...ligne) => verifier(ligne));

  it("couvre exactement les sept niveaux annoncés", () => {
    expect(NIVEAUX_TRI).toHaveLength(7);
    const vus = new Set(lignes.map(([, a, b]) => niveauDecisif(a, b)));
    for (const niveau of NIVEAUX_TRI) expect(vus.has(niveau), `aucune ligne n'exerce « ${niveau} »`).toBe(true);
  });
});

describe("les blocs : classables, puis non classables, puis fermées", () => {
  const lignes: Ligne[] = [
    ["un classable à zéro avant un non classable", offreOutils(1, 0, 3), offreNonEvaluee(2, "non_extraite", { qualite: qualiteExemple("complete", 100) }), "bloc"],
    ["un domaine seul à zéro reste classable : avant un non classable", offreDomaine(3, false), offreNonEvaluee(4, "texte_non_capture"), "bloc"],
    ["un non classable avant une offre fermée classable", offreNonEvaluee(5, "non_extraite", { qualite: qualiteExemple("texte_non_capture", null) }), offreOutils(6, 3, 3, { fermee: true }), "bloc"],
    ["un classable avant une fermée, même meilleure en tout point", offreOutils(7, 0, 1), offreOutils(8, 1, 1, { fermee: true, age_jours: 0 }), "bloc"],
  ];
  it.each(lignes)("%s", (...ligne) => verifier(ligne));

  it("blocDe", () => {
    expect(blocDe(offreOutils(1, 1, 2))).toBe("classable");
    expect(blocDe(offreDomaine(2, true))).toBe("classable");
    expect(blocDe(offreNonEvaluee(3, "profil_non_renseigne"))).toBe("non_classable");
    expect(blocDe(offreOutils(4, 1, 2, { fermee: true }))).toBe("fermee");
    expect(blocDe(offreNonEvaluee(5, "non_extraite", { fermee: true }))).toBe("fermee");
  });
});

describe("la clé des non classables", () => {
  const lignes: Ligne[] = [
    ["niveau de qualité : complète avant partielle", offreNonEvaluee(1, "non_extraite", { qualite: qualiteExemple("complete", 10) }), offreNonEvaluee(2, "non_extraite", { qualite: qualiteExemple("partielle", 99) }), "niveau_qualite"],
    ["niveau de qualité : partielle avant texte non capturé", offreNonEvaluee(3, "non_extraite", { qualite: qualiteExemple("partielle", 10) }), offreNonEvaluee(4, "texte_non_capture", { qualite: qualiteExemple("texte_non_capture", 99) }), "niveau_qualite"],
    ["note de qualité : 90 avant 70", offreNonEvaluee(5, "non_extraite", { qualite: qualiteExemple("complete", 90) }), offreNonEvaluee(6, "non_extraite", { qualite: qualiteExemple("complete", 70) }), "note_qualite"],
    ["note de qualité : une note de 0 avant une note nulle", offreNonEvaluee(7, "non_extraite", { qualite: qualiteExemple("partielle", 0) }), offreNonEvaluee(8, "non_extraite", { qualite: qualiteExemple("partielle", null) }), "note_qualite"],
    ["fraîcheur : la plus récente d'abord, notes égales", offreNonEvaluee(9, "non_extraite", { age_jours: 1 }), offreNonEvaluee(10, "non_extraite", { age_jours: 8 }), "fraicheur"],
    ["numéro : le plus grand d'abord", offreNonEvaluee(12, "non_extraite"), offreNonEvaluee(11, "non_extraite"), "numero"],
  ];
  it.each(lignes)("%s", (...ligne) => verifier(ligne));

  it("la cause de l'absence ne départage pas : seuls la qualité, la fraîcheur et le numéro comptent", () => {
    const a = offreNonEvaluee(20, "profil_non_renseigne");
    const b = offreNonEvaluee(19, "texte_non_capture");
    expect(niveauDecisif(a, b)).toBe("numero");
  });

  it("profil vide : toutes les offres sont non classables et suivent la qualité puis la fraîcheur", () => {
    const offres = [
      offreNonEvaluee(1, "profil_non_renseigne", { qualite: qualiteExemple("texte_non_capture", null), age_jours: 0 }),
      offreNonEvaluee(2, "profil_non_renseigne", { qualite: qualiteExemple("complete", 60), age_jours: 30 }),
      offreNonEvaluee(3, "profil_non_renseigne", { qualite: qualiteExemple("complete", 85), age_jours: 12 }),
      offreNonEvaluee(4, "profil_non_renseigne", { qualite: qualiteExemple("partielle", 95), age_jours: 2 }),
    ];
    expect(trierOffres(offres).map((o) => o.id)).toEqual([3, 2, 4, 1]);
  });

  it("annonce les quatre niveaux", () => {
    expect(NIVEAUX_TRI_NON_CLASSABLE).toEqual(["niveau_qualite", "note_qualite", "fraicheur", "numero"]);
  });
});

describe("la clé des offres fermées", () => {
  const lignes: Ligne[] = [
    ["la fermeture la plus récente d'abord", offreOutils(1, 1, 2, { fermee: true, fermee_le: "2026-11-12" }), offreOutils(2, 2, 2, { fermee: true, fermee_le: "2026-11-02" }), "date_fermeture"],
    ["une date de fermeture inconnue en dernier", offreOutils(3, 0, 2, { fermee: true, fermee_le: "2025-01-01" }), offreOutils(4, 2, 2, { fermee: true, fermee_le: null }), "date_fermeture"],
    ["à date égale, le numéro le plus grand d'abord", offreOutils(6, 1, 2, { fermee: true, fermee_le: "2026-11-12" }), offreOutils(5, 1, 2, { fermee: true, fermee_le: "2026-11-12" }), "numero"],
    ["classable ou non, la compatibilité ne compte pas ici", offreNonEvaluee(8, "non_extraite", { fermee: true, fermee_le: "2026-11-12" }), offreOutils(7, 3, 3, { fermee: true, fermee_le: "2026-10-12" }), "date_fermeture"],
  ];
  it.each(lignes)("%s", (...ligne) => verifier(ligne));

  it("annonce les deux niveaux", () => {
    expect(NIVEAUX_TRI_FERMEE).toEqual(["date_fermeture", "numero"]);
  });
});

describe("le tri est un ordre total, stable et sans effet de bord", () => {
  /** Un lot varié : tous les blocs, tous les niveaux, des égalités à chaque étage. */
  const lot: NotationOffre[] = [];
  let id = 100;
  for (const [c, n] of [[0, 1], [1, 1], [0, 3], [1, 3], [2, 3], [3, 3], [3, 5], [1, 2], [4, 8], [7, 10], [3, 4]] as const) {
    for (const source of ["texte", "titre"] as const) {
      lot.push(offreOutils(id++, c, n, { source_lecture: source, age_jours: (id * 7) % 5 }));
    }
  }
  lot.push(offreDomaine(id++, true), offreDomaine(id++, false), offreDomaine(id++, true, { source_lecture: "titre" }));
  for (const niveau of ["complete", "partielle", "texte_non_capture"] as const) {
    for (const note of [null, 40, 80]) {
      lot.push(offreNonEvaluee(id++, "non_extraite", { qualite: qualiteExemple(niveau, note), age_jours: note === null ? null : note % 3 }));
    }
  }
  lot.push(
    offreOutils(id++, 2, 2, { fermee: true, fermee_le: "2026-11-01" }),
    offreOutils(id++, 0, 2, { fermee: true, fermee_le: "2026-11-09" }),
    offreOutils(id++, 1, 2, { fermee: true, fermee_le: null }),
    offreNonEvaluee(id++, "profil_non_renseigne", { fermee: true, fermee_le: "2026-11-05" }),
  );

  const attendu = trierOffres(lot).map((o) => o.id);

  it("donne le même ordre quel que soit l'ordre d'entrée (50 mélanges)", () => {
    for (let graine = 1; graine <= 50; graine++) {
      expect(trierOffres(melanger(lot, graine)).map((o) => o.id), `graine ${graine}`).toEqual(attendu);
    }
  });

  it("ne modifie pas la liste reçue", () => {
    const entree = melanger(lot, 99);
    const copie = entree.map((o) => o.id);
    trierOffres(entree);
    expect(entree.map((o) => o.id)).toEqual(copie);
  });

  it("est réflexif, antisymétrique, transitif, et ne rend 0 que pour une même offre", () => {
    for (const a of lot) {
      expect(comparerOffres(a, a)).toBe(0);
      for (const b of lot) {
        const ab = Math.sign(comparerOffres(a, b));
        // `===` et non `toBe` : 0 et -0 sont le même résultat ici (Object.is les distinguerait).
        expect(ab === -Math.sign(comparerOffres(b, a)), `#${a.id} et #${b.id} doivent être symétriques`).toBe(true);
        if (a !== b) expect(ab, `#${a.id} et #${b.id} ne doivent pas être égales`).not.toBe(0);
        if (ab < 0) {
          for (const c of lot) {
            if (comparerOffres(b, c) < 0) expect(comparerOffres(a, c), `#${a.id} < #${b.id} < #${c.id}`).toBeLessThan(0);
          }
        }
      }
    }
  });

  it("place les blocs dans l'ordre classables, non classables, fermées", () => {
    const blocs = trierOffres(lot).map(blocDe);
    const premierNonClassable = blocs.indexOf("non_classable");
    const premiereFermee = blocs.indexOf("fermee");
    expect(blocs.lastIndexOf("classable")).toBeLessThan(premierNonClassable);
    expect(blocs.lastIndexOf("non_classable")).toBeLessThan(premiereFermee);
  });

  it("à l'intérieur du premier bloc, aucun palier ne remonte après un palier plus bas", () => {
    const classables = trierOffres(lot).filter((o) => blocDe(o) === "classable");
    const paliers = classables.map((o) =>
      o.compatibilite.etat === "evaluee" ? Math.floor((10 * o.compatibilite.couvertes) / o.compatibilite.exigees) * 10 : -1,
    );
    expect([...paliers].sort((a, b) => b - a)).toEqual(paliers);
  });
});
