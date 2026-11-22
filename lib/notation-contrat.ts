/**
 * Le contrat de données de la notation T4 : ce que la couche de calcul rend, offre par offre, à
 * l'interface. Des types, des constantes et quelques fonctions pures. Aucun calcul de note ici.
 *
 * SOCLE T4, EN BROUILLON. Ce module n'est branché sur rien : ni les pages, ni `lib/scoring.ts`, ni
 * l'export. L'ancienne note sur 100 (`lib/scoring.ts`) reste celle qui s'affiche.
 *
 * Trois choses se lisent séparément, et aucune ne se déduit d'une autre :
 *
 *   · la COMPATIBILITÉ : combien des technologies exigées le profil couvre (compétences seules ;
 *     la formation n'y entre pas, elle devient une réserve d'éligibilité) ;
 *   · la QUALITÉ de l'annonce : indépendante du profil, affichée en trois niveaux ;
 *   · l'ÉLIGIBILITÉ : éligible, à vérifier ou rejetée, avec ses réserves.
 *
 * Règles de vérité tenues par les types :
 *   · « non évaluée » n'est jamais 0. Une absence a toujours une cause écrite.
 *   · Une offre « domaine seul » (la seule exigence est un domaine, aujourd'hui l'IA) n'a pas de
 *     note sur 100 et pas de « X sur N » : le type ne laisse pas la fabriquer.
 *   · Le chiffre de qualité reste interne : seul le niveau (trois valeurs) est affiché.
 *
 * Décisions de Fanel, jusqu'au 9 novembre 2026. Les points non décidés sont marqués TODO(QUESTION).
 */

/* ------------------------------------------------------------ vocabulaire commun */

/** D'où viennent les technologies lues : le texte complet de l'annonce, ou son seul titre. */
export const SOURCES_LECTURE = ["texte", "titre"] as const;
export type SourceLecture = (typeof SOURCES_LECTURE)[number];

/**
 * Les domaines : des mots qui nomment un champ et non un outil. Un seul pour l'instant, l'IA, qui
 * regroupe IA, intelligence artificielle, LLM, machine learning... en UNE exigence. DevOps, CI/CD et
 * les tests unitaires restent des outils.
 *
 * TODO(QUESTION) : la liste vient de `reference/faits.py` (DOMAINES, CONCEPTS), livrable 5 de Hermes,
 * pas encore reçu. Quand il l'aura, cette constante sera générée, comme les listes de zones.
 */
export const DOMAINES = ["IA"] as const;
export type Domaine = (typeof DOMAINES)[number];

/* ------------------------------------------------------------------ compatibilité */

/** Pourquoi une compatibilité n'est pas évaluée. */
export const CAUSES_COMPATIBILITE = ["profil_non_renseigne", "texte_non_capture", "non_extraite"] as const;
export type CauseCompatibilite = (typeof CAUSES_COMPATIBILITE)[number];

type CompatibiliteEvaluee = {
  etat: "evaluee";
  /** Technologies exigées que le profil couvre. */
  couvertes: number;
  /** Technologies exigées détectées (au moins 1). Le concept IA compte pour une seule. */
  exigees: number;
  source_lecture: SourceLecture;
};

/** Cas général : des outils, un ratio « X sur N », une note sur 100 en second. */
export type CompatibiliteOutils = CompatibiliteEvaluee & {
  domaine_seul: false;
  /** Les technologies exigées que le profil ne couvre pas, dans l'ordre de l'annonce. */
  manquantes: string[];
};

/**
 * La seule exigence détectée est un domaine. `couvertes` vaut 0 ou 1 et `exigees` vaut 1 : ces deux
 * nombres servent au tri et ne sont JAMAIS affichés. L'interface montre « domaine : IA », sans note.
 *
 * TODO(QUESTION) : afficher si le profil porte ce domaine (« présent dans votre profil ») ? Le
 * contrat n'a pas de champ pour cela : à ajouter seulement si Fanel le décide.
 */
export type CompatibiliteDomaine = CompatibiliteEvaluee & {
  domaine_seul: true;
  domaine: Domaine;
};

export type CompatibiliteNonEvaluee = {
  etat: "non_evaluee";
  cause: CauseCompatibilite;
};

export type Compatibilite = CompatibiliteOutils | CompatibiliteDomaine | CompatibiliteNonEvaluee;

/** La compatibilité est-elle évaluée ? (réduit le type) */
export function estEvaluee(c: Compatibilite): c is CompatibiliteOutils | CompatibiliteDomaine {
  return c.etat === "evaluee";
}

/**
 * Le palier de 10 points du ratio, de 0 à 100 : il regroupe les offres proches avant les départages.
 * Calcul en entiers (jamais par un ratio flottant) : 3 sur 10 vaut exactement 30, pas 29.99.
 */
