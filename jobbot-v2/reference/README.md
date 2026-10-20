# `reference/` — le moteur du pipeline, en lecture seule

Ces fichiers **ne font pas partie du site**. Ce sont des copies du moteur Python qui tourne ailleurs
(`~/.hermes/skills/job-search/`), déposées ici pour une seule raison : permettre de **recopier en
TypeScript** la logique de notation, et de **vérifier** que la copie est fidèle.

## Règle d'usage

- **Ne rien modifier ici.** Ce dossier est un document, pas du code de l'application. Le vrai moteur
  vit sur le serveur du pipeline ; une modification faite ici serait un mensonge sur ce qui tourne
  réellement en production.
- Ne pas l'importer depuis `app/` ou `lib/` : c'est du Python, il ne s'exécute pas dans Next.js.
- Les tests du pipeline (`test_pipeline.py`, ~250 tests) vivent avec le moteur, pas ici.

## Ce que contient chaque fichier

| Fichier | Ce qu'il calcule |
|---|---|
| `scoring.py` | les 6 sous-scores (stack /35, niveau /25, lieu /15, contrat /10, MIAGE /10, source /5) |
| `priorites.py` | **le bulletin** : les 9 critères de la note affichée sur le site (système 4), la diversité, le dédoublonnage, le coût de dépôt |
| `eligibility.py` | éligibilité (durée, dates, niveau, contrat), zones géographiques, détection « formation imposée » |
| `export_site.py` | l'export qui produit `data/offers.json` — donc **la définition exacte du format que le site lit** |

## Comment s'en servir comme référence (et comme oracle)

La note affichée sur le site vient de `priorites.py`, système 4. Chaque offre du JSON porte sa
décomposition :

```json
"score_breakdown": [
  {"critere": "cohérence",  "points": 30, "max": 30, "detail": "3/3 exigences"},
  {"critere": "dépôt",      "points": 5,  "max": 6,  "detail": "formulaire en 8 étapes"},
  {"critere": "fraîcheur",  "points": 5,  "max": 12, "detail": "il y a 7 jours"}
]
```

**C'est un oracle.** Pour toute logique portée en TypeScript :

1. écrire la version TypeScript ;
2. la faire tourner sur les 222 offres de `data/offers.json` ;
3. comparer avec les `points` du JSON, critère par critère ;
4. **exiger l'égalité**, et documenter toute différence comme un bug ou une décision assumée.

Un portage « à peu près » rendrait le fit dynamique faux : la promesse du site est qu'une note est
la somme exacte de ses lignes.

## Ce que le portage débloque

Une fois les critères recalculables côté site, on peut faire varier le profil **sans rien
recollecter** : « et si j'ajoutais TypeScript ? et Docker ? » → note recalculée, nombre d'offres qui
passent au-dessus d'un seuil. C'est la fonctionnalité qui distingue JobBot, et elle ne demande ni
base de données ni appel d'IA.
