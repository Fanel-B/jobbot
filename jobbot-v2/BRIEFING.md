# Briefing — JobBot V2

Ce fichier est écrit pour être lu **avant** de coder dans ce dépôt, par un humain ou par un agent
(Claude Code, VSCode, Copilot). Il dit ce qui existe, les règles à ne pas casser, et la suite.

Dernière mise à jour : 19 octobre 2026, par l'assistant Hermes de Fanel.

---

## 1. Ce qu'est ce projet

Un outil de recherche d'alternance et de stage : agréger les offres, expliquer **pourquoi** elles
correspondent à un profil, et dire **quoi travailler** pour celles qui ne correspondent pas encore.
Destinataires : Fanel, puis quelques amis (2 à 6). Pas d'ouverture publique, pas de monétisation au
début — c'est un choix qui évite toute charge de modération et de facturation.

Deux choses distinctes, à ne pas confondre :

| | Où | Rôle |
|---|---|---|
| **Le pipeline** | `~/.hermes/skills/job-search/` (Python, hors de ce dépôt) | collecte les offres, calcule la note, écrit `data/offers.json` |
| **Ce dépôt** | ici (`~/jobbot-v2`) | le site : il **lit** `data/offers.json` et n'appelle jamais une source |

**Conséquence à garder en tête :** le site ne collecte rien, ne calcule aucune note et ne lit aucune
boîte mail. Toute nouvelle donnée affichable doit passer par le pipeline. Si une donnée manque,
c'est le pipeline qu'il faut étendre, pas le site qui doit la deviner.

---

## 2. État actuel (fait et vérifié)

- **229 pages pré-rendues**, build vert, TypeScript strict.
- **4 écrans** : `/` (accueil), `/offres` (liste filtrable), `/offres/[id]` (fiche), `/methode`.
- **222 offres réelles** dans `data/offers.json` — 186 à Toulouse, 8 en Île-de-France, 40 sans type
  de contrat, 105 avec leur description. Aucune donnée de démonstration.
- La note est **expliquée** : 9 critères, points et maximum, et le total affiché est exactement la
  somme des lignes (vérifié sur les 222 offres : 0 désaccord).
- Les filtres de `/offres` sont des **liens** (`?zone=toulouse&type=stage&min=80&tri=score`) :
  URL partageables, page utilisable sans JavaScript. Ne pas les transformer en composants clients
  sans raison.
