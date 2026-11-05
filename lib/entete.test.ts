/**
 * L'en-tête du relevé ne doit pas laisser croire que la note dépend de ce qu'elle ne lit pas.
 *
 * Le moteur ne reçoit que les compétences du profil. Le niveau, la zone et le type de recherche
 * sont enregistrés sur la page profil, mais rien ne les lit pour noter. Pourtant l'en-tête du
 * relevé affichait « Bac+5, M2 · stage · Toulouse et alentours » juste au-dessus du chiffre, ce
 * qui disait à qui le lisait : cette note est calculée pour ce niveau, cette zone et cette
 * recherche. C'était faux, et c'est le genre de phrase qu'un ami repère en cinq minutes.
 *
 * Ce test rend vraiment le composant avec un profil dont le niveau, la zone et la recherche sont
 * tous distinctifs, et vérifie qu'aucun des trois ne ressort dans le HTML. Il ne lit pas le texte
 * du fichier : un libellé reconstruit autrement, ou déplacé dans un sous-composant, serait
 * attrapé aussi.
 *
 * Si un jour le moteur lit ces réglages, c'est ce test qu'il faudra retourner, en même temps que
 * la page /methode, qui dit aujourd'hui qu'ils n'entrent pas dans la note.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ZONE_LABEL } from "./offers";
import { NIVEAU_LABEL, RECHERCHE_LABEL, encoderProfil, type Profil } from "./profil";

// Un profil dont chaque réglage serait reconnaissable à l'écran s'il y apparaissait.
const PROFIL_TEMOIN: Profil = {
  competences: ["React", "SQL", "Git"],
  zones: ["idf", "remote"],
  niveau: "bac+5",
  recherche: ["alternance"],
};

// `lireProfil` passe par le cookie de la requête : on lui en donne un.
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nom: string) =>
      nom === "jobbot_profil" ? { value: encoderProfil(PROFIL_TEMOIN) } : undefined,
  }),
}));

const { NoteDuProfil } = await import("@/components/NoteDuProfil");

async function enteteRendu(offreId: number): Promise<string> {
  const arbre = await NoteDuProfil({ offreId });
  return renderToStaticMarkup(createElement("div", null, arbre));
}

describe("l'en-tête du relevé", () => {
  it("ne réaffiche ni le niveau, ni la zone, ni le type de recherche", async () => {
    const html = await enteteRendu(913);

    // Le niveau et la recherche tels que l'ancien en-tête les écrivait.
    expect(html).not.toContain(NIVEAU_LABEL[PROFIL_TEMOIN.niveau]);
    expect(html).not.toContain(RECHERCHE_LABEL[PROFIL_TEMOIN.recherche[0]]);
    expect(html).not.toContain(RECHERCHE_LABEL[PROFIL_TEMOIN.recherche[0]].toLowerCase() + " ·");

    // Les zones : aucune de celles du profil, ni la formule de repli « toutes zones ».
    for (const z of PROFIL_TEMOIN.zones) expect(html).not.toContain(ZONE_LABEL[z]);
    expect(html).not.toContain("toutes zones");
  });

  it("rappelle encore les compétences confirmées, la seule chose qui entre dans le calcul", async () => {
    // Sans cette vérification, le premier test passerait aussi sur un composant qui ne rend rien.
    const html = await enteteRendu(913);
    expect(html).toContain("compétences confirmées");
    expect(html).toContain("Relevé de correspondance");
  });

  it("ne dépend pas des réglages : le même relevé quels que soient niveau, zone et recherche", async () => {
    // L'en-tête et le relevé ne doivent rien devoir à des réglages que le moteur ne lit pas.
    // On compare ce que le profil témoin produit avec ce que produirait un profil identique en
    // compétences mais opposé en réglages.
    const autres: Profil = { ...PROFIL_TEMOIN, zones: ["toulouse"], niveau: "bac+3", recherche: ["stage"] };
    const { classementPour } = await import("./profil");
    const a = classementPour(PROFIL_TEMOIN).get(913)?.total;
    const b = classementPour(autres).get(913)?.total;
    expect(a).toBeDefined();
    expect(a).toBe(b);
  });
});

describe("le composant lui-même", () => {
  it("n'importe plus les libellés de niveau, de zone ni de recherche", () => {
    // Garde-fou en plus du rendu : si quelqu'un réimporte ces libellés dans ce fichier, la
    // question « pourquoi ? » se pose avant même de relire l'écran.
    const source = readFileSync(
      new URL("../components/NoteDuProfil.tsx", import.meta.url),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((l) => l.trimStart().startsWith("import "))
      .join("\n");
    expect(imports).not.toContain("NIVEAU_LABEL");
    expect(imports).not.toContain("RECHERCHE_LABEL");
    expect(imports).not.toContain("ZONE_LABEL");
  });
});
