/**
 * La migration T8 est écrite mais NON APPLIQUÉE. Ces tests lisent son texte et vérifient qu'elle
 * reste sûre à rejouer : que des ajouts, rien de destructif, tout nullable, tout gardé.
 *
 * Ils ne l'exécutent pas : aucune base n'est jointe. Son exécution réelle (deux passages sur une
 * base créée par `db/schema.sql`) a été faite à part, hors du dépôt, et le compte rendu le dit.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLONNES_PROFIL_T8 } from "./profil-personnel";

const lire = (chemin: string) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sql = lire("db/migration-t8.sql");
/** Le SQL sans ses commentaires (`-- ...` jusqu'à la fin de la ligne). */
const instructions = sql.replace(/--.*$/gm, "");

describe("db/migration-t8.sql", () => {
  it("se dit non appliquée et tient dans une seule transaction", () => {
    expect(sql).toContain("NON APPLIQUÉE");
    expect(instructions.match(/\bBEGIN;/g)).toHaveLength(1);
    expect(instructions.match(/\bCOMMIT;/g)).toHaveLength(1);
    expect(instructions.indexOf("BEGIN;")).toBeLessThan(instructions.indexOf("COMMIT;"));
  });

  it("n'ajoute que des choses : rien de destructif, aucun changement de sens", () => {
    for (const interdit of [/\bDROP\b/i, /\bDELETE\b/i, /\bUPDATE\b/i, /\bTRUNCATE\b/i, /\bINSERT\b/i, /\bRENAME\b/i, /\bSET NOT NULL\b/i, /\bALTER COLUMN\b/i, /\bTYPE\b/i]) {
      expect(instructions, String(interdit)).not.toMatch(interdit);
    }
  });

  it("ne touche ni à score ni à location_zone", () => {
    expect(instructions).not.toMatch(/\bscore\b/i);
    expect(instructions).not.toMatch(/location_zone/);
  });

  it("chaque colonne est ajoutée avec IF NOT EXISTS, et nullable, sans valeur par défaut", () => {
    const ajouts = instructions.match(/ALTER TABLE \w+ ADD COLUMN[^;]*;/g) ?? [];
    expect(ajouts.length).toBeGreaterThanOrEqual(12);
    for (const a of ajouts) {
      expect(a, a).toContain("ADD COLUMN IF NOT EXISTS");
      expect(a, a).not.toMatch(/\bNOT NULL\b/i);
      expect(a, a).not.toMatch(/\bDEFAULT\b/i);
    }
  });

  it("chaque contrainte n'est créée que si elle est absente, sous son nom", () => {
    const noms = [...instructions.matchAll(/ADD CONSTRAINT (\w+)/g)].map((m) => m[1]);
    expect(noms.length).toBeGreaterThanOrEqual(9);
    expect(new Set(noms).size).toBe(noms.length);
    for (const nom of noms) {
      expect(instructions, nom).toContain(`conname = '${nom}'`);
    }
  });

  it("crée toutes les colonnes de profil que le code TypeScript annonce", () => {
    const profil = instructions.match(/ALTER TABLE profiles ADD COLUMN IF NOT EXISTS (\w+)/g) ?? [];
    const colonnes = profil.map((l) => l.split(" ").pop());
    expect(colonnes.sort()).toEqual([...COLONNES_PROFIL_T8].sort());
  });

  it("crée les colonnes d'offre du contrat d'export, provisoires", () => {
    const offres = (instructions.match(/ALTER TABLE offers ADD COLUMN IF NOT EXISTS (\w+)/g) ?? []).map((l) => l.split(" ").pop());
    expect(offres.sort()).toEqual(
      ["education_level", "education_source", "fermee", "fermee_le", "motif_rejet", "raisons_pipeline", "statut_pipeline", "texte_capture"].sort(),
    );
    expect(sql).toContain("TODO(QUESTION)");
  });

  it("n'est pas recopiée dans db/schema.sql, que scripts/appliquer-schema.mjs rejoue sur la base", () => {
    const schema = lire("db/schema.sql");
    for (const colonne of ["available_until", "zones_mode", "statut_pipeline", "education_level"]) {
      expect(schema, colonne).not.toContain(colonne);
    }
  });

  it("ne contient aucun tiret cadratin", () => {
    expect(sql).not.toContain(String.fromCharCode(0x2014));
  });
});
