# JobBot — les offres qui correspondent vraiment

**Trouver, parmi des centaines d'annonces de stage et d'alternance, celles qui correspondent à un
profil précis — et pouvoir expliquer pourquoi, offre par offre, avec une note que l'on peut
recalculer à la main.**

Projet personnel de [Fanel Balemo](https://github.com/Fanel-B), étudiant en L3 MIAGE à l'Université
de Toulouse. Il tourne tous les jours depuis le 21 septembre 2026, sans intervention : **544 annonces
collectées**, 287 publiées sur le site, 130 tests automatisés et un contrôle croisé de 287 offres
entre les deux implémentations du calcul (au 24 octobre 2026).

**Le site est en ligne : <http://148.113.247.10/>**

---

## Le problème

Un étudiant qui cherche un stage en mars 2027 doit lire des centaines d'annonces, dont la grande
majorité ne convient pas : mauvais diplôme exigé, mauvaise ville, durée incompatible avec la rentrée
de septembre, ou type de contrat qui n'est même pas un stage. Les sites d'offres classent par date,
rarement par adéquation réelle au profil, et jamais en montrant le calcul.

JobBot prend le problème dans l'autre sens : il **collecte** les annonces là où elles sont publiées,
**note** chacune selon des critères explicites et datés, **écarte** celles qui ne conviennent pas en
disant pourquoi, et **publie** le résultat avec son bulletin de notes.

## D'où viennent les offres

Quatre familles de sources, toutes publiques et lues de façon honnête. Aucune donnée n'est inventée :
un champ absent dans l'annonce ressort à `null` et s'affiche « non précisé ».

**1. Les sites carrière des entreprises, via leur ATS.** Les grandes entreprises publient leurs stages
sur leur propre site, alimenté par un logiciel de recrutement (Workday, SmartRecruiters). Ces ATS
exposent une **API JSON publique** — exactement celle qu'utilise la page carrière du navigateur. Le
pipeline l'appelle directement : pas d'analyse de page HTML fragile, pas de clé, et des données
structurées (titre, lieu, date de publication, référence de l'offre). C'est la source la plus fiable,
et celle qui donne les offres les mieux notées (Airbus, Thales, Sopra Steria, SII, Capgemini, Atos,
CNES).

**2. La Bonne Alternance**, service public. API officielle
(`api.apprentissage.beta.gouv.fr`), autorisation par clé en `Bearer`, quota de 60 appels par minute
respecté. L'API ne fait pas de recherche plein texte : elle filtre par codes métier (ROME) et par
zone géographique, on interroge donc les codes correspondant aux mots-clés puis on filtre sur le titre.

**3. France Travail**, API « Offres d'emploi v2 » (`francetravail.io`), autorisation OAuth2, pagination
de 150 offres par page.

**4. Les alertes e-mail du candidat** (LinkedIn, Indeed). Plutôt que de solliciter LinkedIn — ce que
ses conditions d'utilisation interdisent — on lit **les alertes que le candidat a lui-même créées** :
ses mails arrivent dans sa boîte, le pipeline les ouvre en **lecture seule** (jamais marqués comme
lus), uniquement pour les expéditeurs déclarés, et extrait une offre par lien.

### Les règles de collecte

- `robots.txt` et `sitemaps` sont respectés ; les `Crawl-delay` sont honorés.
- **Aucun contournement** de protection anti-robot. Quand un site bloque (erreur 403, pare-feu), la
  source est abandonnée pour cette entreprise au lieu d'être forcée — la liste des contournements
  refusés est assumée dans le code.
- Les quotas d'API sont respectés, les clés vivent dans l'environnement du serveur, **jamais dans le
  dépôt** (aucune clé, aucun jeton, aucun mot de passe n'a jamais été versionné).
- Dédoublonnage entre sources : une même offre vue sur deux canaux n'est comptée qu'une fois.

## Le rôle de l'agent

Le projet est **opéré par un agent** (Hermes Agent, de Nous Research) qui tourne sur un serveur
personnel. C'est la partie agentique du projet, et elle est délibérément séparée du calcul.

**Ce que l'agent fait :**

- il **déclenche** la collecte (toutes les heures) et les rapports (quotidien, hebdomadaire, dernier
  appel) par tâches planifiées `cron`, avec un service `systemd` pour le site ;
- il **parle** au candidat sur Telegram : alerte immédiate dès qu'une offre dépasse un seuil, rapport
  du jour, relances de candidatures, rappels d'agenda ;
- il **tient le suivi des candidatures** dans une feuille de calcul (entreprise, poste, date d'envoi,
  délai de réponse, quel CV et quelle lettre ont été envoyés, relance) ;
- il **maintient le système** : diagnostiquer une collecte en échec, ajouter une entreprise, corriger
  un critère de notation, générer les documents de candidature ;
- il **vérifie** au lieu de décrire : les mesures de sa propre fiabilité sont des tests et des
  comptages, pas des adjectifs.

**Ce que l'agent ne fait pas, par construction :**

- **aucun modèle de langage n'intervient dans la collecte, l'extraction ou la note.** C'est du Python
  déterministe : la même offre donne toujours la même note, et il est possible de la recalculer.
  L'agent pilote, il ne calcule pas ;
- **aucune candidature n'est envoyée automatiquement.** L'agent prépare le dossier, l'humain
  l'envoie ;
- **aucun document de candidature n'est produit** quand une compétence n'est pas prouvée par le
  référentiel du candidat, ou quand une vérification interne échoue (longueur, formulations
  interdites, dates cohérentes). Le générateur refuse d'écrire un fichier non conforme.

L'agent ne remplace donc pas l'ingénierie : il la rend exploitable au quotidien. Sur ce projet,
l'intérêt technique n'est pas « une IA qui écrit du texte », mais **un système autonome avec des
garde-fous vérifiables** : journalisation, reprise sur échec, et un contrôle croisé permanent entre
ce que le site affiche et ce que le pipeline calcule.

## La note, expliquée

Chaque offre publiée porte un bulletin : **neuf critères notés** sur un total de 100 points
(technicité du poste selon la pile réellement maîtrisée, niveau de diplôme demandé, lieu, type de
contrat, mention MIAGE, qualité de la source, fraîcheur, cohérence des exigences, diversité des
employeurs), puis **cinq ajustements** signés :

| Ajustement | Effet | Exemple |
| --- | --- | --- |
| Niveau de diplôme | +7 à −8 | licence demandée : +7 · master exigé : −8 |
| Prérequis métier | −4 par prérequis hors profil | mécanique spatiale, sécurité, spatial |
| Compétences exigées absentes | −3 par technologie, plafonné à −9 | Angular, C++, Vue.js, Docker |
| Dates | +3 / −10 | début compatible avec la disponibilité : +3 · trop tôt : −10 |
| Date de fin | −8 | fin au 1er octobre alors que la rentrée est en septembre : à raccourcir |

Deux règles garantissent la lisibilité : **le total affiché est la somme exacte des lignes du
bulletin** (la ligne « plafond » existe pour que ce soit vrai même quand une note est bornée), et un
**bloqueur administratif** (nationalité, habilitation de sécurité) borne la note à 55. Un site d'offres
classique ne montre pas cela ; ici, un recruteur comme un candidat peut vérifier chaque point.

## Comment ça tourne

```
   sites carrière (API ATS publiques) ─┐
   La Bonne Alternance (API publique) ─┤
   France Travail (API OAuth2) ────────┤──►  pipeline Python  ──►  SQLite (528 offres)
   alertes e-mail (LinkedIn, Indeed) ──┘     collecte · dédoublonnage
                                             note · éligibilité
                                                     │
                                                     ▼
                                          data/offers.json  (287 offres)
                                                     │
                                                     ▼
                                        site Next.js  ────►  systemd, port 80
                                        (rafraîchi chaque jour)

   l'agent : cron (collecte, rapports, relances) · Telegram · feuille de suivi
```

Le site ne déclenche jamais de collecte lui-même : il lit un fichier produit par le pipeline. C'est ce
qui permet de garder une seule chaîne observable — et de rendre le site indépendant des quotas des
sources.

## Preuve que ça marche

Le même calcul existe en deux langages : **Python** (le pipeline, qui fait autorité) et
**TypeScript** (le site, qui doit afficher exactement la même chose). Deux mécanismes empêchent les
deux de diverger :

- `npm run verifier-scoring` compare, **offre par offre et ligne par ligne** (nom du critère, points,
  maximum et détail, accents compris), le calcul TypeScript au fichier produit par le pipeline.
  Aujourd'hui : **287 offres comparées, 0 désaccord** ;
- le pipeline Python porte **400 contrôles** internes (`test_pipeline.py`), dont la vérification que
  chaque compétence citée dans un CV est réellement prouvée par les projets du candidat.

Cette contrainte n'est pas décorative : elle a fait trouver des vrais défauts. Exemple : le site
considérait « Docker » comme une compétence maîtrisée et ne pénalisait pas les offres qui l'exigent,
alors que le pipeline l'avait retiré du référentiel — le contrôle croisé a désigné 7 offres
incohérentes, corrigées le 24 octobre 2026.

## Stack

- **Site** : Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4. Pages rendues côté
  serveur, filtres par URL **partageables et fonctionnels sans JavaScript**.
- **Données** : pipeline Python, base SQLite, export JSON versionné (`data/offers.json`).
- **Exploitation** : serveur privé, `systemd`, tâches `cron`, rafraîchissement quotidien ;
  bibliothèques Google officielles pour la lecture des alertes et le suivi des candidatures.
- **Tests** : Vitest (130 tests TypeScript) et 400 contrôles Python ; contrôle croisé Python ↔
  TypeScript.

## Lancer le projet

```bash
npm install
npm run dev                       # http://localhost:3000
npm test                          # 130 tests
npx tsc --noEmit                  # typage
npm run verifier-scoring          # contrôle croisé avec le calcul Python (0 désaccord attendu)
npm run build && npm start        # version de production
```

La partie moteur (Python) est dans `reference/`, en lecture seule : c'est le pipeline qui produit
`data/offers.json`. Le site n'écrit jamais dans les données.

## Limites assumées

- **Le type de contrat n'est pas toujours lisible.** Beaucoup d'annonces ne précisent pas stage ou CDI.
  Ces offres ne sont pas déguisées en stages : elles sortent dans un bloc séparé, avec un badge, et
  hors du classement principal.
- **Le site n'envoie pas les données manquantes.** Quand une annonce ne dit pas la durée ou la date de
  début, le filtre ne peut pas trancher : l'offre est marquée « à vérifier » au lieu d'être inventée.
- **Certaines sources refusent les robots**, et elles sont abandonnées au lieu d'être forcées (Safran,
  EDF, GRDF, Alten à ce jour).
- **Ce projet ne postule pas à ma place.** Il prépare, il explique, il suit — l'humain décide.

## Auteur

**Fanel Balemo** — L3 MIAGE, Université de Toulouse (2026-2027)

- GitHub : <https://github.com/Fanel-B>
- Portfolio : <https://portfolio-v2-fanel-65.vercel.app>
- LinkedIn : <https://linkedin.com/in/fanel-balemo-4479372aa>

Développé et maintenu avec **Hermes Agent** (Nous Research), qui opère le système au quotidien.
