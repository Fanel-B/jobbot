/**
 * Les quatre champs personnels du profil, et la distinction entre « pas renseigné » et « partout ».
 * SOCLE T4, EN BROUILLON : ce module n'est branché ni sur `lib/profil.ts`, ni sur le formulaire, ni
 * sur le cookie `jobbot_profil`, ni sur la base. Le profil existant ne change pas.
 *
 * Les quatre champs, qui décident de l'éligibilité (jamais de la compatibilité) :
 *
 *   · début au plus tôt   (colonne `available_from`, déjà en base) ;
 *   · fin au plus tard    (colonne `available_until`, migration t8) ;
 *   · durée minimale, en mois (`duration_min_months`, migration t8) ;
 *   · durée maximale, en mois (`duration_max_months`, migration t8).
 *
 * Règle de vérité : un visiteur qui n'a rien dit a des champs NULS, pas des valeurs de Fanel ni des
 * valeurs plausibles. Les valeurs de Fanel (`PROFIL_PERSONNEL_FANEL`) sont celles de `faits.STAGE`
 * (reference/faits.py) : un test les compare au moteur.
 *
 * Les zones ont, elles, trois états qu'un tableau vide ne distingue pas :
 *
 *   · `null`      : la personne n'a pas répondu ;
 *   · `"partout"` : la personne a choisi de ne pas restreindre ;
 *   · une liste   : les zones choisies (au moins une).
 */
import { ZONES, type Zone } from "./eligibilite";

export type ProfilPersonnel = {
  /** AAAA-MM-JJ. */
  debutAuPlusTot: string | null;
  /** AAAA-MM-JJ. */
  finAuPlusTard: string | null;
  dureeMinMois: number | null;
  dureeMaxMois: number | null;
};

export type ZonesProfil = Zone[] | "partout" | null;

/** Quelqu'un qui n'a encore rien dit : aucune valeur inventée. */
export const PROFIL_PERSONNEL_VISITEUR: ProfilPersonnel = {
  debutAuPlusTot: null,
  finAuPlusTard: null,
  dureeMinMois: null,
  dureeMaxMois: null,
};

/**
 * Le profil de référence du pipeline : début le 29 mars 2027, fin au plus tard le 31 juillet 2027,
 * de 3,5 à 5 mois. Reprend `faits.STAGE` (debut_iso, fin_max_iso, duree_min, duree_max).
 */
export const PROFIL_PERSONNEL_FANEL: ProfilPersonnel = {
  debutAuPlusTot: "2027-03-29",
  finAuPlusTard: "2027-07-31",
  dureeMinMois: 3.5,
  dureeMaxMois: 5,
};

/**
 * Les colonnes que la migration t8 ajoute à `profiles` (`db/migration-t8.sql`). Un test vérifie que
 * le SQL les crée toutes. `available_from` existe déjà et n'y figure pas.
 */
export const COLONNES_PROFIL_T8 = ["available_until", "duration_min_months", "duration_max_months", "zones_mode"] as const;

/* --------------------------------------------------------------------- validation */

