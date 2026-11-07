/**
 * GÉNÉRÉ par `tools/generer_zones.py` depuis `reference/faits.py`. NE PAS MODIFIER À LA MAIN.
 *
 * Régénérer : `python3 tools/generer_zones.py`. `lib/zones.test.ts` échoue si ce fichier diverge de
 * `faits.py` : une zone s'ajoute ou se corrige là-bas, puis ici par le script, jamais l'inverse.
 * La règle qui lit ces listes est dans `lib/eligibilite.ts` (`zoneDe`).
 */

export const ZONES_ORDRE = ["toulouse", "occitanie", "idf", "remote"] as const;
export type NomZoneFaits = (typeof ZONES_ORDRE)[number];

/** Les zones où l'on accepte une offre (le télétravail n'en fait pas partie), `eligibility.ZONES_ELIGIBLES`. */
export const ZONES_ELIGIBLES: readonly NomZoneFaits[] = ["toulouse", "occitanie", "idf"];

/** Points d'un lieu qui ne se range dans aucune zone, `scoring.LOCATION_DEFAULT`. */
export const POINTS_LIEU_AUTRE = 3;

export interface ZoneFaits {
  libelle: string;
  points: number;
  villes: readonly string[];
  departements: readonly string[];
  regions_englobantes: readonly string[];
  region_propre: readonly string[];
  ambigus: readonly string[];
}

export const ZONES_FAITS: Record<NomZoneFaits, ZoneFaits> = {
  toulouse: {
    libelle: "Toulouse et alentours",
    points: 15,
    villes: [
      "toulouse", "haute-garonne", "colomiers", "blagnac", "labege", "balma", "saint-orens",
      "ramonville", "muret", "castanet-tolosan", "l'union", "fenouillet", "cornebarrieu",
      "aucamville", "beauzelle", "cugnaux", "tournefeuille", "plaisance-du-touch",
      "portet-sur-garonne", "poucharramet",
    ],
    departements: ["31"],
    regions_englobantes: ["occitanie"],
    region_propre: [],
    ambigus: [],
  },
  occitanie: {
    libelle: "Occitanie",
    points: 13,
    villes: [
      "montauban", "montpellier", "castres", "albi", "nimes", "nîmes", "perpignan", "beziers",
      "béziers", "narbonne", "carcassonne", "rodez", "cahors", "foix", "tarbes", "auch", "pamiers",
      "sete", "sète", "lunel", "mende", "millau",
    ],
    departements: ["09", "11", "12", "30", "32", "34", "46", "48", "65", "66", "81", "82"],
    regions_englobantes: [],
    region_propre: [],
    ambigus: [],
  },
  idf: {
    libelle: "Île-de-France",
    points: 13,
    villes: [
      "paris", "boulogne-billancourt", "issy-les-moulineaux", "nanterre", "saint-denis",
      "velizy-villacoublay", "creteil", "montrouge", "saclay", "guyancourt", "cergy", "massy",
      "palaiseau", "evry", "orsay", "versailles", "saint-quentin-en-yvelines", "marne-la-vallee",
      "montreuil", "argenteuil", "suresnes", "courbevoie", "puteaux", "levallois", "neuilly",
      "rueil", "clichy", "meudon", "chatillon", "saint-cloud", "gennevilliers", "vincennes",
      "villejuif", "ivry", "charenton", "maisons-alfort", "melun", "meaux", "sarcelles",
      "saint-germain-en-laye", "elancourt", "montigny", "trappes", "les ulis", "bures-sur-yvette",
      "la defense", "colombes", "asnieres", "asnières", "malakoff", "clamart", "sevres", "sèvres",
      "aubervilliers", "pantin", "bobigny", "noisy-le-grand", "bagnolet", "saint-ouen", "vitry",
      "fontenay-sous-bois", "idf", "velizy", "pontoise", "champs-sur-marne", "serris",
      "saint-mande", "saint-maur", "arcueil", "rungis", "vitry-sur-seine", "ivry-sur-seine",
      "montigny-le-bretonneux", "saint-maur-des-fosses", "charenton-le-pont",
      "saint-ouen-sur-seine", "l'ile-saint-denis", "ile-saint-denis",
    ],
    departements: ["75", "77", "78", "91", "92", "93", "94", "95"],
    regions_englobantes: ["ile-de-france", "île-de-france"],
    region_propre: ["ile-de-france", "île-de-france"],
    ambigus: ["saint-denis", "montigny", "vitry", "ivry", "saint-maur", "charenton", "saint-ouen"],
  },
  remote: {
    libelle: "Télétravail",
    points: 10,
    villes: [
      "teletravail", "télétravail", "remote", "a distance", "à distance", "full remote",
      "100% remote", "home office", "homeoffice", "distanciel",
    ],
    departements: [],
    regions_englobantes: [],
    region_propre: [],
    ambigus: [],
  },
};
