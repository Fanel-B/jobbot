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
| L'écran du profil | des cases à cocher | ce que vaut ton profil, et ce que cocher changerait |
| Navigation sur téléphone | invisible | visible |
| L'aperçu dans la liste | la même accroche Airbus partout | les compétences couvertes et manquantes |

Captures, à ouvrir côte à côte :

- La fiche : [avant](docs/captures/fiche-avant.jpeg) · [après](docs/captures/fiche-apres.jpeg)
- La liste : [avant](docs/captures/liste-avant.jpeg) · [après](docs/captures/liste-apres.jpeg)
- Sur téléphone : [avant](docs/captures/mobile-avant.jpeg) · [après](docs/captures/mobile-apres.jpeg)
- Le profil vide, après : [capture](docs/captures/profil-vide-apres.jpeg)

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
regardait la même annonce ?** Si oui, il est à toi. La fraîcheur et la source n'en sont pas.
Attention : la phrase qui suivait ici, sur le calendrier et les dates « mesurés contre ta
disponibilité », était fausse. Voir l'erratum du 5 novembre en bas de ce fichier.

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

**Ce qu'il faut lire.** Le sous-total « toi » tourne autour de zéro quand tu n'as rien
confirmé, là où le total affiche encore 38,5. C'est le sous-total qui dit la vérité, et le total
qui la masquait. Voir la section 8 pour la formulation exacte : « tourne autour de zéro » et
« vaut zéro » ne sont pas la même chose, et j'avais d'abord écrit la seconde.

La colonne des valeurs distinctes dit si le classement sert à quelque chose : de 27 à 40 valeurs
différentes selon le profil, là où « diversité » n'en avait qu'une sur 290 offres.

**Le critère de fin du plan de travail est atteint.** Il demandait que deux profils, l'un à 3
compétences et l'autre à 31, diffèrent d'au moins 15 points sur la même offre. Mesuré : **26
points d'écart sur l'offre 913**, et `verifier-scoring` affiche toujours zéro. Le plan supposait
qu'il faudrait modifier le Python pour y arriver. Le regroupement a suffi.

---

## 3 bis. L'écran du profil

La page servait à cocher des cases et s'arrêtait là. Rien n'y disait ce que le profil valait sur
la collecte entière. Il fallait ouvrir une offre pour avoir une réponse, et cette réponse ne
parlait que de cette offre.

**Profil vide.** Montrer un écran de zéros n'a jamais donné envie à personne. La page montre donc
ce que cocher les cinq compétences les plus demandées changerait : **169 offres montent, de 15,3
points en moyenne, et 26 passent le seuil**. Les cinq compétences sont nommées, et les trois
offres qui gagneraient le plus sont listées avec leur lien. Ce sont de vraies offres et de vrais
calculs.

L'effet des cinq est mesuré **d'un bloc** et non compétence par compétence. Additionner des
effets séparés compterait deux fois les offres que plusieurs d'entre elles concernent, et
annoncerait un chiffre trop beau.

**Profil rempli.** Combien d'offres sont notables, combien sont dans ton premier quart, et les
lacunes classées **par effet réel** sur la collecte plutôt que par fréquence. Une techno citée
partout mais déjà couverte par ton profil ne te rapporte rien : la trier par fréquence
l'aurait pourtant mise en tête.

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

**Les tirets cadratins hors interface.** Il en reste environ cent cinquante dans les commentaires
de code et dans les libellés que produit le moteur Python. Ton brief disait de ne toucher qu'aux
textes d'interface : c'est fait, il n'en reste aucun de visible. Ceux du moteur ne peuvent pas
changer ici sans casser l'oracle.

**Un piège rencontré, à connaître.** `npm run build` a échoué en fin de nuit sur
« Module not found: @vercel/turbopack-next/internal/font/google/font ». Le message accuse les
polices Google, le réseau et le code étaient sains : c'était le cache Turbopack, corrompu par
les allers-retours entre branches. `rm -rf .next` puis rebuild, et tout repasse. Si ça
t'arrive, ne cherche pas du côté des polices.

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

---

# Correctif du 1er novembre 2026

Trois points relevés en relecture. Les deux premiers étaient des défauts réels, le troisième une
question que j'avais posée et qui a reçu sa réponse.

## 1. Trois écrans montraient le profil de Fanel à tout le monde

**Ce qu'on voyait.** Sur ma propre capture, la colonne de gauche de la fiche annonçait « Python,
déjà dans ton profil » pendant que le relevé, à droite, comptait « 0 sur 3 exigences » et mettait
4 sur 30. Les deux moitiés de la même page parlaient de deux personnes différentes.

