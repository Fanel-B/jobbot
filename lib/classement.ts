/**
 * Le rang plutôt que le pourcentage, et les offres qu'on ne peut pas noter.
 *
 * Pourquoi ce fichier existe. Un profil à trois compétences obtient 18 points de correspondance
 * sur 42. C'est exact, et c'est le genre de chiffre qui fait fermer l'onglet. Pourtant la même
 * donnée, dite autrement, cesse de décourager sans mentir d'un iota : « 3e meilleure
 * correspondance sur 191 » décrit rigoureusement la même réalité. Un étudiant sait quoi faire
 * d'un rang. Il ne sait pas quoi faire d'un 18.
 *
 * Rien ici ne recalcule quoi que ce soit : on trie des totaux que le moteur a produits, et on
 * compte. Le classement est donc fidèle par construction au chiffre que
 * `npm run verifier-scoring` compare au Python.
 *
 * Le second sujet du fichier est plus gênant. Quatre-vingt-dix-neuf annonces sur deux cent
 * quatre-vingt-dix ne citent aucune technologie reconnaissable. Pour celles-là, la correspondance
 * avec un profil n'est pas faible : elle est **incalculable**. Leur donner des points par défaut
 * et les ranger dans le même classement revient à prétendre avoir vérifié ce qui ne l'est pas.
 * Elles sortent donc du classement principal, en le disant, et restent affichées. C'est le motif
 * que le site applique déjà aux contrats non renseignés.
 */
import { familleLacune, offers, type Offer } from "./offers";
import { enDeuxGroupes } from "./groupes";
import {
  classementPour,
  competencesSimulablesPour,
  effetGlobalPour,
  encoderProfil,
  manquantsPour,
  type Profil,
} from "./profil";
import type { Resultat } from "./scoring";

export type Rang = {
  /** Le rang parmi les offres notables, à partir de 1. */
  rang: number;
  /** Combien d'offres sont notables pour ce profil. Le dénominateur du rang. */
  sur: number;
};

/**
 * Cette offre peut-elle être mise en correspondance avec un profil ?
 *
 * Le critère est la présence d'au moins une technologie reconnue dans l'annonce. Sans exigence
 * détectée, le critère de cohérence n'a rien à comparer : il rend des points par défaut, qui
 * ressemblent à une mesure sans en être une.
 */
export function estNotable(r: Resultat | undefined): boolean {
  return Boolean(r && r.exigences.length > 0);
}

/**
 * La valeur sur laquelle on classe : les points personnels, pas le total.
 *
 * Classer sur le total serait refaire le défaut qu'on répare. Le total est à sept dixièmes la
 * qualité de l'annonce, donc un classement fondé sur lui annonce « 11e meilleure
 * correspondance » là où il faudrait lire « 11e meilleure annonce ». Les deux phrases ne disent
 * pas la même chose et une seule est vraie.
 *
 * Le total sert de départage. À correspondance égale, une annonce fraîche et complète passe
 * devant une annonce vieille et bavarde : c'est une vraie information, elle a sa place, mais
 * après la correspondance et jamais à sa place.
 */
export function correspondancePour(profil: Profil, id: number): number | null {
  const r = classementPour(profil).get(id);
  if (!estNotable(r)) return null;
  return enDeuxGroupes(r!.breakdown).toi.points;
}

const cacheRangs = new Map<string, Map<number, Rang>>();

/**
 * Le rang de chaque offre notable, pour ce profil.
 *
 * Les offres incalculables sont absentes de la table : elles n'ont pas de rang, et c'est le
 * point. Demander leur rang rend `null`, ce qui oblige l'appelant à traiter le cas au lieu de
 * l'ignorer.
 */
export function rangsPour(profil: Profil): Map<number, Rang> {
  const cle = encoderProfil(profil);
  const connu = cacheRangs.get(cle);
  if (connu) return connu;

  const classement = classementPour(profil);
  const notables = offers
    .map((o) => classement.get(o.id))
    .filter((r): r is Resultat => estNotable(r))
    // Correspondance d'abord, qualité de l'annonce ensuite, identifiant en dernier recours.
    // Le dernier critère n'a rien d'arbitraire : il rend le rang stable d'une requête à
    // l'autre, sinon la même offre changerait de place sans que rien n'ait bougé.
    .sort(
      (a, b) =>
        enDeuxGroupes(b.breakdown).toi.points - enDeuxGroupes(a.breakdown).toi.points ||
        b.total - a.total ||
        a.id - b.id,
    );

  const table = new Map<number, Rang>();
  notables.forEach((r, i) => table.set(r.id, { rang: i + 1, sur: notables.length }));
  cacheRangs.set(cle, table);
  return table;
}

