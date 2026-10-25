/**
 * `npm run verifier-eligibility` : le portage TypeScript (`lib/eligibilite.ts`) contre l'oracle
 * (`data/offers.json`, produit par le pipeline Python).
 *
 * Trois sorties sont comparées, sur **chaque** offre, valeur et libellé :
 *
 *   · `location_zone`     — oracle : `zone_de()`, reference/export_site.py
 *   · `contract_kinds` et `contract_known` — oracle : `contrats()` + `bool(contract_type)`, même fichier
 *   · le signal d'école partenaire — oracle : `partner_school_match()`, reference/eligibility.py,
 *     appelé par `export_site.ligne` **uniquement si l'offre a une description**
 *
 * `eligibility.zone_status()` n'est volontairement pas porté : il rend des *statuts* (éligible,
 * incertain, rejeté) et se rabat sur le titre quand le lieu est vide. Ce n'est pas ce que l'export
 * écrit dans `location_zone`, et le porter donnerait des désaccords garantis.
 *
 * CE QUE CETTE VÉRIFICATION NE PROUVE PAS
 * `training_flag` est faux sur la totalité des offres de l'export. Un portage qui ne trouve jamais
 * rien passe donc à zéro désaccord sans rien démontrer. Cette partie établit **l'absence de faux
 * positifs**, pas que le signal fonctionne. Le jour où le pipeline en lèvera un, c'est seulement
 * alors que le portage sera réellement mis à l'épreuve.
 */
import { readFileSync } from "node:fs";
import { contratsDe, contratConnu, signalEcole, zoneDe, zonesReconnues } from "../lib/eligibilite.ts";

const { meta, offers } = JSON.parse(
  readFileSync(new URL("../data/offers.json", import.meta.url), "utf8"),
);

const desaccords = [];
const memeChose = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const o of offers) {
  const zone = zoneDe(o.location);
  if (zone !== o.location_zone) {
    desaccords.push({ id: o.id, quoi: "location_zone", attendu: o.location_zone, calcule: zone });
  }

  // `contrats()` rend une liste vide quand le champ est vide ; `ligne()` l'exporte alors à null.
  const kinds = contratsDe(o.contract_type);
  const kindsExportes = kinds.length ? kinds : null;
  if (!memeChose(kindsExportes, o.contract_kinds ?? null)) {
    desaccords.push({
      id: o.id,
      quoi: "contract_kinds",
      attendu: o.contract_kinds ?? null,
      calcule: kindsExportes,
    });
  }

  const connu = contratConnu(o.contract_type);
  if (connu !== o.contract_known) {
    desaccords.push({ id: o.id, quoi: "contract_known", attendu: o.contract_known, calcule: connu });
  }

  // `export_site.ligne` : `partner_school_match(offre) if offre.get("description") else None`.
  const motif = o.description ? signalEcole(o) : null;
  if (Boolean(motif) !== Boolean(o.training_flag)) {
    desaccords.push({
      id: o.id,
      quoi: "training_flag",
      attendu: o.training_flag,
      calcule: Boolean(motif),
      note: motif ? `motif trouvé : « ${motif} »` : undefined,
    });
  }
}

const flags = offers.filter((o) => o.training_flag).length;
const avecDescription = offers.filter((o) => o.description).length;

/**
 * Ce que les données exercent réellement.
 *
 * Un « 0 désaccord » ne vaut que par ce que l'oracle met à l'épreuve. Trois mutations du portage
 * — ordre des zones inversé, découpage sur la seule virgule, normalisation des accents retirée —
 * passent toutes les trois sans un désaccord, parce qu'aucune offre ne porte le cas. Ces
 * compteurs disent donc ce que ce zéro couvre, et ce qu'il ne couvre pas : les règles non
 * exercées ici sont épinglées par `lib/eligibilite.test.ts`.
 */
const couverture = [
  ["type de contrat contenant « / »", offers.filter((o) => (o.contract_type ?? "").includes("/")).length],
  ["type de contrat contenant « , »", offers.filter((o) => (o.contract_type ?? "").includes(",")).length],
  ["lieu correspondant à deux zones", offers.filter((o) => zonesReconnues(o.location).length > 1).length],
  ["lieu absent (→ « autre »)", offers.filter((o) => !(o.location ?? "").trim()).length],
  ["lieu contenant un code postal", offers.filter((o) => /\d{5}/.test(o.location ?? "")).length],
  ["annonce déclenchant le signal d'école", flags],
];

console.log(`Oracle : data/offers.json (généré le ${meta.generated_at})`);
console.log(`Offres comparées : ${offers.length}`);
console.log(`Désaccords : ${desaccords.length}`);
for (const d of desaccords.slice(0, 40)) {
  console.log(
    `  #${d.id} · ${d.quoi} · attendu ${JSON.stringify(d.attendu)} · calculé ${JSON.stringify(d.calcule)}` +
      (d.note ? ` · ${d.note}` : ""),
  );
}
if (desaccords.length > 40) console.log(`  … et ${desaccords.length - 40} autres`);

console.log("");
console.log("Ce que ces offres mettent à l'épreuve :");
for (const [quoi, n] of couverture) {
  console.log(`  ${n === 0 ? "✗" : "·"} ${quoi.padEnd(40)} ${n}`);
}
console.log(
  `  · annonces avec une description à examiner    ${avecDescription}`,
);
console.log("");
console.log("Ce que ce zéro ne prouve pas :");
console.log(
  "  Les lignes marquées ✗ ne sont exercées par aucune offre. L'ordre de priorité des zones, le",
);
console.log(
  "  découpage sur « / » et la normalisation des accents passeraient donc même s'ils étaient faux —",
);
console.log("  vérifié en mutant le portage. Ces règles sont épinglées par lib/eligibilite.test.ts.");
if (flags === 0) {
  console.log(
    "  Le signal d'école n'étant levé nulle part, cette partie établit l'absence de faux positifs,",
  );
  console.log("  pas que le signal fonctionne.");
}

process.exit(desaccords.length === 0 ? 0 : 1);