**La cause.** La droite recalculait pour le profil connecté, la gauche lisait `offre.skills` dans
l'export. Ce champ est calculé une fois pour toutes par le pipeline, avec les 31 compétences de
Fanel figées dans le moteur. Il ne dépend pas de qui regarde.

**Ce que j'ai vérifié avant de corriger**, parce que la relecture visait trois fichiers et que
je ne voulais pas réparer ce qui n'était pas cassé :

| Écran | Verdict mesuré |
| --- | --- |
| La fiche | **cassée**. `parId(id)` rend l'offre brute, donc le champ figé. |
| La liste | déjà juste. Elle reçoit `offresPour(profil)`, qui reconstruit la couverture. |
| L'accueil | déjà juste, pour la même raison. |

Mais le fond du reproche tient, et c'est le point important : **le champ restait lisible, et je
l'avais moi-même relu dans `OfferCard` sans m'en apercevoir.** Ça ne marchait que par chance du
site d'appel. Un jour quelqu'un l'aurait relu ailleurs.

**La correction va donc plus loin que la fiche.** Le champ s'appelle maintenant
`skills_pipeline`, et le type `Offer` n'expose plus rien d'affichable. Ce qui s'affiche vient
d'un type distinct, `OffreNotee`, que seule une fonction prenant un profil peut produire. Passer
une offre brute à un composant qui affiche une couverture est désormais **une erreur de
compilation**, plus un oubli silencieux. Le compilateur a d'ailleurs désigné les trois sites
exactement, ce qui a confirmé le diagnostic.

**Le test qui aurait attrapé le défaut tout seul** est écrit : pour un même profil et une même
offre, le nombre de compétences couvertes affiché à gauche doit égaler le « x sur y exigences »
que le moteur écrit dans le relevé. Vérifié sur les 290 offres et trois profils. Un second test
exige que deux profils différents fassent bouger les deux colonnes ensemble.

Je l'ai muté pour m'assurer qu'il n'était pas creux : en rebranchant le champ figé, il échoue en
nommant le coupable, `offre 913: expected [ 'Python', 'JavaScript', 'Agile' ] to deeply equal
[]`. Ce sont exactement les trois compétences de la capture.

**La preuve visuelle**, même offre, deux profils :

| | [3 compétences](docs/captures/fiche-profil-3competences.jpeg) | [8 compétences](docs/captures/fiche-profil-8competences.jpeg) |
| --- | --- | --- |
| Colonne de gauche | « pas encore dans ton profil » | « déjà dans ton profil » |
| Relevé, à droite | 4 sur 30, 0 sur 3 exigences | 30 sur 30, 3 sur 3 exigences |
| Rang | 26e sur 191 | 1re sur 191 |

La liste aussi, pour les deux mêmes profils :
[3 compétences](docs/captures/liste-profil-3competences.jpeg) ·
[8 compétences](docs/captures/liste-profil-8competences.jpeg).

## 2. Ma phrase sur le sous-total était fausse

J'avais écrit « le sous-total toi vaut 0 quand tu n'as rien coché ». Mesuré sur les 191 offres
notables avec un profil vide :

| Mesure | Valeur |
| --- | --- |
| Moyenne | -0,18 |
| Minimum et maximum | -21 et +22 |
| Offres exactement à 0 | 10 sur 191 |
| Strictement positives | 81 |
| Strictement négatives | 100 |

La moyenne s'arrondit à zéro, donc mon tableau n'était pas faux. Ma phrase en prose, si : le
sous-total **tourne autour** de zéro, il ne vaut pas zéro. La section 3 est rectifiée.

**Et la vraie question que personne n'avait posée : un sous-total peut descendre à -21.** Un
relevé scolaire n'a pas de note négative, et le nombre nu ne veut rien dire pour qui le lit.

Mon choix : **ne pas le ramener à zéro.** Un plancher ferait afficher un sous-total qui ne serait
plus la somme de ses lignes, c'est-à-dire précisément la promesse que le produit tient et que
personne d'autre ne tient. Je garde donc le chiffre vrai et je montre d'où il vient. Sous chaque
groupe qui en a, une ligne dit « 12 gagnés et -33 retirés par les ajustements », et quand le
sous-total passe sous zéro elle ajoute : « Ce n'est pas une note sur toi : l'annonce exige plus
que ce que tu as confirmé. » Le chiffre reste négatif, mais il cesse d'être un jugement.

