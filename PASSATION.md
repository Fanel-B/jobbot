# Passation — JobBot V2, session du 19 octobre 2026

Document à lire **avant** de reprendre ce dépôt. Il raconte d'où vient le code, ce qui a été fait,
comment il a été vérifié, et ce qui reste. Écrit par l'assistant Hermes de Fanel, qui a produit cette
version et qui n'a qu'un accès **en lecture** à GitHub.

À lire avec `BRIEFING.md` (même dossier), qui contient la carte du code et les règles. Ce document-ci
raconte la session et le contexte.

---

## 1. D'où vient ce code

Ce dépôt n'est pas une itération de l'ancienne application JobBot (`index.html`, `api/`, `src/` sur
`Fanel-B/jobbot`). C'est un **projet Next.js neuf**, écrit le 19 octobre 2026, après fusion du cahier
de route travaillé par Fanel avec Claude (28/09, révisé le 14/10) et de ce que le pipeline de
recherche contient réellement.

La conclusion structurante de cette fusion : le cahier de route prévoyait de recentrer la démo sur
Paris, parce que les sources publiques ne donnaient qu'une seule offre de stage toulousaine. La
mesure du 19/10 dit autre chose — les **interfaces publiques des entreprises** (Airbus, Thales,
Sopra Steria, Groupe SII, Capgemini, Atos, CNES) fournissent **114 stages à Toulouse**, tous publiés
par l'employeur, tous légaux. La démo est donc centrée sur Toulouse, et Paris devient une extension.

## 2. La contrainte qui a gouverné tout le reste

**Aucune donnée de démonstration.** Le site affiche de vraies offres, avec leur vraie date, leur
vraie source, leur vrai texte, et « non précisé » là où la source se tait.

Ce qui a des conséquences directes dans le code :

- `data/offers.json` est un export réel, produit hors du dépôt (voir §4) ;
- `contract_known: false` pour une offre dont la source ne donne pas le type de contrat — affichée
  quand même, mais dans **son propre bloc**, avec un badge distinct, hors classement principal ;
- la fraîcheur est calculée par rapport à l'heure de **collecte** (`meta.generated_at`), pas par
  rapport à l'horloge du visiteur.

## 3. Ce qui a été fait (et comment c'est vérifié)

### Le site

- **Next.js 16.4, TypeScript, Tailwind v4.** 229 pages pré-rendues, build vert.
- **4 écrans** : accueil, liste filtrable, fiche d'offre, méthode.
- **Identité visuelle** : fond papier chaud, encre franche, un seul accent, couleurs sémantiques
  réservées à la note, serif pour les titres (`Instrument Serif`) et Inter pour l'interface, chiffres
  tabulaires. Les jetons vivent dans `app/globals.css` (`@theme`) — la palette change là, nulle part
  ailleurs.
- **Les filtres sont des liens**, pas des composants clients : `?zone=toulouse&type=stage&min=80`.
  URL partageables, page utilisable sans JavaScript. Ne pas les transformer sans raison.
- **La fiche d'offre est la page du produit** : note, ses **9 critères** avec points et maximum,
  compétences ✅/❌, texte réel de l'annonce, version de CV conseillée, lien vers l'annonce
  d'origine (obligatoire), identifiant source.

### Ce qui a été trouvé en regardant, pas en lisant

Trois défauts réels, dont deux invisibles à la lecture du code. Ils ont été trouvés en **prenant des
captures d'écran et en les regardant** — c'est la méthode qui a payé, elle vaut d'être reprise.

1. **La note affichée ne correspondait pas à son bulletin.** La décomposition perdait les critères
   « dépôt » et « fraîcheur » : la classe de caractères utilisée pour découper les lignes excluait
   `ô` et `î`. La fiche annonçait donc `73/82` sous une note de `83`. Corrigé, et un test verrouille
   désormais l'égalité note = somme du bulletin (vérifié sur 222 offres : 0 désaccord).
2. **Le filtre « Type non renseigné » ne filtrait rien** : les 40 offres concernées ne remontaient
   pas, la page affichait la liste complète.
3. **La liste « ce qui te manque » était éclatée** : « IA », « intelligence artificielle »,
   « IA générative » et « IA generative » apparaissaient comme quatre lignes concurrentes pour la
   même famille. Regroupement par famille ajouté dans `lib/offers.ts` (`lacunesRegroupees`) — 85
   offres pour « IA / intelligence artificielle » au lieu de quatre lignes éparpillées.

### Ce qui reste **du côté pipeline** (pas dans ce dépôt)

L'Île-de-France est ouverte sur le site, mais les 8 offres qui y figurent viennent d'alertes mail et
n'ont **aucun type de contrat**. Ce n'est pas un défaut d'affichage : la collecte ne cherche pas
l'Île-de-France. Les quatre points exacts sont listés dans `BRIEFING.md`, section 7. C'est du Python,
il vit hors de ce dépôt, et c'est l'assistant Hermes qui y a accès.

