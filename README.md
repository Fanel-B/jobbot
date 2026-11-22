# JobBot : les offres qui correspondent vraiment

**Trouver, parmi des centaines d'annonces, celles qui correspondent réellement à mon profil, et
pouvoir expliquer pourquoi, offre par offre, avec une note que n'importe qui peut recalculer à la
main.**

Je suis [Fanel Balemo](https://github.com/Fanel-B), étudiant en L3 MIAGE à l'Université de Toulouse.
Je cherche un stage pour mars 2027 et je perdais mes soirées à lire des annonces qui ne me
correspondaient pas. J'ai donc écrit un système qui fait ce travail à ma place, honnêtement : il
tourne tous les jours depuis le 21 septembre 2026, sans que j'aie à y toucher. **369 offres publiées**
dans l'export du 7 novembre 2026, **403 contrôles** côté moteur, **558 tests** côté site, et un
contrôle croisé de ces 369 offres entre les deux implémentations du calcul (0 désaccord au
22 novembre 2026).

**Le site est en ligne : <https://jobbot-orcin.vercel.app>**

---

## Le problème que je voulais résoudre

Quand on cherche un stage, on lit des centaines d'annonces dont la grande majorité ne convient pas :
un diplôme trop élevé exigé, la mauvaise ville, une durée incompatible avec la rentrée de septembre,
ou un type de contrat qui n'est même pas un stage. Les sites d'offres classent par date, rarement par
adéquation réelle, et jamais en montrant le calcul.

J'ai pris le problème dans l'autre sens : mon système **collecte** les annonces là où elles sont
publiées, **note** chacune selon des critères explicites et datés, **écarte** celles qui ne
conviennent pas en disant pourquoi, et **publie** le résultat avec son bulletin de notes.

## D'où viennent mes offres

J'ai quatre familles de sources, toutes publiques, et je les lis honnêtement. Je n'invente aucune
donnée : un champ absent dans l'annonce ressort à `null` et s'affiche « non précisé ».

**1. Les sites carrière des entreprises, via leur ATS.** Les grandes entreprises publient leurs stages
sur leur propre site, alimenté par un logiciel de recrutement (Workday, SmartRecruiters). Ces ATS
exposent une **API JSON publique**, exactement celle qu'utilise la page carrière de mon navigateur.
Je l'appelle directement : pas d'analyse de page HTML fragile, pas de clé à demander, et des données
structurées (titre, lieu, date de publication, référence de l'offre). C'est ma source la plus fiable,
et celle qui me donne les offres les mieux notées (Airbus, Thales, Sopra Steria, SII, Capgemini, Atos,
CNES).

**2. La Bonne Alternance**, le service public. J'utilise son API officielle
(`api.apprentissage.beta.gouv.fr`), avec une clé en `Bearer`, en respectant le quota de 60 appels par
minute. Cette API ne fait pas de recherche plein texte : elle filtre par codes métier (ROME) et par
zone géographique, donc j'interroge les codes correspondant à mes mots-clés puis je filtre sur le
titre.

**3. France Travail**, l'API « Offres d'emploi v2 » (`francetravail.io`), en OAuth2, avec une
pagination de 150 offres par page.

**4. Mes propres alertes e-mail** (LinkedIn, Indeed). Plutôt que de solliciter LinkedIn, ce que ses
conditions d'utilisation interdisent : je lis **les alertes que j'ai moi-même créées** : elles
arrivent dans ma boîte, je les ouvre en **lecture seule** (sans jamais les marquer comme lues),
uniquement pour les expéditeurs que j'ai déclarés, et j'en extrais une offre par lien.

### Les règles que je me suis imposées pour collecter

- Je respecte `robots.txt` et les `sitemaps`, et j'honore les `Crawl-delay`.
- **Je ne contourne aucune protection anti-robot.** Quand un site me bloque (erreur 403, pare-feu),
  j'abandonne cette entreprise au lieu de forcer, et je l'assume par écrit dans le code.
- Je respecte les quotas des API, et mes clés vivent dans l'environnement de mon serveur, **jamais
  dans ce dépôt** : aucune clé, aucun jeton, aucun mot de passe n'a jamais été versionné.
- Je dédoublonne entre sources : une même offre vue sur deux canaux ne compte qu'une fois.

## Le rôle de l'agent

Je fais tourner ce projet avec un **agent** (Hermes Agent, de Nous Research) sur mon serveur
personnel. C'est la partie que je trouve la plus intéressante techniquement, et je l'ai
volontairement séparée du calcul.

**Ce que l'agent fait pour moi :**

- il **déclenche** la collecte (toutes les heures) et les rapports (quotidien, hebdomadaire, dernier
  appel) par tâches planifiées ;
- il **m'alerte sur Telegram** dès qu'une offre dépasse mon seuil, me donne le rapport du jour, me
  relance sur mes candidatures et me rappelle mes rendez-vous ;
- il **tient mon suivi de candidatures** dans une feuille de calcul (entreprise, poste, date d'envoi,
  délai de réponse, quel CV et quelle lettre sont partis, relance) ;
- il **maintient le système** : diagnostiquer une collecte en échec, ajouter une entreprise, corriger
  un critère de notation, générer mes documents de candidature ;
- il **vérifie** au lieu de décrire : quand il annonce un résultat, c'est un test ou un comptage, pas
  un adjectif.

**Ce que l'agent ne fait pas, par construction :**

- **aucun modèle de langage n'intervient dans la collecte, l'extraction ou la note.** C'est du Python
  déterministe : la même offre donne toujours la même note, et je peux la recalculer. L'agent pilote,
  il ne calcule pas ;
- **aucune candidature n'est envoyée automatiquement.** L'agent prépare le dossier, c'est moi qui
  l'envoie ;
- **aucun document de candidature n'est produit** quand une compétence n'est pas prouvée par mon
  référentiel, ou quand une vérification interne échoue (longueur, formulations interdites, dates
  cohérentes). Le générateur refuse d'écrire un fichier non conforme.

L'agent ne remplace donc pas mon travail d'ingénierie : il le rend exploitable au quotidien. Ce que
je trouve intéressant ici, ce n'est pas « une IA qui écrit du texte », c'est **un système autonome
avec des garde-fous vérifiables** : journalisation, reprise sur échec, et un contrôle croisé
permanent entre ce que le site affiche et ce que le moteur calcule.

## La note, expliquée

Chaque offre que je publie porte son bulletin : **neuf critères notés** sur 100 (technicité du poste
selon ma pile réellement maîtrisée, niveau de diplôme demandé, lieu, type de contrat, mention MIAGE,
qualité de la source, fraîcheur, cohérence des exigences, diversité des employeurs), puis **cinq
ajustements** signés :

| Ajustement | Effet | Exemple |
| --- | --- | --- |
| Niveau de diplôme | +7 à −8 | licence demandée : +7 · master exigé : −8 |
| Prérequis métier | −4 par prérequis hors profil | mécanique spatiale, sécurité, spatial |
| Compétences exigées absentes | −3 par technologie, plafonné à −9 | Angular, C++, Vue.js, Docker |
| Dates | +3 / −10 | début compatible avec ma disponibilité : +3 · trop tôt : −10 |
| Date de fin | −8 | fin au 1er octobre alors que ma rentrée est en septembre : à raccourcir |

Deux règles rendent le tout lisible : **le total affiché est la somme exacte des lignes du bulletin**
(la ligne « plafond » existe pour que ce soit vrai même quand une note est bornée), et un **bloqueur
administratif** (nationalité, habilitation de sécurité) borne la note à 55. Un site d'offres classique
ne montre pas cela ; ici, un recruteur comme un candidat peut vérifier chaque point.

## Comment ça tourne

```
   sites carrière (API ATS publiques) ─┐
   La Bonne Alternance (API publique) ─┤
   France Travail (API OAuth2) ────────┤──►  pipeline Python  ──►  SQLite
   mes alertes e-mail (LinkedIn, …) ───┘     collecte · dédoublonnage
                                             note · éligibilité
                                                     │
                                   ┌─────────────────┴───────────────┐
                                   ▼                                 ▼
                       collecteur (tools/)                   export_site.py
                                   │                                 │
                                   ▼                                 ▼
                         PostgreSQL (Neon)                  data/offers.json
                                   │                  (oracle des contrôles, secours)
                                   ▼
                         site Next.js sur Vercel

   l'agent : tâches planifiées (collecte, rapports, relances) · Telegram · feuille de suivi
```

Le site ne déclenche jamais de collecte lui-même : il lit la base que le pipeline alimente, et se
rabat sur le fichier `data/offers.json` si la base est vide ou injoignable. C'est ce qui me permet de
garder une seule chaîne observable, et de rendre le site indépendant des quotas des sources.

## Structure du dépôt

```
app/
  page.tsx                 accueil : chiffres réels, top du classement, méthode
  profil/page.tsx          mon profil : mes atouts, mes lacunes, la note de mon profil
  offres/page.tsx          liste filtrable (filtres dans l'URL, lisible sans JavaScript)
  offres/[id]/page.tsx     fiche : note expliquée, compétences, annonce, lien d'origine
  methode/page.tsx         sources, règles de collecte, fabrication de la note
components/                badges, bulletin de note, carte d'offre, simulateur, graphes
lib/scoring.ts             le calcul, 9 critères et 5 ajustements, miroir de mon moteur Python
lib/profil.ts              mon profil : compétences prouvées, atouts, lacunes
lib/offers.ts              types, libellés, fraîcheur, bandes de note
data/offers.json           l'export du pipeline : oracle des contrôles et fichier de secours
reference/                 le moteur Python, en lecture seule (il fait autorité)
scripts/verifier-scoring.mjs  le contrôle croisé TypeScript ↔ Python
db/, tools/                le schéma PostgreSQL (Neon) et le collecteur qui le remplit
v1/                        mon ancienne application, conservée hors service
```

## Les règles que je tiens dans le code

1. **Aucune donnée inventée.** Champ absent dans la source → `null` → affiché « non précisé ». Aucune
   exception, y compris pour les champs qui arrangeraient bien ma démonstration.
2. **La note n'est pas un chiffre opaque.** Chaque fiche montre son bulletin, et le total est la somme
   exacte des lignes affichées.
3. **Un type de contrat inconnu reste inconnu.** Badge « non renseigné », bloc séparé, hors du
   classement principal.
4. **Le lien vers l'annonce d'origine est toujours présent.** Mon site renvoie vers l'employeur, il ne
   recopie pas l'annonce.
5. **Le signal « formation imposée » montre son extrait.** Jamais d'accusation sans citation.
6. **La fraîcheur est datée par rapport à la collecte**, pas à l'heure d'affichage : la page reste
   statique, et vraie.

## Déploiement

Le site est servi par **Vercel** et lit ses offres dans **PostgreSQL (Neon)**. Mon serveur personnel
(VPS) fait tourner le pipeline : collecte, note, export, et le collecteur qui copie les offres vers
Neon.

- **Site** : Vercel redéploie à chaque fusion sur `main`. Avec `OFFERS_SOURCE=db`, il lit la table
  `offers` (cache de quinze minutes). Sans cette variable, ou si la base est vide ou injoignable, il
  lit `data/offers.json`.
- **Données** : `tools/collecteur_postgres.py` copie les offres de la base SQLite du pipeline vers
  Neon, et écrit une ligne dans `collectes` à chaque copie réussie : c'est la date « Dernière
  collecte » du pied de page.
- **Comptes** : connexion Google par Auth.js, sessions stockées dans Neon.
- **Procédures** : `DEPLOIEMENT.md` (commandes, ordre des étapes, retour arrière) et `db/README.md`
  (schéma, migrations).

## Preuve que ça marche

J'ai écrit le même calcul en deux langages : **Python** (mon pipeline, qui fait autorité) et
**TypeScript** (le site, qui doit afficher exactement la même chose). Deux mécanismes les empêchent de
diverger :

- `npm run verifier-scoring` compare, **offre par offre et ligne par ligne** (nom du critère, points,
  maximum et détail, accents compris), le calcul TypeScript au fichier produit par le pipeline.
  Au 22 novembre 2026 : **369 offres comparées, 0 désaccord**. `npm run verifier-eligibility` fait
  la même comparaison pour la zone, les contrats et le signal d'école ;
- mon pipeline porte **403 contrôles** internes, dont la vérification que chaque compétence citée
  dans un CV est réellement prouvée par mes projets.

Cette contrainte n'est pas décorative : elle m'a fait trouver de vrais défauts. Exemple : mon site
considérait « Docker » comme une compétence que je maîtrise et ne pénalisait pas les offres qui
l'exigent, alors que je l'avais retiré de mon référentiel, le contrôle croisé a désigné 7 offres
incohérentes, corrigées le 24 octobre 2026. Deuxième exemple, le 25 octobre : la comparaison lisait
« ML » dans « HT**ML** », donc trois offres affichaient une case verte devant une compétence que je
n'ai pas. Corrigé, et vérifié sur la page publique.

## Stack

- **Site** : Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4. Pages rendues côté serveur,
  filtres par URL **partageables et fonctionnels sans JavaScript**.
- **Données** : pipeline Python, base SQLite, copie vers PostgreSQL (Neon) par le collecteur, export
  JSON versionné (`data/offers.json`) pour les contrôles et le secours.
- **Exploitation** : Vercel (site), Neon (données), mon serveur privé (pipeline et tâches
  planifiées) ; bibliothèques Google officielles pour la lecture de mes alertes et le suivi de mes
  candidatures.
- **Tests** : Vitest (558 tests TypeScript), 27 tests Python pour le collecteur et les règles de zone,
  403 contrôles dans le pipeline ; contrôles croisés Python ↔ TypeScript.

## Lancer le projet

```bash
npm install
npm run dev                       # http://localhost:3000
npm test                          # 558 tests
npx tsc --noEmit                  # typage
npm run verifier-scoring          # contrôle croisé avec mon calcul Python (0 désaccord attendu)
npm run build && npm start        # version de production
```

Ma partie moteur (Python) est dans `reference/`, en lecture seule : c'est le pipeline qui produit
`data/offers.json`. Le site n'écrit jamais dans les données.

## Limites que j'assume

- **Le type de contrat n'est pas toujours lisible.** Beaucoup d'annonces ne précisent pas stage ou CDI.
  Je ne déguise pas ces offres en stages : elles sortent dans un bloc séparé, avec un badge, et hors du
  classement principal.
- **Le site n'invente pas les données manquantes.** Quand une annonce ne dit pas la durée ou la date de
  début, mon filtre ne peut pas trancher : l'offre est marquée « à vérifier » au lieu d'être inventée.
- **Certaines sources refusent les robots**, et je les abandonne au lieu de forcer (Safran, EDF, GRDF,
  Alten à ce jour).
- **Mon système ne postule pas à ma place.** Il prépare, il explique, il suit, je décide.

## Auteur

**Fanel Balemo** : L3 MIAGE, Université de Toulouse (2026-2027)

- GitHub : <https://github.com/Fanel-B>
- Portfolio : <https://portfolio-v2-fanel-65.vercel.app>
- LinkedIn : <https://linkedin.com/in/fanel-balemo-4479372aa>

Je développe et maintiens ce projet avec **Hermes Agent** (Nous Research), qui l'exploite au
quotidien : collecte, alertes, suivi, vérifications.
