# La nuit du 31 octobre 2026

Branche `nuit-notation-design`. Quatre commits, 249 tests verts, les deux oracles à zéro
désaccord sur 290 offres. Rien n'a été recalculé : le moteur Python reste la référence, et
`npm run verifier-scoring` affiche toujours zéro.

Lis dans l'ordre. Les trois premières sections suffisent à comprendre ce qui a changé et
pourquoi. Les suivantes sont pour quand tu voudras continuer.

---

## 1. Ce que j'ai changé

| | Avant | Après |
| --- | --- | --- |
| Le bulletin | 15 lignes en vrac | deux groupes, « toi » et « l'annonce », avec leurs sous-totaux |
| En tête de fiche | 54 sur 100 | « 26e sur 191, dans le premier quart », puis la note |
| Dans la liste | une note nue | le rang, la note en appui, et ce que tu as face à ce qui te manque |
| Les 99 annonces muettes | notées comme les autres | un bloc à part, hors classement, avec son explication |
| Sous le relevé | rien | une observation : ce qui te manque, et ce que cocher changerait |
| « diversité » et « dossier » | 18 points invisibles | grisés, annotés « ne départage aucune offre » |
| 26 offres sans lieu | « Ailleurs en France » | « Lieu non précisé » |
| Navigation sur téléphone | invisible | visible |
| L'aperçu dans la liste | la même accroche Airbus partout | les compétences couvertes et manquantes |

Captures, à ouvrir côte à côte :

- La fiche : [avant](docs/captures/fiche-avant.jpeg) · [après](docs/captures/fiche-apres.jpeg)
- La liste : [avant](docs/captures/liste-avant.jpeg) · [après](docs/captures/liste-apres.jpeg)
- Sur téléphone : [avant](docs/captures/mobile-avant.jpeg) · [après](docs/captures/mobile-apres.jpeg)

Les captures « avant » viennent du site en production, qui sert encore `main`.

---

## 2. La notation : ce que je propose, et pourquoi

### Le problème en une phrase

Le site promettait « les offres qui te correspondent vraiment », et son chiffre ne mesurait pas
la correspondance. Sur cent points, trente seulement regardaient la personne. Les soixante-dix
autres notaient l'annonce, à l'identique pour tout le monde. D'où ton 67 avec trois compétences :
soixante-quatre venaient de l'annonce, trois de toi.

### Ce que j'ai construit

**Deux sous-totaux dans la forme du relevé.** L'hypothèse de ton brief était la bonne, et
l'objection qu'on avait notée tombe dès qu'on regarde un vrai bulletin : il porte des moyennes
par groupe de matières, puis une moyenne générale. La convention autorisait donc exactement ce
dont le produit avait besoin.

Le départ entre les deux groupes se fait sur une seule question, et c'est elle qui rend le
rangement vérifiable plutôt qu'arbitraire : **ce chiffre changerait-il si quelqu'un d'autre
regardait la même annonce ?** Si oui, il est à toi. Le calendrier et les dates en sont, parce
qu'ils se mesurent contre ta disponibilité. La fraîcheur et la source n'en sont pas.

Sur l'offre 913, avec trois compétences : 7 sur 42 côté toi, 47 sur 58 côté annonce, total 54.
Le même 54 qu'avant, mais on voit enfin d'où il vient.

**Le rang avant la note.** C'est la vraie réponse au découragement, et elle ne coûte pas un mot
de vérité. « 26e sur 191, dans le premier quart » et « 54 sur 100 » décrivent la même réalité.
Un étudiant sait quoi faire d'un rang. Il ne sait pas quoi faire d'un 54.

**Les annonces qu'on ne peut pas noter sortent du classement.** Quatre-vingt-dix-neuf sur deux
cent quatre-vingt-dix ne citent aucune technologie. Leur correspondance n'est pas faible : elle
est incalculable. Leur donner des points par défaut revenait à prétendre avoir vérifié ce qui ne
l'avait pas été. Elles ont leur bloc, leur phrase, et restent affichées, parce qu'une bonne offre
peut être mal rédigée.

**L'observation, sous le chiffre.** « Il te manque Python, JavaScript, Agile sur cette offre.
Cocher Python ferait monter 71 offres de la collecte. » Construite sur des données réelles
uniquement, et sur l'effet mesuré d'une compétence sur toute la collecte, jamais sur une seule
annonce : apprendre une techno pour une offre est un mauvais calcul, l'apprendre pour vingt en
est un bon.

### Une correction que la capture d'écran a révélée

J'avais d'abord classé sur le total. La fiche annonçait alors « 11e meilleure correspondance »
alors que le total est aux sept dixièmes la qualité de l'annonce : c'était « 11e meilleure
annonce ». J'aurais refait le défaut que je réparais. Le classement se fait maintenant sur les
points personnels, la qualité de l'annonce ne servant qu'à départager les ex aequo, et la liste
suit le même ordre. Un test interdit désormais de revenir en arrière sans s'en apercevoir.

