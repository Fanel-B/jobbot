/**
 * Le profil : ce que la personne a **confirmé** savoir faire, et ce qu'elle cherche.
 *
 * Règle du cahier de route, et elle n'est pas négociable : `profiles.skills` ne contient pas ce
 * qu'une IA a deviné dans un CV, mais ce que l'utilisateur a coché. Une compétence jamais
 * confirmée ne compte jamais. Cette page est donc le seul endroit où le profil se décide.
 *
 * Il vit dans un cookie plutôt que dans l'URL : il doit survivre à la navigation entre la liste et
 * les fiches, et il n'a rien à faire dans un lien qu'on partage — contrairement aux filtres et au
 * simulant, qui sont des vues et restent des liens.
 *
 * Tant qu'il n'y a pas de comptes, le cookie suffit et ne demande aucune base. Le jour où Neon
 * arrive, `lireProfil()` est le seul endroit à changer.
 */
import { cookies } from "next/headers";
import {
  ATOUTS_PAR_DEFAUT,
  CATALOGUE,
  classer,
  maintenantDeLExport,
  ordreDuPipeline,
  type Resultat,
} from "./scoring";
import { familleLacune, meta, offers, type Zone } from "./offers";
import { SEUIL_BONNE_PISTE } from "./simulation";
import type { Competence, EffetGlobal, EffetOffre, LigneQuiBouge } from "./simulation";

export const COOKIE_PROFIL = "jobbot_profil";

export type NiveauEtudes = "bac+3" | "bac+4" | "bac+5";
export type TypeRecherche = "stage" | "alternance";

export type Profil = {
  /** Noms du catalogue, tels que la personne les a cochés. */
  competences: string[];
  /** Zones acceptées. Une liste vide veut dire « partout ». */
  zones: Zone[];
  niveau: NiveauEtudes;
  recherche: TypeRecherche[];
};

/**
 * Le profil de départ : exactement celui que le pipeline applique aujourd'hui. Il n'invente rien,
 * il reprend `MES_ATOUTS`. Tant que personne n'a rien coché, le site affiche donc les mêmes notes
 * que celles vérifiées contre l'oracle — c'est ce qui rend le changement sans risque.
 */
export const PROFIL_DEFAUT: Profil = {
  competences: [...new Set(ATOUTS_PAR_DEFAUT.map(([, nom]) => nom))],
  zones: ["toulouse"],
  niveau: "bac+3",
  recherche: ["stage"],
};

const NIVEAUX: NiveauEtudes[] = ["bac+3", "bac+4", "bac+5"];
const RECHERCHES: TypeRecherche[] = ["stage", "alternance"];
const ZONES: Zone[] = ["toulouse", "idf", "remote", "autre"];

export const NIVEAU_LABEL: Record<NiveauEtudes, string> = {
  "bac+3": "Bac+3 — L3 / Licence",
  "bac+4": "Bac+4 — M1",
  "bac+5": "Bac+5 — M2",
};

export const RECHERCHE_LABEL: Record<TypeRecherche, string> = {
  stage: "Stage",
  alternance: "Alternance",
};

/* ------------------------------------------------------------- sérialisation */

/** Le cookie reste lisible à l'œil : on doit pouvoir vérifier ce qu'on stocke sur quelqu'un. */
export function encoderProfil(p: Profil): string {
  return JSON.stringify({
    c: p.competences,
    z: p.zones,
    n: p.niveau,
    r: p.recherche,
  });
}

/**
 * Relit un profil. Toute valeur inconnue est écartée au lieu d'être corrigée : un cookie
 * trafiqué ou vieilli donne le profil par défaut, jamais une erreur ni une note fantaisiste.
 */
export function decoderProfil(brut: string | undefined): Profil {
  if (!brut) return PROFIL_DEFAUT;
  try {
    const o = JSON.parse(brut) as Record<string, unknown>;
    const noms = new Set(CATALOGUE.map((c) => c.nom));
    const competences = Array.isArray(o.c)
      ? o.c.filter((x): x is string => typeof x === "string" && noms.has(x))
      : PROFIL_DEFAUT.competences;
    const zones = Array.isArray(o.z)
      ? o.z.filter((x): x is Zone => typeof x === "string" && ZONES.includes(x as Zone))
      : PROFIL_DEFAUT.zones;
    const recherche = Array.isArray(o.r)
      ? o.r.filter((x): x is TypeRecherche => typeof x === "string" && RECHERCHES.includes(x as TypeRecherche))
      : PROFIL_DEFAUT.recherche;
    return {
      competences,
      zones,
      niveau: NIVEAUX.includes(o.n as NiveauEtudes) ? (o.n as NiveauEtudes) : PROFIL_DEFAUT.niveau,
      recherche: recherche.length ? recherche : PROFIL_DEFAUT.recherche,
    };
  } catch {
    return PROFIL_DEFAUT;
  }
}

/** Le profil de la requête en cours. Sans cookie, celui par défaut. */
export async function lireProfil(): Promise<Profil> {
  const magasin = await cookies();
  return decoderProfil(magasin.get(COOKIE_PROFIL)?.value);
}

/** A-t-on affaire à quelqu'un qui a vraiment réglé son profil, ou au réglage d'usine ? */
export function estParDefaut(p: Profil): boolean {
  return encoderProfil(p) === encoderProfil(PROFIL_DEFAUT);
}

/* --------------------------------------------------------------- notation */

