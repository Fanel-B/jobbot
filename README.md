# 🎯 JobBot Alternance

Bot de recherche d'alternance propulsé par IA — développé par Fanel (MIASHS L2, Toulouse).

## Fonctionnalités

- 🔍 **Génération d'offres** — L'IA génère des offres d'alternance réalistes (Dev & Data) à Toulouse et Paris
- 📊 **Scoring automatique** — Chaque offre est notée sur 100 selon l'adéquation avec ton profil
- 📝 **CV adapté** — CV personnalisé généré pour chaque offre en un clic
- 📥 **Export PDF** — Téléchargement du CV en HTML convertible en PDF
- 📋 **Suivi des candidatures** — Tableau de bord avec statuts + export CSV

## Installation

### 1. Cloner le repo

```bash
git clone https://github.com/ton-pseudo/jobbot-alternance.git
cd jobbot-alternance
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer la clé API

```bash
cp .env.example .env
```

Édite `.env` et remplace la valeur par ta clé API Anthropic :
```
VITE_ANTHROPIC_API_KEY=sk-ant-ta-vraie-cle
```

> Obtiens ta clé sur [console.anthropic.com](https://console.anthropic.com)

### 4. Lancer en local

```bash
npm run dev
```

→ Ouvre http://localhost:5173

### 5. Accès depuis ton téléphone (même Wi-Fi)

```bash
npm run dev:host
```

→ L'URL locale s'affiche dans le terminal (ex: `http://192.168.1.xx:5173`)

## Déploiement sur Vercel (accès partout)

1. Push ton code sur GitHub
2. Va sur [vercel.com](https://vercel.com) → "Add New Project" → importe ton repo
3. Dans **Environment Variables**, ajoute `VITE_ANTHROPIC_API_KEY` avec ta clé
4. Clique **Deploy** — c'est en ligne 🚀

## Stack technique

- **React 18** + **Vite**
- **Lucide React** (icônes)
- **Claude claude-sonnet-4-20250514** (Anthropic API)

## Sécurité

⚠️ La clé API est exposée côté client. Pour un usage personnel c'est acceptable.
Pour une mise en production publique, il faudrait un backend proxy (Express/FastAPI).

## Auteur

Fanel — Étudiant MIASHS L2, Université de Toulouse
