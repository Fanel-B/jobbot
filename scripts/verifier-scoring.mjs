/**
 * `npm run verifier-scoring` : le calcul TypeScript (`lib/scoring.ts`) contre l'oracle
 * (`data/offers.json`, produit par le pipeline Python).
 *
 * Pour chaque offre : la note totale, puis chaque critère du bulletin — nom, points, maximum et
 * détail (accents compris). Le moindre écart est un désaccord. Sortie en code 0 si et seulement si
 * il n'y en a aucun.
 *
 * L'heure du calcul : `export_site.py` appelle `datetime.now()` (heure **locale** de la machine du
 * pipeline, sans fuseau) juste avant d'écrire `meta.generated_at` (en UTC). On repart donc de
 * `generated_at`, décalé du fuseau du pipeline (`FUSEAU_PIPELINE_HEURES`, UTC — voir `lib/scoring.ts`).
 * `--fuseau=N` permet d'essayer un autre décalage, pour le diagnostic uniquement.
 *
 * Node exécute directement le TypeScript de `lib/scoring.ts` (types effacés à la volée).
 */
import { readFileSync } from "node:fs";
import { FUSEAU_PIPELINE_HEURES, classer, maintenantDeLExport, ordreDuPipeline } from "../lib/scoring.ts";

const argFuseau = process.argv.find((a) => a.startsWith("--fuseau="));
const fuseauHeures = argFuseau ? Number(argFuseau.slice("--fuseau=".length)) : FUSEAU_PIPELINE_HEURES;

const { meta, offers } = JSON.parse(readFileSync(new URL("../data/offers.json", import.meta.url), "utf8"));
const maintenant = maintenantDeLExport(meta.generated_at, fuseauHeures);

const calcules = new Map(classer(ordreDuPipeline(offers), maintenant).map((r) => [r.id, r]));

const desaccords = [];
const exigencesDifferentes = [];
const champs = ["critere", "points", "max", "detail"];

for (const o of offers) {
  const r = calcules.get(o.id);
  if (r.total !== o.score) {
    desaccords.push({ id: o.id, critere: "note totale", attendu: o.score, calcule: r.total });
  }
  const attendus = o.score_breakdown ?? [];
  const n = Math.max(attendus.length, r.breakdown.length);
  for (let i = 0; i < n; i++) {
    const a = attendus[i], c = r.breakdown[i];
    const nom = a?.critere ?? c?.critere ?? `ligne ${i + 1}`;
    if (!a || !c) {
      desaccords.push({ id: o.id, critere: nom, attendu: a ? JSON.stringify(a) : "(absent)", calcule: c ? JSON.stringify(c) : "(absent)" });
      continue;
    }
    for (const champ of champs) {
      if (a[champ] !== c[champ]) {
        desaccords.push({ id: o.id, critere: `${nom} · ${champ}`, attendu: a[champ], calcule: c[champ] });
      }
    }
  }
  // Diagnostic : les technos reconnues par Python sont exportées dans `skills.required`. Un écart ici
  // désigne une donnée lue par Python mais absente de l'export (par exemple `skills_optional`).
  const attenduesExig = o.skills?.required ?? [];
  if (JSON.stringify(attenduesExig) !== JSON.stringify(r.exigences)) {
    exigencesDifferentes.push({ id: o.id, attendu: attenduesExig, calcule: r.exigences });
  }
}

console.log(`Oracle : data/offers.json (généré le ${meta.generated_at}) · heure du calcul : UTC${fuseauHeures >= 0 ? "+" : ""}${fuseauHeures}`);
console.log(`Offres comparées : ${offers.length}`);
console.log(`Désaccords : ${desaccords.length}`);
for (const d of desaccords) {
  console.log(`  #${d.id} · ${d.critere} · attendu ${JSON.stringify(d.attendu)} · calculé ${JSON.stringify(d.calcule)}`);
}
if (exigencesDifferentes.length) {
  console.log(`Exigences reconnues différentes de skills.required : ${exigencesDifferentes.length}`);
  for (const e of exigencesDifferentes) {
    console.log(`  #${e.id} · attendu ${JSON.stringify(e.attendu)} · calculé ${JSON.stringify(e.calcule)}`);
  }
}
process.exit(desaccords.length === 0 ? 0 : 1);
