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
 * Les critères qui comparent l'annonce à un candidat.
 *
 * Le départ se fait sur une seule question : « ce critère mesure-t-il l'annonce contre la
 * situation de quelqu'un ? » Si oui, il est ici, qu'il suive déjà le lecteur ou non.
 *
 * Et aujourd'hui, **seule la cohérence suit le lecteur** : le moteur ne reçoit que les
 * compétences confirmées. Tout le reste du groupe se mesure contre la situation fixe de
 * Fanel, quel que soit le profil réglé sur le site : disponible le 29 mars 2027, Master en
 * septembre 2027, niveau Bac+3 pour le diplôme, et des référentiels fixés dans le moteur pour
 * les prérequis et les compétences exigées (dont une copie des compétences confirmées de
 * Fanel). Le dossier décrit ce que la personne a préparé, mais le site n'enregistre aucune
 * démarche : il vaut 0 partout.
 *
 * Une première version de ce commentaire disait le contraire : que le calendrier et les dates
 * se mesuraient contre la disponibilité de la personne, et les ajustements contre ce qu'elle a
 * confirmé. C'était faux, et la phrase de l'interface qui en découlait l'était aussi. Le rangement
 * reste le bon (ces critères comparent bien l'annonce à un candidat), mais il ne dit pas que le
 * lecteur y est déjà pris en compte. `lib/methode.test.ts` vérifie que le moteur ne lit toujours
 * que les compétences, pour que cette phrase ne devienne pas fausse à son tour.
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
 * Le « plafond » est ici, et il ne s'agit pas du plafond par groupe d'entreprises, retiré le
 * 21 octobre 2026 : c'est le plafond administratif, qui ramène la note à 55 quand l'annonce
 * exige une habilitation ou une condition de nationalité. Il ne lit que le texte de l'annonce,
 * pas le lecteur, donc il va avec elle. Une première version de ce commentaire le confondait
 * avec le plafond de groupe.
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
      explication: "Ce qui compare l'annonce à un candidat. Aujourd'hui, seule la cohérence suit tes compétences.",
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
