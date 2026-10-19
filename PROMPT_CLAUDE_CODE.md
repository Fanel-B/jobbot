# Prompt à envoyer à Claude Code (VSCode)

À copier tel quel dans Claude Code, une fois le dépôt ouvert sur la branche `site-v2`.

---

Tu reprends un projet Next.js qui existe déjà et qui tourne. Ton premier travail n'est pas d'écrire
du code : c'est de comprendre et de me dire ce que tu vois.

## Étape 1 — comprendre, sans coder

Dans cet ordre :

1. `PASSATION.md` — l'histoire de la session qui a produit ce dépôt, ce qui a été vérifié, ce qui
   reste.
2. `BRIEFING.md` — la carte du code, les règles non négociables, la suite.
3. `reference/README.md` et les fichiers de `reference/` — le moteur Python du pipeline, en lecture
   seule, qui sert de référence et d'oracle. **Ne les modifie pas.**
4. Le cahier de route JobBot V2 (je te le fournis) — la vision d'origine, écrite avant ce code.

Puis installe et vérifie l'état réel :

```
npm install
npm run build
npm run dev
```

Ouvre les quatre pages : `/`, `/offres`, une fiche d'offre, `/methode`.

**Rends-moi un rapport court, avant toute ligne de code** : ce qui est construit, ce que tu trouves
cassé, douteux ou incohérent avec le cahier de route, et ce que tu ferais en premier si tu décidais.
Je veux ton avis, pas une reformulation de ce que tu as lu.

## Étape 2 — mission : le simulant « et si j'ajoutais X ? »

C'est la fonctionnalité qui distingue ce produit, et elle ne demande ni base de données réactive ni
appel d'IA : juste un recalcul.

**Ce que je veux, à la fin** : sur la fiche d'une offre, je peux cocher des compétences que je ne
maîtrise pas encore (« TypeScript », « Docker », « CI/CD »…) et je vois **immédiatement** la note
recalculée, le critère qui bouge et de combien. Plus, sur la page d'accueil, une phrase du genre
« maîtriser TypeScript ferait passer 23 offres au-dessus de 70 ».

**Contrainte structurante** : pour ça, il faut recalculer la note côté TypeScript. Commence par
**le critère « cohérence »** (30 points, celui qui dépend des compétences demandées par l'offre) —
c'est le seul dont le simulant a besoin pour démarrer. N'essaie pas de porter les neuf critères d'un
coup.

**Exigence de vérité — c'est la partie la plus importante de la mission.** `data/offers.json`
contient, pour chaque offre, les points que le pipeline Python a calculés :

```json
{"critere": "cohérence", "points": 30, "max": 30, "detail": "3/3 exigences"}
```

C'est un **oracle**. Ta version TypeScript doit retrouver **exactement** ces points sur les 222
offres du fichier. Livre un script de vérification (`npm run verifier-scoring` ou équivalent) qui
compare et affiche les écarts. **Tant que le script n'affiche pas zéro écart, la mission n'est pas
terminée.** Si tu n'arrives pas à retrouver un chiffre, dis-le et explique pourquoi — ne l'arrondis
pas, ne le contourne pas.

Lis `reference/priorites.py` pour connaître la règle exacte du crédit partiel : elle est dans le code
qui tourne en production, pas dans une supposition.

## Les règles à ne pas casser

1. **Aucune donnée inventée.** Un champ absent s'affiche « non précisé ». Jamais de valeur devinée.
2. **La note reste la somme exacte de son bulletin.** Un total affiché qui ne correspond pas à ses
   lignes est un mensonge — c'est exactement le bug le plus grave trouvé lors de la session
   précédente.
3. **Un type de contrat inconnu reste inconnu** : badge distinct, bloc séparé, hors classement.
4. **Le lien vers l'annonce d'origine reste toujours présent.**
5. **La palette et la typographie ne changent pas** sans raison : les jetons sont dans
   `app/globals.css`. Si tu penses qu'un écran est mal fichu, dis-le d'abord, ne le refais pas en
   silence.
6. **Les filtres de `/offres` sont des liens** (`?zone=toulouse&type=stage`) : URL partageables, page
   utilisable sans JavaScript. Ne les transforme pas en composants clients.
7. **Pas de base de données pour l'instant.** Neon vient après. Travaille sur `data/offers.json`.
8. **Aucun secret nulle part** : pas de chaîne de connexion, pas de clé API dans le code ni dans un
   fichier committé. Si tu en as besoin, demande-moi où la mettre.
9. Interface et commentaires **en français**, comme le reste du code.

## Méthode de travail

- Travaille sur la branche `site-v2`, jamais directement sur `main`.
- Un commit par étape qui tient debout, avec un message qui dit *pourquoi*, pas seulement *quoi*.
- Regarde le rendu, pas seulement la compilation : lance le serveur et vérifie visuellement tes
  écrans. Les trois bugs les plus graves de la session précédente ont été trouvés comme ça, pas en
  relisant le code.
- Si une décision est ambiguë, demande-moi **une** question précise plutôt que d'en choisir une en
  silence.

## Ensuite (ne t'y mets pas maintenant, c'est juste pour situer)

Dans l'ordre : les autres critères de la note portés en TypeScript · la comparaison de deux offres ·
puis la base PostgreSQL et les comptes.
