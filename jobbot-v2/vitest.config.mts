import { defineConfig } from "vitest/config";

// Tests unitaires du calcul de la note : de la logique pure, sans DOM ni réseau.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
