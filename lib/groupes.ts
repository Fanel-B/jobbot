/**
 * Les deux familles de critères : ce qui vient de toi, ce qui vient de l'annonce.
 *
 * Pourquoi ce fichier existe. La note promettait « les offres qui te correspondent vraiment »,
 * mais sur 100 points, 30 seulement regardent la personne. Les 70 autres notent l'annonce :
 * sa fraîcheur, sa source, sa complétude. Ce sont de vraies informations, utiles, et elles ne
 * changent pas d'un lecteur à l'autre. Mélangées dans un seul chiffre, elles donnaient 67 sur 100
 * à quelqu'un dont trois compétences cochées n'avaient rapporté que trois points.
 *
 * Ce module ne recalcule rien. Il range les lignes que le moteur a déjà produites en deux
 * groupes et en fait la somme. C'est important : le moteur Python vit sur le VPS, et toute
 * modification du calcul doit passer par lui sous peine de faire mentir
 * `npm run verifier-scoring`. Regrouper n'est pas recalculer, donc l'oracle reste valide par
 * construction, et le total affiché reste exactement celui du moteur.
 *
 * `lib/groupes.test.ts` vérifie les deux invariants qui comptent : chaque critère appartient à
 * un groupe et un seul, et la somme des deux sous-totaux vaut le total sur les 290 offres.
 */
import type { Breakdown } from "./offers";

/**
 * Les critères qui dépendent de la personne.
 *
 * Le départ se fait sur une seule question : « ce chiffre changerait-il si quelqu'un d'autre
 * regardait la même annonce ? » Si oui, le critère est ici.
 *
 * Le calendrier et les dates en font partie parce qu'ils se mesurent contre une disponibilité,
 * celle de l'année universitaire de la personne. Le dossier aussi : il décrit ce qu'elle a déjà
 * préparé. Les ajustements de diplôme, de prérequis et de compétences comparent l'exigence de
 * l'annonce à ce qu'elle a confirmé savoir faire.
 */
export const CRITERES_TOI = [
  "cohérence",
  "calendrier",
  "dossier",
  "dates",
  "fin",
  "diplôme",
  "prérequis",
  "compétences",
] as const;

/**
 * Les critères qui décrivent l'annonce, identiques pour tout le monde.
 *
 * Le plafond de groupe est ici et non dans l'autre famille : il regarde combien d'annonces du
 * même groupe d'entreprises figurent déjà dans la collecte, ce qui est une propriété du corpus
 * et non du lecteur.
 */
export const CRITERES_ANNONCE = [
  "métier",
  "source",
  "fiche",
  "dépôt",
  "fraîcheur",
  "diversité",
  "plafond",
] as const;

/**
 * Les critères qui rendent la même valeur sur les 290 offres.
 *
 * « diversité » vaut 14 sur 14 partout, « dossier » vaut 0 sur 4 partout. Dix-huit points sur
 * cent ne départagent donc aucune offre et ne distinguent aucun lecteur : ils gonflent le total
 * sans rien y apporter.
 *
 * Ils restent dans le calcul et dans le total, et c'est un choix. Les en retirer donnerait une
 * note sur 82 au lieu de 100, c'est-à-dire un chiffre affiché par le site qui ne serait plus
 * celui que calcule le moteur Python. Pour un projet dont l'identité tient à ce que les deux
 * s'accordent, ce serait payer trop cher une amélioration cosmétique. Ils sont donc affichés,
 * mais grisés et annotés : le lecteur voit qu'ils existent et qu'ils ne servent à rien.
 *
 * La correction appartient au moteur Python. Ce qu'il faudrait y changer est écrit dans NUIT.md.
 */
export const CRITERES_CONSTANTS = ["diversité", "dossier"] as const;

export type Groupe = {
  id: "toi" | "annonce";
  titre: string;
  /** Ce que le groupe mesure, en une phrase, pour la personne qui lit. */
  explication: string;
  lignes: Breakdown[];
  points: number;
  max: number;
};

export type Releve = {
  toi: Groupe;
  annonce: Groupe;
  /** Le total du moteur, inchangé : la somme des deux groupes. */
  total: number;
  max: number;
};

/** Ce critère rend-il la même valeur sur toute la collecte ? */
export function estConstant(critere: string): boolean {
  return (CRITERES_CONSTANTS as readonly string[]).includes(critere);
}

/** Le groupe d'un critère, ou `null` s'il n'est rangé nulle part. */
export function groupeDe(critere: string): "toi" | "annonce" | null {
  if ((CRITERES_TOI as readonly string[]).includes(critere)) return "toi";
  if ((CRITERES_ANNONCE as readonly string[]).includes(critere)) return "annonce";
  return null;
}

/**
 * Range un bulletin en deux groupes.
 *
 * Un critère que le moteur produirait sans qu'il soit rangé ici irait dans « l'annonce » : c'est
 * le choix le moins faux, puisqu'un critère inconnu n'a aucune raison d'être personnel, et il
 * garantit surtout que la somme des deux groupes reste le total. Le test épingle le cas pour
 * qu'un ajout côté Python ne passe pas inaperçu.
 */
export function enDeuxGroupes(breakdown: Breakdown[]): Releve {
  const toi: Breakdown[] = [];
  const annonce: Breakdown[] = [];

  for (const ligne of breakdown) {
    (groupeDe(ligne.critere) === "toi" ? toi : annonce).push(ligne);
  }

  const somme = (l: Breakdown[], champ: "points" | "max") =>
    l.reduce((s, b) => s + b[champ], 0);

  return {
    toi: {
      id: "toi",
      titre: "Toi, face à cette offre",
      explication: "Ce qui change si quelqu'un d'autre regarde la même annonce.",
      lignes: toi,
      points: somme(toi, "points"),
      max: somme(toi, "max"),
    },
    annonce: {
      id: "annonce",
      titre: "L'annonce elle-même",
      explication: "Sa fraîcheur, sa source, ce qu'elle dit. Identique pour tout le monde.",
      lignes: annonce,
      points: somme(annonce, "points"),
      max: somme(annonce, "max"),
    },
    total: somme(breakdown, "points"),
    max: somme(breakdown, "max"),
  };
}