export function palierDe(c: CompatibiliteOutils | CompatibiliteDomaine): number {
  return Math.floor((10 * c.couvertes) / c.exigees) * 10;
}

/**
 * Compare deux ratios exactement, par produit en croix. Rend un nombre positif si `a` est plus
 * grand que `b`, négatif s'il est plus petit, 0 s'ils sont égaux (2 sur 4 et 1 sur 2 sont égaux).
 */
export function comparerRatios(
  a: Pick<CompatibiliteOutils, "couvertes" | "exigees">,
  b: Pick<CompatibiliteOutils, "couvertes" | "exigees">,
): number {
  return a.couvertes * b.exigees - b.couvertes * a.exigees;
}

/**
 * La note sur 100, en second : le ratio arrondi à l'entier. Nulle pour une offre « domaine seul »
 * (décision du 9 novembre : « domaine : IA » et aucune note sur 100).
 *
 * TODO(QUESTION) : arrondi à l'entier, ou une décimale ? L'écran affiche « 67 / 100 » dans ce brouillon.
 */
export function noteSur100(c: CompatibiliteOutils | CompatibiliteDomaine): number | null {
  if (c.domaine_seul) return null;
  return Math.round((100 * c.couvertes) / c.exigees);
}

/* ---------------------------------------------------------------------- qualité */

/** Les trois niveaux affichés, du meilleur au moins renseigné. L'ordre est celui du tri. */
export const NIVEAUX_QUALITE = ["complete", "partielle", "texte_non_capture"] as const;
export type NiveauQualite = (typeof NIVEAUX_QUALITE)[number];

/** Les quatre dimensions du détail, affichées sous le niveau. */
export const DIMENSIONS_QUALITE = ["texte", "contenu", "informations_essentielles", "tracabilite"] as const;
export type DimensionQualiteCle = (typeof DIMENSIONS_QUALITE)[number];

export type EtatDimension = "evaluee" | "non_evaluee" | "non_applicable";
export type CauseQualite = "texte_non_capture" | "non_extraite";

export type DimensionQualite = {
  cle: DimensionQualiteCle;
  etat: EtatDimension;
  /** 0 à 100 quand évaluée, nul sinon. Un 0 est une mesure, un nul est une absence de mesure. */
  valeur: number | null;
  /** Pourquoi la dimension n'est pas évaluée. Nul quand elle l'est, ou quand elle ne s'applique pas. */
  cause: CauseQualite | null;
};

/**
 * Couverture minimale pour que la note interne de qualité existe : en dessous, trop peu de
 * dimensions ont pu être mesurées et la note est nulle (option B, décidée).
 * TODO(QUESTION) : 0,5 est le seuil du prototype, pas encore confirmé sur d'autres données.
 */
export const SEUIL_COUVERTURE_QUALITE = 0.5;

export type Qualite = {
  niveau: NiveauQualite;
  /** 0 à 100, ou nul. INTERNE : sert de clé de tri, ne s'affiche jamais. */
  note_interne: number | null;
  /** Part du barème effectivement mesurée, de 0 à 1. Ne multiplie jamais la note. */
  couverture: number;
  dimensions: DimensionQualite[];
};

/* ------------------------------------------------------------------ éligibilité */

/** Les trois statuts du site. Le pipeline en a quatre (eligible, uncertain, ineligible, rejected). */
export const STATUTS_ELIGIBILITE = ["eligible", "a_verifier", "rejetee"] as const;
export type StatutEligibilite = (typeof STATUTS_ELIGIBILITE)[number];

/**
 * Les réserves : des inconnues SECONDAIRES, qui ne rendent pas l'offre « à vérifier ». Une offre
 * éligible avec une réserve s'affiche toujours « Éligible sous réserve : ... », jamais « Éligible »
 * seul. `niveau_superieur` : le niveau demandé est supérieur à celui du profil (réserve, jamais un 0).
 *
 * TODO(QUESTION) : « début dès que possible » est une réserve dans le prototype. À confirmer.
 */
export const CODES_RESERVE = [
  "date_debut_inconnue",
  "duree_inconnue",
  "debut_des_que_possible",
  "niveau_superieur",
] as const;
export type CodeReserve = (typeof CODES_RESERVE)[number];

/**
 * Les inconnues ESSENTIELLES, qui rendent l'offre « à vérifier ».
 *
 * TODO(QUESTION) : liste provisoire, tirée des raisons du pipeline. La liste complète des codes est
 * le livrable 7b de Hermes (pas encore reçu) : elle remplacera celle-ci, avec leur sens.
 */
export const CODES_A_VERIFIER = ["contrat_inconnu", "lieu_inconnu", "lieu_regional", "debut_eloigne"] as const;
export type CodeAVerifier = (typeof CODES_A_VERIFIER)[number];

