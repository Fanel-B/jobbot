/**
 * Les quatre champs personnels du profil, et les trois états des zones (non renseigné, partout, une
 * liste). Données synthétiques ; les valeurs de Fanel sont comparées à celles du moteur Python.
 */
import { describe, expect, it } from "vitest";
import {
  COLONNES_PROFIL_T8,
  COOKIE_PROFIL_PERSONNEL,
  PROFIL_PERSONNEL_FANEL,
  PROFIL_PERSONNEL_VISITEUR,
  VERSION_COOKIE_PROFIL_PERSONNEL,
  decoderProfilPersonnel,
  encoderProfilPersonnel,
  estDateIso,
  estVisiteurVide,
  incoherencesProfilPersonnel,
  zonesDepuisAncienFormat,
  type ProfilPersonnel,
} from "./profil-personnel";
import { faitsDuMoteur } from "./python-pour-tests";

describe("le visiteur qui n'a rien dit : des champs nuls, aucune valeur inventée", () => {
  it("les quatre champs sont nuls", () => {
    expect(PROFIL_PERSONNEL_VISITEUR).toEqual({ debutAuPlusTot: null, finAuPlusTard: null, dureeMinMois: null, dureeMaxMois: null });
    expect(estVisiteurVide(PROFIL_PERSONNEL_VISITEUR)).toBe(true);
  });
  it("il n'hérite d'aucune valeur de Fanel", () => {
    for (const valeur of Object.values(PROFIL_PERSONNEL_VISITEUR)) expect(valeur).toBeNull();
    expect(estVisiteurVide(PROFIL_PERSONNEL_FANEL)).toBe(false);
  });
  it("un seul champ renseigné suffit à ne plus être vide", () => {
    expect(estVisiteurVide({ ...PROFIL_PERSONNEL_VISITEUR, dureeMaxMois: 5 })).toBe(false);
  });
  it("un cookie absent, vide ou illisible donne le visiteur vide, zones non renseignées", () => {
    for (const brut of [undefined, "", "pas du json", "[]", "null", "42"]) {
      expect(decoderProfilPersonnel(brut), String(brut)).toEqual({ personnel: PROFIL_PERSONNEL_VISITEUR, zones: null });
    }
  });
});

describe("les valeurs de Fanel sont celles du moteur (reference/faits.py)", () => {
  it("début, fin et durées de faits.STAGE", () => {
    const f = faitsDuMoteur();
    expect(PROFIL_PERSONNEL_FANEL).toEqual({
      debutAuPlusTot: f.debut_iso,
      finAuPlusTard: f.fin_max_iso,
      dureeMinMois: f.duree_min,
      dureeMaxMois: f.duree_max,
    });
  });
  it("le profil de Fanel est cohérent", () => {
    expect(incoherencesProfilPersonnel(PROFIL_PERSONNEL_FANEL)).toEqual([]);
  });
});

describe("estDateIso : une vraie date du calendrier", () => {
  it.each([["2027-03-29", true], ["2028-02-29", true], ["2027-12-31", true], ["2027-02-29", false], ["2027-02-30", false], ["2027-13-01", false], ["2027-00-10", false], ["2027-3-29", false], ["29/03/2027", false], ["", false], ["2027-03-29T10:00", false]])(
    "%j : %s",
    (valeur, attendu) => {
      expect(estDateIso(valeur)).toBe(attendu);
    },
  );
  it("refuse ce qui n'est pas une chaîne", () => {
    for (const v of [null, undefined, 20270329, new Date(), {}]) expect(estDateIso(v)).toBe(false);
  });
});

describe("incoherencesProfilPersonnel", () => {
  const profil = (p: Partial<ProfilPersonnel>): ProfilPersonnel => ({ ...PROFIL_PERSONNEL_VISITEUR, ...p });

  it("des champs nuls ne sont jamais une incohérence", () => {
    expect(incoherencesProfilPersonnel(PROFIL_PERSONNEL_VISITEUR)).toEqual([]);
    expect(incoherencesProfilPersonnel(profil({ debutAuPlusTot: "2027-03-29" }))).toEqual([]);
    expect(incoherencesProfilPersonnel(profil({ dureeMinMois: 3 }))).toEqual([]);
  });
  it("une date impossible", () => {
    expect(incoherencesProfilPersonnel(profil({ debutAuPlusTot: "2027-02-30" }))).toEqual(["début au plus tôt : date AAAA-MM-JJ attendue"]);
    expect(incoherencesProfilPersonnel(profil({ finAuPlusTard: "bientôt" }))).toEqual(["fin au plus tard : date AAAA-MM-JJ attendue"]);
  });
  it("une durée nulle, négative ou infinie", () => {
    for (const mauvaise of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(incoherencesProfilPersonnel(profil({ dureeMinMois: mauvaise })), `min ${mauvaise}`).toEqual([
        "durée minimale : nombre de mois strictement positif attendu",
      ]);
      expect(incoherencesProfilPersonnel(profil({ dureeMaxMois: mauvaise })), `max ${mauvaise}`).toEqual([
        "durée maximale : nombre de mois strictement positif attendu",
      ]);
    }
  });
  it("la fin avant le début", () => {
    expect(incoherencesProfilPersonnel(profil({ debutAuPlusTot: "2027-07-31", finAuPlusTard: "2027-03-29" }))).toEqual([
      "la fin au plus tard précède le début au plus tôt",
    ]);
  });
  it("la même date pour le début et la fin est permise", () => {
    expect(incoherencesProfilPersonnel(profil({ debutAuPlusTot: "2027-03-29", finAuPlusTard: "2027-03-29" }))).toEqual([]);
  });
  it("la durée minimale au-dessus de la maximale, et l'égalité permise", () => {
    expect(incoherencesProfilPersonnel(profil({ dureeMinMois: 6, dureeMaxMois: 4 }))).toEqual(["la durée minimale dépasse la durée maximale"]);
    expect(incoherencesProfilPersonnel(profil({ dureeMinMois: 4, dureeMaxMois: 4 }))).toEqual([]);
  });
});

