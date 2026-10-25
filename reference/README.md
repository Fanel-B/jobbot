# `reference/` — mon moteur, en lecture seule

Ces fichiers **ne font pas partie de mon site**. Ce sont des copies de mon moteur Python, celui qui
tourne tous les jours sur mon serveur, déposées ici pour deux raisons : permettre de **recopier en
TypeScript** ma logique de notation, et pouvoir **vérifier** que la copie est fidèle.

## Ma règle d'usage

- **Je ne modifie rien ici.** Ce dossier est un document, pas du code d'application. Le vrai moteur vit
  dans mon pipeline ; une correction faite ici serait un mensonge sur ce qui tourne réellement. Quand
  mon moteur change, je resynchronise ces copies — et je le vérifie fichier par fichier.
- Je ne l'importe pas depuis `app/` ou `lib/` : c'est du Python, il ne s'exécute pas dans Next.js.
- Mes contrôles du pipeline (**403**) vivent avec le moteur, pas ici.

## Ce que contient chaque fichier

| Fichier | Ce qu'il calcule |
|---|---|
| `scoring.py` | six sous-scores (technicité /35, diplôme /25, lieu /15, contrat /10, MIAGE /10, source /5) et cinq ajustements |
| `priorites.py` | **mon bulletin** : les neuf critères de la note affichée sur le site, la diversité, le dédoublonnage, le coût de dépôt |
| `eligibility.py` | l'éligibilité (durée, dates, niveau, contrat), les zones géographiques, la détection « formation imposée » |
| `export_site.py` | l'export qui produit `data/offers.json` — donc **la définition exacte du format que mon site lit** |

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

Aujourd'hui : **290 offres comparées, 0 désaccord**. Un portage « à peu près » rendrait ma promesse
fausse — une note est la somme exacte de ses lignes, ou elle n'est pas.

## Ce que ce portage me débloque

Une fois les critères recalculables côté site, je peux faire varier mon profil **sans rien
recollecter** : « et si j'ajoutais TypeScript ? et Docker ? » → note recalculée, nombre d'offres qui
passent au-dessus d'un seuil, avec le détail du pourquoi. C'est la fonctionnalité qui distingue mon
site d'un tableau d'annonces, et elle ne demande ni base de données ni appel de modèle.
