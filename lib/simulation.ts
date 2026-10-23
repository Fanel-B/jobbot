/**
 * Le simulant : « et si j'apprenais TypeScript ? »
 *
 * Tout repose sur `lib/scoring.ts`, dont le portage est vérifié contre l'oracle du pipeline
 * (`npm run verifier-scoring`, zéro désaccord sur chaque offre). Simuler une compétence, c'est
 * rejouer ce même calcul avec une couverture d'exigences élargie — rien d'autre. Aucune table,
 * aucun appel d'IA, aucune donnée nouvelle.
 *
 * Ce qui bouge quand on ajoute une compétence :
 *   - le critère **cohérence** (30 points), le seul qui dépende de ce que l'offre exige ;
 *   - la **diversité** (14 points), parce que le plafond par entreprise se distribue selon l'ordre
 *     des notes — une note qui monte peut donc en déplacer une autre.
 * Les sept autres critères ne dépendent pas du profil et ne bougent jamais.
 */
import { familleLacune, meta, offers } from "./offers";
import {
  classer,
  maintenantDeLExport,
  ordreDuPipeline,
  type LigneBulletin,
  type Resultat,
} from "./scoring";

const MAINTENANT = maintenantDeLExport(meta.generated_at);

/**
 * En dessous de ce volume, annoncer « N offres passeraient au-dessus de 70 » n'a pas de sens
 * statistique — c'est le garde-fou du cahier de route, et il vaut mieux ne rien dire.
 */
export const VOLUME_MINIMAL = 50;

/** Seuil au-dessus duquel une offre est « une bonne piste ». Même valeur que la bande « bon ». */
export const SEUIL_BONNE_PISTE = 65;

/** Clé stable pour une combinaison : l'ordre de saisie ne doit pas produire deux classements. */
function cle(ajouts: readonly string[]): string {
  return [...new Set(ajouts.map((a) => a.toLowerCase().trim()).filter(Boolean))].sort().join("|");
}

// Un classement complet par combinaison. Le site est pré-rendu : ce cache évite de recalculer
// 230 offres pour chaque compétence proposée sur l'accueil.
const classements = new Map<string, Map<number, Resultat>>();

/** Le classement complet, avec ces compétences en plus. Sans ajout, c'est celui du pipeline. */
export function classementSimule(ajouts: readonly string[] = []): Map<number, Resultat> {
  const k = cle(ajouts);
  const connu = classements.get(k);
  if (connu) return connu;
  const calcule = new Map(
    classer(ordreDuPipeline(offers), MAINTENANT, new Map(), k ? k.split("|") : []).map((r) => [
      r.id,
      r,
    ]),
  );
  classements.set(k, calcule);
  return calcule;
}

/* ------------------------------------------------------- effet sur une offre */

export type LigneQuiBouge = { critere: string; avant: number; apres: number; max: number };

export type EffetOffre = {
  totalAvant: number;
  totalApres: number;
  bulletinApres: LigneBulletin[];
  /** Les lignes du bulletin dont les points changent, dans l'ordre du bulletin. */
  lignesQuiBougent: LigneQuiBouge[];
  /** Les exigences de l'offre encore manquantes après simulation. */
  manquantsApres: string[];
};

/**
 * Ce que ces compétences changent pour une offre donnée. Renvoie `null` si l'offre est inconnue.
 *
 * Le bulletin rendu est celui d'après : sa somme reste exactement la note affichée, comme l'exige
 * la règle 2. On ne bricole pas un total en ajoutant un delta à l'ancien.
 */
export function effetSurOffre(id: number, ajouts: readonly string[]): EffetOffre | null {
  const avant = classementSimule([]).get(id);
  const apres = classementSimule(ajouts).get(id);
  if (!avant || !apres) return null;

  const pointsAvant = new Map(avant.breakdown.map((l) => [l.critere, l.points]));
  const lignesQuiBougent: LigneQuiBouge[] = [];
  for (const ligne of apres.breakdown) {
    const p = pointsAvant.get(ligne.critere);
    if (p !== undefined && p !== ligne.points) {
      lignesQuiBougent.push({
        critere: ligne.critere,
        avant: p,
        apres: ligne.points,
        max: ligne.max,
      });
    }
  }

  return {
    totalAvant: avant.total,
    totalApres: apres.total,
    bulletinApres: apres.breakdown,
    lignesQuiBougent,
    manquantsApres: apres.manquants,
  };
}

