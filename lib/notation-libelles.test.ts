/**
 * Les libellés de la notation T4. Les phrases attendues sont écrites en dur : elles sont celles que
 * Fanel a décidées (« 2 sur 3 technologies exigées couvertes », « Éligible sous réserve : début et
 * durée non précisés », « domaine : IA »), et un changement de formulation doit faire échouer un test.
 * Données synthétiques.
 */
import { describe, expect, it } from "vitest";
import {
  CODES_A_VERIFIER,
  CODES_RESERVE,
  MOTIFS_REJET,
  NIVEAUX_QUALITE,
  CAUSES_COMPATIBILITE,
  type CodeAVerifier,
  type CodeReserve,
  type Compatibilite,
  type Eligibilite,
  type MotifRejet,
} from "./notation-contrat";
import {
  LIBELLE_A_VERIFIER,
  LIBELLE_CAUSE_COMPATIBILITE,
  LIBELLE_MOTIF_REJET,
  LIBELLE_NIVEAU_QUALITE,
  enumeration,
  libelleCompatibilite,
  libelleDimension,
  libelleEligibilite,
  libelleFermee,
  libelleFiltreFermees,
  libelleLecture,
  libelleManquantes,
  libelleNoteSecondaire,
  libelleReserves,
} from "./notation-libelles";
import { offreDomaine, offreNonEvaluee, offreOutils } from "./notation-exemples";

const compat = (c: Compatibilite) => c;
const eligible = (reserves: CodeReserve[] = []): Eligibilite => ({ statut: "eligible", reserves, a_verifier: [], motif_rejet: null });
const aVerifier = (a_verifier: CodeAVerifier[], reserves: CodeReserve[] = []): Eligibilite => ({ statut: "a_verifier", reserves, a_verifier, motif_rejet: null });
const rejetee = (motif: MotifRejet | null): Eligibilite => ({ statut: "rejetee", reserves: [], a_verifier: [], motif_rejet: motif });

describe("la compatibilité : « X sur N technologies exigées couvertes » d'abord, la note ensuite", () => {
  it("le chiffre principal, au pluriel", () => {
    expect(libelleCompatibilite(compat(offreOutils(1, 2, 3).compatibilite))).toBe("2 sur 3 technologies exigées couvertes");
    expect(libelleCompatibilite(compat(offreOutils(1, 0, 3).compatibilite))).toBe("0 sur 3 technologies exigées couvertes");
    expect(libelleCompatibilite(compat(offreOutils(1, 4, 4).compatibilite))).toBe("4 sur 4 technologies exigées couvertes");
  });
  it("le chiffre principal, au singulier pour une seule technologie", () => {
    expect(libelleCompatibilite(compat(offreOutils(1, 1, 1).compatibilite))).toBe("1 sur 1 technologie exigée couverte");
    expect(libelleCompatibilite(compat(offreOutils(1, 0, 1).compatibilite))).toBe("0 sur 1 technologie exigée couverte");
  });
  it("la note sur 100 vient en second", () => {
    expect(libelleNoteSecondaire(offreOutils(1, 2, 3).compatibilite)).toBe("Compatibilité 67 / 100");
    expect(libelleNoteSecondaire(offreOutils(1, 0, 3).compatibilite)).toBe("Compatibilité 0 / 100");
  });
  it("domaine seul : « domaine : IA », jamais de note sur 100 ni de « X sur N »", () => {
    for (const couverte of [true, false]) {
      const c = offreDomaine(1, couverte).compatibilite;
      expect(libelleCompatibilite(c)).toBe("domaine : IA");
      expect(libelleNoteSecondaire(c)).toBeNull();
      expect(libelleCompatibilite(c)).not.toMatch(/\d/);
      expect(libelleManquantes(c)).toBeNull();
    }
  });
  it("non évaluée : la cause en toutes lettres, pas de note", () => {
    expect(libelleCompatibilite(offreNonEvaluee(1, "profil_non_renseigne").compatibilite)).toBe("Profil non renseigné");
    expect(libelleCompatibilite(offreNonEvaluee(1, "non_extraite").compatibilite)).toBe("Technologies non extraites");
    expect(libelleCompatibilite(offreNonEvaluee(1, "texte_non_capture").compatibilite)).toBe("Texte de l'annonce non capturé");
    expect(libelleNoteSecondaire(offreNonEvaluee(1, "non_extraite").compatibilite)).toBeNull();
    for (const cause of CAUSES_COMPATIBILITE) expect(LIBELLE_CAUSE_COMPATIBILITE[cause]).not.toBe("");
  });
  it("la lecture du titre seul est dite ; la lecture du texte ne dit rien", () => {
    expect(libelleLecture(offreOutils(1, 1, 2, { source_lecture: "titre" }).compatibilite)).toBe("technologies lues dans le titre uniquement");
    expect(libelleLecture(offreDomaine(2, true, { source_lecture: "titre" }).compatibilite)).toBe("technologies lues dans le titre uniquement");
    expect(libelleLecture(offreOutils(3, 1, 2).compatibilite)).toBeNull();
    expect(libelleLecture(offreNonEvaluee(4, "texte_non_capture").compatibilite)).toBeNull();
  });
  it("les technologies manquantes sont listées sous le chiffre principal", () => {
    expect(libelleManquantes(offreOutils(1, 1, 3).compatibilite)).toBe("Manquantes : Outil1, Outil2");
    expect(libelleManquantes(offreOutils(1, 2, 3).compatibilite)).toBe("Manquante : Outil1");
    expect(libelleManquantes(offreOutils(1, 3, 3).compatibilite)).toBeNull();
    expect(libelleManquantes(offreNonEvaluee(1, "non_extraite").compatibilite)).toBeNull();
  });
});

