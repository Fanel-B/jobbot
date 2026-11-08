/**
 * La ligne « Début » d'une fiche, et la règle expliquée une fois sur /methode.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DebutAnnonce } from "../components/DebutAnnonce";
import { dateLongue } from "./dates";
import { FIN_DE_STAGE_LA_PLUS_TARDIVE } from "./scoring";

const lire = (chemin: string) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");
const texte = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const rendu = (debut: string | null) => texte(renderToStaticMarkup(createElement(DebutAnnonce, { debut })));

describe("la ligne « Début »", () => {
  it("date absente : le texte demandé, mot pour mot", () => {
    expect(rendu(null)).toBe("non précisée par l'annonce, à confirmer. Fin au plus tard le 31 juillet 2027.");
    expect(rendu("")).toBe(rendu(null));
  });

  it("date lisible : la date seule, rien d'ajouté", () => {
    expect(rendu("2027-03-29")).toBe("2027-03-29");
    expect(rendu("novembre 2027")).toBe("novembre 2027");
  });

  it("date illisible : la citation, puis la même demande", () => {
    expect(rendu("à convenir")).toBe(
      "à convenir (date non exploitable), à confirmer. Fin au plus tard le 31 juillet 2027.",
    );
    expect(rendu("asap")).toContain("à confirmer");
  });

  it("aucun tiret cadratin", () => {
    expect(rendu(null)).not.toContain("—");
  });

  it("la date de fin vient de la constante du moteur, pas du composant", () => {
    expect(rendu(null)).toContain(dateLongue(FIN_DE_STAGE_LA_PLUS_TARDIVE));
    const source = lire("components/DebutAnnonce.tsx");
    expect(source).not.toMatch(/31 juillet|2027-07-31/);
    expect(source).toContain("FIN_DE_STAGE_LA_PLUS_TARDIVE");
  });
});

describe("la page méthode et la fiche disent la même date de fin", () => {
  it("/methode la lit dans la constante, sans la recopier", () => {
    const methode = lire("app/methode/page.tsx");
    expect(methode).not.toMatch(/31 juillet 2027/);
    expect(methode.match(/dateLongue\(FIN_DE_STAGE_LA_PLUS_TARDIVE\)/g)?.length).toBe(2);
  });

  it("/methode explique la règle une fois", () => {
    const methode = lire("app/methode/page.tsx");
    expect(methode.match(/à confirmer/g)?.length).toBe(1);
    expect(methode).toContain("il ne retire aucun point");
  });

  it("les cartes de la liste ne portent rien de cette règle", () => {
    expect(lire("components/OfferCard.tsx")).not.toMatch(/DebutAnnonce|dateDebutNonExploitable|à confirmer/);
  });

  it("la fiche passe par le composant", () => {
    const fiche = lire("app/offres/[id]/page.tsx");
    expect(fiche).toContain("<DebutAnnonce debut={offre.start_date} />");
  });
});