- Le rendu a été **regardé** (captures d'écran), pas seulement compilé : trois défauts visuels ont
  été trouvés comme ça, dont deux invisibles à la lecture du code.

## 3. Règles non négociables

Ce sont les règles qui font la valeur du produit. Les casser, c'est le rendre malhonnête.

1. **Aucune donnée inventée.** Un champ absent de la source sort à `null` et s'affiche
   « non précisé ». Jamais de valeur devinée, jamais de « probablement ».
2. **La note n'est pas opaque.** Chaque fiche montre son bulletin, et `Total` doit rester égal à la
   note du pipeline. Un test le vérifie côté pipeline (`check_export_site`).
3. **Un type de contrat inconnu reste inconnu.** Badge distinct, bloc séparé, hors classement
   principal. Une annonce sans contrat n'est jamais présentée comme un stage.
4. **Le lien vers l'annonce d'origine est toujours présent.** Le site renvoie vers l'employeur ; il
   ne recopie pas l'annonce.
5. **Le signal « formation imposée » cite toujours son extrait.** Jamais d'accusation sans citation.
6. **Aucun contournement de protection.** Pas de scraping de LinkedIn ou d'Indeed, pas de CAPTCHA
   forcé. Les alertes mail sont celles que l'utilisateur a créées lui-même.
7. **La fraîcheur est datée par rapport à la collecte** (`meta.generated_at`), jamais par rapport à
   l'horloge du visiteur. C'est ce qui permet de pré-rendre les pages — Next 16 refuse `new Date()`
   au pré-rendu, et il a raison.

## 4. Carte du code

```
app/
  layout.tsx               polices, en-tête, pied de page ; lit meta du JSON
  globals.css              jetons de design (Tailwind v4, @theme) — la palette vit ici
  page.tsx                 accueil : chiffres réels, top 6, bulletin d'exemple, lacunes, méthode
  offres/page.tsx          liste : filtres par URL, <Suspense> obligatoire (searchParams en Next 16)
  offres/[id]/page.tsx     fiche : note expliquée, ✅/❌ compétences, annonce, lien d'origine
  methode/page.tsx         sources, règles de collecte, fabrication de la note, refus assumés
components/
  Chips.tsx                badges : source, zone, contrat, fraîcheur, signal formation
  ScoreBadge.tsx           la note + une barre de critère
  Bulletin.tsx             décomposition de la note (9 critères)
  OfferCard.tsx            ligne de liste + carte compacte
lib/offers.ts              types, libellés, fraîcheur, bandes de note, regroupement des lacunes
data/offers.json           les offres réelles exportées par le pipeline (committé exprès)
```

**Pièges de cette version de Next (16.4) :** `params` et `searchParams` sont des `Promise`
(`await params`) ; `searchParams` doit être lu dans un composant enveloppé de `<Suspense>` ;
`new Date()` au pré-rendu fait échouer le build.

## 5. La suite, par ordre de valeur

### A. Base PostgreSQL (Neon) — l'étape structurante

Aujourd'hui le site lit un fichier. C'est parfait pour la démo, insuffisant dès qu'il y a des
comptes : chaque personne doit avoir son classement, donc la note doit être calculée **à la
lecture**, pas stockée.

- [ ] Créer un projet Neon (offre gratuite) — **à faire par Fanel**, la chaîne de connexion ne doit
      jamais passer par un chat : elle va dans `~/.hermes/.env` ou dans le coffre.
- [ ] Schéma : `offers`, `users`, `profiles`, `resumes`, `saved_offers`, `ai_usage`.
      `offers` porte `canonical_url` **unique** (base du dédoublonnage) et **pas** de colonne
      `score` : la note dépend de qui regarde.
- [ ] Le collecteur Python écrit dans Neon au lieu du JSON (garder le JSON pour la démo hors ligne).
- [ ] Le site lit Neon, la note est calculée en TypeScript au rendu.

### B. Comptes et score personnalisé

Auth.js (Google ou lien e-mail), `/profil`, portage de `scoring.py` et `eligibility.py` en
TypeScript, tri par score quand la personne est connectée. **C'est la tranche qui transforme la
vitrine en produit.**

### C. CV adapté

Dépôt du CV, extraction du texte, compétences proposées par l'IA puis **confirmées par
l'utilisateur** (une compétence jamais confirmée ne compte jamais), CV adapté, export .docx, quota
par personne (`ai_usage`). Clé IA **côté serveur uniquement**, modèle et prompt figés côté serveur.

### D. Fit dynamique (après le MVP)

« Et si tu ajoutais TypeScript ? + Docker ? » → note recalculée, nombre d'offres qui passent
au-dessus du seuil. Aucune table, aucun appel IA : un simple recalcul. N'afficher le comptage que si
la base contient assez d'offres, sinon le chiffre ne veut rien dire.

## 6. Points ouverts (à trancher)

- **Dépôt GitHub** : le travail est poussé où ? Un dépôt neuf (`jobbot-v2`) ou une branche sur
  l'ancien dépôt `Fanel-B/jobbot` (qui contient l'ancienne application, `index.html`, `api/`,
  `src/`) ? Recommandation : **branche** `site-v2` sur l'ancien dépôt, pour garder l'historique au
  même endroit ; on fusionnera quand la v2 remplacera la v1.
- **`data/offers.json` est committé** (530 ko) pour que le site tourne sans le pipeline. C'est
  volontaire et temporaire : dès que Neon est branché, ce fichier sort du dépôt et devient un jeu de
  démonstration.
- **Couverture géographique** : le site est ouvert à **Toulouse et l'Île-de-France**. Attention, la
  collecte reste aujourd'hui surtout toulousaine : les offres d'Île-de-France présentes viennent
  presque toutes d'alertes mail et **n'ont pas de type de contrat renseigné**. Pour que la promesse
  soit tenue, la collecte doit être élargie (voir ci-dessous).
- **Le cron personnel reste toulousain.** C'est voulu : la recherche de Fanel est à Toulouse. Le site
  est plus large que son besoin personnel — les deux ne doivent pas être alignés.

## 7. Ce qu'il reste à faire côté pipeline pour l'Île-de-France

Ce dépôt ne peut pas le faire ; c'est du Python, dans `~/.hermes/skills/job-search/`. Les points
exacts, pour qui reprend le sujet :

1. `adapters/lba_adapter.py` : `SEARCH_LOCATIONS = ("Toulouse",)` → ajouter Paris / Île-de-France.
2. `adapters/ft_adapter.py` : cherche déjà Toulouse **et** Paris (75, 92, 93, 94) — mais ne remonte
   aujourd'hui aucune offre retenue : à diagnostiquer (termes de recherche, filtrage du contrat).
3. `eligibility.zone_status()` : rejette tout ce qui n'est pas en zone toulousaine. Il faut
   **classer** les zones (`toulouse` / `idf` / `hors_zone`) au lieu de rejeter, et laisser le
   rapport quotidien filtrer sur `toulouse` — sinon les offres d'Île-de-France polluent le rapport
   personnel.
4. `adapters/careers_adapter.py` : les sites d'entreprise (Airbus, Thales, Sopra, SII, Capgemini,
   ATOS, CNES…) publient aussi des stages en Île-de-France ; le pré-filtre par zone les écarte
   aujourd'hui (ligne ~660).
5. Une fois ces quatre points faits, `export_site.py` n'a **rien** à changer : il exporte déjà
   toutes les zones.
