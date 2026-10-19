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
  partageables et la page fonctionne sans JavaScript.

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

Prévu sur Vercel, base PostgreSQL (Neon) et comptes via Auth.js à l'étape suivante. La collecte
tournera séparément (le site ne déclenche jamais de collecte : les sources publiques ont des quotas).
