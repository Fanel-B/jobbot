/**
 * Les deux moitiés d'une fiche doivent parler de la même personne.
 *
 * Ce fichier existe à cause d'un défaut qui était visible à l'oeil sur une capture d'écran et
 * qu'aucun test n'attrapait. La colonne de gauche de la fiche affirmait « Python, déjà dans ton
 * profil » pendant que le relevé, à droite, comptait « 0 sur 3 exigences » et mettait 4 sur 30.
 * La gauche lisait un champ figé de l'export, calculé une fois pour toutes avec les 31
 * compétences de Fanel ; la droite recalculait pour la personne connectée. Un ami qui se
 * connectait lisait donc les compétences de quelqu'un d'autre, présentées comme les siennes.
 *
 * Les deux tests qui suivent sont la garantie que ça ne peut pas revenir. Le premier compare ce
 * que la gauche affiche au décompte que la droite écrit dans son bulletin. Le second exige que
 * deux profils différents fassent bouger les deux colonnes, et pas une seule : c'est ce qui
 * distingue une valeur vivante d'une valeur figée qui aurait l'air juste par hasard.
 */
import { describe, expect, it } from "vitest";
import { offers } from "./offers";
import { PROFIL_DEFAUT, PROFIL_VIDE, classementPour, couverturePour, type Profil } from "./profil";

const TROIS: Profil = { ...PROFIL_VIDE, competences: ["React", "SQL", "Git"] };

/** Le « 2/3 » que le moteur écrit dans le détail de la ligne de cohérence. */
function decompteDuBulletin(profil: Profil, id: number): { couvertes: number; exigences: number } | null {
  const ligne = classementPour(profil)
    .get(id)
    ?.breakdown.find((l) => l.critere === "cohérence");
  const m = ligne?.detail?.match(/^(\d+)\/(\d+) exigences/);
  return m ? { couvertes: Number(m[1]), exigences: Number(m[2]) } : null;
}

describe("la gauche de la fiche dit la même chose que son relevé", () => {
  for (const [nom, profil] of [
    ["profil vide", PROFIL_VIDE],
    ["trois compétences", TROIS],
    ["profil du pipeline", PROFIL_DEFAUT],
  ] as [string, Profil][]) {
    it(`compte les mêmes exigences couvertes, pour un ${nom}`, () => {
      let compares = 0;
      for (const o of offers) {
        const attendu = decompteDuBulletin(profil, o.id);
        if (!attendu) continue;
        const c = couverturePour(profil, o.id);
        expect(c.exigences.length, `offre ${o.id}, total des exigences`).toBe(attendu.exigences);
        expect(c.couvertes.length, `offre ${o.id}, exigences couvertes`).toBe(attendu.couvertes);
        compares += 1;
      }
      // Sans cette ligne, le test passerait en ne comparant rien du tout.
      expect(compares).toBeGreaterThan(250);
    });
  }

  it("ne laisse jamais une compétence être à la fois couverte et manquante", () => {
    for (const o of offers) {
      const c = couverturePour(TROIS, o.id);
      const doubles = c.couvertes.filter((x) => c.manquants.includes(x));
      expect(doubles, `offre ${o.id}`).toEqual([]);
      expect(c.couvertes.length + c.manquants.length).toBe(c.exigences.length);
    }
  });
});

describe("changer de profil change les deux colonnes", () => {
  it("fait bouger la couverture affichée et le décompte du bulletin ensemble", () => {
    // Le coeur du défaut : la droite bougeait, la gauche non. Ici, toute offre dont le
    // bulletin change doit voir sa couverture changer aussi, et réciproquement.
    let bougent = 0;
    for (const o of offers) {
      const a = decompteDuBulletin(PROFIL_VIDE, o.id);
      const b = decompteDuBulletin(PROFIL_DEFAUT, o.id);
      if (!a || !b) continue;

      const ca = couverturePour(PROFIL_VIDE, o.id).couvertes.length;
      const cb = couverturePour(PROFIL_DEFAUT, o.id).couvertes.length;

      expect(a.couvertes !== b.couvertes, `offre ${o.id}`).toBe(ca !== cb);
      if (ca !== cb) bougent += 1;
    }
    expect(bougent, "aucune offre ne distingue les deux profils").toBeGreaterThan(50);
  });

  it("ne couvre rien du tout avec un profil vide", () => {
    // La vérification la plus simple, et celle qui manquait : sans compétence confirmée,
    // aucune exigence ne peut être couverte, sur aucune offre.
    for (const o of offers) {
      expect(couverturePour(PROFIL_VIDE, o.id).couvertes, `offre ${o.id}`).toEqual([]);
    }
  });
});
