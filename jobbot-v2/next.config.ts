import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // Le dépôt porte deux applications : la v1 à la racine et ce site dans `jobbot-v2/`.
    // Chacune a son package-lock.json, et Turbopack choisissait la racine comme espace de
    // travail — d'où un avertissement à chaque build, et le risque qu'il résolve les
    // dépendances au mauvais endroit en déploiement. On la lui désigne.
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