## 3. La fraîcheur, signalée sans retirer de points

Tu as raison, et la raison que tu nommes est meilleure que ma question : la fraîcheur n'est pas
une qualité de l'annonce au même titre que sa source, c'est la probabilité qu'elle **existe
encore**. Une offre de trois mois parfaitement adaptée vaut peut-être zéro candidature possible.

Elle n'entre donc pas dans le classement, et aucune note ne change. Au-delà du seuil, l'annonce
porte une mention : « Publiée il y a 94 jours, vérifie qu'elle est encore ouverte. »

**Le seuil est à 30 jours**, et il se justifie sur la collecte réelle plutôt que sur une
intuition. La médiane est à 10 jours, 13 annonces dépassent 30 jours, **une seule dépasse 45**.
Un seuil plus haut ne signalerait presque rien ; un seuil plus bas crierait au loup sur des
annonces fraîches. Un mois est aussi l'horizon habituel d'une offre de stage. La constante
s'appelle `SEUIL_ANNONCE_AGEE` et porte cette justification en commentaire.

## Vérifications

255 tests sur 13 fichiers, `verifier-scoring` et `verifier-eligibility` à zéro désaccord sur 290
offres, `tsc` propre, build à 300 pages. Aucun calcul n'a été modifié, et `reference/` n'a pas
été touché.

---

# Erratum du 5 novembre 2026

En réécrivant la page `/methode` à partir du code du moteur, j'ai constaté que deux choses que
j'avais écrites plus haut étaient fausses. La première change ce que le site promet.

## Une seule ligne de la note suit le lecteur

J'avais écrit que le calendrier et les dates « se mesurent contre ta disponibilité », et que le
groupe « toi » contenait ce qui change d'une personne à l'autre. **Seule la cohérence le fait.**

Mesuré dans le code : `classementPour` ne transmet au moteur que les compétences du profil. Le
niveau, la zone et le type de recherche saisis sur `/profil` n'atteignent jamais le calcul. Et le
reste du groupe « toi » est calculé contre la situation fixe de Fanel :

| Ligne | Ce qu'elle mesure vraiment |
| --- | --- |
| Calendrier, dates | début et disponibilité au 29 mars 2027 |
| Date de fin | fin de stage compatible jusqu'au 31 juillet 2027, Master en septembre 2027 |
| Diplôme | Bac+3 demandé donne un bonus, Bac+4 ou Bac+5 exigé retire 8 points (88 annonces) |
| Prérequis, compétences exigées | des référentiels fixés dans le moteur, dont une copie des compétences confirmées de Fanel |
| Dossier | les démarches enregistrées par le site, aucune : 0 partout |

Conséquence : un lecteur en Bac+5 voit « Bac+5 exigé (-8) » sur une offre qui le vise, et le
relevé affiche pourtant son niveau en en-tête. **Cet en-tête laisse croire que la note est
calculée pour ce niveau, cette zone et ce type de recherche. Elle ne l'est pas.**

Sur les 30 points de cohérence, la note suit bien le lecteur. Le reste du groupe « toi », soit 12
points de barème et tous les ajustements, est calibré sur Fanel.

**Ce que j'ai corrigé** : la phrase de l'interface qui disait « ce qui change si quelqu'un d'autre
regarde la même annonce », les commentaires de `lib/groupes.ts` qui disaient la même chose, et la
page `/methode`, qui dit maintenant la vérité. Un test vérifie que le moteur ne lit toujours que
les compétences, pour qu'on ne puisse pas rendre la page fausse en changeant le moteur.

**Ce que je n'ai pas corrigé, parce que c'est une décision et pas un correctif** : l'en-tête du
relevé affiche toujours le niveau, la zone et le type de recherche. Soit on les branche sur le
moteur (changement côté Python, avec un nouveau paramètre par profil), soit on cesse de les
afficher dans le relevé tant qu'ils n'y servent à rien.

## Le « plafond » n'est pas le plafond de groupe

Mon commentaire dans `lib/groupes.ts` décrivait la ligne « plafond » comme portant sur le groupe
d'entreprises. C'est le **plafond administratif** : la note est ramenée à 55 quand l'annonce exige
une habilitation ou une condition de nationalité. Le plafond par groupe d'entreprises a été retiré
le 21 octobre 2026, ce qui explique que la diversité vaille 14 sur 14 partout. Le rangement de la
ligne dans le groupe « l'annonce » reste correct, puisqu'elle ne lit que le texte de l'annonce.
