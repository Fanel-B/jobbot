/**
 * Le classement de la notation T4 : une clé de tri à 7 niveaux pour les offres classables, une clé
 * pour celles qui ne le sont pas, une pour les offres fermées. SOCLE T4, EN BROUILLON : rien ne
 * l'appelle encore.
 *
 * Trois blocs, toujours dans cet ordre :
 *
 *   1. CLASSABLES : la compatibilité est évaluée (y compris « domaine seul »).
 *   2. NON CLASSABLES : la compatibilité n'est pas évaluée (profil vide, texte non capturé,
 *      technologies non extraites). Triées sur la qualité de l'annonce.
 *   3. FERMÉES : l'employeur a fermé l'offre. Toujours en dernier, qu'elles soient classables ou non.
 *
 * Clé des classables (décision du 9 novembre 2026), chaque niveau ne départage que les égalités du
 * précédent :
 *
 *   1. palier de compatibilité, du plus haut au plus bas (tranches de 10 points du ratio) ;
 *   2. source de lecture : le texte complet avant le titre seul ;
 *   3. domaine seul : une offre à outils avant une offre « domaine : IA » ;
 *   4. ratio exact, du plus haut au plus bas (2 sur 3 avant 3 sur 5, qui sont dans le même palier) ;
 *   5. nombre de technologies exigées, du plus grand au plus petit ;
 *   6. fraîcheur : l'annonce la plus récente d'abord, âge inconnu en dernier ;
 *   7. numéro de l'offre, du plus grand au plus petit (déterministe, sans autre sens).
 *
 * Le tri est total et stable : deux offres de même numéro seulement peuvent être « égales », et le
 * résultat ne dépend jamais de l'ordre d'entrée.
 *
 * TODO(QUESTION) : le sens du niveau 7 (numéro décroissant) est repris du bloc non classable ; la
 * demande de Fanel ne le précise pas pour les classables.
 * TODO(QUESTION) : où vont les offres « rejetée » ? Ce tri les classe comme les autres : le filtrage
 * (masquées par défaut, ou en bloc à part) est une décision d'interface, pas encore prise.
 */
import {
  NIVEAUX_QUALITE,
  comparerRatios,
  estEvaluee,
  palierDe,
  type NotationOffre,
  type SourceLecture,
} from "./notation-contrat";

export const ORDRE_BLOCS = ["classable", "non_classable", "fermee"] as const;
export type Bloc = (typeof ORDRE_BLOCS)[number];

export function blocDe(n: NotationOffre): Bloc {
  if (n.fermee) return "fermee";
  return estEvaluee(n.compatibilite) ? "classable" : "non_classable";
}

/** Les niveaux de la clé des classables, dans l'ordre où ils départagent. */
export const NIVEAUX_TRI = [
  "palier",
  "source_lecture",
  "domaine_seul",
  "ratio_exact",
  "nombre_technologies",
  "fraicheur",
  "numero",
] as const;
export type NiveauTri = (typeof NIVEAUX_TRI)[number];

/** Les niveaux de la clé des non classables. */
export const NIVEAUX_TRI_NON_CLASSABLE = ["niveau_qualite", "note_qualite", "fraicheur", "numero"] as const;
/** Les niveaux de la clé des fermées. */
export const NIVEAUX_TRI_FERMEE = ["date_fermeture", "numero"] as const;

type Niveau = { nom: string; comparer: (a: NotationOffre, b: NotationOffre) => number };

const sourceRang = (s: SourceLecture) => (s === "texte" ? 0 : 1);

