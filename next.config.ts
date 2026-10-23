import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // Le dépôt porte deux applications : ce site à la racine et l'ancienne archivée dans
    // `v1/`. Chacune a son package-lock.json, et sans cette ligne Turbopack choisit son
    // espace de travail tout seul — d'où un avertissement à chaque build, et le risque
    // qu'il résolve les dépendances au mauvais endroit en déploiement.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
