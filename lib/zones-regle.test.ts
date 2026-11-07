/**
 * La règle de zone du site est celle du moteur, et ses listes sont celles de `reference/faits.py`.
 *
 * Trois choses sont vérifiées ici, parce que chacune peut se casser sans bruit :
 *
 *   1. `lib/zones.generees.ts` est exactement ce que `tools/generer_zones.py` produit aujourd'hui.
 *      Si `faits.py` change (une commune, un département, des points) sans régénération, ce test échoue
 *      et dit quelle commande lancer.
 *   2. Les cas de lieux du chantier zone (Saint-Denis de La Réunion, « Rive Gauche », Montpellier...)
 *      donnent la zone et les points attendus.
 *   3. Sur plusieurs centaines de lieux construits à partir des listes de `faits.py`, `zoneDe` et
 *      `scoreOffre` rendent exactement ce que `zone_de_lieu` et `location_score` rendent côté Python.
 *
 * Les points 1 et 3 exécutent Python (`tools/generer_zones.py`, `tools/zones_de_lieux.py`). Sans
 * Python sur la machine, ils ÉCHOUENT au lieu de se taire : un test sauté ne protège de rien.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ZONES, zoneDe, zonesReconnues } from "./eligibilite";
import { scoreOffre } from "./scoring";
import { POINTS_LIEU_AUTRE, ZONES_FAITS, ZONES_ORDRE } from "./zones.generees";

const racine = new URL("../", import.meta.url);
const decoder = (relatif: string) => fileURLToPath(new URL(relatif, racine));

/** Lance un script Python (python3, python, puis py), en UTF-8. Échoue si aucun Python ne répond. */
function python(script: string, args: string[] = [], entree?: string): string {
  const essais: string[] = [];
  for (const exe of ["python3", "python", "py"]) {
    const r = spawnSync(exe, [decoder(script), ...args], {
      input: entree,
      encoding: "utf8",
      env: { ...process.env, PYTHONUTF8: "1" },
      maxBuffer: 64 * 1024 * 1024,
    });
    if (r.error || r.status === null) {
      essais.push(`${exe} : introuvable`);
      continue;
    }
    if (r.status !== 0) {
      essais.push(`${exe} : code ${r.status} ${r.stderr.trim().split("\n").slice(-3).join(" | ")}`);
      continue;
    }
    return r.stdout;
  }
  throw new Error(`Python indisponible ou en échec pour ${script}.\n${essais.join("\n")}`);
}

