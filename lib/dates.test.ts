/**
 * `parseDate` contre le vrai `parse_date` du pipeline, sur une table de chaînes.
 *
 * La table (`lib/dates.table.json`) est calculée par `tools/table_dates.py` avec le code de
 * `reference/eligibility.py` : chaque valeur attendue vient de Python, pas de ce que le TypeScript
 * devrait rendre. Le pipeline a aussi calculé sa propre table (`lib/dates.hermes.json`, 34 cas, avec
 * son `parse_date`) : elle est vérifiée à part, et les deux tables doivent dire la même chose.
 *
 * Depuis le diff final du 7 novembre 2026, une date impossible (« 2026-13-01 », « 31/02/2027 ») vaut
 * `None` côté Python : il n'y a plus de cas « ValueError ».
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dateDebutNonExploitable, dateLongue, parseDate } from "./dates";

type Ligne = { entree: string | null; attendu: string | null };
type LigneDuPipeline = { entree: string | null; sortie: string | null; type: "date" | "asap" | "illisible" };
const { table } = JSON.parse(
  readFileSync(new URL("./dates.table.json", import.meta.url), "utf8"),
) as { table: Ligne[] };

const { attendu: tablePipeline } = JSON.parse(
  readFileSync(new URL("./dates.hermes.json", import.meta.url), "utf8"),
) as { attendu: LigneDuPipeline[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("parseDate suit parse_date de Python, chaîne par chaîne", () => {
  it("la table est assez large pour dire quelque chose", () => {
    expect(table.length).toBeGreaterThan(100);
    const genres = new Set(table.map((l) => (l.attendu === null ? "null" : /^\d/.test(l.attendu) ? "date" : l.attendu)));
    expect(genres).toEqual(new Set(["date", "asap", "null"]));
  });

  it("aucune entrée ne vaut ValueError : une date impossible est illisible", () => {
    expect(table.filter((l) => l.attendu === "ValueError")).toEqual([]);
    for (const e of ["2026-13-01", "2027-02-30", "31/02/2027", "13/2027"]) {
      expect(table.find((l) => l.entree === e)?.attendu, e).toBeNull();
    }
  });

  for (const { entree, attendu } of table) {
    it(`${JSON.stringify(entree)} -> ${attendu}`, () => {
      const lue = parseDate(entree);
      if (attendu === "asap") expect(lue).toBe("asap");
      else if (attendu === null) expect(lue).toBeNull();
      else {
        expect(lue).toBeInstanceOf(Date);
        expect(iso(lue as Date)).toBe(attendu);
      }
    });
  }
});

describe("la table calculée par le pipeline lui-même", () => {
  it("elle compte 34 cas et couvre dates, asap, illisible et impossible", () => {
    expect(tablePipeline).toHaveLength(34);
    expect(new Set(tablePipeline.map((l) => l.type))).toEqual(new Set(["date", "asap", "illisible"]));
  });

  it("« as soon as possible » reste illisible (null), en toutes lettres anglaises", () => {
    const cas = tablePipeline.find((l) => l.entree === "as soon as possible");
    expect(cas).toMatchObject({ sortie: null, type: "illisible" });
    expect(parseDate("as soon as possible")).toBeNull();
    expect(dateDebutNonExploitable("as soon as possible")).toBe(true);
  });

  for (const { entree, sortie, type } of tablePipeline) {
    it(`${JSON.stringify(entree)} -> ${sortie}`, () => {
      const lue = parseDate(entree);
      if (type === "asap") expect(lue).toBe("asap");
      else if (type === "illisible") expect(lue).toBeNull();
      else expect(iso(lue as Date)).toBe(sortie);
      // Notre table (calculée avec le même code) doit dire la même chose que celle du pipeline.
      expect(table.find((l) => l.entree === entree)?.attendu).toBe(sortie);
    });
  }
});

describe("dateDebutNonExploitable", () => {
  it("absent, illisible, asap et impossible : la date n'est pas exploitable", () => {
    for (const v of [null, undefined, "", "   ", "à convenir", "asap", "dès que possible", "2026-13-01", "May 2027"]) {
      expect(dateDebutNonExploitable(v), String(v)).toBe(true);
    }
  });

  it("une date qui se lit est exploitable, y compris en toutes lettres", () => {
    for (const v of ["2027-03-29", "novembre 2027", "début novembre 2027", "5 juin 2027", "sept. 2027", "March 2027"]) {
      expect(dateDebutNonExploitable(v), v).toBe(false);
    }
  });

  it("la même décision que la table : exploitable si et seulement si Python rend une date", () => {
    for (const { entree, attendu } of table) {
      const date = attendu !== null && /^\d/.test(attendu);
      expect(dateDebutNonExploitable(entree), String(entree)).toBe(!date);
    }
  });
});

describe("dateLongue", () => {
  it("écrit la date en toutes lettres, comme /methode", () => {
    expect(dateLongue("2027-07-31")).toBe("31 juillet 2027");
    expect(dateLongue("2027-08-01")).toBe("1er août 2027");
    expect(dateLongue("2027-02-28")).toBe("28 février 2027");
  });

  it("refuse ce qui n'est pas une date ISO", () => {
    expect(() => dateLongue("31/07/2027")).toThrow();
  });
});
