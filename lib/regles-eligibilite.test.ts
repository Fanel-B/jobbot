/**
 * Les règles de durée, de rémunération et de contrat portées de `reference/eligibility.py`.
 *
 * Deux sortes de tests :
 *   1. des cas écrits à la main, avec la valeur attendue écrite en dur : ils disent ce que la règle
 *      FAIT, et échouent si quelqu'un la change sans le vouloir ;
 *   2. la comparaison au moteur Python (`tools/regles_eligibilite.py`) sur ces mêmes cas et sur
 *      plusieurs centaines de cas construits : le portage doit répondre comme le moteur, cas par cas.
 *
 * Les données sont toutes synthétiques : aucune offre réelle n'est lue ici.
 * Python est exécuté : sans lui, ces tests échouent, ils ne se taisent pas.
 */
import { describe, expect, it } from "vitest";
import {
  TERMES_CONTRAT_STAGE,
  contratInconnu,
  dureeDeLOffre,
  estNonRemuneree,
  estStage,
  lireContrat,
  parseDuree,
  termeContrat,
  type LectureContrat,
  type OffrePourContrat,
  type OffrePourDuree,
  type OffrePourRemuneration,
} from "./regles-eligibilite";
import { faitsDuMoteur, moteur } from "./python-pour-tests";

/* ------------------------------------------------------------ cas écrits à la main */

describe("parseDuree : la durée en mois", () => {
  const cas: [unknown, [number, number] | null][] = [
    ["6 mois", [6, 6]],
    ["1 an", [12, 12]],
    ["2 ans", [24, 24]],
    ["4 à 6 mois", [4, 6]],
    ["4-6 months", [4, 6]],
    ["4 to 6 months", [4, 6]],
    ["4 ou 6 mois", [4, 6]],
    ["3,5 mois", [3.5, 3.5]],
    ["3.5 months", [3.5, 3.5]],
    ["24 weeks", [24 * (12 / 52), 24 * (12 / 52)]],
    ["26 semaines", [26 * (12 / 52), 26 * (12 / 52)]],
    ["6", [6, 6]],
    ["6,5", [6.5, 6.5]],
    [6, [6, 6]],
    [4.5, [4.5, 4.5]],
    ["Stage de 6 mois renouvelable", [6, 6]],
    ["DURÉE : 6 MOIS", [6, 6]],
    ["2 années", [24, 24]],
    ["à définir", null],
    ["", null],
    [null, null],
    [undefined, null],
    ["plusieurs mois", null],
    ["mois", null],
  ];
  it.each(cas)("%j donne %j", (valeur, attendu) => {
    expect(parseDuree(valeur)).toEqual(attendu);
  });
});

describe("dureeDeLOffre : le champ, sinon les dates", () => {
  it("lit le champ duration en premier", () => {
    expect(dureeDeLOffre({ duration: "5 mois", start_date: "2027-03-29", end_date: "2027-09-01" })).toEqual({
      mois: [5, 5],
      origine: "champ",
    });
  });
  it("déduit la durée des dates, fin incluse, arrondie à une décimale", () => {
    // 29 mars au 31 juillet 2027 : 125 jours, plus un, divisé par 30,44 : 4,1 mois.
    expect(dureeDeLOffre({ start_date: "2027-03-29", end_date: "2027-07-31" })).toEqual({ mois: [4.1, 4.1], origine: "dates" });
  });
  it("un mois entier : du 1er mars au 31 août 2027, six mois", () => {
    expect(dureeDeLOffre({ start_date: "2027-03-01", end_date: "2027-08-31" })).toEqual({ mois: [6, 6], origine: "dates" });
  });
  it("une fin qui ne suit pas le début ne donne aucune durée", () => {
    expect(dureeDeLOffre({ start_date: "2027-03-29", end_date: "2027-03-29" })).toBeNull();
    expect(dureeDeLOffre({ start_date: "2027-04-01", end_date: "2027-03-01" })).toBeNull();
  });
  it("un champ illisible puis des dates absentes : aucune durée", () => {
    expect(dureeDeLOffre({ duration: "à définir" })).toBeNull();
    expect(dureeDeLOffre({})).toBeNull();
    expect(dureeDeLOffre({ start_date: "2027-03-29" })).toBeNull();
  });
  it("une date impossible est illisible, pas une erreur", () => {
    expect(dureeDeLOffre({ start_date: "2027-02-30", end_date: "2027-07-31" })).toBeNull();
  });
});