describe("lib/zones.generees.ts suit reference/faits.py", () => {
  it("est exactement ce que tools/generer_zones.py produit", () => {
    const attendu = python("tools/generer_zones.py", ["--stdout"]);
    const actuel = readFileSync(decoder("lib/zones.generees.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(
      actuel,
      "lib/zones.generees.ts diverge de reference/faits.py : lancer `python3 tools/generer_zones.py`",
    ).toBe(attendu);
  });

  it("les cinq zones du site sont les quatre de faits.py, plus « autre »", () => {
    expect([...ZONES]).toEqual([...ZONES_ORDRE, "autre"]);
  });

  it("les points par zone sont ceux de faits.py : 15, 13, 13, 10, et 3 pour « autre »", () => {
    expect(ZONES_ORDRE.map((z) => ZONES_FAITS[z].points)).toEqual([15, 13, 13, 10]);
    expect(POINTS_LIEU_AUTRE).toBe(3);
  });
});

/** Les cas de lieux de `tools/test_collecteur_postgres.py` (ceux du diff d'étape B), avec leurs points. */
const CAS: [string | null, (typeof ZONES)[number], string][] = [
  ["Saint-Denis", "autre", "nom ambigu seul"],
  ["Saint Denis", "autre", "variante avec une espace"],
  ["Saint Ouen", "autre", "variante avec une espace"],
  ["93 - Saint-Denis", "idf", "confirmé par le département"],
  ["Saint-Denis 93200", "idf", "confirmé par le code postal"],
  ["Saint Denis 93200", "idf", "code postal, variante avec une espace"],
  ["Saint-Denis, Île-de-France", "idf", "confirmé par la région nommée"],
  ["Saint-Denis, La Réunion", "autre", "l'homonyme que la règle doit écarter"],
  ["Vitry-sur-Seine", "idf", "nom complet d'une commune d'Île-de-France"],
  ["Montigny-lès-Metz", "autre", "homonyme hors zone, non confirmé"],
  ["Toulouse", "toulouse", "commune de la zone toulousaine"],
  ["Toulouse (télétravail)", "toulouse", "la ville tranche, pas le mode de travail"],
  ["Montpellier, Occitanie", "occitanie", "la ville tranche, pas la région"],
  ["12 - Rodez", "occitanie", "département d'Occitanie"],
  ["Occitanie", "autre", "région seule : rien de certain"],
  ["Paris", "idf", "Paris"],
  ["Île-de-France", "idf", "la région seule vaut l'Île-de-France"],
  ["Télétravail", "remote", "mode de travail"],
  ["Rive Gauche", "autre", "« auch » n'est pas dans « Rive Gauche »"],
  ["Albigny", "autre", "« albi » n'est pas dans « Albigny »"],
  ["Lyon", "autre", "hors zone"],
  [null, "autre", "lieu absent"],
  ["", "autre", "lieu vide"],
  // Ordre toulouse, occitanie, idf, remote : le plus précis d'abord.
  ["Paris ou Toulouse", "toulouse", "deux zones : Toulouse l'emporte"],
  ["Paris ou Montpellier", "occitanie", "deux zones : l'Occitanie passe avant l'Île-de-France"],
  ["Paris, télétravail partiel", "idf", "une ville l'emporte sur le mode de travail"],
  // Les départements : France Travail écrit « 31 - COMMUNE », les codes postaux « 31000 ».
  ["31 - BLAGNAC", "toulouse", "département 31 au format France Travail"],
  ["34000", "occitanie", "code postal d'Hérault"],
  ["Stage 12 - 24 mois", "occitanie", "dans un lieu, « 12 - » désigne l'Aveyron (le titre, lui, n'est jamais lu)"],
  ["96000", "autre", "code postal d'un département hors zone"],
  ["Sète", "occitanie", "accent normalisé"],
  ["haute garonne", "toulouse", "tiret et espace sont équivalents"],
  ["Albi", "occitanie", "le mot entier, lui, compte"],
  ["Auch, Gers", "occitanie", "le mot entier, lui, compte"],
];

const points = (zone: string) => (zone === "autre" ? 3 : ZONES_FAITS[zone as (typeof ZONES_ORDRE)[number]].points);

describe("les cas de lieux du chantier zone", () => {
  for (const [lieu, attendu, pourquoi] of CAS) {
    it(`${JSON.stringify(lieu)} : ${attendu} (${pourquoi})`, () => {
      expect(zoneDe(lieu)).toBe(attendu);
      expect(scoreOffre({ location: lieu } as never).location_score).toBe(points(attendu));
    });
  }

  it("les points suivent la zone : 15, 13, 13, 10, et 3 sans zone", () => {
    const parLieu = (lieu: string) => scoreOffre({ location: lieu } as never).location_score;
    expect([parLieu("Toulouse"), parLieu("Montpellier"), parLieu("Paris"), parLieu("Télétravail"), parLieu("Lyon")]).toEqual([
      15, 13, 13, 10, 3,
    ]);
  });

  it("zonesReconnues liste les zones désignées, dans l'ordre de priorité", () => {
    expect(zonesReconnues("Paris ou Toulouse")).toEqual(["toulouse", "idf"]);
    expect(zonesReconnues("Toulouse, télétravail partiel")).toEqual(["toulouse", "remote"]);
    expect(zonesReconnues("Lyon")).toEqual([]);
    expect(zonesReconnues("Saint-Denis")).toEqual([]);
    expect(zonesReconnues("Saint-Denis 93200")).toEqual(["idf"]);
  });
});

/** Des lieux construits à partir de `faits.py` : chaque commune, département, région, sous toutes ses formes. */
function lieuxSynthetiques(): string[] {
  const lieux = new Set<string>();
  const ajouter = (...l: string[]) => l.forEach((x) => lieux.add(x));
  const codes = ["31", "09", "34", "75", "92", "93", "12", "69", "96", "00", "99"];
  const confirmations = ["", "93", "75 -", "93200", "Paris", "Île-de-France", "ile de france", "31000", "34"];
  for (const nom of ZONES_ORDRE) {
    const z = ZONES_FAITS[nom];
    for (const terme of [...z.villes, ...z.ambigus, ...z.regions_englobantes, ...z.region_propre]) {
      const espaces = terme.replace(/-/g, " ");
      const colle = terme.replace(/-/g, "");
      for (const forme of [terme, espaces, colle, terme.toUpperCase(), terme.replace(/^./, (c) => c.toUpperCase())]) {
        ajouter(forme, `${forme}s`, `x${forme}`, `${forme}x`, `${forme}, télétravail partiel`, `Paris ou ${forme}`);
        ajouter(`Stage ${forme}`, `${forme} (${forme})`);
        for (const c of confirmations) ajouter(`${forme} ${c}`.trim(), `${c} ${forme}`.trim(), `${c}, ${forme}`);
      }
    }
    for (const d of z.departements) {
      ajouter(d, `${d}000`, `${d}123`, `${d} - Commune`, `${d}- Commune`, `${d}-Commune`, `a${d}000`,
        `${d}0000`, `${d}000a`, `${d}000 Lyon`, `Stage ${d} - 24 mois`, `1${d}000`, `${d}00`);
    }
  }
  for (const c of codes) ajouter(`${c} - Lyon`, `${c}000 Lyon`, `${c}`, `${c}-Lyon`, `${c}123`);
  ajouter("", "   ", "Occitanie", "Île-de-France", "France", "Remote", "100% remote", "Full Remote",
    "Home office", "À distance", "a distance", "Lyon", "Bordeaux, Nouvelle-Aquitaine", "Rive Gauche",
    "Albigny", "Fauchon", "Saint-Denis, La Réunion", "Montigny-lès-Metz", "Vitry-le-François",
    "Ivry-la-Bataille", "Charenton-du-Cher", "Saint-Ouen-des-Champs", "Saint-Maur-sur-le-Loir",
    "Toulouse (Sur site)", "ÎLE DE FRANCE", "ile-de-france", "Paris 8e", "75008 Paris", "Paris-Saclay",
    "Œuvre", "ßtoulouse", "toulouseß", "toulouse²", "٣١٠٠٠", "31٠٠٠");
  return [...lieux];
}

describe("sur les lieux de faits.py et ceux de l'export, le portage rend ce que rend le moteur", () => {
  const exporte = JSON.parse(readFileSync(decoder("data/offers.json"), "utf8")).offers as { location: string | null }[];
  const lieux = [...new Set([...lieuxSynthetiques(), ...CAS.map((c) => c[0] ?? ""), ...exporte.map((o) => o.location ?? "")])];

  it("zone_de_lieu et location_score, un par un", () => {
    const python_ = JSON.parse(python("tools/zones_de_lieux.py", [], JSON.stringify(lieux))) as [string, number][];
    expect(python_).toHaveLength(lieux.length);
    const ecarts: string[] = [];
    lieux.forEach((lieu, i) => {
      const zone = zoneDe(lieu);
      const pts = scoreOffre({ location: lieu } as never).location_score;
      if (zone !== python_[i][0] || pts !== python_[i][1]) {
        ecarts.push(`${JSON.stringify(lieu)} : moteur ${python_[i][0]}/${python_[i][1]}, portage ${zone}/${pts}`);
      }
    });
    expect(ecarts, `${ecarts.length} désaccord(s) sur ${lieux.length} lieux`).toEqual([]);
    expect(lieux.length).toBeGreaterThan(500);
  });

  it("les lieux exercent chaque zone et chaque règle (sinon le zéro ne prouve rien)", () => {
    const parZone = new Map<string, number>();
    for (const l of lieux) parZone.set(zoneDe(l), (parZone.get(zoneDe(l)) ?? 0) + 1);
    for (const z of ZONES) expect(parZone.get(z) ?? 0, z).toBeGreaterThan(20);
    expect(lieux.filter((l) => zonesReconnues(l).length > 1).length).toBeGreaterThan(50);
  });
});
