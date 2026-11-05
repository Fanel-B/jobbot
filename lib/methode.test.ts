/**
 * La page /methode ne doit pas annoncer un chiffre que le moteur ne produit pas.
 *
 * Deux familles de garde-fous. Les premiers vérifient que les nombres de la page se déduisent
 * bien des bulletins réels et restent cohérents entre eux. Les seconds épinglent les valeurs que
 * `lib/scoring.ts` garde en constantes privées et que la page cite en toutes lettres : on ne peut
 * pas les importer sans toucher au moteur, donc on lit son texte. C'est volontairement fruste, et
 * c'est ce qui fait tomber le test quand quelqu'un change une date dans le moteur sans relire la
 * page qui la répète.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { structureBulletin, offers } from "./offers";
import { PROFIL_DEFAUT, PROFIL_VIDE, classementPour } from "./profil";
import { chiffresMethode } from "./methode";

const moteur = readFileSync(new URL("./scoring.ts", import.meta.url), "utf8");
const c = chiffresMethode();

describe("les barèmes annoncés", () => {
  it("font 42 points pour « toi » et 58 pour « l'annonce »", () => {
    // Les deux nombres que la page donne. Ils tiennent au moteur et non aux données : si un
    // barème change côté Python, ce test tombe et la page se relit.
    expect(c.toi.max).toBe(42);
    expect(c.annonce.max).toBe(58);
  });

  it("s'additionnent pour donner le barème total du moteur", () => {
    expect(c.toi.max + c.annonce.max).toBe(c.total);
    expect(c.total).toBe(structureBulletin.total);
  });

  it("ne laissent aucun critère hors des deux groupes", () => {
    const dansLaPage = [...c.toi.criteres, ...c.annonce.criteres].map((x) => x.critere);
    expect([...dansLaPage].sort()).toEqual([...structureBulletin.notes].sort());
    const ajustements = [...c.toi.ajustements, ...c.annonce.ajustements];
    expect([...ajustements].sort()).toEqual([...structureBulletin.ajustements].sort());
  });

  it("ne dépendent ni du profil ni de l'offre : un critère garde son barème partout", () => {
    // La page écrit « cohérence, 30 points ». Ce n'est vrai que si 30 est le barème de toutes
    // les offres et de tous les profils, ce que ce test vérifie sur la collecte entière.
    for (const profil of [PROFIL_VIDE, PROFIL_DEFAUT]) {
      const maxVus = new Map<string, Set<number>>();
      for (const r of classementPour(profil).values()) {
        for (const l of r.breakdown) {
          const s = maxVus.get(l.critere) ?? new Set<number>();
          s.add(l.max);
          maxVus.set(l.critere, s);
        }
      }
      for (const [critere, vus] of maxVus) {
        expect([...vus], `${critere} change de barème`).toHaveLength(1);
      }
    }
  });
});

describe("les lignes qui ne départagent rien", () => {
  it("valent diversité 14 sur 14 et dossier 0 sur 4, partout", () => {
    const parNom = Object.fromEntries(c.constants.map((x) => [x.critere, x]));
    expect(parNom["diversité"]).toMatchObject({ points: 14, max: 14 });
    expect(parNom["dossier"]).toMatchObject({ points: 0, max: 4 });
  });
});

describe("les annonces que l'on ne peut pas noter", () => {
  it("se répartissent sans en perdre ni en compter deux fois", () => {
    expect(c.notables + c.incalculables).toBe(c.collecte);
    expect(c.collecte).toBe(offers.length);
  });

  it("n'en comptent aucune de moins que ce que la page annonce comme bloc à part", () => {
    expect(c.incalculables).toBeGreaterThan(0);
    expect(c.notables).toBeGreaterThan(0);
  });
});

describe("la fraîcheur", () => {
  it("signale au-delà de 30 jours, et le nombre d'annonces concernées est cohérent", () => {
    expect(c.seuilAge).toBe(30);
    expect(c.nbAgees).toBeGreaterThanOrEqual(0);
    expect(c.nbAgees).toBeLessThan(c.collecte);
  });
});

describe("les constantes du moteur que la page cite en clair", () => {
  // Chacune est une valeur privée de lib/scoring.ts. La page les répète à l'usage du lecteur.
  it("la disponibilité reste le 29 mars 2027", () => {
    expect(moteur).toMatch(/const DISPONIBILITE = "2027-03-29"/);
  });

  it("la fin de stage reste compatible jusqu'au 31 juillet 2027", () => {
    expect(moteur).toMatch(/compatible: "2027-07-31"/);
  });

  it("le plafond administratif reste à 55", () => {
    expect(moteur).toMatch(/const PLAFOND_ADMIN = 55/);
  });

  it("le moteur ne lit toujours que les compétences du profil", () => {
    // La page affirme que le niveau, la zone et le type de recherche ne changent pas la note.
    // Tant que `classementPour` ne transmet que des atouts au moteur, c'est vrai. Si un jour
    // il en transmet davantage, ce test tombe et la phrase de la page doit être réécrite.
    const profil = readFileSync(new URL("./profil.ts", import.meta.url), "utf8");
    const debut = profil.indexOf("classer(ordreDuPipeline(offers)");
    const appel = debut >= 0 ? profil.slice(debut, profil.indexOf(";", debut)) : "";
    expect(appel, "l'appel au moteur est introuvable").not.toBe("");
    expect(appel).toContain("atoutsDuProfil(p)");
    expect(appel).not.toMatch(/p\.niveau|p\.zones|p\.recherche/);
  });
});
