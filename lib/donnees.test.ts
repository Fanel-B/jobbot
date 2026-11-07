/**
 * Le mode base, sans base : une fixture tient lieu de PostgreSQL, et aucun secret n'est lu.
 *
 * La fixture principale est le fichier lui-même, mis dans la forme que la table `offers` lui
 * donnerait (dates en texte façon `to_char`, aucune note, aucun champ dérivé). Relu par le mode
 * base, il doit redonner **les mêmes offres, notées pareil**. C'est la preuve que les deux modes
 * partagent la même normalisation, et que rien ne se perd dans la table.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { DUREE_CACHE_SECONDES, lireDonnees, sourceDemandee } from "./donnees";
import { REQUETE_COLLECTE, REQUETE_OFFRES, datePublication, type LigneBase, type Lecteur } from "./donnees-base";
import { meta as metaFichier, offers as offresFichier } from "./offers";

type OffreJson = Record<string, unknown> & { id: number };
const brut = JSON.parse(readFileSync(new URL("../data/offers.json", import.meta.url), "utf8")) as {
  meta: { generated_at: string };
  offers: OffreJson[];
};

/** Ce que PostgreSQL rendrait pour cette offre, après passage du collecteur. */
function enLigneDeBase(o: OffreJson): LigneBase {
  const horodatage = (v: unknown) =>
    v == null ? null : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? `${v} 00:00:00` : String(v);
  return {
    pipeline_id: String(o.id),
    source: o.source as string,
    source_offer_id: (o.source_offer_id as string) ?? null,
    canonical_url: o.canonical_url as string,
    title: (o.title as string) ?? null,
    company: (o.company as string) ?? null,
    location: (o.location as string) ?? null,
    location_zone: o.location_zone as string,
    contract_type: (o.contract_type as string) ?? null,
    contract_known: o.contract_known as boolean,
    duration: (o.duration as string) ?? null,
    start_date: (o.start_date as string) ?? null,
    education_required: (o.education_required as string) ?? null,
    description: (o.description as string) ?? null,
    skills_required: o.skills_required,
    skills_optional: o.skills_optional ?? [],
    published_at: horodatage(o.published_at),
    first_seen_at: horodatage(o.first_seen_at),
    last_seen_at: horodatage(o.last_seen_at),
    miage_mentioned: o.miage_mentioned as boolean,
  };
}

/** Un faux PostgreSQL : rend les lignes prévues selon la requête reçue. */
function fausseBase(offres: LigneBase[], collectes: { terminee_a: string }[]): Lecteur {
  return (async (sql: string) => {
    if (sql === REQUETE_OFFRES) return offres;
    if (sql === REQUETE_COLLECTE) return collectes;
    throw new Error(`requête inattendue : ${sql}`);
  }) as Lecteur;
}

const LIGNES = brut.offers.map(enLigneDeBase);
const COLLECTE = [{ terminee_a: brut.meta.generated_at }];

describe("le choix de la source", () => {
  it("lit le fichier par défaut", () => {
    expect(sourceDemandee({})).toBe("file");
    expect(sourceDemandee({ OFFERS_SOURCE: "" })).toBe("file");
    expect(sourceDemandee({ OFFERS_SOURCE: "DB" })).toBe("file");
    expect(sourceDemandee({ OFFERS_SOURCE: "db" })).toBe("db");
  });

  it("en mode fichier, ne touche jamais la base", async () => {
    const lecteur = vi.fn();
    const d = await lireDonnees("file", lecteur as unknown as Lecteur);
    expect(lecteur).not.toHaveBeenCalled();
    expect(d.offers).toBe(offresFichier);
    expect(d.meta).toEqual({ ...metaFichier, source: "file", repli: null });
  });

  it("met la base en cache quinze minutes", () => {
    expect(DUREE_CACHE_SECONDES).toBe(900);
    const source = readFileSync(new URL("./donnees.ts", import.meta.url), "utf8");
    expect(source).toMatch(/"use cache";\s*\n\s*cacheLife\(\{ revalidate: DUREE_CACHE_SECONDES \}\);/);
  });
});

