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
    include: ["lib/**/*.test.ts"],
  },
});
