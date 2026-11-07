/**
 * Portage TypeScript de ce que le pipeline calcule **avant** la note : la zone géographique, le
 * type de contrat, et le signal d'école partenaire.
 *
 * Aujourd'hui ces trois valeurs arrivent toutes faites dans `data/offers.json`. Ce portage ne sert
 * donc encore à rien — il sert à ce qui vient : quand le site lira PostgreSQL au lieu du fichier,
 * la base ne contiendra que les champs bruts de l'annonce, et c'est lui qui devra les dériver.
 *
 * Les oracles, ligne par ligne :
 *   · `zoneDe`      ← `zone_de_lieu()` et ses aides (`_zone_du_texte`...), reference/eligibility.py ;
 *                     `export_site.zone_de()` l'appelle pour écrire `location_zone`
 *   · `contratsDe`  ← `contrats()`       , même fichier
 *   · `signalEcole` ← `partner_school_match()` et `PARTNER_SCHOOL_PATTERNS`, reference/eligibility.py
 *
 * `npm run verifier-eligibility` les compare à l'export sur chaque offre.
 *
 * **`eligibility.zone_status()` n'est pas porté, et c'est volontaire.** Il rend des statuts
 * (éligible / incertain / rejeté) et se rabat sur le titre quand le lieu est vide — ce n'est pas
 * ce que l'export écrit dans `location_zone`. Le porter donnerait des désaccords garantis.
 */

// Les listes de communes, de départements et de régions : générées depuis `reference/faits.py`.
import { ZONES_ELIGIBLES, ZONES_FAITS, ZONES_ORDRE } from "./zones.generees.ts";

/**
 * Les zones que le site connaît, dans l'ordre où il les présente. Une seule liste : le filtre de la
 * liste d'offres, le formulaire de profil, le décodeur du cookie et la lecture de la base la
 * partagent, et les contraintes CHECK de `db/schema.sql` doivent citer exactement les mêmes valeurs
 * (`lib/zones-sql.test.ts` le vérifie). « occitanie » s'y ajoute le 6 novembre 2026, avec le
 * chantier zone ; « autre » veut dire « aucune zone reconnue ».
 */
export const ZONES = ["toulouse", "occitanie", "idf", "remote", "autre"] as const;
export type Zone = (typeof ZONES)[number];

/* ------------------------------------------------------------------- zones */

/**
 * Portage de la règle de zone du pipeline : `zone_de_lieu` et ses aides, `reference/eligibility.py`.
 * Les listes (communes, départements, régions, noms ambigus) ne sont pas écrites ici : elles viennent
 * de `lib/zones.generees.ts`, produit par `tools/generer_zones.py` depuis `reference/faits.py`.
 *
 * La règle, dans l'ordre (décision de Fanel du 06/11/2026) :
 *   1. le lieu est normalisé (sans accents, en minuscules) ;
 *   2. pour chaque zone dans l'ordre toulouse, occitanie, idf : une commune non ambiguë ou un
 *      département (« 31 - Blagnac », « 93200 ») la désigne ;
 *   3. puis, dans le même ordre, un nom ambigu (« Saint-Denis », « Vitry »...) ne la désigne que
 *      **confirmé** par un département ou par le nom propre de la région (« Paris », « Île-de-France ») ;
 *   4. sinon « Île-de-France » seule vaut l'Île-de-France ;
 *   5. sinon un mot de télétravail vaut « remote » ;
 *   6. sinon « autre ».
 * L'ordre est une priorité : « Toulouse, télétravail partiel » est toulousaine.
 *
 * Les motifs. Python écrit `\bterme\b`, avec le tiret remplacé par `[-\s]?` (« haute-garonne »
 * reconnaît « haute garonne »). Le `\b` de Python suit Unicode, celui de JavaScript est ASCII : d'où
 * les assertions `(?<![\p{L}\p{N}_])` et `(?![\p{L}\p{N}_])` avec le drapeau `u`. Même chose pour `\d`
 * (`\p{Nd}`). Ni l'un ni l'autre ne se voit sur du texte normalisé, mais « identique » vaut mieux que
 * « équivalent sur les données d'aujourd'hui ».
 */
const LETTRE = "[\\p{L}\\p{N}_]";