/** Le rang d'une offre, ou `null` si elle n'est pas notable. */
export function rangDe(profil: Profil, id: number): Rang | null {
  return rangsPour(profil).get(id) ?? null;
}

/**
 * Sépare les offres en deux listes : celles qu'on peut mettre en correspondance, et les autres.
 *
 * L'ordre d'entrée est conservé dans chaque liste, pour que l'appelant reste maître du tri.
 */
export function separerNotables(
  profil: Profil,
  liste: Offer[],
): { notables: Offer[]; incalculables: Offer[] } {
  const classement = classementPour(profil);
  const notables: Offer[] = [];
  const incalculables: Offer[] = [];
  for (const o of liste) {
    (estNotable(classement.get(o.id)) ? notables : incalculables).push(o);
  }
  return { notables, incalculables };
}

/**
 * Le rang dit en toutes lettres, prêt à être lu.
 *
 * « 1re » et non « 1e » : c'est la forme correcte en français, et le site est lu par des
 * francophones qui la remarquent.
 */
export function rangEnLettres(r: Rang): string {
  const ordinal = r.rang === 1 ? "1re" : `${r.rang}e`;
  return `${ordinal} sur ${r.sur}`;
}

/**
 * Dans quelle tranche se situe ce rang ?
 *
 * Sert à dire « dans le premier dixième » plutôt qu'un rang nu quand le rang seul ne parle pas.
 * Rend `null` au-delà de la moitié : annoncer « dans les 80 % du bas » ne rend service à
 * personne et ne serait qu'une façon polie de décourager.
 */
export function tranchePour(r: Rang): string | null {
  const part = r.rang / r.sur;
  if (part <= 0.05) return "dans les 5 % les mieux placées";
  if (part <= 0.1) return "dans les 10 % les mieux placées";
  if (part <= 0.25) return "dans le premier quart";
  if (part <= 0.5) return "dans la première moitié";
  return null;
}

/* ------------------------------------------------- l'observation du relevé */

/**
 * Ce qu'un professeur écrirait dans la marge.
 *
 * C'est la pièce qui rend une note basse supportable sans la farder. Un relevé scolaire n'a
 * jamais montré qu'un chiffre : il porte une appréciation et une observation, et « 8 sur 20,
 * travailler les intégrales » ne se vit pas comme « 8 sur 20 » tout seul. La différence n'est
 * pas le ton, c'est que la seconde phrase dit quoi faire.
 *
 * Tout ici vient de données réelles : les exigences que l'annonce cite et que le profil ne
 * couvre pas, et l'effet mesuré d'ajouter la compétence correspondante sur toute la collecte.
 * Aucune phrase n'est produite quand il n'y a rien de vrai à dire.
 */
export type Observation = {
  /** Les exigences de cette annonce que le profil ne couvre pas, les plus parlantes d'abord. */
  manquants: string[];
  /** Le levier le plus rentable, mesuré sur l'ensemble de la collecte. */
  levier: { label: string; montent: number; franchissent: number } | null;
};

export function observationPour(profil: Profil, id: number): Observation | null {
  const manquants = manquantsPour(profil, id);
  if (manquants.length === 0) return null;

  // Le levier se choisit sur l'ensemble de la collecte, pas sur cette seule offre : apprendre
  // une techno pour une annonce est un mauvais calcul, l'apprendre pour vingt en est un bon.
  const candidates = competencesSimulablesPour(profil, 12);
  const familles = new Set(manquants.map((m) => familleLacune(m)));
  const utile = candidates.filter((c) => familles.has(c.label));

  let levier: Observation["levier"] = null;
  for (const c of utile) {
    const e = effetGlobalPour(profil, c);
    if (e.montent === 0) continue;
    if (!levier || e.montent > levier.montent) {
      levier = { label: c.label, montent: e.montent, franchissent: e.franchissent };
    }
  }

  return { manquants: manquants.slice(0, 3), levier };
}