## 4. D'où viennent les données

Le site **ne collecte rien**. Il lit `data/offers.json`, produit par un pipeline Python qui vit
ailleurs (`~/.hermes/skills/job-search/`, script `export_site.py`).

Ce pipeline interroge aujourd'hui huit sources : interfaces publiques d'entreprises (Workday pour
Airbus et Thales, SmartRecruiters pour Sopra Steria, Capgemini, sitemaps déclarés pour Groupe SII,
Atos, CNES), interfaces publiques françaises (La Bonne Alternance, France Travail) et les **alertes
e-mail que Fanel a créées lui-même** sur LinkedIn. Aucun scraping de LinkedIn ou d'Indeed, aucun
contournement de protection.

**`data/offers.json` est committé volontairement** (530 ko) pour que le site tourne sans le pipeline.
C'est temporaire : dès que la base PostgreSQL est branchée, ce fichier sort du dépôt et devient un
jeu de démonstration.

## 5. Pièges de cette version de Next.js

Vérifiés à la compilation, pas supposés :

- `params` et `searchParams` sont des **`Promise`** : `const { id } = await params`.
- `searchParams` doit être lu dans un composant enveloppé de **`<Suspense>`**, sinon le build échoue
  (« blocking-prerender-dynamic »).
- **`new Date()` au pré-rendu fait échouer le build** (« blocking-prerender-current-time »). C'est
  la raison pour laquelle la fraîcheur se calcule par rapport à `meta.generated_at`.
- Ce projet a été créé avec `create-next-app@latest`, qui dépose un `AGENTS.md` renvoyant à
  `node_modules/next/dist/docs/` — la documentation versionnée, à consulter avant d'écrire du code.

## 6. Les règles non négociables

Elles font la valeur du produit. Les casser, c'est le rendre malhonnête.

1. Aucune donnée inventée : champ absent → « non précisé ».
2. La note n'est pas opaque : `Total` doit rester égal à la note du pipeline.
3. Un type de contrat inconnu reste inconnu : badge distinct, bloc séparé, hors classement.
4. Le lien vers l'annonce d'origine est toujours présent.
5. Le signal « formation imposée » cite toujours son extrait.
6. Aucun contournement de protection, aucune source scrapée illégalement.
7. Rien de ce qui touche aux secrets (chaîne de connexion, clé API) ne transite par un chat : ça va
   dans un fichier d'environnement ou dans un coffre.

## 7. La suite, par ordre de valeur

1. **Base PostgreSQL (Neon)** — l'étape structurante. Tant qu'il n'y a pas de comptes, un fichier
   suffit ; dès qu'il y a plusieurs personnes, la note doit être calculée **à la lecture**, pas
   stockée. Schéma : `offers`, `users`, `profiles`, `resumes`, `saved_offers`, `ai_usage` — et
   `offers` **sans** colonne `score`.
2. **Comptes et score personnalisé** — Auth.js, `/profil`, portage du scoring en TypeScript. C'est
   la tranche qui transforme la vitrine en produit, et le meilleur exercice TypeScript possible :
   la logique est déjà écrite et testée côté Python.
3. **CV adapté** — dépôt, extraction, compétences proposées par l'IA puis **confirmées par la
   personne** (une compétence jamais confirmée ne compte jamais), export .docx, quota par compte.
4. **Fit dynamique** — « et si tu ajoutais TypeScript ? » → recalcul, sans table ni appel IA.
5. **Élargissement de la collecte à l'Île-de-France** — côté pipeline Python, hors de ce dépôt.

## 8. Répartition des rôles

| | Qui | Peut |
|---|---|---|
| Ce dépôt | Fanel + Claude Code (VSCode) | lire, écrire, pousser sur GitHub |
| Pipeline de collecte | assistant Hermes (serveur) | lire les sources, calculer les notes, exporter le JSON |
| GitHub | Claude Code a l'écriture ; l'assistant Hermes a la **lecture seule** | l'assistant peut suivre les branches, lire le code, proposer des modifications — il ne pousse rien |

Règle de travail : quand le site a besoin d'une donnée que la source ne fournit pas, **c'est le
pipeline qu'on étend**, jamais le site qu'on fait deviner.

## 9. Arrivée dans le dépôt

```
git clone jobbot-v2.bundle jobbot-v2
cd jobbot-v2
git remote add origin git@github.com:Fanel-B/jobbot.git
git push -u origin master:site-v2
```

Puis, dans VSCode : `git fetch && git checkout site-v2`.

Le dépôt part de **3 commits**, tous sur `master` :

1. identité visuelle et site alimenté par de vraies offres ;
2. regroupement des lacunes par famille + README ;
3. Île-de-France ouverte sur le site + `BRIEFING.md`.

`npm install` puis `npm run dev` : le site tourne immédiatement, les données sont dans le dépôt.
