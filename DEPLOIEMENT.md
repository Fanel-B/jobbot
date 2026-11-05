# Déploiement et collecte

Écrit le 5 novembre 2026, **à partir du dépôt uniquement**. Je n'ai pas accès au VPS : tout ce
qui s'y passe, je le déduis de ce que le dépôt en dit, et je le marque.

Deux étiquettes reviennent partout :

- **[dépôt]** : la commande ou le fait est écrit dans le dépôt, avec le fichier qui le prouve.
- **[à vérifier sur le VPS]** : le dépôt ne permet pas de le confirmer. Ne lance rien de cette
  catégorie sans avoir regardé ce que ça donne chez toi.

Aucune commande ici n'est inventée. Quand une commande est une commande Linux ou git ordinaire
et non une commande du projet, c'est dit.

---

## 1. Le diagnostic

| Question | Réponse | D'où ça vient |
| --- | --- | --- |
| Qui écrit `data/offers.json` ? | Le script `export_site.py` du pipeline Python, qui vit sur le VPS dans `~/.hermes/skills/job-search/`. | `PASSATION.md` §4, `BRIEFING.md` ligne 21 |
| Qui le commite ? | Les commits portent « Hermes » ou « assistant-hermes », mais `PASSATION.md` écrit que Hermes n'a que la lecture sur GitHub. Le nom de l'auteur ne prouve donc pas qui a poussé. | `git log`, `PASSATION.md` ligne 137 |
| Fréquence prévue | La collecte **toutes les heures**, les rapports chaque jour et chaque semaine, et le site « rafraîchi chaque jour après la collecte ». | `README.md` lignes 73, 134, 184 |
| Fréquence réelle des commits | Neuf commits en six jours, du 19 au 25 octobre, puis **plus aucun**. Ce n'est pas un rythme quotidien. | `git log -- data/offers.json` |
| Dernière mise à jour committée | **25 octobre 2026**, commit `2a80bc4` à 17:42 UTC. Le fichier se déclare généré à 17:41 UTC. | `git log`, `meta.generated_at` |
| Ancienneté au 5 novembre | **Dix jours.** | calcul sur `meta.generated_at` |
| Que sert le site en ligne sur Vercel ? | Le fichier committé, donc les données du 25 octobre. | `vercel.json`, et le pied de page du site |
| Que sert le VPS ? | **Inconnu depuis le dépôt.** `export_site.py` écrit directement dans `~/jobbot-v2/data/offers.json` quand ce dossier existe, sans rien commiter. Le site du VPS peut donc être plus frais que GitHub, ou aussi périmé. | `reference/export_site.py`, fonction `sorties` |

**Ce que ça veut dire.** Le fichier que GitHub et Vercel connaissent est figé au 25 octobre. Que le
pipeline ait continué de tourner sur le VPS pendant ces dix jours, rien dans le dépôt ne permet de
l'affirmer ni de le nier.

---

## 2. Ce qui doit tourner sur le VPS pour que ça reprenne

Le dépôt décrit quatre pièces. Il ne contient **aucune** des quatre : ni script, ni unité `systemd`,
ni entrée de planificateur.

| Pièce | Ce que dit le dépôt | Statut |
| --- | --- | --- |
| La collecte | Elle lit les huit sources et remplit la base SQLite du pipeline, `~/.hermes/data/job-search/database.sqlite`, toutes les heures. | **[à vérifier sur le VPS]** : la commande qui la lance n'est écrite nulle part dans le dépôt. |
| L'export | `python3 export_site.py`, dans `~/.hermes/skills/job-search/`. | **[dépôt]** |
| Le rafraîchissement | Un script « réexporte les offres, reconstruit le site et redémarre le service, chaque jour après la collecte ». | **[à vérifier sur le VPS]** : son nom et son emplacement ne sont pas dans le dépôt. |
| Le service du site | Une unité `systemd`, `jobbot-site.service`, qui lance `next start` sur le port 80 sans privilège. | Le nom vient de `README.md` ligne 181. Le contenu de l'unité **[à vérifier sur le VPS]**. |

Le plus probable, et c'est une hypothèse : la collecte ou le script de rafraîchissement s'est
arrêté vers le 25 octobre. Les deux se constatent en lecture seule, voir la section 3.

---

## 3. D'abord constater, sans rien modifier

Tout est **[à vérifier sur le VPS]**. Ces commandes ne modifient rien.

