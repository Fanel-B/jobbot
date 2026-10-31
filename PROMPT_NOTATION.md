# Conseil demandé : une note de correspondance qui ne distingue personne

Tu n'as pas accès au dépôt. Tout ce qu'il te faut est ci-dessous. Les chiffres sont mesurés, pas
estimés : ils viennent de l'exécution du moteur sur les 290 offres réelles de la collecte.

## Le produit

JobBot. Un étudiant en MIAGE à Toulouse (Fanel, L3, cherche un stage) a construit un site qui
collecte de vraies offres de stage et d'alternance en France, les note contre son profil, et
explique chaque note critère par critère. Il vise une version présentable à des recruteurs et à
d'autres étudiants, donc commerciale au sens de « crédible pour un inconnu ».

Un collecteur Python relève les annonces chez LinkedIn, France Travail, La Bonne Alternance et les
sites carrière d'Airbus, Thales, Sopra Steria, Capgemini, Atos, CNES. 290 offres au dernier export,
dont 252 à Toulouse et 4 en Île-de-France.

Le site est en Next.js 16.4 (TypeScript). Le moteur de notation a été **porté** du Python vers le
TypeScript, et un script de vérification compare ligne à ligne les deux implémentations sur les
290 offres : **zéro désaccord**. C'est la contrainte la plus importante de ce qui suit.

## Les règles que le projet s'est données

Elles ont été posées au début et tenues depuis. Elles ne sont pas négociables sans raison forte.

1. **Aucune donnée inventée.** Pas d'offre de démonstration, pas de chiffre illustratif, pas de
   logo d'entreprise qui n'a rien demandé.
2. **Le total est exactement la somme des lignes du bulletin.** Pas de coefficient caché, pas
   d'arrondi de faveur. C'est la promesse différenciante du produit.
3. **Une compétence jamais confirmée par la personne ne compte jamais.** Rien n'est deviné depuis
   un CV.
4. **Un contrat non renseigné reste non renseigné.** On n'extrapole pas.
5. **Le lien vers l'annonce d'origine est toujours présent.** Le site renvoie vers l'employeur, il
   ne se substitue pas à lui.
6. **Interface et commentaires en français.**

## Le barème actuel, sur 100

Neuf critères qui rapportent, et six ajustements dont le maximum est zéro et qui ne peuvent que
retrancher.

| Critère | Maximum | Ce qu'il mesure |
|---|---|---|
| cohérence | 30 | part des technos de l'annonce que la personne a cochées |
| diversité | 14 | éviter d'envoyer dix candidatures à la même entreprise |
| métier | 12 | le poste visé correspond-il |
| fraîcheur | 12 | ancienneté de l'annonce |
| source | 8 | fiabilité de la source |
| calendrier | 8 | dates compatibles avec l'année universitaire |
| dépôt | 6 | facilité de candidature |
| fiche | 6 | complétude de l'annonce |
| dossier | 4 | pièces demandées |
| fin, dates, prérequis, compétences, diplôme, plafond | 0 chacun | ajustements négatifs |

## Le problème, mesuré

Le site annonce « les offres qui te correspondent vraiment ». Fanel a coché **3 compétences** et a
obtenu **67/100** sur une offre. Il a trouvé ça suspect. Il avait raison.

Note totale selon la richesse du profil, sur les 290 offres :

| Profil | moyenne | min | max | offres ≥ 65 |
|---|---|---|---|---|
| aucune compétence cochée | 42,6 | 17 | 64 | 0 |
| 3 compétences | 43,6 | 17 | 67 | 3 |
| 10 compétences | 47,5 | 20 | 76 | 10 |
| 31 compétences | 48,2 | 20 | 80 | 17 |
| les 75 du catalogue | 55,4 | 30 | 90 | 60 |

**Avec zéro compétence, la moyenne est déjà 42,6 et le maximum 64.** Les 3 compétences de Fanel ont
ajouté **+1 point en moyenne, +3 au maximum**. Son 67 vient à ~64 de la base et à ~3 de lui.

D'où viennent les points quand on n'a rien coché, en moyenne par critère :

```
diversité     14,0 / 14      ← le maximum, toujours
métier         9,5 / 12
cohérence      6,6 / 30      ← des points de compétence sans compétences
source         5,0 /  8
dépôt          3,7 /  6
calendrier     3,4 /  8
fiche          2,8 /  6
fraîcheur      2,4 / 12
dossier        0,0 /  4
plafond       -9,0 /  0
(autres ajustements)  -4,7
TOTAL         33,7 / 100
```