/** Les exigences que cette offre demande et que le profil ne couvre pas aujourd'hui. */
export function manquantsDe(id: number): string[] {
  return classementSimule([]).get(id)?.manquants ?? [];
}

/* --------------------------------------------------------- effet d'ensemble */

export type EffetGlobal = {
  competence: string;
  /** Offres qui passent sous le seuil au-dessus de lui. */
  franchissent: number;
  /** Offres dont la note monte, franchissement ou non. */
  montent: number;
  /** Gain moyen sur les offres qui bougent, arrondi au point. */
  gainMoyen: number;
};

/**
 * Ce qu'une compétence changerait sur l'ensemble de la collecte.
 *
 * `formes` reçoit **toutes** les écritures de la compétence (« IA », « intelligence artificielle »,
 * « IA générative ») : les apprendre, c'est les couvrir toutes, et ne simuler qu'une forme
 * sous-estimerait l'effet.
 */
export function effetGlobal(
  competence: Competence,
  seuil: number = SEUIL_BONNE_PISTE,
): EffetGlobal {
  const avant = classementSimule([]);
  const apres = classementSimule(competence.formes);

  let franchissent = 0;
  let montent = 0;
  let gainTotal = 0;
  for (const [id, a] of avant) {
    const b = apres.get(id);
    if (!b) continue;
    if (b.total > a.total) {
      montent += 1;
      gainTotal += b.total - a.total;
    }
    if (a.total < seuil && b.total >= seuil) franchissent += 1;
  }

  return {
    competence: competence.label,
    franchissent,
    montent,
    gainMoyen: montent ? Math.round(gainTotal / montent) : 0,
  };
}

/** Une compétence à apprendre : son nom lisible, et toutes les formes que les annonces emploient. */
export type Competence = {
  /** Ce qu'on affiche : « IA / intelligence artificielle ». */
  label: string;
  /** Les formes réelles trouvées dans les annonces — c'est ce que le calcul sait reconnaître. */
  formes: string[];
  /** Nombre d'**offres** qui la demandent sans que le profil la couvre. */
  demandee: number;
};

/**
 * Les compétences manquantes les plus demandées par la collecte — celles qui valent la peine
 * d'être simulées. On compte des **offres**, pas des occurrences.
 *
 * Le regroupement par famille n'est pas cosmétique ici : « IA », « intelligence artificielle » et
 * « IA générative » sont une seule chose à apprendre. Les proposer séparément ferait croire à trois
 * leviers distincts, et chacun afficherait un gain presque identique — parce que c'est le même.
 */
export function competencesSimulables(max = 6): Competence[] {
  const parFamille = new Map<string, { offres: Set<number>; formes: Set<string> }>();
  for (const r of classementSimule([]).values()) {
    for (const m of r.manquants) {
      const nom = familleLacune(m);
      const entree = parFamille.get(nom) ?? { offres: new Set<number>(), formes: new Set<string>() };
      entree.offres.add(r.id);
      entree.formes.add(m);
      parFamille.set(nom, entree);
    }
  }
  return [...parFamille.entries()]
    .map(([label, f]) => ({ label, formes: [...f.formes], demandee: f.offres.size }))
    .sort((a, b) => b.demandee - a.demandee || a.label.localeCompare(b.label))
    .slice(0, max);
}

/** Combien d'offres sont aujourd'hui au-dessus du seuil — le point de départ du graphique. */
export function offresAuDessus(seuil: number = SEUIL_BONNE_PISTE): number {
  let n = 0;
  for (const r of classementSimule([]).values()) if (r.total >= seuil) n += 1;
  return n;
}

/** Y a-t-il assez d'offres pour qu'un comptage veuille dire quelque chose ? */
export function volumeSuffisant(): boolean {
  return offers.length >= VOLUME_MINIMAL;
}

/* ------------------------------------------------------------------- URL */

/** Les compétences simulées voyagent dans l'URL : `?simule=TypeScript,Docker`. Partageable. */
export function lireSimulation(brut: string | undefined): string[] {
  if (!brut) return [];
  return [...new Set(brut.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 8);
}

export function ecrireSimulation(ajouts: readonly string[]): string | undefined {
  const liste = [...new Set(ajouts.map((a) => a.trim()).filter(Boolean))];
  return liste.length ? liste.join(",") : undefined;
}