/**
 * Les motifs de rejet, tels que Hermes les a comptés (35, 24, 6, 1, 1 sur 67 rejets).
 * TODO(QUESTION) : « ineligible » et « rejected » du pipeline donnent tous deux « rejetée » ici.
 * Confirmer qu'aucune différence d'affichage n'est voulue entre les deux.
 */
export const MOTIFS_REJET = ["hors_zone", "date_debut", "duree", "alternance", "autre"] as const;
export type MotifRejet = (typeof MOTIFS_REJET)[number];

export type Eligibilite = {
  statut: StatutEligibilite;
  /** Réserves (inconnues secondaires). Peut accompagner « éligible » comme « à vérifier ». */
  reserves: CodeReserve[];
  /** Inconnues essentielles. Non vide si, et seulement si, le statut est « à vérifier ». */
  a_verifier: CodeAVerifier[];
  /** Renseigné si, et seulement si, le statut est « rejetée ». */
  motif_rejet: MotifRejet | null;
};

/* -------------------------------------------------------------------- l'offre */

/**
 * Tout ce que l'interface reçoit pour une offre, pour un profil donné.
 *
 * `age_jours` : l'âge de l'annonce, en jours, sert au départage « plus récente d'abord ».
 * TODO(QUESTION) : fraîcheur exacte. Depuis quelle date l'âge se compte (publication, première
 * observation, collecte) et par rapport à quelle date de référence : à décider. Le tri n'en dépend
 * pas : il reçoit un nombre.
 */
export type NotationOffre = {
  /** Numéro de l'offre dans le pipeline. */
  id: number;
  age_jours: number | null;
  compatibilite: Compatibilite;
  qualite: Qualite;
  eligibilite: Eligibilite;
  /** Fermée par l'employeur. Un fait de l'offre, sans lien avec le profil ni avec l'éligibilité. */
  fermee: boolean;
  /** Date de fermeture (AAAA-MM-JJ), ou nulle si inconnue. Ne peut être renseignée que si `fermee`. */
  fermee_le: string | null;
};

/**
 * Les incohérences d'une notation, une par phrase. Une liste vide veut dire « conforme au contrat ».
 * Sert aux tests, et à refuser une donnée mal formée plutôt que de l'afficher.
 */
export function incoherences(n: NotationOffre): string[] {
  const problemes: string[] = [];
  const c = n.compatibilite;
  if (c.etat === "evaluee") {
    if (!Number.isInteger(c.exigees) || c.exigees < 1) problemes.push("exigees doit être un entier d'au moins 1");
    if (!Number.isInteger(c.couvertes) || c.couvertes < 0 || c.couvertes > c.exigees) {
      problemes.push("couvertes doit être un entier entre 0 et exigees");
    }
    if (c.domaine_seul && c.exigees !== 1) problemes.push("une offre domaine seul a exactement 1 exigence");
    if (!c.domaine_seul && c.manquantes.length !== c.exigees - c.couvertes) {
      problemes.push("manquantes doit contenir exactement exigees moins couvertes éléments");
    }
  }
  const e = n.eligibilite;
  if (e.statut === "a_verifier" && e.a_verifier.length === 0) problemes.push("à vérifier sans aucune raison");
  if (e.statut !== "a_verifier" && e.a_verifier.length > 0) problemes.push("des raisons à vérifier hors statut à vérifier");
  if (e.statut === "rejetee" && e.motif_rejet === null) problemes.push("rejetée sans motif");
  if (e.statut !== "rejetee" && e.motif_rejet !== null) problemes.push("motif de rejet hors statut rejetée");
  if (new Set(e.reserves).size !== e.reserves.length) problemes.push("réserves en double");
  const q = n.qualite;
  if (q.couverture < 0 || q.couverture > 1) problemes.push("la couverture de qualité est entre 0 et 1");
  if (q.note_interne !== null && (q.note_interne < 0 || q.note_interne > 100)) {
    problemes.push("la note interne de qualité est entre 0 et 100");
  }
  for (const d of q.dimensions) {
    if (d.etat === "evaluee" && (d.valeur === null || d.valeur < 0 || d.valeur > 100)) {
      problemes.push(`dimension ${d.cle} évaluée sans valeur entre 0 et 100`);
    }
    if (d.etat !== "evaluee" && d.valeur !== null) problemes.push(`dimension ${d.cle} non évaluée avec une valeur`);
    if (d.etat === "evaluee" && d.cause !== null) problemes.push(`dimension ${d.cle} évaluée avec une cause d'absence`);
  }
  if (n.fermee_le !== null && !n.fermee) problemes.push("fermee_le renseignée sur une offre non fermée");
  if (n.fermee_le !== null && !/^\d{4}-\d{2}-\d{2}$/.test(n.fermee_le)) problemes.push("fermee_le doit être AAAA-MM-JJ");
  return problemes;
}