describe("le mode base, sur le fichier mis en table", () => {
  it("redonne les mêmes offres, dans le même ordre, avec les mêmes notes", async () => {
    const d = await lireDonnees("db", fausseBase(LIGNES, COLLECTE));
    expect(d.meta.source).toBe("db");
    expect(d.meta.repli).toBeNull();
    expect(d.offers.map((o) => o.id)).toEqual(offresFichier.map((o) => o.id));

    for (const [i, o] of d.offers.entries()) {
      const f = offresFichier[i];
      // `skills_pipeline` est la couverture figée de l'export, que la base n'a pas (et que le
      // site n'affiche jamais). `note_date` est l'oracle de la date de début (le site recalcule le
      // même fait avec `dateDebutNonExploitable`, vérifié par `npm run verifier-eligibility`) : la
      // base ne le stocke pas non plus. Tout le reste doit être identique, champ par champ.
      const { skills_pipeline: _a, note_date: _n, ...attendu } = f as typeof f & { note_date?: unknown };
      const { skills_pipeline: _b, note_date: _m, ...obtenu } = o as typeof o & { note_date?: unknown };
      expect(obtenu, `offre #${o.id}`).toEqual(attendu);
    }
  });

  it("reconstitue meta, avec la date de la dernière copie", async () => {
    const d = await lireDonnees("db", fausseBase(LIGNES, COLLECTE));
    expect(d.meta).toEqual({ ...metaFichier, source: "db", repli: null });
  });

  it("change de version avec la collecte, et n'a pas celle du fichier", async () => {
    const a = await lireDonnees("db", fausseBase(LIGNES, COLLECTE));
    const b = await lireDonnees("db", fausseBase(LIGNES, [{ terminee_a: "2026-11-06T09:00:00+00:00" }]));
    expect(a.version).not.toBe(b.version);
    expect(a.version).not.toBe((await lireDonnees("file", null)).version);
  });

  it("note à l'heure de la copie : une copie plus tardive vieillit les annonces", async () => {
    const tot = await lireDonnees("db", fausseBase(LIGNES, COLLECTE));
    const tard = await lireDonnees("db", fausseBase(LIGNES, [{ terminee_a: "2026-12-25T17:41:17+00:00" }]));
    const fraicheur = (d: typeof tot) =>
      d.offers.reduce((s, o) => s + (o.score_breakdown?.find((l) => l.critere === "fraîcheur")?.points ?? 0), 0);
    expect(fraicheur(tard)).toBeLessThan(fraicheur(tot));
  });

  it("retire le « 00:00:00 » que la colonne ajoute à une date de publication sans heure", () => {
    expect(datePublication("2026-10-20 00:00:00")).toBe("2026-10-20");
    expect(datePublication("2026-10-20 13:05:10")).toBe("2026-10-20 13:05:10");
    expect(datePublication(null)).toBeNull();
  });

  it("ne lit que les offres qui ont un numéro de pipeline", () => {
    expect(REQUETE_OFFRES).toMatch(/where pipeline_id is not null/);
  });
});

describe("le repli sur le fichier", () => {
  it("base vide : le fichier, et meta le dit", async () => {
    const d = await lireDonnees("db", fausseBase([], COLLECTE));
    expect(d.offers).toBe(offresFichier);
    expect(d.meta.source).toBe("file");
    expect(d.meta.repli).toBe("base vide");
  });

  it("offres sans aucune collecte datée : le fichier, et meta le dit", async () => {
    const d = await lireDonnees("db", fausseBase(LIGNES, []));
    expect(d.meta.source).toBe("file");
    expect(d.meta.repli).toBe("aucune collecte datée");
  });

  it("base injoignable : le fichier, meta le dit, et le journal ne montre aucun secret", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => {});
    const panne = (async () => {
      throw new Error("connect ETIMEDOUT postgresql://fanel:motdepasse@ep-x-pooler.neon.tech/neondb");
    }) as Lecteur;
    const d = await lireDonnees("db", panne);
    expect(d.meta.source).toBe("file");
    expect(d.meta.repli).toBe("base injoignable");
    const ecrit = journal.mock.calls.flat().join(" ");
    expect(ecrit).toContain("ETIMEDOUT");
    expect(ecrit).not.toContain("motdepasse");
    expect(ecrit).not.toContain("ep-x-pooler");
    journal.mockRestore();
  });

  it("DATABASE_URL absente : le fichier, et meta le dit", async () => {
    const d = await lireDonnees("db", null);
    expect(d.meta.repli).toBe("DATABASE_URL absente");
  });

  it("un repli ne partage pas la version du fichier normal", async () => {
    const normal = await lireDonnees("file", null);
    const repli = await lireDonnees("db", fausseBase([], COLLECTE));
    expect(repli.version).not.toBe(normal.version);
  });
});
