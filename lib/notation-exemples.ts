/**
 * Des offres SYNTHÉTIQUES pour les tests du socle T4 : aucune ne vient d'une vraie annonce, aucun
 * nom d'entreprise, aucune donnée de la collecte. Chaque fabrique part d'une offre neutre et ne
 * change que ce que le test veut montrer.
 */
import type {
  CauseCompatibilite,
  Eligibilite,
  NiveauQualite,
  NotationOffre,
  Qualite,
  SourceLecture,
} from "./notation-contrat";

export function qualiteExemple(niveau: NiveauQualite = "complete", noteInterne: number | null = 80): Qualite {
  return { niveau, note_interne: noteInterne, couverture: niveau === "texte_non_capture" ? 0.45 : 1, dimensions: [] };
}

export const ELIGIBLE_SANS_RESERVE: Eligibilite = { statut: "eligible", reserves: [], a_verifier: [], motif_rejet: null };

type Options = {
  age_jours?: number | null;
  qualite?: Qualite;
  eligibilite?: Eligibilite;
  fermee?: boolean;
  fermee_le?: string | null;
  source_lecture?: SourceLecture;
};

function base(id: number, o: Options) {
  return {
    id,
    age_jours: o.age_jours === undefined ? 5 : o.age_jours,
    qualite: o.qualite ?? qualiteExemple(),
    eligibilite: o.eligibilite ?? ELIGIBLE_SANS_RESERVE,
    fermee: o.fermee ?? false,
    fermee_le: o.fermee_le ?? null,
  };
}

/** Une offre à outils : `couvertes` sur `exigees` technologies. Les manquantes sont nommées « Outil1 »... */
export function offreOutils(id: number, couvertes: number, exigees: number, o: Options = {}): NotationOffre {
  return {
    ...base(id, o),
    compatibilite: {
      etat: "evaluee",
      domaine_seul: false,
      couvertes,
      exigees,
      source_lecture: o.source_lecture ?? "texte",
      manquantes: Array.from({ length: exigees - couvertes }, (_, i) => `Outil${i + 1}`),
    },
  };
}

/** Une offre dont la seule exigence est le domaine IA. `couverte` : le profil porte-t-il l'IA ? */
export function offreDomaine(id: number, couverte: boolean, o: Options = {}): NotationOffre {
  return {
    ...base(id, o),
    compatibilite: {
      etat: "evaluee",
      domaine_seul: true,
      domaine: "IA",
      couvertes: couverte ? 1 : 0,
      exigees: 1,
      source_lecture: o.source_lecture ?? "texte",
    },
  };
}

/** Une offre dont la compatibilité n'est pas évaluée. */
export function offreNonEvaluee(id: number, cause: CauseCompatibilite, o: Options = {}): NotationOffre {
  return { ...base(id, o), compatibilite: { etat: "non_evaluee", cause } };
}

/** Un générateur pseudo-aléatoire déterministe : les mêmes nombres à chaque exécution. */
export function aleatoire(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0;
    return etat / 2 ** 32;
  };
}

/** Mélange de Fisher-Yates, déterministe pour une graine donnée. */
export function melanger<T>(liste: readonly T[], graine: number): T[] {
  const rand = aleatoire(graine);
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}
