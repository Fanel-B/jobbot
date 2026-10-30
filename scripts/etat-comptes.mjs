/**
 * `node scripts/etat-comptes.mjs` : combien de personnes, d'identités Google et de sessions.
 *
 * Sert à prouver qu'une connexion a bien atterri en base, et qu'une suppression de compte a bien
 * tout emporté. N'affiche aucune adresse e-mail et aucun jeton — seulement des comptes et des
 * dates, de quoi vérifier sans exposer quoi que ce soit.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { sansChaineDeConnexion, sslExplicite } from "../lib/db.ts";

try {
  const brut = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const ligne of brut.split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  /* pas de .env.local : les variables viennent peut-être de l'environnement. */
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.log("Aucune chaîne de connexion.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: sslExplicite(url), ssl: { rejectUnauthorized: true } });

try {
  await client.connect();

  const { rows } = await client.query(`
    select
      (select count(*) from users)    as personnes,
      (select count(*) from accounts) as identites,
      (select count(*) from sessions) as sessions,
      (select count(*) from sessions where expires > now()) as sessions_valides
  `);
  const n = rows[0];
  console.log(`personnes        ${n.personnes}`);
  console.log(`identités Google ${n.identites}`);
  console.log(`sessions         ${n.sessions}  (dont valides : ${n.sessions_valides})`);

  if (Number(n.sessions) > 0) {
    const { rows: s } = await client.query(
      `select p.provider, s.expires from sessions s
         join accounts p on p."userId" = s."userId"
        order by s.expires desc limit 5`,
    );
    console.log("");
    for (const l of s) {
      console.log(`  · via ${l.provider}, expire le ${new Date(l.expires).toLocaleString("fr-FR")}`);
    }
  }
} catch (e) {
  console.log("Échec de la lecture.");
  console.log(`  ${sansChaineDeConnexion(e)}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
