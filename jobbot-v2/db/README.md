# `db/` — brancher le site sur PostgreSQL (Neon)

Ce dossier prépare le passage de `data/offers.json` à une vraie base. Il contient :

| Fichier | Rôle |
|---|---|
| `schema.sql` | les tables `offers`, `users`, `profiles`, `resumes`, `saved_offers`, `ai_usage` |
| `requirements.txt` | les dépendances Python du collecteur (`psycopg` 3) |
| `../tools/collecteur_postgres.py` | copie les offres de la base SQLite du pipeline vers PostgreSQL |

Deux décisions à ne pas casser (voir `BRIEFING.md`, section 5) :

- `offers.canonical_url` est **unique** : c'est la clé du dédoublonnage, et ce qui rend le
  collecteur idempotent ;
- `offers` n'a **pas** de colonne `score` : la note dépend de qui regarde, le site la calcule à la
  lecture.

`data/offers.json` reste en place : c'est le jeu de démonstration hors ligne.

**Toutes les commandes de ce document se lancent depuis `jobbot-v2/`**, la racine du site. C'est ce
qui rend corrects les chemins `db/schema.sql`, `tools/collecteur_postgres.py` et surtout
`reference/export_site.py`, dont le collecteur recopie les règles de zone et de contrat.

---

## Règle d'or : la chaîne de connexion

La chaîne de connexion Neon contient un mot de passe. Elle vit **à un seul endroit** :
`~/.hermes/.env`, hors du dépôt. Jamais dans ce dépôt (même dans un `.env` local), jamais dans un
chat, jamais dans un ticket, jamais dans une capture d'écran.

Le collecteur la lit **uniquement** dans la variable d'environnement `DATABASE_URL` ; il n'a pas
d'option pour la passer en ligne de commande (elle finirait dans l'historique du shell), et il ne
l'affiche jamais, même dans ses messages d'erreur.

Dans tout ce document, la chaîne est notée par son gabarit :

```
postgresql://UTILISATEUR:MOTDEPASSE@HOTE/BASE?sslmode=require
```

---

## Pas à pas

### 1. Créer le projet Neon

1. Se connecter sur la console Neon et créer un projet (offre gratuite). Région : Europe
   (Francfort ou Paris), au plus près des visiteurs.
