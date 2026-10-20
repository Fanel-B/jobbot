# JobBot V2

Trouver les offres d'alternance et de stage qui correspondent vraiment à un profil : les agréger,
expliquer **pourquoi** elles correspondent, et dire **quoi travailler** pour celles qui ne
correspondent pas encore.

Ce dépôt contient le site. Le moteur de collecte et de notation tourne à part (pipeline Python) et
produit `data/offers.json`, que le site lit.

---

## État actuel

**Fait — l'esthétique et la chaîne de données de bout en bout.**

- identité visuelle complète : fond papier, encre, un seul accent, couleurs sémantiques réservées à
  la note, typographie (serif pour les titres, Inter pour l'interface), chiffres tabulaires ;
- **vraies offres** : `data/offers.json` est produit par le pipeline, aucune donnée de démonstration ;
- quatre écrans : accueil, liste filtrable, fiche d'offre, méthode ;
- la note est **expliquée** : neuf critères, chacun avec ses points et son maximum, et le total
  affiché correspond exactement à la note du pipeline ;
- les offres dont la source ne donne pas le type de contrat sont affichées dans un **bloc séparé**,
  avec un badge distinct — jamais déguisées en stages ;
- filtres par lieu, type de contrat, source, note minimale et tri, en liens simples : les URL sont
  partageables et la page fonctionne sans JavaScript ;
- **en ligne** sur un serveur personnel : <http://148.113.247.10/> (voir « Déploiement » plus bas) ;
- les offres sont réexportées et le site reconstruit **automatiquement chaque jour**.

**Reste à faire** (cahier de route, tranches 2 et 3) : comptes et profils, score recalculé selon
l'utilisateur, dépôt de CV et CV adapté, fit dynamique (« et si tu ajoutais TypeScript ? »).

---

## Lancer le site

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
```

Pour régénérer les données affichées, depuis le dossier du pipeline :

```bash
python3 export_site.py
```

Le script relit la base, recalcule la note et son détail pour chaque offre, puis écrit le JSON dans
le site. Il ne fabrique rien : un champ absent dans la source sort à `null` et s'affiche
« non précisé ».

---

## Structure

```
app/
  page.tsx                 accueil : chiffres réels, top du classement, méthode, lacunes du profil
  offres/page.tsx          liste filtrable (filtres par URL, en suspense)
  offres/[id]/page.tsx     fiche : note expliquée, compétences, annonce, lien d'origine
  methode/page.tsx         sources, règles de collecte, fabrication de la note, refus assumés
components/
  Chips.tsx                badges (source, zone, contrat, fraîcheur, signal formation)
  ScoreBadge.tsx           note + barre d'un critère
  Bulletin.tsx             décomposition de la note
  OfferCard.tsx            ligne de liste et carte compacte
lib/offers.ts              types, libellés, fraîcheur, bandes de note
data/offers.json           offres réelles exportées par le pipeline
```

## Règles tenues par le code

1. **Aucune donnée inventée.** Champ absent → `null` → affiché « non précisé ». Aucune exception.
2. **La note n'est pas un chiffre opaque.** Chaque fiche montre son bulletin, et le total est la
   somme exacte des critères.
3. **Un type de contrat inconnu reste inconnu.** Badge « non renseigné », bloc séparé, hors du
   classement principal.
4. **Le lien vers l'annonce d'origine est toujours présent.** Le site renvoie vers l'employeur, il ne
   recopie pas l'annonce.
5. **Le signal « formation imposée » montre son extrait.** Jamais d'accusation sans citation.
6. **La fraîcheur est datée par rapport à la collecte**, pas à l'heure d'affichage — la page reste
   donc statique et vraie.

## Déploiement

**En ligne : <http://148.113.247.10/>** — sur un serveur personnel (VPS), pas sur Vercel.

- **Service** : unité systemd `jobbot-site.service`, qui lance `next start` sur le port 80 en tant
  qu'utilisateur non privilégié (capacité `CAP_NET_BIND_SERVICE`, redémarrage automatique). L'unité
  ne contient **aucun secret**.
- **Fraîcheur** : le script `jobbot-site-refresh.sh` réexporte les offres depuis le pipeline,
  reconstruit le site et redémarre le service. Il tourne chaque jour après la collecte et **reste
  silencieux quand tout va bien** : il ne parle qu'en cas de problème.
- **Pourquoi pas Vercel** : le site est statique et alimenté par des données produites ailleurs ; un
  service systemd sur le serveur qui fait tourner la collecte évite un aller-retour réseau et garde
  la chaîne observable d'un seul endroit.

**Étape suivante** : PostgreSQL (Neon) et comptes — voir `db/README.md`. Le site ne déclenche jamais
de collecte lui-même : les sources publiques ont des quotas, c'est le pipeline qui décide.
