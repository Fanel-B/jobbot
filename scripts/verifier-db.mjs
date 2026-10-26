/**
 * `npm run verifier-db` : la base Neon est-elle joignable, et le schéma appliqué ?
 *
 * Lecture seule — aucune écriture, aucune migration. Affiche les six tables attendues, celles qui
 * manquent, et le nombre d'offres. Rien d'autre ne peut être conclu sans se connecter, donc cette
 * commande est le premier contrôle à passer après avoir posé `DATABASE_URL`.
 *
 * La chaîne de connexion n'est jamais affichée, pas même dans un message d'erreur : `pg` l'inclut
 * parfois dans les siens, et elle est masquée avant impression.
 */
import { readFileSync } from "node:fs";
import { TABLES_ATTENDUES, baseConfiguree, etatDeLaBase } from "../lib/db.ts";

// Next lit `.env.local` tout seul ; un script Node, non. On le charge à la main, sans dépendance.
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

if (!baseConfiguree()) {
  console.log("DATABASE_URL absente — la base n'est pas encore branchée.");
  console.log("");
  console.log("  1. Récupère la chaîne POOLED depuis la console Neon (l'hôte contient « -pooler »).");
  console.log("  2. Crée `.env.local` à la racine, sur le modèle de `.env.local.example`.");
  console.log("  3. Relance cette commande.");
  console.log("");
  console.log("Le site fonctionne sans : il lit data/offers.json.");
  process.exit(1);
}

const etat = await etatDeLaBase();

if (!etat.joignable) {
  console.log("Base injoignable.");
  console.log(`  ${etat.erreur}`);
  process.exit(1);
}

console.log("Base joignable.");
console.log("");
for (const t of TABLES_ATTENDUES) {
  console.log(`  ${etat.presentes.includes(t) ? "·" : "✗"} ${t}`);
}
console.log("");
if (etat.manquantes.length) {
  console.log(`${etat.manquantes.length} table(s) manquante(s) : le schéma n'a pas été appliqué.`);
  console.log("  Ouvre db/schema.sql, copie tout, et exécute-le dans l'éditeur SQL de Neon.");
  process.exit(1);
}

console.log(`Les six tables sont là. Offres en base : ${etat.offres}.`);
if (etat.offres === 0) {
  console.log("  Vide pour l'instant — c'est le collecteur Python qui la remplit (db/README.md).");
}
process.exit(0);
