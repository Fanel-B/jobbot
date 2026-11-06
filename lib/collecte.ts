/**
 * L'âge de la collecte elle-même, pas celui des annonces.
 *
 * Le site affiche « Dernière collecte : … » depuis toujours, mais rien ne prévenait quand cette
 * date s'éloignait : le 5 novembre, il servait encore la collecte du 25 octobre sans un mot. Une
 * copie est attendue toutes les heures ; au-delà d'une journée, c'est qu'elle s'est arrêtée, et
 * la personne qui lit doit le savoir avant de se fier à la fraîcheur des offres.
 *
 * Ces fonctions sont pures : l'heure courante leur est passée. Elle se lit dans un composant
 * rendu à la requête (`components/AgeCollecte.tsx`, après `connection()`), jamais au pré-rendu,
 * qui figerait l'âge au moment du build.
 */

/** Au-delà de ce délai, la collecte est signalée comme ancienne. */
export const SEUIL_COLLECTE_ANCIENNE_HEURES = 24;

/** Heures écoulées depuis la collecte, ou `null` si sa date est illisible. */
export function heuresDepuisCollecte(generatedAt: string, maintenant: number): number | null {
  const t = Date.parse(generatedAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (maintenant - t) / 3_600_000);
}

/** « il y a 30 heures », « il y a 12 jours ». */
export function depuisEnClair(heures: number): string {
  if (heures < 48) return `il y a ${Math.floor(heures)} heures`;
  return `il y a ${Math.floor(heures / 24)} jours`;
}

/** La mention à afficher, ou `null` tant que la collecte a moins de 24 heures. */
export function mentionCollecteAncienne(generatedAt: string, maintenant: number): string | null {
  const heures = heuresDepuisCollecte(generatedAt, maintenant);
  if (heures === null || heures <= SEUIL_COLLECTE_ANCIENNE_HEURES) return null;
  return `Ces offres ont plus de 24 heures : dernière collecte ${depuisEnClair(heures)}.`;
}
