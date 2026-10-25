import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests unitaires : de la logique pure, sans DOM ni réseau.
// L'alias `@` reprend celui de `tsconfig.json`, pour que les tests importent les modules du site
// exactement comme les pages le font.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Plusieurs tests rejouent des classements complets sur toute la collecte — le simulant en
    // enchaîne une trentaine. À 287 offres et neuf critères, les 5 secondes par défaut ne
    // suffisent plus. C'est le volume de données qui a grandi, pas le calcul qui a ralenti :
    // on allonge le délai plutôt que d'échantillonner et d'affaiblir la couverture.
    testTimeout: 30_000,
    include: ["lib/**/*.test.ts"],
  },
});
