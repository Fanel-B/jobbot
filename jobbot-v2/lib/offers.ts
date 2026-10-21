/**
 * Lecture des offres réelles exportées par le pipeline Hermes.
 *
 * Le site ne parle jamais à la base : il lit `data/offers.json`, produit par
 * `export_site.py`. Le fichier contient déjà le score **expliqué** et les
 * compétences couvertes / manquantes, calculés côté Python par le moteur qui
 * tourne en production.
 */
import raw from "@/data/offers.json";
import { classer, maintenantDeLExport, ordreDuPipeline } from "./scoring";

export type Breakdown = {
  critere: string;
  points: number;
  max: number;
  detail: string | null;
};

export type Skills = {
  required: string[];
  covered: string[];
  missing: string[];
};

export type Offer = {
  id: number;
  source: string;
  source_offer_id: string | null;
  canonical_url: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  location_zone: Zone;
  contract_type: string | null;
  contract_known: boolean;
  contract_kinds: string[] | null;
  duration: string | null;
  start_date: string | null;
  education_required: string | null;
  description: string | null;
  skills_required: string[];
  training_flag: boolean;
  training_excerpt: string | null;
  published_at: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  miage_mentioned: boolean;
  score: number | null;
  score_breakdown: Breakdown[] | null;
  score_reasons: string[] | null;
  skills: Skills | null;
};

export type Zone = "toulouse" | "idf" | "remote" | "autre";

export type Meta = {
  generated_at: string;
  count: number;
  sources: Record<string, number>;
  zones: Record<Zone, number>;
  sans_contrat_renseigne: number;
  score_profile: string;
  note: string;
};

type Payload = { meta: Meta; offers: Offer[] };

const data = raw as unknown as Payload;

export const meta: Meta = data.meta;

/**
 * La note affichée est recalculée par `lib/scoring.ts`, à l'heure du calcul du pipeline. Ce portage
 * est vérifié contre l'oracle (`npm run verifier-scoring` : zéro désaccord sur la note, les points et
 * les libellés) — c'est ce qui permettra plus tard de recalculer pour un autre profil.
 */
const recalcul = new Map(
  classer(ordreDuPipeline(data.offers), maintenantDeLExport(data.meta.generated_at)).map((r) => [r.id, r]),
);

export const offers: Offer[] = data.offers.map((o) => {
  const r = recalcul.get(o.id);
  if (!r) return o;
  return { ...o, score: r.total, score_breakdown: r.breakdown, score_reasons: r.raisons };
});

/* ---------------------------------------------------------------- libellés */

export const SOURCE_LABEL: Record<string, string> = {
  "sopra-steria": "Sopra Steria",
  airbus: "Airbus",
  thales: "Thales",
  sii: "Groupe SII",
  atos: "Atos",
  capgemini: "Capgemini",
  cnes: "CNES",
  linkedin: "LinkedIn",
  labonnealternance: "La Bonne Alternance",
  france_travail: "France Travail",
};

export const ZONE_LABEL: Record<Zone, string> = {
  toulouse: "Toulouse et alentours",
  idf: "Île-de-France",
  remote: "À distance",
  autre: "Ailleurs en France",
};

export function sourceLabel(slug: string): string {
  return SOURCE_LABEL[slug] ?? slug;
}

/** Ce que veut dire chaque critère du bulletin — affiché à côté de la note. */
export const CRITERE_LABEL: Record<string, string> = {
  cohérence: "Cohérence avec ton profil",
  metier: "Métier visé",
  métier: "Métier visé",
  source: "Qualité de la source",
  fiche: "Fiche complète",
  calendrier: "Calendrier compatible",
  dépôt: "Coût du dépôt",
  depot: "Coût du dépôt",
  dossier: "Dossier déjà prêt",
  diversité: "Diversité des candidatures",
  diversite: "Diversité des candidatures",
  fraîcheur: "Fraîcheur de l'offre",
  fraicheur: "Fraîcheur de l'offre",
};