C'est le genre de défaut qui ne se voit pas en relisant du code. Il s'est vu en regardant l'écran.

### Ce que j'ai écarté, et pourquoi

**Retirer « diversité » et « dossier » du total**, comme ton brief le demandait en premier choix.
Ces dix-huit points ne mesurent rien : quatorze sur quatorze et zéro sur quatre sur les 290
offres. Mais les retirer donnerait une note sur 82, c'est-à-dire **un chiffre affiché par le site
qui ne serait plus celui que calcule le moteur Python**. Pour un projet dont toute l'identité
tient à ce que les deux s'accordent, c'était payer trop cher une amélioration cosmétique. Ton
brief prévoyait ce repli et je l'ai pris : ils sont grisés et annotés « ne départage aucune
offre ». La section 6 dit ce qu'il faut changer en Python pour aller au bout.

**Transformer « diversité » en avertissement « tu as déjà 4 offres Airbus dans ta liste ».** Je
ne l'ai pas fait parce que la donnée n'existe pas : il n'y a pas de liste d'offres mises de côté
dans le produit. Le détail que produit le moteur parle du rang de l'entreprise dans la collecte,
pas de tes candidatures. L'écrire aurait été inventer.

**Une échelle non numérique**, du genre « bonne piste » sans chiffre. Le rang fait le même
travail sans renoncer à la précision, et renoncer au chiffre aurait détruit la seule promesse
que le produit tient et que personne d'autre ne tient.

---

## 3. Les chiffres

Mesurés sur les 191 offres notables, pas estimés. Le sous-total « toi » est sur 42.

| Profil | « toi » moyen | « toi » max | valeurs distinctes | total moyen |
| --- | --- | --- | --- | --- |
| 0 compétence | 0 | 22 | 27 | 38,5 |
| 3 compétences | 1,3 | 27 | 32 | 40,0 |
| 10 compétences | 7,2 | 33 | 38 | 45,9 |
| 31 compétences | 8,4 | 35 | 40 | 47,0 |

**Ce qu'il faut lire.** Le sous-total « toi » vaut zéro quand tu n'as rien confirmé. Le total,
lui, affiche encore 38,5. C'est le sous-total qui dit la vérité, et le total qui la masquait.

La colonne des valeurs distinctes dit si le classement sert à quelque chose : de 27 à 40 valeurs
différentes selon le profil, là où « diversité » n'en avait qu'une sur 290 offres.

**Le critère de fin du plan de travail est atteint.** Il demandait que deux profils, l'un à 3
compétences et l'autre à 31, diffèrent d'au moins 15 points sur la même offre. Mesuré : **26
points d'écart sur l'offre 913**, et `verifier-scoring` affiche toujours zéro. Le plan supposait
qu'il faudrait modifier le Python pour y arriver. Le regroupement a suffi.

---

## 4. Le design

### Pourquoi le relevé reste

C'est la meilleure idée du projet et je n'y ai pas touché. Tout étudiant d'ici sait lire un
relevé sans mode d'emploi, et aucun autre site d'emploi ne l'emploie. Il a surtout une propriété
qu'aucune autre forme n'a : **il rend la promesse du produit vérifiable à l'oeil.** Le filet
double au-dessus du total est la convention comptable qui annonce une addition. La page invite à
refaire le calcul, et il tombe juste.

### Ce que j'ai regardé, et ce que j'en ai rapporté

Honnêtement : j'ai ouvert deux des quatre galeries de ta liste, CSS Design Awards et la catégorie
typographie d'Awwwards. Une fenêtre de cookies couvrait une partie de la seconde.

Ce que j'y ai vu ne m'a pas servi, et c'est une information en soi. Les sites primés y sont
sombres, photographiques, cinétiques : ils récompensent le spectacle. Un relevé de notes est
l'inverse, et copier leur concept aurait détruit le nôtre. Je n'ai donc rien à t'y citer
d'honnête, et je préfère te le dire plutôt que d'inventer une liste d'influences.

Le travail typographique vient d'ailleurs, et c'est documenté : du relevé mesuré du site que tu
m'avais donné, dans `design/cedaorg.net.md`, et des conventions du document comptable. Les deux
principes réellement appliqués cette nuit :

- **Les chiffres s'alignent en colonne**, en chiffres tabulaires. Aucune note ne danse d'une
  ligne à l'autre. C'est ce qui sépare un relevé d'un tableau HTML.
- **Un filet simple sépare, un filet double conclut.** La hiérarchie des traits porte le sens
  à la place de la couleur.

Les quatre galeries restent à regarder sérieusement, et ce serait mieux fait de jour, par toi.

