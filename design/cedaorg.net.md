# Design Map

Relevé sur `https://www.cedaorg.net/en`, plus `/find-services` et `/our-blog`.
Fenêtre 1440 × 900. Les valeurs marquées *(3 pages)* sont systématiques, pas locales.

## Spacing Scale

| Valeur | Occurrences | Emploi |
|---|---|---|
| **8px** | 69 | unité de base |
| 16px | 38 | |
| 28px | 25 | |
| 12px | 14 | |
| 48px | 13 | |
| **100px** | 11 | écart entre sections, constant |
| 24px | 9 | |
| 32px | 7 | |
| 80px | 5 | gouttière de grille |

Base 8. L'écart inter-sections ne varie pas : 100px, mesuré quatre fois de suite.

## Font Hierarchy

| Rôle | Taille | Graisse | Interligne | Interlettrage | Famille |
|---|---|---|---|---|---|
| hero | 80px | 300 | 80px (1.0) | −1.6px | Montagu Slab |
| h2 | 64px | 300 | 64px (1.0) | −1.28px | Montagu Slab |
| h3 | 48px | 300 | 48px (1.0) | normal | Montagu Slab |
| chiffre vedette | 64px+ | 300 | — | — | Montagu Slab |
| corps | 16px | 400 | — | — | Inter |
| micro-label | 12px | 400 | — | +0.96px, capitales | Inter |

Deux graisses sur tout le site : **300** (79 occurrences) et **400** (58). Aucun gras.
Interligne exactement 1.0 sur les trois niveaux de titre.
Tailles effectivement employées : 12, 14, 15, 16, 20, 24, 28, 32, 48, 64, 80.

## Color Palette

| Rôle | Valeur | Part de surface | Usages texte |
|---|---|---|---|
| fond | `#FFFFFF` | 45,3 % | 39 |
| fond chaud | `#FFF8F0` | 2,9 % | — |
| fond inverse | `#191919` | 27,4 % | — |
| encre | `#191919` | — | 52 |
| encre atténuée | `#919191` | — | 11 |
| **accent** | `#0F8751` | **1,2 %** | 35 |

Une seule couleur d'accent, présente sur les trois pages. Elle sert d'encre avant de servir de fond : 35 usages en texte contre 10 en arrière-plan.

## Image Ratios

| Emploi | Rapport |
|---|---|
| photographie d'accueil, pleine largeur | 1.54:1 |
| photographie secondaire | 1.50:1 |
| vignette | 1.43:1 |

## Component Tokens

- **Rayons** : `9999px` (26 occurrences, dominant), `24px` (11), `8px` (11), `16px` (9), `12px` (1)
- **Ombre** : une seule, `rgba(0,0,0,0.12)` décalée de 8px, sans halo de flou
- **Boutons** : 12px, graisse 400, capitales, interlettrage +0.96px, rayon plein, padding latéral 32px
- **Mouvement** : `0.4s cubic-bezier(0.4, 0, 0.2, 1)`, appliqué à `color`, `background-color`, `border-color`, `box-shadow`, `padding`, `opacity`
- **Focus** : `:focus-visible` présent
- **Grille** : une seule grille déclarée, 3 colonnes, gouttière 80px. Le reste de la page est un flux à deux colonnes de hauteurs inégales, pas une grille régulière.

---

# Taste DNA

### Le titre énorme est maigre

- **Déclencheur** : un titre d'accueil posé par-dessus une photographie pleine largeur.
- **Décision** : 80px en graisse **300**, interligne 1.0 — plutôt qu'un 48px gras.
- **Raison** : à 80px la forme des lettres domine déjà la page. Ajouter de la graisse par-dessus transformerait la phrase en mur opaque et écraserait la photographie, qui est ce qui porte l'émotion. La taille fait l'emphase, donc la graisse peut rester légère. L'interligne à exactement 1.0 soude les quatre lignes en un bloc unique au lieu d'une liste de lignes.
- **Preuves** : `h1 80px / 80px / 300 / −1.6px` ; deux graisses sur toute la page (300 : 79 ; 400 : 58) ; ni 600 ni 700 dans la distribution.