/** `_motif_zone` : une commune ou une région, mot entier, tiret et espace équivalents. */
function motifZone(terme: string): RegExp {
  const corps = normaliser(terme)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/-/g, "[-\\s]?");
  return new RegExp(`(?<!${LETTRE})${corps}(?!${LETTRE})`, "u");
}

/** `_motif_departement` : « 31 - Commune » (France Travail) ou « 31000 » (code postal). */
function motifDepartement(code: string): RegExp {
  return new RegExp(`(?:^|\\P{Nd})${code}(?:\\s*-\\s|\\p{Nd}{3}(?!${LETTRE}))`, "u");
}

/** `_cle_zone` : pour comparer deux noms de commune, le tiret et l'espace sont la même chose. */
function cleZone(terme: string): string {
  return normaliser(terme).replace(/-/g, " ").split(/\s+/).filter(Boolean).join(" ");
}

type MotifsDeZone = {
  surs: RegExp[]; // communes non ambiguës, puis départements (`_motifs`)
  ambigus: RegExp[]; // noms qui existent ailleurs en France (`_motifs_ambigus`)
  departements: RegExp[]; // confirmation par département (`_confirme_la_zone`)
  regionPropre: RegExp[]; // confirmation par le nom de la région
};

const MOTIFS: Record<string, MotifsDeZone> = Object.fromEntries(
  ZONES_ORDRE.map((nom) => {
    const zone = ZONES_FAITS[nom];
    const ambigus = new Set(zone.ambigus.map(cleZone));
    const departements = zone.departements.map(motifDepartement);
    return [
      nom,
      {
        surs: [...zone.villes.filter((v) => !ambigus.has(cleZone(v))).map(motifZone), ...departements],
        ambigus: zone.ambigus.map(motifZone),
        departements,
        regionPropre: zone.region_propre.map(motifZone),
      },
    ];
  }),
);

/** `REMOTE_PATTERNS` : les mots de télétravail sont les « villes » de la zone remote. */
const MOTIFS_REMOTE = ZONES_FAITS.remote.villes.map(motifZone);

const toutes = (motifs: RegExp[], texte: string) => motifs.some((m) => m.test(texte));

/** `_confirme_la_zone` : un département ou le nom propre de la région confirme un nom ambigu. */
function confirmeLaZone(texte: string, nom: string): boolean {
  return toutes(MOTIFS[nom].departements, texte) || toutes(MOTIFS[nom].regionPropre, texte);
}

/** `_zone_du_texte` : la zone reconnue dans un texte déjà normalisé, ou `null`. Le plus précis d'abord. */
function zoneDuTexte(texte: string): Zone | null {
  for (const nom of ZONES_ELIGIBLES) {
    if (toutes(MOTIFS[nom].surs, texte)) return nom as Zone;
  }
  for (const nom of ZONES_ELIGIBLES) {
    if (toutes(MOTIFS[nom].ambigus, texte) && confirmeLaZone(texte, nom)) return nom as Zone;
  }
  return null;
}

/**
 * La zone d'une annonce, d'après son seul champ `location` : `zone_de_lieu` de `eligibility.py`,
 * la règle qui décide aussi du statut, de l'export et des points du lieu.
 *
 * Un lieu absent donne « autre », pas une erreur : `_norm(None)` vaut la chaîne vide côté Python, et
 * 19 offres de l'export sont dans ce cas. Deviner la ville depuis le titre serait inventer une donnée.
 */
export function zoneDe(location: string | null | undefined): Zone {
  const texte = normaliser(location);
  const zone = zoneDuTexte(texte);
  if (zone) return zone;
  if (toutes(MOTIFS.idf.regionPropre, texte)) return "idf";
  if (toutes(MOTIFS_REMOTE, texte)) return "remote";
  return "autre";
}

/**
 * Toutes les zones que le texte désigne, pas seulement celle qui l'emporte (même ordre que
 * `zoneDe`). Sert au vérificateur : savoir si une offre met l'ordre de priorité à l'épreuve demande
 * de compter les correspondances, pas de lire le résultat, qui est unique par construction.
 */