/**
 * Les atouts du profil, dans la forme que le moteur attend : une clé reconnue dans l'annonce,
 * un nom affiché. Les alias du catalogue suivent la compétence cochée — cocher « SQL » couvre
 * donc aussi « MySQL » et « PostgreSQL », exactement comme côté pipeline.
 */
export function atoutsDuProfil(p: Profil): (readonly [string, string])[] {
  const choisies = new Set(p.competences);
  const paires: (readonly [string, string])[] = [];
  for (const { nom, cles } of CATALOGUE) {
    if (!choisies.has(nom)) continue;
    for (const cle of cles) paires.push([cle, nom] as const);
  }
  return paires;
}

const MAINTENANT = maintenantDeLExport(meta.generated_at);
const cache = new Map<string, Map<number, Resultat>>();

/** Le classement complet vu par ce profil. Mis en cache : une page en demande plusieurs fois. */
export function classementPour(p: Profil, ajouts: readonly string[] = []): Map<number, Resultat> {
  const cle = encoderProfil(p) + "|" + [...ajouts].sort().join(",");
  const connu = cache.get(cle);
  if (connu) return connu;
  const calcule = new Map(
    classer(ordreDuPipeline(offers), MAINTENANT, new Map(), ajouts, atoutsDuProfil(p)).map((r) => [
      r.id,
      r,
    ]),
  );
  cache.set(cle, calcule);
  return calcule;
}

/** Les exigences de cette offre que le profil ne couvre pas. */
export function manquantsPour(p: Profil, id: number): string[] {
  return classementPour(p).get(id)?.manquants ?? [];
}

/**
 * L'effet de compétences simulées sur une offre, **pour ce profil**.
 *
 * Même forme que `effetSurOffre` de `lib/simulation`, mais la base de comparaison est le profil
 * de la personne et non le profil d'usine : sans ça, la fiche annoncerait une note « pour ton
 * profil » puis mesurerait l'écart depuis un autre.
 */
export function effetPour(
  p: Profil,
  id: number,
  ajouts: readonly string[],
): EffetOffre | null {
  const avant = classementPour(p).get(id);
  const apres = classementPour(p, ajouts).get(id);
  if (!avant || !apres) return null;

  const pointsAvant = new Map(avant.breakdown.map((l) => [l.critere, l.points]));
  const lignesQuiBougent: LigneQuiBouge[] = [];
  for (const ligne of apres.breakdown) {
    const points = pointsAvant.get(ligne.critere);
    if (points !== undefined && points !== ligne.points) {
      lignesQuiBougent.push({
        critere: ligne.critere,
        avant: points,
        apres: ligne.points,
        max: ligne.max,
      });
    }
  }

  return {
    totalAvant: avant.total,
    totalApres: apres.total,
    bulletinApres: apres.breakdown,
    lignesQuiBougent,
    manquantsApres: apres.manquants,
  };
}

/* ------------------------------------------------- le simulant, pour ce profil */

/**
 * Les compétences manquantes les plus demandées, vues depuis ce profil.
 *
 * Même regroupement par famille que `competencesSimulables`, mais la base de calcul est le
 * profil de la personne : quelqu'un qui maîtrise déjà Docker ne doit pas se le voir proposer.
 */
export function competencesSimulablesPour(p: Profil, max = 6): Competence[] {
  const parFamille = new Map<string, { offres: Set<number>; formes: Set<string> }>();
  for (const r of classementPour(p).values()) {
    for (const m of r.manquants) {
      const nom = familleLacune(m);
      const e = parFamille.get(nom) ?? { offres: new Set<number>(), formes: new Set<string>() };
      e.offres.add(r.id);
      e.formes.add(m);
      parFamille.set(nom, e);
    }
  }
  return [...parFamille.entries()]
    .map(([label, f]) => ({ label, formes: [...f.formes], demandee: f.offres.size }))
    .sort((x, y) => y.demandee - x.demandee || x.label.localeCompare(y.label))
    .slice(0, max);
}

/** Combien d'offres ce profil place déjà au-dessus du seuil. */
export function offresAuDessusPour(p: Profil, seuil: number = SEUIL_BONNE_PISTE): number {
  let n = 0;
  for (const r of classementPour(p).values()) if (r.total >= seuil) n += 1;
  return n;
}

/** Ce qu'une compétence changerait sur toute la collecte, pour ce profil. */
export function effetGlobalPour(
  p: Profil,
  competence: Competence,
  seuil: number = SEUIL_BONNE_PISTE,
): EffetGlobal {
  const avant = classementPour(p);
  const apres = classementPour(p, competence.formes);
  let franchissent = 0;
  let montent = 0;
  let gain = 0;
  for (const [id, a] of avant) {
    const b = apres.get(id);
    if (!b) continue;
    if (b.total > a.total) {
      montent += 1;
      gain += b.total - a.total;
    }
    if (a.total < seuil && b.total >= seuil) franchissent += 1;
  }
  return {
    competence: competence.label,
    franchissent,
    montent,
    gainMoyen: montent ? Math.round(gain / montent) : 0,
  };
}

/** Les offres, renotées pour ce profil. Même forme que `offers`, donc interchangeable. */
export function offresPour(p: Profil) {
  const classement = classementPour(p);
  return offers.map((o) => {
    const r = classement.get(o.id);
    if (!r) return o;
    return {
      ...o,
      score: r.total,
      score_breakdown: r.breakdown,
      score_reasons: r.raisons,
      skills: { required: r.exigences, covered: r.exigences.filter((e) => !r.manquants.includes(e)), missing: r.manquants },
    };
  });
}
