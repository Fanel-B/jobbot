/**
 * Portage TypeScript de ce que le pipeline calcule **avant** la note : la zone géographique, le
 * type de contrat, et le signal d'école partenaire.
 *
 * Aujourd'hui ces trois valeurs arrivent toutes faites dans `data/offers.json`. Ce portage ne sert
 * donc encore à rien — il sert à ce qui vient : quand le site lira PostgreSQL au lieu du fichier,
 * la base ne contiendra que les champs bruts de l'annonce, et c'est lui qui devra les dériver.
 *
 * Les oracles, ligne par ligne :
 *   · `zoneDe`      ← `zone_de()`        et `ZONE_TOULOUSE/IDF/REMOTE`, reference/export_site.py
 *   · `contratsDe`  ← `contrats()`       , même fichier
 *   · `signalEcole` ← `partner_school_match()` et `PARTNER_SCHOOL_PATTERNS`, reference/eligibility.py
 *
 * `npm run verifier-eligibility` les compare à l'export sur chaque offre.
 *
 * **`eligibility.zone_status()` n'est pas porté, et c'est volontaire.** Il rend des statuts
 * (éligible / incertain / rejeté) et se rabat sur le titre quand le lieu est vide — ce n'est pas
 * ce que l'export écrit dans `location_zone`. Le porter donnerait des désaccords garantis.
 */

export type Zone = "toulouse" | "idf" | "remote" | "autre";

/* ------------------------------------------------------------------- zones */

/**
 * Les trois motifs de `export_site.py`, dans leur ordre d'évaluation — qui est une priorité, pas
 * un ensemble : une annonce « Toulouse, télétravail partiel » est toulousaine, pas distancielle.
 *
 * Python les compile avec `re.I` et les applique avec `re.search` (n'importe où dans le texte,
 * pas seulement au début). Le drapeau `i` et `RegExp.test` font la même chose ici.
 *
 * Les accents sont conservés tels quels : contrairement au signal d'école, `zone_de` travaille sur
 * le texte brut, sans normalisation. « Labège » doit donc matcher par `lab[eè]ge`, et c'est le
 * motif qui porte les deux graphies.
 */
const ZONE_TOULOUSE =
  /toulouse|blagnac|colomiers|lab[eè]ge|balma|haute[- ]garonne|muret|castanet|l'union|fenouillet|cornebarrieu|aucamville|beauzelle|cugnaux|tournefeuille|portet[- ]sur[- ]garonne|\b31\s*-|\b31\d{3}\b/i;

const ZONE_IDF =
  /paris|île[- ]de[- ]france|ile[- ]de[- ]france|nanterre|boulogne|saint[- ]denis|cr[eé]teil|montrouge|issy|saclay|v[eé]lizy|guyancourt|marne[- ]la[- ]vall[eé]e|\b7[5-9]\d{3}\b|\b9[1-5]\d{3}\b/i;

const ZONE_REMOTE = /t[eé]l[eé]travail|remote|à distance|a distance|home ?office/i;

const ZONES_ORDONNEES: [RegExp, Zone][] = [
  [ZONE_TOULOUSE, "toulouse"],
  [ZONE_IDF, "idf"],
  [ZONE_REMOTE, "remote"],
];

/**
 * La zone d'une annonce, d'après son seul champ `location`.
 *
 * Un lieu absent donne « autre », pas une erreur : `location or ""` côté Python, et 19 offres de
 * l'export sont dans ce cas. Deviner la ville depuis le titre serait inventer une donnée.
 */
export function zoneDe(location: string | null | undefined): Zone {
  const texte = location ?? "";
  for (const [motif, nom] of ZONES_ORDONNEES) {
    if (motif.test(texte)) return nom;
  }
  return "autre";
}

/**
 * Toutes les zones dont le motif correspond, pas seulement celle qui l'emporte.
 *
 * Sert au vérificateur : savoir si une offre met l'ordre de priorité à l'épreuve demande de
 * compter les correspondances, pas de lire le résultat — qui est unique par construction.
 */
export function zonesReconnues(location: string | null | undefined): Zone[] {
  const texte = location ?? "";
  return ZONES_ORDONNEES.filter(([motif]) => motif.test(texte)).map(([, nom]) => nom);
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