/** Une date AAAA-MM-JJ qui existe au calendrier. « 2027-02-30 » n'en est pas une. */
export function estDateIso(valeur: unknown): valeur is string {
  if (typeof valeur !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

const estDuree = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * Les incohérences d'un profil, une par phrase ; liste vide si le profil est cohérent. Un champ nul
 * n'est jamais une incohérence : il est « non renseigné ».
 *
 * TODO(QUESTION) : aucune borne haute n'est posée sur les durées (36 mois ? 60 ?) : la demande n'en
 * fixe pas. Une durée doit seulement être un nombre fini strictement positif.
 */
export function incoherencesProfilPersonnel(p: ProfilPersonnel): string[] {
  const problemes: string[] = [];
  if (p.debutAuPlusTot !== null && !estDateIso(p.debutAuPlusTot)) problemes.push("début au plus tôt : date AAAA-MM-JJ attendue");
  if (p.finAuPlusTard !== null && !estDateIso(p.finAuPlusTard)) problemes.push("fin au plus tard : date AAAA-MM-JJ attendue");
  if (p.dureeMinMois !== null && !estDuree(p.dureeMinMois)) problemes.push("durée minimale : nombre de mois strictement positif attendu");
  if (p.dureeMaxMois !== null && !estDuree(p.dureeMaxMois)) problemes.push("durée maximale : nombre de mois strictement positif attendu");
  if (estDateIso(p.debutAuPlusTot) && estDateIso(p.finAuPlusTard) && p.finAuPlusTard < p.debutAuPlusTot) {
    problemes.push("la fin au plus tard précède le début au plus tôt");
  }
  if (estDuree(p.dureeMinMois) && estDuree(p.dureeMaxMois) && p.dureeMinMois > p.dureeMaxMois) {
    problemes.push("la durée minimale dépasse la durée maximale");
  }
  return problemes;
}

/** Le visiteur n'a rien renseigné : aucun des quatre champs n'a de valeur. */
export function estVisiteurVide(p: ProfilPersonnel): boolean {
  return p.debutAuPlusTot === null && p.finAuPlusTard === null && p.dureeMinMois === null && p.dureeMaxMois === null;
}

/* ------------------------------------------------------------------------ zones */

/**
 * Convertit les zones de l'ancien profil (`Profil.zones`, où la liste vide voulait dire « partout »)
 * vers les trois états : liste vide devient `"partout"`, liste non vide reste une liste (valeurs
 * inconnues écartées). C'est le sens que le code actuel donne à `[]` : le comportement est conservé.
 *
 * ATTENTION : cela vaut pour un profil ENREGISTRÉ. Le profil d'un visiteur qui n'a rien dit
 * (`PROFIL_VIDE.zones` vaut aussi `[]` aujourd'hui) doit devenir `null`, pas `"partout"` : c'est à
 * l'appelant de ne pas passer par ici dans ce cas.
 * TODO(QUESTION) : les profils déjà en base avec `zones = '{}'` deviennent-ils « partout » (comportement
 * actuel conservé) ou « non renseigné » ? La migration t8 les laisse « non renseigné » : à trancher.
 */
export function zonesDepuisAncienFormat(zones: readonly string[]): ZonesProfil {
  const connues = zones.filter((z): z is Zone => (ZONES as readonly string[]).includes(z));
  if (zones.length === 0) return "partout";
  return connues.length > 0 ? [...new Set(connues)] : null;
}

/* ------------------------------------------------------------------------ cookie */

/**
 * Le cookie du profil personnel, versionné : un changement de format monte la version, et une version
 * inconnue donne le visiteur vide, jamais une valeur devinée.
 * TODO(QUESTION) : cookie séparé de `jobbot_profil` (choix de ce brouillon, qui ne touche pas
 * l'existant), ou même cookie avec une version 2 ? Le nom ci-dessous est provisoire.
 */
export const COOKIE_PROFIL_PERSONNEL = "jobbot_profil_personnel";
export const VERSION_COOKIE_PROFIL_PERSONNEL = 1;

export type ProfilPersonnelComplet = { personnel: ProfilPersonnel; zones: ZonesProfil };

/** Le cookie reste lisible à l'œil, comme celui du profil existant. */
export function encoderProfilPersonnel(personnel: ProfilPersonnel, zones: ZonesProfil): string {
  return JSON.stringify({
    v: VERSION_COOKIE_PROFIL_PERSONNEL,
    d: personnel.debutAuPlusTot,
    f: personnel.finAuPlusTard,
    m: personnel.dureeMinMois,
    M: personnel.dureeMaxMois,
    z: zones,
  });
}

/**
 * Relit un cookie. Chaque champ invalide devient nul, sans toucher aux autres ; un cookie absent,
 * illisible ou d'une autre version donne le visiteur vide.
 * TODO(QUESTION) : un champ incohérent avec un autre (fin avant le début, durée min au-dessus de max)
 * est conservé tel quel ici ; `incoherencesProfilPersonnel` le signale. Faut-il l'écarter à la lecture ?
 */
export function decoderProfilPersonnel(brut: string | undefined): ProfilPersonnelComplet {
  const visiteur: ProfilPersonnelComplet = { personnel: PROFIL_PERSONNEL_VISITEUR, zones: null };
  if (!brut) return visiteur;
  try {
    const o = JSON.parse(brut) as Record<string, unknown>;
    if (o.v !== VERSION_COOKIE_PROFIL_PERSONNEL) return visiteur;
    const zones: ZonesProfil =
      o.z === "partout"
        ? "partout"
        : Array.isArray(o.z)
          ? zonesValides(o.z)
          : null;
    return {
      personnel: {
        debutAuPlusTot: estDateIso(o.d) ? o.d : null,
        finAuPlusTard: estDateIso(o.f) ? o.f : null,
        dureeMinMois: estDuree(o.m) ? o.m : null,
        dureeMaxMois: estDuree(o.M) ? o.M : null,
      },
      zones,
    };
  } catch {
    return visiteur;
  }
}

/** Une liste de zones valides, sans doublon ; vide ou sans zone reconnue : « pas renseigné ». */
function zonesValides(valeurs: unknown[]): ZonesProfil {
  const zones = valeurs.filter((z): z is Zone => typeof z === "string" && (ZONES as readonly string[]).includes(z));
  return zones.length > 0 ? [...new Set(zones)] : null;
}