export function critereLabel(c: string): string {
  return CRITERE_LABEL[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
}

/* ------------------------------------------------------------------- score */

export type Bande = "excellent" | "bon" | "moyen" | "faible";

export function bande(score: number | null): Bande {
  if (score === null) return "faible";
  if (score >= 80) return "excellent";
  if (score >= 65) return "bon";
  if (score >= 50) return "moyen";
  return "faible";
}

export const BANDE_TEXTE: Record<Bande, string> = {
  excellent: "Parmi tes meilleures correspondances",
  bon: "Correspondance solide",
  moyen: "Correspondance partielle",
  faible: "À regarder de près avant de postuler",
};

export const BANDE_CLASSE: Record<Bande, string> = {
  excellent: "bg-good-soft text-good border-good/30",
  bon: "bg-accent-soft text-accent-ink border-accent/30",
  moyen: "bg-warn-soft text-warn border-warn/30",
  faible: "bg-paper-deep text-muted border-line-strong",
};

/* -------------------------------------------------------------- fraîcheur */

export function joursDepuis(iso: string | null, reference: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const jours = Math.floor((reference.getTime() - t) / 86_400_000);
  return jours < 0 ? 0 : jours;
}

/**
 * Date de référence pour toute la fraîcheur affichée : l'heure de la **collecte**,
 * pas celle de l'affichage. Le site dit donc « vu il y a 2 jours à la collecte du 19 »,
 * ce qui reste vrai quel que soit le moment où la page est ouverte — et c'est
 * pré-rendable, donc la page ne dépend pas de l'horloge du visiteur.
 */
export const referenceCollecte = new Date(meta.generated_at);

/** Âge de l'offre, en clair. On ne devine jamais : sans date, on le dit. */
export function fraicheur(o: Offer, reference: Date = referenceCollecte): string {
  const jours = joursDepuis(o.published_at ?? o.first_seen_at, reference);
  if (jours === null) return "date non précisée";
  if (jours === 0) return "vue aujourd'hui";
  if (jours === 1) return "il y a 1 jour";
  if (jours < 30) return `il y a ${jours} jours`;
  const mois = Math.round(jours / 30);
  return `il y a ${mois} mois`;
}

export function ageJours(o: Offer, reference: Date = referenceCollecte): number | null {
  return joursDepuis(o.published_at ?? o.first_seen_at, reference);
}

export function dateCourte(iso: string | null): string {
  if (!iso) return "non précisée";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "non précisée";
  return new Date(t).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function dateHeure(iso: string | null): string {
  if (!iso) return "inconnue";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "inconnue";
  return new Date(t).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------- contrats */

/** « type non renseigné » est un état affiché comme tel, jamais maquillé en stage. */
export function contratLabel(o: Offer): string {
  if (!o.contract_known) return "Type de contrat non renseigné";
  const t = (o.contract_type ?? "").toLowerCase();
  if (t.includes("stage")) return "Stage";
  if (t.includes("alternance")) return "Alternance";
  if (t.includes("apprentissage")) return "Apprentissage";
  if (t.includes("professionnalisation")) return "Professionnalisation";
  return o.contract_type ?? "Type de contrat non renseigné";
}

export function estNonRenseigne(o: Offer): boolean {
  return !o.contract_known;
}

/* ------------------------------------------------- familles de contrat */

/**
 * Les quatre familles de contrat. Chaque offre appartient à **une et une seule** d'entre elles :
 * c'est cette propriété qui garantit qu'aucune annonce ne tombe entre deux filtres.
 */
export type FamilleContrat = "stage" | "alternance" | "autre" | "non-renseigne";

export const FAMILLES_CONTRAT: FamilleContrat[] = [
  "stage",
  "alternance",
  "autre",
  "non-renseigne",
];

/**
 * Normalise un type de contrat écrit en clair par la source.
 *
 * Les sources n'emploient pas un vocabulaire fermé : « Stage (d'après l'alerte) », « STAGE » et
 * « Contrat de professionnalisation » désignent ce qu'un lecteur range sous un seul type. On
 * retire donc les accents, la casse, la ponctuation et les précisions entre parenthèses.
 *
 * Le défaut que cette fonction corrige : `["stage (d'après l'alerte)"].includes("stage")` vaut
 * **faux**, parce que `includes` sur un tableau teste l'égalité exacte de l'élément et non une
 * sous-chaîne. Deux offres ne ressortaient donc dans aucun filtre de contrat.
 */
export function normaliserContrat(brut: string): string {
  return sansAccents(brut)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MOTS_STAGE = ["stage", "stages", "stagiaire", "stagiaires", "internship", "internships"];
const MOTS_ALTERNANCE = [
  "alternance",
  "alternances",
  "alternant",
  "alternante",
  "apprentissage",
  "apprentissages",
  "apprenti",
  "apprentie",
  "apprentis",
  "professionnalisation",
];

/** Comparaison **mot entier** : « stage » ne doit pas se reconnaître dans « stagerie ». */
function contientMot(texte: string, mots: string[]): boolean {
  return texte.split(" ").some((jeton) => jeton !== "" && mots.includes(jeton));
}

/**
 * La famille d'une offre. Sans type de contrat connu → « non-renseigne » ; sinon c'est le
 * vocabulaire de la source qui décide, et « autre » recueille ce qui est renseigné mais ne
 * rentre dans aucune des deux catégories du site.
 *
 * L'alternance l'emporte sur le stage quand une annonce cite les deux : c'est le type le plus
 * contraignant (rythme, durée, école), celui qu'il faut voir avant de postuler. Aucune offre de
 * l'export courant ne porte deux types ; la règle existe pour que le classement reste total.
 */
export function familleContrat(o: Offer): FamilleContrat {
  if (!o.contract_known) return "non-renseigne";
  const formes = [...(o.contract_kinds ?? []), o.contract_type ?? ""].map(normaliserContrat);
  if (formes.some((f) => contientMot(f, MOTS_ALTERNANCE))) return "alternance";
  if (formes.some((f) => contientMot(f, MOTS_STAGE))) return "stage";
  return "autre";
}

/** Filtre par famille. Une valeur absente, « tous » ou inconnue ne filtre rien. */
export function filtrerParContrat(offres: Offer[], type: string | undefined): Offer[] {
  const demande = (type ?? "").toLowerCase() as FamilleContrat;
  if (!FAMILLES_CONTRAT.includes(demande)) return offres;
  return offres.filter((o) => familleContrat(o) === demande);
}

/** Combien d'offres par famille — ce qui permet d'afficher le compte sur chaque filtre. */
export function compterFamilles(offres: Offer[]): Record<FamilleContrat, number> {
  const comptes: Record<FamilleContrat, number> = {
    stage: 0,
    alternance: 0,
    autre: 0,
    "non-renseigne": 0,
  };
  for (const o of offres) comptes[familleContrat(o)] += 1;
  return comptes;
}

/* ------------------------------------------- signal « formation imposée » */

/**
 * Le signal n'est affichable que s'il peut être **cité**. C'est la règle 5 du briefing : jamais
 * d'accusation sans l'extrait qui l'a déclenchée. Un drapeau levé sans extrait est un défaut de
 * collecte, pas une raison de mettre en cause une entreprise — on n'affiche alors rien.
 */
export function signalFormationCitable(o: Offer): boolean {
  return o.training_flag && (o.training_excerpt ?? "").trim().length > 0;
}

/** Combien d'annonces portent le signal, extrait à l'appui. Peut valoir zéro, et c'est un fait. */
export function nbSignalFormation(offres: Offer[]): number {
  return offres.filter(signalFormationCitable).length;
}

/* ------------------------------------------------------------- recherche */

export function parId(id: string): Offer | undefined {
  return offers.find((o) => String(o.id) === id);
}

/** Offres utilisables par défaut : type de contrat connu (les autres ont leur bloc). */
export const offresAvecContrat = offers.filter((o) => o.contract_known);
export const offresSansContrat = offers.filter((o) => !o.contract_known);

export function top(n: number): Offer[] {
  return [...offresAvecContrat]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, n);
}

/* --------------------------------------------------- lacunes du profil */

/** Minuscules sans accents : « IA générative » et « IA generative » sont la même compétence. */
export function sansAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Familles de compétences regroupées à l'affichage **uniquement** : les sources écrivent
 * « IA », « intelligence artificielle », « IA générative » ou « IA generative » pour ce que le
 * lecteur lit comme une seule chose. Sans ce regroupement, la liste « ce qui te manque » affichait
 * quatre lignes concurrentes pour la même famille — le contraire d'une information utile.
 *
 * Le regroupement est volontairement grossier et limité : on ne fusionne pas « machine learning »
 * avec « IA générative », ce ne sont pas les mêmes compétences.
 */
const FAMILLES_LACUNES: { motif: RegExp; nom: string }[] = [
  { motif: /^(ia|intelligence artificielle|ia generative|ia gen|genai)\b/, nom: "IA / intelligence artificielle" },
  { motif: /^(ml|machine learning|deep learning|apprentissage automatique)\b/, nom: "Machine learning" },
  { motif: /^(ci\/cd|integration continue|deploiement continu)\b/, nom: "CI/CD" },
  { motif: /^(bdd|base de donnees|bases de donnees|sql\/nosql)\b/, nom: "Bases de données" },
];

/**
 * La famille d'affichage d'une compétence manquante, ou la compétence elle-même si elle n'entre
 * dans aucune famille. Exporté pour que le simulant raisonne sur les mêmes regroupements que la
 * liste « ce qui te manque » : sans ça, « IA », « intelligence artificielle » et « IA générative »
 * se présenteraient comme trois compétences à apprendre séparément.
 */
export function familleLacune(brut: string): string {
  const norm = sansAccents(brut);
  return FAMILLES_LACUNES.find((f) => f.motif.test(norm))?.nom ?? brut;
}

/** Ce qui manque le plus souvent, regroupé par famille. `n` compte des **offres**. */
export function lacunesRegroupees(
  source: Offer[],
  max = 8,
): { label: string; n: number }[] {
  const familles = new Map<string, { label: string; offres: Set<number>; formes: Map<string, number> }>();

  for (const o of source) {
    for (const m of o.skills?.missing ?? []) {
      const norm = sansAccents(m);
      const nom = FAMILLES_LACUNES.find((f) => f.motif.test(norm))?.nom ?? m;
      const entree =
        familles.get(nom) ?? { label: nom, offres: new Set<number>(), formes: new Map<string, number>() };
      entree.offres.add(o.id);
      entree.formes.set(m, (entree.formes.get(m) ?? 0) + 1);
      familles.set(nom, entree);
    }
  }

  return [...familles.values()]
    .map((f) => ({ label: f.label, n: f.offres.size }))
    .filter((l) => l.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, max);
}