### Le téléphone

Le relevé est un tableau à trois colonnes et personne ne l'avait regardé sur un écran de 390
pixels. En dessous du seuil, le nom du critère prend sa ligne et la note se replie contre le
barème à droite, sous la forme « 4 /30 ». Aucun défilement horizontal. Les captures mobiles
ci-dessus montrent les deux états.

---

## 5. Ce que je n'ai pas pu faire

**Déployer la branche à côté de la production.** Le déploiement décrit dans le README est un
service `systemd` sur ton VPS, et je n'y ai pas accès depuis cette machine. Les captures d'écran
remplacent la comparaison côte à côte. Pour la monter toi-même, la branche est poussée et
`npm run build` passe.

**L'écran du profil.** La section de ton brief sur `/profil` n'est pas faite : montrer l'effet
de chaque compétence sur toute la collecte, classer les lacunes par impact, et donner envie de
cocher à quelqu'un qui arrive. Le calcul existe déjà (`lacunesRegroupees`, `effetGlobalPour`),
c'est l'écran qui manque. C'était le dernier point de ta liste de priorités et la nuit s'est
arrêtée avant.

**Les tirets cadratins hors interface.** Il en reste environ cent cinquante dans les commentaires
de code et dans les libellés que produit le moteur Python. Ton brief disait de ne toucher qu'aux
textes d'interface : c'est fait, il n'en reste aucun de visible. Ceux du moteur ne peuvent pas
changer ici sans casser l'oracle.

**Un détail que je laisse ouvert.** Le filtre de lieu affiche toujours « Ailleurs en France 29 »,
alors que 26 de ces 29 offres n'ont simplement aucun lieu. La pastille de chaque offre dit
maintenant « Lieu non précisé », mais l'intitulé du filtre reste trompeur. Le corriger
proprement demande de distinguer « ailleurs » et « inconnu » dans `zoneDe`, donc côté Python.

---

## 6. Ce qu'il faudrait changer côté Python

Précis, pour que tu puisses le demander sans écrire de code.

**1. Retirer « diversité » du barème.** Elle vaut 14 sur 14 sur les 290 offres : elle ne
départage rien et gonfle le total de quatorze points. Soit la supprimer, soit lui faire noter ce
qu'elle prétend mesurer, c'est-à-dire la concentration réelle des candidatures. Le total passerait
de 100 à 86.

**2. Retirer « dossier » du barème**, pour la même raison : 0 sur 4 partout. Quatre points de
plus. Avec le premier point, le total serait sur 82.

**3. Déclarer explicitement les annonces incalculables.** Aujourd'hui, une annonce sans aucune
technologie reçoit des points de cohérence par défaut. Il faudrait qu'elle sorte `null` plutôt
qu'un nombre, et que l'export porte un champ disant que la correspondance n'est pas mesurable.
Le site le devine actuellement en regardant si la liste d'exigences est vide, ce qui marche mais
reste une déduction.

**4. Distinguer « ailleurs en France » de « lieu inconnu »** dans le calcul de zone. Vingt-six
offres sans lieu tombent aujourd'hui dans « autre », ce qui est raisonnable pour le moteur mais
indistinguable d'une vraie offre située hors des deux zones suivies.

Dans tous les cas : modifier le Python, réexporter `data/offers.json`, resynchroniser
`reference/`, puis reporter en TypeScript et relancer `verifier-scoring` jusqu'au zéro. C'est la
règle du dépôt et elle vaut pour ces quatre points.

---

## 7. Trois questions

**1. Le classement se fait sur la correspondance seule. Est-ce ce que tu veux ?**
Aujourd'hui, une offre parfaitement adaptée mais vieille de trois mois et mal rédigée passe
devant une offre fraîche d'un bon employeur qui te correspond un peu moins. C'est défendable, et
c'est discutable. L'autre option serait de pondérer, mais pondérer veut dire choisir un poids, et
tout poids est arbitraire tant qu'on ne l'a pas justifié.

**2. Faut-il afficher le sous-total « l'annonce » du tout ?**
Il ne change jamais d'un lecteur à l'autre. On pourrait le sortir de la note et le réduire à des
étiquettes (« source officielle », « fiche complète »). Le relevé y gagnerait en lisibilité et
perdrait la propriété qui fait sa force : être une addition complète et vérifiable.

**3. Les 99 annonces muettes : les garder sur la page, ou les sortir de la collecte ?**
Elles sont maintenant hors classement mais toujours affichées. Un tiers de la page sert donc des
offres qu'on ne sait pas évaluer. Si tu préfères un site plus court et plus sûr, le pipeline peut
les écarter à la collecte. Je ne l'ai pas décidé à ta place parce que jeter un tiers des offres
n'est pas un réglage d'affichage.