describe("la qualité : trois niveaux, jamais de chiffre", () => {
  it("un libellé par niveau, tous différents", () => {
    const libelles = NIVEAUX_QUALITE.map((n) => LIBELLE_NIVEAU_QUALITE[n]);
    expect(libelles).toEqual(["Annonce complète", "Annonce partielle", "Texte non capturé"]);
    expect(new Set(libelles).size).toBe(3);
  });
  it("aucun libellé de qualité ne contient un chiffre", () => {
    for (const n of NIVEAUX_QUALITE) expect(LIBELLE_NIVEAU_QUALITE[n]).not.toMatch(/\d/);
    expect(libelleDimension({ cle: "contenu", etat: "evaluee", valeur: 63, cause: null })).not.toMatch(/\d/);
  });
  it("le détail d'une dimension dit pourquoi elle n'est pas évaluée", () => {
    expect(libelleDimension({ cle: "texte", etat: "non_evaluee", valeur: null, cause: "texte_non_capture" })).toBe("Texte : non évaluée, texte non capturé");
    expect(libelleDimension({ cle: "contenu", etat: "non_evaluee", valeur: null, cause: null })).toBe("Contenu : non évaluée");
    expect(libelleDimension({ cle: "tracabilite", etat: "non_applicable", valeur: null, cause: null })).toBe("Traçabilité : sans objet");
    expect(libelleDimension({ cle: "informations_essentielles", etat: "evaluee", valeur: 80, cause: null })).toBe("Informations essentielles");
  });
});

