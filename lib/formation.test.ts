/**
 * Tests du signal « formation imposée ».
 *
 * Règle 5 du briefing : jamais d'accusation sans citation. Le site affichait le badge et le bloc
 * d'avertissement sur la seule foi de `training_flag`, avec un repli « extrait non disponible » —
 * c'est-à-dire qu'il pouvait mettre en cause une entreprise sans rien citer. Ces tests verrouillent
 * la règle inverse : pas d'extrait, pas de signal.
 *
 * Ils vérifient aussi que le compte affiché sur l'accueil et sur /methode est bien celui des
 * annonces **citables**, et non celui des drapeaux levés.
 */
import { describe, expect, it } from "vitest";
import { nbSignalFormation, offers, signalFormationCitable, type Offer } from "@/lib/offers";

function offreFictive(partiel: Partial<Offer>): Offer {
  return {
    training_flag: false,
    training_excerpt: null,
    ...partiel,
  } as Offer;
}

describe("signalFormationCitable", () => {
  it("affiche le signal quand le drapeau est levé et l'extrait présent", () => {
    const o = offreFictive({
      training_flag: true,
      training_excerpt: "… intégrer notre école partenaire …",
    });
    expect(signalFormationCitable(o)).toBe(true);
  });

  it("n'affiche rien quand le drapeau est levé sans extrait", () => {
    expect(signalFormationCitable(offreFictive({ training_flag: true }))).toBe(false);
    expect(
      signalFormationCitable(offreFictive({ training_flag: true, training_excerpt: "" })),
    ).toBe(false);
    expect(
      signalFormationCitable(offreFictive({ training_flag: true, training_excerpt: "   " })),
    ).toBe(false);
  });

  it("n'affiche rien quand le drapeau n'est pas levé, même si un extrait traîne", () => {
    const o = offreFictive({ training_flag: false, training_excerpt: "… école partenaire …" });
    expect(signalFormationCitable(o)).toBe(false);
  });
});

describe("le signal sur les offres réelles", () => {
  it("aucune offre affichée ne porte le signal sans son extrait", () => {
    const sansCitation = offers.filter(
      (o) => signalFormationCitable(o) && !(o.training_excerpt ?? "").trim(),
    );
    expect(sansCitation.map((o) => o.id)).toEqual([]);
  });

  it("le compte affiché est celui des annonces citables", () => {
    const citables = offers.filter(signalFormationCitable).length;
    expect(nbSignalFormation(offers)).toBe(citables);
    // Et il ne dépasse jamais le nombre de drapeaux levés par le pipeline.
    expect(nbSignalFormation(offers)).toBeLessThanOrEqual(
      offers.filter((o) => o.training_flag).length,
    );
  });

  it("dit la vérité sur cette collecte : le compte vaut ce que valent les données", () => {
    // Zéro aujourd'hui — c'est un fait mesuré, que l'interface doit énoncer au lieu
    // d'afficher « 0 offre(s) signalée(s) ». Si le pipeline se met à remplir le champ,
    // ce test le signalera au lieu de laisser le texte mentir en silence.
    expect(nbSignalFormation(offers)).toBe(0);
  });
});