describe("estNonRemuneree : seulement quand l'offre le dit", () => {
  const dit: [string, OffrePourRemuneration][] = [
    ["stage non rémunéré", { description: "Ce stage est non rémunéré." }],
    ["non-rémunéré avec trait d'union", { description: "Stage non-rémunéré" }],
    ["non gratifié", { description: "Stage non gratifié" }],
    ["sans gratification", { description: "Stage sans gratification" }],
    ["sans rémunération", { description: "Poste sans rémunération" }],
    ["pas de gratification", { description: "pas de gratification prévue" }],
    ["pas de rémunération", { description: "pas de rémunération" }],
    ["unpaid", { title: "Unpaid internship" }],
    ["bénévole", { description: "Mission bénévole" }],
    ["dans le champ remuneration", { remuneration: "non rémunéré" }],
    ["dans le champ salary", { salary: "unpaid" }],
    ["dans le titre", { title: "Stage bénévole" }],
    ["majuscules et accents", { description: "NON RÉMUNÉRÉ" }],
    // Seul le DÉBUT de mot compte pour « bénévol » : « bénévolement » est lu comme une négation.
    ["début de mot seulement", { description: "bénévolement" }],
  ];
  it.each(dit)("%s : vrai", (_nom, offre) => {
    expect(estNonRemuneree(offre)).toBe(true);
  });

  const ne_dit_pas: [string, OffrePourRemuneration][] = [
    ["offre rémunérée", { description: "Gratification de 600 euros par mois" }],
    ["aucune information", {}],
    ["champs vides", { remuneration: "", salary: null, description: "", title: "" }],
    ["rémunération mentionnée sans négation", { description: "rémunération selon la grille légale" }],
    ["« unpaid » collé à une lettre : mot entier exigé à la fin", { description: "unpaidx" }],
    ["« unpaid » précédé d'une lettre : mot entier exigé au début", { description: "subunpaid" }],
    // « œ », « ß » et « л » ne se décomposent pas : ils restent dans le texte normalisé, et ce sont des
    // lettres pour Python. Un `` JavaScript les prendrait pour des frontières de mot.
    ["lettre non ASCII collée avant : « œunpaid »", { description: "œunpaid" }],
    ["lettre non ASCII collée après : « unpaidß »", { description: "unpaidß" }],
    ["lettre cyrillique collée : « лbenevole »", { description: "лbenevole" }],
  ];
  it.each(ne_dit_pas)("%s : faux", (_nom, offre) => {
    expect(estNonRemuneree(offre)).toBe(false);
  });
});

describe("lireContrat : le champ fait foi, puis le titre, puis la description", () => {
  const cas: [string, OffrePourContrat, LectureContrat][] = [
    ["champ déclaré compatible", { contract_type: "Stage" }, { genre: "declare" }],
    ["champ « Stage ou alternance »", { contract_type: "Stage ou alternance" }, { genre: "declare" }],
    ["champ déclaré incompatible", { contract_type: "CDI" }, { genre: "incompatible", declare: "CDI" }],
    ["champ vide, stage dans le titre", { contract_type: "", title: "Stage développeur" }, { genre: "lu", champ: "title", terme: "stage" }],
    ["champ absent, stage dans le titre", { title: "Stagiaire data" }, { genre: "lu", champ: "title", terme: "stagiaire" }],
    [
      "champ vide, rien dans le titre, stage dans la description",
      { contract_type: " ", title: "Développeur", description: "Nous proposons un stage de six mois" },
      { genre: "lu", champ: "description", terme: "stage" },
    ],
    ["champ vide, rien nulle part", { title: "Développeur", description: "Poste à Toulouse" }, { genre: "inconnu" }],
    ["rien du tout", {}, { genre: "inconnu" }],
    ["un CDI dans le titre ne compte pas : le terme cherché est celui du stage", { title: "CDI développeur" }, { genre: "inconnu" }],
    ["un champ déclaré incompatible n'est pas corrigé par le titre", { contract_type: "CDI", title: "Stage" }, { genre: "incompatible", declare: "CDI" }],
    ["le titre passe avant la description", { title: "Internship data", description: "stage" }, { genre: "lu", champ: "title", terme: "internship" }],
    ["mot entier : « intern » n'est pas dans « international »", { title: "International business" }, { genre: "inconnu" }],
    ["lettre non ASCII collée : « œstage » n'est pas « stage »", { title: "œstage" }, { genre: "inconnu" }],
    ["lettre non ASCII collée après : « stageß »", { title: "stageß" }, { genre: "inconnu" }],
    ["« stagiaire » n'est pas « stage »", { title: "Cherche stagiaire" }, { genre: "lu", champ: "title", terme: "stagiaire" }],
  ];
  it.each(cas)("%s", (_nom, offre, attendu) => {
    expect(lireContrat(offre)).toEqual(attendu);
  });

  it("contratInconnu : faux si le stage est annoncé quelque part, ou si un contrat est déclaré", () => {
    expect(contratInconnu({ title: "Stage data" })).toBe(false);
    expect(contratInconnu({ contract_type: "CDI" })).toBe(false);
    expect(contratInconnu({ title: "Data", description: "Poste" })).toBe(true);
    expect(contratInconnu({})).toBe(true);
  });

  it("estStage : vrai seulement si un terme de stage est annoncé", () => {
    expect(estStage({ title: "Stage data" })).toBe(true);
    expect(estStage({ contract_type: "CDI" })).toBe(false);
    expect(estStage({ description: "internship" })).toBe(true);
    expect(estStage({})).toBe(false);
  });

  it("termeContrat rend le premier terme de la liste présent dans le texte", () => {
    expect(termeContrat(["stage", "stagiaire"], "stagiaire en stage")).toBe("stage");
    expect(termeContrat(["alternance"], "contrat d'apprentissage")).toBeNull();
  });
});