describe("zonesDepuisAncienFormat : le sens actuel d'une liste vide est conservé", () => {
  it("liste vide : partout", () => {
    expect(zonesDepuisAncienFormat([])).toBe("partout");
  });
  it("une liste reste une liste, sans doublon, sans zone inconnue", () => {
    expect(zonesDepuisAncienFormat(["toulouse"])).toEqual(["toulouse"]);
    expect(zonesDepuisAncienFormat(["toulouse", "idf", "toulouse", "mars"])).toEqual(["toulouse", "idf"]);
  });
  it("une liste sans aucune zone reconnue n'est pas « partout » : elle est non renseignée", () => {
    expect(zonesDepuisAncienFormat(["mars", "lune"])).toBeNull();
  });
});

describe("le cookie versionné", () => {
  it("est lisible à l'œil et porte sa version", () => {
    const brut = encoderProfilPersonnel(PROFIL_PERSONNEL_FANEL, ["toulouse"]);
    expect(JSON.parse(brut)).toEqual({ v: VERSION_COOKIE_PROFIL_PERSONNEL, d: "2027-03-29", f: "2027-07-31", m: 3.5, M: 5, z: ["toulouse"] });
    expect(COOKIE_PROFIL_PERSONNEL).not.toBe("jobbot_profil");
  });
  it("aller-retour : un profil renseigné", () => {
    const zones = ["toulouse", "occitanie"] as const;
    const lu = decoderProfilPersonnel(encoderProfilPersonnel(PROFIL_PERSONNEL_FANEL, [...zones]));
    expect(lu).toEqual({ personnel: PROFIL_PERSONNEL_FANEL, zones: ["toulouse", "occitanie"] });
  });
  it("aller-retour : les trois états des zones restent distincts", () => {
    const etats = [null, "partout", ["idf"]] as const;
    const lus = etats.map((z) => decoderProfilPersonnel(encoderProfilPersonnel(PROFIL_PERSONNEL_VISITEUR, z as never)).zones);
    expect(lus).toEqual([null, "partout", ["idf"]]);
    expect(lus[0]).not.toBe(lus[1]);
  });
  it("aller-retour : un visiteur vide reste vide, sans zone", () => {
    expect(decoderProfilPersonnel(encoderProfilPersonnel(PROFIL_PERSONNEL_VISITEUR, null))).toEqual({
      personnel: PROFIL_PERSONNEL_VISITEUR,
      zones: null,
    });
  });
  it("une autre version est ignorée : jamais de valeur devinée", () => {
    const brut = JSON.stringify({ v: 2, d: "2027-03-29", f: "2027-07-31", m: 3.5, M: 5, z: "partout" });
    expect(decoderProfilPersonnel(brut)).toEqual({ personnel: PROFIL_PERSONNEL_VISITEUR, zones: null });
    expect(decoderProfilPersonnel(JSON.stringify({ d: "2027-03-29" }))).toEqual({ personnel: PROFIL_PERSONNEL_VISITEUR, zones: null });
  });
  it("chaque champ invalide devient nul, sans toucher aux autres", () => {
    const brut = JSON.stringify({ v: 1, d: "2027-02-30", f: "2027-07-31", m: -3, M: 5, z: ["toulouse"] });
    expect(decoderProfilPersonnel(brut)).toEqual({
      personnel: { debutAuPlusTot: null, finAuPlusTard: "2027-07-31", dureeMinMois: null, dureeMaxMois: 5 },
      zones: ["toulouse"],
    });
  });
  it("des types inattendus sont écartés", () => {
    const brut = JSON.stringify({ v: 1, d: 20270329, f: ["2027-07-31"], m: "3.5", M: null, z: 7 });
    expect(decoderProfilPersonnel(brut)).toEqual({ personnel: PROFIL_PERSONNEL_VISITEUR, zones: null });
  });
  it("des zones inconnues sont écartées ; sans aucune zone reconnue, zones non renseignées", () => {
    expect(decoderProfilPersonnel(JSON.stringify({ v: 1, z: ["toulouse", "mars", "toulouse"] })).zones).toEqual(["toulouse"]);
    expect(decoderProfilPersonnel(JSON.stringify({ v: 1, z: ["mars"] })).zones).toBeNull();
    expect(decoderProfilPersonnel(JSON.stringify({ v: 1, z: [] })).zones).toBeNull();
  });
  it("un champ incohérent avec un autre est conservé tel quel (le signalement est à part)", () => {
    const brut = JSON.stringify({ v: 1, d: "2027-07-31", f: "2027-03-29" });
    const { personnel } = decoderProfilPersonnel(brut);
    expect(personnel.debutAuPlusTot).toBe("2027-07-31");
    expect(incoherencesProfilPersonnel(personnel)).toEqual(["la fin au plus tard précède le début au plus tôt"]);
  });
});

describe("les colonnes de la migration t8 pour le profil", () => {
  it("sont quatre, sans available_from qui existe déjà", () => {
    expect([...COLONNES_PROFIL_T8]).toEqual(["available_until", "duration_min_months", "duration_max_months", "zones_mode"]);
  });
});
