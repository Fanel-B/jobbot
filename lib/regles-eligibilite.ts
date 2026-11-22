/**
 * Quatre règles d'éligibilité de `reference/eligibility.py`, portées en TypeScript : la durée
 * (`parse_duration`, `offer_duration`), la rémunération (`is_unpaid`) et la lecture du type de
 * contrat dans le titre et la description (`_terme_contrat`, `contrat_inconnu`, `est_stage`, et le
 * bloc « type de contrat » de `check`).
 *
 * SOCLE T4, EN BROUILLON : rien ne les appelle encore. Elles servent à calculer l'éligibilité par
 * profil côté site (T4.3), là où le pipeline ne la calcule que pour le profil de référence de Fanel.
 *
 * Le moteur Python reste la référence. `lib/regles-eligibilite.test.ts` compare ce portage à
 * `tools/regles_eligibilite.py`, qui appelle le moteur lui-même, sur des cas écrits à la main et sur
 * plusieurs centaines de cas construits ; ce test ÉCHOUE si Python manque, il ne se tait pas.
 *
 * Écarts connus avec Python, hors de ce que les offres peuvent contenir :
 *   · les chiffres autres qu'ASCII (« ٣ mois ») ne sont pas lus : `\d` de Python les accepte ;
 *   · un booléen n'est pas une durée (Python lit `True` comme 1.0) ;
 *   · une valeur fausse mais non nulle (0, false) n'est pas lue comme une chaîne vide.
 */
import { normaliser } from "./eligibilite";
import { parseDate } from "./dates";

/**
 * `\b` de Python est Unicode, celui de JavaScript est ASCII même avec le drapeau `u`. Ces deux
 * assertions reprennent la définition de Python : un mot est fait de lettres, de chiffres et de `_`.
 */
const DEBUT_DE_MOT = "(?<![\\p{L}\\p{N}_])";
const FIN_DE_MOT = "(?![\\p{L}\\p{N}_])";

const texteOuVide = (valeur: unknown): string => (valeur ? String(valeur) : "");

/* ----------------------------------------------------------------------- durée */

/** `_UNIT_MONTHS` : la valeur en mois de chaque unité reconnue. */
const MOIS_PAR_UNITE: Record<string, number> = {
  mois: 1, month: 1, months: 1,
  an: 12, ans: 12, annee: 12, annees: 12, year: 12, years: 12,
  semaine: 12 / 52, semaines: 12 / 52, week: 12 / 52, weeks: 12 / 52,
};
const UNITE = "(mois|months?|ans?|annees?|years?|semaines?|weeks?)";
const DUREE_INTERVALLE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:a|-|to|ou)\\s*(\\d+(?:[.,]\\d+)?)\\s*${UNITE}`);
const DUREE_SIMPLE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${UNITE}`);
const nombre = (s: string) => Number(s.replace(",", "."));

/**
 * `parse_duration` : une durée en (mois minimum, mois maximum), ou `null` si elle ne se lit pas.
 * Accepte un nombre (en mois), « 6 mois », « 1 an », « 24 weeks », « 4 à 6 mois », « 4-6 months ».
 */
export function parseDuree(valeur: unknown): [number, number] | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  if (typeof valeur === "number") return [valeur, valeur];
  if (typeof valeur === "boolean") return null;
  const s = normaliser(valeur);
  let m = DUREE_INTERVALLE.exec(s);
  if (m) {
    const k = MOIS_PAR_UNITE[m[3]];
    return [nombre(m[1]) * k, nombre(m[2]) * k];
  }
  m = DUREE_SIMPLE.exec(s);
  if (m) {
    const v = nombre(m[1]) * MOIS_PAR_UNITE[m[2]];
    return [v, v];
  }
  if (/^\d+(?:[.,]\d+)?$/.test(s)) {
    const v = nombre(s);
    return [v, v];
  }
  return null;
}

const MS_PAR_JOUR = 86_400_000;

/** `_months_between` : fin incluse, un jour de plus, divisé par 30,44 et arrondi à une décimale. */
function moisEntre(debut: Date, fin: Date): number {
  const jours = Math.round((fin.getTime() - debut.getTime()) / MS_PAR_JOUR);
  return Math.round(((jours + 1) / 30.44) * 10) / 10;
}

export type DureeOffre = {
  mois: [number, number];
  /** « champ » : lue dans le champ duration. « dates » : déduite de start_date et end_date. */
  origine: "champ" | "dates";
};

export type OffrePourDuree = {
  duration?: unknown;
  start_date?: string | null;
  end_date?: string | null;
};

/**
 * `offer_duration` : la durée explicite (champ `duration`), sinon déduite des dates de début et de
 * fin quand la fin est strictement après le début. `null` si aucune des deux ne se lit.
 */