/* ------------------------------------------------ comparaison au moteur Python */

/** Un générateur pseudo-aléatoire déterministe : les cas construits sont les mêmes à chaque exécution. */
function aleatoire(graine: number) {
  let etat = graine >>> 0;
  return () => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0;
    return etat / 2 ** 32;
  };
}
const choisir = <T,>(rand: () => number, liste: readonly T[]): T => liste[Math.floor(rand() * liste.length)];

function valeursDeDuree(): unknown[] {
  const rand = aleatoire(20261109);
  const nombres = ["1", "2", "3", "3,5", "3.5", "4", "5", "6", "12", "18", "24", "0", "10,25"];
  const unites = ["mois", "month", "months", "an", "ans", "annee", "annees", "year", "years", "semaine", "semaines", "week", "weeks", "Mois", "ANS"];
  const lies = [" a ", "-", " - ", " to ", " ou ", " à ", "–"];
  const gabarits = [
    (n: string, u: string) => `${n} ${u}`,
    (n: string, u: string) => `${n}${u}`,
    (n: string, u: string) => `Durée : ${n} ${u} maximum`,
    (n: string, u: string) => `environ ${n} ${u}, renouvelable`,
  ];
  const cas: unknown[] = [null, "", "abc", "à définir", "mois", "1,", ",5", "4 à", 0, 6, 3.5, 12, 0.5, "6", "6,5", "  7  ", "Six mois"];
  for (let i = 0; i < 300; i++) {
    const u = choisir(rand, unites);
    if (rand() < 0.35) {
      cas.push(`${choisir(rand, nombres)}${choisir(rand, lies)}${choisir(rand, nombres)} ${u}`);
    } else {
      cas.push(choisir(rand, gabarits)(choisir(rand, nombres), u));
    }
  }
  return cas;
}

function offresDeDuree(): OffrePourDuree[] {
  const rand = aleatoire(7);
  const debuts = ["2027-03-29", "2027-04-01", "2027-02-30", "2027-03", "mars 2027", "01/04/2027", "asap", "", null, "n'importe quoi", "2027-09-01"];
  const fins = ["2027-07-31", "2027-08-31", "2027-03-29", "2027-01-01", "juillet 2027", "31/07/2027", "", null, "2027-13-01"];
  const durees = [null, "", "5 mois", "4 à 6 mois", "à définir", 6];
  const offres: OffrePourDuree[] = [];
  for (let i = 0; i < 200; i++) {
    offres.push({ duration: choisir(rand, durees), start_date: choisir(rand, debuts), end_date: choisir(rand, fins) });
  }
  // Toutes les durées de 1 jour à 800 jours depuis un début fixe : l'arrondi à une décimale doit coïncider.
  const base = Date.UTC(2027, 0, 1);
  for (let jours = 1; jours <= 800; jours++) {
    const fin = new Date(base + jours * 86_400_000).toISOString().slice(0, 10);
    offres.push({ start_date: "2027-01-01", end_date: fin });
  }
  return offres;
}

function offresDeRemuneration(): OffrePourRemuneration[] {
  const rand = aleatoire(11);
  const phrases = [
    "", "Stage non rémunéré", "stage non-rémunéré", "non gratifié", "NON GRATIFIÉ", "sans gratification", "sans rémunération",
    "sans remuneration", "pas de gratification", "pas de rémunération", "unpaid", "Unpaid internship", "bénévole", "bénévolat",
    "bénévolement", "gratification légale", "rémunération 700 euros", "non remunere", "non  rémunéré", "non\trémunéré",
    "sans  gratification", "pas de  gratification", "subunpaid", "unpaidly", "nonremunere", "un stage bénévole chez nous",
    "ÉCOLE", "œuvre bénévole", "über unpaid", "1unpaid", "_unpaid", "unpaid_", "unpaid1", "unpaid-é",
    "œunpaid", "unpaidœ", "ßunpaid", "unpaidß", "лunpaid", "unpaidл", "日本unpaid", "unpaid日本", "œnon remunere", "ønon-gratifie",
    "sans gratificationß", "pas de remunerationœ", "лbenevole", "œbenevole",
  ];
  const offres: OffrePourRemuneration[] = [];
  for (let i = 0; i < 400; i++) {
    offres.push({
      remuneration: rand() < 0.4 ? choisir(rand, phrases) : null,
      salary: rand() < 0.3 ? choisir(rand, phrases) : undefined,
      description: rand() < 0.6 ? `Texte ${choisir(rand, phrases)} suite ${choisir(rand, phrases)}` : "",
      title: rand() < 0.5 ? choisir(rand, phrases) : null,
    });
  }
  return [...phrases.map((p) => ({ description: p })), ...offres];
}

