/**
 * Le catalogue de compétences, rangé en familles que quelqu'un peut lire.
 *
 * `CATALOGUE` (lib/scoring.ts) est une liste plate de 75 entrées, dérivée du vocabulaire du
 * pipeline. Elle est parfaite pour noter une offre et illisible pour choisir : on ne demande pas
 * à quelqu'un qui arrive de parcourir 75 cases en se demandant lesquelles le concernent.
 *
 * Ce module ne change rien au calcul. Il n'ajoute aucune compétence, n'en retire aucune, et ne
 * renomme rien : il se contente de dire laquelle appartient à quelle famille. `lib/competences.test.ts`
 * vérifie que la partition est **exacte** — chaque entrée du catalogue dans une famille et une
 * seule, et aucune famille ne cite de compétence inexistante. Une compétence ajoutée au pipeline
 * sans être rangée ici fait échouer les tests plutôt que de disparaître silencieusement du
 * formulaire.
 *
 * `principales` / `variantes` : le vocabulaire contient des doublons de surface — « IA » et
 * « intelligence artificielle », « ML » et « machine learning », « IA générative » et sa forme
 * sans accent. Ce sont des entrées distinctes parce que les annonces écrivent les deux, et les
 * supprimer ferait rater des offres. Mais les aligner toutes au même niveau dans un formulaire
 * donne une liste qui a l'air mal rangée. Les principales s'affichent, les variantes se replient.
 */
import { CATALOGUE } from "./scoring";

export type Famille = {
  id: string;
  /** Le nom de la famille, court. */
  titre: string;
  /** La question posée à la personne. Au « tu », comme le reste du site. */
  question: string;
  /** Ce qui s'affiche d'emblée. */
  principales: string[];
  /** Les formes que les annonces emploient aussi, repliées derrière un bouton. */
  variantes: string[];
};

export const FAMILLES: Famille[] = [
  {
    id: "web",
    titre: "Web",
    question: "Tu construis des sites ou des applications web ?",
    principales: [
      "JavaScript",
      "TypeScript",
      "React",
      "Next.js",
      "Node.js",
      "HTML",
      "CSS",
      "Tailwind",
      "PHP",
      "API REST",
    ],
    variantes: ["Express", "REST", "API", "JSON", "JWT"],
  },
  {
    id: "donnees",
    titre: "Données",
    question: "Tu manipules des données, des tableaux, des rapports ?",
    principales: ["SQL", "Excel", "Power BI", "Pandas", "Tableau", "Qlik", "Spark", "ETL"],
    variantes: [
      "MySQL",
      "PostgreSQL",
      "SQLite",
      "Power Query",
      "DAX",
      "Matplotlib",
      "Talend",
      "Fabric",
      "Snowflake",
      "AWS Glue",
      "data visualisation",
    ],
  },
  {
    id: "ia",
    titre: "Intelligence artificielle",
    question: "Tu touches à l'IA, de près ou de loin ?",
    principales: [
      "IA",
      "IA générative",
      "LLM",
      "NLP",
      "machine learning",
      "deep learning",
      "data science",
    ],
    variantes: [
      "intelligence artificielle",
      "IA generative",
      "ML",
      "modèles de langage",
      "réseaux de neurones",
    ],
  },
  {
    id: "langages",
    titre: "Programmation",
    question: "Tu programmes en dehors du web ?",
    principales: ["Python", "Java", "Kotlin", "C++", "C#", ".NET", "VBA"],
    variantes: [],
  },
  {
    id: "infra",
    titre: "Infrastructure",
    question: "Tu déploies, tu administres, tu automatises ?",
    principales: ["Docker", "Kubernetes", "AWS", "Azure", "GCP", "Linux"],
    variantes: ["Bash", "PowerShell", "Jenkins", "Ansible", "Terraform"],
  },
  {
    id: "methode",
    titre: "Méthode et outils",
    question: "Tu travailles en équipe, avec des outils d'entreprise ?",
    principales: ["Git", "GitHub", "Scrum", "Agile", "tests unitaires", "SAP"],
    variantes: ["Vitest", "UML", "Power Platform", "SharePoint", "ServiceNow"],
  },
];

/** Toutes les compétences d'une famille, principales et variantes confondues. */
export function membresDe(f: Famille): string[] {
  return [...f.principales, ...f.variantes];
}

/** Toutes les compétences rangées, toutes familles confondues. */
export function competencesRangees(): string[] {
  return FAMILLES.flatMap(membresDe);
}

/** La famille d'une compétence, ou `null` si elle n'est rangée nulle part. */
export function familleDe(nom: string): Famille | null {
  return FAMILLES.find((f) => membresDe(f).includes(nom)) ?? null;
}

/**
 * Les compétences du catalogue qu'aucune famille ne revendique.
 *
 * Doit toujours être vide : c'est l'invariant que le test épingle. La fonction existe pour que
 * l'échec dise **lesquelles** manquent, plutôt qu'un simple « les comptes ne tombent pas juste ».
 */
export function competencesOrphelines(): string[] {
  const rangees = new Set(competencesRangees());
  return CATALOGUE.map((c) => c.nom).filter((n) => !rangees.has(n));
}

/** Les compétences citées par une famille mais absentes du catalogue — donc jamais notées. */
export function competencesFantomes(): string[] {
  const connues = new Set(CATALOGUE.map((c) => c.nom));
  return competencesRangees().filter((n) => !connues.has(n));
}
