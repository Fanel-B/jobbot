/**
 * Les libellés de la notation T4 : des fonctions pures du contrat de données (`notation-contrat.ts`)
 * vers le texte que l'interface affichera. SOCLE T4, EN BROUILLON : aucune page ne les appelle.
 *
 * Règles tenues ici, toutes décidées par Fanel :
 *   · l'information principale de la compatibilité est « X sur N technologies exigées couvertes » ;
 *     la note sur 100 vient en second ;
 *   · une offre « domaine seul » affiche « domaine : IA » et aucune note sur 100, aucun « X sur N » ;
 *   · « Éligible » seul n'est jamais écrit quand une réserve existe : « Éligible sous réserve : ... » ;
 *   · le chiffre de qualité ne s'affiche jamais, seulement son niveau ;
 *   · une compatibilité non évaluée dit pourquoi, en toutes lettres ;
 *   · le texte « technologies lues dans le titre uniquement » accompagne toute lecture du titre.
 *
 * Les formulations marquées TODO(QUESTION) sont des propositions : la décision n'est pas prise.
 */
import {
  noteSur100,
  type CauseCompatibilite,
  type CauseQualite,
  type CodeAVerifier,
  type CodeReserve,
  type Compatibilite,
  type DimensionQualite,
  type DimensionQualiteCle,
  type Eligibilite,
  type MotifRejet,
  type NiveauQualite,
} from "./notation-contrat";
import { dateLongue } from "./dates";

/** « a », « a et b », « a, b et c ». */
export function enumeration(elements: readonly string[]): string {
  if (elements.length <= 1) return elements.join("");
  return `${elements.slice(0, -1).join(", ")} et ${elements[elements.length - 1]}`;
}

/* ------------------------------------------------------------------ compatibilité */

export const LIBELLE_CAUSE_COMPATIBILITE: Record<CauseCompatibilite, string> = {
  profil_non_renseigne: "Profil non renseigné",
  texte_non_capture: "Texte de l'annonce non capturé",
  non_extraite: "Technologies non extraites",
};

/**
 * L'information principale : « 2 sur 3 technologies exigées couvertes », « domaine : IA », ou la
 * cause en toutes lettres quand la compatibilité n'est pas évaluée. Accord au singulier pour 1.
 */
export function libelleCompatibilite(c: Compatibilite): string {
  if (c.etat === "non_evaluee") return LIBELLE_CAUSE_COMPATIBILITE[c.cause];
  if (c.domaine_seul) return `domaine : ${c.domaine}`;
  const exigees = c.exigees > 1 ? "technologies exigées couvertes" : "technologie exigée couverte";
  return `${c.couvertes} sur ${c.exigees} ${exigees}`;
}

/**
 * La note sur 100, en second : « Compatibilité 67 / 100 ». Nulle pour une offre non évaluée et pour
 * une offre « domaine seul » (aucune note sur 100, décision du 9 novembre 2026).
 */
export function libelleNoteSecondaire(c: Compatibilite): string | null {
  if (c.etat === "non_evaluee") return null;
  const note = noteSur100(c);
  return note === null ? null : `Compatibilité ${note} / 100`;
}

/** Quand les technologies sont lues dans le titre seul, l'écran le dit. Nul sinon. */
export function libelleLecture(c: Compatibilite): string | null {
  if (c.etat === "non_evaluee") return null;
  return c.source_lecture === "titre" ? "technologies lues dans le titre uniquement" : null;
}

/** Les technologies exigées que le profil ne couvre pas, sous le chiffre principal. Nul sinon. */
export function libelleManquantes(c: Compatibilite): string | null {
  if (c.etat === "non_evaluee" || c.domaine_seul || c.manquantes.length === 0) return null;
  return `${c.manquantes.length > 1 ? "Manquantes" : "Manquante"} : ${c.manquantes.join(", ")}`;
}

/* ---------------------------------------------------------------------- qualité */

/**
 * Les trois niveaux. TODO(QUESTION) : libellés de qualité encore à décider, ceux-ci sont provisoires.
 * Le chiffre interne n'a volontairement aucune fonction de libellé.
 */
export const LIBELLE_NIVEAU_QUALITE: Record<NiveauQualite, string> = {
  complete: "Annonce complète",
  partielle: "Annonce partielle",
  texte_non_capture: "Texte non capturé",
};

export const LIBELLE_DIMENSION: Record<DimensionQualiteCle, string> = {
  texte: "Texte",
  contenu: "Contenu",
  informations_essentielles: "Informations essentielles",
  tracabilite: "Traçabilité",
};

export const LIBELLE_CAUSE_QUALITE: Record<CauseQualite, string> = {
  texte_non_capture: "texte non capturé",
  non_extraite: "information non extraite",
};

