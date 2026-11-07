/**
 * L'Occitanie dans le site : une seule liste de zones, et tout ce qui la déclare doit la citer.
 *
 * Le piège de ce chantier est le silence : une zone inconnue d'un composant ne fait pas d'erreur, elle
 * donne une puce vide, un filtre absent, un compteur oublié. Chaque test ici ferme l'un de ces trous.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ZoneChip } from "../components/Chips";
import { ZONES, ZONE_LABEL, compterZones, donneesFichier } from "./offers";
import { ZONES as ZONES_PURES } from "./eligibilite";
import { PROFIL_VIDE, decoderProfil, encoderProfil } from "./profil";

const lire = (chemin: string) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");

/** Les valeurs entre apostrophes d'une contrainte CHECK, dans l'ordre. */
function valeursDe(sql: string, contrainte: string): string[] {
  const m = new RegExp(`${contrainte}[\\s\\S]*?\\(([^;]*?)\\)(?:::text\\[\\])?[,;)]`).exec(sql);
  expect(m, `${contrainte} introuvable`).not.toBeNull();
  return [...m![1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
}

describe("la liste des zones", () => {
  it("compte cinq zones, l'Occitanie entre Toulouse et l'Île-de-France", () => {
    expect([...ZONES]).toEqual(["toulouse", "occitanie", "idf", "remote", "autre"]);
    expect(ZONES).toBe(ZONES_PURES);
  });

  it("chaque zone a un libellé", () => {
    for (const z of ZONES) expect(ZONE_LABEL[z], z).toBeTruthy();
    expect(ZONE_LABEL.occitanie).toBe("Occitanie");
  });
});

describe("le SQL cite exactement les mêmes zones", () => {
  const attendu = [...ZONES].sort();

  for (const fichier of ["db/schema.sql", "db/migration-t7-zones.sql"]) {
    it(`${fichier} : offers.location_zone`, () => {
      const vues = valeursDe(lire(fichier), "offers_location_zone_check\\s+CHECK");
      expect([...vues].sort()).toEqual(attendu);
    });
    it(`${fichier} : profiles.zones`, () => {
      const vues = valeursDe(lire(fichier), "profiles_zones_check\\s+CHECK");
      expect([...vues].sort()).toEqual(attendu);
    });
  }

  it("db/schema.sql : les contraintes du CREATE TABLE sont à jour aussi", () => {
    const sql = lire("db/schema.sql");
    expect(sql).toContain("CHECK (location_zone IN ('toulouse', 'occitanie', 'idf', 'remote', 'autre')),");
    expect(sql).toContain("CHECK (zones <@ ARRAY['toulouse', 'occitanie', 'idf', 'remote', 'autre']::text[]),");
  });

  it("la migration est rejouable : elle ne remplace que si « occitanie » manque", () => {
    const sql = lire("db/migration-t7-zones.sql");
    expect(sql.match(/LIKE '%occitanie%'/g)).toHaveLength(2);
    expect(sql).not.toMatch(/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b|DROP TABLE/i);
    expect(sql.trim()).toMatch(/^--[\s\S]*BEGIN;[\s\S]*COMMIT;$/);
  });
});

describe("le profil connaît l'Occitanie", () => {
  it("le décodeur du cookie la garde", () => {
    const p = decoderProfil(JSON.stringify({ c: [], z: ["occitanie", "toulouse"], n: "bac+3", r: [] }));
    expect(p.zones).toEqual(["occitanie", "toulouse"]);
  });

  it("une zone inconnue est toujours écartée", () => {
    const p = decoderProfil(JSON.stringify({ c: [], z: ["occitanie", "bretagne"], n: "bac+3", r: [] }));
    expect(p.zones).toEqual(["occitanie"]);
  });

  it("l'aller-retour du cookie est fidèle", () => {
    const p = { ...PROFIL_VIDE, zones: ["occitanie" as const] };
    expect(decoderProfil(encoderProfil(p)).zones).toEqual(["occitanie"]);
  });

  it("le formulaire et l'action partagent la liste commune", () => {
    expect(lire("app/profil/page.tsx")).toMatch(/import \{ ZONE_LABEL, ZONES \} from "@\/lib\/offers"/);
    expect(lire("app/profil/page.tsx")).not.toMatch(/const ZONES/);
    expect(lire("app/profil/actions.ts")).toMatch(/import \{ ZONES, type Zone \} from "@\/lib\/offers"/);
    expect(lire("app/profil/actions.ts")).not.toMatch(/const ZONES/);
  });
});

describe("l'affichage d'une offre d'Occitanie", () => {
  it("la puce n'est pas vide", () => {
    const html = renderToStaticMarkup(createElement(ZoneChip, { zone: "occitanie" }));
    expect(html).toContain("Occitanie");
    expect(html).not.toContain("undefined");
  });

  it("chaque zone donne une puce lisible", () => {
    for (const z of ZONES) {
      const html = renderToStaticMarkup(createElement(ZoneChip, { zone: z }));
      expect(html, z).not.toContain("undefined");
      expect(html.replace(/<[^>]+>/g, "").length, z).toBeGreaterThan(2);
    }
  });

  it("la liste d'offres propose un filtre par zone de la liste commune", () => {
    const page = lire("app/offres/page.tsx");
    expect(page).toMatch(/ZONES\.map\(\(z\) =>/);
    expect(page).not.toMatch(/const ZONES/);
  });
});

describe("les compteurs par zone", () => {
  it("comptent l'Occitanie, et la somme redonne la collecte", () => {
    const d = donneesFichier();
    const offres = [
      ...d.offers.slice(0, 3).map((o) => ({ ...o, location_zone: "occitanie" as const })),
      ...d.offers.slice(3),
    ];
    const zones = compterZones(offres);
    expect(zones.occitanie).toBe(3);
    expect(Object.values(zones).reduce((a, b) => a + b, 0)).toBe(offres.length);
  });

  it("le fichier actuel ne contient aucune offre d'Occitanie, et meta le dit à zéro", () => {
    const d = donneesFichier();
    expect(d.meta.zones.occitanie).toBe(0);
    expect(Object.values(d.meta.zones).reduce((a, b) => a + b, 0)).toBe(d.offers.length);
  });
});
