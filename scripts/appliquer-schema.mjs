/**
 * `npm run db:schema` : applique `db/schema.sql` à la base Neon.
 *
 * Par la connexion **directe** (`DATABASE_URL_UNPOOLED`), jamais la pooled : une migration passée
 * par PgBouncer échoue d'une façon qui ne nomme jamais le pooler — un `SET` qui ne survit pas à sa
 * transaction, une écriture qui tombe sur une transaction héritée en lecture seule.
 *
 * Le fichier est rejouable : `CREATE ... IF NOT EXISTS` partout, aucune suppression, le tout dans
 * une transaction. Le relancer ne casse rien et ne perd aucune donnée.
 *
 * Aucune chaîne de connexion n'est affichée, pas même en cas d'erreur.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { sansChaineDeConnexion, sslExplicite } from "../lib/db.ts";

// Next lit `.env.local` tout seul ; un script Node, non.
try {
  const brut = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const ligne of brut.split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    const valeur = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = valeur;
  }
} catch {
  /* pas de .env.local : les variables viennent peut-être de l'environnement. */
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.log("Aucune chaîne de connexion. Lance `npx neon@latest env pull` ou remplis .env.local.");
  process.exit(1);
}
if (!process.env.DATABASE_URL_UNPOOLED) {
  console.log("DATABASE_URL_UNPOOLED absente : repli sur la pooled, ce qui peut échouer.");
}

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString: sslExplicite(url), ssl: { rejectUnauthorized: true } });

try {
  await client.connect();
  await client.query(schema);

  const { rows } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  );
  console.log(`Schéma appliqué. Tables présentes (${rows.length}) :`);
  for (const r of rows) console.log(`  · ${r.table_name}`);
} catch (e) {
  console.log("Échec de l'application du schéma.");
  console.log(`  ${sansChaineDeConnexion(e)}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