/** Un âge plus petit passe avant ; un âge inconnu passe après tous les âges connus. */
function parAge(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/** Du plus grand au plus petit, une valeur nulle en dernier. */
function parValeurDecroissante(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

const parNumero = (a: NotationOffre, b: NotationOffre) => b.id - a.id;

const CLASSABLES: Niveau[] = [
  {
    nom: "palier",
    comparer: (a, b) => {
      if (!estEvaluee(a.compatibilite) || !estEvaluee(b.compatibilite)) return 0;
      return palierDe(b.compatibilite) - palierDe(a.compatibilite);
    },
  },
  {
    nom: "source_lecture",
    comparer: (a, b) => {
      if (!estEvaluee(a.compatibilite) || !estEvaluee(b.compatibilite)) return 0;
      return sourceRang(a.compatibilite.source_lecture) - sourceRang(b.compatibilite.source_lecture);
    },
  },
  {
    nom: "domaine_seul",
    comparer: (a, b) => {
      if (!estEvaluee(a.compatibilite) || !estEvaluee(b.compatibilite)) return 0;
      return Number(a.compatibilite.domaine_seul) - Number(b.compatibilite.domaine_seul);
    },
  },
  {
    nom: "ratio_exact",
    comparer: (a, b) => {
      if (!estEvaluee(a.compatibilite) || !estEvaluee(b.compatibilite)) return 0;
      return comparerRatios(b.compatibilite, a.compatibilite);
    },
  },
  {
    nom: "nombre_technologies",
    comparer: (a, b) => {
      if (!estEvaluee(a.compatibilite) || !estEvaluee(b.compatibilite)) return 0;
      return b.compatibilite.exigees - a.compatibilite.exigees;
    },
  },
  { nom: "fraicheur", comparer: (a, b) => parAge(a.age_jours, b.age_jours) },
  { nom: "numero", comparer: parNumero },
];

const NON_CLASSABLES: Niveau[] = [
  {
    nom: "niveau_qualite",
    comparer: (a, b) => NIVEAUX_QUALITE.indexOf(a.qualite.niveau) - NIVEAUX_QUALITE.indexOf(b.qualite.niveau),
  },
  { nom: "note_qualite", comparer: (a, b) => parValeurDecroissante(a.qualite.note_interne, b.qualite.note_interne) },
  { nom: "fraicheur", comparer: (a, b) => parAge(a.age_jours, b.age_jours) },
  { nom: "numero", comparer: parNumero },
];

const FERMEES: Niveau[] = [
  {
    nom: "date_fermeture",
    comparer: (a, b) => {
      // Les dates AAAA-MM-JJ se comparent comme des chaînes. La plus récente d'abord, inconnue en dernier.
      if (a.fermee_le === b.fermee_le) return 0;
      if (a.fermee_le === null) return 1;
      if (b.fermee_le === null) return -1;
      return a.fermee_le < b.fermee_le ? 1 : -1;
    },
  },
  { nom: "numero", comparer: parNumero },
];

const NIVEAUX_PAR_BLOC: Record<Bloc, Niveau[]> = {
  classable: CLASSABLES,
  non_classable: NON_CLASSABLES,
  fermee: FERMEES,
};

/**
 * Le premier niveau qui départage `a` et `b`, ou `"bloc"` s'ils ne sont pas dans le même bloc, ou
 * `null` s'ils sont strictement égaux (même numéro). Sert aux tests, et à dire à l'utilisateur
 * « pourquoi cette offre est avant celle-là ».
 */
export function niveauDecisif(a: NotationOffre, b: NotationOffre): string | null {
  const ba = blocDe(a);
  const bb = blocDe(b);
  if (ba !== bb) return "bloc";
  for (const niveau of NIVEAUX_PAR_BLOC[ba]) {
    if (niveau.comparer(a, b) !== 0) return niveau.nom;
  }
  return null;
}

/** Négatif si `a` passe avant `b`, positif si `b` passe avant `a`, 0 si strictement égaux. */
export function comparerOffres(a: NotationOffre, b: NotationOffre): number {
  const ba = blocDe(a);
  const bb = blocDe(b);
  if (ba !== bb) return ORDRE_BLOCS.indexOf(ba) - ORDRE_BLOCS.indexOf(bb);
  for (const niveau of NIVEAUX_PAR_BLOC[ba]) {
    const d = niveau.comparer(a, b);
    if (d !== 0) return d;
  }
  return 0;
}

/** Les offres triées, dans une copie : l'entrée n'est jamais modifiée. */
export function trierOffres<T extends NotationOffre>(offres: readonly T[]): T[] {
  return [...offres].sort(comparerOffres);
}
