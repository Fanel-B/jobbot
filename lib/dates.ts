/**
 * Lire une date de début d'annonce, comme le pipeline la lit.
 *
 * Portage de `parse_date` de `reference/eligibility.py`. Il n'existait qu'un lecteur partiel, privé,
 * dans `lib/scoring.ts` ; il ne connaissait ni les mois abrégés (« sept. 2027 »), ni les mois en
 * anglais (« March 2027 »), ni « dès que possible », et il acceptait sans broncher les dates
 * impossibles (`Date.UTC` arrondit « 31 février » au 3 mars). Deux lecteurs qui divergent donnent
 * deux réponses à la question « cette date est-elle exploitable ? », et le site affiche un
 * avertissement que le pipeline ne ferait pas, ou l'inverse.
 *
 * Ce module n'importe rien : il tourne dans Next.js et sous Node (scripts de vérification).
 *
 * Vérifié par `lib/dates.test.ts` contre une table de chaînes calculée avec le vrai `parse_date`.
 */

/** Mêmes clés que `MONTHS_FR` : abréviations et anglais compris, et « may » absent comme côté Python. */
const MOIS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  janv: 1, fev: 2, avr: 4, juil: 7, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** Les expressions qui veulent dire « dès que possible ». Testées avant toute date. */
const TERMES_ASAP = ["asap", "des que possible", "immediat", "immediatement", "au plus vite"];

/** `_norm` de Python : sans accents, en minuscules, sans espaces aux extrémités. */
function norm(valeur: unknown): string {
  return String(valeur ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Une date du calendrier, à minuit UTC, ou `null` si elle n'existe pas.
 *
 * Python lève `ValueError` sur « 2026-13-01 » ou « 31/02/2027 » ; ici elles sont refusées. Le calcul
 * passe par `setUTCFullYear` : `Date.UTC(99, …)` lirait l'an 99 comme 1999.
 */
function construire(annee: number, mois: number, jour: number): Date | null {
  if (!Number.isInteger(annee) || annee < 1 || mois < 1 || mois > 12 || jour < 1) return null;
  const d = new Date(0);
  d.setUTCFullYear(annee, mois - 1, jour);
  d.setUTCHours(0, 0, 0, 0);
  const existe = d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour;
  return existe ? d : null;
}

/**
 * `parse_date` : une date, « asap », ou `null` si le texte ne se lit pas.
 *
 * Formats : ISO (2026-09-01), JJ/MM/AAAA, MM/AAAA, « septembre 2026 », « 1er mars 2027 ». Un mois sans
 * jour vaut le 1er du mois. Le premier format reconnu l'emporte, dans cet ordre : celui de Python.
 */
export function parseDate(valeur: string | null | undefined): Date | "asap" | null {
  if (valeur === null || valeur === undefined) return null;
  const s = norm(valeur);
  if (!s) return null;
  if (TERMES_ASAP.some((t) => s.includes(t))) return "asap";

  let m = /(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(s);
  if (m) return construire(Number(m[1]), Number(m[2]), m[3] !== undefined ? Number(m[3]) : 1);

  m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return construire(Number(m[3]), Number(m[2]), Number(m[1]));

  m = /\b(\d{1,2})\/(\d{4})\b/.exec(s);
  if (m) return construire(Number(m[2]), Number(m[1]), 1);

  m = /(?:(\d{1,2})(?:er)?\s+)?([a-z]+)\.?\s+(\d{4})/.exec(s);
  if (m) {
    const mois = MOIS[m[2]];
    if (mois) return construire(Number(m[3]), mois, m[1] !== undefined ? Number(m[1]) : 1);
  }
  return null;
}

/**
 * La date de début n'est-elle pas exploitable ?
 *
 * Vrai quand `parse_date` ne rend pas une vraie date : champ absent, texte illisible (« à convenir »),
 * « asap », date impossible. C'est la condition de `note_date` dans `reference/export_site.py`, et le
 * seul fait dont le site a besoin : le texte de l'avertissement est celui du site, pas celui du
 * pipeline. `npm run verifier-eligibility` compare ce booléen à `note_date` sur chaque offre.
 */
export function dateDebutNonExploitable(debut: string | null | undefined): boolean {
  return !(parseDate((debut ?? "").trim()) instanceof Date);
}

const MOIS_LONGS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** « 2027-07-31 » devient « 31 juillet 2027 ». Écrit à la main : `Intl` varie selon la machine. */
export function dateLongue(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`dateLongue : « ${iso} » n'est pas une date ISO`);
  const jour = Number(m[3]);
  return `${jour === 1 ? "1er" : jour} ${MOIS_LONGS[Number(m[2]) - 1]} ${m[1]}`;
}