```bash
# Le service du site tourne-t-il, et depuis quand ?
systemctl status jobbot-site.service

# Quelles données le site du VPS sert-il ? (chemin par défaut de export_site.py)
ls -l ~/jobbot-v2/data/offers.json
grep -m1 generated_at ~/jobbot-v2/data/offers.json

# Quelles tâches planifiées existent ? Le dépôt ne dit pas si Hermes utilise
# cron, un timer systemd ou son propre planificateur : regarde les deux premiers,
# et demande à Hermes pour le troisième.
crontab -l
systemctl list-timers
```

`systemctl`, `ls`, `grep` et `crontab` sont des commandes Linux ordinaires, pas des commandes du
projet. Si `generated_at` est postérieur au 25 octobre, le VPS a continué de se rafraîchir et c'est
GitHub qui est en retard. S'il est du 25 octobre, c'est la chaîne de rafraîchissement qui s'est
arrêtée.

---

## 4. Faire servir la dernière version de `main` sur le VPS

Les commandes `npm` sont **[dépôt]** : ce sont celles de `.github/workflows/verification.yml`, qui
passent en CI. Le nom du service vient de `README.md`. Tout le reste est **[à vérifier sur le VPS]**.

```bash
cd ~/jobbot-v2                                 # [à vérifier] voir la note 1
git status                                     # lis le résultat avant de continuer, note 2
git fetch origin
git merge --ff-only origin/main
npm ci
npm run build
sudo systemctl restart jobbot-site.service     # [à vérifier] sudo, note 3
```

**Note 1, le dossier.** `export_site.py` suppose que le site est dans `~/jobbot-v2`. Mais le site a
été déplacé à la racine du dépôt le 24 octobre (commit « Le site passe à la racine »). Vérifie que
`ls ~/jobbot-v2/package.json` répond bien. Si le clone du VPS date d'avant, il peut avoir encore
l'ancienne arborescence.

**Note 2, `git status`.** Le fichier `data/offers.json` est suivi par git, et `export_site.py`
l'écrit sur place. Il peut donc apparaître modifié sans que ce soit un problème. Si
`git merge --ff-only` refuse, **ne lance pas `git reset --hard`** : tu perdrais l'export non commité.
Garde une copie du fichier d'abord.

**Note 3, `sudo`.** L'unité tourne sans privilège, mais redémarrer un service système demande
d'ordinaire des droits. Selon la façon dont elle est installée, `systemctl --user` peut convenir à
la place. Je ne peux pas le savoir.

**Version de Node.** La CI utilise Node 22, et `package.json` n'impose aucune version. Vérifie avec
`node --version` que le VPS n'est pas sur une version plus ancienne : un `npm run build` qui échoue
au premier essai vient souvent de là.

**La connexion Google sur le VPS.** Le site a besoin de quatre variables pour `/connexion` et
`/profil` : `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` et `DATABASE_URL`. Elles sont
posées dans `.env.local` en local et dans les réglages de Vercel. Auth.js les lit par convention :
le code ne les nomme pas. **Le fichier `.env.local.example` du dépôt ne liste que `DATABASE_URL` et
`DATABASE_URL_UNPOOLED`**, ce qui est un oubli : quelqu'un qui monte le site à partir de ce modèle
ne saurait pas qu'il manque les trois autres. **[à vérifier sur le VPS]** : sont-elles présentes dans
le `.env.local` du clone ? L'adresse du VPS doit aussi être déclarée comme URI de rappel chez Google.
Aucune valeur de ces variables ne doit être écrite dans un document ou un chat.

---

## 5. Relancer la collecte et l'export

### 5.1 L'export vers le site

**[dépôt]** : `reference/export_site.py` documente ses propres options.

```bash
cd ~/.hermes/skills/job-search
python3 export_site.py
```

Sans option, le script écrit dans `web/public/data/offers.json` de son propre dossier **et**, si
`~/jobbot-v2` existe, dans `~/jobbot-v2/data/offers.json`. Ses options, dans le fichier :
`--sortie FICHIER` pour écrire ailleurs, `--tout` pour inclure les offres écartées par
l'éligibilité, `--max N` (400 par défaut).

Ensuite, pour que le site serve ce nouveau fichier, reconstruis-le et redémarre le service :

```bash
cd ~/jobbot-v2
npm run build
sudo systemctl restart jobbot-site.service     # [à vérifier] sudo, note 3 plus haut
```

**[à vérifier sur le VPS]** : la copie de `export_site.py` qui tourne là-bas est-elle identique à
celle du dépôt ? `README.md` dit que `reference/` est une copie du moteur de production. Une
commande ordinaire pour le contrôler :