export function dureeDeLOffre(offre: OffrePourDuree): DureeOffre | null {
  const explicite = parseDuree(offre.duration);
  if (explicite) return { mois: explicite, origine: "champ" };
  const debut = parseDate(offre.start_date);
  const fin = parseDate(offre.end_date);
  if (debut instanceof Date && fin instanceof Date && fin.getTime() > debut.getTime()) {
    const m = moisEntre(debut, fin);
    return { mois: [m, m], origine: "dates" };
  }
  return null;
}

/* ---------------------------------------------------------------- rémunération */

/** `UNPAID_PATTERNS`, dans l'ordre. Le texte est déjà normalisé : plus un seul accent. */
const MOTIFS_NON_REMUNERE: RegExp[] = [
  `${DEBUT_DE_MOT}non[\\s-]remuner`,
  `${DEBUT_DE_MOT}non[\\s-]gratifi`,
  `${DEBUT_DE_MOT}sans (?:gratification|remuneration)`,
  `${DEBUT_DE_MOT}pas de (?:gratification|remuneration)`,
  `${DEBUT_DE_MOT}unpaid${FIN_DE_MOT}`,
  `${DEBUT_DE_MOT}benevol`,
].map((motif) => new RegExp(motif, "u"));

export type OffrePourRemuneration = {
  remuneration?: unknown;
  salary?: unknown;
  description?: unknown;
  title?: unknown;
};

/**
 * `is_unpaid` : l'offre dit-elle explicitement qu'elle n'est pas rémunérée ? Cherche dans la
 * rémunération, le salaire, la description et le titre. Une offre qui ne dit rien n'est PAS non
 * rémunérée : l'absence d'information n'est pas une accusation.
 */
export function estNonRemuneree(offre: OffrePourRemuneration): boolean {
  const texte = normaliser(
    [offre.remuneration, offre.salary, offre.description, offre.title].map(texteOuVide).join(" "),
  );
  return MOTIFS_NON_REMUNERE.some((m) => m.test(texte));
}

/* --------------------------------------------------------------------- contrat */

/**
 * Les termes du contrat de stage du profil de référence (`PROFILE_STAGE_2027.contract_terms`).
 * Un test les compare à ceux du moteur : si Python change cette liste, il échoue.
 */
export const TERMES_CONTRAT_STAGE = ["stage", "stagiaire", "internship", "intern"] as const;

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * `_terme_contrat` : le premier terme du profil (dans l'ordre de la liste) que le texte contient
 * comme mot entier, ou `null`. « intern » n'est pas trouvé dans « internship » : mot entier.
 */
export function termeContrat(termes: readonly string[], valeur: unknown): string | null {
  const texte = normaliser(valeur);
  for (const t of termes) {
    if (new RegExp(`${DEBUT_DE_MOT}${echapper(t)}${FIN_DE_MOT}`, "u").test(texte)) return t;
  }
  return null;
}

export type OffrePourContrat = {
  contract_type?: string | null;
  title?: string | null;
  description?: string | null;
};

/** Ce que la lecture du contrat a trouvé, avec le champ et le terme quand c'est le titre ou la description. */
export type LectureContrat =
  | { genre: "declare" }
  | { genre: "lu"; champ: "title" | "description"; terme: string }
  | { genre: "incompatible"; declare: string }
  | { genre: "inconnu" };

/**
 * Le bloc « type de contrat » de `check` : le champ déclaré fait foi. Quand il est vide, le contrat se
 * cherche dans le titre puis dans la description (beaucoup d'annonces écrivent « Stage » dans leur
 * titre et laissent le champ vide). Un champ déclaré qui ne correspond pas est incompatible ; rien
 * nulle part est inconnu.
 */
export function lireContrat(offre: OffrePourContrat, termes: readonly string[] = TERMES_CONTRAT_STAGE): LectureContrat {
  const declare = String(offre.contract_type || "").trim();
  if (!declare) {
    for (const champ of ["title", "description"] as const) {
      const terme = termeContrat(termes, offre[champ]);
      if (terme) return { genre: "lu", champ, terme };
    }
    return { genre: "inconnu" };
  }
  return termeContrat(termes, declare) ? { genre: "declare" } : { genre: "incompatible", declare };
}

/**
 * `contrat_inconnu` : le type de contrat est introuvable partout, ni dans le champ, ni dans le titre,
 * ni dans la description. Un champ déclaré mais incompatible n'est PAS « inconnu ».
 */
export function contratInconnu(offre: OffrePourContrat, termes: readonly string[] = TERMES_CONTRAT_STAGE): boolean {
  for (const champ of ["contract_type", "title", "description"] as const) {
    if (termeContrat(termes, offre[champ])) return false;
  }
  return !String(offre.contract_type || "").trim();
}

/** `est_stage` : le contrat de stage est-il annoncé ? Champ déclaré, sinon titre, sinon description. */
export function estStage(offre: OffrePourContrat, termes: readonly string[] = TERMES_CONTRAT_STAGE): boolean {
  return (["contract_type", "title", "description"] as const).some((champ) => termeContrat(termes, offre[champ]) !== null);
}