export function zonesReconnues(location: string | null | undefined): Zone[] {
  const texte = normaliser(location);
  const trouvees: Zone[] = [];
  for (const nom of ZONES_ORDRE) {
    const sure = toutes(MOTIFS[nom].surs, texte);
    const confirmee = toutes(MOTIFS[nom].ambigus, texte) && confirmeLaZone(texte, nom);
    const region = nom === "idf" && toutes(MOTIFS.idf.regionPropre, texte);
    const teletravail = nom === "remote" && toutes(MOTIFS_REMOTE, texte);
    if (sure || confirmee || region || teletravail) trouvees.push(nom as Zone);
  }
  return trouvees;
}

/* --------------------------------------------------------------- contrats */

/**
 * Les types de contrat déclarés par l'annonce.
 *
 * Python découpe sur `,` **et** `/`, retire les espaces de bord, passe en minuscules et jette les
 * morceaux vides. Les parenthèses restent : « stage (d'après l'alerte) » est un type à part
 * entière — c'est exactement ce qui avait rendu deux offres invisibles dans les filtres, et c'est
 * `familleContrat` (lib/offers.ts) qui s'occupe de les regrouper à l'affichage, pas ce découpage.
 */
export function contratsDe(contractType: string | null | undefined): string[] {
  const brut = contractType ?? "";
  return brut
    .split(/[,/]/)
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c !== "");
}

/**
 * Le type de contrat est-il renseigné ?
 *
 * Python écrit `bool(offre.get("contract_type"))` : une chaîne vide est fausse, mais une chaîne
 * d'espaces est **vraie**. On reproduit ce comportement plutôt que le corriger — l'oracle fait
 * foi, et un écart ici se paierait en désaccords.
 */
export function contratConnu(contractType: string | null | undefined): boolean {
  return Boolean(contractType);
}

/* ---------------------------------------------- signal « école partenaire » */

/**
 * `_norm` de `eligibility.py` : décomposition NFKD, suppression des diacritiques, minuscules,
 * espaces de bord retirés. « École » devient « ecole », donc les motifs s'écrivent sans accent.
 */
export function normaliser(valeur: unknown): string {
  return String(valeur ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Les motifs d'école ou de CFA imposé, dans l'ordre de `PARTNER_SCHOOL_PATTERNS`.
 *
 * L'ordre décide **quel** motif est renvoyé quand plusieurs correspondent — ce n'est pas un
 * ensemble, et le motif renvoyé est celui qui sera cité à l'utilisateur.
 *
 * `\b` se comporte ici comme en Python parce que le texte est déjà normalisé : plus un seul
 * caractère accentué, donc plus de divergence possible entre les deux moteurs sur les frontières
 * de mot.
 */
const MOTIFS_ECOLE: RegExp[] = [
  /\biscod\b/,
  /\bpigier\b/,
  /\bynov\b/,
  /\bmy ?digital ?school\b/,
  /\bsup de co\b/,
  /\bepitech\b/,
  /\besd\b/,
  /\bopen ?classrooms\b/,
  /\bipi\b/,
  /\bdawan\b/,
  /\becole partenaire\b/,
  /\bformation incluse\b/,
  /\bintegrer notre ecole\b/,
  /\bnotre centre de formation\b/,
  /\bcfa partenaire obligatoire\b/,
];

/** Les champs que `partner_school_match` concatène, dans cet ordre. */
export type OffreAExaminer = {
  title?: string | null;
  company?: string | null;
  description?: string | null;
  education_required?: string | null;
};

/**
 * Le motif d'école partenaire trouvé dans l'annonce, ou `null`.
 *
 * Renvoie le **texte trouvé**, pas le motif : c'est lui que le site cite, et la règle 5 veut
 * qu'on ne signale jamais sans citer.
 */
export function signalEcole(offre: OffreAExaminer): string | null {
  const texte = normaliser(
    [offre.title, offre.company, offre.description, offre.education_required]
      .map((v) => String(v ?? ""))
      .join(" "),
  );
  for (const motif of MOTIFS_ECOLE) {
    const trouve = texte.match(motif);
    if (trouve) return trouve[0];
  }
  return null;
}

/**
 * Ce que `export_site.ligne` écrit dans `training_flag` : le signal n'est cherché que si l'annonce
 * a une description. Sans texte, il n'y a rien à citer — et accuser sans citer est précisément ce
 * que le produit s'interdit.
 */
export function signalEcoleExporte(offre: OffreAExaminer): string | null {
  return offre.description ? signalEcole(offre) : null;
}
