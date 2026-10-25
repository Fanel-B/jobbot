/**
 * Tests du portage de l'éligibilité.
 *
 * POURQUOI CE FICHIER EXISTE, ALORS QUE `verifier-eligibility` PASSE DÉJÀ
 *
 * Le vérificateur compare le portage à l'oracle sur les 255 offres réelles, et sort à zéro
 * désaccord. Ça ne suffit pas. J'ai muté volontairement le portage de trois façons — inverser
 * l'ordre des zones, découper les contrats sur la virgule seulement, oublier la normalisation des
 * accents — et **les trois mutations passaient quand même**. Les données n'exercent simplement pas
 * ces règles : aucune offre n'a de `/` dans son type de contrat, aucune ne correspond à deux
 * motifs de zone, aucune ne déclenche le signal d'école.
 *
 * Un vérificateur vert sur des données qui ne testent rien reste un vérificateur vert. Ces tests
 * couvrent donc ce que l'oracle ne peut pas couvrir : l'ordre de priorité, les séparateurs, les
 * frontières de mot, et la normalisation. Les deux sont complémentaires — l'oracle prouve la
 * fidélité sur le réel, ceci prouve la règle.
 */
import { describe, expect, it } from "vitest";
import {
  contratConnu,
  contratsDe,
  normaliser,
  signalEcole,
  signalEcoleExporte,
  zoneDe,
} from "./eligibilite";

describe("la zone est une priorité, pas un ensemble", () => {
  it("Toulouse l'emporte sur Paris quand les deux sont cités", () => {
    expect(zoneDe("Toulouse / Paris")).toBe("toulouse");
    expect(zoneDe("Paris et Toulouse")).toBe("toulouse");
  });

  it("l'Île-de-France l'emporte sur le télétravail", () => {
    expect(zoneDe("Paris — télétravail partiel")).toBe("idf");
  });

  it("le télétravail ne gagne que si aucune ville n'est reconnue", () => {
    expect(zoneDe("Télétravail")).toBe("remote");
    expect(zoneDe("100 % remote")).toBe("remote");
    expect(zoneDe("Toulouse, télétravail partiel")).toBe("toulouse");
  });

  it("une ville inconnue tombe dans « autre », sans erreur", () => {
    expect(zoneDe("Lyon")).toBe("autre");
    expect(zoneDe("Bordeaux, Nouvelle-Aquitaine")).toBe("autre");
  });

  it("un lieu absent donne « autre » plutôt que de deviner", () => {
    // 21 offres de l'export sont dans ce cas. Chercher la ville dans le titre serait inventer.
    expect(zoneDe(null)).toBe("autre");
    expect(zoneDe(undefined)).toBe("autre");
    expect(zoneDe("")).toBe("autre");
  });
});

describe("les codes postaux et les libellés France Travail", () => {
  it("reconnaît la Haute-Garonne par son code postal", () => {
    expect(zoneDe("31000 Toulouse")).toBe("toulouse");
    expect(zoneDe("31700")).toBe("toulouse");
  });

  it("reconnaît le libellé « 31 - Commune »", () => {
    expect(zoneDe("31 - BLAGNAC")).toBe("toulouse");
    expect(zoneDe("31- Muret")).toBe("toulouse");
  });

  it("reconnaît les départements franciliens par leur code postal", () => {
    for (const cp of ["75012", "78180", "91400", "92100", "93200", "94000", "95300"]) {
      expect(zoneDe(cp), cp).toBe("idf");
    }
  });

  it("ne confond pas un code postal voisin avec l'Île-de-France", () => {
    expect(zoneDe("96000")).toBe("autre");
    expect(zoneDe("69000 Lyon")).toBe("autre");
  });

  it("ignore la casse et accepte les deux graphies d'« Île-de-France »", () => {
    expect(zoneDe("TOULOUSE")).toBe("toulouse");
    expect(zoneDe("Île-de-France")).toBe("idf");
    expect(zoneDe("ile-de-france")).toBe("idf");
    expect(zoneDe("Labège")).toBe("toulouse");
    expect(zoneDe("Labege")).toBe("toulouse");
  });
});