describe("l'éligibilité : « Éligible » seul uniquement sans réserve", () => {
  it("sans réserve : « Éligible »", () => {
    expect(libelleEligibilite(eligible())).toBe("Éligible");
  });
  it("la phrase décidée : début et durée non précisés", () => {
    expect(libelleEligibilite(eligible(["date_debut_inconnue", "duree_inconnue"]))).toBe("Éligible sous réserve : début et durée non précisés");
  });
  it("une seule réserve", () => {
    expect(libelleEligibilite(eligible(["date_debut_inconnue"]))).toBe("Éligible sous réserve : début non précisé");
    expect(libelleEligibilite(eligible(["duree_inconnue"]))).toBe("Éligible sous réserve : durée non précisée");
    expect(libelleEligibilite(eligible(["niveau_superieur"]))).toBe("Éligible sous réserve : niveau demandé supérieur au vôtre");
    expect(libelleEligibilite(eligible(["debut_des_que_possible"]))).toBe("Éligible sous réserve : début « dès que possible »");
  });
  it("plusieurs réserves, énumérées", () => {
    expect(libelleEligibilite(eligible(["date_debut_inconnue", "duree_inconnue", "niveau_superieur"]))).toBe(
      "Éligible sous réserve : début et durée non précisés et niveau demandé supérieur au vôtre",
    );
    expect(libelleEligibilite(eligible(["debut_des_que_possible", "duree_inconnue", "niveau_superieur"]))).toBe(
      "Éligible sous réserve : durée non précisée, début « dès que possible » et niveau demandé supérieur au vôtre",
    );
  });
  it("l'ordre d'entrée des réserves ne change pas la phrase", () => {
    const a = libelleReserves(["niveau_superieur", "duree_inconnue", "date_debut_inconnue"]);
    const b = libelleReserves(["date_debut_inconnue", "niveau_superieur", "duree_inconnue"]);
    expect(a).toBe(b);
  });
  it("« Éligible » n'est jamais rendu seul quand une réserve existe, quelle qu'elle soit", () => {
    for (const reserve of CODES_RESERVE) {
      const libelle = libelleEligibilite(eligible([reserve]));
      expect(libelle, reserve).not.toBe("Éligible");
      expect(libelle.startsWith("Éligible sous réserve : "), reserve).toBe(true);
    }
  });
  it("à vérifier : les raisons, puis les réserves si elles existent", () => {
    expect(libelleEligibilite(aVerifier(["lieu_inconnu"]))).toBe("À vérifier : lieu inconnu");
    expect(libelleEligibilite(aVerifier(["lieu_inconnu", "contrat_inconnu"]))).toBe("À vérifier : type de contrat inconnu et lieu inconnu");
    expect(libelleEligibilite(aVerifier(["lieu_inconnu"], ["date_debut_inconnue", "duree_inconnue"]))).toBe(
      "À vérifier : lieu inconnu ; sous réserve : début et durée non précisés",
    );
  });
  it("à vérifier porte toujours ses réserves : aucune réserve ne se perd", () => {
    for (const reserve of CODES_RESERVE) {
      const sans = libelleEligibilite(aVerifier(["lieu_inconnu"]));
      const avec = libelleEligibilite(aVerifier(["lieu_inconnu"], [reserve]));
      expect(avec.length, reserve).toBeGreaterThan(sans.length);
      expect(avec).toContain("sous réserve");
    }
  });
  it("rejetée : le motif en toutes lettres", () => {
    expect(libelleEligibilite(rejetee("hors_zone"))).toBe("Rejetée : hors zone");
    expect(libelleEligibilite(rejetee("date_debut"))).toBe("Rejetée : date de début incompatible");
    expect(libelleEligibilite(rejetee("duree"))).toBe("Rejetée : durée incompatible");
    expect(libelleEligibilite(rejetee(null))).toBe("Rejetée");
  });
  it("chaque code a un libellé non vide", () => {
    for (const c of CODES_A_VERIFIER) expect(LIBELLE_A_VERIFIER[c]).not.toBe("");
    for (const m of MOTIFS_REJET) expect(LIBELLE_MOTIF_REJET[m]).not.toBe("");
  });
});

describe("l'énumération", () => {
  it("a, a et b, a, b et c", () => {
    expect(enumeration([])).toBe("");
    expect(enumeration(["a"])).toBe("a");
    expect(enumeration(["a", "b"])).toBe("a et b");
    expect(enumeration(["a", "b", "c"])).toBe("a, b et c");
  });
});

describe("les offres fermées", () => {
  it("la pastille, avec ou sans date", () => {
    expect(libelleFermee("2026-11-12")).toBe("Fermée par l'employeur le 12 novembre 2026");
    expect(libelleFermee("2026-12-01")).toBe("Fermée par l'employeur le 1er décembre 2026");
    expect(libelleFermee(null)).toBe("Fermée par l'employeur");
  });
  it("le filtre qui les montre, masquées par défaut", () => {
    expect(libelleFiltreFermees(18)).toBe("Afficher les offres fermées (18)");
    expect(libelleFiltreFermees(1)).toBe("Afficher l'offre fermée (1)");
    expect(libelleFiltreFermees(0)).toBeNull();
  });
});
