/**
 * Lire les offres dans Neon et les remettre dans la forme exacte de `data/offers.json`.
 *
 * La table `offers` ne garde que les champs bruts de l'annonce (`db/schema.sql`) : ni note, ni
 * types de contrat découpés, ni signal d'école, ni `meta`. Ce module les reconstitue avec les
 * portages déjà vérifiés contre le pipeline (`lib/eligibilite.ts`), puis `normaliserExport` les
 * note comme il note le fichier. Le reste du site ne voit aucune différence de forme.
 *
 * La conversion (`ligneVersExport`, `metaDepuis`) est pure et testée sur une fixture. La requête
 * passe par un `Lecteur` qu'on remplace dans les tests : ni vraie base ni secret en CI.
 */
import { contratsDe, signalEcoleExporte } from "./eligibilite";
import { meta as metaFichier } from "./offers";
import type { ExportBrut, MetaExport, OffreExportee, Zone } from "./offers";

/** Une ligne de la requête `REQUETE_OFFRES`, telle que `pg` la rend. */
export type LigneBase = {
  pipeline_id: string;
  source: string;
  source_offer_id: string | null;
  canonical_url: string;
  title: string | null;
  company: string | null;
  location: string | null;
  location_zone: string;
  contract_type: string | null;
  contract_known: boolean;
  duration: string | null;
  start_date: string | null;
  education_required: string | null;
  description: string | null;
  skills_required: unknown;
  skills_optional: unknown;
  published_at: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  miage_mentioned: boolean;
};

/**
 * Les dates sont converties en texte **par PostgreSQL**, au format de la base SQLite du pipeline
 * (« 2026-10-20 13:05:10 »). Laissées à `pg`, elles deviendraient des `Date` lues à l'heure locale
 * du serveur, et une offre pourrait changer de jour selon la machine.
 *
 * Seules les offres qui portent un `pipeline_id` sont lues : les lignes copiées avant la
 * migration T6 n'en ont pas, et le site n'aurait aucune adresse à leur donner.
 */
export const REQUETE_OFFRES = `
select pipeline_id::text as pipeline_id, source, source_offer_id, canonical_url, title, company,
       location, location_zone, contract_type, contract_known, duration,
       to_char(start_date, 'YYYY-MM-DD') as start_date,
       education_required, description, skills_required, skills_optional,
       to_char(published_at, 'YYYY-MM-DD HH24:MI:SS') as published_at,
       to_char(first_seen_at, 'YYYY-MM-DD HH24:MI:SS') as first_seen_at,
       to_char(last_seen_at, 'YYYY-MM-DD HH24:MI:SS') as last_seen_at,
       miage_mentioned
  from offers
 where pipeline_id is not null
 order by pipeline_id`;

/** La dernière copie réussie, en UTC, au format de `meta.generated_at` de l'export. */
export const REQUETE_COLLECTE = `
select to_char(terminee_a at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"+00:00"') as terminee_a
  from collectes
 order by terminee_a desc
 limit 1`;

/**
 * Ce que l'export écrit dans `meta` sans le calculer (deux phrases fixes de `export_site.py`) :
 * repris du fichier plutôt que recopié, pour qu'un changement côté pipeline n'ait qu'un endroit.
 */
const { score_profile: SCORE_PROFILE, note: NOTE } = metaFichier;

/** Largeur de l'extrait cité autour du signal d'école (`EXTRAIT_LARGEUR` de l'export). */
const EXTRAIT_LARGEUR = 110;

const ZONES: Zone[] = ["toulouse", "idf", "remote", "autre"];

