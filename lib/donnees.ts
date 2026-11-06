/**
 * D'où le site lit ses offres. Le seul module que les pages appellent pour les obtenir.
 *
 * `OFFERS_SOURCE` choisit :
 *   · « file » (le défaut, et toute autre valeur) : `data/offers.json`, comme toujours ;
 *   · « db » : la table `offers` de Neon, remplie toutes les heures par le collecteur.
 *
 * En mode base, la lecture est mise en cache quinze minutes (`use cache` + `cacheLife`) : le
 * collecteur copie toutes les heures, le site n'a pas à interroger Neon à chaque visite. Si la
 * base est vide ou injoignable, le site se rabat sur le fichier et `meta.repli` dit pourquoi.
 *
 * En mode fichier, rien n'est mis en cache ni revalidé : le fichier ne change qu'avec un
 * déploiement, et les pages restent exactement celles d'avant.
 */
import { cacheLife, cacheTag } from "next/cache";
import { base, baseConfiguree, sansChaineDeConnexion } from "./db";
import { lireBase, ordreExport, type Lecteur } from "./donnees-base";
import { donneesFichier, normaliserExport, type Donnees, type SourceOffres } from "./offers";

/** Quinze minutes : la cadence de lecture visée, pour une copie toutes les heures. */
export const DUREE_CACHE_SECONDES = 15 * 60;

/** Le mode demandé. Tout ce qui n'est pas exactement « db » lit le fichier. */
export function sourceDemandee(env: Record<string, string | undefined> = process.env): SourceOffres {
  return env.OFFERS_SOURCE === "db" ? "db" : "file";
}

/**
 * La lecture elle-même, sans cache : c'est ce que les tests appellent avec une fixture.
 *
 * `lecteur` est `null` quand `DATABASE_URL` manque : le mode base a été demandé sans base.
 */
export async function lireDonnees(
  source: SourceOffres,
  lecteur: Lecteur | null,
): Promise<Donnees> {
  if (source === "file") return donneesFichier();
  if (!lecteur) return donneesFichier("DATABASE_URL absente");
  try {
    const lecture = await lireBase(lecteur);
    if (!lecture.ok) return donneesFichier(lecture.motif);
    const d = normaliserExport(lecture.brut, "db");
    return { ...d, offers: [...d.offers].sort(ordreExport) };
  } catch (e) {
    // Le message de `pg` contient parfois la chaîne de connexion : masquée avant d'être écrite.
    console.error(`Offres : base illisible, repli sur data/offers.json (${sansChaineDeConnexion(e)})`);
    return donneesFichier("base injoignable");
  }
}

const lecteurPg: Lecteur = async <T,>(sql: string) => (await base().query(sql)).rows as T[];

async function donneesDeLaBase(): Promise<Donnees> {
  "use cache";
  cacheLife({ revalidate: DUREE_CACHE_SECONDES });
  cacheTag("offres");
  return lireDonnees("db", baseConfiguree() ? lecteurPg : null);
}

/** Les offres et leur `meta`, de la source choisie par `OFFERS_SOURCE`. */
export async function chargerDonnees(): Promise<Donnees> {
  if (sourceDemandee() === "file") return donneesFichier();
  return donneesDeLaBase();
}
