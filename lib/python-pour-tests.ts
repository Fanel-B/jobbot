/**
 * Lance un script Python du dépôt depuis un test : python3, puis python, puis py, en UTF-8.
 * Sans Python sur la machine, le test ÉCHOUE au lieu de se taire : un test sauté ne protège de rien.
 *
 * Même mécanique que `lib/zones-regle.test.ts`, qui garde sa propre copie : ce fichier ne sert que
 * les tests du socle T4, pour ne pas modifier un test existant.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const racine = new URL("../", import.meta.url);

/** Le chemin absolu d'un fichier du dépôt, depuis un chemin relatif à la racine. */
export function cheminDuDepot(relatif: string): string {
  return fileURLToPath(new URL(relatif, racine));
}

export function lancerPython(script: string, entree?: string): string {
  const essais: string[] = [];
  for (const exe of ["python3", "python", "py"]) {
    const r = spawnSync(exe, [cheminDuDepot(script)], {
      input: entree,
      encoding: "utf8",
      env: { ...process.env, PYTHONUTF8: "1" },
      maxBuffer: 64 * 1024 * 1024,
    });
    if (r.error || r.status === null) {
      essais.push(`${exe} : introuvable`);
      continue;
    }
    if (r.status !== 0) {
      essais.push(`${exe} : code ${r.status} ${r.stderr.trim().split("\n").slice(-3).join(" | ")}`);
      continue;
    }
    return r.stdout;
  }
  throw new Error(`Python indisponible ou en échec pour ${script}.\n${essais.join("\n")}`);
}

/** Les valeurs de `faits.STAGE` et les termes du contrat de stage, tels que le moteur les déclare. */
export type FaitsDuMoteur = { debut_iso: string; fin_max_iso: string; duree_min: number; duree_max: number; termes: string[] };

export function faitsDuMoteur(): FaitsDuMoteur {
  return JSON.parse(lancerPython("tools/regles_eligibilite.py", JSON.stringify({ fonction: "faits_stage", cas: [] }))) as FaitsDuMoteur;
}

/** Interroge `tools/regles_eligibilite.py` : le moteur répond pour chaque cas. */
export function moteur<T = unknown>(fonction: string, cas: unknown[]): T[] {
  return JSON.parse(lancerPython("tools/regles_eligibilite.py", JSON.stringify({ fonction, cas }))) as T[];
}