function liste(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * `published_at` : la base SQLite l'écrit tantôt avec l'heure, tantôt sans (154 offres sur 290
 * le 25 octobre). La colonne PostgreSQL ajoute « 00:00:00 » aux secondes. On la retire pour
 * retrouver le texte d'origine ; aucune offre de la collecte n'est publiée à minuit pile.
 * La note n'en dépend pas (le moteur lit les deux formes), l'âge affiché si.
 */
export function datePublication(v: string | null): string | null {
  return v === null ? null : v.replace(/ 00:00:00$/, "");
}

/** `extrait_formation` de l'export : le texte réel autour du motif, jamais une paraphrase. */
export function extraitFormation(
  offre: { description: string | null; title: string | null; education_required: string | null },
  motif: string,
): string | null {
  const texte = [offre.description, offre.title, offre.education_required].map((v) => v ?? "").join(" ");
  if (!motif || !texte) return null;
  const pos = texte.toLowerCase().indexOf(motif.toLowerCase());
  if (pos < 0) return null;
  const debut = Math.max(0, pos - Math.floor(EXTRAIT_LARGEUR / 2));
  const extrait = texte.slice(debut, pos + EXTRAIT_LARGEUR).replace(/\s+/g, " ").trim();
  return `… ${extrait} …`;
}

/** Une ligne de la base → une offre dans la forme de `export_site.ligne()`. */
export function ligneVersExport(l: LigneBase): OffreExportee {
  const types = contratsDe(l.contract_type);
  const motif = signalEcoleExporte(l);
  return {
    id: Number(l.pipeline_id),
    source: l.source,
    source_offer_id: l.source_offer_id,
    canonical_url: l.canonical_url,
    title: l.title,
    company: l.company,
    location: l.location,
    location_zone: (ZONES.includes(l.location_zone as Zone) ? l.location_zone : "autre") as Zone,
    contract_type: l.contract_type,
    contract_known: l.contract_known,
    contract_kinds: types.length ? types : null,
    duration: l.duration,
    start_date: l.start_date,
    education_required: l.education_required,
    description: l.description,
    skills_required: liste(l.skills_required),
    skills_optional: liste(l.skills_optional),
    training_flag: Boolean(motif),
    training_excerpt: motif ? extraitFormation(l, motif) : null,
    published_at: datePublication(l.published_at),
    first_seen_at: l.first_seen_at,
    last_seen_at: l.last_seen_at,
    miage_mentioned: l.miage_mentioned,
    // La note est calculée à la lecture par `normaliserExport`, pour le profil de référence.
    score: null,
    score_breakdown: null,
    score_reasons: null,
    skills: null,
  };
}

/** `meta` comme l'export le calcule, sur les offres lues et la date de la dernière copie. */
export function metaDepuis(offres: OffreExportee[], termineeA: string): MetaExport {
  const sources: Record<string, number> = {};
  for (const o of offres) sources[o.source] = (sources[o.source] ?? 0) + 1;
  const zones = Object.fromEntries(
    ZONES.map((z) => [z, offres.filter((o) => o.location_zone === z).length]),
  ) as Record<Zone, number>;
  return {
    generated_at: termineeA,
    count: offres.length,
    sources,
    zones,
    sans_contrat_renseigne: offres.filter((o) => !o.contract_known).length,
    score_profile: SCORE_PROFILE,
    note: NOTE,
  };
}

/**
 * L'ordre de l'export : note décroissante, puis titre. Les listes du site qui ne trient pas
 * elles-mêmes gardent ainsi le même ordre dans les deux modes.
 */
function ordreExport(a: { score: number | null; title: string | null }, b: typeof a): number {
  const parNote = (b.score ?? 0) - (a.score ?? 0);
  if (parNote) return parNote;
  const ta = a.title ?? "";
  const tb = b.title ?? "";
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}

/** Exécute une requête et rend ses lignes. `pg` en production, une fixture dans les tests. */
export type Lecteur = <T>(sql: string) => Promise<T[]>;

/** Ce que la base contient, ou pourquoi on ne peut pas s'en servir. */
export type LectureBase =
  | { ok: true; brut: ExportBrut }
  | { ok: false; motif: "base vide" | "aucune collecte datée" };

/**
 * Lit la base. Lève si elle est injoignable : c'est `lireDonnees` (`lib/donnees.ts`) qui décide
 * du repli, et qui remet les offres dans l'ordre de l'export une fois notées.
 */
export async function lireBase(lire: Lecteur): Promise<LectureBase> {
  const lignes = await lire<LigneBase>(REQUETE_OFFRES);
  if (lignes.length === 0) return { ok: false, motif: "base vide" };
  const [collecte] = await lire<{ terminee_a: string }>(REQUETE_COLLECTE);
  if (!collecte) return { ok: false, motif: "aucune collecte datée" };
  const offres = lignes.map(ligneVersExport);
  return { ok: true, brut: { meta: metaDepuis(offres, collecte.terminee_a), offers: offres } };
}

export { ordreExport };
