/**
 * La connexion à PostgreSQL (Neon).
 *
 * Rien dans le site n'en dépend encore : les offres viennent toujours de `data/offers.json`, et
 * c'est volontaire — tant que la base n'est pas peuplée par le collecteur, basculer casserait un
 * site qui marche. Ce module est la plomberie posée d'avance.
 *
 * Le choix du pilote suit la skill `neon-postgres` : sur Vercel, `node-postgres` (`pg`) avec
 * `attachDatabasePool`, et non le pilote serverless — celui-là vise l'edge et Netlify. Sur Vercel
 * Fluid compute, `attachDatabasePool` ferme proprement le pool quand la fonction se suspend ;
 * sans lui, les connexions fuient, et l'offre gratuite de Neon en a peu.
 *
 * Deux chaînes, deux usages (la confusion coûte cher, et l'erreur ne nomme jamais le pooler) :
 *   · `DATABASE_URL`          — pooled, l'hôte contient « -pooler ». Le trafic du site.
 *   · `DATABASE_URL_UNPOOLED` — directe. Les migrations, les sauvegardes, la réplication.
 *
 * Aucun secret n'est écrit ici : tout vient de l'environnement.
 */
import { Pool } from "pg";

let pool: Pool | null = null;

/** La base est-elle configurée ? Permet de dire « pas encore branchée » au lieu de planter. */
export function baseConfiguree(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Le pool de connexions, créé à la première demande et réutilisé ensuite.
 *
 * Lève si `DATABASE_URL` est absente, avec un message qui dit quoi faire — plutôt qu'une erreur
 * de connexion obscure trente lignes plus loin.
 */
export function base(): Pool {
  if (pool) return pool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL est absente. En local, pose-la dans .env.local (voir .env.local.example) ; " +
        "sur Vercel, dans Settings → Environment Variables. La chaîne ne doit jamais être commitée.",
    );
  }

  pool = new Pool({ connectionString: sslExplicite(url), ssl: { rejectUnauthorized: true } });

  // Sur Vercel, laisse la plateforme vider le pool quand la fonction se suspend. Ailleurs —
  // en local, sur le VPS — le module n'existe pas ou ne sert à rien : on continue sans.
  if (process.env.VERCEL) {
    void import("@vercel/functions")
      .then(({ attachDatabasePool }) => attachDatabasePool(pool!))
      .catch(() => {
        /* hors Vercel Fluid : rien à rattacher, ce n'est pas une erreur. */
      });
  }

  return pool;
}

/**
 * Écrit `sslmode=verify-full` à la place de `require`.
 *
 * `pg` traite aujourd'hui `require` comme `verify-full` — le certificat est vérifié — mais
 * préviendra bientôt le contraire : en pg 9, `require` prendra la sémantique libpq, plus faible.
 * Neon présente un certificat valide, donc on demande explicitement le comportement fort plutôt
 * que d'hériter d'un affaiblissement à la prochaine montée de version.
 *
 * La réécriture se fait ici et non dans `.env.local`, parce que ce fichier est régénéré par
 * `neon env pull` : une correction posée dedans disparaîtrait au prochain tirage.
 */
export function sslExplicite(url: string): string {
  return url.replace(/([?&])sslmode=(require|prefer|verify-ca)(?=&|$)/i, "$1sslmode=verify-full");
}

/** Les tables que `db/schema.sql` crée. Sert à vérifier qu'une base est bien initialisée. */
export const TABLES_ATTENDUES = [
  "offers",
  "users",
  // Auth.js : les noms et les colonnes sont imposés par son adaptateur Postgres.
  "accounts",
  "sessions",
  "verification_token",
  "profiles",
  "resumes",
  "saved_offers",
  "ai_usage",
] as const;

export type EtatBase = {
  joignable: boolean;
  /** Les tables de `TABLES_ATTENDUES` réellement présentes. */
  presentes: string[];
  /** Celles qui manquent — le schéma n'a pas été appliqué, ou pas entièrement. */
  manquantes: string[];
  /** Nombre de lignes dans `offers`, si la table existe. */
  offres: number | null;
  erreur?: string;
};

/**
 * L'état de la base, sans rien modifier.
 *
 * Ne lève jamais : une base injoignable est un état à afficher, pas un plantage. Le message
 * d'erreur est repris tel quel **sauf** s'il contient la chaîne de connexion — `pg` la met parfois
 * dans ses erreurs, et elle n'a rien à faire dans un journal.
 */
export async function etatDeLaBase(): Promise<EtatBase> {
  const vide: EtatBase = {
    joignable: false,
    presentes: [],
    manquantes: [...TABLES_ATTENDUES],
    offres: null,
  };

  if (!baseConfiguree()) {
    return { ...vide, erreur: "DATABASE_URL est absente." };
  }

  try {
    const client = await base().connect();
    try {
      const { rows } = await client.query<{ table_name: string }>(
        `select table_name from information_schema.tables
          where table_schema = 'public' and table_name = any($1::text[])`,
        [TABLES_ATTENDUES as unknown as string[]],
      );
      const presentes = rows.map((r) => r.table_name).sort();
      const manquantes = TABLES_ATTENDUES.filter((t) => !presentes.includes(t));

      let offres: number | null = null;
      if (presentes.includes("offers")) {
        const n = await client.query<{ n: string }>("select count(*)::text as n from offers");
        offres = Number(n.rows[0]?.n ?? 0);
      }

      return { joignable: true, presentes, manquantes: [...manquantes], offres };
    } finally {
      client.release();
    }
  } catch (e) {
    return { ...vide, erreur: sansChaineDeConnexion(e) };
  }
}

/** Retire toute chaîne de connexion d'un message d'erreur avant de l'afficher ou de le journaliser. */
export function sansChaineDeConnexion(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  return message.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://[masqué]");
}