function offresDeContrat(): OffrePourContrat[] {
  const rand = aleatoire(23);
  const contrats = [undefined, null, "", " ", "Stage", "stage", "STAGE", "CDI", "CDD", "Alternance", "Stage ou alternance", "stage, alternance", "Internship", "Intern", "Stagiaire", "international", "intern-ship"];
  const textes = [undefined, null, "", "Développeur", "Stage de fin d'études", "STAGE", "Stagiaire data", "Internship in Toulouse", "intern", "international", "CDI immédiat", "Un stage, ou un CDI", "stage-alternance", "stage_data", "stagiaires", "Poste de stagiaire (H/F)", "Offre n°stage", "œstage", "stageœ", "ßstagiaire", "stagiaireß", "лstage", "stage日本", "intern日本", "œintern"];
  const offres: OffrePourContrat[] = [];
  for (let i = 0; i < 600; i++) {
    offres.push({ contract_type: choisir(rand, contrats) as string, title: choisir(rand, textes) as string, description: choisir(rand, textes) as string });
  }
  return offres;
}

describe("le portage répond comme le moteur Python", () => {
  it("parse_duration, sur des cas écrits et construits", () => {
    const cas = [...valeursDeDuree(), "4 à 6 mois", "1 an", "24 weeks", "4-6 months"];
    const attendu = moteur<[number, number] | null>("parse_duration", cas);
    cas.forEach((valeur, i) => {
      expect(parseDuree(valeur), `parse_duration(${JSON.stringify(valeur)})`).toEqual(attendu[i]);
    });
    expect(cas.length).toBeGreaterThan(300);
  });

  it("offer_duration, y compris l'arrondi à une décimale sur 800 durées de dates", () => {
    const cas = offresDeDuree();
    const attendu = moteur<{ mois: [number, number]; origine: string } | null>("offer_duration", cas);
    cas.forEach((offre, i) => {
      expect(dureeDeLOffre(offre), `offer_duration(${JSON.stringify(offre)})`).toEqual(attendu[i]);
    });
    expect(cas.length).toBeGreaterThan(900);
  });

  it("is_unpaid", () => {
    const cas = offresDeRemuneration();
    const attendu = moteur<boolean>("is_unpaid", cas);
    cas.forEach((offre, i) => {
      expect(estNonRemuneree(offre), `is_unpaid(${JSON.stringify(offre)})`).toBe(attendu[i]);
    });
    expect(attendu.some(Boolean) && attendu.some((v) => !v)).toBe(true);
  });

  it("la lecture du contrat, contrat_inconnu et est_stage", () => {
    const cas = offresDeContrat();
    const lectures = moteur<{ genre: string; champ?: string; terme?: string }>("lecture_contrat", cas);
    const inconnus = moteur<boolean>("contrat_inconnu", cas);
    const stages = moteur<boolean>("est_stage", cas);
    cas.forEach((offre, i) => {
      const lecture = lireContrat(offre);
      const attendu = lectures[i];
      const vu: Record<string, string> = { genre: lecture.genre };
      if (lecture.genre === "lu") Object.assign(vu, { champ: lecture.champ, terme: lecture.terme });
      expect(vu, `lecture_contrat(${JSON.stringify(offre)})`).toEqual(attendu);
      expect(contratInconnu(offre), `contrat_inconnu(${JSON.stringify(offre)})`).toBe(inconnus[i]);
      expect(estStage(offre), `est_stage(${JSON.stringify(offre)})`).toBe(stages[i]);
    });
    // Les quatre genres de lecture sont tous exercés : un portage qui n'en voit qu'un ne passe pas.
    expect(new Set(lectures.map((l) => l.genre))).toEqual(new Set(["declare", "lu", "incompatible", "inconnu"]));
  });

  it("les termes du contrat de stage sont ceux du profil du moteur", () => {
    expect([...TERMES_CONTRAT_STAGE]).toEqual(faitsDuMoteur().termes);
  });
});