/**
 * Le détail d'une dimension : son nom, et pourquoi elle n'est pas évaluée le cas échéant.
 * TODO(QUESTION) : le détail n'affiche aucun chiffre (le chiffre reste interne). Faut-il un mot pour
 * une dimension évaluée (« bien renseigné », « incomplet ») ? Rien n'est décidé : seul le nom sort.
 */
export function libelleDimension(d: DimensionQualite): string {
  const nom = LIBELLE_DIMENSION[d.cle];
  if (d.etat === "non_applicable") return `${nom} : sans objet`;
  if (d.etat === "non_evaluee") return d.cause ? `${nom} : non évaluée, ${LIBELLE_CAUSE_QUALITE[d.cause]}` : `${nom} : non évaluée`;
  return nom;
}

/* ------------------------------------------------------------------ éligibilité */

/**
 * Les réserves, dans un ordre fixe (celui d'ici, jamais celui de l'entrée). Début et durée non
 * précisés se disent ensemble : « début et durée non précisés ».
 * TODO(QUESTION) : formulations de « début dès que possible » et du niveau, à valider.
 */
export function libelleReserves(reserves: readonly CodeReserve[]): string {
  const a = new Set(reserves);
  const morceaux: string[] = [];
  if (a.has("date_debut_inconnue") && a.has("duree_inconnue")) morceaux.push("début et durée non précisés");
  else if (a.has("date_debut_inconnue")) morceaux.push("début non précisé");
  else if (a.has("duree_inconnue")) morceaux.push("durée non précisée");
  if (a.has("debut_des_que_possible")) morceaux.push("début « dès que possible »");
  if (a.has("niveau_superieur")) morceaux.push("niveau demandé supérieur au vôtre");
  return enumeration(morceaux);
}

/**
 * Les inconnues essentielles.
 * TODO(QUESTION) : les codes viennent du livrable 7b de Hermes, pas encore reçu ; formulations provisoires.
 */
export const LIBELLE_A_VERIFIER: Record<CodeAVerifier, string> = {
  contrat_inconnu: "type de contrat inconnu",
  lieu_inconnu: "lieu inconnu",
  lieu_regional: "lieu connu au niveau régional seulement",
  debut_eloigne: "début éloigné de la date visée",
};

/** TODO(QUESTION) : formulations des motifs de rejet à valider. */
export const LIBELLE_MOTIF_REJET: Record<MotifRejet, string> = {
  hors_zone: "hors zone",
  date_debut: "date de début incompatible",
  duree: "durée incompatible",
  alternance: "contrat en alternance",
  autre: "autre motif",
};

const ORDRE_A_VERIFIER: readonly CodeAVerifier[] = ["contrat_inconnu", "lieu_inconnu", "lieu_regional", "debut_eloigne"];

/**
 * Le statut d'éligibilité en une phrase.
 *
 *   · éligible, sans réserve        : « Éligible »
 *   · éligible, avec des réserves   : « Éligible sous réserve : début et durée non précisés »
 *   · à vérifier                    : « À vérifier : lieu inconnu », suivi des réserves s'il y en a
 *   · rejetée                       : « Rejetée : hors zone »
 *
 * « Éligible » seul n'est rendu que si la liste des réserves est vide.
 */
export function libelleEligibilite(e: Eligibilite): string {
  const reserves = libelleReserves(e.reserves);
  if (e.statut === "eligible") return reserves ? `Éligible sous réserve : ${reserves}` : "Éligible";
  if (e.statut === "a_verifier") {
    const causes = enumeration(ORDRE_A_VERIFIER.filter((c) => e.a_verifier.includes(c)).map((c) => LIBELLE_A_VERIFIER[c]));
    return `À vérifier : ${causes}${reserves ? ` ; sous réserve : ${reserves}` : ""}`;
  }
  return e.motif_rejet ? `Rejetée : ${LIBELLE_MOTIF_REJET[e.motif_rejet]}` : "Rejetée";
}

/* ----------------------------------------------------------------- offres fermées */

/** La pastille d'une offre fermée : « Fermée par l'employeur le 12 novembre 2026 », date si connue. */
export function libelleFermee(fermeeLe: string | null): string {
  return fermeeLe ? `Fermée par l'employeur le ${dateLongue(fermeeLe)}` : "Fermée par l'employeur";
}

/**
 * Le filtre qui montre les offres fermées, masquées par défaut : « Afficher les offres fermées (18) ».
 * Nul quand il n'y en a aucune : il n'y a rien à afficher.
 */
export function libelleFiltreFermees(nombre: number): string | null {
  if (nombre <= 0) return null;
  return nombre === 1 ? "Afficher l'offre fermée (1)" : `Afficher les offres fermées (${nombre})`;
}