Trois anomalies :

1. **« diversité » rend une seule valeur distincte sur 290 offres : 14/14 pour tout le monde,
   toujours.** Un critère qui note tout le monde pareil ne mesure rien. C'est 14 points de
   remplissage dans le total.
2. **« cohérence » paie sans compétences** : 69 offres donnent 15/30 et 30 offres donnent 10/30 à
   quelqu'un qui n'a rien coché. Raison probable : **99 offres sur 290 (34 %) ne citent aucune
   technologie détectable**, et le barème leur accorde des points par défaut plutôt que de
   déclarer qu'il ne peut pas se prononcer.
3. **Sur 100 points, 30 seulement concernent la personne.** Les 70 autres notent la qualité de
   l'annonce : fraîcheur, source, complétude. Ce sont des informations réelles et utiles, mais
   elles ne varient pas d'un utilisateur à l'autre.

## Une piste déjà testée

Regrouper les lignes **déjà calculées** en deux sous-totaux, sans rien recalculer. L'oracle reste
donc valide par construction.

- **« Toi »** : cohérence, calendrier, dossier, dates, et les ajustements prérequis / diplôme /
  compétences / plafond.
- **« L'offre »** : diversité, métier, fraîcheur, source, dépôt, fiche, fin.

Résultat mesuré :

| Profil | TOI moy | TOI max | TOI ≥ 65 | OFFRE moy |
|---|---|---|---|---|
| aucune | 16,6 | 62 | 0 | 64,2 |
| 3 compétences | 18,3 | 64 | 0 | 64,2 |
| 10 compétences | 25,6 | 79 | 1 | 64,2 |
| 31 compétences | 27,2 | 79 | 4 | 64,2 |
| les 75 | 43,2 | 98 | 26 | 64,2 |

« Toi » discrimine enfin. « L'offre » ne bouge jamais, ce qui est correct : la qualité d'une
annonce ne dépend pas de qui la regarde.

Le prix à payer : avec 3 compétences, l'écran affiche **18/100** au lieu de 67. C'est vrai, et
c'est décourageant. Pour un produit censé donner envie de postuler, ce n'est pas un détail.

## Ce qui a été trouvé dans la littérature

- Un nombre unique ne peut pas dire ce qui manque ; des dimensions séparées le peuvent.
- Dire **à côté du nombre** ce qu'il ne signifie pas : ce n'est pas une prédiction d'embauche.
- Séparer le calcul déterministe de sa narration, pour que le texte ne gonfle pas le classement.

## Les contraintes qui interdisent les réponses faciles

- **Changer l'arithmétique casse l'oracle.** Le script de vérification compare le TypeScript au
  Python sur chaque ligne de chaque bulletin. Toute modification du calcul doit donc être faite
  d'abord dans le pipeline Python, ou assumée comme une divergence délibérée avec sa propre
  vérification. Ce n'est pas impossible, c'est un coût à nommer.
- **La règle « le total est la somme des lignes »** interdit de pondérer après coup ou de masquer
  un critère du total tout en le gardant dans le bulletin.
- **« diversité » n'est pas une erreur de calcul** : le pipeline la calcule ainsi. La question est
  de savoir si elle a sa place dans une note de correspondance.
- Le site ne doit pas mentir, y compris par omission ou par présentation flatteuse.

## La forme dans laquelle ta réponse devra tenir

Ceci n'est pas un détail d'habillage : c'est une contrainte sur les réponses possibles.

Le site vient d'adopter la forme du **relevé de notes scolaire français**. C'est le document que
tout étudiant d'ici sait lire sans mode d'emploi, et aucun autre site d'emploi ne l'emploie. La
fiche d'une offre affiche donc aujourd'hui :