### L'accent couvre un pour cent de la page

- **Déclencheur** : devoir signaler ce qui est cliquable et ce qui est une catégorie.
- **Décision** : un seul vert `#0F8751`, employé surtout comme encre — plutôt qu'en aplats de section.
- **Raison** : inonder des sections entières de la couleur de marque rendrait indistinguables les quelques éléments qui comptent — la pastille d'action, les sous-catégories de service. La rareté est exactement ce qui fait que l'œil les trouve. C'est un renoncement : la page aurait pu être bien plus verte, et elle serait devenue illisible en termes de hiérarchie.
- **Preuves** : 1,2 % de la surface peinte contre 45,3 % de blanc ; 35 usages en texte contre 10 en fond ; une seule couleur d'accent sur les trois pages.

### La première décision est une liste de besoins, pas un menu

- **Déclencheur** : un visiteur arrive sans connaître le vocabulaire de l'organisation.
- **Décision** : une carte crème posée en chevauchement sur la photographie, titrée « What do you need today? », listant cinq besoins concrets — plutôt qu'une barre de navigation déployée.
- **Raison** : une navigation dit comment l'organisation est découpée ; la carte dit ce que la personne ressent. Chaque ligne porte un titre en serif et un micro-label vert qui énumère les cas réels (« HEATING, ELECTRICITY, WATER, FURNACE ») : on s'y reconnaît sans connaître le mot juste. Et la dernière ligne, « Not sure what you need? », admet que la taxonomie échouera pour certains — en leur donnant quand même une porte.
- **Preuves** : la navigation est repliée en un unique bouton « Menu » dans l'accueil ; carte sur `#FFF8F0` ; sous-labels 12px capitales `+0.96px` en `#0F8751` ; ligne de secours terminale avec pastille pleine.

### Les chiffres sont le seul ornement

- **Déclencheur** : devoir établir une échelle et une crédibilité sans illustration.
- **Décision** : des nombres en serif de 64px et plus, en vert, avec un micro-label au-dessus — plutôt que des pictogrammes ou des images d'illustration.
- **Raison** : un nombre est à la fois la décoration et l'argument, donc rien sur la page n'est purement décoratif. Posé en alternance gauche-droite dans un flux de hauteurs inégales, il échappe au bandeau de statistiques aligné que produit n'importe quel gabarit.
- **Preuves** : 51000, 172751, 130 composés à 64px+ en `#0F8751` ; micro-label 12px capitales au-dessus de chaque nombre ; écarts de section constants à 100px ; une seule ombre, 12 % d'opacité, décalée sans flou.

---

# Ce qui se transpose à JobBot

Cette section sort du gabarit de la skill : elle existe parce que c'est la raison du relevé.

1. **Le bloc « de quoi as-tu besoin ? »** est la réponse directe au défaut d'accueil de JobBot. Un nouveau visiteur ne doit pas tomber sur un profil pré-rempli, mais sur un petit nombre de questions concrètes dont les sous-labels énumèrent les cas réels — et une porte de secours pour celui qui ne se reconnaît dans aucune.
2. **Les chiffres comme seul ornement** : JobBot a déjà les nombres (offres relevées, note, compétences manquantes). Composés grand, en serif, dans l'accent, ils remplacent le texte explicatif que tu trouves trop long.
3. **Deux graisses, un accent, une ombre.** Contrainte dure, vérifiable, qui empêche le retour à l'aspect de gabarit.
4. **Ce qui ne se transpose pas** : la photographie pleine page. CEDA montre des personnes qu'elle aide et en a le droit. JobBot n'a pas de photographies légitimes, et en mettre d'achetées serait exactement le mensonge visuel que le projet s'interdit. L'équivalent fonctionnel ici, c'est la densité typographique et les données réelles.