describe("le découpage des types de contrat", () => {
  it("découpe sur la virgule **et** sur le slash", () => {
    expect(contratsDe("Stage, Alternance")).toEqual(["stage", "alternance"]);
    expect(contratsDe("Stage / Alternance")).toEqual(["stage", "alternance"]);
    expect(contratsDe("Stage,Alternance/Apprentissage")).toEqual([
      "stage",
      "alternance",
      "apprentissage",
    ]);
  });

  it("retire les espaces de bord et passe en minuscules", () => {
    expect(contratsDe("  STAGE  ")).toEqual(["stage"]);
  });

  it("jette les morceaux vides au lieu de produire des entrées fantômes", () => {
    expect(contratsDe("Stage,,/ ")).toEqual(["stage"]);
    expect(contratsDe(",,")).toEqual([]);
    expect(contratsDe(null)).toEqual([]);
  });

  it("garde les parenthèses : « stage (d'après l'alerte) » est un type entier", () => {
    // C'est ce libellé qui avait rendu deux offres invisibles dans les filtres. Le découpage le
    // conserve tel quel ; c'est `familleContrat` qui le regroupe à l'affichage, pas ici.
    expect(contratsDe("Stage (d'après l'alerte)")).toEqual(["stage (d'après l'alerte)"]);
  });
});

describe("« le contrat est-il renseigné »", () => {
  it("est faux quand le champ est vide ou absent", () => {
    expect(contratConnu(null)).toBe(false);
    expect(contratConnu(undefined)).toBe(false);
    expect(contratConnu("")).toBe(false);
  });

  it("est vrai pour une chaîne d'espaces, comme en Python", () => {
    // `bool(" ")` vaut True. On reproduit le comportement de l'oracle plutôt que de le corriger :
    // un « mieux » ici se paierait en désaccords.
    expect(contratConnu(" ")).toBe(true);
  });
});

describe("le signal d'école partenaire", () => {
  it("travaille sur un texte normalisé, donc trouve malgré les accents", () => {
    expect(normaliser("École Partenaire")).toBe("ecole partenaire");
    expect(signalEcole({ description: "Intégration en École partenaire obligatoire" })).toBe(
      "ecole partenaire",
    );
  });

  it("cherche dans le titre, l'entreprise, la description et le niveau demandé", () => {
    expect(signalEcole({ title: "Alternance ISCOD" })).toBe("iscod");
    expect(signalEcole({ company: "PIGIER Performance" })).toBe("pigier");
    expect(signalEcole({ education_required: "Formation incluse dans le cursus" })).toBe(
      "formation incluse",
    );
  });

  it("exige un mot entier : « discodes » n'est pas « ISCOD »", () => {
    expect(signalEcole({ description: "nos discodes internes" })).toBeNull();
    expect(signalEcole({ description: "le service espace de l'entreprise" })).toBeNull();
  });

  it("renvoie le premier motif de la liste quand plusieurs correspondent", () => {
    // L'ordre décide quel motif sera cité à l'utilisateur : ce n'est pas un ensemble.
    expect(signalEcole({ description: "partenariat Pigier et ISCOD" })).toBe("iscod");
  });

  it("renvoie le texte trouvé, pas le motif — c'est lui qu'on cite", () => {
    const trouve = signalEcole({ description: "rejoindre notre centre de formation" });
    expect(trouve).toBe("notre centre de formation");
  });

  it("ne trouve rien dans une annonce ordinaire", () => {
    expect(
      signalEcole({
        title: "Stage Développeur Full Stack",
        company: "Airbus",
        description: "Vous rejoindrez une équipe de 6 personnes à Toulouse.",
      }),
    ).toBeNull();
  });
});

describe("ce que l'export écrit vraiment", () => {
  it("ne cherche le signal que si l'annonce a une description", () => {
    // Règle 5 : jamais d'accusation sans citation. Sans texte, il n'y a rien à citer — et
    // `export_site.ligne` ne lance même pas la recherche.
    expect(signalEcoleExporte({ title: "Alternance ISCOD", description: null })).toBeNull();
    expect(
      signalEcoleExporte({ title: "Alternance ISCOD", description: "Poste basé à Lille." }),
    ).toBe("iscod");
  });
});