```
RELEVÉ DE CORRESPONDANCE                            74
Bac+3 · stage · Toulouse et alentours              /100
6 compétences confirmées                  Correspondance solide
──────────────────────────────────────────────────────────────
CRITÈRE                                      NOTE      BARÈME
Cohérence avec ton profil                      24          30
  2/3 exigences + TechScope
Métier visé                                    12          12
Qualité de la source                            8           8
Fiche complète                                  6           6
Calendrier compatible                           8           8
Coût du dépôt                                   2           6
Dossier déjà prêt                               0           4
Fraîcheur de l'offre                            5          12
Diversité des candidatures                     14          14
──────────────────────────────────────────────────────────────
AJUSTEMENTS · −5 POINTS
Niveau de diplôme exigé                        −8           —
Dates de disponibilité                         +3           —
Prérequis métier                                0           —
══════════════════════════════════════════════════════════════
TOTAL                                          74         100
Appréciation                            Bonne piste

Additionne la colonne « Note » : tu dois retrouver 74. Aucun coefficient
caché, aucun arrondi de faveur. Ce chiffre dit la correspondance avec ton
profil, pas tes chances d'être recruté : cette décision appartient à
l'employeur.
```

Quatre décisions déjà prises, que ta réponse peut contester mais doit prendre en compte :

1. **Les critères qui rapportent et les ajustements qui retranchent sont séparés.** Mêlés, ils
   produisaient des lignes « 0 sur 0 » qu'on lisait comme un bug d'affichage. Les ajustements ont
   leur section, leur somme annoncée, et un tiret dans la colonne barème puisqu'il n'y en a pas.
2. **Le filet double au-dessus du total** est la convention comptable qui annonce une addition.
   C'est ce qui transforme la promesse « le total est la somme des lignes » en démonstration
   vérifiable à l'œil, et la page invite à refaire le calcul.
3. **Une phrase écarte la mauvaise lecture**, juste sous le total.
4. **Une appréciation en un mot** accompagne le chiffre. Elle suit la bande déjà calculée et
   n'ajoute aucun jugement nouveau.

**Pourquoi ça compte pour ta réponse.** Un relevé scolaire n'a jamais montré qu'un nombre : il
porte une moyenne, une appréciation, et une observation du professeur. C'est peut-être la réponse
à la question du score honnêtement bas — « 8/20, peut mieux faire » n'est pas vécu comme
« 8/20 » seul, parce que l'observation dit quoi travailler. JobBot sait déjà calculer cette
observation : il connaît, pour chaque offre, les compétences manquantes, et il sait mesurer ce
qu'en ajouter une changerait sur toute la collecte (« cocher SQL ferait monter 23 offres »).

Dis-nous donc aussi : **est-ce que la forme du relevé résout le problème du 18/100, ou est-ce
qu'elle l'habille ?** Si une note basse reste décourageante même accompagnée d'une observation
utile, il faut le dire maintenant plutôt que de polir un écran que personne ne supportera.

Et si tu proposes deux notes, précise comment elles tiennent dans ce document : deux colonnes, deux
relevés séparés, une moyenne et une sous-moyenne ? Un relevé à deux moyennes générales n'existe pas
dans la convention d'origine, et s'en écarter coûte la lisibilité immédiate qui justifiait ce choix.

## Ce qu'on attend de toi

1. **Faut-il une note, deux notes, ou autre chose ?** Argumente, y compris contre la piste ci-dessus
   si elle est mauvaise. Une échelle non numérique, un classement relatif plutôt qu'absolu, ou un
   affichage sans note globale sont des réponses recevables.
2. **Comment présenter un score honnêtement bas sans décourager ?** C'est le vrai problème produit.
   18/100 est exact ; c'est aussi ce qui fait fermer l'onglet.
3. **Que faire de « diversité » et de ses 14 points identiques pour tous ?** Et des 34 % d'offres
   qui ne citent aucune technologie — leur donner des points par défaut, zéro, ou les sortir du
   classement en le disant ?
4. **Que montrer en page d'accueil à quelqu'un qui n'a encore rien coché ?** Fanel veut une
   démonstration au début. Avec de vraies données uniquement.
5. **La forme du relevé tient-elle ?** Voir la section précédente : résout-elle le problème du
   score bas, ou le déguise-t-elle ? Et comment y loger ta proposition de notation ?
6. **Quels pièges éthiques ou juridiques** à noter des offres d'emploi et à afficher un chiffre qui
   ressemble à une probabilité d'embauche sans en être une ?

Réponds en français. Va au fond plutôt que de survoler les cinq points : mieux vaut deux réponses
solides que cinq tièdes. Si tu penses que la prémisse est fausse — qu'il ne faut pas de note du
tout — dis-le.