2. Garder la base par défaut ou en créer une dédiée (par exemple `jobbot`).
3. Dans **Connection details**, choisir la chaîne de connexion **directe** (sans `-pooler` dans le
   nom d'hôte) pour le collecteur et pour `psql` ; la chaîne *pooled* servira plus tard au site sur
   Vercel.
4. Copier la chaîne **directement dans le fichier de l'étape 2**, sans la coller ailleurs.

### 2. Poser `DATABASE_URL` dans `~/.hermes/.env`

```sh
# Ouvrir le fichier dans un éditeur (il est créé s'il n'existe pas) :
nano ~/.hermes/.env
```

Y ajouter une ligne, sur le modèle du gabarit, entre guillemets simples :

```sh
DATABASE_URL='postgresql://UTILISATEUR:MOTDEPASSE@HOTE/BASE?sslmode=require'
```

Puis restreindre les droits du fichier à son propriétaire :

```sh
chmod 600 ~/.hermes/.env
```

Vérifier que la variable est bien posée **sans l'afficher** :

```sh
( set -a; . ~/.hermes/.env; set +a; [ -n "$DATABASE_URL" ] && echo "DATABASE_URL définie" || echo "DATABASE_URL absente" )
```

Les commandes suivantes chargent `~/.hermes/.env` dans un **sous-shell** (les parenthèses) : la
variable n'existe que le temps de la commande et ne reste pas dans le terminal.

### 3. Installer les dépendances

Depuis la racine du dépôt :

```sh
python3 -m venv ~/.hermes/venv-jobbot-db
~/.hermes/venv-jobbot-db/bin/pip install -r db/requirements.txt
```

Il faut aussi le client `psql` (paquet `postgresql-client` sous Debian / Ubuntu) pour les étapes 4
et 6.

### 4. Appliquer le schéma

```sh
( set -a; . ~/.hermes/.env; set +a; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql )
```

Le schéma est rejouable (`IF NOT EXISTS` partout, aucune suppression) : le relancer ne casse rien.
Il s'exécute dans une transaction : en cas d'erreur, rien n'est créé.

Vérifier que les six tables sont là :

```sh
( set -a; . ~/.hermes/.env; set +a; psql "$DATABASE_URL" -c '\dt' )
```

### 5. Lancer le collecteur

D'abord à blanc — **aucune connexion** à PostgreSQL, `DATABASE_URL` n'est même pas lue :

```sh
~/.hermes/venv-jobbot-db/bin/python tools/collecteur_postgres.py --dry-run
```

Il lit `~/.hermes/data/job-search/database.sqlite` (en lecture seule), table `offers`, statut
`to_review`, et montre un aperçu des offres qui seraient écrites, puis un résumé (lues, à écrire,
ignorées et pourquoi).

Puis pour de vrai :

```sh
( set -a; . ~/.hermes/.env; set +a; ~/.hermes/venv-jobbot-db/bin/python tools/collecteur_postgres.py )
```

Le résumé final donne : offres **lues**, **insérées**, **mises à jour**, **inchangées**,
**ignorées** (avec la raison : sans `canonical_url`, doublon dans SQLite, compétences illisibles).

Options utiles :

| Option | Effet |
|---|---|
| `--dry-run` | montre ce qui serait écrit, sans se connecter |
| `--sqlite CHEMIN` | une autre base SQLite que celle par défaut |
| `--statut STATUT` | un autre statut que `to_review` |
| `--apercu N` | nombre d'offres montrées par `--dry-run` |

**Idempotence.** L'écriture est un « insérer ou mettre à jour » sur `canonical_url`, dans une
seule transaction. Relancer le collecteur juste après donne `insérées : 0`, `mises à jour : 0` et
toutes les offres en `inchangées`. Une mise à jour ne recule jamais les dates : on garde la plus
ancienne première collecte et la plus récente dernière collecte. Le collecteur n'efface aucune
offre de PostgreSQL.

### 6. Vérifier le nombre de lignes

```sh
( set -a; . ~/.hermes/.env; set +a; psql "$DATABASE_URL" -c "
  SELECT count(*) AS offres,
         count(DISTINCT canonical_url) AS urls_distinctes,
         count(*) FILTER (WHERE NOT contract_known) AS sans_contrat
  FROM offers;" )
```

Attendu :

- `offres` = `urls_distinctes` (la contrainte d'unicité le garantit) ;
- `offres` = la somme `insérées` des passages du collecteur ;
- après une relance immédiate du collecteur, `offres` ne bouge pas.

Pour comparer avec la base du pipeline (lecture seule) :

```sh
sqlite3 "file:$HOME/.hermes/data/job-search/database.sqlite?mode=ro" \
  "SELECT count(DISTINCT canonical_url) FROM offers WHERE status = 'to_review' AND trim(coalesce(canonical_url, '')) <> '';"
```

Ce nombre est égal à `insérées + mises à jour + inchangées` du dernier passage (hors offres
ignorées pour compétences illisibles, comptées dans le résumé).

Répartition par zone, à rapprocher de `meta.zones` dans `data/offers.json` :

```sh
( set -a; . ~/.hermes/.env; set +a; psql "$DATABASE_URL" -c "SELECT location_zone, count(*) FROM offers GROUP BY 1 ORDER BY 2 DESC;" )
```

Les chiffres ne seront pas identiques : le JSON contient aussi les offres sans type de contrat
plafonnées à 40 et toutes les offres non rejetées, alors que le collecteur prend le statut
`to_review`.

---

## Ce qui reste à faire ensuite (hors de ce dossier)

- Le site lit PostgreSQL au lieu de `data/offers.json` et calcule la note en TypeScript au rendu
  (portage de `reference/priorites.py`, vérifié contre le JSON comme oracle).
- Les tables propres à Auth.js (comptes OAuth, sessions, jetons) s'ajoutent avec l'adaptateur
  choisi ; `users` est déjà là.
- Le signal « formation imposée » et son extrait ne sont pas encore copiés : ils dépendent de
  `eligibility.partner_school_match`, à porter ou à exporter par le pipeline.
