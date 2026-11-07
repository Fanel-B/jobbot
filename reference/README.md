# `reference/` — mon moteur, en lecture seule

Ces fichiers **ne font pas partie de mon site**. Ce sont des copies de mon moteur Python, celui qui
tourne tous les jours sur mon serveur, déposées ici pour deux raisons : permettre de **recopier en
TypeScript** ma logique de notation, et pouvoir **vérifier** que la copie est fidèle.

## Ma règle d'usage

- **Je ne modifie rien ici.** Ce dossier est un document, pas du code d'application. Le vrai moteur vit
  dans mon pipeline ; une correction faite ici serait un mensonge sur ce qui tourne réellement. Quand
  mon moteur change, je resynchronise ces copies — et je le vérifie fichier par fichier.
- Je ne l'importe pas depuis `app/` ou `lib/` : c'est du Python, il ne s'exécute pas dans Next.js.
- **Une exception, voulue (6 novembre 2026) : `tools/collecteur_postgres.py` importe
  `eligibility.zone_de_lieu` depuis ce dossier.** La zone d'une offre n'a ainsi qu'une règle, celle
  du moteur, au lieu d'une copie de plus à garder synchronisée. Conséquence : ces fichiers doivent
  rester *exécutables* (voir `faits.py` plus bas), et chaque resynchronisation se vérifie avec la
  commande de `DEPLOIEMENT.md`, section « Après une resynchronisation de `reference/` ».
- Mes contrôles du pipeline (**403**) vivent avec le moteur, pas ici.

## Ce que contient chaque fichier

| Fichier | Ce qu'il calcule |
|---|---|
| `scoring.py` | six sous-scores (technicité /35, diplôme /25, lieu /15, contrat /10, MIAGE /10, source /5) et cinq ajustements |
| `priorites.py` | **mon bulletin** : les neuf critères de la note affichée sur le site, la diversité, le dédoublonnage, le coût de dépôt |
| `eligibility.py` | l'éligibilité (durée, dates, niveau, contrat), les zones géographiques, la détection « formation imposée » |
| `export_site.py` | l'export qui produit `data/offers.json` — donc **la définition exacte du format que mon site lit** |
| `faits.py` | **les faits déclarés une seule fois** : les zones (communes, départements, régions, noms ambigus, points), les paliers de fin de stage, le référentiel de compétences. `eligibility.py` et `scoring.py` l'importent. |

### État de la resynchronisation

| Fichier | État |
|---|---|
| `eligibility.py`, `scoring.py`, `export_site.py` | resynchronisés le 7 novembre 2026 d'après le diff final d'étape B (md5 `36a0fb304e828536fd2df82d7aada220`), appliqué sans décalage. Chantier zone : Toulouse, Occitanie, Île-de-France, télétravail, noms ambigus, note de date. |
| `faits.py` | présent, tel que le pipeline le livre (344 lignes, md5 `3bf6eacf262faaf27afd3eb95d0f07a7`). Ces copies s'exécutent donc seules. |
| `priorites.py` | inchangé : le bulletin affiché ne lit pas la zone. |

Les deux défauts du diff précédent sont corrigés dans le diff final : une date impossible
(« 2026-13-01 ») vaut `None` au lieu de faire planter `note_date`, et `meta.zones` de l'export compte
l'Occitanie. L'export du 7 novembre 2026 le montre (`occitanie: 1`).

**Les listes de zones du site ne sont pas recopiées de ces fichiers.** `lib/zones.generees.ts` est
produit par `python3 tools/generer_zones.py` depuis `faits.py`, et deux tests échouent s'il diverge :
après une resynchronisation de `faits.py`, relancer ce script et committer le résultat.

## Les neuf critères, et pourquoi j'en parle ici

La note que mon site affiche vient de `priorites.py`. Chaque offre publiée porte sa décomposition :

| Critère | Maximum |
|---|---|
| cohérence (exigences de l'annonce face à mon référentiel) | 30 |
| métier (technicité du poste) | 12 |
| diversité (place de l'employeur dans mon classement) | 14 |
| fraîcheur (datée par rapport à la collecte, pas à l'affichage) | 12 |
| calendrier (compatibilité avec ma disponibilité) | 8 |
| source (vérifiabilité de l'annonce) | 8 |
| fiche (complétude de l'annonce) | 6 |
| dépôt (effort de candidature) | 6 |
| dossier (ce que j'ai déjà préparé) | 4 |

Le total affiché est **la somme exacte de ces lignes**, plus cinq ajustements signés (diplôme exigé,
prérequis métier, compétences hors profil, dates, date de fin) et un plafond administratif.

## Mon oracle

Le même calcul existe en deux langages : **Python** (qui fait autorité) et **TypeScript** (mon site).
Le contrôle croisé compare, offre par offre et ligne par ligne — nom du critère, points, maximum,
détail, accents compris :

```bash
npm run verifier-scoring     # exige 0 désaccord
```

Au 7 novembre 2026 : **369 offres comparées, 0 désaccord**. Cette commande ne compare que la note
publiée (`classer`) ; les points du lieu de `scoreOffre` sont comparés au moteur par
`lib/zones-regle.test.ts`. Un portage « à peu près » rendrait ma promesse
fausse — une note est la somme exacte de ses lignes, ou elle n'est pas.

## Ce que ce portage me débloque

Une fois les critères recalculables côté site, je peux faire varier mon profil **sans rien
recollecter** : « et si j'ajoutais TypeScript ? et Docker ? » → note recalculée, nombre d'offres qui
passent au-dessus d'un seuil, avec le détail du pourquoi. C'est la fonctionnalité qui distingue mon
site d'un tableau d'annonces, et elle ne demande ni base de données ni appel de modèle.