```bash
diff ~/.hermes/skills/job-search/export_site.py ~/jobbot-v2/reference/export_site.py
```

### 5.2 La collecte elle-même

**[à vérifier sur le VPS]**. L'export ne fait que **relire** la base SQLite du pipeline. Si la collecte
horaire est arrêtée, l'exporter produit les mêmes offres qu'avant. La commande qui remplit cette
base n'est écrite nulle part dans le dépôt, et je n'en écris pas une pour combler le vide. Demande
à Hermes laquelle de ses tâches planifiées lance la collecte, et si elle est active.

### 5.3 Le collecteur vers Neon

**[dépôt]** : `db/README.md`, section 5, et l'en-tête de `tools/collecteur_postgres.py`. Il copie la
base SQLite vers la table `offers` de Neon. **Le site ne lit pas encore cette table** : il lit
`data/offers.json`. Relancer ce collecteur ne rafraîchit donc pas le site. Il prépare la bascule
vers la base.

Le 30 octobre, `npm run verifier-db` comptait **zéro offre** dans cette table.

```bash
cd ~/jobbot-v2                                 # racine du dépôt : db/README.md l'exige
~/.hermes/venv-jobbot-db/bin/python tools/collecteur_postgres.py --dry-run
( set -a; . ~/.hermes/.env; set +a; ~/.hermes/venv-jobbot-db/bin/python tools/collecteur_postgres.py )
```

Prérequis écrits dans `db/README.md` : l'environnement Python `~/.hermes/venv-jobbot-db` créé avec
`db/requirements.txt`, et `DATABASE_URL` dans `~/.hermes/.env` avec les droits `600`. Le premier
passage se fait **à blanc** (`--dry-run`), qui ne se connecte à rien. Le collecteur est idempotent :
le relancer ne crée pas de doublon. **[à vérifier sur le VPS]** que l'environnement et le fichier
existent toujours.

---

## 6. Mettre à jour le site en ligne sur Vercel

Le site de production sur Vercel sert le fichier **committé**. Un nouvel export sur le VPS ne le
change pas : il faut aussi commiter le fichier.

Depuis le 5 novembre, `main` est protégée, **administrateurs inclus** : plus personne ne peut y
pousser directement, il faut une pull request dont le contrôle « Tests, oracles, types et build »
est vert. Un script du VPS qui pousserait `data/offers.json` sur `main` serait donc **refusé**.
**[à vérifier sur le VPS]** : le dépôt n'indique pas si le rafraîchissement quotidien poussait sur
GitHub ou travaillait seulement sur le disque.

Pour publier un nouvel export, depuis un clone à jour du dépôt :

```bash
git switch -c donnees-AAAA-MM-JJ
# copie ici le nouvel offers.json dans data/offers.json
npm run verifier-scoring                       # [dépôt] voir la note ci-dessous
git add data/offers.json
git commit -m "Export du JJ/MM : N offres"
git push -u origin donnees-AAAA-MM-JJ
gh pr create --base main --head donnees-AAAA-MM-JJ
```

**Ne saute pas `npm run verifier-scoring`.** Il compare le calcul TypeScript du site à celui que le
pipeline a écrit dans le fichier, offre par offre. Si le pipeline a changé son barème depuis le 25
octobre, un nouvel export fera apparaître des désaccords, et c'est exactement ce qu'il est fait pour
montrer. La règle du dépôt est alors de reporter le changement dans le TypeScript avant de publier,
pas de publier malgré tout.

Une fois la pull request fusionnée, Vercel redéploie tout seul : c'est ce qui a été observé après
les poussées sur `main` des 30 octobre et 1er novembre, en vingt à quarante secondes. Le pied de
page du site affiche la date de collecte, ce qui permet de vérifier que c'est bien le nouveau
fichier qui est servi.

---

## 7. Ce que ce document ne peut pas dire

- Si la collecte horaire tourne encore sur le VPS.
- Si le rafraîchissement quotidien existe encore, comment il s'appelle, et s'il pousse sur GitHub.
- Le contenu de `jobbot-site.service`, et si le redémarrage demande `sudo`.
- Le nom réel du dossier du site sur le VPS, depuis le déplacement du 24 octobre.
- Si le VPS sert des données plus fraîches que GitHub.
- La version de Node installée, et la présence de `AUTH_SECRET`, `AUTH_GOOGLE_ID`,
  `AUTH_GOOGLE_SECRET` et `DATABASE_URL` dans le `.env.local` du site du VPS.

La première chose à faire est la section 3 : trois commandes de lecture qui disent si le problème
est la collecte, l'export, ou seulement GitHub.
