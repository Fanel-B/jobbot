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
import { offers, type Offer } from "./offers";
import { classementPour, encoderProfil, type Profil } from "./profil";
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
    // À égalité de total, l'identifiant départage : le rang doit être stable d'une requête à
    // l'autre, sinon la même offre change de place sans que rien n'ait bougé.
    .sort((a, b) => b.total - a.total || a.id - b.id);

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
