/**
 * Les chiffres que la page /methode annonce, calculés à partir du moteur et de l'export.
 *
 * Pourquoi un module et non des nombres écrits dans la page. Une page de méthode qui dit « 42
 * points » ou « 99 annonces » devient fausse le jour où le moteur ou l'export change, et
 * personne ne le voit : c'est de la prose, aucun test ne la lit. La page précédente l'avait déjà
 * appris, avec un « neuf critères » qui avait cessé d'être vrai sans bruit.
 *
 * Ici, tout se déduit des bulletins réellement calculés. `lib/methode.test.ts` épingle en plus
 * les quelques valeurs que le moteur garde en constantes privées et que la page cite (la date de
 * disponibilité, la fenêtre de fin de stage, le plafond administratif) : si elles changent dans
 * `lib/scoring.ts`, le test tombe et la page se relit.
 *
 * On calcule avec un profil vide, ce qui est sans conséquence : les maxima par critère ne
 * dépendent pas du profil, et le caractère calculable d'une annonce non plus (le test le
 * vérifie).
 */
import { CRITERES_CONSTANTS, groupeDe } from "./groupes";
import { separerNotables } from "./classement";
import { SEUIL_ANNONCE_AGEE, annonceAgee, referenceDe, type Donnees } from "./offers";
import { PROFIL_VIDE, classementPour } from "./profil";

export type LigneDeGroupe = { critere: string; max: number };

export type GroupeMethode = {
  /** Les critères qui rapportent des points, dans l'ordre où le moteur les produit. */
  criteres: LigneDeGroupe[];
  /** Les lignes sans barème, qui ajoutent ou retirent des points après coup. */
  ajustements: string[];
  /** La somme des barèmes du groupe. */
  max: number;
};

export type ChiffresMethode = {
  toi: GroupeMethode;
  annonce: GroupeMethode;
  /** Le barème total : somme des deux groupes. */
  total: number;
  /** Les critères qui rendent la même valeur sur toute la collecte, avec cette valeur. */
  constants: { critere: string; points: number; max: number }[];
  collecte: number;
  notables: number;
  incalculables: number;
  seuilAge: number;
  nbAgees: number;
};

export function chiffresMethode(d: Donnees): ChiffresMethode {
  const classement = classementPour(d, PROFIL_VIDE);

  // Chaque critère, dans l'ordre du premier bulletin qui le porte, avec son barème.
  const maxParCritere = new Map<string, number>();
  const valeurs = new Map<string, Set<number>>();
  for (const r of classement.values()) {
    for (const l of r.breakdown) {
      if (!maxParCritere.has(l.critere)) maxParCritere.set(l.critere, l.max);
      const vus = valeurs.get(l.critere) ?? new Set<number>();
      vus.add(l.points);
      valeurs.set(l.critere, vus);
    }
  }

  const vide = (): GroupeMethode => ({ criteres: [], ajustements: [], max: 0 });
  const toi = vide();
  const annonce = vide();
  for (const [critere, max] of maxParCritere) {
    // Même règle que `enDeuxGroupes` : un critère non rangé va du côté de l'annonce.
    const g = groupeDe(critere) === "toi" ? toi : annonce;
    if (max > 0) {
      g.criteres.push({ critere, max });
      g.max += max;
    } else {
      g.ajustements.push(critere);
    }
  }

  const constants = CRITERES_CONSTANTS.map((critere) => ({
    critere: critere as string,
    // Une seule valeur, par construction du test : on prend la première.
    points: [...(valeurs.get(critere) ?? [0])][0],
    max: maxParCritere.get(critere) ?? 0,
  }));

  const { notables, incalculables } = separerNotables(d, PROFIL_VIDE, [...d.offers]);

  return {
    toi,
    annonce,
    total: toi.max + annonce.max,
    constants,
    collecte: d.offers.length,
    notables: notables.length,
    incalculables: incalculables.length,
    seuilAge: SEUIL_ANNONCE_AGEE,
    nbAgees: d.offers.filter((o) => annonceAgee(o, referenceDe(d.meta)) !== null).length,
  };
}
